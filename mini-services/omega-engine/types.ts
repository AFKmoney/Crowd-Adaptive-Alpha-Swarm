// OMEGA Engine — shared types
// Adheres to the data contract in /home/z/my-project/worklog.md (TITAN-0 extended).

export type Regime = 'calm_bull' | 'volatile_bull' | 'choppy' | 'bear'
export type AgentName = 'trend' | 'meanrev' | 'macro' | 'stat_arb' | 'crowd'
export type AgentRole = 'crowd_follower' | 'contrarian' | 'neutral'
export type Side = 'BUY' | 'SELL' | 'FLAT'
export type CrowdDimension = 'funding' | 'sentiment' | 'buzz' | 'composite'
export type CrowdDirection = 'long' | 'short'
export type LiveMode = 'sim' | 'testnet' | 'mainnet'

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
  // Time-Bandit / Boule de Cristal
  | 'time_bandit_strike'
  // Phase 4 — Divine Level
  | 'wall_breaker_strike'
  | 'ghost_protocol_sweep'
  | 'ghost_protocol_rebound'
  | 'symphony_vector_strike'
  | 'poison_pill_strike'
  // Phase 5 — Niveau Supérieur
  | 'chronos_parasite_strike'
  | 'gamma_squeeze_strike'
  | 'event_horizon_strike'
  // Level 6 — Architecture Quantique
  | 'iceberg_sonar_ping'
  | 'iceberg_sonar_mapped'
  | 'cex_inflow_vampire_strike'
  | 'cross_pair_vacuum_strike'
  | 'engine_overload_strike'
  | 'correlated_domino_strike'

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

// ============ Time-Bandit / Boule de Cristal ============

export interface CrystalBallEvent {
  ts: number
  side: 'long' | 'short' // which side got liquidated
  sizeUsd: number
  symbol: string
}

export interface CrystalBallState {
  connected: boolean // ws to Binance global liquidations feed
  signal: number // -1..1 (−1 = longs being massacred, +1 = shorts squeezed)
  longLiq2sUsd: number // long liquidations in the 2s window
  shortLiq2sUsd: number // short liquidations in the 2s window
  thresholdUsd: number // 500_000 — the spike that flips signal to ±1.0
  recentEvents: CrystalBallEvent[] // live liquidation feed (last 2s, newest first)
  strikeActive: boolean // |signal| >= 1.0
}

export interface TimeBanditState {
  active: boolean // currently pre-empting the swarm
  priority: 0 // ABSOLUTE — evaluates before price, before PPO, before whalewatch
  signal: number // mirror of the crystal ball signal
  side: Side // BUY | SELL | FLAT
  confidence: number // 0.99 when active (algorithmic certainty)
  takeProfitBps: number // maximally widened TP
  strikeCount: number // cumulative strikes
  lastStrike: { ts: number; side: Side; signal: number; confidence: number; takeProfitBps: number } | null
}

// ============ Live Mode (OKX connectivity) ============

export interface LiveStatus {
  mode: LiveMode
  okxConnected: boolean // WS connected to OKX
  credentialsConfigured: boolean
  exchange: string // 'okx'
  instId: string // 'BTC-USDT-SWAP'
  balanceUsd: number // real account equity (0 in sim)
  availableUsd: number
  marginRatio: number
  realPositions: Array<{
    instId: string
    side: 'long' | 'short' | 'net'
    pos: number
    avgPx: number
    upl: number
    uplRatio: number
    lever: string
  }>
  lastOrderResult: { ordId: string; sCode: number; sMsg: string; ts: number } | null
  liveTrades: number // cumulative real orders placed
}

// ============ Phase 4 — Divine Level ============

// Wall Breaker — detects retail buyers exhausting against an invisible resistance
// wall. When buy pressure is high but price can't break through, SELL into the
// buyers' backs (they're trapped, about to capitulate).
export interface WallBreakerState {
  active: boolean
  buyPressure: number // 0..1 — how hard retail is buying
  priceResistance: number // 0..1 — how much the wall is holding
  exhaustion: number // 0..1 — combined exhaustion signal
  side: Side // SELL when active
  confidence: number
  takeProfitBps: number // ~54bps (quick scalp into the trapped buyers)
  strikeCount: number
  lastStrike: { ts: number; price: number; takeProfitBps: number } | null
}

