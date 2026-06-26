'use client'

import { Crosshair, Zap, TrendingDown, Flame } from 'lucide-react'
import type { LiquidationState } from '@/lib/omega-types'

interface LiquidationPanelProps {
  liq: LiquidationState
}

const SEVERITY_STYLES: Record<string, { text: string; bg: string; border: string; label: string }> = {
  minor: { text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/40', label: 'MINOR' },
  moderate: { text: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-500/40', label: 'MODERATE' },
  severe: { text: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/50', label: 'SEVERE' },
}

export function LiquidationPanel({ liq }: LiquidationPanelProps) {
  const cascade = liq.cascade
  const oiM = liq.openInterestUsd / 1_000_000
  const oiDeltaM = liq.oiDelta1sUsd / 1_000_000
  const longLiqK = liq.longLiqUsd1s / 1000
  const shortLiqK = liq.shortLiqUsd1s / 1000

  return (
    <section className="flex h-full flex-col rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 backdrop-blur-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-rose-400" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">Liquidation Sniper</h2>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">OI Delta Probe</span>
        </div>
        {cascade ? (
          <div className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 ${SEVERITY_STYLES[cascade.severity]?.bg} ${SEVERITY_STYLES[cascade.severity]?.border}`}>
            <Flame className={`h-3 w-3 animate-pulse ${SEVERITY_STYLES[cascade.severity]?.text}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${SEVERITY_STYLES[cascade.severity]?.text}`}>
              {SEVERITY_STYLES[cascade.severity]?.label} CASCADE
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">No cascade</span>
          </div>
        )}
      </div>

      {/* OI + delta */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Open Interest</div>
          <div className="font-mono text-sm font-semibold tabular-nums text-zinc-200">${oiM.toFixed(2)}M</div>
        </div>
        <div className={`rounded-lg border px-3 py-2 ${oiDeltaM < -0.5 ? 'border-rose-500/40 bg-rose-500/10' : 'border-zinc-800 bg-zinc-900/40'}`}>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">OI Δ 1s</div>
          <div className={`font-mono text-sm font-semibold tabular-nums ${oiDeltaM < -0.5 ? 'text-rose-300' : oiDeltaM > 0.5 ? 'text-emerald-300' : 'text-zinc-200'}`}>
            {oiDeltaM >= 0 ? '+' : ''}{oiDeltaM.toFixed(2)}M ({(liq.oiDeltaPct * 100).toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* Liquidation flow */}
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-rose-400">
            <TrendingDown className="h-3 w-3" /> Long Liq 1s
          </div>
          <div className="font-mono text-sm font-semibold tabular-nums text-rose-300">${longLiqK.toFixed(0)}K</div>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-400">
            <Zap className="h-3 w-3" /> Short Liq 1s
          </div>
          <div className="font-mono text-sm font-semibold tabular-nums text-emerald-300">${shortLiqK.toFixed(0)}K</div>
        </div>
      </div>

      {/* Cascade detail */}
      {cascade && (
        <div className="mt-2.5 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-200/80">
          <div className="flex items-center gap-1.5">
            <Flame className="h-3 w-3 animate-pulse text-rose-400" />
            <span className="font-mono font-bold uppercase text-rose-300">Cascade active — {cascade.ageMs}ms old</span>
          </div>
          <div className="mt-1 grid grid-cols-3 gap-2 font-mono tabular-nums">
            <span>drop <span className="text-rose-300">{cascade.priceDropPct.toFixed(2)}%</span></span>
            <span>OI <span className="text-rose-300">{cascade.oiDropPct.toFixed(2)}%</span></span>
            <span>wick <span className={cascade.wickCaptured ? 'text-emerald-300' : 'text-zinc-500'}>{cascade.wickCaptured ? 'CAPTURED ✓' : 'pending'}</span></span>
          </div>
        </div>
      )}

      {/* Recent cascades */}
      {liq.recentCascades.length > 0 && (
        <div className="mt-2.5 max-h-[80px] flex-1 space-y-1 overflow-y-auto custom-scroll">
          {liq.recentCascades.slice(0, 5).map((c, i) => (
            <div key={i} className="flex items-center justify-between rounded border-l-2 border-rose-500/40 bg-rose-500/5 px-2 py-1 text-[10px]">
              <span className={`font-mono uppercase ${SEVERITY_STYLES[c.severity]?.text || 'text-zinc-400'}`}>{c.severity}</span>
              <span className="font-mono tabular-nums text-zinc-400">drop {c.priceDropPct.toFixed(2)}% · OI {c.oiDropPct.toFixed(2)}%</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
        <span className="uppercase tracking-wider">Snipe entries</span>
        <span className="font-mono font-semibold tabular-nums text-fuchsia-300">{liq.snipeCount}</span>
      </div>
    </section>
  )
}
