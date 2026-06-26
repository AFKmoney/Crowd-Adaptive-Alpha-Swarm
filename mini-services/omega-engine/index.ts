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
import { OkxClient, INST_ID, type OkxMode } from './okx-client.ts'
import { OkxWebSocket, type OkxLiveTick } from './okx-ws.ts'
import { WallBreaker } from './wall-breaker.ts'
import { GhostProtocol } from './ghost-protocol.ts'
import { SymphonyVector } from './symphony-vector.ts'
import { PoisonPill } from './poison-pill.ts'
import { QuantumArsenal } from './quantum-arsenal.ts'
import type { OmegaState, OmegaEvent, EventType, LiveMode, LiveStatus } from './types.ts'

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
const wallBreaker = new WallBreaker()
const ghostProtocol = new GhostProtocol()
const symphonyVector = new SymphonyVector()
const poisonPill = new PoisonPill()
const quantumArsenal = new QuantumArsenal()
const okxClient = new OkxClient()
const okxWs = new OkxWebSocket()

// ---- Live mode state ----
let currentMode: LiveMode = 'sim'
let livePrice: number = 0 // latest real OKX price (0 = not yet received)
let liveTickData: OkxLiveTick | null = null
let liveBalance = { totalEqUsd: 0, availableUsd: 0, marginRatio: 0 }
let livePositions: LiveStatus['realPositions'] = []
let liveLastOrder: LiveStatus['lastOrderResult'] = null
let liveTrades = 0
let lastBalanceFetch = 0
const BALANCE_FETCH_INTERVAL = 5000 // fetch balance every 5s in live mode

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
logEvent('regime_change', 'OMEGA engine online — TITAN-1 modules armed (ATR / Sniper / OrderBook / Toxic / Domino / MakerGrid). Mode: SIM (live OKX ready).', {
  regime: 'calm_bull',
})

// ---- OKX WebSocket: receive real-time price ticks ----
okxWs.onTick((t: OkxLiveTick) => {
  livePrice = t.price
  liveTickData = t
})

// ---- Mode switching (called from the omega:configure socket handler) ----
function setMode(mode: LiveMode, creds?: { apiKey: string; apiSecret: string; passphrase: string }) {
  const prevMode = currentMode
  currentMode = mode
  const okxMode: OkxMode = mode === 'sim' ? 'sim' : mode
  okxClient.configure(okxMode, creds ?? null)
  okxWs.configure(okxMode)

  if (mode === 'sim') {
    okxWs.disconnect()
    livePrice = 0
    liveTickData = null
    logEvent('regime_change', `Mode switched → SIM (simulation engine). OKX disconnected.`, { mode })
  } else {
    // Connect the WebSocket for real-time price data (works without creds for public feed)
    okxWs.connect()
    if (creds) {
      logEvent('consensus', `⚡ LIVE MODE ENGAGED → ${mode.toUpperCase()} on OKX (${INST_ID}). Credentials configured. Real order execution ${mode === 'testnet' ? '(DEMO TRADING)' : '(MAINNET — REAL CAPITAL)'}.`, { mode, testnet: mode === 'testnet' })
    } else {
      logEvent('consensus', `📡 LIVE PRICE FEED → ${mode.toUpperCase()} OKX (${INST_ID}). WebSocket connected for real market data. Configure credentials to enable order execution.`, { mode })
    }
  }
  void prevMode
}

