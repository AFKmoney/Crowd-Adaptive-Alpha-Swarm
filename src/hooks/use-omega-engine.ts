'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { OmegaState, OmegaEvent } from '@/lib/omega-types'

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
}

const MAX_WEIGHT_HISTORY = 120

export function useOmegaEngine(): UseOmegaEngine {
  const [state, setState] = useState<OmegaState | null>(null)
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState<OmegaEvent[]>([])
  const [weightHistory, setWeightHistory] = useState<UseOmegaEngine['weightHistory']>([])
  const [compositeHistory, setCompositeHistory] = useState<UseOmegaEngine['compositeHistory']>([])
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

  return { state, connected, events, weightHistory, compositeHistory }
}
