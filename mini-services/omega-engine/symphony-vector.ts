// OMEGA Engine — Symphony Vector (BTC = conductor, altcoins = musicians) — Phase 4
//
// HFT algorithms link altcoins to BTC with 30-100ms latency. We never look at
// SOL or LINK charts — we scrutinize BTC's async ticks. When BTC funding + CVD
// shifts massively, deploy maker-grids on the 5 most liquid altcoins BEFORE HFT
// aligns them. BTC is the oracle; we cash the gain on the altcoins (3-5x amplified).

import type { SymphonyVectorState, CrowdState } from './types.ts'
import type { MarketTick } from './market-sim.ts'

const ALT_SYMBOLS = ['SOL-USDT', 'DOGE-USDT', 'LINK-USDT', 'AVAX-USDT', 'ARB-USDT']
const AMPLIFICATION = 4 // altcoins move ~4x BTC
const ORACLE_THRESHOLD = 0.5 // |BTC oracle signal| > 0.5 → strike

export interface SymphonyVectorEvent {
  type: 'symphony_vector_strike'
  message: string
  details: Record<string, unknown>
}

export class SymphonyVector {
  private active = false
  private btcOracleSignal = 0
  private altcoins: SymphonyVectorState['altcoins'] = []
  strikeCount = 0
  private lastStrike: SymphonyVectorState['lastStrike'] = null

  constructor() {
    // Initialize altcoin prices (simulated; would be real WS feeds in prod)
    this.altcoins = ALT_SYMBOLS.map((s, i) => ({
      symbol: s,
      price: [180, 0.15, 18, 38, 1.1][i],
      expectedMovePct: 0,
      lagMs: 30 + i * 15, // 30-90ms HFT alignment latency
      gridDeployed: false,
    }))
  }

  update(tick: MarketTick, crowd: CrowdState, atrBps: number): SymphonyVectorEvent[] {
    const events: SymphonyVectorEvent[] = []

    // BTC oracle signal = funding rate + CVD (cumulative volume delta) composite
    // funding: crowd.fundingRateBps normalized; CVD proxy = tick.ret * volume
    const fundingNorm = Math.tanh(crowd.fundingRateBps / 15) // -1..1
    const cvdProxy = Math.tanh(tick.ret * 200) // -1..1, recent BTC pressure
    this.btcOracleSignal = clamp(Math.round((fundingNorm * 0.6 + cvdProxy * 0.4) * 100) / 100, -1, 1)

    // Update altcoin prices (drift with BTC + amplify; lag means they haven't caught up yet)
    for (const alt of this.altcoins) {
      alt.price *= (1 + tick.ret * AMPLIFICATION * 0.3) // partial — they lag
      alt.expectedMovePct = this.btcOracleSignal * AMPLIFICATION * (atrBps / 50)
      alt.gridDeployed = false
    }

    // Strike when oracle signal is strong
    if (Math.abs(this.btcOracleSignal) >= ORACLE_THRESHOLD) {
      this.active = true
      const deployed = this.altcoins.map((a) => { a.gridDeployed = true; return a.symbol })
      const direction = this.btcOracleSignal > 0 ? 'LONG' : 'SHORT'
      events.push({
        type: 'symphony_vector_strike',
        message: `🎼 SYMPHONY VECTOR STRIKE — BTC oracle signal ${this.btcOracleSignal.toFixed(2)} (funding ${crowd.fundingRateBps.toFixed(1)}bps + CVD). Deploying maker-grids on ${deployed.length} altcoins (${direction}, ~${AMPLIFICATION}x amplified) before HFT aligns (30-90ms latency window).`,
        details: { btcSignal: this.btcOracleSignal, altcoins: deployed, direction, amplification: AMPLIFICATION },
      })
      this.strikeCount++
      this.lastStrike = { ts: Date.now(), altcoins: deployed, btcSignal: this.btcOracleSignal }
    } else {
      this.active = false
    }

    return events
  }

  state(): SymphonyVectorState {
    return {
      active: this.active,
      btcOracleSignal: this.btcOracleSignal,
      altcoins: this.altcoins.map((a) => ({ ...a, price: round(a.price, 4), expectedMovePct: round(a.expectedMovePct, 3) })),
      strikeCount: this.strikeCount,
      lastStrike: this.lastStrike,
    }
  }
}

function clamp(x: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, x)) }
function round(x: number, d: number) { const f = 10 ** d; return Math.round(x * f) / f }
