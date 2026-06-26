// omega-trainer/scenarios.ts
// ============================================================================
// Synthetic multi-regime market data generator for RL training.
//
// Covers ALL major crypto market scenarios ("TOUS LES SCÉNARIOS POSSIBLES"):
//   1. choppy                     9. dead_cat_bounce
//   2. bull_trend                 10. range_breakout_up
//   3. euphoria                   11. range_breakout_down
//   4. blowoff_top                12. high_vol_chop
//   5. flash_crash                13. gap_fill
//   6. v_bounce                   14. liquidation_cascade_long
//   7. bear_trend                 15. liquidation_cascade_short
//   8. slow_bleed
//
// Each Bar carries pre-computed indicators so the RL policy can consume a
// dense 8-dim state vector without re-computing features every step.
// ============================================================================

export type ScenarioName =
  | 'choppy'
  | 'bull_trend'
  | 'euphoria'
  | 'blowoff_top'
  | 'flash_crash'
  | 'v_bounce'
  | 'bear_trend'
  | 'slow_bleed'
  | 'dead_cat_bounce'
  | 'range_breakout_up'
  | 'range_breakout_down'
  | 'high_vol_chop'
  | 'gap_fill'
  | 'liquidation_cascade_long'
  | 'liquidation_cascade_short'

export const ALL_SCENARIOS: ScenarioName[] = [
  'choppy',
  'bull_trend',
  'euphoria',
  'blowoff_top',
  'flash_crash',
  'v_bounce',
  'bear_trend',
  'slow_bleed',
  'dead_cat_bounce',
  'range_breakout_up',
  'range_breakout_down',
  'high_vol_chop',
  'gap_fill',
  'liquidation_cascade_long',
  'liquidation_cascade_short',
]

