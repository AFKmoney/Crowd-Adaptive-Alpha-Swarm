// OMEGA Engine — shared types
// Adheres to the data contract in /home/z/my-project/worklog.md

export type Regime = 'calm_bull' | 'volatile_bull' | 'choppy' | 'bear'
export type AgentName = 'trend' | 'meanrev' | 'macro' | 'stat_arb' | 'crowd'
export type AgentRole = 'crowd_follower' | 'contrarian' | 'neutral'
export type Side = 'BUY' | 'SELL' | 'FLAT'
export type CrowdDimension = 'funding' | 'sentiment' | 'buzz' | 'composite'
export type CrowdDirection = 'long' | 'short'

export interface MarketState {
  symbol: string
  price: number
  changePct24h: number
  sparkline: number[]
}

export interface RegimeState {
  current: Regime
  sinceTs: number
  confidence: number
  history: Array<{ ts: number; regime: Regime }>
}

export interface CrowdExtreme {
  dimension: CrowdDimension
  direction: CrowdDirection
  magnitude: number // 0..1
  triggeredAt: number
  decay: number // 1.0 fresh → 0.0 fully unwound
}

export interface CrowdState {
  sentiment: number // -1..1
  fundingRateBps: number // perp funding, bps per 8h
  socialBuzz: number // 0..1 normalized volume
  fearGreed: number // 0..100
  composite: number // -1..1 signed crowd score
  extreme: CrowdExtreme | null
  history: Array<{ ts: number; composite: number }>
}

export interface AgentWeight {
  base: number // from regime
  multiplier: number // from crowd deflation
  effective: number // normalized effective weight
  role: AgentRole
}

export interface WeightsState {
  agents: Record<AgentName, AgentWeight>
  deflationActive: boolean
  reason: string | null
  totalRaw: number
}

export interface AgentSignal {
  agent: AgentName
  side: Side
  confidence: number // 0..1
  weightedConfidence: number
  rationale: string
}

export interface Consensus {
  side: Side
  confidence: number
  conflict: boolean
  quorumMet: boolean
  voteStd: number
}

export interface SignalsState {
  symbol: string
  agents: AgentSignal[]
  consensus: Consensus
}

export type EventType =
  | 'regime_change'
  | 'crowd_extreme'
  | 'crowd_clear'
  | 'weight_reconfig'
  | 'consensus'
  | 'conflict_defer'

export interface OmegaEvent {
  id: string
  ts: number
  type: EventType
  message: string
  details: Record<string, unknown>
}

export interface OmegaStats {
  uptime: number
  extremeCount: number
  reconfigCount: number
  consensusCount: number
  deferredCount: number
}

export interface OmegaState {
  ts: number
  regime: RegimeState
  market: MarketState
  crowd: CrowdState
  weights: WeightsState
  signals: SignalsState
  events: OmegaEvent[]
  stats: OmegaStats
}
