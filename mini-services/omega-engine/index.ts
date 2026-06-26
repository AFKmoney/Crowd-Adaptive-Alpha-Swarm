// OMEGA Engine — main entry point (mini-service, port 3003) — TITAN-1 rebuild
//
// Runs the continuous OMEGA simulation loop and broadcasts live state over socket.io.
// Extended for Project TITAN: emits the FULL extended OmegaState contract (ATR,
// Liquidation Sniper, Order Book, Toxic Flow, Venues/Domino, Execution Blade) plus
// all new event types (oi_cascade, spoof_detected, toxic_mm_flee, domino_strike,
// maker_grid_deploy/fill/complete, liquidation_snipe, wall_detected).
//
// Per the worklog contract (TITAN-0), the client connects to io("/?XTransformPort=3003")
// and receives `omega:state` (full snapshot ~1s) and `omega:event` (single new events).

import { createServer } from 'http'
import { Server } from 'socket.io'
import { MarketSim } from './market-sim.ts'
import { CrowdEngine } from './crowd-engine.ts'
import { RegimeDetector } from './regime-detector.ts'
import { RegimeWeightRouter } from './regime-router.ts'
import { ALL_AGENTS } from './agents.ts'
import { debate } from './debate-chamber.ts'
import { RiskAegis } from './risk-aegis.ts'
import { AtrTracker } from './indicators.ts'
import { LiquidationSniper } from './liquidation-sniper.ts'
import { OrderBookSim } from './order-book.ts'
import { ToxicFlow } from './toxic-flow.ts'
import { VenuesDomino } from './venues.ts'
import { ExecutionBlade } from './execution-blade.ts'
import { CrystalBall } from './crystal-ball.ts'
import { TimeBandit } from './time-bandit.ts'
import type { OmegaState, OmegaEvent, EventType } from './types.ts'

const PORT = 3003
const TICK_MS = 1000 // 1 bar / 1 broadcast per second
const MAX_EVENTS = 60

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ service: 'omega-engine', status: 'running', port: PORT }))
})

const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ---- Engine state ----
const market = new MarketSim()
const crowd = new CrowdEngine()
const regimeDet = new RegimeDetector()
const router = new RegimeWeightRouter()
const risk = new RiskAegis()
const atr = new AtrTracker()
const sniper = new LiquidationSniper()
const orderBook = new OrderBookSim()
const toxic = new ToxicFlow()
const venues = new VenuesDomino()
const blade = new ExecutionBlade()
const crystalBall = new CrystalBall()
const timeBandit = new TimeBandit()

const startedAt = Date.now()
const events: OmegaEvent[] = []
const stats = { uptime: 0, extremeCount: 0, reconfigCount: 0, consensusCount: 0, deferredCount: 0 }
let lastConsensusSide: string | null = null

function logEvent(type: EventType, message: string, details: Record<string, unknown> = {}) {
  const ev: OmegaEvent = {
    id: Math.random().toString(36).slice(2, 10),
    ts: Date.now(),
    type,
    message,
    details,
  }
  events.unshift(ev)
  if (events.length > MAX_EVENTS) events.pop()
  io.emit('omega:event', ev)
}

// Seed an initial event
logEvent('regime_change', 'OMEGA engine online — TITAN-1 modules armed (ATR / Sniper / OrderBook / Toxic / Domino / MakerGrid). Regime calm_bull, crowd at rest.', {
  regime: 'calm_bull',
})

