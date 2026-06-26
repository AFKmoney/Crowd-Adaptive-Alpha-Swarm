'use client'

import { Droplet, Radio, Zap, Building2 } from 'lucide-react'
import type { ToxicFlowState, DominoState, VenueState } from '@/lib/omega-types'
import { VENUE_COLORS, fmtPrice } from './shared'

interface MicrostructurePanelProps {
  toxic: ToxicFlowState
  venues: VenueState[]
  domino: DominoState
}

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

export function MicrostructurePanel({ toxic, venues, domino }: MicrostructurePanelProps) {
  const toxPct = toxic.toxicity * 100
  return (
    <section className="flex h-full flex-col rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 backdrop-blur-sm sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Droplet className="h-4 w-4 text-violet-400" />
        <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">Toxic Flow + Domino</h2>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Vampire + Temporal Strike</span>
      </div>

      {/* Toxic flow */}
      <div className={`rounded-lg border p-3 ${toxic.mmFleeing ? 'border-violet-500/40 bg-violet-500/10' : 'border-zinc-800 bg-zinc-900/40'}`}>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
            <Droplet className="h-3 w-3" /> Toxicity
          </span>
          {toxic.mmFleeing ? (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-violet-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" /> MM FLEEING
            </span>
          ) : (
            <span className="text-[10px] font-mono tabular-nums text-zinc-300">{toxPct.toFixed(0)}%</span>
          )}
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className="absolute inset-y-0 left-0 bg-zinc-700/40" style={{ width: '70%' }} />
          <div
            className={`absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ${toxic.mmFleeing ? 'bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]' : 'bg-zinc-300'}`}
            style={{ left: `${toxPct}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-zinc-500">
          <span>refill rate {(toxic.bookRefillRate * 100).toFixed(0)}%</span>
        </div>
        {toxic.interpretation && (
          <p className="mt-1 text-[10px] leading-snug text-violet-200/70">{toxic.interpretation}</p>
        )}
      </div>

      {/* Cross-exchange venues */}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
          <Building2 className="h-3 w-3" /> Cross-Exchange Liquidation Domino
        </div>
        <div className="space-y-1.5">
          {venues.map((v) => {
            const color = VENUE_COLORS[v.name] || '#a1a1aa'
            const isSource = domino.active && domino.source === v.name
            const isTarget = domino.active && domino.target === v.name
            return (
              <div
                key={v.name}
                className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 ${
                  isSource ? 'border-rose-500/50 bg-rose-500/10' : isTarget ? 'border-amber-500/50 bg-amber-500/10' : 'border-zinc-800 bg-zinc-900/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  <span className="font-mono text-[11px] font-semibold text-zinc-200">{v.name}</span>
                  {isSource && <span className="text-[9px] font-bold uppercase text-rose-300">SOURCE</span>}
                  {isTarget && <span className="text-[9px] font-bold uppercase text-amber-300">→ STRIKE</span>}
                </div>
                <div className="flex items-center gap-3 font-mono text-[10px] tabular-nums">
                  <span className="text-zinc-400">{fmtPrice(v.price)}</span>
                  <span className={v.liq1sUsd > 5_000_000 ? 'text-rose-300' : 'text-zinc-500'}>{fmtUsd(v.liq1sUsd)}/s</span>
                  <span className="text-zinc-600">{v.lagMs}ms</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Domino status */}
      <div className={`mt-2.5 rounded-md border px-3 py-2 ${domino.active ? 'border-amber-500/50 bg-amber-500/10' : 'border-zinc-800 bg-zinc-900/40'}`}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
            <Zap className="h-3 w-3 text-amber-400" /> Domino Strike
          </span>
          <span className={`font-mono text-[11px] font-bold uppercase ${domino.active ? 'text-amber-300' : 'text-zinc-500'}`}>
            {domino.active ? `${domino.source} → ${domino.target}` : 'INACTIVE'}
          </span>
        </div>
        {domino.active && (
          <div className="mt-1 text-[10px] text-amber-200/80">
            Edge <span className="font-mono font-semibold text-amber-300">{domino.edgePct >= 0 ? '+' : ''}{(domino.edgePct * 100).toFixed(3)}%</span> on {domino.target}
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between pt-2 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1 uppercase tracking-wider"><Radio className="h-3 w-3" /> strikes</span>
        <span className="font-mono font-semibold tabular-nums text-amber-300">{domino.strikeCount}</span>
      </div>
    </section>
  )
}
