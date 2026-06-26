// TITAN-1 verification probe v2 — runs for 60s to capture ALL new event types.

import { io } from 'socket.io-client'

const socket = io('http://localhost:3003', {
  path: '/',
  transports: ['websocket', 'polling'],
  reconnection: false,
})

const NEW_FIELDS = ['atr', 'liquidations', 'orderBook', 'toxicFlow', 'venues', 'domino', 'execution']
const NEW_EVENT_TYPES = new Set([
  'oi_cascade', 'spoof_detected', 'toxic_mm_flee', 'domino_strike',
  'maker_grid_deploy', 'maker_grid_fill', 'maker_grid_complete',
  'liquidation_snipe', 'wall_detected',
])

let connected = false
let firstState = null
let lastState = null
let stateCount = 0
const newEventsSeen = new Set()
const eventSamples = {}
const allEvents = []

socket.on('connect', () => {
  connected = true
  console.log('[probe] connected:', socket.id)
})

socket.on('omega:state', (state) => {
  stateCount++
  if (stateCount === 1) firstState = state
  lastState = state
  if (stateCount <= 1) {
    console.log(`\n[probe] === omega:state #${stateCount} ===`)
    console.log('  ts:', state.ts, 'regime:', state.regime?.current, 'price:', state.market?.price)
    console.log('  top-level keys:', Object.keys(state).sort().join(', '))
    console.log('\n  --- NEW FIELDS PRESENT? ---')
    for (const f of NEW_FIELDS) {
      const present = state[f] !== undefined
      console.log(`  ${present ? '✓' : '✗'} ${f}: ${present ? JSON.stringify(state[f]).slice(0, 250) : 'MISSING'}`)
    }
  }
})

socket.on('omega:event', (ev) => {
  allEvents.push(ev)
  if (NEW_EVENT_TYPES.has(ev.type)) {
    if (!newEventsSeen.has(ev.type)) {
      newEventsSeen.add(ev.type)
      console.log(`[probe] NEW EVENT: ${ev.type} — ${ev.message?.slice(0, 110)}`)
    }
    if (!eventSamples[ev.type]) eventSamples[ev.type] = ev
  }
})

socket.on('omega:backlog', (events) => {
  for (const ev of events || []) {
    if (NEW_EVENT_TYPES.has(ev.type)) {
      newEventsSeen.add(ev.type)
      if (!eventSamples[ev.type]) eventSamples[ev.type] = ev
    }
  }
})

socket.on('disconnect', () => console.log('[probe] disconnected'))
socket.on('connect_error', (e) => console.log('[probe] connect_error:', e.message))

setTimeout(() => {
  console.log('\n[probe] === SUMMARY after 60s ===')
  console.log('connected:', connected)
  console.log('omega:state count:', stateCount)
  console.log('total omega:event received:', allEvents.length)

  console.log('\n--- ALL TOP-LEVEL KEYS IN OMEGA:STATE ---')
  if (lastState) {
    console.log(Object.keys(lastState).sort().join(', '))
  }

  console.log('\n--- NEW EVENT TYPES SEEN ---')
  for (const t of [...NEW_EVENT_TYPES].sort()) {
    const seen = newEventsSeen.has(t)
    console.log(`  ${seen ? '✓' : '✗'} ${t}${seen ? ' — ' + (eventSamples[t]?.message?.slice(0, 110) ?? '') : ''}`)
  }

  console.log('\n--- SAMPLE VALUES (last state) ---')
  if (lastState) {
    const s = lastState
    console.log('atr:', JSON.stringify(s.atr))
    console.log('liquidations:', JSON.stringify(s.liquidations))
    console.log('orderBook:', JSON.stringify(s.orderBook))
    console.log('toxicFlow:', JSON.stringify(s.toxicFlow))
    console.log('venues:', JSON.stringify(s.venues))
    console.log('domino:', JSON.stringify(s.domino))
    console.log('execution:', JSON.stringify(s.execution))
    console.log('risk.position:', JSON.stringify(s.risk?.position))
    console.log('risk.lastDecision:', JSON.stringify(s.risk?.lastDecision))
  }

  console.log('\n--- SAMPLE NEW EVENT (one per type) ---')
  for (const t of [...newEventsSeen].sort()) {
    const ev = eventSamples[t]
    console.log(`  [${t}] ${ev.message}`)
  }

  // Also confirm hors-dogme override events fire
  console.log('\n--- HORS-DOGME / RISK EVENTS ---')
  const riskTypes = ['risk_override', 'risk_hard_stop', 'trade_open', 'trade_close', 'risk_tp_hit', 'risk_sl_hit']
  for (const t of riskTypes) {
    const samples = allEvents.filter(e => e.type === t)
    if (samples.length > 0) {
      console.log(`  ✓ ${t} (${samples.length}x) — last: ${samples[samples.length - 1].message.slice(0, 110)}`)
    } else {
      console.log(`  · ${t} (none yet)`)
    }
  }

  socket.close()
  process.exit(0)
}, 60000)
