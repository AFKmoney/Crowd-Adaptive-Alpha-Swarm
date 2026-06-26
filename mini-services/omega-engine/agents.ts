// OMEGA Engine — Alpha Swarm agents (Layer 2) — TITAN-1 rebuild
//
// Five agents produce raw SignalEvents per bar. Existing crowd-fade / momentum / mean-rev
// logic PRESERVED. New TITAN-1 logic paths:
//   - CrowdAgent: front-run spoofs (opposite to spoofSide) + snipe liquidation cascades.
//   - TrendAgent: boost in direction of toxic price pressure when mmFleeing.
//   - MeanRev / Macro / StatArb: unchanged (can read ATR for richer rationales).

import type {
  AgentSignal, Side,
  CrowdState, AtrState, LiquidationState, OrderBookState, ToxicFlowState, DominoState,
} from './types.ts'
import type { MarketTick } from './market-sim.ts'

export interface AgentContext {
  tick: MarketTick
  crowd: CrowdState
  // TITAN-1 extended context
  atr?: AtrState
  liquidations?: LiquidationState
  orderBook?: OrderBookState
  toxicFlow?: ToxicFlowState
  /** Recent price-pressure direction from the ToxicFlow module (-1 sell .. +1 buy).
   *  Passed separately because it isn't part of the TITAN-0 contract state. */
  toxicPressureDir?: number
  domino?: DominoState
}

export interface Agent {
  name: AgentSignal['agent']
  evaluate(ctx: AgentContext): Omit<AgentSignal, 'weightedConfidence'>
}

// ---- Trend (PPO trend mode) ----
// Existing momentum logic + NEW: if toxicFlow.mmFleeing, boost confidence in the
// direction of recent price pressure (the toxic flow direction).
export const TrendAgent: Agent = {
  name: 'trend',
  evaluate({ tick, toxicFlow, toxicPressureDir }) {
    const recentRet = tick.ret
    const rsi = tick.rsi14
    let side: Side = 'FLAT'
    let conf = 0.3
    let rationale = 'No clear trend; standing aside.'

    // Toxic-flow boost: when MMs are fleeing, price pressure is dominant — amplify.
    const toxicBoost = toxicFlow?.mmFleeing ? 0.15 : 0
    const pressureDir = toxicFlow?.mmFleeing ? (toxicPressureDir ?? 0) : 0

    if (recentRet > 0.0008 && rsi > 55) {
      side = 'BUY'
      conf = clamp(0.4 + recentRet * 80 + (rsi - 55) / 90 + toxicBoost, 0.4, 0.95)
      rationale = toxicBoost > 0
        ? `Momentum up (ret ${pct(recentRet)}, RSI ${rsi.toFixed(0)}) + 🧛 MM FLEEING (pressure ${pressureDir >= 0 ? 'BUY' : 'SELL'}) → boosted trend long.`
        : `Momentum up (ret ${pct(recentRet)}, RSI ${rsi.toFixed(0)}) → follow trend long.`
    } else if (recentRet < -0.0008 && rsi < 45) {
      side = 'SELL'
      conf = clamp(0.4 + Math.abs(recentRet) * 80 + (45 - rsi) / 90 + toxicBoost, 0.4, 0.95)
      rationale = toxicBoost > 0
        ? `Momentum down (ret ${pct(recentRet)}, RSI ${rsi.toFixed(0)}) + 🧛 MM FLEEING (pressure ${pressureDir >= 0 ? 'BUY' : 'SELL'}) → boosted trend short.`
        : `Momentum down (ret ${pct(recentRet)}, RSI ${rsi.toFixed(0)}) → follow trend short.`
    } else if (toxicBoost > 0 && Math.abs(pressureDir) > 0.3) {
      // No momentum signal yet but MMs fleeing + clear pressure direction → ride it
      side = pressureDir > 0 ? 'BUY' : 'SELL'
      conf = clamp(0.4 + Math.abs(pressureDir) * 0.3, 0.4, 0.7)
      rationale = `🧛 MM FLEEING detected (toxicity ${(toxicFlow!.toxicity * 100).toFixed(0)}%) → ride toxic ${pressureDir > 0 ? 'BUY' : 'SELL'} pressure in absence of momentum.`
    }
    return { agent: 'trend', side, confidence: round(conf, 3), rationale }
  },
}

// ---- MeanRev (PPO meanrev mode) ----
// Existing RSI/BB fade logic — unchanged. ATR surfaced in rationale when high.
export const MeanRevAgent: Agent = {
  name: 'meanrev',
  evaluate({ tick, atr }) {
    const rsi = tick.rsi14
    const bb = tick.bbPos
    let side: Side = 'FLAT'
    let conf = 0.3
    let rationale = 'Price near fair value; no reversion trade.'
    if (rsi > 70 && bb > 0.85) {
      side = 'SELL'
      conf = clamp(0.45 + (rsi - 70) / 60 + (bb - 0.85) * 2, 0.45, 0.88)
      rationale = `Overbought (RSI ${rsi.toFixed(0)}, BB ${bb.toFixed(2)})${atr && atr.volatilityRegime === 'extreme' ? ' [extreme vol]' : ''} → fade the extreme short.`
    } else if (rsi < 30 && bb < 0.15) {
      side = 'BUY'
      conf = clamp(0.45 + (30 - rsi) / 60 + (0.15 - bb) * 2, 0.45, 0.88)
      rationale = `Oversold (RSI ${rsi.toFixed(0)}, BB ${bb.toFixed(2)})${atr && atr.volatilityRegime === 'extreme' ? ' [extreme vol]' : ''} → fade the extreme long.`
    }
    return { agent: 'meanrev', side, confidence: round(conf, 3), rationale }
  },
}

