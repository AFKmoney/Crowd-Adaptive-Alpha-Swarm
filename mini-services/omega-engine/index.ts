// OMEGA Engine — main entry point (mini-service, port 3003)
//
// Runs the continuous OMEGA simulation loop and broadcasts live state over socket.io.
// This is the backend that powers the dashboard's visualization of the dynamic weight
// reconfiguration feature.
//
// Per the worklog contract, the client connects to io("/?XTransformPort=3003") and
// receives `omega:state` (full snapshot ~1s) and `omega:event` (single new events).

import { createServer } from 'http'
import { Server } from 'socket.io'
import { MarketSim } from './market-sim.ts'
import { CrowdEngine } from './crowd-engine.ts'
import { RegimeDetector } from './regime-detector.ts'
import { RegimeWeightRouter } from './regime-router.ts'
import { ALL_AGENTS } from './agents.ts'
import { debate } from './debate-chamber.ts'
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
logEvent('regime_change', 'OMEGA engine online — regime calm_bull, crowd at rest.', {
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

  // Crowd engine (second axis — the new feature)
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

  // RegimeWeightRouter — DYNAMIC reconfiguration (the feature)
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

  // Alpha swarm — each agent evaluates
  const ctx = { tick: marketTick, crowd: crowdState }
  const rawSignals = ALL_AGENTS.map((a) => a.evaluate(ctx))

  // Debate chamber — aggregate with effective weights
  const { signals, consensus } = debate(rawSignals, reconfig.weights)

  // Log consensus transitions & conflict deferrals
  if (consensus.conflict && consensus.quorumMet && consensus.side === 'FLAT') {
    // throttle: only count when voteStd is high
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

  stats.uptime = Math.floor((Date.now() - startedAt) / 1000)

  // Build & broadcast full state
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
