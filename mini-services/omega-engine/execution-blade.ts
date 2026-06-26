// OMEGA Engine — Maker-Grid Execution Blade (TITAN-1)
//
// Replaces single market-fill for CONTRARIAN / cascade / domino trades. When the Risk
// Aegis opens a contrarian position, it hands off to the blade, which deploys 3 limit
// orders at entry × (1 - 0.001), (1 - 0.005), (1 - 0.010) for BUYs (mirror for SELLs).
// As price wicks, tiers fill sequentially at better prices → effective entry improves.
//
// Contract (TITAN-0):
//   - mode 'market' for normal trades, 'maker_grid' for contrarian
//   - each tier = 1/3 of position size
//   - rebateUsd += 0.0002 × filledNotional per tier (maker rebate)
//   - slippageSavedUsd += |mid - fillPrice| × qty vs market
//   - grid completes when all 3 fill OR cascade resolves → cancel remaining
//   - position's effective entry = weighted avg of filled tiers
//   - emit maker_grid_deploy / maker_grid_fill / maker_grid_complete
//
// The Risk Aegis still OWNS the position lifecycle (entry/TP/SL). The blade owns HOW the
// entry is filled: it holds a reference to the live position object and updates its
// entryPrice + sizeUsd as tiers fill.

import type { ExecutionState, GridOrder, RiskPosition } from './types.ts'
import type { EventType } from './types.ts'

export interface ExecutionBladeEvent {
  type: EventType
  message: string
  details: Record<string, unknown>
}

interface ActiveGrid {
  position: RiskPosition
  deployPrice: number
  cascadeActiveAtDeploy: boolean
}

const MAKER_REBATE_BPS = 0.0002 // 2 bps maker rebate
const TIER_OFFSETS_PCT = [0.1, 0.5, 1.0] // 0.1%, 0.5%, 1.0% from deploy price

export class ExecutionBlade {
  mode: 'market' | 'maker_grid' = 'market'
  gridOrders: GridOrder[] = []
  rebateUsd = 0
  slippageSavedUsd = 0
  activeGrids = 0

  private activeGrid: ActiveGrid | null = null

  /**
   * Deploy a 3-tier maker grid for a contrarian position. Returns true if deployed.
   * Non-contrarian positions are market-filled (mode='market', no grid).
   */
  deployIfContrarian(position: RiskPosition, cascadeActive: boolean): boolean {
    // If there's already an active grid tied to a DIFFERENT position, drop it first.
    if (this.activeGrid && this.activeGrid.position !== position) {
      this.activeGrid = null
      this.gridOrders = []
    }

    if (!position.isContrarian) {
      this.mode = 'market'
      this.activeGrid = null
      this.gridOrders = []
      return false
    }
    if (this.activeGrid) {
      // Already deployed for this position — no-op
      return true
    }

    this.mode = 'maker_grid'
    this.activeGrids++
    const deployPrice = position.entryPrice
    const side = position.side
    const sign = side === 'BUY' ? -1 : 1 // BUY limits BELOW, SELL limits ABOVE
    const tierSize = position.sizeUsd / 3

    this.gridOrders = TIER_OFFSETS_PCT.map((off, i) => ({
      id: 'g' + (i + 1) + '_' + Math.random().toString(36).slice(2, 8),
      tier: i + 1,
      side,
      limitPricePct: round2(sign * off),
      sizeUsd: Math.round(tierSize * 100) / 100,
      status: 'pending' as const,
    }))

    this.activeGrid = {
      position,
      deployPrice,
      cascadeActiveAtDeploy: cascadeActive,
    }
    return true
  }

