// OMEGA Engine — Quantum Arsenal (Phase 6, Level 6 — 8 concepts)
//
// 1. Chronos Parasite — sniff institutional TWAP rhythm, front-run it (24bps)
// 2. Gamma Squeeze — options MM negative gamma, buy spot ahead of forced covering (180bps)
// 3. Event Horizon — force the cascade by selling brutally, TP at the bottom (200bps)
// 4. Iceberg Sonar — dust-order lidar maps hidden iceberg orders
// 5. CEX Inflow Vampire — cold wallet → exchange deposit, short before credited
// 6. Cross-Pair Liquidity Vacuum — DOGE pump drains ETH, short the drained
// 7. Exchange Engine Overload — API latency spike, fade trapped retail
// 8. Correlated Domino Matrix — SOL drops → DeFi liquidates WIF, short WIF

import type { QuantumArsenalState, QuantumWeaponState, CrowdState } from './types.ts'
import type { MarketTick } from './market-sim.ts'

export interface QuantumEvent {
  type: 'quantum_strike'
  message: string
  details: Record<string, unknown>
}

function baseWeapon(name: string): QuantumWeaponState {
  return { name, active: false, confidence: 0, takeProfitBps: 0, side: 'FLAT', detail: '', strikeCount: 0 }
}

export class QuantumArsenal {
  // 1. Chronos Parasite
  private chronos = { ...baseWeapon('Chronos Parasite'), twapDetected: false, twapIntervalMs: 0 }
  private twapBuys: number[] = []
  // 2. Gamma Squeeze
  private gamma = { ...baseWeapon('Gamma Squeeze'), gammaExposure: 0, optionsMmCovering: false }
  // 3. Event Horizon
  private eventHorizon = { ...baseWeapon('Event Horizon'), cascadeForced: false, priceImpactBps: 0 }
  // 4. Iceberg Sonar
  private iceberg = { ...baseWeapon('Iceberg Sonar'), hiddenSizeUsd: 0, surfaceSizeUsd: 0, icebergRatio: 0 }
  // 5. CEX Inflow Vampire
  private vampire = { ...baseWeapon('CEX Inflow Vampire'), inflowUsd: 0, confirmationsRemaining: 0 }
  private inflowCooldown = 0
  // 6. Cross-Pair Vacuum
  private vacuum = { ...baseWeapon('Cross-Pair Vacuum'), pumpSymbol: '', drainedSymbol: '', liquidityDrainPct: 0 }
  // 7. Exchange Overload
  private overload = { ...baseWeapon('Exchange Overload'), apiLatencyMs: 10, latencyThresholdMs: 500 }
  // 8. Correlated Domino
  private domino = { ...baseWeapon('Correlated Domino'), triggerSymbol: '', targetSymbol: '', collateralAtRiskUsd: 0 }

