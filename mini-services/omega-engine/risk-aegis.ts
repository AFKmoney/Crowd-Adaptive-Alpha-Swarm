// OMEGA Engine — Risk Aegis (Layer 4) — TITAN-1 rebuild
// The "hors dogme" risk layer ported from SkyTrader's aegis.py.
//
// Core rule UNCHANGED: a -3% daily drawdown hard-stop blocks ALL normal trading — EXCEPT
// when a viable contrarian opportunity is detected (crowd extreme active + the consensus
// fades the crowd + confidence >= 0.70). In that exact case the hard-stop is OVERRIDDEN
// ("HORS DOGME OVERRIDE") because the contrarian edge is sharpest precisely at liquidation
// cascades — the moment when rigid institutional compliance forces everyone else to exit
// at the worst time.
//
// TITAN-1 CHANGES:
//   - Dynamic ATR-indexed TP/SL (replaces static CONTRARIAN_SL_BPS / NORMAL_SL_BPS):
//       dynamic_sl_bps = max(80, atr14Bps * 1.0)     // SL ≈ 1× ATR, floored at 0.8%
//       dynamic_tp_bps = dynamic_sl_bps * rrRatio     // contrarian rrRatio=3.3, normal=2.0
//   - Elastic asymmetry: if cascade active AND volatilityRegime='extreme' → tp_bps × 1.5
//     (captures +8% instead of +1.5% during cascade wicks).
//   - Contrarian trades hand off to ExecutionBlade (maker-grid fill).
//   - Position object carries dynamic takeProfitBps/stopLossBps + isContrarian flag.
//
// The hors-dogme override logic is PRESERVED EXACTLY.

import type {
  Side,
  CrowdState,
  Consensus,
  RiskState,
  RiskPosition,
  RiskDecision,
  EventType,
  VolatilityRegime,
} from './types.ts'
import type { ExecutionBlade } from './execution-blade.ts'

const START_EQUITY = 10_000
const HARD_STOP_THRESHOLD = -0.03 // -3% daily drawdown
const KELLY_FRACTION = 0.25 // quarter Kelly
const MAX_POSITION_PCT = 0.20 // max 20% of equity per trade
const CONTRARIAN_RR = 3.3 // TP = 3.3 × SL (the asymmetric edge)
const NORMAL_RR = 2.0
const OVERRIDE_CONFIDENCE = 0.70 // confidence floor for hors-dogme override

// ATR-indexed dynamic TP/SL floors
const SL_FLOOR_BPS = 80 // 0.8% min stop
const SL_ATR_MULT = 1.0 // SL ≈ 1× ATR
const TP_EXTREME_BOOST = 1.5 // cascade + extreme vol → ×1.5 TP (elastic asymmetry)

export interface RiskEvent {
  type: EventType
  message: string
  details: Record<string, unknown>
}

export interface RiskContext {
  atr14Bps: number
  volatilityRegime: VolatilityRegime
  cascadeActive: boolean
  executionBlade: ExecutionBlade
  // TimeBandit pre-emption: when set, the position uses the TimeBandit's maximally
  // widened TP and is treated as a contrarian strike (maker-grid + hors-dogme eligible).
  timeBanditStrike?: {
    takeProfitBps: number
    confidence: number
  }
}

export class RiskAegis {
  equity = START_EQUITY
  dailyStartEquity = START_EQUITY
  maxEquity = START_EQUITY
  realizedPnlUsd = 0
  trades = 0
  wins = 0
  losses = 0
  horsDogmeOverrides = 0
  hardStopBlocks = 0
  position: RiskPosition | null = null
  lastDecision: RiskDecision | null = null
  private lastDay: number = new Date().getUTCDate()

