// OMEGA Engine — Wall Breaker agent (Phase 4, Divine Level)
//
// Detects retail buyers exhausting against an invisible resistance wall.
// When buy pressure is high but price can't break through, the buyers are
// trapped and about to capitulate. SELL into their backs with a quick 54bps
// scalp target.
//
// Signal logic:
//   - buyPressure: derived from OBI + positive crowd sentiment + funding
//   - priceResistance: price fails to make new highs despite buy pressure
//     (lower highs while volume rises = exhaustion)
//   - exhaustion = buyPressure * priceResistance
//   - strike when exhaustion > 0.6 → SELL @ 54bps TP

import type { WallBreakerState, Side, CrowdState } from './types.ts'
import type { MarketTick } from './market-sim.ts'
import type { OrderBookState } from './types.ts'

const EXHAUSTION_THRESHOLD = 0.6
const TP_BPS = 54 // quick scalp into trapped buyers
const STRIKE_CONFIDENCE = 0.72

export interface WallBreakerStrike {
  side: Side
  confidence: number
  takeProfitBps: number
  exhaustion: number
}

export class WallBreaker {
  private active = false
  private buyPressure = 0
  private priceResistance = 0
  private exhaustion = 0
  strikeCount = 0
  private lastStrike: WallBreakerState['lastStrike'] = null
  private recentHighs: number[] = []

  evaluate(tick: MarketTick, crowd: CrowdState, ob: OrderBookState): WallBreakerStrike | null {
    // ---- Buy pressure: OBI + crowd sentiment + funding ----
    // High OBI (bid-heavy) + bullish crowd + positive funding = retail buying hard
    const obiBuy = Math.max(0, ob.imbalance) // 0..1 bid-heavy
    const sentimentBuy = Math.max(0, crowd.sentiment) // 0..1 bullish
    const fundingBuy = Math.max(0, Math.tanh(crowd.fundingRateBps / 15)) // 0..1
    this.buyPressure = clamp01(obiBuy * 0.5 + sentimentBuy * 0.3 + fundingBuy * 0.2)

    // ---- Price resistance: track recent highs; if price can't break them despite buy pressure ----
    this.recentHighs.push(tick.price)
    if (this.recentHighs.length > 10) this.recentHighs.shift()
    const maxHigh = Math.max(...this.recentHighs)
    const distFromHigh = (maxHigh - tick.price) / maxHigh // 0 = at high, positive = below
    // Resistance is high when: buy pressure is high BUT price is falling away from the high
    // (lower highs, can't break through)
    const makingLowerHighs = this.recentHighs.length >= 4 &&
      this.recentHighs[this.recentHighs.length - 1] < this.recentHighs[this.recentHighs.length - 3]
    this.priceResistance = clamp01(
      (this.buyPressure > 0.4 ? 0.4 : 0) +
      (distFromHigh > 0.001 ? 0.3 : 0) +
      (makingLowerHighs ? 0.3 : 0),
    )

    // ---- Exhaustion = buy pressure × resistance ----
    this.exhaustion = this.buyPressure * this.priceResistance

    if (this.exhaustion >= EXHAUSTION_THRESHOLD) {
      this.active = true
      return {
        side: 'SELL',
        confidence: STRIKE_CONFIDENCE,
        takeProfitBps: TP_BPS,
        exhaustion: this.exhaustion,
      }
    }
    this.active = false
    return null
  }

  recordStrike(strike: WallBreakerStrike, price: number) {
    this.strikeCount++
    this.lastStrike = { ts: Date.now(), price, takeProfitBps: strike.takeProfitBps }
  }

  state(): WallBreakerState {
    return {
      active: this.active,
      buyPressure: round(this.buyPressure, 3),
      priceResistance: round(this.priceResistance, 3),
      exhaustion: round(this.exhaustion, 3),
      side: this.active ? 'SELL' : 'FLAT',
      confidence: this.active ? STRIKE_CONFIDENCE : 0,
      takeProfitBps: this.active ? TP_BPS : 0,
      strikeCount: this.strikeCount,
      lastStrike: this.lastStrike,
    }
  }
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)) }
function round(x: number, d: number) { const f = 10 ** d; return Math.round(x * f) / f }