  update(tick: MarketTick, crowd: CrowdState, atrBps: number, cascadeActive: boolean): QuantumEvent[] {
    const events: QuantumEvent[] = []
    const now = tick.ts

    // ---- 1. Chronos Parasite: detect periodic TWAP buy pattern ----
    // Track timestamps of small consistent buys (simulated: when OBI > 0.3, a TWAP bot is buying)
    if (tick.obi > 0.3) this.twapBuys.push(now)
    this.twapBuys = this.twapBuys.filter((t) => now - t < 60000)
    if (this.twapBuys.length >= 5) {
      const intervals = this.twapBuys.slice(1).map((t, i) => t - this.twapBuys[i])
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const variance = intervals.reduce((a, b) => a + (b - avgInterval) ** 2, 0) / intervals.length
      // If intervals are consistent (low variance = TWAP), detect it
      if (variance < avgInterval * 0.3 && avgInterval > 500 && avgInterval < 10000) {
        this.chronos.twapDetected = true
        this.chronos.twapIntervalMs = Math.round(avgInterval)
        if (!this.chronos.active && Math.random() < 0.3) {
          this.chronos.active = true
          this.chronos.side = 'BUY'
          this.chronos.confidence = 0.96
          this.chronos.takeProfitBps = 24
          this.chronos.strikeCount++
          this.chronos.detail = `TWAP detected: ${Math.round(avgInterval)}ms interval. Front-running next buy.`
          events.push(this.emit('Chronos Parasite', 'BUY', 0.96, 24,
            `⏱️ CHRONOS PARASITE — Institutional TWAP sniffed (${Math.round(avgInterval)}ms interval, ${this.twapBuys.length} beats). Front-running next buy → BUY @ 96% conf, TP 24bps. Selling back to the TWAP bot seconds later.`))
        }
      } else {
        this.chronos.twapDetected = false
        this.chronos.active = false
      }
    } else {
      this.chronos.active = false
    }

    // ---- 2. Gamma Squeeze: options MM negative gamma → forced covering ----
    // Simulate gamma exposure: deeply negative when price approaches a large options strike
    this.gamma.gammaExposure = -Math.abs(tick.ret) * 5000 - Math.random() * 2000
    this.gamma.optionsMmCovering = this.gamma.gammaExposure < -3000
    if (this.gamma.optionsMmCovering && !this.gamma.active && Math.random() < 0.2) {
      this.gamma.active = true
      this.gamma.side = 'BUY'
      this.gamma.confidence = 0.88
      this.gamma.takeProfitBps = 180
      this.gamma.strikeCount++
      this.gamma.detail = `Gamma ${this.gamma.gammaExposure.toFixed(0)} → MM forced to buy spot`
      events.push(this.emit('Gamma Squeeze', 'BUY', 0.88, 180,
        `📈 GAMMA SQUEEZE — Options MM in negative gamma (exposure ${this.gamma.gammaExposure.toFixed(0)}). Forced to cover by buying spot. Front-running their covering → BUY @ 88% conf, TP 180bps. They ratchet our bags 180bps higher.`))
    } else if (!this.gamma.optionsMmCovering) {
      this.gamma.active = false
    }

    // ---- 3. Event Horizon: force the cascade ----
    // If a cascade is imminent (price near a liquidation cluster) and we have size,
    // SELL brutally to FORCE the cascade, then TP at the bottom
    if (cascadeActive && !this.eventHorizon.active && Math.random() < 0.15) {
      this.eventHorizon.active = true
      this.eventHorizon.cascadeForced = true
      this.eventHorizon.priceImpactBps = 10 + Math.random() * 15
      this.eventHorizon.side = 'SELL'
      this.eventHorizon.confidence = 0.99
      this.eventHorizon.takeProfitBps = 200
      this.eventHorizon.strikeCount++
      this.eventHorizon.detail = `Forced cascade +${this.eventHorizon.priceImpactBps.toFixed(0)}bps impact`
      events.push(this.emit('Event Horizon', 'SELL', 0.99, 200,
        `🕳️ EVENT HORIZON — Cascade imminent 10bps below. Not waiting. Brutal SELL to FORCE the cascade mathematically. TP widened to 200bps to catch the bottom of the liquidation black hole. The market falls into our trap.`))
    } else if (!cascadeActive) {
      this.eventHorizon.active = false
      this.eventHorizon.cascadeForced = false
    }

    // ---- 4. Iceberg Sonar: dust-order lidar ----
    // Send $1 market orders stroboscopically; if the wall recharges instantly without
    // price moving, it's an iceberg (hidden size behind a small surface)
    this.iceberg.surfaceSizeUsd = Math.abs(tick.obi) * 50000 + Math.random() * 20000
    this.iceberg.hiddenSizeUsd = Math.random() < 0.08 ? Math.random() * 5_000_000 : 0
    this.iceberg.icebergRatio = this.iceberg.surfaceSizeUsd > 0
      ? this.iceberg.hiddenSizeUsd / (this.iceberg.surfaceSizeUsd + this.iceberg.hiddenSizeUsd)
      : 0
    if (this.iceberg.hiddenSizeUsd > 1_000_000 && !this.iceberg.active) {
      this.iceberg.active = true
      this.iceberg.side = this.iceberg.hiddenSizeUsd > 0 && tick.obi > 0 ? 'SELL' : 'BUY'
      this.iceberg.confidence = 0.82
      this.iceberg.takeProfitBps = 45
      this.iceberg.strikeCount++
      this.iceberg.detail = `Iceberg mapped: $${(this.iceberg.hiddenSizeUsd / 1e6).toFixed(1)}M hidden behind $${(this.iceberg.surfaceSizeUsd / 1e3).toFixed(0)}K surface`
      events.push(this.emit('Iceberg Sonar', this.iceberg.side, 0.82, 45,
        `🧊 ICEBERG SONAR — Dust-order lidar mapped hidden iceberg: $${(this.iceberg.hiddenSizeUsd / 1e6).toFixed(1)}M hidden behind $${(this.iceberg.surfaceSizeUsd / 1e3).toFixed(0)}K surface (ratio ${(this.iceberg.icebergRatio * 100).toFixed(0)}%). Fading the hidden side → ${this.iceberg.side} @ 82% conf, TP 45bps.`))
    } else if (this.iceberg.hiddenSizeUsd < 500_000) {
      this.iceberg.active = false
    }

    // ---- 5. CEX Inflow Vampire: cold wallet → exchange deposit ----
    // Simulate: every ~60s a whale transfers BTC from cold storage to an exchange deposit addr
    this.inflowCooldown -= 1000
    if (this.inflowCooldown <= 0 && !this.vampire.active) {
      this.vampire.inflowUsd = 10_000_000 + Math.random() * 40_000_000
      this.vampire.confirmationsRemaining = 3 // Bitcoin needs 3 confs (~30min)
      this.vampire.active = true
      this.vampire.inflowCooldown = 60_000 + Math.random() * 60_000
    }
    if (this.vampire.active) {
      // At confirmation 2/3, strike (just before the whale can sell)
      if (this.vampire.confirmationsRemaining === 2) {
        this.vampire.side = 'SELL'
        this.vampire.confidence = 0.91
        this.vampire.takeProfitBps = 120
        this.vampire.strikeCount++
        this.vampire.detail = `$${(this.vampire.inflowUsd / 1e6).toFixed(1)}M BTC → exchange, 2/3 conf`
        events.push(this.emit('CEX Inflow Vampire', 'SELL', 0.91, 120,
          `🩸 CEX INFLOW VAMPIRE — $${(this.vampire.inflowUsd / 1e6).toFixed(1)}M BTC transferred from cold wallet to exchange deposit. 2/3 confirmations done (whale can't sell yet). SHORT now @ 91% conf, TP 120bps — front-running the whale's inevitable dump.`))
        this.vampire.confirmationsRemaining = 0
        this.vampire.active = false
      } else if (this.vampire.confirmationsRemaining > 0) {
        this.vampire.confirmationsRemaining--
      }
    }

    // ---- 6. Cross-Pair Liquidity Vacuum ----
    // If a meme pump starts on DOGE, HFT MMs withdraw liquidity from ETH/SOL to chase it
    if (Math.random() < 0.05 && !this.vacuum.active) {
      const pumps = [['DOGE-USDT', 'ETH-USDT'], ['PEPE-USDT', 'SOL-USDT'], ['WIF-USDT', 'LINK-USDT']]
      const [pump, drained] = pumps[Math.floor(Math.random() * pumps.length)]
      this.vacuum.pumpSymbol = pump
      this.vacuum.drainedSymbol = drained
      this.vacuum.liquidityDrainPct = 15 + Math.random() * 25
      this.vacuum.active = true
      this.vacuum.side = 'SELL'
      this.vacuum.confidence = 0.79
      this.vacuum.takeProfitBps = 60
      this.vacuum.strikeCount++
      this.vacuum.detail = `${pump} pumping → ${drained} liquidity drained ${this.vacuum.liquidityDrainPct.toFixed(0)}%`
      events.push(this.emit('Cross-Pair Vacuum', 'SELL', 0.79, 60,
        `🌀 CROSS-PAIR VACUUM — ${pump} pumping absurdly. HFT MMs withdrawing ${this.vacuum.liquidityDrainPct.toFixed(0)}% liquidity from ${drained} to chase the meme. ${drained} book is hollow → SHORT @ 79% conf, TP 60bps. Any seller collapses the thin book.`))
    } else if (Math.random() < 0.3) {
      this.vacuum.active = false
    }

    // ---- 7. Exchange Engine Overload ----
    // API latency spikes from 10ms → 800ms during flash crashes; retail can't cancel
    this.overload.apiLatencyMs = cascadeActive ? 300 + Math.random() * 600 : 10 + Math.random() * 30
    if (this.overload.apiLatencyMs > this.overload.latencyThresholdMs && !this.overload.active) {
      this.overload.active = true
      this.overload.side = tick.ret < 0 ? 'BUY' : 'SELL' // fade the trapped retail
      this.overload.confidence = 0.85
      this.overload.takeProfitBps = 80
      this.overload.strikeCount++
      this.overload.detail = `API latency ${this.overload.apiLatencyMs.toFixed(0)}ms > ${this.overload.latencyThresholdMs}ms threshold`
      events.push(this.emit('Exchange Overload', this.overload.side, 0.85, 80,
        `⚡ EXCHANGE OVERLOAD — Matching engine choking: API latency ${this.overload.apiLatencyMs.toFixed(0)}ms (threshold ${this.overload.latencyThresholdMs}ms). Retail cancel orders stuck in the pipe. Deploying aggressive limits in the air pockets → ${this.overload.side} @ 85% conf, TP 80bps. Stealing capital from trapped orders.`))
    } else if (this.overload.apiLatencyMs < 200) {
      this.overload.active = false
    }

    // ---- 8. Correlated Domino Matrix ----
    // SOL is collateral in DeFi for WIF loans. SOL drops 5% → WIF gets liquidated.
    // Short WIF the instant SOL coughs, without looking at WIF's chart.
    if (tick.ret < -0.003 && Math.random() < 0.2 && !this.domino.active) {
      const pairs = [['SOL', 'WIF'], ['ETH', 'PEPE'], ['BTC', 'MEME'], ['AVAX', 'DOGE']]
      const [trigger, target] = pairs[Math.floor(Math.random() * pairs.length)]
      this.domino.triggerSymbol = trigger
      this.domino.targetSymbol = target
      this.domino.collateralAtRiskUsd = 5_000_000 + Math.random() * 20_000_000
      this.domino.active = true
      this.domino.side = 'SELL'
      this.domino.confidence = 0.87
      this.domino.takeProfitBps = 150
      this.domino.strikeCount++
      this.domino.detail = `${trigger} dropped ${Math.abs(tick.ret * 100).toFixed(1)}% → ${target} DeFi collateral at risk $${(this.domino.collateralAtRiskUsd / 1e6).toFixed(1)}M`
      events.push(this.emit('Correlated Domino', 'SELL', 0.87, 150,
        `_domino️ CORRELATED DOMINO — ${trigger} coughed (${(tick.ret * 100).toFixed(2)}%). ${target} is collateralized in DeFi for $${(this.domino.collateralAtRiskUsd / 1e6).toFixed(1)}M. Smart contracts will liquidate ${target} mechanically. SHORT ${target} @ 87% conf, TP 150bps — without even looking at its chart.`))
    } else if (tick.ret > -0.001) {
      this.domino.active = false
    }

    return events
  }

  private emit(weapon: string, side: 'BUY' | 'SELL', conf: number, tp: number, msg: string): QuantumEvent {
    return {
      type: 'quantum_strike',
      message: msg,
      details: { weapon, side, confidence: conf, takeProfitBps: tp },
    }
  }

  state(): QuantumArsenalState {
    return {
      chronosParasite: { ...this.chronos },
      gammaSqueeze: { ...this.gamma },
      eventHorizon: { ...this.eventHorizon },
      icebergSonar: { ...this.iceberg },
      cexInflowVampire: { ...this.vampire },
      crossPairVacuum: { ...this.vacuum },
      exchangeOverload: { ...this.overload },
      correlatedDomino: { ...this.domino },
    }
  }
}
