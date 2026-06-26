// OMEGA Engine — shared types
// Adheres to the data contract in /home/z/my-project/worklog.md (TITAN-0 extended).

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
  | 'trade_open'
  | 'trade_close'
  | 'risk_hard_stop'
  | 'risk_override'
  | 'risk_tp_hit'
  | 'risk_sl_hit'
  // TITAN-0 new event types
  | 'liquidation_snipe'
  | 'oi_cascade'
  | 'spoof_detected'
  | 'toxic_mm_flee'
  | 'domino_strike'
  | 'maker_grid_deploy'
  | 'maker_grid_fill'
  | 'maker_grid_complete'
  | 'wall_detected'

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

export interface RiskPosition {
  side: Side
  sizeUsd: number
  entryPrice: number
  currentPrice: number
  unrealizedPnlUsd: number
  unrealizedPnlPct: number
  takeProfitBps: number
  stopLossBps: number
  rrRatio: number
  kellyFraction: number
  isContrarian: boolean
  openedAt: number
}

export interface RiskDecision {
  action: 'allow' | 'blocked_hard_stop' | 'override_hors_dogme' | 'no_signal' | 'close' | 'hold'
  rationale: string
  ts: number
}

export interface RiskState {
  equity: number
  dailyStartEquity: number
  drawdownPct: number
  hardStopActive: boolean
  hardStopThreshold: number
  position: RiskPosition | null
  lastDecision: RiskDecision | null
  horsDogmeOverrides: number
  hardStopBlocks: number
  realizedPnlUsd: number
  trades: number
  wins: number
  losses: number
  winRate: number
  maxEquity: number
}

// ============ TITAN-0 — NEW EXTENDED FIELDS ============

export type VolatilityRegime = 'low' | 'normal' | 'high' | 'extreme'

export interface AtrState {
  atr14Bps: number // ATR-14 in basis points
  atrPct: number // ATR as % of price
  volatilityRegime: VolatilityRegime
  history: number[] // last 60 ATR values for sparkline
}

export interface LiquidationCascade {
  startedAt: number
  severity: 'minor' | 'moderate' | 'severe'
  priceDropPct: number
  oiDropPct: number
  wickCaptured: boolean
  ageMs: number
}

export interface RecentCascade {
  ts: number
  severity: string
  priceDropPct: number
  oiDropPct: number
}

export interface LiquidationState {
  openInterestUsd: number
  oiDelta1sUsd: number
  oiDeltaPct: number
  longLiqUsd1s: number
  shortLiqUsd1s: number
  cascade: LiquidationCascade | null
  recentCascades: RecentCascade[]
  snipeCount: number
}

export interface OrderBookWall {
  side: 'bid' | 'ask'
  pricePct: number // signed distance from mid (negative = below mid)
  sizeUsd: number
  isReal: boolean // false = spoof (will be cancelled)
}

export interface OrderBookState {
  bidWallUsd: number
  askWallUsd: number
  imbalance: number // -1..1 (bid-heavy +, ask-heavy -)
  cancellationDelta: number // 0..1, fraction of wall cancelled in 1s
  spoofDetected: boolean
  spoofSide: 'buy' | 'sell' | null
  wall: OrderBookWall | null
  spoofCount: number
}

export interface ToxicFlowState {
  toxicity: number // 0..1
  bookRefillRate: number // 0..1
  mmFleeing: boolean
  interpretation: string
  history: number[]
}

export type VenueName = 'OKX' | 'Binance' | 'Bybit'

export interface VenueState {
  name: VenueName
  price: number
  liq1sUsd: number
  lagMs: number
  dominoSignal: boolean
}

export interface DominoState {
  active: boolean
  source: VenueName | null
  target: VenueName | null
  edgePct: number
  strikeCount: number
}

export interface GridOrder {
  id: string
  tier: number // 1, 2, 3
  side: 'BUY' | 'SELL'
  limitPricePct: number // offset from entry, signed (e.g. -0.1, -0.5, -1.0)
  sizeUsd: number
  status: 'pending' | 'filled' | 'cancelled'
  filledAt?: number
  fillPrice?: number
}

export interface ExecutionState {
  mode: 'market' | 'maker_grid'
  gridOrders: GridOrder[]
  rebateUsd: number
  slippageSavedUsd: number
  activeGrids: number
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
  risk: RiskState
  // TITAN-0 extended
  atr: AtrState
  liquidations: LiquidationState
  orderBook: OrderBookState
  toxicFlow: ToxicFlowState
  venues: VenueState[]
  domino: DominoState
  execution: ExecutionState
}
