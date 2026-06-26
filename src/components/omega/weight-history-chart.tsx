'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import type { AgentName } from '@/lib/omega-types'
import { AGENT_BAR_COLOR, fmtTime } from './shared'

interface WeightHistoryChartProps {
  history: Array<{
    ts: number
    trend: number
    meanrev: number
    macro: number
    stat_arb: number
    crowd: number
    deflationActive: boolean
  }>
}

const AGENTS: { key: AgentName; label: string }[] = [
  { key: 'trend', label: 'Trend' },
  { key: 'meanrev', label: 'MeanRev' },
  { key: 'macro', label: 'Macro' },
  { key: 'stat_arb', label: 'StatArb' },
  { key: 'crowd', label: 'Crowd' },
]

export function WeightHistoryChart({ history }: WeightHistoryChartProps) {
  const data = useMemo(
    () =>
      history.map((h) => ({
        ts: h.ts,
        time: fmtTime(h.ts),
        trend: +(h.trend * 100).toFixed(2),
        meanrev: +(h.meanrev * 100).toFixed(2),
        macro: +(h.macro * 100).toFixed(2),
        stat_arb: +(h.stat_arb * 100).toFixed(2),
        crowd: +(h.crowd * 100).toFixed(2),
        deflation: h.deflationActive,
      })),
    [history],
  )

  // segments where deflation was active, for reference bands
  const bands = useMemo(() => {
    const out: Array<{ start: number; end: number }> = []
    let cur: { start: number; end: number } | null = null
    for (const d of data) {
      if (d.deflation) {
        if (!cur) cur = { start: d.ts, end: d.ts }
        else cur.end = d.ts
      } else {
        if (cur) {
          out.push(cur)
          cur = null
        }
      }
    }
    if (cur) out.push(cur)
    return out
  }, [data])

  return (
    <section className="flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-fuchsia-400" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">Effective Weight History</h2>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          {data.length} bars · amber band = deflation active
        </span>
      </div>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: -14 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={{ stroke: '#3f3f46' }}
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={{ stroke: '#3f3f46' }}
              tickFormatter={(v) => `${v}%`}
              domain={[0, 60]}
            />
            <Tooltip
              contentStyle={{
                background: '#09090b',
                border: '1px solid #3f3f46',
                borderRadius: 8,
                fontSize: 11,
                fontFamily: 'monospace',
              }}
              labelStyle={{ color: '#a1a1aa' }}
              itemStyle={{ color: '#e4e4e7' }}
              formatter={(value: number, name: string) => [`${value}%`, name]}
            />
            <Legend
              wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }}
              iconType="plainline"
              iconSize={12}
            />
            {bands.map((b, i) => (
              <ReferenceLine
                key={i}
                x={fmtTime(b.start)}
                stroke="#f59e0b"
                strokeOpacity={0.4}
                strokeDasharray="2 2"
                label={{ value: '⚡', fill: '#fbbf24', fontSize: 10, position: 'top' }}
              />
            ))}
            {AGENTS.map((a) => (
              <Line
                key={a.key}
                type="monotone"
                dataKey={a.key}
                name={a.label}
                stroke={AGENT_BAR_COLOR[a.key]}
                strokeWidth={1.8}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
