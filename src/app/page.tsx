'use client'

import { useOmegaEngine } from '@/hooks/use-omega-engine'
import { Header } from '@/components/omega/header'
import { CrowdPanel } from '@/components/omega/crowd-panel'
import { WeightsPanel } from '@/components/omega/weights-panel'
import { SwarmPanel } from '@/components/omega/swarm-panel'
import { DebatePanel } from '@/components/omega/debate-panel'
import { WeightHistoryChart } from '@/components/omega/weight-history-chart'
import { EventLog } from '@/components/omega/event-log'
import { Sparkles } from 'lucide-react'

export default function Home() {
  const { state, connected, events, weightHistory } = useOmegaEngine()

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <Header state={state} connected={connected} />

      {/* Feature banner */}
      <div className="border-b border-zinc-800 bg-gradient-to-r from-fuchsia-500/10 via-amber-500/5 to-transparent">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-4 py-2 sm:px-6">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-fuchsia-400" />
          <p className="text-[11px] leading-snug text-zinc-400">
            <span className="font-semibold text-zinc-200">Dynamic weight reconfiguration:</span>{' '}
            when the <span className="text-fuchsia-300">Crowd Engine</span> detects an extreme, the{' '}
            <span className="text-amber-300">RegimeWeightRouter</span> <span className="font-semibold text-amber-200">deflates crowd-following signals</span> (trend, macro)
            and <span className="font-semibold text-fuchsia-200">boosts contrarians</span> (meanrev, crowd) until the extreme unwinds.
          </p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-5">
        {/* Row 1 — Crowd engine (full width) */}
        {state ? (
          <CrowdPanel crowd={state.crowd} />
        ) : (
          <SkeletonPanel className="h-[260px]" />
        )}

        {/* Row 2 — Weights + Swarm */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {state ? <WeightsPanel weights={state.weights} /> : <SkeletonPanel className="h-[420px]" />}
          {state ? <SwarmPanel signals={state.signals} /> : <SkeletonPanel className="h-[420px]" />}
        </div>

        {/* Row 3 — Weight history + Debate */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {weightHistory.length > 0 ? (
            <WeightHistoryChart history={weightHistory} />
          ) : (
            <SkeletonPanel className="h-[300px]" />
          )}
          {state ? (
            <DebatePanel consensus={state.signals.consensus} agents={state.signals.agents} />
          ) : (
            <SkeletonPanel className="h-[300px]" />
          )}
        </div>

        {/* Row 4 — Event log (full width) */}
        <EventLog events={events} />
      </main>

      <footer className="mt-auto border-t border-zinc-800 bg-zinc-950">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 sm:px-6">
          <span className="font-mono">OMEGA · Autonomous Multi-Modal AI Hedge Fund Entity</span>
          <span className="font-mono">Architecture Whitepaper v1.0 · Crowd-Adaptive Weight Router</span>
        </div>
      </footer>

      <style jsx global>{`
        .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 3px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #52525b; }
      `}</style>
    </div>
  )
}

function SkeletonPanel({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40 ${className}`}>
      <div className="flex h-full items-center justify-center text-[11px] text-zinc-600">
        awaiting engine stream…
      </div>
    </div>
  )
}
