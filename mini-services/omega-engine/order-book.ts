// OMEGA Engine — Order Book Wall + Spoofing (TITAN-1)
//
// Simulates a deep L2 book around the mid price (20 levels bid/ask) and occasionally
// spawns a "wall" — a large order 0.1-0.5% from mid. ~70% of walls are spoofs (isReal=false)
// that cancel fast (>0.8 of size in 1s); real walls persist.
//
// Contract (TITAN-0):
//   - imbalance = (sumBid - sumAsk) / (sumBid + sumAsk)
//   - spoofDetected = wall.isReal=false AND cancellationDelta > 0.8 → spoofSide = wall side
//   - emit wall_detected (when a wall spawns) and spoof_detected (when a spoof cancels)
//
// Agents read this to FRONT-RUN the spoof: if spoofSide='buy' (fake bid wall), the crowd
// would interpret it as bullish support, but since it's a spoof it'll be pulled → SELL.

import type { OrderBookState, OrderBookWall } from './types.ts'
import type { MarketTick } from './market-sim.ts'
import type { CrowdState } from './types.ts'

const LEVELS = 20
const WALL_SPAWN_CHANCE = 0.03 // per bar
const SPOOF_CHANCE = 0.70      // 70% of walls are spoofs
const BASE_LEVEL_SIZE_USD = 120_000

export interface OrderBookEvent {
  type: 'wall_detected' | 'spoof_detected'
  message: string
  details: Record<string, unknown>
}

export class OrderBookSim {
  bidWallUsd = 0
  askWallUsd = 0
  imbalance = 0
  cancellationDelta = 0
  spoofDetected = false
  spoofSide: 'buy' | 'sell' | null = null
  wall: OrderBookWall | null = null
  spoofCount = 0

  // L2 levels (size in USD per level)
  private bids: number[] = []
  private asks: number[] = []

  private prevWall: OrderBookWall | null = null
  private prevWallSizeUsd = 0
  private spoofLatchMs = 0 // brief cooldown after spoof fires

