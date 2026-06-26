// omega-trainer/index.ts
// ============================================================================
// omega-trainer mini-service — orchestrator.
//
//   * socket.io server on port 3004 (path "/") broadcasting training progress.
//   * socket.io CLIENT connecting to the omega-engine at port 3003 to ingest
//     live market + crowd data into a rolling buffer (for "live"/"both" modes).
//   * HTTP health endpoint at GET /.
//   * Fire-and-forget POSTs to http://localhost:3000/api/training on run start
//     and completion (the Next.js API route another agent is building). If the
//     endpoint is unavailable, we log a warning and continue.
// ============================================================================

import { createServer } from 'http'
import { Server } from 'socket.io'
import { io as ioClient, type Socket } from 'socket.io-client'
import {
  Trainer,
  ALL_AGENTS,
  type EpisodeResult,
  type CheckpointEvent,
  type TrainerSummary,
  type TrainerStatus,
  type AgentName,
} from './trainer.ts'
import { ALL_SCENARIOS, computeIndicators, type Bar, type ScenarioName } from './scenarios.ts'

const PORT = 3004
const OMEGA_ENGINE_URL = 'http://localhost:3003'
const TRAINING_API_URL = 'http://localhost:3000/api/training'

// ---------------------------------------------------------------------------
// HTTP server (health endpoint) — co-mounted with socket.io
// ---------------------------------------------------------------------------
const httpServer = createServer()

const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// socket.io with path '/' uses `prependListener` internally, so engine.io
// intercepts GET / BEFORE our createServer handler. To expose a plain HTTP
// health endpoint, we PREPEND our own listener after socket.io is constructed
// so it runs first. When we respond, we also neuter the response object so
// engine.io's subsequent listener can't trigger ERR_HTTP_HEADERS_SENT.
httpServer.prependListener('request', (req, res) => {
  const url = (req.url || '').split('?')[0]
  const query = (req.url || '').split('?')[1] || ''
  const isSocketIo = query.includes('EIO=') || query.includes('transport=')
  if (isSocketIo || req.method !== 'GET' || (url !== '/' && url !== '/health')) {
    return // Not a health-check request; let engine.io handle it.
  }
  // Respond and neuter the response so engine.io's listener (which fires next)
  // can't try to set headers on an already-sent response.
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ service: 'omega-trainer', status: 'running', port: PORT }))
  // Neuter: make subsequent setHeader/write/end into no-ops
  ;(res as any).setHeader = () => res
  ;(res as any).write = () => true
  ;(res as any).end = () => res
  // Prevent engine.io from interpreting this as its own request
  ;(req as any).res = res
})

// Swallow any remaining ERR_HTTP_HEADERS_SENT errors (defensive).
process.on('uncaughtException', (err: any) => {
  if (err?.code === 'ERR_HTTP_HEADERS_SENT') return
  console.error('[omega-trainer] uncaughtException:', err)
})
process.on('unhandledRejection', (err: any) => {
  if (err?.code === 'ERR_HTTP_HEADERS_SENT') return
  console.error('[omega-trainer] unhandledRejection:', err)
})

// ---------------------------------------------------------------------------
// Live data ingestion from omega-engine
// ---------------------------------------------------------------------------
// We keep a rolling buffer of last ~1000 1-second samples (price, funding,
// crowd) from the omega-engine. When training mode is "live" or "both",
// the trainer reads from this buffer.
const LIVE_MAX = 1000
const livePrices: number[] = []
const liveFunding: number[] = []
const liveCrowd: number[] = []
let liveSocket: Socket | null = null

