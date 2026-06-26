// OMEGA Engine — Cross-Exchange Domino (TITAN-1)
//
// 3 venues: OKX (reference price = market price), Binance (lags ~50ms, small noise),
// Bybit (lags ~120ms, MORE leveraged → liquidations amplified ~2.5×).
//
// Contract (TITAN-0):
//   - Domino fires when Bybit.liq1sUsd > $5M in 1.5s AND |OKX.priceChange1s| < 0.1%
//     (i.e. OKX hasn't moved yet but Bybit is blowing up — front-run the OKX move)
//   - source=Bybit, target=OKX, edgePct = anticipated OKX move; short OKX
//   - domino.strikeCount cumulative; emit domino_strike

import type { VenueState, DominoState, VenueName } from './types.ts'
import type { MarketTick } from './market-sim.ts'

const BYBIT_LIQ_AMPLIFIER = 2.5
const DOMINO_LIQ_THRESHOLD_USD = 5_000_000
const DOMINO_WINDOW_MS = 1500
const DOMINO_OKX_MOVE_MAX_PCT = 0.1  // OKX hasn't moved >0.1% in 1s
const DOMINO_COOLDOWN_MS = 5000

export interface DominoEvent {
  type: 'domino_strike'
  message: string
  details: Record<string, unknown>
}

interface Venue {
  name: VenueName
  price: number
  prevPrice: number
  liq1sUsd: number
  lagMs: number
  dominoSignal: boolean
  // for Bybit: rolling window of (ts, liq) to check the 1.5s threshold
  recentLiqs: Array<{ ts: number; usd: number }>
}

export class VenuesDomino {
  venues: Venue[] = [
    { name: 'OKX', price: 0, prevPrice: 0, liq1sUsd: 0, lagMs: 0, dominoSignal: false, recentLiqs: [] },
    { name: 'Binance', price: 0, prevPrice: 0, liq1sUsd: 0, lagMs: 50, dominoSignal: false, recentLiqs: [] },
    { name: 'Bybit', price: 0, prevPrice: 0, liq1sUsd: 0, lagMs: 120, dominoSignal: false, recentLiqs: [] },
  ]

  domino: DominoState = {
    active: false, source: null, target: null, edgePct: 0, strikeCount: 0,
  }

  private dominoStartedAt = 0
  private prevOkxPrice = 0

  update(tick: MarketTick): DominoEvent[] {
    const events: DominoEvent[] = []
    const now = tick.ts
    const okxPrice = tick.price
    const ret = tick.ret

    // ---- Update each venue's price (OKX = ref, others lag with noise) ----
    const okx = this.venues[0]
    const binance = this.venues[1]
    const bybit = this.venues[2]

    okx.prevPrice = okx.price || okxPrice
    okx.price = okxPrice

    // Binance lags slightly (use a slightly stale price + noise)
    binance.prevPrice = binance.price || okxPrice
    binance.price = okxPrice * (1 + (Math.random() - 0.5) * 0.0002) // +/- 0.01% noise

    // Bybit: more noise + slower to catch up
    bybit.prevPrice = bybit.price || okxPrice
    bybit.price = okxPrice * (1 + (Math.random() - 0.5) * 0.0004) // +/- 0.02% noise

    // ---- Liquidations per venue ----
    // Base liquidation estimate from |return| (proportional to OI × |ret| × leverage).
    // OKX = baseline; Binance ~ 1.1×; Bybit = 2.5× (more leveraged crowd).
    const baseLiq = Math.abs(ret) * 5_000_000_000 * 5 * 0.05 // ~ OI * leverage * ret
    okx.liq1sUsd = Math.max(0, baseLiq * (0.9 + Math.random() * 0.2))
    binance.liq1sUsd = Math.max(0, baseLiq * 1.1 * (0.9 + Math.random() * 0.2))
    bybit.liq1sUsd = Math.max(0, baseLiq * BYBIT_LIQ_AMPLIFIER * (0.9 + Math.random() * 0.3))

    // Track Bybit's rolling 1.5s liq window
    bybit.recentLiqs.push({ ts: now, usd: bybit.liq1sUsd })
    bybit.recentLiqs = bybit.recentLiqs.filter((l) => now - l.ts <= DOMINO_WINDOW_MS)
    const bybitWindowLiq = bybit.recentLiqs.reduce((s, l) => s + l.usd, 0)

    // ---- Domino detection ----
    const okxChange1s = this.prevOkxPrice > 0 ? Math.abs((okx.price - this.prevOkxPrice) / this.prevOkxPrice * 100) : 0
    const bybitDominoTrigger = bybitWindowLiq > DOMINO_LIQ_THRESHOLD_USD && okxChange1s < DOMINO_OKX_MOVE_MAX_PCT

    // Reset dominoSignal flags
    okx.dominoSignal = false
    binance.dominoSignal = false
    bybit.dominoSignal = false

    if (bybitDominoTrigger && (now - this.dominoStartedAt > DOMINO_COOLDOWN_MS)) {
      // Fresh domino strike
      this.domino.active = true
      this.domino.source = 'Bybit'
      this.domino.target = 'OKX'
      // Edge = estimated OKX move = proportional to Bybit's liquidation pressure (capped)
      const edgePct = clamp(-(bybitWindowLiq / 50_000_000) * 0.4, -3.0, -0.2)
      this.domino.edgePct = round2(edgePct)
      this.domino.strikeCount++
      this.dominoStartedAt = now
      bybit.dominoSignal = true
      events.push({
        type: 'domino_strike',
        message: `⚡ DOMINO STRIKE — Bybit liq $${(bybitWindowLiq / 1e6).toFixed(2)}M in 1.5s, OKX flat (${okxChange1s.toFixed(3)}%). Front-run OKX: SHORT, edge ${edgePct.toFixed(2)}%. Strike #${this.domino.strikeCount}.`,
        details: {
          source: 'Bybit', target: 'OKX', bybitWindowLiq, okxChange1s,
          edgePct, strikeCount: this.domino.strikeCount,
        },
      })
    } else if (this.domino.active && now - this.dominoStartedAt > DOMINO_WINDOW_MS) {
      // Domino window expired
      this.domino.active = false
      this.domino.source = null
      this.domino.target = null
      this.domino.edgePct = 0
    }

    this.prevOkxPrice = okx.price

    return events
  }

  state(): { venues: VenueState[]; domino: DominoState } {
    return {
      venues: this.venues.map((v) => ({
        name: v.name,
        price: Math.round(v.price * 100) / 100,
        liq1sUsd: Math.round(v.liq1sUsd),
        lagMs: v.lagMs,
        dominoSignal: v.dominoSignal,
      })),
      domino: { ...this.domino, edgePct: round2(this.domino.edgePct) },
    }
  }
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x))
}
function round2(x: number) {
  return Math.round(x * 100) / 100
}
