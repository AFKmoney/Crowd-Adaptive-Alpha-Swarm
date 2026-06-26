// OMEGA Engine — Market Regime Detector (Layer 3)
// A lightweight stand-in for the Gaussian HMM in the whitepaper. Classifies the
// rolling return/volatility space into 4 canonical regimes using thresholds, with
// hysteresis to avoid flicker. This is the FIRST axis the RegimeWeightRouter uses.

import type { Regime, RegimeState } from './types.ts'
import type { MarketTick } from './market-sim.ts'

export class RegimeDetector {
  private current: Regime = 'calm_bull'
  private sinceTs = Date.now()
  private confidence = 0.7
  private history: Array<{ ts: number; regime: Regime }> = [
    { ts: Date.now(), regime: 'calm_bull' },
  ]
  private stableBars = 0

  update(tick: MarketTick): Regime | null {
    // Classify from rolling return (drift direction) and vol20 (regime volatility)
    const vol = tick.vol20
    const rsi = tick.rsi14
    const bb = tick.bbPos

    let next: Regime
    const bullish = rsi > 52 && bb > 0.45
    const bearish = rsi < 42 && bb < 0.4
    const highVol = vol > 0.6

    if (bearish) next = 'bear'
    else if (bullish && highVol) next = 'volatile_bull'
    else if (bullish) next = 'calm_bull'
    else next = 'choppy'

    // Hysteresis: require the candidate to persist for a few bars before switching
    if (next === this.current) {
      this.stableBars = Math.min(this.stableBars + 1, 10)
      this.confidence = Math.min(0.97, 0.5 + this.stableBars * 0.05)
      return null
    }

    this.stableBars = this.stableBars > 3 ? 0 : this.stableBars - 1
    if (this.stableBars > 0) return null // not stable yet

    // Transition
    const prev = this.current
    this.current = next
    this.sinceTs = tick.ts
    this.confidence = 0.55
    this.stableBars = 0
    this.history.push({ ts: tick.ts, regime: next })
    if (this.history.length > 12) this.history.shift()
    void prev
    return next
  }

  state(): RegimeState {
    return {
      current: this.current,
      sinceTs: this.sinceTs,
      confidence: round(this.confidence, 2),
      history: this.history.slice(-12),
    }
  }

  get currentRegime(): Regime {
    return this.current
  }
}

function round(x: number, d: number) {
  const f = 10 ** d
  return Math.round(x * f) / f
}
