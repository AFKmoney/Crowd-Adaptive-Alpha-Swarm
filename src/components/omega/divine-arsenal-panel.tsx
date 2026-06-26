'use client'

import { Skull, Ghost, Music, Pill, Clock, Zap, Sun, Radar, ArrowDownToLine, Network, Server, Link2 } from 'lucide-react'
import type {
  WallBreakerState,
  GhostProtocolState,
  SymphonyVectorState,
  PoisonPillState,
  QuantumArsenalState,
  Side,
} from '@/lib/omega-types'
import { SIDE_STYLES } from './shared'

interface DivineArsenalProps {
  wallBreaker: WallBreakerState
  ghostProtocol: GhostProtocolState
  symphonyVector: SymphonyVectorState
  poisonPill: PoisonPillState
  quantumArsenal: QuantumArsenalState
}

interface WeaponCardProps {
  name: string
  icon: React.ReactNode
  tier: string
  active: boolean
  side: Side
  confidence: number
  tpBps: number
  strikes: number
  detail: string
  accent: string
}

function WeaponCard({ name, icon, tier, active, side, confidence, tpBps, strikes, detail, accent }: WeaponCardProps) {
  const style = SIDE_STYLES[side]
  return (
    <div className={`rounded-lg border p-2.5 transition-all ${
      active ? `border-transparent ring-1 ${accent} shadow-[0_0_12px_currentColor]` : 'border-zinc-800 bg-zinc-900/30'
    }`} style={active ? { boxShadow: `0 0 12px ${accent.includes('emerald') ? 'rgba(52,211,153,0.3)' : accent.includes('rose') ? 'rgba(251,113,133,0.3)' : 'rgba(167,139,250,0.3)'}` } : {}}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={active ? '' : 'text-zinc-500'}>{icon}</span>
          <span className={`text-[10px] font-bold uppercase tracking-wide ${active ? 'text-zinc-100' : 'text-zinc-400'}`}>{name}</span>
        </div>
        <span className="text-[8px] uppercase tracking-wider text-zinc-600">{tier}</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        {active ? (
          <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold ${style.bg} ${style.border} ${style.text}`}>
            <span className="h-1 w-1 animate-pulse rounded-full bg-current" /> {style.label} {(confidence * 100).toFixed(0)}%
          </span>
        ) : (
          <span className="text-[9px] text-zinc-600">idle</span>
        )}
        <span className="font-mono text-[9px] tabular-nums text-zinc-500">⚡{strikes}</span>
      </div>
      {active && (
        <>
          <p className="mt-1 text-[9px] leading-tight text-zinc-400">{detail}</p>
          <span className="mt-0.5 block font-mono text-[9px] text-amber-300">TP {tpBps}bps</span>
        </>
      )}
    </div>
  )
}

export function DivineArsenalPanel({ wallBreaker, ghostProtocol, symphonyVector, poisonPill, quantumArsenal }: DivineArsenalProps) {
  const qa = quantumArsenal
  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 backdrop-blur-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skull className="h-4 w-4 text-violet-400" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">Divine Arsenal</h2>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">12 weapons · Hors Dogme</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Phase 4 · 5 · 6</span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
        {/* Phase 4 — Divine Level */}
        <WeaponCard
          name="Wall Breaker" icon={<Sun className="h-3.5 w-3.5 text-amber-400" />} tier="P4"
          active={wallBreaker.active} side={wallBreaker.side} confidence={wallBreaker.confidence}
          tpBps={wallBreaker.takeProfitBps} strikes={wallBreaker.strikeCount}
          detail={`Exhaustion ${(wallBreaker.exhaustion * 100).toFixed(0)}% — retail trapped against wall, SELL into their backs`}
          accent="text-amber-400"
        />
        <WeaponCard
          name="Ghost Protocol" icon={<Ghost className="h-3.5 w-3.5 text-zinc-300" />} tier="P4"
          active={ghostProtocol.active} side={ghostProtocol.swept ? 'BUY' : 'FLAT'} confidence={0.9}
          tpBps={Math.round(ghostProtocol.rebondTargetPct * 100)} strikes={ghostProtocol.strikeCount}
          detail={`Spread ${ghostProtocol.spreadBps.toFixed(1)}bps — MM bots disconnected, sweeping empty book +${ghostProtocol.rebondTargetPct}%`}
          accent="text-zinc-300"
        />
        <WeaponCard
          name="Symphony Vector" icon={<Music className="h-3.5 w-3.5 text-teal-400" />} tier="P4"
          active={symphonyVector.active} side={symphonyVector.btcOracleSignal > 0 ? 'BUY' : 'SELL'} confidence={Math.abs(symphonyVector.btcOracleSignal)}
          tpBps={0} strikes={symphonyVector.strikeCount}
          detail={`BTC oracle ${symphonyVector.btcOracleSignal.toFixed(2)} → ${symphonyVector.altcoins.filter(a=>a.gridDeployed).length} altcoin grids (4x amplified)`}
          accent="text-teal-400"
        />
        <WeaponCard
          name="Poison Pill" icon={<Pill className="h-3.5 w-3.5 text-fuchsia-400" />} tier="P4"
          active={poisonPill.active} side="SELL" confidence={0.95}
          tpBps={0} strikes={poisonPill.strikeCount}
          detail={poisonPill.pendingWhaleTx ? `Whale ${poisonPill.pendingWhaleTx.chain} ${(poisonPill.pendingWhaleTx.amountUsd/1e6).toFixed(1)}M via ${poisonPill.pendingWhaleTx.dex} — short before CEX reacts` : 'Mempool monitoring for whale DEX sales'}
          accent="text-fuchsia-400"
        />

        {/* Phase 5 — Niveau Supérieur */}
        <WeaponCard
          name="Chronos Parasite" icon={<Clock className="h-3.5 w-3.5 text-sky-400" />} tier="P5"
          active={qa.chronosParasite.active} side={qa.chronosParasite.side} confidence={qa.chronosParasite.confidence}
          tpBps={qa.chronosParasite.takeProfitBps} strikes={qa.chronosParasite.strikeCount}
          detail={qa.chronosParasite.detail || `TWAP ${qa.chronosParasite.twapIntervalMs}ms detected — front-running institutional rhythm`}
          accent="text-sky-400"
        />
        <WeaponCard
          name="Gamma Squeeze" icon={<Zap className="h-3.5 w-3.5 text-orange-400" />} tier="P5"
          active={qa.gammaSqueeze.active} side={qa.gammaSqueeze.side} confidence={qa.gammaSqueeze.confidence}
          tpBps={qa.gammaSqueeze.takeProfitBps} strikes={qa.gammaSqueeze.strikeCount}
          detail={qa.gammaSqueeze.detail || `Gamma ${qa.gammaSqueeze.gammaExposure.toFixed(2)} — options MM forced to cover`}
          accent="text-orange-400"
        />
        <WeaponCard
          name="Event Horizon" icon={<Skull className="h-3.5 w-3.5 text-rose-400" />} tier="P5"
          active={qa.eventHorizon.active} side={qa.eventHorizon.side} confidence={qa.eventHorizon.confidence}
          tpBps={qa.eventHorizon.takeProfitBps} strikes={qa.eventHorizon.strikeCount}
          detail={qa.eventHorizon.detail || `Forcing cascade — brutal SELL to trigger liquidations, TP at the bottom`}
          accent="text-rose-400"
        />

        {/* Level 6 — Architecture Quantique */}
        <WeaponCard
          name="Iceberg Sonar" icon={<Radar className="h-3.5 w-3.5 text-cyan-400" />} tier="L6"
          active={qa.icebergSonar.active} side={qa.icebergSonar.side} confidence={qa.icebergSonar.confidence}
          tpBps={qa.icebergSonar.takeProfitBps} strikes={qa.icebergSonar.strikeCount}
          detail={qa.icebergSonar.detail || `Hidden ${(qa.icebergSonar.hiddenSizeUsd/1e6).toFixed(1)}M vs surface ${(qa.icebergSonar.surfaceSizeUsd/1e3).toFixed(0)}K — ratio ${(qa.icebergSonar.icebergRatio*100).toFixed(0)}%`}
          accent="text-cyan-400"
        />
        <WeaponCard
          name="CEX Inflow Vampire" icon={<ArrowDownToLine className="h-3.5 w-3.5 text-red-400" />} tier="L6"
          active={qa.cexInflowVampire.active} side={qa.cexInflowVampire.side} confidence={qa.cexInflowVampire.confidence}
          tpBps={qa.cexInflowVampire.takeProfitBps} strikes={qa.cexInflowVampire.strikeCount}
          detail={qa.cexInflowVampire.detail || `Inflow ${(qa.cexInflowVampire.inflowUsd/1e6).toFixed(1)}M → exchange, ${qa.cexInflowVampire.confirmationsRemaining} confs left before credit`}
          accent="text-red-400"
        />
        <WeaponCard
          name="Cross-Pair Vacuum" icon={<Network className="h-3.5 w-3.5 text-indigo-400" />} tier="L6"
          active={qa.crossPairVacuum.active} side={qa.crossPairVacuum.side} confidence={qa.crossPairVacuum.confidence}
          tpBps={qa.crossPairVacuum.takeProfitBps} strikes={qa.crossPairVacuum.strikeCount}
          detail={qa.crossPairVacuum.detail || `${qa.crossPairVacuum.pumpSymbol} pump draining ${qa.crossPairVacuum.drainedSymbol} liquidity ${(qa.crossPairVacuum.liquidityDrainPct*100).toFixed(0)}%`}
          accent="text-indigo-400"
        />
        <WeaponCard
          name="Engine Overload" icon={<Server className="h-3.5 w-3.5 text-yellow-400" />} tier="L6"
          active={qa.exchangeOverload.active} side={qa.exchangeOverload.side} confidence={qa.exchangeOverload.confidence}
          tpBps={qa.exchangeOverload.takeProfitBps} strikes={qa.exchangeOverload.strikeCount}
          detail={qa.exchangeOverload.detail || `API latency ${qa.exchangeOverload.apiLatencyMs}ms (threshold ${qa.exchangeOverload.latencyThresholdMs}ms) — fading trapped retail`}
          accent="text-yellow-400"
        />
        <WeaponCard
          name="Correlated Domino" icon={<Link2 className="h-3.5 w-3.5 text-purple-400" />} tier="L6"
          active={qa.correlatedDomino.active} side={qa.correlatedDomino.side} confidence={qa.correlatedDomino.confidence}
          tpBps={qa.correlatedDomino.takeProfitBps} strikes={qa.correlatedDomino.strikeCount}
          detail={qa.correlatedDomino.detail || `${qa.correlatedDomino.triggerSymbol} drop → DeFi liquidates ${qa.correlatedDomino.targetSymbol}, collateral at risk $${(qa.correlatedDomino.collateralAtRiskUsd/1e6).toFixed(1)}M`}
          accent="text-purple-400"
        />
      </div>
    </section>
  )
}