  /** Returns the new state + any risk events to log. */
  evaluate(
    consensus: Consensus,
    crowd: CrowdState,
    price: number,
    ctx: RiskContext,
  ): { state: RiskState; events: RiskEvent[] } {
    const events: RiskEvent[] = []
    const now = Date.now()

    // ---- Daily reset ----
    const today = new Date().getUTCDate()
    if (today !== this.lastDay) {
      this.lastDay = today
      this.dailyStartEquity = this.equity
      events.push({
        type: 'risk_hard_stop',
        message: `Daily reset — daily start equity set to $${this.equity.toFixed(2)}`,
        details: { dailyStartEquity: this.equity },
      })
    }

    // ---- Mark-to-market open position ----
    if (this.position) {
      const pos = this.position
      pos.currentPrice = price
      const dir = pos.side === 'BUY' ? 1 : -1
      const pricePct = ((price - pos.entryPrice) / pos.entryPrice) * dir
      pos.unrealizedPnlPct = pricePct
      pos.unrealizedPnlUsd = pos.sizeUsd * pricePct

      // TP / SL hit detection (in bps from entry)
      const moveBps = Math.abs(((price - pos.entryPrice) / pos.entryPrice) * 10000)
      const tpHit = pricePct > 0 && moveBps >= pos.takeProfitBps
      const slHit = pricePct < 0 && moveBps >= pos.stopLossBps

      if (tpHit) {
        const realized = pos.sizeUsd * (pos.takeProfitBps / 10000)
        this.realizedPnlUsd += realized
        this.equity += realized
        this.trades++
        this.wins++
        this.maxEquity = Math.max(this.maxEquity, this.equity)
        events.push({
          type: 'risk_tp_hit',
          message: `🎯 TP HIT — ${pos.side} closed +$${realized.toFixed(2)} (TP ${pos.takeProfitBps}bps, RR ${pos.rrRatio})${pos.isContrarian ? ' [CONTRARIAN]' : ''}`,
          details: { side: pos.side, realized, takeProfitBps: pos.takeProfitBps, isContrarian: pos.isContrarian },
        })
        ctx.executionBlade.reset()
        this.position = null
      } else if (slHit) {
        const realized = -pos.sizeUsd * (pos.stopLossBps / 10000)
        this.realizedPnlUsd += realized
        this.equity += realized
        this.trades++
        this.losses++
        events.push({
          type: 'risk_sl_hit',
          message: `🛑 SL HIT — ${pos.side} closed $${realized.toFixed(2)} (SL ${pos.stopLossBps}bps)${pos.isContrarian ? ' [CONTRARIAN]' : ''}`,
          details: { side: pos.side, realized, stopLossBps: pos.stopLossBps, isContrarian: pos.isContrarian },
        })
        ctx.executionBlade.reset()
        this.position = null
      }
    }

    // ---- Drawdown ----
    const drawdownPct = (this.equity - this.dailyStartEquity) / this.dailyStartEquity
    const hardStopActive = drawdownPct <= HARD_STOP_THRESHOLD

    // ---- Determine if the consensus is a "viable contrarian opportunity" ----
    // A contrarian fade = crowd extreme is active AND the consensus side opposes the crowd direction.
    const ext = crowd.extreme
    const fadesCrowd =
      !!ext &&
      consensus.side !== 'FLAT' &&
      ((consensus.side === 'BUY' && ext.direction === 'short') ||
        (consensus.side === 'SELL' && ext.direction === 'long'))
    // A TimeBandit strike (priority-0 pre-emption from the Boule de Cristal) is ALWAYS
    // treated as a viable contrarian — it fades a liquidation cascade, which is the
    // sharpest contrarian edge. This makes it eligible for the hors-dogme override and
    // routes it through the maker-grid execution.
    const isTimeBandit = !!ctx.timeBanditStrike
    const isViableContrarian = (fadesCrowd && consensus.confidence >= OVERRIDE_CONFIDENCE) || isTimeBandit

    // ---- Decide what to do with the consensus signal ----
    let decision: RiskDecision

    // If we have an open position, and the consensus flipped against it, close it.
    if (this.position && consensus.side !== 'FLAT' && consensus.side !== this.position.side) {
      // close at market
      const pos = this.position
      const realized = pos.unrealizedPnlUsd
      this.realizedPnlUsd += realized
      this.equity += realized
      this.trades++
      if (realized >= 0) this.wins++
      else this.losses++
      this.maxEquity = Math.max(this.maxEquity, this.equity)
      events.push({
        type: 'trade_close',
        message: `Position closed on signal reversal — ${pos.side} ${realized >= 0 ? '+' : ''}$${realized.toFixed(2)}`,
        details: { side: pos.side, realized },
      })
      ctx.executionBlade.reset()
      this.position = null
    }

    // If consensus is FLAT and we have a position, close it.
    if (this.position && consensus.side === 'FLAT') {
      const pos = this.position
      const realized = pos.unrealizedPnlUsd
      this.realizedPnlUsd += realized
      this.equity += realized
      this.trades++
      if (realized >= 0) this.wins++
      else this.losses++
      events.push({
        type: 'trade_close',
        message: `Position flattened on FLAT consensus — ${pos.side} ${realized >= 0 ? '+' : ''}$${realized.toFixed(2)}`,
        details: { side: pos.side, realized },
      })
      ctx.executionBlade.reset()
      this.position = null
    }

    if (consensus.side === 'FLAT' || consensus.confidence < 0.25) {
      decision = {
        action: this.position ? 'hold' : 'no_signal',
        rationale: consensus.side === 'FLAT' ? 'Consensus is FLAT' : 'Confidence below floor',
        ts: now,
      }
    } else if (this.position && this.position.side === consensus.side) {
      // already in the position, hold
      decision = { action: 'hold', rationale: 'Already in position, holding', ts: now }
    } else if (hardStopActive) {
      // HORS DOGME check
      if (isViableContrarian) {
        // OVERRIDE — open the contrarian trade despite the hard stop
        this.horsDogmeOverrides++
        this.openPosition(consensus.side, consensus.confidence, price, true, crowd, ctx)
        decision = {
          action: 'override_hors_dogme',
          rationale: `🔥 HORS DOGME OVERRIDE: daily DD ${(drawdownPct * 100).toFixed(2)}% but viable contrarian (conf ${(consensus.confidence * 100).toFixed(0)}%, fades ${ext!.direction} crowd)`,
          ts: now,
        }
        events.push({
          type: 'risk_override',
          message: `🔥 HORS DOGME OVERRIDE — hard-stop at ${(drawdownPct * 100).toFixed(2)}% daily DD BUT viable contrarian detected (conf ${(consensus.confidence * 100).toFixed(0)}%, fades ${ext!.direction} crowd via ${ext!.dimension}). Trade AUTHORIZED with dynamic ${CONTRARIAN_RR}:1 RR (ATR-indexed).`,
          details: { drawdownPct, confidence: consensus.confidence, crowdDirection: ext!.direction, dimension: ext!.dimension },
        })
        events.push(...this.tradeOpenEvents(consensus.side, price, true, ctx))
      } else {
        // BLOCK
        this.hardStopBlocks++
        decision = {
          action: 'blocked_hard_stop',
          rationale: `🛡️ HARD STOP — daily DD ${(drawdownPct * 100).toFixed(2)}% ≤ -3%, signal not a viable contrarian`,
          ts: now,
        }
        events.push({
          type: 'risk_hard_stop',
          message: `🛡️ HARD STOP ACTIVATED — daily drawdown ${(drawdownPct * 100).toFixed(2)}%. Trade '${consensus.side}' blocked to protect capital (not a viable contrarian).`,
          details: { drawdownPct, side: consensus.side, confidence: consensus.confidence },
        })
      }
    } else {
      // Normal: open the position
      this.openPosition(consensus.side, consensus.confidence, price, isViableContrarian, crowd, ctx)
      decision = {
        action: 'allow',
        rationale: `Approved ${consensus.side} @ conf ${(consensus.confidence * 100).toFixed(0)}%`,
        ts: now,
      }
      events.push(...this.tradeOpenEvents(consensus.side, price, isViableContrarian, ctx))
    }

    this.lastDecision = decision

    return { state: this.snapshot(drawdownPct, hardStopActive), events }
  }

