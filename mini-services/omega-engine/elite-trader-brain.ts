// OMEGA Engine — Elite Trader Brain
//
// How an elite trader at Jane Street / Jump Crypto thinks, coded into the bot.
// 5 mental pillars that separate pros from amateurs:
//
// 1. RISK-FIRST: tail risk hedging, correlation-aware sizing, drawdown recovery mode
// 2. CONVICTION SIZING: dynamic Kelly + conviction tiers + asymmetric deployment
// 3. MARKET CONTEXT: macro regime overlay + session timing + liquidity conditions
// 4. EXECUTION INTELLIGENCE: slippage prediction + adverse selection + TWAP/VWAP
// 5. META-COGNITION: performance attribution + self-diagnosis + regime adaptation

import type { MarketTick } from './market-sim.ts'
import type { CrowdState, Consensus, Side, RiskState } from './types.ts'

// ============================================================================
// PILLAR 1 — RISK-FIRST MINDSET
// "Before every trade, I calculate the worst case — not the best case."
// ============================================================================

export interface TailRiskAssessment {
  maxLossUsd: number          // worst-case dollar loss if everything goes wrong
  maxLossPct: number          // as % of equity
  survivalProbability: number // 0..1 — probability of surviving this trade
  tailEventActive: boolean    // black swan conditions detected
  hedgeRequired: boolean      // should we hedge?
  hedgeSizeUsd: number        // recommended hedge size
  reason: string
}

export interface DrawdownRecoveryState {
  inRecoveryMode: boolean     // currently recovering from drawdown
  recoveryProgress: number    // 0..1 (how far back to break-even)
  reducedSizing: boolean      // trading smaller until recovered
  sizeMultiplier: number      // 0.25-1.0 — how much to scale down
  reason: string
}

// ============================================================================
// PILLAR 2 — CONVICTION SIZING
// "Signal weak = small. Signal strong + multiple confirmations = big."
// ============================================================================

export type ConvictionTier = 'exploratory' | 'tactical' | 'conviction' | 'maximum'

export interface ConvictionAssessment {
  tier: ConvictionTier
  rawScore: number            // 0..1 from signal strength
  confirmations: number       // how many independent signals agree
  convictionMultiplier: number // 0.1-2.0 — applied to position size
  reason: string
}

// ============================================================================
// PILLAR 3 — MARKET CONTEXT
// "Same signal, different context = different trade."
// ============================================================================

export type MarketContext = 'accumulation' | 'markup' | 'distribution' | 'decline' | 'crisis' | 'recovery'
export type TradingSession = 'asia' | 'europe' | 'us' | 'overlap_eu_us' | 'weekend'

export interface ContextOverlay {
  context: MarketContext
  session: TradingSession
  liquidityCondition: 'thin' | 'normal' | 'deep' | 'drying'
  volatilityCondition: 'compressed' | 'normal' | 'elevated' | 'extreme'
  signalFilter: number        // 0..1 — multiplier applied to all signals (context gates the trade)
  tradeAllowed: boolean       // some contexts = no trade
  reason: string
}

// ============================================================================
// PILLAR 4 — EXECUTION INTELLIGENCE
// "How I enter is as important as when I enter."
// ============================================================================

export type ExecutionStrategy = 'passive_limit' | 'twap' | 'vwap' | 'iceberg' | 'aggressive_market' | 'maker_grid' | 'sniper_limit'

export interface ExecutionPlan {
  strategy: ExecutionStrategy
  slices: number              // how many sub-orders
  sliceIntervalMs: number     // time between slices
  displayQtyPct: number       // for iceberg: % of order shown
  slippagePredictionBps: number // predicted slippage in bps
  adverseSelectionRisk: number  // 0..1 — probability of being picked off
  expectedFillPrice: number   // predicted fill price
  reason: string
}

// ============================================================================
// PILLAR 5 — META-COGNITION
// "Why did I lose? Signal, timing, size, or luck?"
// ============================================================================

export interface TradeAttribution {
  totalTrades: number
  wins: number
  losses: number
  avgWinUsd: number
  avgLossUsd: number
  profitFactor: number        // gross profit / gross loss
  bestSignal: string          // which agent/weapon produces most profit
  worstSignal: string         // which produces most losses
  edgeDecay: number           // 0..1 — is the edge decaying? (1 = fresh, 0 = dead)
  diagnosis: string           // human-readable self-diagnosis
  recommendedAdjustment: string
}

// ============================================================================
// ELITE TRADER BRAIN — combines all 5 pillars
// ============================================================================

