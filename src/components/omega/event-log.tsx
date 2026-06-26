'use client'

import { ScrollText, Waves, AlertTriangle, Activity, RefreshCw, Layers, Gavel, CheckCircle2, Crosshair, Eye, Droplet, Zap, Grid3x3, TrendingUp, TrendingDown, ShieldAlert, Target, XCircle } from 'lucide-react'
import type { OmegaEvent, EventType } from '@/lib/omega-types'
import { fmtTime } from './shared'

interface EventLogProps {
  events: OmegaEvent[]
}

const EVENT_META: Record<EventType, { icon: React.ReactNode; text: string; border: string; bg: string; glow?: boolean }> = {
  crowd_extreme: { icon: <AlertTriangle className="h-3.5 w-3.5" />, text: 'text-amber-300', border: 'border-l-amber-500', bg: 'bg-amber-500/5' },
  crowd_clear: { icon: <RefreshCw className="h-3.5 w-3.5" />, text: 'text-zinc-300', border: 'border-l-zinc-500', bg: 'bg-zinc-500/5' },
  weight_reconfig: { icon: <Layers className="h-3.5 w-3.5" />, text: 'text-fuchsia-300', border: 'border-l-fuchsia-500', bg: 'bg-fuchsia-500/5' },
  regime_change: { icon: <Waves className="h-3.5 w-3.5" />, text: 'text-teal-300', border: 'border-l-teal-500', bg: 'bg-teal-500/5' },
  conflict_defer: { icon: <Gavel className="h-3.5 w-3.5" />, text: 'text-rose-300', border: 'border-l-rose-500', bg: 'bg-rose-500/5' },
  consensus: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: 'text-emerald-300', border: 'border-l-emerald-500', bg: 'bg-emerald-500/5', glow: true },
  trade_open: { icon: <TrendingUp className="h-3.5 w-3.5" />, text: 'text-emerald-300', border: 'border-l-emerald-500', bg: 'bg-emerald-500/5', glow: true },
  trade_close: { icon: <TrendingDown className="h-3.5 w-3.5" />, text: 'text-zinc-300', border: 'border-l-zinc-500', bg: 'bg-zinc-500/5' },
  risk_hard_stop: { icon: <ShieldAlert className="h-3.5 w-3.5" />, text: 'text-rose-300', border: 'border-l-rose-500', bg: 'bg-rose-500/10' },
  risk_override: { icon: <FlameIcon />, text: 'text-rose-300', border: 'border-l-rose-500', bg: 'bg-rose-500/10', glow: true },
  risk_tp_hit: { icon: <Target className="h-3.5 w-3.5" />, text: 'text-emerald-300', border: 'border-l-emerald-500', bg: 'bg-emerald-500/10', glow: true },
  risk_sl_hit: { icon: <XCircle className="h-3.5 w-3.5" />, text: 'text-rose-300', border: 'border-l-rose-500', bg: 'bg-rose-500/10' },
  // TITAN new events
  liquidation_snipe: { icon: <Crosshair className="h-3.5 w-3.5" />, text: 'text-fuchsia-300', border: 'border-l-fuchsia-500', bg: 'bg-fuchsia-500/10', glow: true },
  oi_cascade: { icon: <AlertTriangle className="h-3.5 w-3.5" />, text: 'text-rose-300', border: 'border-l-rose-500', bg: 'bg-rose-500/10', glow: true },
  spoof_detected: { icon: <Eye className="h-3.5 w-3.5" />, text: 'text-rose-300', border: 'border-l-rose-500', bg: 'bg-rose-500/10', glow: true },
  toxic_mm_flee: { icon: <Droplet className="h-3.5 w-3.5" />, text: 'text-violet-300', border: 'border-l-violet-500', bg: 'bg-violet-500/10', glow: true },
  domino_strike: { icon: <Zap className="h-3.5 w-3.5" />, text: 'text-amber-300', border: 'border-l-amber-500', bg: 'bg-amber-500/10', glow: true },
  maker_grid_deploy: { icon: <Grid3x3 className="h-3.5 w-3.5" />, text: 'text-teal-300', border: 'border-l-teal-500', bg: 'bg-teal-500/10', glow: true },
  maker_grid_fill: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: 'text-emerald-300', border: 'border-l-emerald-500', bg: 'bg-emerald-500/5' },
  maker_grid_complete: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: 'text-teal-300', border: 'border-l-teal-500', bg: 'bg-teal-500/10', glow: true },
  wall_detected: { icon: <Layers className="h-3.5 w-3.5" />, text: 'text-amber-300', border: 'border-l-amber-500', bg: 'bg-amber-500/5' },
  time_bandit_strike: { icon: <TimerIcon />, text: 'text-amber-200', border: 'border-l-amber-400', bg: 'bg-amber-500/15', glow: true },
}

function TimerIcon() {
  return <span className="text-sm leading-none">⏳</span>
}

function FlameIcon() {
  return <span className="text-base leading-none">🔥</span>
}

export function EventLog({ events }: EventLogProps) {
  return (
    <section className="flex h-full flex-col rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 backdrop-blur-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-emerald-400" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">Terminal</h2>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Live Event Stream</span>
        </div>
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
          <Activity className="h-3 w-3 animate-pulse text-emerald-400" />
          live
        </span>
      </div>
      <div className="max-h-[340px] flex-1 space-y-1 overflow-y-auto pr-1 custom-scroll font-mono">
        {events.length === 0 && (
          <div className="flex h-full items-center justify-center text-[11px] text-zinc-600">No events yet…</div>
        )}
        {events.map((ev) => {
          const meta = EVENT_META[ev.type] || EVENT_META.consensus
          return (
            <div
              key={ev.id}
              className={`flex items-start gap-2 rounded-r-md border-l-2 ${meta.border} ${meta.bg} px-2.5 py-1.5 ${meta.glow ? 'shadow-[inset_0_0_12px_rgba(52,211,153,0.05)]' : ''}`}
            >
              <span className={`mt-0.5 ${meta.text} ${meta.glow ? 'drop-shadow-[0_0_4px_currentColor]' : ''}`}>{meta.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`text-[9px] uppercase tracking-wider ${meta.text} drop-shadow-[0_0_2px_currentColor]`}>{ev.type.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] tabular-nums text-zinc-600">{fmtTime(ev.ts)}</span>
                </div>
                <p className={`text-[11px] leading-snug ${meta.glow ? 'text-zinc-200' : 'text-zinc-400'}`}>{ev.message}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