// Ghost Protocol (Liquidity Vacuum) — when MMs disconnect (spread widens >0.2% at
// a news event), the book is empty for ~3s. Sweep market orders +2%, sell limit
// on the rebound when MMs reconnect.
export interface GhostProtocolState {
  active: boolean // vacuum window open
  spreadBps: number // current bid/ask spread
  spreadThresholdBps: number // 20bps = 0.2%
  newsTrigger: boolean // a macro news event just fired
  vacuumAgeMs: number // how long the vacuum has been open
  vacuumDurationMs: number // typical ~3000ms
  swept: boolean // already swept the book this vacuum
  rebondTargetPct: number // +2% sweep target
  strikeCount: number
  lastStrike: { ts: number; sweptUsd: number; reboundUsd: number } | null
}

// Symphony Vector — BTC is the conductor, altcoins the musicians. When BTC funding
// + CVD shifts, deploy maker-grid on the 5 most liquid altcoins before HFT aligns
// them (30-100ms latency arbitrage).
export interface SymphonyVectorState {
  active: boolean
  btcOracleSignal: number // -1..1 (BTC funding + CVD composite)
  altcoins: Array<{
    symbol: string
    price: number
    expectedMovePct: number // amplified 3-5x vs BTC
    lagMs: number // HFT alignment latency
    gridDeployed: boolean
  }>
  strikeCount: number
  lastStrike: { ts: number; altcoins: string[]; btcSignal: number } | null
}

// Poison Pill (MEV / On-Chain Shadowing) — monitor the mempool for whale DEX sales.
// A 50M USDC whale sale takes ~400ms to mine; the CEX reacts ~1s later. Short OKX
// before the CeFi arbitrage bots bridge the DeFi→CeFi gap.
export interface PoisonPillState {
  active: boolean
  mempoolConnected: boolean // RPC node connected
  pendingWhaleTx: {
    hash: string
    chain: 'solana' | 'ethereum'
    dex: string
    tokenIn: string
    tokenOut: string
    amountUsd: number
    detectedAt: number
    expectedMineMs: number // ~400ms
    cexReactMs: number // ~1000ms
  } | null
  recentStrikes: Array<{ ts: number; amountUsd: number; chain: string; edgePct: number }>
  strikeCount: number
}

// ============ Phase 6 — Quantum Arsenal (8 concepts) ============

export interface QuantumWeaponState {
  name: string
  active: boolean
  confidence: number
  takeProfitBps: number
  side: Side
  detail: string // human-readable detail
  strikeCount: number
}

export interface QuantumArsenalState {
  // 1. Chronos Parasite — sniff institutional TWAP rhythm, front-run it
  chronosParasite: QuantumWeaponState & { twapDetected: boolean; twapIntervalMs: number }
  // 2. Gamma Squeeze — options MM negative gamma, buy spot ahead of forced covering
  gammaSqueeze: QuantumWeaponState & { gammaExposure: number; optionsMmCovering: boolean }
  // 3. Event Horizon — force the cascade by selling brutally, TP at the bottom
  eventHorizon: QuantumWeaponState & { cascadeForced: boolean; priceImpactBps: number }
  // 4. Iceberg Sonar — dust-order lidar to map hidden iceberg orders
  icebergSonar: QuantumWeaponState & { hiddenSizeUsd: number; surfaceSizeUsd: number; icebergRatio: number }
  // 5. CEX Inflow Vampire — cold wallet → exchange deposit, short before credited
  cexInflowVampire: QuantumWeaponState & { inflowUsd: number; confirmationsRemaining: number }
  // 6. Cross-Pair Liquidity Vacuum — DOGE pump drains ETH liquidity, short ETH
  crossPairVacuum: QuantumWeaponState & { pumpSymbol: string; drainedSymbol: string; liquidityDrainPct: number }
  // 7. Exchange Engine Overload — API latency spike, fade trapped retail
  exchangeOverload: QuantumWeaponState & { apiLatencyMs: number; latencyThresholdMs: number }
  // 8. Correlated Domino Matrix — SOL drops → DeFi liquidates WIF, short WIF
  correlatedDomino: QuantumWeaponState & { triggerSymbol: string; targetSymbol: string; collateralAtRiskUsd: number }
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
  // Time-Bandit / Boule de Cristal
  crystalBall: CrystalBallState
  timeBandit: TimeBanditState
  // Live mode
  live: LiveStatus
  // Phase 4 — Divine Level
  wallBreaker: WallBreakerState
  ghostProtocol: GhostProtocolState
  symphonyVector: SymphonyVectorState
  poisonPill: PoisonPillState
  // Phase 6 — Quantum Arsenal
  quantumArsenal: QuantumArsenalState
}
