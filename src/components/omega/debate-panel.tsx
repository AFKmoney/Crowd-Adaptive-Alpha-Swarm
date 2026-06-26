'use client'

import { Gavel, AlertOctagon, CheckCircle2, XCircle } from 'lucide-react'
import type { Consensus, AgentSignal } from '@/lib/omega-types'
import { SIDE_STYLES } from './shared'

interface DebatePanelProps {
  consensus: Consensus
  agents: AgentSignal[]
}

export function DebatePanel({ consensus, agents }: DebatePanelProps) {
  const style = SIDE_STYLES[consensus.side]
  const deferred = consensus.conflict && consensus.quorumMet && consensus.side === 'FLAT' && consensus.voteStd > 0.55
  const noQuorum = !consensus.quorumMet

  // Vote breakdown: sum of weighted confidence by side
  const bySide = { BUY: 0, SELL: 0, FLAT: 0 }
  for (const a of agents) bySide[a.side] += a.weightedConfidence
  const total = bySide.BUY + bySide.SELL + bySide.FLAT || 1

  return (
    <section className="flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Gavel className="h-4 w-4 text-amber-400" />
        <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">Debate Chamber</h2>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">MoE Aggregation</span>
      </div>

      {/* Big consensus display */}
      <div className={`flex items-center justify-between rounded-lg border p-4 ${style.bg} ${style.border}`}>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Consensus</div>
          <div className={`font-mono text-3xl font-black ${style.text}`}>{style.label}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Confidence</div>
          <div className={`font-mono text-2xl font-bold tabular-nums ${style.text}`}>{(consensus.confidence * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* Status flags */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${deferred ? 'border-rose-500/40 bg-rose-500/10' : 'border-zinc-800 bg-zinc-900/50'}`}>
          {deferred ? <AlertOctagon className="h-3.5 w-3.5 text-rose-400" /> : consensus.side !== 'FLAT' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-zinc-500" />}
          <span className={`text-[10px] font-medium uppercase tracking-wider ${deferred ? 'text-rose-300' : consensus.side !== 'FLAT' ? 'text-emerald-300' : 'text-zinc-500'}`}>
            {deferred ? 'Conflict — Deferred' : consensus.side !== 'FLAT' ? 'Quorum Reached' : noQuorum ? 'No Quorum' : 'Neutral'}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/50 px-2.5 py-1.5">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Vote Std</span>
          <span className={`font-mono text-xs font-semibold tabular-nums ${consensus.voteStd > 0.55 ? 'text-rose-300' : 'text-zinc-300'}`}>
            {consensus.voteStd.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Vote breakdown bar */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500">
          <span>Weighted Vote Split</span>
          <span className="tabular-nums">Σ {total.toFixed(2)}</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className="bg-emerald-500/70" style={{ width: `${(bySide.BUY / total) * 100}%` }} />
          <div className="bg-zinc-600/60" style={{ width: `${(bySide.FLAT / total) * 100}%` }} />
          <div className="bg-rose-500/70" style={{ width: `${(bySide.SELL / total) * 100}%` }} />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] font-mono tabular-nums text-zinc-400">
          <span className="text-emerald-400">LONG {bySide.BUY.toFixed(2)}</span>
          <span className="text-zinc-500">FLAT {bySide.FLAT.toFixed(2)}</span>
          <span className="text-rose-400">SHORT {bySide.SELL.toFixed(2)}</span>
        </div>
      </div>

      {/* Conflict threshold meter */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500">
          <span>Conflict Threshold</span>
          <span className="tabular-nums">0.55</span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-zinc-600" />
          <div
            className={`absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ${consensus.voteStd > 0.55 ? 'bg-rose-400' : 'bg-zinc-300'}`}
            style={{ left: `${Math.min(100, (consensus.voteStd / 1.2) * 100)}%` }}
          />
        </div>
        <div className="mt-1 text-[10px] text-zinc-500">
          {deferred
            ? 'Agents disagree beyond threshold — chamber DEFERS. No trade emitted.'
            : consensus.voteStd > 0.4
              ? 'Some disagreement — monitoring.'
              : 'Agents aligned.'}
        </div>
      </div>
    </section>
  )
}
