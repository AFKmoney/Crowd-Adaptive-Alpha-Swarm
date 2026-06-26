// OMEGA Engine — Toxic Flow / Vampire (TITAN-1)
//
// Simulates the war between aggressive market orders (eaten liquidity) and new limit
// orders (refilled liquidity). When market-makers stop refilling (bookRefillRate low),
// toxicity spikes — and if it stays elevated for 2 bars, mmFleeing flips true.
//
// Contract (TITAN-0):
//   - bookRefillRate = refilled / eaten over a 1s window
//   - toxicity = 1 - bookRefillRate (0..1)
//   - mmFleeing = true if toxicity > 0.7 for 2 consecutive bars
//   - emit toxic_mm_flee when mmFleeing flips true
//   - When mmFleeing, the trend agent boosts in the direction of the toxic flow
//     (recent price pressure direction).

import type { ToxicFlowState } from './types.ts'
import type { MarketTick } from './market-sim.ts'

const HISTORY_LEN = 60
const TOXIC_THRESHOLD = 0.7
const TOXIC_BARS_REQUIRED = 2

export interface ToxicFlowEvent {
  type: 'toxic_mm_flee'
  message: string
  details: Record<string, unknown>
}

export class ToxicFlow {
  toxicity = 0
  bookRefillRate = 1
  mmFleeing = false
  interpretation = 'Healthy two-sided market.'
  history: number[] = []

  private consecutiveToxicBars = 0
  private prevMmFleeing = false
  private pressureDir: number = 0 // -1 (sell pressure) .. +1 (buy pressure)

  update(tick: MarketTick): ToxicFlowEvent[] {
    const events: ToxicFlowEvent[] = []
    const ret = tick.ret
    const vol = Math.abs(ret)

    // ---- Eaten vs refilled liquidity (simulated) ----
    // Eaten scales with |return| (aggressive taker flow) + crowd OB imbalance.
    // Refilled scales inversely: when vol spikes, MMs pull quotes faster.
    const eaten = Math.max(0.05, vol * 800 + Math.abs(tick.obi) * 0.4 + Math.random() * 0.1)
    // MM refill response: lower when vol is high (they widen / pull), lower when
    // consecutive toxic bars (they're already fleeing).
    const mmStress = Math.min(1, vol * 600 + this.consecutiveToxicBars * 0.15)
    const refilled = Math.max(0, (1 - mmStress * 0.85) * eaten * (0.8 + Math.random() * 0.4))

    this.bookRefillRate = eaten > 0 ? clamp(refilled / eaten, 0, 1.2) : 1
    this.toxicity = clamp(1 - this.bookRefillRate, 0, 1)

    // ---- Pressure direction (for trend-agent boost) ----
    // EMA of returns; sign = direction of toxic flow
    this.pressureDir = clamp(this.pressureDir * 0.6 + ret * 200, -1, 1)

    // ---- Consecutive toxic bar counter ----
    if (this.toxicity > TOXIC_THRESHOLD) {
      this.consecutiveToxicBars++
    } else {
      this.consecutiveToxicBars = Math.max(0, this.consecutiveToxicBars - 1)
    }

    // ---- mmFleeing flip ----
    const wasFleeing = this.mmFleeing
    this.mmFleeing = this.consecutiveToxicBars >= TOXIC_BARS_REQUIRED
    if (this.mmFleeing && !wasFleeing) {
      events.push({
        type: 'toxic_mm_flee',
        message: `🧛 TOXIC MM FLEE — book refill rate collapsed to ${(this.bookRefillRate * 100).toFixed(0)}% (toxicity ${(this.toxicity * 100).toFixed(0)}% for ${this.consecutiveToxicBars} bars). MMs pulling quotes — trend boost in ${this.pressureDir >= 0 ? 'BUY' : 'SELL'} direction.`,
        details: {
          toxicity: this.toxicity, bookRefillRate: this.bookRefillRate,
          pressureDir: this.pressureDir, consecutiveBars: this.consecutiveToxicBars,
        },
      })
    }
    // Reset once toxicity falls back
    if (this.toxicity < 0.4 && this.consecutiveToxicBars === 0) {
      this.mmFleeing = false
    }
    this.prevMmFleeing = this.mmFleeing

    // ---- Interpretation string ----
    if (this.toxicity < 0.3) this.interpretation = 'Healthy two-sided market — MMs refilling normally.'
    else if (this.toxicity < 0.55) this.interpretation = 'Mild toxic flow — some MM widening.'
    else if (this.toxicity < 0.75) this.interpretation = 'Elevated toxicity — MMs stressed, quotes thinning.'
    else if (!this.mmFleeing) this.interpretation = 'High toxicity — MMs near flight threshold.'
    else this.interpretation = 'MM FLEEING — quote providers pulling liquidity, trend pressure dominant.'

    // ---- History ----
    this.history.push(round4(this.toxicity))
    if (this.history.length > HISTORY_LEN) this.history.shift()

    return events
  }

  /** Direction of recent toxic price pressure (-1 sell, +1 buy). */
  get pressureDirection(): number {
    return this.pressureDir
  }

  state(): ToxicFlowState {
    return {
      toxicity: round4(this.toxicity),
      bookRefillRate: round4(this.bookRefillRate),
      mmFleeing: this.mmFleeing,
      interpretation: this.interpretation,
      history: this.history.slice(),
    }
  }
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x))
}
function round4(x: number) {
  return Math.round(x * 10000) / 10000
}