// ---- Main loop ----
function tick() {
  const marketTick = market.step()

  // Regime detection (first axis)
  const newRegime = regimeDet.update(marketTick)
  market.setRegime(regimeDet.currentRegime)
  if (newRegime) {
    logEvent('regime_change', `Regime transition → ${newRegime.toUpperCase()}`, {
      from: regimeDet.state().history.slice(-2, -1)[0]?.regime ?? 'unknown',
      to: newRegime,
    })
  }

  // Crowd engine (second axis — the original feature)
  const prevExtreme = crowd.extreme
  crowd.update(marketTick)
  const crowdState = crowd.state()
  if (crowdState.extreme && !prevExtreme) {
    stats.extremeCount++
    logEvent('crowd_extreme', `Crowd extreme detected — ${crowdState.extreme.direction.toUpperCase()} via ${crowdState.extreme.dimension}`, {
      dimension: crowdState.extreme.dimension,
      direction: crowdState.extreme.direction,
      magnitude: crowdState.extreme.magnitude,
      fundingBps: crowdState.fundingRateBps,
      sentiment: crowdState.sentiment,
      composite: crowdState.composite,
    })
  } else if (!crowdState.extreme && prevExtreme) {
    logEvent('crowd_clear', 'Crowd extreme unwound — weights relaxing to regime baseline.', {
      dimension: prevExtreme.dimension,
      direction: prevExtreme.direction,
    })
  }

  // RegimeWeightRouter — DYNAMIC reconfiguration
  const reconfig = router.compute(regimeDet.currentRegime, crowdState)
  if (reconfig.changed) {
    stats.reconfigCount++
    if (reconfig.weights.deflationActive) {
      logEvent('weight_reconfig', 'Dynamic weight RECONFIGURATION engaged — deflating crowd-followers, boosting contrarians.', {
        reason: reconfig.reason,
        agents: reconfig.weights.agents,
      })
    } else {
      logEvent('weight_reconfig', 'Dynamic weights RELAXED back to regime baseline.', {})
    }
  }

  // ---- TITAN-1 modules (must run BEFORE agents so agents can read fresh state) ----
  // 1. ATR
  const atrState = atr.update(marketTick)
  // 2. Liquidation Sniper
  const sniperEvents = sniper.update(marketTick, crowdState)
  for (const se of sniperEvents) logEvent(se.type, se.message, se.details)
  // 3. Order Book + Spoofing
  const obEvents = orderBook.update(marketTick, crowdState)
  for (const oe of obEvents) logEvent(oe.type, oe.message, oe.details)
  // 4. Toxic Flow
  const toxicEvents = toxic.update(marketTick)
  for (const te of toxicEvents) logEvent(te.type, te.message, te.details)
  // 5. Venues + Domino
  const dominoEvents = venues.update(marketTick)
  for (const de of dominoEvents) logEvent(de.type, de.message, de.details)

  const liquidationState = sniper.state()
  const orderBookState = orderBook.state()
  const toxicState = toxic.state()
  const venueState = venues.state()

  // ---- Boule de Cristal (Binance global liquidations feed) ----
  // The "ghost async task" that listens to Binance liquidations continuously.
  // Updated BEFORE agents so the TimeBandit (priority 0) can pre-empt the swarm.
  crystalBall.update(marketTick, sniper.cascadeActive, atrState.volatilityRegime)
  const crystalState = crystalBall.state()

  // ---- TimeBandit (priority 0, ABSOLUTE) ----
  // Evaluates the crystal ball signal BEFORE price, BEFORE PPO, BEFORE whalewatch.
  // If |signal| >= 1.0, it pre-empts the entire swarm and orders an immediate
  // SHORT/LONG on OKX with confidence 0.99 and a maximally widened TP.
  const banditStrike = timeBandit.evaluate(crystalState, atrState)
  let timeBanditActive = false
  if (banditStrike) {
    timeBandit.recordStrike(banditStrike)
    timeBanditActive = true
    logEvent('time_bandit_strike',
      `⏳ TIME BANDIT STRIKE — Binance cascade detected (signal ${banditStrike.signal.toFixed(2)}). ` +
      `Pre-empting swarm → ${banditStrike.side} OKX @ conf ${(banditStrike.confidence * 100).toFixed(0)}% ` +
      `with widened TP ${banditStrike.takeProfitBps}bps. The shock wave is guaranteed.`,
      {
        signal: banditStrike.signal,
        side: banditStrike.side,
        confidence: banditStrike.confidence,
        takeProfitBps: banditStrike.takeProfitBps,
        longLiq2sUsd: crystalState.longLiq2sUsd,
        shortLiq2sUsd: crystalState.shortLiq2sUsd,
      },
    )
  }

  // Alpha swarm — each agent evaluates with the FULL extended context
  const ctx = {
    tick: marketTick,
    crowd: crowdState,
    atr: atrState,
    liquidations: liquidationState,
    orderBook: orderBookState,
    toxicFlow: toxicState,
    toxicPressureDir: toxic.pressureDirection,
    domino: venueState.domino,
  }
  const rawSignals = ALL_AGENTS.map((a) => a.evaluate(ctx))

  // Debate chamber — aggregate with effective weights
  const debateResult = debate(rawSignals, reconfig.weights)

  // ---- TimeBandit OVERRIDE (priority 0) ----
  // If the TimeBandit struck, its consensus replaces the debate chamber's output.
  // The debate still ran (for display), but the TimeBandit's decision is absolute.
  let consensus = debateResult.consensus
  let signals = debateResult.signals
  if (timeBanditActive && banditStrike) {
    consensus = TimeBandit.overrideConsensus(banditStrike)
    // Inject the TimeBandit as a virtual signal at the top of the swarm display
    signals = [
      {
        agent: 'crowd' as const,
        side: banditStrike.side,
        confidence: banditStrike.confidence,
        weightedConfidence: banditStrike.confidence,
        rationale: `⏳ TIME BANDIT (priority 0): Binance cascade signal ${banditStrike.signal.toFixed(2)} → ${banditStrike.side} with widened TP ${banditStrike.takeProfitBps}bps. Pre-empted swarm.`,
      },
      ...signals,
    ]
  }

  // Log consensus transitions & conflict deferrals (only when TimeBandit is NOT overriding)
  if (!timeBanditActive) {
    if (consensus.conflict && consensus.quorumMet && consensus.side === 'FLAT') {
      if (consensus.voteStd > 0.6) {
        stats.deferredCount++
        logEvent('conflict_defer', `Debate DEFERRED — agent conflict (voteStd ${consensus.voteStd.toFixed(2)} > 0.55). No trade.`, {
          voteStd: consensus.voteStd,
          signals: signals.map((s) => ({ agent: s.agent, side: s.side, conf: s.confidence })),
        })
      }
    } else if (consensus.side !== 'FLAT' && consensus.side !== lastConsensusSide) {
      stats.consensusCount++
      lastConsensusSide = consensus.side
      logEvent('consensus', `Consensus ${consensus.side} @ conf ${consensus.confidence.toFixed(2)} (voteStd ${consensus.voteStd.toFixed(2)})`, {
        side: consensus.side,
        confidence: consensus.confidence,
        voteStd: consensus.voteStd,
      })
    } else if (consensus.side === 'FLAT') {
      lastConsensusSide = null
    }
  }

  // ---- Execution Blade: process fills on the ACTIVE grid BEFORE risk-aegis TP/SL ----
  const bladeEvents = blade.update(marketTick.price, sniper.cascadeActive, marketTick.ts)
  for (const be of bladeEvents) {
    logEvent(be.type, be.message, be.details)
    // If a tier filled during an active cascade, mark the wick as captured + snipe event
    if (be.type === 'maker_grid_fill' && sniper.cascadeActive) {
      const fillPrice = (be.details.fillPrice as number) ?? marketTick.price
      const side = (be.details.side as 'BUY' | 'SELL') ?? 'BUY'
      const snipeEv = sniper.recordSnipe(side, fillPrice)
      if (snipeEv) logEvent(snipeEv.type, snipeEv.message, snipeEv.details)
    }
  }

  // ---- Layer 4: Risk Aegis (hors-dogme + Kelly + dynamic ATR TP/SL + maker-grid handoff) ----
  const riskCtx = {
    atr14Bps: atrState.atr14Bps,
    volatilityRegime: atrState.volatilityRegime,
    cascadeActive: sniper.cascadeActive,
    executionBlade: blade,
    // TimeBandit pre-emption: pass the widened TP so Risk Aegis uses it
    timeBanditStrike: timeBanditActive && banditStrike
      ? { takeProfitBps: banditStrike.takeProfitBps, confidence: banditStrike.confidence }
      : undefined,
  }
  const { state: riskState, events: riskEvents } = risk.evaluate(
    consensus,
    crowdState,
    marketTick.price,
    riskCtx,
  )
  for (const re of riskEvents) {
    logEvent(re.type, re.message, re.details)
  }

  stats.uptime = Math.floor((Date.now() - startedAt) / 1000)

  // Build & broadcast full extended state
  const state: OmegaState = {
    ts: Date.now(),
    regime: regimeDet.state(),
    market: {
      symbol: 'BTCUSDT',
      price: Math.round(marketTick.price * 100) / 100,
      changePct24h: Math.round(market.changePct24h() * 100) / 100,
      sparkline: market.sparkline(),
    },
    crowd: crowdState,
    weights: reconfig.weights,
    signals: { symbol: 'BTCUSDT', agents: signals, consensus },
    events: events.slice(0, MAX_EVENTS),
    stats: { ...stats },
    risk: riskState,
    // TITAN-1 extended fields
    atr: atrState,
    liquidations: liquidationState,
    orderBook: orderBookState,
    toxicFlow: toxicState,
    venues: venueState.venues,
    domino: venueState.domino,
    execution: blade.state(),
    // Time-Bandit / Boule de Cristal
    crystalBall: crystalState,
    timeBandit: timeBandit.state(crystalState),
  }

  io.emit('omega:state', state)
}

io.on('connection', (socket) => {
  console.log(`[omega-engine] client connected: ${socket.id}`)
  // Send current event backlog so a fresh client has history
  socket.emit('omega:backlog', events.slice(0, MAX_EVENTS))
  socket.on('disconnect', () => {
    console.log(`[omega-engine] client disconnected: ${socket.id}`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`[omega-engine] OMEGA engine running on port ${PORT}`)
})

// Run the loop
setInterval(tick, TICK_MS)