function connectLive() {
  try {
    liveSocket = ioClient(OMEGA_ENGINE_URL, {
      path: '/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    })

    liveSocket.on('connect', () => {
      console.log(`[omega-trainer] connected to omega-engine at ${OMEGA_ENGINE_URL}`)
      liveSocket!.emit('subscribe', { events: ['omega:state'] })
    })

    liveSocket.on('omega:state', (state: any) => {
      try {
        const price = state?.market?.price
        const funding = state?.crowd?.fundingRateBps
        const crowd = state?.crowd?.composite
        if (typeof price === 'number') {
          livePrices.push(price)
          liveFunding.push(typeof funding === 'number' ? funding : 0)
          liveCrowd.push(typeof crowd === 'number' ? crowd : 0)
          if (livePrices.length > LIVE_MAX) {
            livePrices.shift()
            liveFunding.shift()
            liveCrowd.shift()
          }
        }
      } catch (e) {
        // ignore malformed state
      }
    })

    liveSocket.on('disconnect', () => {
      console.log('[omega-trainer] omega-engine disconnected (will reconnect)')
    })

    liveSocket.on('connect_error', (err: any) => {
      // Suppress noisy logs — only warn occasionally
      // (Trainer still works in synthetic mode without live data.)
    })
  } catch (e) {
    console.warn('[omega-trainer] could not connect to omega-engine — live mode unavailable:', e)
  }
}

// Build Bars from the live buffer (called when starting a live training run)
function buildLiveBars(): Bar[] {
  if (livePrices.length < 2) return []
  const closes = livePrices.slice()
  const volumes = new Array(closes.length).fill(1000)
  const startTs = Date.now() - closes.length * 1000
  return computeIndicators(closes, volumes, startTs, {
    fundingBps: liveFunding,
    crowdScore: liveCrowd,
  })
}

// ---------------------------------------------------------------------------
// Trainer + callbacks (broadcast over socket.io)
// ---------------------------------------------------------------------------
let currentRunId: string | null = null

const trainer = new Trainer({
  onEpisode: (r: EpisodeResult) => {
    io.emit('trainer:episode', r)
    console.log(
      `[omega-trainer] episode agent=${r.agent} scenario=${r.scenario} ep=${r.episode} ` +
        `reward=${r.reward.toFixed(2)} sharpe=${r.sharpe.toFixed(3)} ` +
        `equity=${r.equity.toFixed(0)} dd=${(r.maxDrawdown * 100).toFixed(1)}% loss=${r.loss.toFixed(4)}`,
    )
  },
  onCheckpoint: (c: CheckpointEvent) => {
    io.emit('trainer:checkpoint', c)
    console.log(
      `[omega-trainer] NEW BEST agent=${c.agent} sharpe=${c.sharpe.toFixed(3)} ` +
        `equity=${c.equity.toFixed(0)}`,
    )
  },
  onStatus: () => trainer.status(),
  onComplete: (s: TrainerSummary) => {
    io.emit('trainer:complete', { summary: s })
    console.log(
      `[omega-trainer] complete — ${s.episodesTotal} episodes, ` +
        `${s.scenariosCovered.length} scenarios, ${s.durationMs}ms`,
    )
    // Fire-and-forget POST completion summary
    if (currentRunId) {
      postTraining({
        runId: currentRunId,
        phase: 'complete',
        summary: s,
        completedAt: Date.now(),
      }).catch(() => {})
    }
  },
})

// ---------------------------------------------------------------------------
// socket.io server events
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  console.log(`[omega-trainer] client connected: ${socket.id}`)
  // Send current status on connect
  socket.emit('trainer:status', trainer.status())

  socket.on('trainer:start', async (payload: any) => {
    if (trainer.running) {
      console.log('[omega-trainer] trainer:start ignored — already running')
      return
    }
    const scenarios: ScenarioName[] = Array.isArray(payload?.scenarios) && payload.scenarios.length > 0
      ? payload.scenarios
      : ALL_SCENARIOS
    const episodesPerScenario: number =
      typeof payload?.episodesPerScenario === 'number' && payload.episodesPerScenario > 0
        ? Math.min(payload.episodesPerScenario, 20)
        : 5
    const mode: 'synthetic' | 'live' | 'both' =
      payload?.mode === 'live' || payload?.mode === 'both' ? payload.mode : 'synthetic'

    console.log(
      `[omega-trainer] START mode=${mode} scenarios=${scenarios.length} epsPerScenario=${episodesPerScenario}`,
    )

    // Refresh live buffer for live/both modes
    if (mode === 'live' || mode === 'both') {
      const liveBars = buildLiveBars()
      if (liveBars.length >= 100) {
        trainer.setLiveBuffer(liveBars)
        console.log(`[omega-trainer] live buffer refreshed: ${liveBars.length} bars`)
      } else {
        console.warn(
          `[omega-trainer] live buffer too small (${liveBars.length} bars); ` +
            (mode === 'live' ? 'live training will be skipped' : 'only synthetic will run'),
        )
        trainer.setLiveBuffer([])
      }
    }

    currentRunId = Math.random().toString(36).slice(2, 12)
    const startedAt = Date.now()
    const totalEpisodes =
      (mode === 'synthetic' || mode === 'both'
        ? scenarios.length * ALL_AGENTS.length * episodesPerScenario
        : 0) +
      ((mode === 'live' || mode === 'both') &&
      (mode === 'both' || trainer.liveBuffer.length >= 100)
        ? ALL_AGENTS.length * episodesPerScenario
        : 0)

    // Fire-and-forget POST start record
    postTraining({
      runId: currentRunId,
      phase: 'start',
      mode,
      scenarios,
      totalEpisodes,
      startedAt,
    }).catch(() => {})

    // Run training asynchronously (don't await — but we want it sequential)
    trainer.start(scenarios, episodesPerScenario, mode).catch((e) => {
      console.error('[omega-trainer] training run error:', e)
    })
  })

  socket.on('trainer:stop', () => {
    console.log('[omega-trainer] trainer:stop received')
    trainer.stop()
  })

  socket.on('disconnect', () => {
    console.log(`[omega-trainer] client disconnected: ${socket.id}`)
  })
})

// ---------------------------------------------------------------------------
// Periodic status broadcast while running
// ---------------------------------------------------------------------------
setInterval(() => {
  if (trainer.running) {
    io.emit('trainer:status', trainer.status())
  }
}, 2000)

// ---------------------------------------------------------------------------
// Fire-and-forget POST to the Next.js training API
// ---------------------------------------------------------------------------
async function postTraining(body: any): Promise<void> {
  try {
    const res = await fetch(TRAINING_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.warn(
        `[omega-trainer] training API returned ${res.status} — continuing`,
      )
    }
  } catch (e: any) {
    // Endpoint not available yet — warn and continue (do NOT crash)
    if ((e as any)?.code === 'ECONNREFUSED') {
      // Suppress repeated logs
    } else {
      console.warn(
        `[omega-trainer] training API unavailable at ${TRAINING_API_URL} — continuing (fire-and-forget)`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
httpServer.listen(PORT, () => {
  console.log(`[omega-trainer] running on port ${PORT}`)
  console.log(`[omega-trainer] synthetic scenarios available: ${ALL_SCENARIOS.length}`)
  console.log(`[omega-trainer] agents: ${ALL_AGENTS.join(', ')}`)
  console.log(`[omega-trainer] connecting to omega-engine at ${OMEGA_ENGINE_URL} for live data...`)
  connectLive()
})