export interface Bar {
  ts: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  returns: number // (close - prevClose) / prevClose
  logReturns: number // log(close / prevClose)
  vol20: number // 20-bar rolling std of returns (annualized-ish)
  rsi14: number // RSI-14 [0..100]
  distMa50: number // (close - ma50) / ma50
  fundingBps: number // perp funding, bps/8h (drifts with momentum)
  crowdScore: number // -1..1 (drifts with lagged amplified returns)
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

// Box-Muller Gaussian RNG. Deterministic given a seedable PRNG underneath.
let _spare: number | null = null
export function gaussian(mean = 0, std = 1): number {
  if (_spare !== null) {
    const v = mean + std * _spare
    _spare = null
    return v
  }
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const mag = Math.sqrt(-2.0 * Math.log(u))
  const z0 = mag * Math.cos(2.0 * Math.PI * v)
  const z1 = mag * Math.sin(2.0 * Math.PI * v)
  _spare = z1
  return mean + std * z0
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

// ---------------------------------------------------------------------------
// Indicator helpers (run after raw closes are produced)
// ---------------------------------------------------------------------------

// Public: used by index.ts to build live Bars from a rolling price buffer
// plus per-bar crowd fields captured from the omega-engine socket stream.
export function computeIndicators(
  closes: number[],
  volumes: number[],
  startTs: number,
  crowdOverride?: { fundingBps: number[]; crowdScore: number[] },
): Bar[] {
  const n = closes.length
  const bars: Bar[] = new Array(n)

  // Pre-compute returns
  const rets = new Array<number>(n).fill(0)
  const logRets = new Array<number>(n).fill(0)
  for (let i = 1; i < n; i++) {
    const prev = closes[i - 1]
    if (prev <= 0) {
      rets[i] = 0
      logRets[i] = 0
    } else {
      rets[i] = (closes[i] - prev) / prev
      logRets[i] = Math.log(closes[i] / prev)
    }
  }

  // Rolling 20-bar std of returns (vol20)
  const VOL_WINDOW = 20
  const MA50_WINDOW = 50
  const RSI_WINDOW = 14

  // Running sums for RSI (Wilder's smoothing)
  let avgGain = 0
  let avgLoss = 0

  // crowdScore: sentiment that drifts with lagged amplified returns
  // We'll accumulate a low-pass filtered, amplified log-return signal.
  let crowdRaw = 0

  // funding drifts with momentum (EMA of returns)
  let fundingEma = 0

  for (let i = 0; i < n; i++) {
    const close = closes[i]
    const open = i === 0 ? close * (1 - rets[i] * 0.5) : closes[i - 1]
    // High/low: open ± a gaussian intrabar range that scales with vol
    const rangeStd = Math.abs(rets[i]) + 0.0015
    const hi = Math.max(open, close) * (1 + Math.abs(gaussian(0, rangeStd)) * 0.6)
    const lo = Math.min(open, close) * (1 - Math.abs(gaussian(0, rangeStd)) * 0.6)

    // vol20: rolling std of returns over last 20 bars (use sample std)
    let vol20 = 0.015 // default for warm-up
    if (i >= VOL_WINDOW) {
      let mean = 0
      for (let k = i - VOL_WINDOW + 1; k <= i; k++) mean += rets[k]
      mean /= VOL_WINDOW
      let varSum = 0
      for (let k = i - VOL_WINDOW + 1; k <= i; k++) {
        const d = rets[k] - mean
        varSum += d * d
      }
      vol20 = Math.sqrt(varSum / VOL_WINDOW)
    } else if (i > 0) {
      let mean = 0
      for (let k = 1; k <= i; k++) mean += rets[k]
      mean /= Math.max(1, i)
      let varSum = 0
      for (let k = 1; k <= i; k++) {
        const d = rets[k] - mean
        varSum += d * d
      }
      vol20 = Math.sqrt(varSum / Math.max(1, i))
    }

    // MA50 and distMa50
    let ma50 = close
    if (i >= MA50_WINDOW) {
      let sum = 0
      for (let k = i - MA50_WINDOW + 1; k <= i; k++) sum += closes[k]
      ma50 = sum / MA50_WINDOW
    } else if (i > 0) {
      let sum = 0
      for (let k = 0; k <= i; k++) sum += closes[k]
      ma50 = sum / (i + 1)
    }
    const distMa50 = ma50 > 0 ? (close - ma50) / ma50 : 0

    // RSI-14 (Wilder's smoothing)
    const change = i > 0 ? closes[i] - closes[i - 1] : 0
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0
    if (i === 0) {
      avgGain = 0
      avgLoss = 0.0001
    } else if (i <= RSI_WINDOW) {
      avgGain = (avgGain * (i - 1) + gain) / i
      avgLoss = (avgLoss * (i - 1) + loss) / i
    } else {
      avgGain = (avgGain * (RSI_WINDOW - 1) + gain) / RSI_WINDOW
      avgLoss = (avgLoss * (RSI_WINDOW - 1) + loss) / RSI_WINDOW
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    const rsi14 = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs)

    // fundingBps: drifts with momentum (EMA of log-returns), scaled, clamped.
    // (Override with the live value from omega-engine if provided.)
    fundingEma = fundingEma * 0.92 + logRets[i] * 0.08
    const fundingBps =
      crowdOverride && crowdOverride.fundingBps[i] !== undefined
        ? clamp(crowdOverride.fundingBps[i], -50, 50)
        : clamp(fundingEma * 4000, -50, 50)

    // crowdScore: lagged, amplified, low-pass of log-returns; bounded -1..1.
    // (Override with the live value from omega-engine if provided.)
    crowdRaw = crowdRaw * 0.97 + logRets[i] * 0.03 * 6
    const crowdNoise = gaussian(0, 0.02)
    const crowdScore =
      crowdOverride && crowdOverride.crowdScore[i] !== undefined
        ? clamp(crowdOverride.crowdScore[i], -1, 1)
        : clamp(crowdRaw + crowdNoise, -1, 1)

    bars[i] = {
      ts: startTs + i * 60_000, // 1-minute bars
      open: round(open),
      high: round(hi),
      low: round(lo),
      close: round(close),
      volume: Math.max(1, Math.round(volumes[i])),
      returns: rets[i],
      logReturns: logRets[i],
      vol20,
      rsi14,
      distMa50,
      fundingBps,
      crowdScore,
    }
  }
  return bars
}

function round(x: number): number {
  return Math.round(x * 100) / 100
}

// ---------------------------------------------------------------------------
// Raw-price generators for each regime
// ---------------------------------------------------------------------------

// Each generator returns { closes, volumes } for the given length.
// Price starts at 50000 (BTC-ish) by default.

interface RawSeries {
  closes: number[]
  volumes: number[]
}

function baseVolume(): number {
  return Math.abs(gaussian(1000, 200))
}

function genChoppy(length: number): RawSeries {
  const closes: number[] = []
  const volumes: number[] = []
  let price = 50000
  // Mean-reverting noise around 50000
  for (let i = 0; i < length; i++) {
    const meanRev = (50000 - price) * 0.02
    const noise = gaussian(0, 80)
    price = Math.max(1000, price + meanRev + noise)
    closes.push(price)
    volumes.push(baseVolume())
  }
  return { closes, volumes }
}

function genBullTrend(length: number): RawSeries {
  const closes: number[] = []
  const volumes: number[] = []
  let price = 50000
  for (let i = 0; i < length; i++) {
    // Steady drift +0.06% per bar + normal vol
    const drift = 0.0006
    const noise = gaussian(0, 90)
    price = Math.max(1000, price * (1 + drift) + noise)
    closes.push(price)
    volumes.push(baseVolume() * (1 + Math.abs(noise) / 200))
  }
  return { closes, volumes }
}

function genEuphoria(length: number): RawSeries {
  const closes: number[] = []
  const volumes: number[] = []
  let price = 50000
  for (let i = 0; i < length; i++) {
    // Accelerating drift: drift grows with sqrt(i)
    const t = i / length
    const accel = 0.0004 + 0.0024 * t * t // ends at ~0.0028/bar
    const noise = gaussian(0, 100 + 200 * t) // rising vol
    price = Math.max(1000, price * (1 + accel) + noise)
    closes.push(price)
    // Volume accelerates too
    volumes.push(baseVolume() * (1 + 2.5 * t + Math.abs(noise) / 100))
  }
  return { closes, volumes }
}

function genBlowoffTop(length: number): RawSeries {
  // First ~65%: euphoria; last ~35%: sharp reversal cascade
  const euphoricLen = Math.floor(length * 0.65)
  const e = genEuphoria(euphoricLen)
  const closes = e.closes.slice()
  const volumes = e.volumes.slice()
  let price = closes[closes.length - 1]
  // Cascade: -0.4% per bar accelerating, high vol, then partial stabilization
  for (let i = 0; i < length - euphoricLen; i++) {
    const t = i / (length - euphoricLen)
    const dropRate = -0.002 - 0.006 * t
    const noise = gaussian(0, 200 + 400 * t)
    price = Math.max(1000, price * (1 + dropRate) + noise)
    closes.push(price)
    // Capitulation volume
    volumes.push(baseVolume() * (3 + 4 * t))
  }
  return { closes, volumes }
}

function genFlashCrash(length: number): RawSeries {
  // Steady state for first ~60% then a -15% cascade over ~50 bars then partial recovery
  const stableLen = Math.floor(length * 0.6)
  const s = genChoppy(stableLen)
  const closes = s.closes.slice()
  const volumes = s.volumes.slice()
  let price = closes[closes.length - 1]
  const crashLen = 50
  const remainingAfterCrash = length - stableLen - crashLen
  // Cascade down
  for (let i = 0; i < crashLen; i++) {
    const t = i / crashLen
    const dropRate = -0.0035 - 0.002 * t // accelerating down
    const noise = gaussian(0, 250)
    price = Math.max(1000, price * (1 + dropRate) + noise)
    closes.push(price)
    volumes.push(baseVolume() * (4 + 5 * t))
  }
  // Partial V-recovery (50% retracement of crash)
  for (let i = 0; i < remainingAfterCrash; i++) {
    const t = i / remainingAfterCrash
    const recoveryRate = 0.0015 * (1 - t) // decelerating recovery
    const noise = gaussian(0, 120)
    price = Math.max(1000, price * (1 + recoveryRate) + noise)
    closes.push(price)
    volumes.push(baseVolume() * (2 - t))
  }
  return { closes, volumes }
}

function genVBounce(length: number): RawSeries {
  // Sharp drop (40%) then sharp recovery (40%) then stable (20%)
  const dropLen = Math.floor(length * 0.4)
  const recoverLen = Math.floor(length * 0.4)
  let price = 50000
  const closes: number[] = []
  const volumes: number[] = []
  // Drop
  for (let i = 0; i < dropLen; i++) {
    const noise = gaussian(0, 150)
    price = Math.max(1000, price * (1 - 0.0028) + noise)
    closes.push(price)
    volumes.push(baseVolume() * 2.5)
  }
  // Recovery
  for (let i = 0; i < recoverLen; i++) {
    const t = i / recoverLen
    const noise = gaussian(0, 130)
    price = Math.max(1000, price * (1 + 0.0024 * (1 - t * 0.5)) + noise)
    closes.push(price)
    volumes.push(baseVolume() * 2)
  }
  // Stable
  const remaining = length - dropLen - recoverLen
  for (let i = 0; i < remaining; i++) {
    const meanRev = (price - 50000) * 0.005
    const noise = gaussian(0, 90)
    price = Math.max(1000, price + meanRev + noise)
    closes.push(price)
    volumes.push(baseVolume())
  }
  return { closes, volumes }
}

function genBearTrend(length: number): RawSeries {
  const closes: number[] = []
  const volumes: number[] = []
  let price = 50000
  for (let i = 0; i < length; i++) {
    const drift = -0.0006
    const noise = gaussian(0, 90)
    price = Math.max(1000, price * (1 + drift) + noise)
    closes.push(price)
    volumes.push(baseVolume() * (1 + Math.abs(noise) / 200))
  }
  return { closes, volumes }
}

function genSlowBleed(length: number): RawSeries {
  // Gradual downtrend with declining vol
  const closes: number[] = []
  const volumes: number[] = []
  let price = 50000
  for (let i = 0; i < length; i++) {
    const t = i / length
    const drift = -0.0004 // slow constant drift
    // Declining vol
    const volScale = 1 - 0.6 * t
    const noise = gaussian(0, 80 * volScale)
    price = Math.max(1000, price * (1 + drift) + noise)
    closes.push(price)
    volumes.push(Math.max(200, baseVolume() * volScale))
  }
  return { closes, volumes }
}

function genDeadCatBounce(length: number): RawSeries {
  // Sharp drop (25%), brief rally (25%), then continuation down (50%)
  const drop1 = Math.floor(length * 0.25)
  const bounce = Math.floor(length * 0.25)
  let price = 50000
  const closes: number[] = []
  const volumes: number[] = []
  for (let i = 0; i < drop1; i++) {
    const noise = gaussian(0, 200)
    price = Math.max(1000, price * (1 - 0.003) + noise)
    closes.push(price)
    volumes.push(baseVolume() * 3)
  }
  // Brief bounce (dead cat)
  for (let i = 0; i < bounce; i++) {
    const t = i / bounce
    const noise = gaussian(0, 150)
    price = Math.max(1000, price * (1 + 0.0015 * (1 - t)) + noise)
    closes.push(price)
    volumes.push(baseVolume() * 1.5)
  }
  // Continuation down
  const remaining = length - drop1 - bounce
  for (let i = 0; i < remaining; i++) {
    const noise = gaussian(0, 110)
    price = Math.max(1000, price * (1 - 0.0008) + noise)
    closes.push(price)
    volumes.push(baseVolume() * 1.2)
  }
  return { closes, volumes }
}

function genRangeBreakoutUp(length: number): RawSeries {
  // Choppy range for 70%, then breakout up 30%
  const rangeLen = Math.floor(length * 0.7)
  const rangeCenter = 50000
  let price = 50000
  const closes: number[] = []
  const volumes: number[] = []
  for (let i = 0; i < rangeLen; i++) {
    const meanRev = (rangeCenter - price) * 0.05
    const noise = gaussian(0, 60)
    price = Math.max(1000, price + meanRev + noise)
    closes.push(price)
    volumes.push(baseVolume() * 0.8)
  }
  // Breakout up
  const remaining = length - rangeLen
  for (let i = 0; i < remaining; i++) {
    const t = i / remaining
    const drift = 0.0012 + 0.001 * t
    const noise = gaussian(0, 100)
    price = Math.max(1000, price * (1 + drift) + noise)
    closes.push(price)
    volumes.push(baseVolume() * (2 + 2 * t))
  }
  return { closes, volumes }
}

function genRangeBreakoutDown(length: number): RawSeries {
  const rangeLen = Math.floor(length * 0.7)
  const rangeCenter = 50000
  let price = 50000
  const closes: number[] = []
  const volumes: number[] = []
  for (let i = 0; i < rangeLen; i++) {
    const meanRev = (rangeCenter - price) * 0.05
    const noise = gaussian(0, 60)
    price = Math.max(1000, price + meanRev + noise)
    closes.push(price)
    volumes.push(baseVolume() * 0.8)
  }
  const remaining = length - rangeLen
  for (let i = 0; i < remaining; i++) {
    const t = i / remaining
    const drift = -0.0012 - 0.001 * t
    const noise = gaussian(0, 100)
    price = Math.max(1000, price * (1 + drift) + noise)
    closes.push(price)
    volumes.push(baseVolume() * (2 + 2 * t))
  }
  return { closes, volumes }
}

function genHighVolChop(length: number): RawSeries {
  const closes: number[] = []
  const volumes: number[] = []
  let price = 50000
  for (let i = 0; i < length; i++) {
    const meanRev = (50000 - price) * 0.02
    const noise = gaussian(0, 240) // 3x normal vol
    price = Math.max(1000, price + meanRev + noise)
    closes.push(price)
    volumes.push(baseVolume() * 2.5)
  }
  return { closes, volumes }
}

function genGapFill(length: number): RawSeries {
  // Stable, then a gap up (jump), then mean-revert to fill the gap
  const stable1 = Math.floor(length * 0.4)
  let price = 50000
  const closes: number[] = []
  const volumes: number[] = []
  for (let i = 0; i < stable1; i++) {
    const noise = gaussian(0, 60)
    price = Math.max(1000, price + (50000 - price) * 0.02 + noise)
    closes.push(price)
    volumes.push(baseVolume())
  }
  // Gap up +5% in one bar
  price = price * 1.05
  closes.push(price)
  volumes.push(baseVolume() * 4)
  // Mean revert to fill (back to 50000)
  const remaining = length - stable1 - 1
  for (let i = 0; i < remaining; i++) {
    const t = i / remaining
    const meanRev = (50000 - price) * 0.04
    const noise = gaussian(0, 80)
    price = Math.max(1000, price + meanRev + noise)
    closes.push(price)
    volumes.push(baseVolume() * (1.5 - t))
  }
  return { closes, volumes }
}

function genLiquidationCascadeLong(length: number): RawSeries {
  // Crowd is super long, funding spike, then cascade down as longs get liquidated
  const buildup = Math.floor(length * 0.5)
  let price = 50000
  const closes: number[] = []
  const volumes: number[] = []
  // Buildup: mild uptrend to attract longs
  for (let i = 0; i < buildup; i++) {
    const noise = gaussian(0, 70)
    price = Math.max(1000, price * (1 + 0.0005) + noise)
    closes.push(price)
    volumes.push(baseVolume() * 1.2)
  }
  // Cascade down: longs liquidated, accelerating drop with high vol
  const cascadeLen = length - buildup
  for (let i = 0; i < cascadeLen; i++) {
    const t = i / cascadeLen
    const dropRate = -0.002 - 0.005 * t
    const noise = gaussian(0, 250 + 300 * t)
    price = Math.max(1000, price * (1 + dropRate) + noise)
    closes.push(price)
    volumes.push(baseVolume() * (3 + 5 * t))
  }
  return { closes, volumes }
}

function genLiquidationCascadeShort(length: number): RawSeries {
  // Crowd is super short, funding very negative, then short squeeze up
  const buildup = Math.floor(length * 0.5)
  let price = 50000
  const closes: number[] = []
  const volumes: number[] = []
  for (let i = 0; i < buildup; i++) {
    const noise = gaussian(0, 70)
    price = Math.max(1000, price * (1 - 0.0005) + noise)
    closes.push(price)
    volumes.push(baseVolume() * 1.2)
  }
  // Short squeeze up: accelerating up with high vol
  const cascadeLen = length - buildup
  for (let i = 0; i < cascadeLen; i++) {
    const t = i / cascadeLen
    const upRate = 0.002 + 0.005 * t
    const noise = gaussian(0, 250 + 300 * t)
    price = Math.max(1000, price * (1 + upRate) + noise)
    closes.push(price)
    volumes.push(baseVolume() * (3 + 5 * t))
  }
  return { closes, volumes }
}

// ---------------------------------------------------------------------------
// Master scenario generator
// ---------------------------------------------------------------------------

const GENERATORS: Record<ScenarioName, (length: number) => RawSeries> = {
  choppy: genChoppy,
  bull_trend: genBullTrend,
  euphoria: genEuphoria,
  blowoff_top: genBlowoffTop,
  flash_crash: genFlashCrash,
  v_bounce: genVBounce,
  bear_trend: genBearTrend,
  slow_bleed: genSlowBleed,
  dead_cat_bounce: genDeadCatBounce,
  range_breakout_up: genRangeBreakoutUp,
  range_breakout_down: genRangeBreakoutDown,
  high_vol_chop: genHighVolChop,
  gap_fill: genGapFill,
  liquidation_cascade_long: genLiquidationCascadeLong,
  liquidation_cascade_short: genLiquidationCascadeShort,
}

export function generateScenario(name: ScenarioName, length = 1000): Bar[] {
  const gen = GENERATORS[name]
  if (!gen) throw new Error(`Unknown scenario: ${name}`)
  // Ensure within 800-1200 range
  const n = Math.max(800, Math.min(1200, length))
  const { closes, volumes } = gen(n)
  const startTs = Date.now() - n * 60_000
  return computeIndicators(closes, volumes, startTs)
}

// Convenience: generate all scenarios (for "train on everything" mode)
export function generateAllScenarios(length = 1000): Record<ScenarioName, Bar[]> {
  const out = {} as Record<ScenarioName, Bar[]>
  for (const s of ALL_SCENARIOS) {
    out[s] = generateScenario(s, length)
  }
  return out
}