  private tradeOpenEvents(side: Side, price: number, isContrarian: boolean, ctx: RiskContext): RiskEvent[] {
    const evs: RiskEvent[] = []
    const pos = this.position!
    evs.push({
      type: 'trade_open',
      message: `Opened ${isContrarian ? 'CONTRARIAN ' : ''}${side} @ $${price.toFixed(2)} — size $${pos.sizeUsd.toFixed(2)}, TP ${pos.takeProfitBps}bps / SL ${pos.stopLossBps}bps (RR ${pos.rrRatio}), Kelly ${(pos.kellyFraction * 100).toFixed(1)}%, ATR ${ctx.atr14Bps.toFixed(0)}bps${ctx.cascadeActive ? ' [CASCADE ACTIVE]' : ''}`,
      details: {
        side, sizeUsd: pos.sizeUsd, rr: pos.rrRatio,
        isContrarian, takeProfitBps: pos.takeProfitBps, stopLossBps: pos.stopLossBps,
        atr14Bps: ctx.atr14Bps, volatilityRegime: ctx.volatilityRegime, cascadeActive: ctx.cascadeActive,
      },
    })
    // If contrarian, hand off to the maker-grid execution blade
    if (isContrarian && ctx.executionBlade.deployIfContrarian(pos, ctx.cascadeActive)) {
      const tiers = ctx.executionBlade.gridOrders.map((o) => ({
        tier: o.tier, side: o.side, limitPricePct: o.limitPricePct, sizeUsd: o.sizeUsd,
      }))
      evs.push({
        type: 'maker_grid_deploy',
        message: `🔧 MAKER GRID DEPLOYED — 3-tier ${side} grid at offsets ${tiers.map((t) => t.limitPricePct + '%').join(', ')} (deploy $${price.toFixed(2)}). Tiers $${tiers[0].sizeUsd.toFixed(0)} each, awaiting fills.`,
        details: { side, deployPrice: price, cascadeActive: ctx.cascadeActive, tiers },
      })
    }
    return evs
  }