  update(tick: MarketTick, crowd: CrowdState): OrderBookEvent[] {
    const events: OrderBookEvent[] = []
    const mid = tick.price

    // ---- Regenerate L2 levels around mid ----
    // Sizes decay with distance; biased by OBI and crowd direction.
    const crowdBias = crowd.composite // -1..1, +ve = crowd long
    this.bids = []
    this.asks = []
    let sumBid = 0, sumAsk = 0
    for (let i = 0; i < LEVELS; i++) {
      const dist = (i + 1) / LEVELS
      const base = BASE_LEVEL_SIZE_USD * (1 - dist * 0.6) * (0.7 + Math.random() * 0.6)
      const bid = Math.max(1000, base * (1 + crowdBias * 0.3 + tick.obi * 0.3))
      const ask = Math.max(1000, base * (1 - crowdBias * 0.3 - tick.obi * 0.3))
      this.bids.push(bid)
      this.asks.push(ask)
      sumBid += bid
      sumAsk += ask
    }
    this.imbalance = (sumBid - sumAsk) / (sumBid + sumAsk)

    // ---- Wall lifecycle ----
    // Carry the existing wall forward OR spawn a new one.
    if (this.wall) {
      // Existing wall: simulate cancellation (spoofs cancel fast, real walls decay slowly)
      const ageMs = tick.ts - (this.prevWallTs ?? tick.ts)
      let remainingFrac = 1
      if (this.wall.isReal) {
        // real wall decays ~5%/s
        remainingFrac = Math.max(0, 1 - 0.05 * (ageMs / 1000))
      } else {
        // spoof cancels fast: ~90%/s baseline (spec: spoofs cancel >0.8 in 1s),
        // even faster if price approaches the wall.
        const approaching =
          (this.wall.side === 'bid' && tick.ret < 0) ||
          (this.wall.side === 'ask' && tick.ret > 0)
        const cancelRate = approaching ? 1.6 : 0.95
        remainingFrac = Math.max(0, 1 - cancelRate * (ageMs / 1000))
      }

      // cancellationDelta = fraction removed in 1s
      const prev = this.prevWallSizeUsd
      const cur = this.wall.sizeUsd * remainingFrac
      this.cancellationDelta = prev > 0 ? Math.min(1, Math.max(0, (prev - cur) / prev)) : 0
      this.prevWallSizeUsd = cur
      this.wall.sizeUsd = cur

      // Update bidWallUsd / askWallUsd (the dominant wall on each side)
      if (this.wall.side === 'bid') {
        this.bidWallUsd = this.wall.sizeUsd
        this.askWallUsd = 0
      } else {
        this.askWallUsd = this.wall.sizeUsd
        this.bidWallUsd = 0
      }

      // ---- Spoof detection ----
      if (!this.wall.isReal && this.cancellationDelta > 0.8 && tick.ts - this.spoofLatchMs > 1500) {
        this.spoofDetected = true
        this.spoofSide = this.wall.side === 'bid' ? 'buy' : 'sell'
        this.spoofCount++
        this.spoofLatchMs = tick.ts
        events.push({
          type: 'spoof_detected',
          message: `🕵️ SPOOF DETECTED — fake ${this.wall.side.toUpperCase()} wall @ ${this.wall.pricePct.toFixed(2)}% from mid cancelled ${(this.cancellationDelta * 100).toFixed(0)}% in 1s. Front-run: ${this.spoofSide === 'buy' ? 'SELL' : 'BUY'} (fade the fake support).`,
          details: {
            side: this.wall.side, spoofSide: this.spoofSide,
            pricePct: this.wall.pricePct, cancellationDelta: this.cancellationDelta,
            spoofCount: this.spoofCount,
          },
        })
      }

      // Wall is fully cancelled → clear it
      if (remainingFrac <= 0.02) {
        this.wall = null
        this.bidWallUsd = 0
        this.askWallUsd = 0
        this.cancellationDelta = 0
      }
    } else {
      // No active wall — maybe spawn one
      this.spoofDetected = false
      this.spoofSide = null
      this.cancellationDelta = 0
      this.bidWallUsd = 0
      this.askWallUsd = 0
      if (Math.random() < WALL_SPAWN_CHANCE) {
        const side: 'bid' | 'ask' = Math.random() < 0.5 ? 'bid' : 'ask'
        const distPct = 0.1 + Math.random() * 0.4 // 0.1-0.5% from mid
        const isReal = Math.random() > SPOOF_CHANCE
        const sizeUsd = (isReal ? 8_000_000 : 5_000_000) * (0.7 + Math.random() * 0.8)
        const pricePct = side === 'bid' ? -distPct : distPct
        this.wall = { side, pricePct, sizeUsd: Math.round(sizeUsd), isReal }
        this.prevWallTs = tick.ts
        this.prevWallSizeUsd = sizeUsd
        if (side === 'bid') this.bidWallUsd = sizeUsd
        else this.askWallUsd = sizeUsd
        events.push({
          type: 'wall_detected',
          message: `🧱 WALL DETECTED — ${side.toUpperCase()} ${isReal ? 'REAL' : 'SPOOF?'} wall $${(sizeUsd / 1e6).toFixed(2)}M @ ${pricePct.toFixed(2)}% from mid.`,
          details: { side, pricePct, sizeUsd, isReal },
        })
      }
    }

    return events
  }

  private prevWallTs: number | null = null

  state(): OrderBookState {
    return {
      bidWallUsd: Math.round(this.bidWallUsd),
      askWallUsd: Math.round(this.askWallUsd),
      imbalance: round4(this.imbalance),
      cancellationDelta: round4(this.cancellationDelta),
      spoofDetected: this.spoofDetected,
      spoofSide: this.spoofSide,
      wall: this.wall ? { ...this.wall, sizeUsd: Math.round(this.wall.sizeUsd) } : null,
      spoofCount: this.spoofCount,
    }
  }
}

function round4(x: number) {
  return Math.round(x * 10000) / 10000
}
