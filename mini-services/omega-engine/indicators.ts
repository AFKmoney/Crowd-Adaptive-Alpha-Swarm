// OMEGA Engine — Indicators (TITAN-1)
// Lightweight wrapper around the ATR computation that lives on the MarketSim.
// Maintains a rolling 60-bar ATR history + volatility regime bucket for the state.

import type { AtrState, VolatilityRegime } from './types.ts'
import type { MarketTick } from './market-sim.ts'

export class AtrTracker {
  private history: number[] = [] // atr14Bps values, last 60

  update(tick: MarketTick): AtrState {
    this.history.push(tick.atr14Bps)
    if (this.history.length > 60) this.history.shift()

    return {
      atr14Bps: round2(tick.atr14Bps),
      atrPct: round4(tick.atrPct),
      volatilityRegime: tick.volatilityRegime as VolatilityRegime,
      history: this.history.slice(),
    }
  }
}

function round2(x: number) {
  return Math.round(x * 100) / 100
}
function round4(x: number) {
  return Math.round(x * 10000) / 10000
}
