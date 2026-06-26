// OMEGA Engine — Alpha Swarm agents (Layer 2)
// Five agents produce raw SignalEvents per bar. Each implements on_tick → Signal.
// Agents are intentionally lightweight simulations of their whitepaper counterparts:
//   trend    — PPO trend-following (follows momentum)
//   meanrev  — PPO mean-reversion (fades RSI/BB extremes)
//   macro    — LLM macro economist (follows narrative = news sentiment direction)
//   stat_arb — statistical arbitrage (pair reversion vs ETH proxy)
//   crowd    — Crowd Engine contrarian (fades composite crowd score)

import type { AgentSignal, Side } from './types.ts'
import type { MarketTick } from './market-sim.ts'
import type { CrowdState } from './types.ts'

export interface AgentContext {
  tick: MarketTick
  crowd: CrowdState
}

export interface Agent {
  name: AgentSignal['agent']
  evaluate(ctx: AgentContext): Omit<AgentSignal, 'weightedConfidence'>
}

// ---- Trend (PPO trend mode) ----
export const TrendAgent: Agent = {
  name: 'trend',
  evaluate({ tick }) {
    const recentRet = tick.ret
    const rsi = tick.rsi14
    let side: Side = 'FLAT'
    let conf = 0.3
    let rationale = 'No clear trend; standing aside.'
    if (recentRet > 0.0008 && rsi > 55) {
      side = 'BUY'
      conf = clamp(0.4 + recentRet * 80 + (rsi - 55) / 90, 0.4, 0.92)
      rationale = `Momentum up (ret ${pct(recentRet)}, RSI ${rsi.toFixed(0)}) → follow trend long.`
    } else if (recentRet < -0.0008 && rsi < 45) {
      side = 'SELL'
      conf = clamp(0.4 + Math.abs(recentRet) * 80 + (45 - rsi) / 90, 0.4, 0.92)
      rationale = `Momentum down (ret ${pct(recentRet)}, RSI ${rsi.toFixed(0)}) → follow trend short.`
    }
    return { agent: 'trend', side, confidence: round(conf, 3), rationale }
  },
}

// ---- MeanRev (PPO meanrev mode) ----
export const MeanRevAgent: Agent = {
  name: 'meanrev',
  evaluate({ tick }) {
    const rsi = tick.rsi14
    const bb = tick.bbPos
    let side: Side = 'FLAT'
    let conf = 0.3
    let rationale = 'Price near fair value; no reversion trade.'
    if (rsi > 70 && bb > 0.85) {
      side = 'SELL'
      conf = clamp(0.45 + (rsi - 70) / 60 + (bb - 0.85) * 2, 0.45, 0.88)
      rationale = `Overbought (RSI ${rsi.toFixed(0)}, BB ${bb.toFixed(2)}) → fade the extreme short.`
    } else if (rsi < 30 && bb < 0.15) {
      side = 'BUY'
      conf = clamp(0.45 + (30 - rsi) / 60 + (0.15 - bb) * 2, 0.45, 0.88)
      rationale = `Oversold (RSI ${rsi.toFixed(0)}, BB ${bb.toFixed(2)}) → fade the extreme long.`
    }
    return { agent: 'meanrev', side, confidence: round(conf, 3), rationale }
  },
}

// ---- Macro (LLM macro) ----
// Follows narrative = crowd sentiment direction (crowd-follower). Uses the crowd
// engine's sentiment as a proxy for the LLM's directional view.
export const MacroAgent: Agent = {
  name: 'macro',
  evaluate({ crowd }) {
    const s = crowd.sentiment
    let side: Side = 'FLAT'
    let conf = 0.3
    let rationale = 'Narrative neutral; no macro edge.'
    if (s > 0.25) {
      side = 'BUY'
      conf = clamp(0.35 + Math.abs(s) * 0.6, 0.35, 0.85)
      rationale = `Bullish narrative (sentiment ${s.toFixed(2)}, F&G ${crowd.fearGreed.toFixed(0)}) → macro long.`
    } else if (s < -0.25) {
      side = 'SELL'
      conf = clamp(0.35 + Math.abs(s) * 0.6, 0.35, 0.85)
      rationale = `Bearish narrative (sentiment ${s.toFixed(2)}, F&G ${crowd.fearGreed.toFixed(0)}) → macro short.`
    }
    return { agent: 'macro', side, confidence: round(conf, 3), rationale }
  },
}

// ---- StatArb ----
// Pair reversion vs an ETH proxy. We simulate the BTC-ETH spread z-score from
// the order book imbalance as a stand-in.
export const StatArbAgent: Agent = {
  name: 'stat_arb',
  evaluate({ tick }) {
    const spreadZ = tick.obi * 2.5 // synthetic spread z
    let side: Side = 'FLAT'
    let conf = 0.3
    let rationale = 'Spread within bands; no arb entry.'
    if (spreadZ > 1.5) {
      side = 'SELL'
      conf = clamp(0.4 + (spreadZ - 1.5) * 0.2, 0.4, 0.8)
      rationale = `BTC-ETH spread z=${spreadZ.toFixed(2)} > 1.5 → short overvalued leg.`
    } else if (spreadZ < -1.5) {
      side = 'BUY'
      conf = clamp(0.4 + (-1.5 - spreadZ) * 0.2, 0.4, 0.8)
      rationale = `BTC-ETH spread z=${spreadZ.toFixed(2)} < -1.5 → long undervalued leg.`
    }
    return { agent: 'stat_arb', side, confidence: round(conf, 3), rationale }
  },
}

// ---- Crowd (NEW — the Crowd Engine's own contrarian signal) ----
// Fades the composite crowd score. When the crowd is extremely long, this agent
// says SELL; when extremely short, says BUY. At rest, it stays FLAT.
export const CrowdAgent: Agent = {
  name: 'crowd',
  evaluate({ crowd }) {
    const c = crowd.composite
    const ext = crowd.extreme
    let side: Side = 'FLAT'
    let conf = 0.2
    let rationale = 'Crowd at rest; no contrarian signal.'
    if (ext && ext.decay > 0.1) {
      if (ext.direction === 'long') {
        side = 'SELL'
        conf = clamp(0.45 + ext.magnitude * 0.4 * ext.decay, 0.45, 0.9)
        rationale = `Crowd extremely LONG (${ext.dimension}, ${crowd.fundingRateBps.toFixed(1)}bps funding) → fade crowd short.`
      } else {
        side = 'BUY'
        conf = clamp(0.45 + ext.magnitude * 0.4 * ext.decay, 0.45, 0.9)
        rationale = `Crowd extremely SHORT (${ext.dimension}, ${crowd.fundingRateBps.toFixed(1)}bps funding) → fade crowd long.`
      }
    } else if (Math.abs(c) > 0.4) {
      // Mild contrarian bias even below the extreme threshold
      side = c > 0 ? 'SELL' : 'BUY'
      conf = clamp(0.3 + Math.abs(c) * 0.3, 0.3, 0.55)
      rationale = `Crowd leaning ${c > 0 ? 'long' : 'short'} (composite ${c.toFixed(2)}) → mild contrarian fade.`
    }
    return { agent: 'crowd', side, confidence: round(conf, 3), rationale }
  },
}

export const ALL_AGENTS: Agent[] = [TrendAgent, MeanRevAgent, MacroAgent, StatArbAgent, CrowdAgent]

// ---- helpers ----
function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x))
}
function round(x: number, d: number) {
  const f = 10 ** d
  return Math.round(x * f) / f
}
function pct(x: number) {
  return (x * 100).toFixed(3) + '%'
}