// ---- Live order execution (called when Risk Aegis opens a position in live mode) ----
async function executeLiveOrder(side: 'BUY' | 'SELL', sizeUsd: number, price: number) {
  if (!okxClient.hasCredentials) {
    logEvent('risk_hard_stop', `🛡️ LIVE ORDER SKIPPED — no OKX credentials configured. Signal was ${side} $${sizeUsd.toFixed(2)} @ $${price.toFixed(2)}.`, { side, sizeUsd, reason: 'no_credentials' })
    return
  }
  // OKX BTC-USDT-SWAP: 1 contract = 0.01 BTC. Compute contracts from USD size.
  const contractsPerBtc = 0.01
  const btcQty = sizeUsd / price
  const sz = Math.max(1, Math.round(btcQty / contractsPerBtc))
  try {
    const result = await okxClient.placeMarketOrder(side.toLowerCase() as 'buy' | 'sell', sz)
    liveLastOrder = { ordId: result.ordId, sCode: result.sCode, sMsg: result.sMsg, ts: Date.now() }
    liveTrades++
    if (result.sCode === 0) {
      logEvent('trade_open', `🔴 LIVE ORDER FILLED — ${side} ${sz} contracts (${INST_ID}) @ ~$${price.toFixed(2)} on ${currentMode.toUpperCase()}. Order ID: ${result.ordId}.`, {
        side, sz, price, ordId: result.ordId, mode: currentMode, live: true,
      })
    } else {
      logEvent('risk_hard_stop', `🛡️ LIVE ORDER REJECTED by OKX — ${side} ${sz} contracts: ${result.sMsg} (code ${result.sCode}).`, { side, sz, sMsg: result.sMsg, sCode: result.sCode })
    }
  } catch (err) {
    logEvent('risk_hard_stop', `🛡️ LIVE ORDER ERROR — ${side} ${sz} contracts: ${String(err)}`, { side, sz, error: String(err) })
  }
}

// ---- Main loop ----
function tick() {
  // ---- Price source: SIM (synthetic) vs LIVE (real OKX WebSocket) ----
  let marketTick
  if (currentMode !== 'sim' && livePrice > 0 && liveTickData) {
    // LIVE mode: inject the real OKX price into the market sim so all
    // indicators (ATR, RSI, vol, crowd, sniper, etc.) compute on real data.
    marketTick = market.injectLivePrice(livePrice, {
      open: liveTickData.open,
      high: liveTickData.high,
      low: liveTickData.low,
      close: liveTickData.close,
      vol: liveTickData.vol,
    })
  } else {
    // SIM mode (or live but no price yet): synthetic market
    marketTick = market.step()
  }

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
    // ---- Live order execution: when Risk Aegis opens a NEW position in live mode,
    // fire a real OKX market order. The sim position tracking continues in parallel
    // for display; the real fill comes from OKX. ----
    if (re.type === 'trade_open' && currentMode !== 'sim' && okxClient.hasCredentials) {
      const side = (re.details.side as 'BUY' | 'SELL') ?? consensus.side
      const sizeUsd = (re.details.sizeUsd as number) ?? riskState.position?.sizeUsd ?? 0
      if (sizeUsd > 0 && side !== 'FLAT') {
        executeLiveOrder(side, sizeUsd, marketTick.price)
      }
    }
  }

  // ---- Live balance + positions fetch (every 5s in live mode with creds) ----
  if (currentMode !== 'sim' && okxClient.hasCredentials && Date.now() - lastBalanceFetch > BALANCE_FETCH_INTERVAL) {
    lastBalanceFetch = Date.now()
    okxClient.getBalance().then((b) => {
      liveBalance = { totalEqUsd: b.totalEqUsd, availableUsd: b.availBalUsd, marginRatio: b.marginRatio }
    }).catch((e) => {
      // silent — balance fetch failures are common (rate limits, demo mode quirks)
      void e
    })
    okxClient.getPositions().then((ps) => {
      livePositions = ps.map((p) => ({ instId: p.instId, side: p.posSide, pos: p.pos, avgPx: p.avgPx, upl: p.upl, uplRatio: p.uplRatio, lever: p.lever }))
    }).catch(() => { /* noop */ })
  }

  stats.uptime = Math.floor((Date.now() - startedAt) / 1000)

  // ---- Phase 4/6 — Divine + Quantum modules ----
  // Wall Breaker: retail exhaustion against invisible wall
  const wbStrike = wallBreaker.evaluate(marketTick, crowdState, orderBookState)
  if (wbStrike) {
    wallBreaker.recordStrike(wbStrike, marketTick.price)
    logEvent('wall_breaker_strike',
      `🧱 WALL BREAKER — Retail buyers exhausting against invisible wall (exhaustion ${wbStrike.exhaustion.toFixed(2)}, buy pressure ${wallBreaker.state().buyPressure.toFixed(2)}). SELL into trapped buyers @ ${(wbStrike.confidence * 100).toFixed(0)}% conf, TP ${wbStrike.takeProfitBps}bps.`,
      { exhaustion: wbStrike.exhaustion, side: wbStrike.side, confidence: wbStrike.confidence, tp: wbStrike.takeProfitBps },
    )
  }
  // Ghost Protocol: liquidity vacuum during news events
  const ghostEvents = ghostProtocol.update(marketTick, crowdState, orderBookState, atrState.atr14Bps)
  for (const ge of ghostEvents) logEvent(ge.type, ge.message, ge.details)
  // Symphony Vector: BTC oracle → altcoin maker-grids
  const symphonyEvents = symphonyVector.update(marketTick, crowdState, atrState.atr14Bps)
  for (const se of symphonyEvents) logEvent(se.type, se.message, se.details)
  // Poison Pill: mempool whale DEX sale → short CEX
  const poisonEvents = poisonPill.update(marketTick, atrState.atr14Bps)
  for (const pe of poisonEvents) logEvent(pe.type, pe.message, pe.details)
  // Quantum Arsenal: 8 Level-6 concepts
  const quantumEvents = quantumArsenal.update(marketTick, crowdState, atrState.atr14Bps, sniper.cascadeActive)
  for (const qe of quantumEvents) logEvent(qe.type, qe.message, qe.details)

  // Build & broadcast full extended state
  const liveStatus: LiveStatus = {
    mode: currentMode,
    okxConnected: okxWs.isConnected,
    credentialsConfigured: okxClient.hasCredentials,
    exchange: 'okx',
    instId: INST_ID,
    balanceUsd: liveBalance.totalEqUsd,
    availableUsd: liveBalance.availableUsd,
    marginRatio: liveBalance.marginRatio,
    realPositions: livePositions,
    lastOrderResult: liveLastOrder,
    liveTrades,
  }
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
    // Live mode
    live: liveStatus,
    // Phase 4 — Divine Level
    wallBreaker: wallBreaker.state(),
    ghostProtocol: ghostProtocol.state(),
    symphonyVector: symphonyVector.state(),
    poisonPill: poisonPill.state(),
    // Phase 6 — Quantum Arsenal
    quantumArsenal: quantumArsenal.state(),
  }

  io.emit('omega:state', state)
}

