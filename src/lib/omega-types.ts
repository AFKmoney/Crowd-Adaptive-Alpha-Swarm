// Frontend mirror of the OMEGA engine data contract.
// Kept in sync with mini-services/omega-engine/types.ts.

export type Regime = 'calm_bull' | 'volatile_bull' | 'choppy' | 'bear'
export type AgentName = 'trend' | 'meanrev' | 'macro' | 'stat_arb' | 'crowd'
export type AgentRole = 'crowd_follower' | 'contrarian' | 'neutral'
export type Side = 'BUY' | 'SELL' | 'FLAT'
export type CrowdDimension = 'funding' | 'sentiment' | 'buzz' | 'composite'
export type CrowdDirection = 'long' | 'short'

export type EventType =
  | 'regime_change'
  | 'crowd_extreme'
  | 'crowd_clear'
  | 'weight_reconfig'
  | 'consensus'
  | 'conflict_defer'

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
  magnitude: number
  triggeredAt: number
  decay: number
}

export interface CrowdState {
  sentiment: number
  fundingRateBps: number
  socialBuzz: number
  fearGreed: number
  composite: number
  extreme: CrowdExtreme | null
  history: Array<{ ts: number; composite: number }>
}

export interface AgentWeight {
  base: number
  multiplier: number
  effective: number
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
  confidence: number
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
