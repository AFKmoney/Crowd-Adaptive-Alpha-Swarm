'use client'

import { Shield, ShieldAlert, Flame, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import type { RiskState } from '@/lib/omega-types'
import { SIDE_STYLES, VOL_REGIME_STYLES, fmtPrice, fmtUptime } from './shared'

interface RiskPanelProps {
  risk: RiskState
  volRegime: string
}

export function RiskPanel({ risk, volRegime }: RiskPanelProps) {
  const ddPct = risk.drawdownPct * 100
  const hardStop = risk.hardStopActive
  const pos = risk.position
  const dec = risk.lastDecision
  const volStyle = VOL_REGIME_STYLES[volRegime] || VOL_REGIME_STYLES.normal
  const pnlColor = risk.realizedPnlUsd >= 0 ? 'text-emerald-300' : 'text-rose-300'

  return (
    <section className="flex h-full flex-col rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 backdrop-blur-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-teal-400" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">Risk Aegis</h2>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Hors-Dogme Shield</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${volStyle.bg} ${volStyle.border} ${volStyle.text}`}>
            VOL {volStyle.label}
          </span>
          {hardStop ? (
            <span className="flex items-center gap-1 rounded-md border border-rose-500/50 bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-300">
              <ShieldAlert className="h-2.5 w-2.5" /> HARD STOP
            </span>
          ) : (
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
              ARMED
            </span>
          )}
        </div>
      </div>

      {/* Equity + drawdown */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-zinc-500">Equity</div>
          <div className="font-mono text-sm font-bold tabular-nums text-zinc-100">${fmtPrice(risk.equity)}</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-zinc-500">Daily DD</div>
          <div className={`font-mono text-sm font-bold tabular-nums ${ddPct <= -3 ? 'text-rose-300' : ddPct < 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
            {ddPct >= 0 ? '+' : ''}{ddPct.toFixed(2)}%
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-zinc-500">Realized</div>
          <div className={`font-mono text-sm font-bold tabular-nums ${pnlColor}`}>
            {risk.realizedPnlUsd >= 0 ? '+' : ''}${risk.realizedPnlUsd.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Drawdown bar with -3% threshold */}
      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500">
          <span>Daily Drawdown</span>
          <span className="font-mono tabular-nums">threshold -3.00%</span>
        </div>
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className="absolute inset-y-0 left-1/2 w-px bg-zinc-600" />
          <div className="absolute inset-y-0 bg-rose-500/15" style={{ left: `${50 + (3 / 10) * 50}%`, right: '0%' }} />
          <div
            className={`absolute top-1/2 h-3.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${hardStop ? 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]' : ddPct < 0 ? 'bg-amber-400' : 'bg-emerald-400'}`}
            style={{ left: `${50 + Math.max(-5, Math.min(5, ddPct)) / 5 * 50}%` }}
          />
        </div>
      </div>

      {/* Open position */}
      {pos ? (
        <div className="mt-2.5 rounded-lg border border-teal-500/30 bg-teal-500/5 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {pos.side === 'BUY' ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> : <TrendingDown className="h-3.5 w-3.5 text-rose-400" />}
              <span className={`font-mono text-xs font-bold ${SIDE_STYLES[pos.side].text}`}>{SIDE_STYLES[pos.side].label}</span>
              <span className="text-[10px] text-zinc-500">{pos.isContrarian && <span className="rounded bg-fuchsia-500/20 px-1 text-fuchsia-300">CONTRARIAN</span>}</span>
            </div>
            <span className={`font-mono text-xs font-semibold tabular-nums ${pos.unrealizedPnlUsd >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {pos.unrealizedPnlUsd >= 0 ? '+' : ''}${pos.unrealizedPnlUsd.toFixed(2)} ({(pos.unrealizedPnlPct * 100).toFixed(2)}%)
            </span>
          </div>
          <div className="mt-1.5 grid grid-cols-4 gap-2 font-mono text-[10px] tabular-nums text-zinc-400">
            <span>size <span className="text-zinc-200">${pos.sizeUsd.toFixed(0)}</span></span>
            <span>entry <span className="text-zinc-200">${fmtPrice(pos.entryPrice)}</span></span>
            <span>TP <span className="text-emerald-300">{pos.takeProfitBps}bps</span></span>
            <span>SL <span className="text-rose-300">{pos.stopLossBps}bps</span></span>
          </div>
          <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-zinc-500">
            <span>RR <span className="text-teal-300">{pos.rrRatio.toFixed(1)}:1</span></span>
            <span>Kelly <span className="text-zinc-300">{(pos.kellyFraction * 100).toFixed(1)}%</span></span>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-center text-[11px] text-zinc-600">
          No open position
        </div>
      )}

      {/* Last decision */}
      {dec && (
        <div className={`mt-2 rounded-md border px-2.5 py-1.5 text-[10px] ${
          dec.action === 'override_hors_dogme' ? 'border-rose-500/40 bg-rose-500/10' :
          dec.action === 'blocked_hard_stop' ? 'border-rose-500/30 bg-rose-500/5' :
          dec.action === 'allow' ? 'border-emerald-500/30 bg-emerald-500/5' :
          'border-zinc-800 bg-zinc-900/40'
        }`}>
          <span className="font-mono uppercase tracking-wider text-zinc-500">{dec.action.replace(/_/g, ' ')}</span>
          <span className="ml-1.5 text-zinc-300">{dec.rationale.slice(0, 90)}</span>
        </div>
      )}

      {/* Stats footer */}
      <div className="mt-auto grid grid-cols-4 gap-2 border-t border-zinc-800 pt-2 text-center">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-zinc-500">Overrides</div>
          <div className="font-mono text-xs font-bold tabular-nums text-rose-300">{risk.horsDogmeOverrides}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-zinc-500">Blocks</div>
          <div className="font-mono text-xs font-bold tabular-nums text-amber-300">{risk.hardStopBlocks}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-zinc-500">Trades</div>
          <div className="font-mono text-xs font-bold tabular-nums text-zinc-200">{risk.trades}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-zinc-500">Win %</div>
          <div className="font-mono text-xs font-bold tabular-nums text-emerald-300">{(risk.winRate * 100).toFixed(0)}%</div>
        </div>
      </div>
    </section>
  )
}

void fmtUptime
void Flame
void Activity
