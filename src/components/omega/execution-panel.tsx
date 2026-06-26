'use client'

import { Grid3x3, Coins, TrendingDown } from 'lucide-react'
import type { ExecutionState } from '@/lib/omega-types'

interface ExecutionPanelProps {
  exec: ExecutionState
}

const TIER_COLORS = ['#5eead4', '#2dd4bf', '#14b8a6']

export function ExecutionPanel({ exec }: ExecutionPanelProps) {
  const isGrid = exec.mode === 'maker_grid'
  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 backdrop-blur-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Grid3x3 className="h-4 w-4 text-teal-400" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">Execution Blade</h2>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Maker-Grid</span>
        </div>
        <span className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
          isGrid ? 'border-teal-500/40 bg-teal-500/10 text-teal-300' : 'border-zinc-700 bg-zinc-800/50 text-zinc-400'
        }`}>
          {isGrid ? 'MAKER GRID' : 'MARKET'}
        </span>
      </div>

      {/* Rebates + slippage saved */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-400">
            <Coins className="h-3 w-3" /> Maker Rebates
          </div>
          <div className="font-mono text-sm font-bold tabular-nums text-emerald-300">+${exec.rebateUsd.toFixed(4)}</div>
        </div>
        <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 px-3 py-2">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-teal-400">
            <TrendingDown className="h-3 w-3" /> Slippage Saved
          </div>
          <div className="font-mono text-sm font-bold tabular-nums text-teal-300">${exec.slippageSavedUsd.toFixed(4)}</div>
        </div>
      </div>

      {/* Grid tiers */}
      {exec.gridOrders.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Active Grid Tiers</div>
          {exec.gridOrders.map((o, i) => {
            const color = TIER_COLORS[o.tier - 1] || '#a1a1aa'
            const filled = o.status === 'filled'
            const pending = o.status === 'pending'
            return (
              <div key={o.id} className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 ${
                filled ? 'border-emerald-500/30 bg-emerald-500/5' : pending ? 'border-zinc-700 bg-zinc-800/30' : 'border-zinc-800 bg-zinc-900/30 opacity-50'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  <span className="font-mono text-[10px] font-semibold text-zinc-300">T{o.tier}</span>
                  <span className="font-mono text-[10px] text-zinc-500">{o.side} @ {o.limitPricePct >= 0 ? '+' : ''}{o.limitPricePct.toFixed(2)}%</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] tabular-nums">
                  <span className="text-zinc-400">${o.sizeUsd.toFixed(0)}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase ${
                    filled ? 'bg-emerald-500/20 text-emerald-300' : pending ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-800 text-zinc-500'
                  }`}>{o.status}</span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/30 px-3 py-3 text-center text-[11px] text-zinc-600">
          No active grid — contrarian entries deploy a 3-tier maker spiderweb at −0.1% / −0.5% / −1.0%
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
        <span className="uppercase tracking-wider">Grids deployed</span>
        <span className="font-mono font-semibold tabular-nums text-teal-300">{exec.activeGrids}</span>
      </div>
    </section>
  )
}
