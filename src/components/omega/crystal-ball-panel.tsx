'use client'

import { Globe, Timer, Radio, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import type { CrystalBallState, TimeBanditState } from '@/lib/omega-types'
import { SIDE_STYLES, fmtTime } from './shared'

interface CrystalBallPanelProps {
  crystal: CrystalBallState
  bandit: TimeBanditState
}

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}

export function CrystalBallPanel({ crystal, bandit }: CrystalBallPanelProps) {
  const strike = crystal.strikeActive
  const sigPct = crystal.signal * 100
  const longPct = Math.min(100, (crystal.longLiq2sUsd / crystal.thresholdUsd) * 100)
  const shortPct = Math.min(100, (crystal.shortLiq2sUsd / crystal.thresholdUsd) * 100)

  return (
    <section className={`flex h-full flex-col rounded-xl border p-4 backdrop-blur-sm sm:p-5 transition-colors ${
      strike ? 'border-amber-400/60 bg-amber-500/10 shadow-[0_0_30px_rgba(251,191,36,0.15)]' : 'border-zinc-800/60 bg-zinc-900/30'
    }`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe className={`h-4 w-4 ${strike ? 'text-amber-300' : 'text-amber-400'}`} />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">Boule de Cristal</h2>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Binance Liq Feed</span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* WS connection status */}
          <span className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
            <span className={`h-1.5 w-1.5 rounded-full ${crystal.connected ? 'animate-pulse bg-emerald-400' : 'bg-zinc-600'}`} />
            WS {crystal.connected ? 'LIVE' : 'OFF'}
          </span>
          {strike ? (
            <span className="flex items-center gap-1 rounded-md border border-amber-400/60 bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.5)]">
              <Timer className="h-2.5 w-2.5 animate-pulse" /> TIME BANDIT
            </span>
          ) : null}
        </div>
      </div>

      {/* Signal gauge: -1..1 with ±1.0 strike zones */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500">
          <span>Crystal Ball Signal</span>
          <span className={`font-mono font-bold tabular-nums ${strike ? 'text-amber-300 drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]' : sigPct < 0 ? 'text-rose-300' : sigPct > 0 ? 'text-emerald-300' : 'text-zinc-300'}`}>
            {sigPct >= 0 ? '+' : ''}{sigPct.toFixed(0)}%
          </span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-zinc-800">
          {/* strike zones */}
          <div className="absolute inset-y-0 left-0 bg-amber-500/20" style={{ width: '12.5%' }} />
          <div className="absolute inset-y-0 right-0 bg-amber-500/20" style={{ width: '12.5%' }} />
          {/* center line */}
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-zinc-600" />
          {/* value marker */}
          <div
            className={`absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${
              strike ? 'bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.9)]' : sigPct < 0 ? 'bg-rose-400' : 'bg-emerald-400'
            }`}
            style={{ left: `${50 + Math.max(-50, Math.min(50, sigPct / 2))}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[9px] font-mono text-zinc-600">
          <span className="text-rose-400">−1.0 (longs massacred)</span>
          <span>0</span>
          <span className="text-emerald-400">+1.0 (shorts squeezed)</span>
        </div>
      </div>

      {/* 2s liquidation totals vs threshold */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className={`rounded-lg border px-3 py-2 ${crystal.longLiq2sUsd >= crystal.thresholdUsd ? 'border-amber-400/50 bg-amber-500/10' : 'border-rose-500/20 bg-rose-500/5'}`}>
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-rose-400">
            <TrendingDown className="h-3 w-3" /> Long Liq (2s)
          </div>
          <div className={`font-mono text-sm font-bold tabular-nums ${crystal.longLiq2sUsd >= crystal.thresholdUsd ? 'text-amber-300' : 'text-rose-300'}`}>
            {fmtUsd(crystal.longLiq2sUsd)}
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className={`h-full ${crystal.longLiq2sUsd >= crystal.thresholdUsd ? 'bg-amber-400' : 'bg-rose-400/60'}`} style={{ width: `${longPct}%` }} />
          </div>
          <div className="mt-0.5 text-[9px] text-zinc-600">threshold {fmtUsd(crystal.thresholdUsd)}</div>
        </div>
        <div className={`rounded-lg border px-3 py-2 ${crystal.shortLiq2sUsd >= crystal.thresholdUsd ? 'border-amber-400/50 bg-amber-500/10' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-400">
            <TrendingUp className="h-3 w-3" /> Short Liq (2s)
          </div>
          <div className={`font-mono text-sm font-bold tabular-nums ${crystal.shortLiq2sUsd >= crystal.thresholdUsd ? 'text-amber-300' : 'text-emerald-300'}`}>
            {fmtUsd(crystal.shortLiq2sUsd)}
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className={`h-full ${crystal.shortLiq2sUsd >= crystal.thresholdUsd ? 'bg-amber-400' : 'bg-emerald-400/60'}`} style={{ width: `${shortPct}%` }} />
          </div>
          <div className="mt-0.5 text-[9px] text-zinc-600">threshold {fmtUsd(crystal.thresholdUsd)}</div>
        </div>
      </div>

      {/* Live liquidation feed */}
      <div className="mt-3 flex-1">
        <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
          <Radio className="h-3 w-3" /> Live Liquidation Feed (2s window)
        </div>
        <div className="max-h-[100px] space-y-0.5 overflow-y-auto custom-scroll font-mono text-[10px]">
          {crystal.recentEvents.length === 0 ? (
            <div className="text-zinc-600">No liquidations in window…</div>
          ) : (
            crystal.recentEvents.map((e, i) => (
              <div key={i} className="flex items-center justify-between rounded px-1.5 py-0.5 hover:bg-zinc-800/40">
                <span className={e.side === 'long' ? 'text-rose-400' : 'text-emerald-400'}>
                  {e.side === 'long' ? 'LONG' : 'SHORT'} liq
                </span>
                <span className="text-zinc-500">{e.symbol}</span>
                <span className={`tabular-nums ${e.sizeUsd >= crystal.thresholdUsd ? 'font-bold text-amber-300' : 'text-zinc-300'}`}>
                  {fmtUsd(e.sizeUsd)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* TimeBandit strike status */}
      <div className={`mt-2 rounded-md border px-3 py-2 transition-colors ${
        bandit.active ? 'border-amber-400/60 bg-amber-500/15 shadow-[0_0_15px_rgba(251,191,36,0.2)]' : 'border-zinc-800 bg-zinc-900/40'
      }`}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
            <Timer className={`h-3 w-3 ${bandit.active ? 'animate-pulse text-amber-300' : 'text-zinc-500'}`} /> TimeBandit
            <span className="rounded bg-zinc-800 px-1 text-[8px] font-bold text-zinc-400">PRIORITY 0</span>
          </span>
          <span className={`font-mono text-[11px] font-bold uppercase ${bandit.active ? 'text-amber-300 drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]' : 'text-zinc-500'}`}>
            {bandit.active ? `${bandit.side} @ ${(bandit.confidence * 100).toFixed(0)}%` : 'STANDBY'}
          </span>
        </div>
        {bandit.active && (
          <div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-amber-200/80">
            <span>widened TP <span className="font-bold text-amber-300">{bandit.takeProfitBps}bps</span></span>
            <span className="flex items-center gap-0.5"><Zap className="h-2.5 w-2.5" /> shock wave guaranteed</span>
          </div>
        )}
        {bandit.lastStrike && !bandit.active && (
          <div className="mt-1 font-mono text-[9px] text-zinc-600">
            last strike: {SIDE_STYLES[bandit.lastStrike.side].label} @ {(bandit.lastStrike.confidence * 100).toFixed(0)}% · {fmtTime(bandit.lastStrike.ts)}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
        <span className="uppercase tracking-wider">Total strikes</span>
        <span className="font-mono font-semibold tabular-nums text-amber-300">{bandit.strikeCount}</span>
      </div>
    </section>
  )
}