// ---- Macro (LLM macro) ----
// Follows narrative = crowd sentiment direction (crowd-follower). Unchanged.
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
// Pair reversion vs an ETH proxy. Spread z from OBI. Unchanged.
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

// ---- Crowd (Crowd Engine contrarian + TITAN-1 spoof front-run + cascade snipe) ----
// Order of priority:
//   1. Active cascade wick not yet captured → contrarian snipe (BUY longs being liquidated,
//      i.e. price crashing; SELL if shorts being squeezed).
//   2. Spoof detected → front-run the spoof (opposite side to spoofSide).
//   3. Existing crowd-extreme fade logic.
//   4. Mild contrarian bias for |composite| > 0.4.
export const CrowdAgent: Agent = {
  name: 'crowd',
  evaluate({ crowd, liquidations, orderBook }) {
    const c = crowd.composite
    const ext = crowd.extreme

    // ---- 1) Cascade snipe (highest priority) ----
    if (liquidations?.cascade && !liquidations.cascade.wickCaptured) {
      // Longs being liquidated = price crashing → BUY the wick.
      // Shorts being squeezed = price rallying → SELL the wick.
      // We determine which by the sign of priceDropPct (negative = longs liquidated).
      const priceDropPct = liquidations.cascade.priceDropPct
      if (priceDropPct < 0) {
        // Price crashed → longs being liquidated → BUY the wick
        const sev = liquidations.cascade.severity
        const sevBoost = sev === 'severe' ? 0.25 : sev === 'moderate' ? 0.15 : 0.08
        const conf = clamp(0.65 + sevBoost, 0.65, 0.95)
        return {
          agent: 'crowd',
          side: 'BUY',
          confidence: round(conf, 3),
          rationale: `🎯 CASCADE SNIPE — ${sev} long liquidation wick (price ${priceDropPct.toFixed(2)}%, OI ${liquidations.cascade.oiDropPct.toFixed(2)}%) → BUY the wick before MMs refill.`,
        }
      } else if (priceDropPct > 0) {
        // Price spiked → shorts squeezed → SELL the wick
        const sev = liquidations.cascade.severity
        const sevBoost = sev === 'severe' ? 0.25 : sev === 'moderate' ? 0.15 : 0.08
        const conf = clamp(0.65 + sevBoost, 0.65, 0.95)
        return {
          agent: 'crowd',
          side: 'SELL',
          confidence: round(conf, 3),
          rationale: `🎯 CASCADE SNIPE — ${sev} short squeeze wick (price +${priceDropPct.toFixed(2)}%, OI ${liquidations.cascade.oiDropPct.toFixed(2)}%) → SELL the wick before MMs refill.`,
        }
      }
    }

    // ---- 2) Spoof front-run ----
    if (orderBook?.spoofDetected && orderBook.spoofSide) {
      // Fake bid wall (spoofSide='buy') → SELL (fade fake support)
      // Fake ask wall (spoofSide='sell') → BUY (fade fake resistance)
      const side: Side = orderBook.spoofSide === 'buy' ? 'SELL' : 'BUY'
      const conf = clamp(0.6 + (orderBook.cancellationDelta - 0.8) * 1.0, 0.6, 0.9)
      return {
        agent: 'crowd',
        side,
        confidence: round(conf, 3),
        rationale: `🕵️ SPOOF FRONT-RUN — fake ${orderBook.spoofSide.toUpperCase()} wall cancelled ${(orderBook.cancellationDelta * 100).toFixed(0)}% in 1s → ${side} (front-run the spoof).`,
      }
    }

    // ---- 3) Existing crowd-extreme fade ----
    if (ext && ext.decay > 0.1) {
      if (ext.direction === 'long') {
        return {
          agent: 'crowd',
          side: 'SELL',
          confidence: round(clamp(0.45 + ext.magnitude * 0.4 * ext.decay, 0.45, 0.9), 3),
          rationale: `Crowd extremely LONG (${ext.dimension}, ${crowd.fundingRateBps.toFixed(1)}bps funding) → fade crowd short.`,
        }
      } else {
        return {
          agent: 'crowd',
          side: 'BUY',
          confidence: round(clamp(0.45 + ext.magnitude * 0.4 * ext.decay, 0.45, 0.9), 3),
          rationale: `Crowd extremely SHORT (${ext.dimension}, ${crowd.fundingRateBps.toFixed(1)}bps funding) → fade crowd long.`,
        }
      }
    }

    // ---- 4) Mild contrarian bias ----
    if (Math.abs(c) > 0.4) {
      const side: Side = c > 0 ? 'SELL' : 'BUY'
      return {
        agent: 'crowd',
        side,
        confidence: round(clamp(0.3 + Math.abs(c) * 0.3, 0.3, 0.55), 3),
        rationale: `Crowd leaning ${c > 0 ? 'long' : 'short'} (composite ${c.toFixed(2)}) → mild contrarian fade.`,
      }
    }

    return {
      agent: 'crowd',
      side: 'FLAT',
      confidence: 0.2,
      rationale: 'Crowd at rest; no contrarian signal.',
    }
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
