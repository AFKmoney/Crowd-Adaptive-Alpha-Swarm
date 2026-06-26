'use client'

import { Layers, ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { WeightsState, AgentName } from '@/lib/omega-types'
import { AGENT_META, ROLE_STYLES } from './shared'

interface WeightsPanelProps {
  weights: WeightsState
}

const AGENT_ORDER: AgentName[] = ['trend', 'meanrev', 'macro', 'stat_arb', 'crowd']

function multiplierBadge(mult: number) {
  if (Math.abs(mult - 1) < 0.02) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 bg-zinc-800/60">
        <Minus className="h-2.5 w-2.5" />×1.00
      </span>
    )
  }
  const deflating = mult < 1
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
        deflating ? 'text-amber-300 bg-amber-500/10' : 'text-fuchsia-300 bg-fuchsia-500/10'
      }`}
    >
      {deflating ? <ArrowDown className="h-2.5 w-2.5" /> : <ArrowUp className="h-2.5 w-2.5" />}×{mult.toFixed(2)}
    </span>
  )
}

export function WeightsPanel({ weights }: WeightsPanelProps) {
  const active = weights.deflationActive
  return (
    <section className="flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-fuchsia-400" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">RegimeWeightRouter</h2>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Dynamic Reconfiguration</span>
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
            active ? 'border-amber-500/50 bg-amber-500/10 text-amber-300' : 'border-zinc-800 bg-zinc-900/60 text-zinc-500'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${active ? 'animate-pulse bg-amber-400' : 'bg-zinc-600'}`} />
          {active ? 'DEFLATION ACTIVE' : 'REGIME BASELINE'}
        </div>
      </div>

      {/* Agent weight rows */}
      <div className="flex-1 space-y-2.5">
        {AGENT_ORDER.map((name) => {
          const w = weights.agents[name]
          const meta = AGENT_META[name]
          const role = ROLE_STYLES[w.role]
          const effPct = w.effective * 100
          const basePct = w.base * 100
          const delta = effPct - basePct
          return (
            <div key={name} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs font-bold ${meta.accent}`}>{meta.short}</span>
                  <span className="text-[10px] text-zinc-500">{meta.label}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${role.bg} ${role.text}`}>{role.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {multiplierBadge(w.multiplier)}
                  <span className="font-mono text-xs font-semibold tabular-nums text-zinc-200">
                    {effPct.toFixed(1)}%
                  </span>
                </div>
              </div>
              {/* dual bar: base (ghost) + effective (solid) */}
              <div className="relative h-2.5 w-full overflow-hidden rounded bg-zinc-800/80">
                {/* base ghost */}
                <div
                  className="absolute inset-y-0 left-0 bg-zinc-700/60"
                  style={{ width: `${Math.min(100, basePct)}%` }}
                />
                {/* effective solid (min 6px so tiny boosted values stay visible) */}
                <div
                  className={`absolute inset-y-0 left-0 ${
                    active && w.multiplier < 0.99 ? 'bg-amber-400/80' : active && w.multiplier > 1.01 ? 'bg-fuchsia-400/80' : 'bg-zinc-300/80'
                  }`}
                  style={{ width: `max(6px, ${Math.min(100, effPct)}%)` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500">
                <span className="tabular-nums">base {basePct.toFixed(1)}%</span>
                <span className={`tabular-nums ${delta > 0.1 ? 'text-fuchsia-300' : delta < -0.1 ? 'text-amber-300' : 'text-zinc-600'}`}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(1)}pp vs base
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {weights.reason && (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-200/80">
          <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400">Reconfig reason </span>
          <span className="font-mono">{weights.reason}</span>
        </div>
      )}
    </section>
  )
}
