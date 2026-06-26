// OMEGA Engine — simulated market microstructure
// A regime-switching mean-reverting random walk for BTCUSDT that produces
// believable trends, chops, and spikes so the crowd engine has something to overreact to.

import type { Regime } from './types.ts'

export interface MarketTick {
  ts: number
  price: number
  ret: number // bar log return
  vol20: number // 20-bar realized volatility (annualized-ish)
  rsi14: number // 0..100
  bbPos: number // bollinger position 0..1 (0 = lower band, 1 = upper)
  obi: number // order book imbalance -1..1
}

const START_PRICE = 68000
const BAR_MS = 1000 // 1 bar per second

// Regime drift + vol parameters
const REGIME_PARAMS: Record<Regime, { drift: number; vol: number; meanRev: number }> = {
  calm_bull: { drift: 0.00045, vol: 0.0011, meanRev: 0.02 },
  volatile_bull: { drift: 0.0008, vol: 0.0028, meanRev: 0.01 },
  choppy: { drift: 0.0, vol: 0.0016, meanRev: 0.18 },
  bear: { drift: -0.0009, vol: 0.0032, meanRev: 0.04 },
}

export class MarketSim {
  price = START_PRICE
  ret = 0
  ts = Date.now()
  private bars: number[] = [] // recent returns
  private prices: number[] = [] // recent prices
  private peak24h = START_PRICE
  private obi = 0
  private regime: Regime = 'calm_bull'

  setRegime(r: Regime) {
    this.regime = r
  }

  /** Advance one bar. Returns the new tick. */
  step(): MarketTick {
    this.ts = Date.now()
    const p = REGIME_PARAMS[this.regime]

    // Mean-reverting Ornstein-Uhlenbeck-ish component around a drifting mean
    const shock = gaussian() * p.vol
    const meanRevPull = (Math.log(START_PRICE) - Math.log(this.price)) * p.meanRev
    const drift = p.drift + meanRevPull
    this.ret = drift + shock

    // Occasional crowd-driven spike (3% chance of a larger move) — feeds extremes
    if (Math.random() < 0.03) {
      const spikeDir = Math.random() < 0.5 ? -1 : 1
      this.ret += spikeDir * (p.vol * (2.5 + Math.random() * 2))
    }

    this.price = Math.max(100, this.price * Math.exp(this.ret))

    this.bars.push(this.ret)
    if (this.bars.length > 40) this.bars.shift()
    this.prices.push(this.price)
    if (this.prices.length > 60) this.prices.shift()

    // 24h-ish peak tracking (use rolling window of prices)
    this.peak24h = Math.max(...this.prices, this.price)

    // OBI mean-reverts, but leans with recent momentum (crowd piles in)
    const momentum = this.bars.slice(-5).reduce((a, b) => a + b, 0)
    this.obi = clamp(this.obi * 0.7 + momentum * 40 + gaussian() * 0.1, -1, 1)

    return this.tick()
  }

  tick(): MarketTick {
    return {
      ts: this.ts,
      price: this.price,
      ret: this.ret,
      vol20: realizedVol(this.bars),
      rsi14: rsi(this.prices, 14),
      bbPos: bollingerPos(this.prices, 20),
      obi: this.obi,
    }
  }

  sparkline(): number[] {
    return this.prices.slice(-60)
  }

  changePct24h(): number {
    if (this.prices.length < 2) return 0
    const first = this.prices[0]
    return ((this.price - first) / first) * 100
  }
}

// ---- helpers ----
function gaussian(): number {
  // Box-Muller
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x))
}

function realizedVol(rets: number[]): number {
  if (rets.length < 2) return 0
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1)
  return Math.sqrt(variance) * Math.sqrt(252 * 1440) // bars are ~1s; scale to "annualized"
}

function rsi(prices: number[], period: number): number {
  if (prices.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = prices.length - period; i < prices.length; i++) {
    const ch = prices[i] - prices[i - 1]
    if (ch >= 0) gains += ch
    else losses -= ch
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function bollingerPos(prices: number[], period: number): number {
  if (prices.length < period) return 0.5
  const slice = prices.slice(-period)
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length
  const std = Math.sqrt(variance)
  if (std === 0) return 0.5
  return clamp((prices[prices.length - 1] - (mean - 2 * std)) / (4 * std), 0, 1)
}
