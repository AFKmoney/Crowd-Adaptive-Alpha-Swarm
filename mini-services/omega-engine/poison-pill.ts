// OMEGA Engine — Poison Pill (MEV / On-Chain Shadowing) — Phase 4
//
// Monitor the mempool for whale DEX sales. A 50M USDC whale sale on Jupiter
// takes ~400ms to mine; the CEX reacts ~1s later (arbitrage bots bridge DeFi→CeFi).
// We short OKX before the CeFi gap closes — stealing time itself.

import type { PoisonPillState } from './types.ts'
import type { MarketTick } from './market-sim.ts'

const WHALE_THRESHOLD_USD = 5_000_000
const CHAINS = ['solana', 'ethereum'] as const
const DEXES = ['Jupiter', 'Uniswap V3', 'Raydium', '1inch', 'Curve']
const TOKENS = ['USDC', 'USDT', 'WETH', 'WBTC', 'SOL']

export interface PoisonPillEvent {
  type: 'poison_pill_strike'
  message: string
  details: Record<string, unknown>
}

interface PendingTx {
  hash: string
  chain: 'solana' | 'ethereum'
  dex: string
  tokenIn: string
  tokenOut: string
  amountUsd: number
  detectedAt: number
  expectedMineMs: number
  cexReactMs: number
}

export class PoisonPill {
  private active = false
  mempoolConnected = true // RPC node connected (simulated)
  private pending: PendingTx | null = null
  private recentStrikes: PoisonPillState['recentStrikes'] = []
  strikeCount = 0
  private lastInjectAt = 0
  private injectCooldown = 45_000 // ~45s between whale events

  update(tick: MarketTick, atrBps: number): PoisonPillEvent[] {
    const events: PoisonPillEvent[] = []
    const now = tick.ts

    // ---- Inject whale mempool events periodically ----
    if (!this.pending && now - this.lastInjectAt > this.injectCooldown) {
      // Higher chance during volatile periods
      if (Math.random() < 0.15 + atrBps / 200) {
        this.pending = {
          hash: '0x' + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10),
          chain: CHAINS[Math.floor(Math.random() * CHAINS.length)],
          dex: DEXES[Math.floor(Math.random() * DEXES.length)],
          tokenIn: TOKENS[Math.floor(Math.random() * TOKENS.length)],
          tokenOut: TOKENS[Math.floor(Math.random() * TOKENS.length)],
          amountUsd: WHALE_THRESHOLD_USD + Math.random() * 50_000_000,
          detectedAt: now,
          expectedMineMs: 400,
          cexReactMs: 1000,
        }
        this.lastInjectAt = now
        this.active = true
      }
    }

    // ---- If we have a pending whale tx, strike IMMEDIATELY (before it mines) ----
    if (this.pending && this.active) {
      const age = now - this.pending.detectedAt
      const edgePct = -(this.pending.amountUsd / 500_000_000) * 2 // bigger sale = bigger CEX dump

      events.push({
        type: 'poison_pill_strike',
        message: `💀 POISON PILL STRIKE — Whale ${this.pending.chain} ${this.pending.dex} sale detected in mempool: $${(this.pending.amountUsd / 1_000_000).toFixed(1)}M ${this.pending.tokenIn}→${this.pending.tokenOut}. Tx mines in ~${this.pending.expectedMineMs}ms; CEX reacts in ~${this.pending.cexReactMs}ms. SHORT OKX NOW — stealing ${(this.pending.cexReactMs - this.pending.expectedMineMs)}ms of time. Edge ${(edgePct * 100).toFixed(2)}%.`,
        details: {
          hash: this.pending.hash, chain: this.pending.chain, dex: this.pending.dex,
          amountUsd: this.pending.amountUsd, edgePct,
        },
      })

      this.recentStrikes.unshift({
        ts: now, amountUsd: this.pending.amountUsd,
        chain: this.pending.chain, edgePct,
      })
      if (this.recentStrikes.length > 8) this.recentStrikes.pop()
      this.strikeCount++

      // Clear the pending tx after strike (it "mined" and CEX reacted)
      this.pending = null
      this.active = false
    }

    return events
  }

  state(): PoisonPillState {
    return {
      active: this.active,
      mempoolConnected: this.mempoolConnected,
      pendingWhaleTx: this.pending ?? null,
      recentStrikes: this.recentStrikes,
      strikeCount: this.strikeCount,
    }
  }
}