io.on('connection', (socket) => {
  console.log(`[omega-engine] client connected: ${socket.id}`)
  // Send current event backlog so a fresh client has history
  socket.emit('omega:backlog', events.slice(0, MAX_EVENTS))
  // Send the current mode so a fresh client knows the engine state
  socket.emit('omega:mode', { mode: currentMode, okxConnected: okxWs.isConnected, credentialsConfigured: okxClient.hasCredentials })

  // ---- Receive mode + credentials from the dashboard ----
  socket.on('omega:configure', (payload: { mode: LiveMode; apiKey?: string; apiSecret?: string; passphrase?: string }) => {
    console.log(`[omega-engine] omega:configure received: mode=${payload.mode} creds=${!!payload.apiKey}`)
    try {
      const creds = (payload.apiKey && payload.apiSecret && payload.passphrase)
        ? { apiKey: payload.apiKey, apiSecret: payload.apiSecret, passphrase: payload.passphrase }
        : undefined
      setMode(payload.mode, creds)
      // Acknowledge back to the sender
      socket.emit('omega:configure:ack', { ok: true, mode: payload.mode, credentialsConfigured: !!creds })
    } catch (err) {
      socket.emit('omega:configure:ack', { ok: false, error: String(err) })
    }
  })

  socket.on('disconnect', () => {
    console.log(`[omega-engine] client disconnected: ${socket.id}`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`[omega-engine] OMEGA engine running on port ${PORT}`)
})

// Run the loop
setInterval(tick, TICK_MS)
