// OMEGA Engine — Liquidation Sniper (TITAN-1)
//
// Simulates open-interest (OI) drift + long/short liquidations driven by price moves.
// Fires OI cascade events when price drops fast AND OI unwinds fast — the canonical
// "crowded longs getting liquidated" wick that the contrarian blade is built to snipe.
//
// Contract (TITAN-0):
//   - cascade fires when priceDropPct(1s) <= -0.5% AND oiDeltaPct <= -1.0%
//   - severity: minor (>-2%), moderate (>-5%), severe (<=-5%)
//   - cascade.wickCaptured = true once the contrarian sniper enters during the window
//   - longLiqUsd1s ∝ OI × |drop| × leverage; symmetric for short squeezes
//   - snipeCount increments when a sniper fill fires during the cascade window

import type { LiquidationState, LiquidationCascade, RecentCascade } from './types.ts'
import type { MarketTick } from './market-sim.ts'
import type { CrowdState } from './types.ts'

const BASE_OI_USD = 1_200_000_000 // $1.2B open interest baseline
const LEVERAGE = 5 // average crowd leverage
const CASCADE_MAX_AGE_MS = 4000 // a cascade window stays "active" for 4s
const RECENT_KEEP = 10

export interface SniperEvent {
  type: 'oi_cascade' | 'liquidation_snipe'
  message: string
  details: Record<string, unknown>
}

export class LiquidationSniper {
  openInterestUsd = BASE_OI_USD
  oiDelta1sUsd = 0
  oiDeltaPct = 0
  longLiqUsd1s = 0
  shortLiqUsd1s = 0
  cascade: LiquidationCascade | null = null
  recentCascades: RecentCascade[] = []
  snipeCount = 0

  private prevPrice = 0
  private prevTs = 0
  private prevOi = BASE_OI_USD
  private cascadeStartPrice = 0

  /** Update from latest tick + crowd. Returns events to log. */
  update(tick: MarketTick, crowd: CrowdState): SniperEvent[] {
    const events: SniperEvent[] = []
    const now = tick.ts
    const price = tick.price

    // ---- Long / short liquidations (1s) — computed FIRST so OI drift can subtract them ----
    // Price drop X% → longLiqUsd1s ∝ OI × X × leverage (the leverage amplifies forced sells)
    // Price rise X% → shortLiqUsd1s similarly
    const crowdLongBias = (crowd.composite + 1) / 2 // 0..1 (1 = max long crowd)
    const priceRet = this.prevPrice > 0 ? (price - this.prevPrice) / this.prevPrice : 0
    const dropPct = -priceRet * 100 // positive = price dropping
    const risePct = priceRet * 100  // positive = price rising
    // Longs are more crowded when crowd leans long → bigger long liq cascade on drops.
    const longLeverageBoost = 0.5 + crowdLongBias * 0.6  // 0.5..1.1
    const shortLeverageBoost = 0.5 + (1 - crowdLongBias) * 0.6
    if (dropPct > 0) {
      this.longLiqUsd1s = Math.max(0, this.openInterestUsd * (dropPct / 100) * LEVERAGE * 0.4 * longLeverageBoost + Math.random() * 200_000)
    } else {
      this.longLiqUsd1s = Math.random() * 50_000 // baseline noise
    }
    if (risePct > 0) {
      this.shortLiqUsd1s = Math.max(0, this.openInterestUsd * (risePct / 100) * LEVERAGE * 0.35 * shortLeverageBoost + Math.random() * 200_000)
    } else {
      this.shortLiqUsd1s = Math.random() * 50_000
    }

    // ---- OI drift (simulated): rises when crowd leans long/euphoric, falls on price drops
    //         AND falls by the liquidation volume (closed positions reduce OI). ----
    const crowdGrowth = crowdLongBias * 0.0003 * BASE_OI_USD             // euphoria builds OI (~$360k/s max)
    const rallyBuild = Math.max(0, priceRet) * 4 * BASE_OI_USD * 0.02    // rallies build OI
    const manualClose = Math.min(0, priceRet) * 2 * BASE_OI_USD * 0.02   // smaller manual-close effect
    const noise = (Math.random() - 0.5) * BASE_OI_USD * 0.0004           // ±$240k noise
    const oiDrift = crowdGrowth + rallyBuild + manualClose - this.longLiqUsd1s - this.shortLiqUsd1s + noise
    this.openInterestUsd = Math.max(100_000_000, this.openInterestUsd + oiDrift)

    // ---- OI delta (1s) ----
    this.oiDelta1sUsd = this.openInterestUsd - this.prevOi
    this.oiDeltaPct = this.prevOi > 0 ? this.oiDelta1sUsd / this.prevOi : 0
    this.prevOi = this.openInterestUsd

    // ---- Cascade detection ----
    // Fires when priceDropPct(1s) <= -0.5% AND oiDeltaPct <= -1.0%
    const priceDropPct = priceRet * 100 // signed (negative = drop)
    const oiDropPct = this.oiDeltaPct * 100 // signed (negative = OI falling)
    const cascadeCondition = priceDropPct <= -0.5 && oiDropPct <= -1.0

    if (cascadeCondition && !this.cascade) {
      // Fresh cascade
      const severity = priceDropPct <= -5 ? 'severe' : priceDropPct <= -2 ? 'moderate' : 'minor'
      this.cascade = {
        startedAt: now,
        severity,
        priceDropPct: round2(priceDropPct),
        oiDropPct: round2(oiDropPct),
        wickCaptured: false,
        ageMs: 0,
      }
      this.cascadeStartPrice = this.prevPrice
      events.push({
        type: 'oi_cascade',
        message: `💥 OI CASCADE — ${severity.toUpperCase()} long liquidation: price ${priceDropPct.toFixed(2)}%, OI ${oiDropPct.toFixed(2)}% (OI delta $${(this.oiDelta1sUsd / 1e6).toFixed(2)}M). Sniper armed.`,
        details: { severity, priceDropPct, oiDropPct, oiDelta1sUsd: this.oiDelta1sUsd, longLiqUsd1s: this.longLiqUsd1s },
      })
    } else if (this.cascade) {
      // Active cascade — age it
      this.cascade.ageMs = now - this.cascade.startedAt
      // Refresh severity if price keeps falling
      if (priceDropPct < this.cascade.priceDropPct) {
        this.cascade.priceDropPct = round2(priceDropPct)
        this.cascade.oiDropPct = round2(Math.min(this.cascade.oiDropPct, oiDropPct))
        this.cascade.severity = priceDropPct <= -5 ? 'severe' : priceDropPct <= -2 ? 'moderate' : 'minor'
      }
      // Expire the cascade window
      if (this.cascade.ageMs > CASCADE_MAX_AGE_MS || priceRet > 0.002) {
        // price recovered (up >0.2% in 1s) OR window elapsed → cascade resolves
        this.recentCascades.unshift({
          ts: now,
          severity: this.cascade.severity,
          priceDropPct: this.cascade.priceDropPct,
          oiDropPct: this.cascade.oiDropPct,
        })
        if (this.recentCascades.length > RECENT_KEEP) this.recentCascades.pop()
        this.cascade = null
      }
    }

    this.prevPrice = price
    this.prevTs = now
    return events
  }

