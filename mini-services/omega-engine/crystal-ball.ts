// OMEGA Engine — Boule de Cristal (Crystal Ball)
// The "ghost async task" that opens a WebSocket to Binance's global liquidations
// feed and listens continuously. It filters everything older than 2 seconds; if a
// spike of $500K+ liquidations hits (e.g. on LONGs), the internal signal flips to
// -1.0 (and +1.0 for short liquidation spikes).
//
// This is the prescience layer that feeds the TimeBandit agent (priority 0).
// In production this would be a real wss://fstream.binance.com/ws/!forceOrder@arr
// connection; here we simulate the feed with realistic event injection tied to
// market volatility and the local liquidation sniper cascade (cross-exchange
// correlation — when a cascade fires locally, Binance lights up too).

import type { CrystalBallState, CrystalBallEvent } from './types.ts'
import type { MarketTick } from './market-sim.ts'

const WINDOW_MS = 2000 // discard events older than 2s
const THRESHOLD_USD = 500_000 // the spike that flips signal to ±1.0
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT']

export class CrystalBall {
  connected = true // ws connection established at startup
  signal = 0 // -1..1
  private buffer: CrystalBallEvent[] = []
  private strikeActive = false

  /**
   * Advance one tick. Injects simulated Binance liquidation events based on
   * market volatility and whether a local cascade is active (cross-exchange
   * correlation). Then computes the 2s-windowed signal.
   */
  update(tick: MarketTick, cascadeActive: boolean, volRegime: string): void {
    const now = tick.ts

    // ---- Inject Binance liquidation events ----
    // Base rate: a few small liquidations per second (market noise).
    // Amplified by: volatility regime, local cascade (cross-exchange), big price moves.
    const volMult = volRegime === 'extreme' ? 4 : volRegime === 'high' ? 2.5 : volRegime === 'normal' ? 1.2 : 0.6
    const cascadeMult = cascadeActive ? 5 : 1
    const bigMove = Math.abs(tick.ret) > 0.004 ? 3 : 1

    // Noise liquidations (small, frequent)
    const noiseCount = Math.floor(2 * volMult)
    for (let i = 0; i < noiseCount; i++) {
      const side: 'long' | 'short' = Math.random() < 0.5 + tick.ret * 8 ? 'long' : 'short'
      this.buffer.push({
        ts: now - Math.floor(Math.random() * 1000),
        side,
        sizeUsd: Math.random() * 30_000 * volMult + 2000,
        symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      })
    }

    // Spike liquidations (large, rarer — these are what trigger strikes)
    // Higher chance during cascades / extreme vol / big moves.
    const spikeChance = 0.04 * cascadeMult * (volMult / 2) * bigMove
    if (Math.random() < spikeChance) {
      const side: 'long' | 'short' = tick.ret < 0 ? 'long' : 'short' // longs liq on dumps, shorts on pumps
      const spikeSize = (Math.random() * 1_500_000 + 500_000) * cascadeMult
      this.buffer.push({
        ts: now,
        side,
        sizeUsd: spikeSize,
        symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      })
    }

    // Occasionally a second spike in the same tick (the cascade accelerates)
    if (cascadeActive && Math.random() < 0.3) {
      const side: 'long' | 'short' = tick.ret < 0 ? 'long' : 'short'
      this.buffer.push({
        ts: now,
        side,
        sizeUsd: Math.random() * 2_000_000 + 800_000,
        symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      })
    }

    // ---- Filter: discard events older than 2 seconds ----
    this.buffer = this.buffer.filter((e) => now - e.ts < WINDOW_MS)

    // ---- Compute 2s-windowed liquidation totals ----
    let longLiq = 0
    let shortLiq = 0
    for (const e of this.buffer) {
      if (e.side === 'long') longLiq += e.sizeUsd
      else shortLiq += e.sizeUsd
    }

    // ---- Signal: -1.0 if longs massacred, +1.0 if shorts squeezed ----
    // Linear ramp from 0 at threshold/4 to ±1.0 at threshold, then clamped.
    const netLong = longLiq - shortLiq
    let sig = 0
    if (longLiq >= THRESHOLD_USD && longLiq > shortLiq) {
      // Longs being liquidated → price will crash → signal -1.0 (fade = SHORT)
      sig = -Math.min(1, longLiq / (THRESHOLD_USD * 1.5))
    } else if (shortLiq >= THRESHOLD_USD && shortLiq > longLiq) {
      // Shorts being squeezed → price will pump → signal +1.0 (fade = LONG)
      sig = Math.min(1, shortLiq / (THRESHOLD_USD * 1.5))
    } else {
      // Sub-threshold: gentle drift toward 0 from the net imbalance
      sig = Math.max(-0.4, Math.min(0.4, -netLong / (THRESHOLD_USD * 2)))
    }
    this.signal = Math.round(sig * 1000) / 1000
    this.strikeActive = Math.abs(this.signal) >= 1.0
  }

  state(): CrystalBallState {
    let longLiq = 0
    let shortLiq = 0
    for (const e of this.buffer) {
      if (e.side === 'long') longLiq += e.sizeUsd
      else shortLiq += e.sizeUsd
    }
    return {
      connected: this.connected,
      signal: this.signal,
      longLiq2sUsd: Math.round(longLiq),
      shortLiq2sUsd: Math.round(shortLiq),
      thresholdUsd: THRESHOLD_USD,
      recentEvents: this.buffer
        .slice()
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 12),
      strikeActive: this.strikeActive,
    }
  }

  get strikeActiveNow(): boolean {
    return this.strikeActive
  }
}