  /**
   * Process fills on the active grid. MUST be called BEFORE risk-aegis.evaluate() so
   * TP/SL checks use the updated entryPrice. Returns events to log.
   */
  update(price: number, cascadeActive: boolean, now: number): ExecutionBladeEvent[] {
    const events: ExecutionBladeEvent[] = []
    if (!this.activeGrid) return events
    const { position, deployPrice, cascadeActiveAtDeploy } = this.activeGrid

    // ---- Check pending tiers for fills ----
    for (const o of this.gridOrders) {
      if (o.status !== 'pending') continue
      const limitPx = deployPrice * (1 + o.limitPricePct / 100)
      const hit = o.side === 'BUY' ? price <= limitPx : price >= limitPx
      if (hit) {
        o.status = 'filled'
        o.filledAt = now
        o.fillPrice = Math.round(limitPx * 100) / 100
        const rebate = MAKER_REBATE_BPS * o.sizeUsd
        const saved = (Math.abs(deployPrice - limitPx) / deployPrice) * o.sizeUsd
        this.rebateUsd += rebate
        this.slippageSavedUsd += saved
        events.push({
          type: 'maker_grid_fill',
          message: `🟢 MAKER GRID FILL — tier ${o.tier} ${o.side} @ $${o.fillPrice.toFixed(2)} (offset ${o.limitPricePct.toFixed(2)}%), size $${o.sizeUsd.toFixed(0)}, rebate $${rebate.toFixed(2)}, slippage saved $${saved.toFixed(2)}.`,
          details: {
            tier: o.tier, side: o.side, fillPrice: o.fillPrice,
            limitPricePct: o.limitPricePct, sizeUsd: o.sizeUsd,
            rebate, saved,
          },
        })
      }
    }

    // ---- Update position's effective entry = wavg of (fills at fillPrice + unfilled at deploy) ----
    const filled = this.gridOrders.filter((o) => o.status === 'filled')
    const pending = this.gridOrders.filter((o) => o.status === 'pending')
    let totalNotional = 0
    let wavg = 0
    for (const o of filled) {
      wavg += (o.fillPrice ?? deployPrice) * o.sizeUsd
      totalNotional += o.sizeUsd
    }
    for (const o of pending) {
      wavg += deployPrice * o.sizeUsd
      totalNotional += o.sizeUsd
    }
    if (totalNotional > 0) {
      position.entryPrice = Math.round((wavg / totalNotional) * 100) / 100
    }

    // ---- Completion / cancellation ----
    const allFilled = filled.length === this.gridOrders.length
    const cascadeResolved = cascadeActiveAtDeploy && !cascadeActive

    if (allFilled) {
      const finalWavg =
        filled.reduce((s, o) => s + (o.fillPrice ?? 0) * o.sizeUsd, 0) /
        filled.reduce((s, o) => s + o.sizeUsd, 0)
      position.entryPrice = Math.round(finalWavg * 100) / 100
      events.push({
        type: 'maker_grid_complete',
        message: `✅ MAKER GRID COMPLETE — all 3 tiers filled, wavg entry $${finalWavg.toFixed(2)} (vs deploy $${deployPrice.toFixed(2)}, improvement ${(((deployPrice - finalWavg) / deployPrice) * 100 * (position.side === 'BUY' ? 1 : -1)).toFixed(3)}%). Cumulative rebates $${this.rebateUsd.toFixed(2)}, slippage saved $${this.slippageSavedUsd.toFixed(2)}.`,
        details: {
          reason: 'all_filled', finalWavg, deployPrice,
          rebateUsd: this.rebateUsd, slippageSavedUsd: this.slippageSavedUsd,
        },
      })
      this.activeGrid = null
      this.gridOrders = []
    } else if (cascadeResolved) {
      // Cancel remaining tiers — keep filled portion only (shrink size)
      for (const o of this.gridOrders) {
        if (o.status === 'pending') o.status = 'cancelled'
      }
      if (filled.length > 0) {
        const finalWavg =
          filled.reduce((s, o) => s + (o.fillPrice ?? 0) * o.sizeUsd, 0) /
          filled.reduce((s, o) => s + o.sizeUsd, 0)
        const filledNotional = filled.reduce((s, o) => s + o.sizeUsd, 0)
        position.entryPrice = Math.round(finalWavg * 100) / 100
        position.sizeUsd = Math.round(filledNotional * 100) / 100
      }
      events.push({
        type: 'maker_grid_complete',
        message: `🛑 MAKER GRID CANCELLED — cascade resolved, ${filled.length}/3 tiers filled. Entry $${position.entryPrice.toFixed(2)}, size $${position.sizeUsd.toFixed(0)}.`,
        details: {
          reason: 'cascade_resolved', filledTiers: filled.length,
          entryPrice: position.entryPrice, sizeUsd: position.sizeUsd,
        },
      })
      this.activeGrid = null
      this.gridOrders = []
    }

    return events
  }

  /** Called by risk-aegis when the position closes (TP/SL/signal flip). */
  reset() {
    if (this.activeGrid) {
      // Cancel any pending tiers (no event — the position close event covers it)
      for (const o of this.gridOrders) {
        if (o.status === 'pending') o.status = 'cancelled'
      }
    }
    this.activeGrid = null
    this.gridOrders = []
    this.mode = 'market'
  }

  /** True if there's an active grid (maker fills in progress). */
  get isActive(): boolean {
    return !!this.activeGrid
  }

  state(): ExecutionState {
    return {
      mode: this.mode,
      gridOrders: this.gridOrders.map((o) => ({
        ...o,
        fillPrice: o.fillPrice !== undefined ? Math.round(o.fillPrice * 100) / 100 : undefined,
      })),
      rebateUsd: Math.round(this.rebateUsd * 100) / 100,
      slippageSavedUsd: Math.round(this.slippageSavedUsd * 100) / 100,
      activeGrids: this.activeGrids,
    }
  }
}

function round2(x: number) {
  return Math.round(x * 100) / 100
}
