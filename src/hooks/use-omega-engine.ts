'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { OmegaState, OmegaEvent, LiveMode } from '@/lib/omega-types'

interface UseOmegaEngine {
  state: OmegaState | null
  connected: boolean
  events: OmegaEvent[]
  weightHistory: Array<{
    ts: number
    trend: number
    meanrev: number
    macro: number
    stat_arb: number
    crowd: number
    deflationActive: boolean
  }>
  compositeHistory: Array<{ ts: number; composite: number }>
  candleHistory: Array<{ time: number; open: number; high: number; low: number; close: number }>
  configureMode: (mode: LiveMode, creds?: { apiKey: string; apiSecret: string; passphrase: string }) => Promise<{ ok: boolean; error?: string }>
}

const MAX_WEIGHT_HISTORY = 120
const MAX_CANDLES = 200

export function useOmegaEngine(): UseOmegaEngine {
  const [state, setState] = useState<OmegaState | null>(null)
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState<OmegaEvent[]>([])
  const [weightHistory, setWeightHistory] = useState<UseOmegaEngine['weightHistory']>([])
  const [compositeHistory, setCompositeHistory] = useState<UseOmegaEngine['compositeHistory']>([])
  const [candleHistory, setCandleHistory] = useState<UseOmegaEngine['candleHistory']>([])
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1200,
      timeout: 10000,
    })
    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', () => setConnected(false))

    socket.on('omega:state', (st: OmegaState) => {
      setState(st)
      setEvents(st.events)
      setWeightHistory((prev) => {
        const next = [
          ...prev,
          {
            ts: st.ts,
            trend: st.weights.agents.trend.effective,
            meanrev: st.weights.agents.meanrev.effective,
            macro: st.weights.agents.macro.effective,
            stat_arb: st.weights.agents.stat_arb.effective,
            crowd: st.weights.agents.crowd.effective,
            deflationActive: st.weights.deflationActive,
          },
        ]
        return next.slice(-MAX_WEIGHT_HISTORY)
      })
      setCompositeHistory(st.crowd.history)
      // Build a synthetic candle per second from the price stream (open=prev close, high/low from sparkline delta)
      setCandleHistory((prev) => {
        const tsSec = Math.floor(st.ts / 1000)
        const price = st.market.price
        const last = prev[prev.length - 1]
        if (last && last.time === tsSec) {
          // update current candle
          const updated = { ...last, close: price, high: Math.max(last.high, price), low: Math.min(last.low, price) }
          return [...prev.slice(0, -1), updated]
        }
        const open = last ? last.close : price
        const candle = { time: tsSec, open, high: Math.max(open, price), low: Math.min(open, price), close: price }
        return [...prev, candle].slice(-MAX_CANDLES)
      })
    })

    socket.on('omega:event', (ev: OmegaEvent) => {
      setEvents((prev) => [ev, ...prev].slice(0, 60))
    })

    socket.on('omega:backlog', (evs: OmegaEvent[]) => {
      setEvents(evs)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const reconnect = useCallback(() => {
    socketRef.current?.disconnect()
    socketRef.current?.connect()
  }, [])

  // expose reconnect for manual retry button (unused but available)
  void reconnect

  const configureMode = useCallback(async (mode: LiveMode, creds?: { apiKey: string; apiSecret: string; passphrase: string }): Promise<{ ok: boolean; error?: string }> => {
    const socket = socketRef.current
    if (!socket || !socket.connected) {
      return { ok: false, error: 'Engine not connected' }
    }
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve({ ok: false, error: 'Engine did not acknowledge' }), 5000)
      socket.once('omega:configure:ack', (ack: { ok: boolean; error?: string }) => {
        clearTimeout(timeout)
        resolve(ack)
      })
      const payload: { mode: LiveMode; apiKey?: string; apiSecret?: string; passphrase?: string } = { mode }
      if (creds) {
        payload.apiKey = creds.apiKey
        payload.apiSecret = creds.apiSecret
        payload.passphrase = creds.passphrase
      }
      socket.emit('omega:configure', payload)
    })
  }, [])

  return { state, connected, events, weightHistory, compositeHistory, candleHistory, configureMode }
}
