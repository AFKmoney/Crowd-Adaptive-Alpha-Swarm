// OMEGA Engine — simulated market microstructure
// A regime-switching mean-reverting random walk for BTCUSDT that produces
// believable trends, chops, and spikes so the crowd engine has something to overreact to.
//
// TITAN-1: extended to maintain true OHLC bars so ATR-14 (true range) can be computed.

import type { Regime } from './types.ts'

export interface OhlcBar {
  ts: number
  open: number
  high: number
  low: number
  close: number
}

export interface MarketTick {
  ts: number
  price: number
  ret: number // bar log return
  vol20: number // 20-bar realized volatility (annualized-ish)
  rsi14: number // 0..100
  bbPos: number // bollinger position 0..1 (0 = lower band, 1 = upper)
  obi: number // order book imbalance -1..1
  // TITAN-1: OHLC + ATR surfaced directly on the tick so agents / risk / sniper can read them.
  bar: OhlcBar
  prevClose: number
  atr14Bps: number
  atrPct: number
  volatilityRegime: 'low' | 'normal' | 'high' | 'extreme'
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

  // TITAN-1: OHLC history for ATR-14 (true range)
  private ohlc: OhlcBar[] = []
  private atr14: number = 0 // in price units (raw ATR)

  setRegime(r: Regime) {
    this.regime = r
  }

  /** Advance one bar. Returns the new tick. */
  step(): MarketTick {
    this.ts = Date.now()
    const p = REGIME_PARAMS[this.regime]
    const prevClose = this.price

    // Mean-reverting Ornstein-Uhlenbeck-ish component around a drifting mean
    const shock = gaussian() * p.vol
    const meanRevPull = (Math.log(START_PRICE) - Math.log(this.price)) * p.meanRev
    const drift = p.drift + meanRevPull
    this.ret = drift + shock

    // Occasional crowd-driven spike (3% chance of a larger move) — feeds extremes
    let spike = 0
    if (Math.random() < 0.03) {
      const spikeDir = Math.random() < 0.5 ? -1 : 1
      spike = spikeDir * (p.vol * (2.5 + Math.random() * 2))
      this.ret += spike
    }

    this.price = Math.max(100, this.price * Math.exp(this.ret))

    // ---- Build OHLC bar (true range requires intrabar high/low) ----
    // Open = prevClose, Close = new price. High/Low include a wick proportional
    // to bar magnitude plus a small Gaussian so ATR captures true intrabar range.
    const open = prevClose
    const close = this.price
    const wickMag = Math.abs(close - open) * (0.3 + Math.random() * 0.4) + this.price * p.vol * 0.4 * Math.abs(gaussian())
    const high = Math.max(open, close) + wickMag * Math.random()
    const low = Math.min(open, close) - wickMag * Math.random()
    const bar: OhlcBar = { ts: this.ts, open, high: Math.max(high, close, open), low: Math.max(1, Math.min(low, close, open)), close }
    this.ohlc.push(bar)
    if (this.ohlc.length > 60) this.ohlc.shift()

    // ---- ATR-14 (Wilder's smoothing of True Range) ----
    this.atr14 = computeAtr14(this.ohlc, this.atr14)
    const atrPct = this.atr14 > 0 ? (this.atr14 / this.price) * 100 : 0
    const atr14Bps = atrPct * 100
    const volatilityRegime = bucketVol(atrPct)

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

  /**
   * Inject a REAL live price (from OKX WebSocket) and update all indicators.
   * Used in live mode — replaces step() so ATR/RSI/vol compute on real data.
   * Optionally accepts the real OHLC from the exchange; if omitted, synthesizes
   * a bar from prevClose → price.
   */
  injectLivePrice(price: number, realOhlc?: { open: number; high: number; low: number; close: number; vol: number }): MarketTick {
    this.ts = Date.now()
    const prevClose = this.price
    this.price = Math.max(1, price)
    this.ret = prevClose > 0 ? Math.log(this.price / prevClose) : 0

    const open = prevClose || price
    const close = price
    const high = realOhlc ? realOhlc.high : Math.max(open, close)
    const low = realOhlc ? realOhlc.low : Math.min(open, close)
    const bar: OhlcBar = { ts: this.ts, open, high: Math.max(high, close, open), low: Math.max(1, Math.min(low, close, open)), close }
    this.ohlc.push(bar)
    if (this.ohlc.length > 60) this.ohlc.shift()
    this.atr14 = computeAtr14(this.ohlc, this.atr14)

    this.bars.push(this.ret)
    if (this.bars.length > 40) this.bars.shift()
    this.prices.push(this.price)
    if (this.prices.length > 60) this.prices.shift()
    this.peak24h = Math.max(...this.prices, this.price)

    // OBI: can't observe real L2 here; keep previous value (decays toward 0)
    this.obi = clamp(this.obi * 0.95, -1, 1)

    return this.tick()
  }

  tick(): MarketTick {
    const atrPct = this.atr14 > 0 ? (this.atr14 / this.price) * 100 : 0
    return {
      ts: this.ts,
      price: this.price,
      ret: this.ret,
      vol20: realizedVol(this.bars),
      rsi14: rsi(this.prices, 14),
      bbPos: bollingerPos(this.prices, 20),
      obi: this.obi,
      bar: this.ohlc[this.ohlc.length - 1] ?? { ts: this.ts, open: this.price, high: this.price, low: this.price, close: this.price },
      prevClose: this.ohlc.length > 1 ? this.ohlc[this.ohlc.length - 2].close : this.price,
      atr14Bps: Math.round(atrPct * 100 * 100) / 100,
      atrPct: Math.round(atrPct * 10000) / 10000,
      volatilityRegime: bucketVol(atrPct),
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

  /** OHLC history (last 60 bars) — used by the candlestick chart in the dashboard. */
  ohlcHistory(): OhlcBar[] {
    return this.ohlc.slice()
  }
}

// ---- ATR (Wilder's smoothing) ----
function trueRange(b: OhlcBar, prevClose: number): number {
  return Math.max(
    b.high - b.low,
    Math.abs(b.high - prevClose),
    Math.abs(b.low - prevClose),
  )
}

function computeAtr14(ohlc: OhlcBar[], prevAtr: number): number {
  if (ohlc.length < 2) return 0
  // Wilder's: ATR = (prevATR * (n-1) + TR) / n
  const period = 14
  if (ohlc.length <= period) {
    // simple average of TRs so far
    let sum = 0
    for (let i = 1; i < ohlc.length; i++) {
      sum += trueRange(ohlc[i], ohlc[i - 1].close)
    }
    return sum / Math.max(1, ohlc.length - 1)
  }
  // Once we have enough bars, smooth recursively. Since we only keep 60 bars,
  // recompute the smoothed ATR from the visible window to stay accurate.
  const slice = ohlc.slice(-(period + 1))
  let atr = trueRange(slice[1], slice[0].close)
  for (let i = 1; i < slice.length - 1; i++) {
    const tr = trueRange(slice[i + 1], slice[i].close)
    atr = (atr * (period - 1) + tr) / period
  }
  // Blend with previous ATR for temporal continuity
  return prevAtr > 0 ? atr * 0.5 + prevAtr * 0.5 : atr
}

function bucketVol(atrPct: number): 'low' | 'normal' | 'high' | 'extreme' {
  if (atrPct < 0.4) return 'low'
  if (atrPct < 1.2) return 'normal'
  if (atrPct < 3.0) return 'high'
  return 'extreme'
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
