'use client'

import { AlertTriangle, Gauge, TrendingUp, TrendingDown, Wind } from 'lucide-react'
import type { CrowdState } from '@/lib/omega-types'
import { crowdDirectionLabel } from './shared'

interface CrowdPanelProps {
  crowd: CrowdState
}

// A single horizontal gauge bar: value in [-1, 1] with a center tick and threshold zones
function DimensionGauge({
  label,
  value,
  min,
  max,
  extremeThreshold,
  unit,
  icon,
}: {
  label: string
  value: number
  min: number
  max: number
  extremeThreshold: number
  unit: string
  icon: React.ReactNode
}) {
  const range = max - min
  const pct = ((value - min) / range) * 100
  const isExtreme = Math.abs(value) >= extremeThreshold
  const extremeLeft = ((extremeThreshold - min) / range) * 100
  const extremeRight = ((max - extremeThreshold) / range) * 100

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
          {icon}
          <span className="uppercase tracking-wider">{label}</span>
        </div>
        <span className={`font-mono text-sm font-semibold tabular-nums ${isExtreme ? 'text-amber-300' : 'text-zinc-200'}`}>
          {value.toFixed(2)}
          <span className="ml-0.5 text-[10px] text-zinc-500">{unit}</span>
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        {/* extreme zones */}
        <div className="absolute inset-y-0 left-0 bg-amber-500/15" style={{ width: `${extremeLeft}%` }} />
        <div className="absolute inset-y-0 right-0 bg-amber-500/15" style={{ width: `${extremeRight}%` }} />
        {/* center line */}
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-zinc-600" />
        {/* value marker */}
        <div
          className={`absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ${
            isExtreme ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'bg-zinc-300'
          }`}
          style={{ left: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  )
}

export function CrowdPanel({ crowd }: CrowdPanelProps) {
  const ext = crowd.extreme
  const fearGreed = crowd.fearGreed
  const fgColor = fearGreed > 75 ? 'text-rose-400' : fearGreed > 55 ? 'text-amber-300' : fearGreed < 25 ? 'text-emerald-400' : fearGreed < 45 ? 'text-sky-300' : 'text-zinc-300'

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wind className="h-4 w-4 text-fuchsia-400" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">Crowd Engine</h2>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Layer 1.5 · Extreme Detection</span>
        </div>
        {ext ? (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-1.5">
            <AlertTriangle className="h-3.5 w-3.5 animate-pulse text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
              {crowdDirectionLabel(ext.direction)}
            </span>
            <span className="text-[10px] text-amber-200/70">
              via {ext.dimension} · mag {ext.magnitude.toFixed(2)} · decay {(ext.decay * 100).toFixed(0)}%
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Crowd at rest</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DimensionGauge
          label="Funding Rate"
          value={crowd.fundingRateBps / 15}
          min={-1}
          max={1}
          extremeThreshold={0.8}
          unit=""
          icon={<TrendingUp className="h-3 w-3 text-amber-400" />}
        />
        <DimensionGauge
          label="Sentiment"
          value={crowd.sentiment}
          min={-1}
          max={1}
          extremeThreshold={0.75}
          unit=""
          icon={<TrendingUp className="h-3 w-3 text-teal-400" />}
        />
        <DimensionGauge
          label="Social Buzz"
          value={crowd.socialBuzz * 2 - 1}
          min={-1}
          max={1}
          extremeThreshold={0.75}
          unit=""
          icon={<Wind className="h-3 w-3 text-fuchsia-400" />}
        />
        <DimensionGauge
          label="Composite Crowd"
          value={crowd.composite}
          min={-1}
          max={1}
          extremeThreshold={0.7}
          unit=""
          icon={<Gauge className="h-3 w-3 text-amber-300" />}
        />
      </div>

      {/* Composite breakdown */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Funding</div>
          <div className={`font-mono text-sm font-semibold tabular-nums ${Math.abs(crowd.fundingRateBps) >= 12 ? 'text-amber-300' : 'text-zinc-200'}`}>
            {crowd.fundingRateBps >= 0 ? '+' : ''}{crowd.fundingRateBps.toFixed(1)} bps
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Sentiment</div>
          <div className={`font-mono text-sm font-semibold tabular-nums ${Math.abs(crowd.sentiment) >= 0.75 ? 'text-amber-300' : 'text-zinc-200'}`}>
            {crowd.sentiment >= 0 ? '+' : ''}{crowd.sentiment.toFixed(3)}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Social Buzz</div>
          <div className="font-mono text-sm font-semibold tabular-nums text-zinc-200">
            {(crowd.socialBuzz * 100).toFixed(0)}%
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Fear &amp; Greed</div>
          <div className={`font-mono text-sm font-semibold tabular-nums ${fgColor}`}>
            {fearGreed.toFixed(0)} <span className="text-[10px] text-zinc-500">{fearGreed > 55 ? 'greed' : fearGreed < 45 ? 'fear' : 'neutral'}</span>
          </div>
        </div>
      </div>

      {ext && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/80">
          <TrendingDown className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
          <span>
            Crowd is <strong className="text-amber-300">extremely {ext.direction}</strong> on {ext.dimension}.
            RegimeWeightRouter is <strong className="text-amber-300">deflating crowd-following signals</strong> (trend, macro)
            and <strong className="text-fuchsia-300">boosting contrarians</strong> (meanrev, crowd) until the extreme unwinds.
          </span>
        </div>
      )}
    </section>
  )
}
