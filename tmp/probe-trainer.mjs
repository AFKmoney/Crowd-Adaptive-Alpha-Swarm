// /home/z/my-project/tmp/probe-trainer.mjs
// Probe script: connects to omega-trainer at http://localhost:3004 (path "/"),
// emits `trainer:start`, and collects `trainer:episode` + `trainer:status`
// events for 15 seconds to prove the RL is actually learning.

import { io } from 'socket.io-client'

const URL = 'http://localhost:3004'

console.log(`[probe] connecting to ${URL} ...`)
const socket = io(URL, {
  path: '/',
  transports: ['websocket', 'polling'],
})

const episodes = []
const statuses = []
const checkpoints = []
let connected = false

socket.on('connect', () => {
  connected = true
  console.log(`[probe] connected (id=${socket.id})`)
  // Wait a moment for the initial trainer:status, then kick off a run.
  setTimeout(() => {
    const payload = {
      scenarios: ['flash_crash', 'euphoria'],
      episodesPerScenario: 2,
      mode: 'synthetic',
    }
    console.log('[probe] emitting trainer:start with', payload)
    socket.emit('trainer:start', payload)
  }, 500)
})

socket.on('trainer:status', (s) => {
  statuses.push(s)
  console.log(
    `[probe] status: running=${s.running} scenario=${s.currentScenario} ` +
      `ep=${s.episode}/${s.totalEpisodes} ` +
      `trend(sharpe=${s.agents?.trend?.sharpe?.toFixed?.(3) ?? '?'}) ` +
      `meanrev(sharpe=${s.agents?.meanrev?.sharpe?.toFixed?.(3) ?? '?'}) ` +
      `crowd(sharpe=${s.agents?.crowd?.sharpe?.toFixed?.(3) ?? '?'})`,
  )
})

socket.on('trainer:episode', (e) => {
  episodes.push(e)
  console.log(
    `[probe] EPISODE agent=${e.agent} scenario=${e.scenario} ep=${e.episode} ` +
      `reward=${e.reward.toFixed(3)} sharpe=${e.sharpe.toFixed(3)} ` +
      `winRate=${e.winRate.toFixed(2)} equity=${e.equity.toFixed(0)} ` +
      `maxDD=${(e.maxDrawdown * 100).toFixed(1)}% loss=${e.loss.toFixed(5)}`,
  )
})

socket.on('trainer:checkpoint', (c) => {
  checkpoints.push(c)
  console.log(
    `[probe] *** CHECKPOINT agent=${c.agent} sharpe=${c.sharpe.toFixed(3)} ` +
      `equity=${c.equity.toFixed(0)}`,
  )
})

socket.on('trainer:complete', (c) => {
  console.log('[probe] COMPLETE:', JSON.stringify(c.summary?.finalMetrics, null, 2))
})

socket.on('disconnect', () => {
  console.log('[probe] disconnected')
})

// Run for 15 seconds then summarize.
setTimeout(() => {
  console.log('\n========== PROBE SUMMARY ==========')
  console.log(`connected:         ${connected}`)
  console.log(`status events:     ${statuses.length}`)
  console.log(`episode events:    ${episodes.length}`)
  console.log(`checkpoint events: ${checkpoints.length}`)

  if (episodes.length > 0) {
    const rewards = episodes.map((e) => e.reward)
    const sharpes = episodes.map((e) => e.sharpe)
    const losses = episodes.map((e) => e.loss)
    const uniqueAgents = [...new Set(episodes.map((e) => e.agent))]
    const uniqueScenarios = [...new Set(episodes.map((e) => e.scenario))]
    console.log(`unique agents:     ${uniqueAgents.join(', ')}`)
    console.log(`unique scenarios:  ${uniqueScenarios.join(', ')}`)
    console.log(
      `reward range:      min=${Math.min(...rewards).toFixed(3)} max=${Math.max(...rewards).toFixed(3)}`,
    )
    console.log(
      `sharpe range:      min=${Math.min(...sharpes).toFixed(3)} max=${Math.max(...sharpes).toFixed(3)}`,
    )
    console.log(
      `loss range:        min=${Math.min(...losses).toFixed(5)} max=${Math.max(...losses).toFixed(5)}`,
    )
    console.log('\nAll episodes:')
    for (const e of episodes) {
      console.log(
        `  ${e.agent.padEnd(8)} ${e.scenario.padEnd(20)} ep${e.episode} ` +
          `reward=${e.reward.toFixed(3).padStart(8)} sharpe=${e.sharpe.toFixed(3).padStart(7)} ` +
          `eq=${e.equity.toFixed(0).padStart(6)} dd=${(e.maxDrawdown * 100).toFixed(1).padStart(5)}%`,
      )
    }
  }

  console.log('\n[probe] closing socket and exiting.')
  socket.close()
  process.exit(0)
}, 15000)

// Safety: exit if never connected.
setTimeout(() => {
  if (!connected) {
    console.error('[probe] FAILED to connect within 5s — aborting.')
    process.exit(1)
  }
}, 5000)
