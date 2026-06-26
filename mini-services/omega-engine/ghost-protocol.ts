// OMEGA Engine — Ghost Protocol (Liquidity Vacuum) — Phase 4, Divine Level
//
// Market Makers are contractually obliged to keep liquidity on exchange, but their
// internal risk management kills them off when they lose too much. We track the
// correlation between spread widening and macro news events. When the spread
// blows out >0.2% at the exact second a news event fires, the MM bots have been
// disconnected — the book is EMPTY. During those ~3s of "Ghost Protocol":
//   1. Sweep market orders up to +2% (the book is thin, we eat it cheap)
//   2. Sell limit on the rebound when MMs reconnect
// We racketeer the spreads.

import type { GhostProtocolState, CrowdState } from './types.ts'
import type { MarketTick } from './market-sim.ts'
import type { OrderBookState } from './types.ts'

const SPREAD_THRESHOLD_BPS = 20 // 0.2% — MM disconnect signal
const VACUUM_DURATION_MS = 3000 // typical ghost window
const REBOUND_TARGET_PCT = 2.0 // +2% sweep target
const SWEEP_USD = 5000 // notional swept per vacuum

export interface GhostProtocolEvent {
  type: 'ghost_protocol_sweep' | 'ghost_protocol_rebound'
  message: string
  details: Record<string, unknown>
}

export class GhostProtocol {
  private active = false
  private spreadBps = 2
  private newsTrigger = false
  private vacuumStartedAt = 0
  private swept = false
  strikeCount = 0
  private lastStrike: GhostProtocolState['lastStrike'] = null
  private newsCooldown = 0 // ms until next news event can fire
  private lastNewsAt = 0

  update(tick: MarketTick, crowd: CrowdState, ob: OrderBookState, atrBps: number): GhostProtocolEvent[] {
    const events: GhostProtocolEvent[] = []
    const now = tick.ts

    // ---- Simulate the spread (real OKX WS would give bid/ask) ----
    // Base spread ~1-3bps; widens with volatility + order book imbalance stress.
    const volFactor = atrBps / 30
    const stressFactor = Math.abs(ob.imbalance) > 0.5 ? 2 : 1
    this.spreadBps = Math.max(1, 2 * volFactor * stressFactor + Math.random() * 1.5)

    // ---- News events: fire randomly (~every 30-90s) — Elon tweet, CPI print, etc. ----
    if (now - this.lastNewsAt > this.newsCooldown) {
      this.newsTrigger = true
      this.lastNewsAt = now
      this.newsCooldown = 30_000 + Math.random() * 60_000
      // A news event stresses the spread for ~3s
    } else if (now - this.lastNewsAt > 4000) {
      this.newsTrigger = false
    }

    // ---- Vacuum detection: spread blows out >threshold AT a news event ----
    const vacuumTrigger = this.newsTrigger && this.spreadBps >= SPREAD_THRESHOLD_BPS

    if (vacuumTrigger && !this.active) {
      // Vacuum opens
      this.active = true
      this.vacuumStartedAt = now
      this.swept = false
    }

    if (this.active) {
      const age = now - this.vacuumStartedAt
      // ---- Phase 1: SWEEP (first 500ms — book is thinnest) ----
      if (!this.swept && age < 500) {
        this.swept = true
        const sweptUsd = SWEEP_USD
        events.push({
          type: 'ghost_protocol_sweep',
          message: `👻 GHOST PROTOCOL SWEEP — MM bots disconnected (spread ${this.spreadBps.toFixed(1)}bps at news event). Book is EMPTY. Sweeping ${sweptUsd} USD market orders up to +${REBOUND_TARGET_PCT}%.`,
          details: { spreadBps: this.spreadBps, sweptUsd, age },
        })
      }
      // ---- Phase 2: REBOUND (after 1500ms — MMs reconnect, sell limit on the bounce) ----
      if (age > 1500 && age < 2000) {
        const reboundUsd = SWEEP_USD * (1 + REBOUND_TARGET_PCT / 100)
        events.push({
          type: 'ghost_protocol_rebound',
          message: `👻 GHOST PROTOCOL REBOUND — MMs reconnecting. Selling limit on the bounce at +${REBOUND_TARGET_PCT}% for +${REBOUND_TARGET_PCT}% profit. Vacuum racket complete.`,
          details: { reboundUsd, profitPct: REBOUND_TARGET_PCT, age },
        })
        this.strikeCount++
        this.lastStrike = { ts: now, sweptUsd: SWEEP_USD, reboundUsd }
        // Close the vacuum
        this.active = false
        this.newsTrigger = false
      }
      // ---- Timeout: if vacuum lasts >3s without rebound, close it ----
      if (age > VACUUM_DURATION_MS) {
        this.active = false
      }
    }

    return events
  }

  state(): GhostProtocolState {
    return {
      active: this.active,
      spreadBps: round(this.spreadBps, 2),
      spreadThresholdBps: SPREAD_THRESHOLD_BPS,
      newsTrigger: this.newsTrigger,
      vacuumAgeMs: this.active ? Date.now() - this.vacuumStartedAt : 0,
      vacuumDurationMs: VACUUM_DURATION_MS,
      swept: this.swept,
      rebondTargetPct: REBOUND_TARGET_PCT,
      strikeCount: this.strikeCount,
      lastStrike: this.lastStrike,
    }
  }
}

function round(x: number, d: number) { const f = 10 ** d; return Math.round(x * f) / f }
