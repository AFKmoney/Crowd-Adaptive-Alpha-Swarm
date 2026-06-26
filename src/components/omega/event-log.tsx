'use client'

import { ScrollText, Waves, AlertTriangle, Activity, RefreshCw, Layers, Gavel, CheckCircle2 } from 'lucide-react'
import type { OmegaEvent, EventType } from '@/lib/omega-types'
import { fmtTime } from './shared'

interface EventLogProps {
  events: OmegaEvent[]
}

const EVENT_META: Record<EventType, { icon: React.ReactNode; text: string; border: string; bg: string }> = {
  crowd_extreme: { icon: <AlertTriangle className="h-3.5 w-3.5" />, text: 'text-amber-300', border: 'border-l-amber-500', bg: 'bg-amber-500/5' },
  crowd_clear: { icon: <RefreshCw className="h-3.5 w-3.5" />, text: 'text-zinc-300', border: 'border-l-zinc-500', bg: 'bg-zinc-500/5' },
  weight_reconfig: { icon: <Layers className="h-3.5 w-3.5" />, text: 'text-fuchsia-300', border: 'border-l-fuchsia-500', bg: 'bg-fuchsia-500/5' },
  regime_change: { icon: <Waves className="h-3.5 w-3.5" />, text: 'text-teal-300', border: 'border-l-teal-500', bg: 'bg-teal-500/5' },
  conflict_defer: { icon: <Gavel className="h-3.5 w-3.5" />, text: 'text-rose-300', border: 'border-l-rose-500', bg: 'bg-rose-500/5' },
  consensus: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: 'text-emerald-300', border: 'border-l-emerald-500', bg: 'bg-emerald-500/5' },
}

export function EventLog({ events }: EventLogProps) {
  return (
    <section className="flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-zinc-400" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">Event Stream</h2>
        </div>
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
          <Activity className="h-3 w-3 text-emerald-400" />
          live
        </span>
      </div>
      <div className="max-h-[320px] flex-1 space-y-1.5 overflow-y-auto pr-1 custom-scroll">
        {events.length === 0 && (
          <div className="flex h-full items-center justify-center text-[11px] text-zinc-600">No events yet…</div>
        )}
        {events.map((ev) => {
          const meta = EVENT_META[ev.type]
          return (
            <div key={ev.id} className={`flex items-start gap-2 rounded-r-md border-l-2 ${meta.border} ${meta.bg} px-2.5 py-1.5`}>
              <span className={`mt-0.5 ${meta.text}`}>{meta.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{ev.type.replace(/_/g, ' ')}</span>
                  <span className="font-mono text-[10px] tabular-nums text-zinc-600">{fmtTime(ev.ts)}</span>
                </div>
                <p className="text-[11px] leading-snug text-zinc-300">{ev.message}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
