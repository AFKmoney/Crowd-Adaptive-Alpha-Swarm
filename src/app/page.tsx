'use client'

import { useOmegaEngine } from '@/hooks/use-omega-engine'
import { Header } from '@/components/omega/header'
import { CrowdPanel } from '@/components/omega/crowd-panel'
import { WeightsPanel } from '@/components/omega/weights-panel'
import { SwarmPanel } from '@/components/omega/swarm-panel'
import { DebatePanel } from '@/components/omega/debate-panel'
import { WeightHistoryChart } from '@/components/omega/weight-history-chart'
import { EventLog } from '@/components/omega/event-log'
import { PriceChart } from '@/components/omega/price-chart'
import { LiquidationPanel } from '@/components/omega/liquidation-panel'
import { OrderBookPanel } from '@/components/omega/order-book-panel'
import { MicrostructurePanel } from '@/components/omega/microstructure-panel'
import { RiskPanel } from '@/components/omega/risk-panel'
import { ExecutionPanel } from '@/components/omega/execution-panel'
import { CrystalBallPanel } from '@/components/omega/crystal-ball-panel'
import { Sparkles } from 'lucide-react'

export default function Home() {
  const { state, connected, events, weightHistory, candleHistory } = useOmegaEngine()

  const pos = state?.risk.position
  const entry = pos?.entryPrice
  const tp = pos ? pos.entryPrice * (1 + (pos.side === 'BUY' ? 1 : -1) * pos.takeProfitBps / 10000) : undefined
  const sl = pos ? pos.entryPrice * (1 + (pos.side === 'BUY' ? 1 : -1) * -pos.stopLossBps / 10000) : undefined

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Ambient gradient background (glassmorphism base) */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-teal-500/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <Header state={state} connected={connected} />

        {/* Feature banner */}
        <div className="border-b border-zinc-800/60 bg-gradient-to-r from-fuchsia-500/10 via-teal-500/5 to-transparent backdrop-blur-sm">
          <div className="mx-auto flex max-w-[1700px] items-center gap-2 px-4 py-2 sm:px-6">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-fuchsia-400" />
            <p className="text-[11px] leading-snug text-zinc-400">
              <span className="font-semibold text-zinc-200">PROJECT TITAN</span> — ⏳ Time-Bandit (Boule de Cristal) · Liquidation Sniper · Maker-Grid · ATR-dynamic TP/SL · Order Book Wall/Spoofing · Toxic Flow Vampire · Cross-Exchange Domino · Hors-Dogme Override
            </p>
          </div>
        </div>

        <main className="mx-auto w-full max-w-[1700px] flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-5">
          {/* Row 1 — Price chart + Crowd panel */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {state ? (
                <PriceChart candles={candleHistory} positionPrice={entry} takeProfit={tp} stopLoss={sl} />
              ) : (
                <Skeleton className="h-[320px]" />
              )}
            </div>
            {state ? <CrowdPanel crowd={state.crowd} /> : <Skeleton className="h-[320px]" />}
          </div>

          {/* Row 2 — Crystal Ball + Liquidation + Order Book + Microstructure (the prescience row) */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {state ? <CrystalBallPanel crystal={state.crystalBall} bandit={state.timeBandit} /> : <Skeleton className="h-[400px]" />}
            {state ? <LiquidationPanel liq={state.liquidations} /> : <Skeleton className="h-[400px]" />}
            {state ? <OrderBookPanel ob={state.orderBook} /> : <Skeleton className="h-[400px]" />}
            {state ? <MicrostructurePanel toxic={state.toxicFlow} venues={state.venues} domino={state.domino} /> : <Skeleton className="h-[400px]" />}
          </div>

          {/* Row 3 — Weights + Swarm + Risk */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {state ? <WeightsPanel weights={state.weights} /> : <Skeleton className="h-[440px]" />}
            {state ? <SwarmPanel signals={state.signals} /> : <Skeleton className="h-[440px]" />}
            {state ? <RiskPanel risk={state.risk} volRegime={state.atr.volatilityRegime} /> : <Skeleton className="h-[440px]" />}
          </div>

          {/* Row 4 — Weight history + Debate + Execution */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {weightHistory.length > 0 ? (
              <WeightHistoryChart history={weightHistory} />
            ) : (
              <Skeleton className="h-[300px]" />
            )}
            {state ? (
              <DebatePanel consensus={state.signals.consensus} agents={state.signals.agents} />
            ) : (
              <Skeleton className="h-[300px]" />
            )}
            {state ? <ExecutionPanel exec={state.execution} /> : <Skeleton className="h-[300px]" />}
          </div>

          {/* Row 5 — Event log full width */}
          <EventLog events={events} />
        </main>

        <footer className="mt-auto border-t border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm">
          <div className="mx-auto flex max-w-[1700px] flex-wrap items-center justify-between gap-2 px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 sm:px-6">
            <span className="font-mono">OMEGA · Project TITAN · Crowd-Adaptive Alpha Swarm</span>
            <span className="font-mono">Hors-Dogme · Maker-Grid · Liquidation Sniper · Cross-Exchange Domino</span>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 3px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #52525b; }
        @media (max-width: 640px) {
          h2 { font-size: 0.7rem; letter-spacing: 0.05em !important; }
        }
      `}</style>
    </div>
  )
}

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-sm ${className}`}>
      <div className="flex h-full items-center justify-center text-[11px] text-zinc-600">
        awaiting engine stream…
      </div>
    </div>
  )
}
