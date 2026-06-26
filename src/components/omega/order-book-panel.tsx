'use client'

import { BookOpen, Eye, ShieldAlert, Layers3 } from 'lucide-react'
import type { OrderBookState } from '@/lib/omega-types'

interface OrderBookPanelProps {
  ob: OrderBookState
}

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

export function OrderBookPanel({ ob }: OrderBookPanelProps) {
  const wall = ob.wall
  const imbPct = ob.imbalance * 100
  const spoofActive = ob.spoofDetected

  return (
    <section className="flex h-full flex-col rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 backdrop-blur-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-amber-400" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">Order Book</h2>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Wall + Spoofing</span>
        </div>
        {spoofActive ? (
          <div className="flex items-center gap-1.5 rounded-md border border-rose-500/50 bg-rose-500/10 px-2.5 py-1">
            <Eye className="h-3 w-3 animate-pulse text-rose-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">SPOOF · {ob.spoofSide}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Clean</span>
          </div>
        )}
      </div>

      {/* Imbalance bar */}
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500">
          <span>L2 Imbalance</span>
          <span className={`font-mono tabular-nums ${imbPct > 20 ? 'text-emerald-300' : imbPct < -20 ? 'text-rose-300' : 'text-zinc-300'}`}>
            {imbPct >= 0 ? '+' : ''}{imbPct.toFixed(1)}%
          </span>
        </div>
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-zinc-600" />
          <div
            className={`absolute inset-y-0 ${imbPct >= 0 ? 'left-1/2 bg-emerald-400/70' : 'right-1/2 bg-rose-400/70'}`}
            style={{ width: `${Math.min(50, Math.abs(imbPct))}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] font-mono text-zinc-500">
          <span className="text-rose-400">ASK-heavy</span>
          <span className="text-emerald-400">BID-heavy</span>
        </div>
      </div>

      {/* Walls */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-400">
            <Layers3 className="h-3 w-3" /> Bid Wall
          </div>
          <div className="font-mono text-sm font-semibold tabular-nums text-emerald-300">{fmtUsd(ob.bidWallUsd)}</div>
        </div>
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-rose-400">
            <Layers3 className="h-3 w-3" /> Ask Wall
          </div>
          <div className="font-mono text-sm font-semibold tabular-nums text-rose-300">{fmtUsd(ob.askWallUsd)}</div>
        </div>
      </div>

      {/* Cancellation delta */}
      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500">
          <span>Cancellation Δ (spoof signal)</span>
          <span className={`font-mono tabular-nums ${ob.cancellationDelta > 0.8 ? 'text-rose-300' : 'text-zinc-300'}`}>
            {(ob.cancellationDelta * 100).toFixed(0)}%
          </span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className="absolute inset-y-0 left-0 bg-zinc-700/40" style={{ width: '80%' }} />
          <div
            className={`absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ${ob.cancellationDelta > 0.8 ? 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]' : 'bg-zinc-300'}`}
            style={{ left: `${ob.cancellationDelta * 100}%` }}
          />
        </div>
      </div>

      {/* Wall detail */}
      {wall && (
        <div className={`mt-2.5 rounded-md border px-3 py-2 text-[11px] ${wall.isReal ? 'border-zinc-700 bg-zinc-800/30' : 'border-amber-500/30 bg-amber-500/5'}`}>
          <div className="flex items-center justify-between">
            <span className={`font-mono font-bold uppercase ${wall.side === 'bid' ? 'text-emerald-300' : 'text-rose-300'}`}>
              {wall.side.toUpperCase()} WALL · {fmtUsd(wall.sizeUsd)}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase ${wall.isReal ? 'bg-zinc-700 text-zinc-300' : 'bg-amber-500/20 text-amber-300'}`}>
              {wall.isReal ? 'REAL' : 'SPOOF?'}
            </span>
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-zinc-500">@ {wall.pricePct >= 0 ? '+' : ''}{wall.pricePct.toFixed(3)}% from mid</div>
        </div>
      )}

      {spoofActive && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-200/80">
          <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-rose-400" />
          <span>
            Fake <strong className="text-rose-300">{ob.spoofSide}</strong> wall cancelled {(ob.cancellationDelta * 100).toFixed(0)}% in 1s.
            Front-running the spoof — taking the <strong className="text-emerald-300">opposite</strong> side.
          </span>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-2 text-[10px] text-zinc-500">
        <span className="uppercase tracking-wider">Spoofs caught</span>
        <span className="font-mono font-semibold tabular-nums text-rose-300">{ob.spoofCount}</span>
      </div>
    </section>
  )
}