  /**
   * Called by the orchestrator when a contrarian sniper fill fires during the
   * active cascade window. Marks wickCaptured=true and increments snipeCount.
   * Returns a liquidation_snipe event for the log.
   */
  recordSnipe(side: 'BUY' | 'SELL', fillPrice: number): SniperEvent | null {
    this.snipeCount++
    if (this.cascade) {
      this.cascade.wickCaptured = true
      return {
        type: 'liquidation_snipe',
        message: `🎯 LIQUIDATION SNIPE — contrarian ${side} filled @ $${fillPrice.toFixed(2)} during ${this.cascade.severity} cascade (price drop ${this.cascade.priceDropPct.toFixed(2)}%). Wick CAPTURED.`,
        details: {
          side, fillPrice, severity: this.cascade.severity,
          priceDropPct: this.cascade.priceDropPct, oiDropPct: this.cascade.oiDropPct,
          snipeCount: this.snipeCount,
        },
      }
    }
    return null
  }

  /** True when a cascade window is currently active. */
  get cascadeActive(): boolean {
    return !!this.cascade
  }

  state(): LiquidationState {
    return {
      openInterestUsd: Math.round(this.openInterestUsd),
      oiDelta1sUsd: Math.round(this.oiDelta1sUsd),
      oiDeltaPct: round4(this.oiDeltaPct),
      longLiqUsd1s: Math.round(this.longLiqUsd1s),
      shortLiqUsd1s: Math.round(this.shortLiqUsd1s),
      cascade: this.cascade
        ? { ...this.cascade, ageMs: Math.round(this.cascade.ageMs) }
        : null,
      recentCascades: this.recentCascades.slice(),
      snipeCount: this.snipeCount,
    }
  }
}

function round2(x: number) {
  return Math.round(x * 100) / 100
}
function round4(x: number) {
  return Math.round(x * 10000) / 10000
}
