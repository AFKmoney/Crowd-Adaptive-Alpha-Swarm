'use client'

import { Brain, Shield, Scale, Globe, Crosshair, RefreshCw } from 'lucide-react'
import type { OmegaState } from '@/lib/omega-types'

interface EliteBrainPanelProps {
  state: OmegaState
}

const ACTION_STYLES: Record<string, { text: string; bg: string; border: string; icon: string }> = {
  trade: { text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/50', icon: '🟢' },
  wait: { text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/50', icon: '🟡' },
  reduce: { text: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-500/50', icon: '🟠' },
  hedge: { text: 'text-violet-300', bg: 'bg-violet-500/15', border: 'border-violet-500/50', icon: '🟣' },
  halt: { text: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/50', icon: '🔴' },
}

const TIER_STYLES: Record<string, string> = {
  exploratory: 'text-zinc-400',
  tactical: 'text-sky-300',
  conviction: 'text-amber-300',
  maximum: 'text-emerald-300',
}

const CONTEXT_STYLES: Record<string, string> = {
  accumulation: 'text-zinc-300',
  markup: 'text-emerald-300',
  distribution: 'text-amber-300',
  decline: 'text-rose-300',
  crisis: 'text-rose-400',
  recovery: 'text-teal-300',
}

export function EliteBrainPanel({ state }: EliteBrainPanelProps) {
  const eb = (state as any).eliteBrain
  if (!eb) return null

  const actionStyle = ACTION_STYLES[eb.finalDecision?.action] || ACTION_STYLES.wait
  const convictionStyle = TIER_STYLES[eb.conviction?.tier] || 'text-zinc-400'
  const contextStyle = CONTEXT_STYLES[eb.context?.context] || 'text-zinc-400'

  return (
    <section className="rounded-xl border border-violet-500/30 bg-zinc-900/40 p-4 backdrop-blur-sm sm:p-5 shadow-[0_0_20px_rgba(167,139,250,0.08)]">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-400" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">Elite Trader Brain</h2>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">5-Pillar Decision Engine</span>
        </div>
        {/* Final decision badge */}
        <div className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 ${actionStyle.bg} ${actionStyle.border}`}>
          <span className="text-xs">{actionStyle.icon}</span>
          <span className={`text-[11px] font-bold uppercase tracking-wider ${actionStyle.text}`}>
            {eb.finalDecision?.action}
          </span>
        </div>
      </div>

      {/* Final decision bar */}
      <div className={`mb-3 rounded-lg border px-3 py-2 ${actionStyle.bg} ${actionStyle.border}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className={`font-mono text-lg font-black ${actionStyle.text}`}>
              {eb.finalDecision?.action.toUpperCase()}
            </span>
            <span className="ml-2 font-mono text-sm text-zinc-300">
              ${eb.finalDecision?.adjustedSizeUsd?.toFixed(2)}
            </span>
            <span className="ml-1 text-[10px] text-zinc-500">
              ({(eb.finalDecision?.adjustedSizePct * 100)?.toFixed(0)}% of capital)
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px]">
            <span className="text-zinc-400">conf <span className={actionStyle.text}>{(eb.finalDecision?.finalConfidence * 100)?.toFixed(0)}%</span></span>
            <span className="text-zinc-400">exec <span className="text-teal-300">{eb.execution?.strategy}</span></span>
          </div>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-zinc-400">{eb.finalDecision?.reason}</p>
      </div>

      {/* 5 Pillars grid */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-5">
        {/* Pillar 1: Risk-First */}
        <div className={`rounded-lg border p-2.5 ${eb.tailRisk?.tailEventActive ? 'border-rose-500/40 bg-rose-500/5' : 'border-zinc-800 bg-zinc-900/40'}`}>
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
            <Shield className="h-3 w-3" /> 1. Risk-First
          </div>
          <div className="mt-1 space-y-0.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Survival</span>
              <span className={`font-mono font-bold ${(eb.tailRisk?.survivalProbability * 100) > 80 ? 'text-emerald-300' : 'text-amber-300'}`}>
                {(eb.tailRisk?.survivalProbability * 100)?.toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Max loss</span>
              <span className="font-mono text-zinc-300">{(eb.tailRisk?.maxLossPct * 100)?.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Tail event</span>
              <span className={`font-mono ${eb.tailRisk?.tailEventActive ? 'text-rose-300' : 'text-zinc-500'}`}>
                {eb.tailRisk?.tailEventActive ? '⚠️ ACTIVE' : 'normal'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Recovery</span>
              <span className={`font-mono ${eb.drawdownRecovery?.inRecoveryMode ? 'text-amber-300' : 'text-emerald-300'}`}>
                {eb.drawdownRecovery?.inRecoveryMode ? `${(eb.drawdownRecovery?.sizeMultiplier * 100)?.toFixed(0)}%` : 'full'}
              </span>
            </div>
          </div>
          <p className="mt-1 text-[9px] leading-tight text-zinc-600">{eb.tailRisk?.reason}</p>
        </div>

        {/* Pillar 2: Conviction Sizing */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
            <Scale className="h-3 w-3" /> 2. Conviction
          </div>
          <div className="mt-1 space-y-0.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Tier</span>
              <span className={`font-mono font-bold ${convictionStyle}`}>
                {eb.conviction?.tier?.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Raw score</span>
              <span className="font-mono text-zinc-300">{(eb.conviction?.rawScore * 100)?.toFixed(0)}%</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Confirmations</span>
              <span className="font-mono text-zinc-300">{eb.conviction?.confirmations}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Multiplier</span>
              <span className="font-mono font-bold text-violet-300">{eb.conviction?.convictionMultiplier?.toFixed(1)}x</span>
            </div>
          </div>
          <p className="mt-1 text-[9px] leading-tight text-zinc-600">{eb.conviction?.reason}</p>
        </div>

        {/* Pillar 3: Market Context */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
            <Globe className="h-3 w-3" /> 3. Context
          </div>
          <div className="mt-1 space-y-0.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Phase</span>
              <span className={`font-mono font-bold ${contextStyle}`}>{eb.context?.context}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Session</span>
              <span className="font-mono text-zinc-300">{eb.context?.session}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Liquidity</span>
              <span className="font-mono text-zinc-300">{eb.context?.liquidityCondition}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Filter</span>
              <span className={`font-mono ${(eb.context?.signalFilter || 1) >= 1 ? 'text-emerald-300' : 'text-amber-300'}`}>
                ×{eb.context?.signalFilter?.toFixed(2)}
              </span>
            </div>
          </div>
          <p className="mt-1 text-[9px] leading-tight text-zinc-600">{eb.context?.reason}</p>
        </div>

        {/* Pillar 4: Execution Intelligence */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
            <Crosshair className="h-3 w-3" /> 4. Execution
          </div>
          <div className="mt-1 space-y-0.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Strategy</span>
              <span className="font-mono font-bold text-teal-300">{eb.execution?.strategy}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Slices</span>
              <span className="font-mono text-zinc-300">{eb.execution?.slices}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Slippage</span>
              <span className={`font-mono ${(eb.execution?.slippagePredictionBps || 0) > 10 ? 'text-rose-300' : 'text-emerald-300'}`}>
                {eb.execution?.slippagePredictionBps}bps
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Adverse</span>
              <span className={`font-mono ${(eb.execution?.adverseSelectionRisk || 0) > 0.5 ? 'text-rose-300' : 'text-zinc-300'}`}>
                {(eb.execution?.adverseSelectionRisk * 100)?.toFixed(0)}%
              </span>
            </div>
          </div>
          <p className="mt-1 text-[9px] leading-tight text-zinc-600">{eb.execution?.reason}</p>
        </div>

        {/* Pillar 5: Meta-Cognition */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
            <RefreshCw className="h-3 w-3" /> 5. Meta-Cognition
          </div>
          <div className="mt-1 space-y-0.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Profit factor</span>
              <span className={`font-mono font-bold ${(eb.attribution?.profitFactor || 0) > 1.5 ? 'text-emerald-300' : (eb.attribution?.profitFactor || 0) < 1 ? 'text-rose-300' : 'text-amber-300'}`}>
                {(eb.attribution?.profitFactor || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Trades</span>
              <span className="font-mono text-zinc-300">{eb.attribution?.totalTrades}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Win rate</span>
              <span className="font-mono text-zinc-300">
                {eb.attribution?.totalTrades > 0 ? ((eb.attribution?.wins / eb.attribution?.totalTrades) * 100)?.toFixed(0) + '%' : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Edge</span>
              <span className={`font-mono ${(eb.attribution?.edgeDecay || 1) > 0.7 ? 'text-emerald-300' : 'text-amber-300'}`}>
                {(eb.attribution?.edgeDecay * 100)?.toFixed(0)}%
              </span>
            </div>
          </div>
          <p className="mt-1 text-[9px] leading-tight text-zinc-600">{eb.attribution?.diagnosis}</p>
          {eb.attribution?.recommendedAdjustment && (
            <p className="mt-0.5 text-[9px] leading-tight text-violet-400">→ {eb.attribution?.recommendedAdjustment}</p>
          )}
        </div>
      </div>
    </section>
  )
}
