// OMEGA Engine — TimeBandit agent (priority 0, ABSOLUTE)
//
// The prescience agent. Per the SkyTrader spec: "avant même de regarder le Prix,
// avant même de regarder le PPO ou le Whalewatch, l'agent TimeBandit avec la
// priorité 0 (Absolue) analyse le signal de la Boule de Cristal."
//
// If the Crystal Ball signal hits -1.0 (longs being massacred on Binance) or
// +1.0 (shorts being squeezed), the TimeBandit ORDERS an immediate SHORT/LONG
// on OKX with:
//   - confidence 0.99 (algorithmic certainty — the shock wave is guaranteed)
//   - Take Profit maximally widened (price will crash/pump mechanically)
//   - the debate chamber is BYPASSED (priority 0 pre-empts the swarm)
//
// This strike then flows into Risk Aegis, which sizes it (the hors-dogme override
// applies since it's a high-confidence contrarian fade) and may deploy a maker-grid.

import type { Side, TimeBanditState, Consensus } from './types.ts'
import type { CrystalBallState, AtrState } from './types.ts'

export interface TimeBanditStrike {
  side: Side // SHORT if longs liquidated (signal -1), LONG if shorts squeezed (signal +1)
  confidence: number // 0.99
  takeProfitBps: number // maximally widened
  signal: number // the crystal ball signal that triggered it
}

export class TimeBandit {
  priority = 0 as const // ABSOLUTE
  strikeCount = 0
  private active = false
  private lastStrike: TimeBanditState['lastStrike'] = null

  /**
   * Evaluate the crystal ball signal. Returns a strike if |signal| >= 1.0,
   * else null (the swarm proceeds normally).
   */
  evaluate(crystal: CrystalBallState, atr: AtrState): TimeBanditStrike | null {
    const sig = crystal.signal
    if (Math.abs(sig) < 1.0) {
      this.active = false
      return null
    }

    // Longs being massacred → price will crash → SHORT OKX
    // Shorts being squeezed → price will pump → LONG OKX
    const side: Side = sig < 0 ? 'SELL' : 'BUY'

    // Maximally widened TP: 5× ATR, floored at 800bps (0.8%), capped at 2000bps (2%).
    // "le prix va s'effondrer de manière garantie et mécanique" — ride the full shock wave.
    const takeProfitBps = Math.round(Math.max(800, Math.min(2000, atr.atr14Bps * 5)))

    this.active = true
    return {
      side,
      confidence: 0.99,
      takeProfitBps,
      signal: sig,
    }
  }

  /** Record that a strike was logged (called by the orchestrator when a strike fires). */
  recordStrike(strike: TimeBanditStrike): void {
    this.strikeCount++
    this.lastStrike = {
      ts: Date.now(),
      side: strike.side,
      signal: strike.signal,
      confidence: strike.confidence,
      takeProfitBps: strike.takeProfitBps,
    }
  }

  /** Build a synthetic consensus that overrides the debate chamber's output. */
  static overrideConsensus(strike: TimeBanditStrike): Consensus {
    return {
      side: strike.side,
      confidence: strike.confidence,
      conflict: false,
      quorumMet: true,
      voteStd: 0, // unanimous — the TimeBandit pre-empts
    }
  }

  state(crystal: CrystalBallState): TimeBanditState {
    return {
      active: this.active,
      priority: 0,
      signal: crystal.signal,
      side: this.active ? (crystal.signal < 0 ? 'SELL' : 'BUY') : 'FLAT',
      confidence: this.active ? 0.99 : 0,
      takeProfitBps: this.lastStrike?.takeProfitBps ?? 0,
      strikeCount: this.strikeCount,
      lastStrike: this.lastStrike,
    }
  }
}