export interface EliteTraderBrainState {
  // Pillar 1: Risk
  tailRisk: TailRiskAssessment
  drawdownRecovery: DrawdownRecoveryState
  // Pillar 2: Conviction
  conviction: ConvictionAssessment
  // Pillar 3: Context
  context: ContextOverlay
  // Pillar 4: Execution
  execution: ExecutionPlan
  // Pillar 5: Meta-cognition
  attribution: TradeAttribution
  // Final decision
  finalDecision: {
    action: 'trade' | 'wait' | 'reduce' | 'hedge' | 'halt'
    adjustedSizeUsd: number   // after all adjustments
    adjustedSizePct: number   // as % of equity
    finalConfidence: number   // after context filter
    reason: string            // why this decision
  }
}

export class EliteTraderBrain {
  private tradeHistory: Array<{ agent: string; side: Side; pnlUsd: number; ts: number }> = []
  private equity = 10 // $10 real capital
  private peakEquity = 10
  private dailyStartEquity = 10

  evaluate(
    tick: MarketTick,
    crowd: CrowdState,
    consensus: Consensus,
    risk: RiskState,
    activeSignalCount: number,
    topBreakthroughConfidence: number,
  ): EliteTraderBrainState {
    const now = new Date()
    const hourUtc = now.getUTCHours()
    const dayUtc = now.getUTCDay()

    // ===== PILLAR 1: RISK-FIRST =====
    const drawdownPct = risk.drawdownPct
    const inRecovery = drawdownPct < -0.10 // >10% drawdown → recovery mode
    const recoveryProgress = drawdownPct < 0 ? Math.max(0, 1 + drawdownPct / 0.50) : 1
    const sizeMultiplier = inRecovery ? 0.25 + 0.75 * recoveryProgress : 1.0

    const tailEvent = crowd.extreme !== null || Math.abs(tick.ret) > 0.005
    const maxLossPct = risk.position ? Math.abs(risk.position.stopLossBps / 10000) * (risk.position.sizeUsd / this.equity) : 0
    const survivalProb = Math.max(0.1, 1 - maxLossPct - (tailEvent ? 0.15 : 0))

    const tailRisk: TailRiskAssessment = {
      maxLossUsd: risk.position ? risk.position.sizeUsd * (risk.position.stopLossBps / 10000) : 0,
      maxLossPct,
      survivalProbability: survivalProb,
      tailEventActive: tailEvent,
      hedgeRequired: tailEvent && maxLossPct > 0.05,
      hedgeSizeUsd: tailEvent ? risk.position?.sizeUsd * 0.3 || 0 : 0,
      reason: inRecovery
        ? `Recovery mode: DD ${(drawdownPct*100).toFixed(1)}% → sizing at ${(sizeMultiplier*100).toFixed(0)}%`
        : tailEvent
          ? 'Tail risk elevated — hedge recommended'
          : 'Risk within tolerance',
    }

    const drawdownRecovery: DrawdownRecoveryState = {
      inRecoveryMode: inRecovery,
      recoveryProgress,
      reducedSizing: inRecovery,
      sizeMultiplier,
      reason: inRecovery
        ? `Drawdown recovery: ${(recoveryProgress*100).toFixed(0)}% back to break-even. Sizing at ${(sizeMultiplier*100).toFixed(0)}%.`
        : 'No recovery needed — full sizing',
    }

    // ===== PILLAR 2: CONVICTION SIZING =====
    const rawScore = consensus.confidence
    const confirmations = activeSignalCount
    let tier: ConvictionTier
    let convictionMultiplier: number
    if (rawScore >= 0.90 && confirmations >= 3) { tier = 'maximum'; convictionMultiplier = 2.0 }
    else if (rawScore >= 0.75 && confirmations >= 2) { tier = 'conviction'; convictionMultiplier = 1.5 }
    else if (rawScore >= 0.50) { tier = 'tactical'; convictionMultiplier = 1.0 }
    else { tier = 'exploratory'; convictionMultiplier = 0.25 }

    const conviction: ConvictionAssessment = {
      tier,
      rawScore,
      confirmations,
      convictionMultiplier,
      reason: `${tier.toUpperCase()} — conf ${(rawScore*100).toFixed(0)}% × ${confirmations} confirmations → ${(convictionMultiplier).toFixed(1)}x sizing`,
    }

    // ===== PILLAR 3: MARKET CONTEXT =====
    // Determine market context from price action + crowd
    let context: MarketContext
    const rsi = tick.rsi14
    const vol = tick.volatilityRegime
    const crowdScore = crowd.composite
    if (Math.abs(tick.ret) > 0.003 && vol === 'extreme') context = 'crisis'
    else if (crowdScore > 0.6 && rsi > 70) context = 'distribution'
    else if (crowdScore < -0.6 && rsi < 30) context = 'decline'
    else if (vol === 'extreme' && tick.ret > 0) context = 'recovery'
    else if (rsi > 55 && crowdScore > 0.2) context = 'markup'
    else context = 'accumulation'

    // Session
    let session: TradingSession
    if (dayUtc === 0 || dayUtc === 6) session = 'weekend'
    else if (hourUtc >= 13 && hourUtc < 17) session = 'overlap_eu_us'
    else if (hourUtc >= 8 && hourUtc < 13) session = 'europe'
    else if (hourUtc >= 17 && hourUtc < 22) session = 'us'
    else session = 'asia'

    // Liquidity
    let liquidity: ContextOverlay['liquidityCondition']
    if (session === 'weekend') liquidity = 'thin'
    else if (session === 'asia') liquidity = 'normal'
    else if (session === 'overlap_eu_us') liquidity = 'deep'
    else liquidity = 'normal'

    // Signal filter: context gates the trade
    let signalFilter = 1.0
    let tradeAllowed = true
    let contextReason = ''
    if (context === 'crisis') { signalFilter = 0.3; contextReason = 'Crisis — only highest-conviction trades' }
    else if (context === 'distribution') { signalFilter = 0.5; contextReason = 'Distribution — fade rallies, smaller size' }
    else if (context === 'decline') { signalFilter = 0.7; contextReason = 'Decline — defensive, short bias only' }
    else if (context === 'accumulation') { signalFilter = 0.6; contextReason = 'Accumulation — wait for breakout' }
    else if (context === 'markup') { signalFilter = 1.2; contextReason = 'Markup — trend following, full size' }
    else if (context === 'recovery') { signalFilter = 1.3; contextReason = 'Recovery — momentum, aggressive' }

    if (session === 'weekend') { signalFilter *= 0.5; contextReason += ' | Weekend: thin liquidity, reduced size' }

    const contextOverlay: ContextOverlay = {
      context, session, liquidityCondition: liquidity,
      volatilityCondition: vol || 'normal',
      signalFilter,
      tradeAllowed,
      reason: contextReason,
    }

    // ===== PILLAR 4: EXECUTION INTELLIGENCE =====
    // Predict slippage based on volatility + liquidity
    const baseSlippage = vol === 'extreme' ? 15 : vol === 'high' ? 8 : vol === 'normal' ? 3 : 1
    const liquiditySlippage = liquidity === 'thin' ? 10 : liquidity === 'drying' ? 7 : 2
    const predictedSlippage = baseSlippage + liquiditySlippage
    const adverseSelection = liquidity === 'thin' ? 0.6 : liquidity === 'normal' ? 0.3 : 0.1

    // Choose execution strategy
    let strategy: ExecutionStrategy
    let slices = 1
    let sliceIntervalMs = 0
    let displayQtyPct = 100
    if (context === 'crisis') { strategy = 'aggressive_market'; slices = 1 }
    else if (liquidity === 'thin') { strategy = 'iceberg'; slices = 3; displayQtyPct = 30 }
    else if (predictedSlippage > 10) { strategy = 'twap'; slices = 5; sliceIntervalMs = 3000 }
    else if (consensus.confidence > 0.9) { strategy = 'sniper_limit'; slices = 1 }
    else { strategy = 'maker_grid'; slices = 3 }

    const expectedFill = tick.price * (1 + (consensus.side === 'BUY' ? 1 : -1) * predictedSlippage / 10000)

    const execution: ExecutionPlan = {
      strategy, slices, sliceIntervalMs, displayQtyPct,
      slippagePredictionBps: predictedSlippage,
      adverseSelectionRisk: adverseSelection,
      expectedFillPrice: expectedFill,
      reason: `${strategy} — ${slices} slice(s), predicted slippage ${predictedSlippage}bps, adverse selection ${(adverseSelection*100).toFixed(0)}%`,
    }

    // ===== PILLAR 5: META-COGNITION =====
    const recentTrades = this.tradeHistory.slice(-50)
    const wins = recentTrades.filter(t => t.pnlUsd > 0)
    const losses = recentTrades.filter(t => t.pnlUsd <= 0)
    const avgWin = wins.length > 0 ? wins.reduce((a, t) => a + t.pnlUsd, 0) / wins.length : 0
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, t) => a + t.pnlUsd, 0) / losses.length) : 0
    const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : wins.length > 0 ? 99 : 0

    // Agent attribution
    const agentPnl: Record<string, number> = {}
    for (const t of recentTrades) {
      agentPnl[t.agent] = (agentPnl[t.agent] || 0) + t.pnlUsd
    }
    const sortedAgents = Object.entries(agentPnl).sort((a, b) => b[1] - a[1])
    const bestSignal = sortedAgents[0]?.[0] || 'none'
    const worstSignal = sortedAgents[sortedAgents.length - 1]?.[0] || 'none'

    // Edge decay: if recent win rate declining
    const recentWinRate = recentTrades.length > 0 ? wins.length / recentTrades.length : 0.5
    const olderTrades = this.tradeHistory.slice(-100, -50)
    const olderWinRate = olderTrades.length > 0 ? olderTrades.filter(t => t.pnlUsd > 0).length / olderTrades.length : 0.5
    const edgeDecay = Math.max(0, Math.min(1, 1 - (olderWinRate - recentWinRate)))

    let diagnosis = ''
    let adjustment = ''
    if (recentTrades.length < 10) {
      diagnosis = 'Insufficient data — still learning'
      adjustment = 'Continue trading at reduced size'
    } else if (profitFactor < 1.0) {
      diagnosis = `Edge negative (PF ${profitFactor.toFixed(2)}) — ${worstSignal} is losing money`
      adjustment = `Reduce ${worstSignal} weight, increase ${bestSignal} weight`
    } else if (edgeDecay < 0.5) {
      diagnosis = 'Edge decaying — win rate declining vs baseline'
      adjustment = 'Reduce overall size, retrain agents'
    } else if (profitFactor > 2.0) {
      diagnosis = `Edge strong (PF ${profitFactor.toFixed(2)}) — ${bestSignal} is the primary alpha`
      adjustment = `Increase ${bestSignal} allocation, maintain discipline`
    } else {
      diagnosis = `Edge stable (PF ${profitFactor.toFixed(2)})`
      adjustment = 'Maintain current approach'
    }

    const attribution: TradeAttribution = {
      totalTrades: recentTrades.length,
      wins: wins.length, losses: losses.length,
      avgWinUsd: avgWin, avgLossUsd: avgLoss,
      profitFactor,
      bestSignal, worstSignal,
      edgeDecay,
      diagnosis, recommendedAdjustment: adjustment,
    }

    // ===== FINAL DECISION (combines all 5 pillars) =====
    const baseSize = this.equity * 0.20 // 20% base
    const convictionAdj = baseSize * convictionMultiplier
    const contextAdj = convictionAdj * signalFilter
    const recoveryAdj = contextAdj * sizeMultiplier
    const finalSize = Math.max(0, Math.min(this.equity * 0.80, recoveryAdj))
    const finalConfidence = consensus.confidence * signalFilter

    let action: 'trade' | 'wait' | 'reduce' | 'hedge' | 'halt'
    let reason = ''
    if (!tradeAllowed) { action = 'halt'; reason = 'Context forbids trading' }
    else if (finalConfidence < 0.25) { action = 'wait'; reason = `Confidence too low after context filter (${(finalConfidence*100).toFixed(0)}%)` }
    else if (inRecovery && finalConfidence < 0.60) { action = 'wait'; reason = 'Recovery mode — waiting for high-conviction setup' }
    else if (tailRisk.hedgeRequired) { action = 'hedge'; reason = 'Tail risk active — hedge existing position' }
    else if (finalSize < this.equity * 0.05) { action = 'reduce'; reason = `Size too small after adjustments ($${finalSize.toFixed(2)})` }
    else { action = 'trade'; reason = `${tier} trade | ${context} | ${session} | size $${finalSize.toFixed(2)} (${(finalSize/this.equity*100).toFixed(0)}%) | ${execution.strategy}` }

    return {
      tailRisk,
      drawdownRecovery,
      conviction,
      context: contextOverlay,
      execution,
      attribution,
      finalDecision: {
        action,
        adjustedSizeUsd: finalSize,
        adjustedSizePct: finalSize / this.equity,
        finalConfidence,
        reason,
      },
    }
  }

  recordTrade(agent: string, side: Side, pnlUsd: number) {
    this.tradeHistory.push({ agent, side, pnlUsd, ts: Date.now() })
    if (this.tradeHistory.length > 200) this.tradeHistory.shift()
    this.equity += pnlUsd
    this.peakEquity = Math.max(this.peakEquity, this.equity)
  }
}
