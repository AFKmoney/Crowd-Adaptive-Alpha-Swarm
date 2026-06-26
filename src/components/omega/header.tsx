'use client'

import { Activity, Radio, Zap, Power } from 'lucide-react'
import type { OmegaState, LiveMode } from '@/lib/omega-types'
import { REGIME_STYLES, SIDE_STYLES, fmtPrice, fmtPct, fmtUptime } from './shared'

interface HeaderProps {
  state: OmegaState | null
  connected: boolean
}

const MODE_BADGE: Record<LiveMode, { text: string; bg: string; border: string; pulse: boolean }> = {
  sim: { text: 'text-zinc-300', bg: 'bg-zinc-700/60', border: 'border-zinc-600', pulse: false },
  testnet: { text: 'text-amber-300', bg: 'bg-amber-500/20', border: 'border-amber-500/50', pulse: true },
  mainnet: { text: 'text-rose-300', bg: 'bg-rose-500/20', border: 'border-rose-500/50', pulse: true },
}

export function Header({ state, connected }: HeaderProps) {
  const regime = state?.regime
  const regimeStyle = regime ? REGIME_STYLES[regime.current] : null
  const market = state?.market
  const change = market?.changePct24h ?? 0
  const consensus = state?.signals.consensus
  const consensusStyle = consensus ? SIDE_STYLES[consensus.side] : null
  const live = state?.live
  const modeBadge = live ? MODE_BADGE[live.mode] : null

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/85 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/70">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-fuchsia-500/30 to-amber-500/30 ring-1 ring-fuchsia-500/40">
            <span className="font-mono text-sm font-black tracking-tighter text-fuchsia-200">Ω</span>
          </div>
          <div className="leading-tight">
            <div className="font-mono text-sm font-bold tracking-wider text-zinc-100">OMEGA</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Crowd-Adaptive Alpha Swarm</div>
          </div>
        </div>

        {/* Connection */}
        <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1">
          <span className={`relative flex h-2 w-2 ${connected ? '' : 'opacity-50'}`}>
            {connected && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
          </span>
          <span className={`text-[11px] font-medium ${connected ? 'text-emerald-300' : 'text-zinc-500'}`}>
            {connected ? 'ENGINE LIVE' : 'RECONNECTING…'}
          </span>
        </div>

        {/* Mode badge (SIM / TESTNET / MAINNET) */}
        {modeBadge && live && (
          <div className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 ${modeBadge.bg} ${modeBadge.border}`}>
            <Power className={`h-3 w-3 ${modeBadge.text} ${modeBadge.pulse ? 'animate-pulse' : ''}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${modeBadge.text}`}>{live.mode}</span>
            {live.okxConnected && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
          </div>
        )}

        {/* Market ticker */}
        {market && (
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-xs text-zinc-500">{market.symbol}</span>
              <span className="font-mono text-base font-semibold tabular-nums text-zinc-100">${fmtPrice(market.price)}</span>
            </div>
            <span className={`font-mono text-xs font-medium tabular-nums ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fmtPct(change)}
            </span>
          </div>
        )}

        {/* Regime badge */}
        {regimeStyle && regime && (
          <div className={`flex items-center gap-2 rounded-md border px-2.5 py-1 ${regimeStyle.bg} ${regimeStyle.border}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${regimeStyle.text}`}>{regimeStyle.label}</span>
            <span className="text-[10px] text-zinc-500">conf {(regime.confidence * 100).toFixed(0)}%</span>
          </div>
        )}

        {/* Consensus */}
        {consensusStyle && consensus && (
          <div className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 ${consensusStyle.bg} ${consensusStyle.border}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${consensusStyle.dot}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${consensusStyle.text}`}>
              {consensusStyle.label}
            </span>
            <span className="text-[10px] text-zinc-500">@ {(consensus.confidence * 100).toFixed(0)}%</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-4 text-[11px] text-zinc-500">
          {state && (
            <>
              <span className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-amber-400" />
                <span className="tabular-nums">{state.stats.extremeCount} extremes</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-fuchsia-400" />
                <span className="tabular-nums">{state.stats.reconfigCount} reconfigs</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Radio className="h-3 w-3 text-teal-400" />
                <span className="tabular-nums">{fmtUptime(state.stats.uptime)}</span>
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