  private openPosition(
    side: Side,
    confidence: number,
    price: number,
    isContrarian: boolean,
    _crowd: CrowdState,
    ctx: RiskContext,
  ) {
    const rr = isContrarian ? CONTRARIAN_RR : NORMAL_RR

    // ---- Dynamic ATR-indexed SL/TP ----
    let slBps = Math.max(SL_FLOOR_BPS, ctx.atr14Bps * SL_ATR_MULT)
    // Round to nearest 5 bps for clean numbers
    slBps = Math.round(slBps / 5) * 5
    let tpBps = Math.round(slBps * rr)
    // Elastic asymmetry: cascade + extreme vol → ×1.5 TP
    const elasticBoost = isContrarian && ctx.cascadeActive && ctx.volatilityRegime === 'extreme'
    if (elasticBoost) {
      tpBps = Math.round(tpBps * TP_EXTREME_BOOST)
    }
    // TimeBandit override: maximally widened TP (price will crash/pump mechanically).
    if (ctx.timeBanditStrike) {
      tpBps = ctx.timeBanditStrike.takeProfitBps
    }

    // Kelly: f = (p*b - q) / b, where p = win prob, b = rr, q = 1-p
    const p = 0.5 + (confidence - 0.5) * 0.6
    const q = 1 - p
    const b = rr
    let kelly = (p * b - q) / b
    kelly = Math.max(0, kelly) * KELLY_FRACTION
    kelly = Math.min(kelly, MAX_POSITION_PCT)

    const sizeUsd = this.equity * kelly

    this.position = {
      side,
      sizeUsd: Math.round(sizeUsd * 100) / 100,
      entryPrice: price,
      currentPrice: price,
      unrealizedPnlUsd: 0,
      unrealizedPnlPct: 0,
      takeProfitBps: tpBps,
      stopLossBps: slBps,
      rrRatio: rr,
      kellyFraction: Math.round(kelly * 10000) / 10000,
      isContrarian,
      openedAt: Date.now(),
    }
  }

  private snapshot(drawdownPct: number, hardStopActive: boolean): RiskState {
    return {
      equity: Math.round(this.equity * 100) / 100,
      dailyStartEquity: Math.round(this.dailyStartEquity * 100) / 100,
      drawdownPct: Math.round(drawdownPct * 10000) / 10000,
      hardStopActive,
      hardStopThreshold: HARD_STOP_THRESHOLD,
      position: this.position
        ? {
            ...this.position,
            unrealizedPnlUsd: Math.round(this.position.unrealizedPnlUsd * 100) / 100,
            unrealizedPnlPct: Math.round(this.position.unrealizedPnlPct * 10000) / 10000,
          }
        : null,
      lastDecision: this.lastDecision,
      horsDogmeOverrides: this.horsDogmeOverrides,
      hardStopBlocks: this.hardStopBlocks,
      realizedPnlUsd: Math.round(this.realizedPnlUsd * 100) / 100,
      trades: this.trades,
      wins: this.wins,
      losses: this.losses,
      winRate: this.trades > 0 ? Math.round((this.wins / this.trades) * 10000) / 10000 : 0,
      maxEquity: Math.round(this.maxEquity * 100) / 100,
    }
  }
}
