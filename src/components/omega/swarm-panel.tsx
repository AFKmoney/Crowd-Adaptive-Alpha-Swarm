'use client'

import { Bot } from 'lucide-react'
import type { SignalsState, AgentName } from '@/lib/omega-types'
import { AGENT_META, ROLE_STYLES, SIDE_STYLES } from './shared'

interface SwarmPanelProps {
  signals: SignalsState
}

const AGENT_ORDER: AgentName[] = ['trend', 'meanrev', 'macro', 'stat_arb', 'crowd']

export function SwarmPanel({ signals }: SwarmPanelProps) {
  const byAgent = new Map(signals.agents.map((s) => [s.agent, s]))

  return (
    <section className="flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Bot className="h-4 w-4 text-teal-400" />
        <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">Alpha Swarm</h2>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Mixture of Experts · {signals.symbol}</span>
      </div>

      <div className="flex-1 space-y-2">
        {AGENT_ORDER.map((name) => {
          const sig = byAgent.get(name)
          if (!sig) return null
          const meta = AGENT_META[name]
          const role = ROLE_STYLES[
            name === 'trend' || name === 'macro' ? 'crowd_follower' : name === 'meanrev' || name === 'crowd' ? 'contrarian' : 'neutral'
          ]
          const style = SIDE_STYLES[sig.side]
          const wcPct = (sig.weightedConfidence * 100).toFixed(1)
          const confPct = (sig.confidence * 100).toFixed(0)
          return (
            <div key={name} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs font-bold ${meta.accent}`}>{meta.short}</span>
                  <span className="text-[10px] text-zinc-500">{meta.desc}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${role.bg} ${role.text}`}>{role.label}</span>
                </div>
                <div className={`flex items-center gap-1.5 rounded border px-2 py-0.5 ${style.bg} ${style.border}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${style.text}`}>{style.label}</span>
                  <span className="text-[10px] text-zinc-500 tabular-nums">{confPct}%</span>
                </div>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-zinc-400">{sig.rationale}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[9px] uppercase tracking-wider text-zinc-600">weighted conf</span>
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={`absolute inset-y-0 left-0 ${sig.side === 'BUY' ? 'bg-emerald-400/70' : sig.side === 'SELL' ? 'bg-rose-400/70' : 'bg-zinc-500/70'}`}
                    style={{ width: `${Math.min(100, parseFloat(wcPct) * 2)}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] tabular-nums text-zinc-400">{wcPct}</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
