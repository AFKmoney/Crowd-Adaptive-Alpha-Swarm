// OMEGA Engine — Crowd Engine
// Tracks 4 crowd dimensions and fires extreme events when any crosses its threshold.
// The crowd tends to OVERREACT to price momentum, so we model crowd sentiment as a
// lagged, amplified function of recent returns — producing realistic extremes that
// the RegimeWeightRouter can then deflate.

import type { CrowdState, CrowdExtreme, CrowdDimension, CrowdDirection } from './types.ts'
import type { MarketTick } from './market-sim.ts'

// Thresholds for "extreme" classification
const THRESHOLDS = {
  funding: 12, // bps per 8h
  sentiment: 0.75, // |x| in -1..1
  buzz: 2.0, // z-score
  composite: 0.7, // |x| in -1..1
}

// How long (ms) an extreme takes to decay to zero (≈30s)
const EXTREME_DECAY_MS = 30_000

export class CrowdEngine {
  sentiment = 0 // -1..1 (news/social NLP)
  fundingRateBps = 2 // perp funding, bps per 8h
  socialBuzz = 0.4 // 0..1 normalized volume
  fearGreed = 55 // 0..100
  composite = 0 // -1..1 signed crowd score

  extreme: CrowdExtreme | null = null
  history: Array<{ ts: number; composite: number }> = []

  private buzzBaseline: number[] = []

  /** Update crowd state from the latest market tick. */
  update(tick: MarketTick): void {
    // 1) Funding rate: crowd piles into perps in the direction of momentum.
    //    Funding drifts toward momentum * gain, with noise.
    const momentum = tick.ret * 200 // amplify bar return
    this.fundingRateBps = clamp(
      this.fundingRateBps * 0.92 + momentum * 8 + gaussian() * 0.4,
      -30,
      30,
    )

    // 2) Sentiment: news/social NLP lags price and amplifies it.
    //    When price rallies, sentiment turns bullish; when it dumps, bearish.
    const recentRet = tick.ret
    this.sentiment = clamp(
      this.sentiment * 0.88 + recentRet * 90 + gaussian() * 0.05,
      -1,
      1,
    )

    // 3) Social buzz: volume z-score of "buzz". Spikes on big moves.
    const buzzRaw = Math.abs(recentRet) * 600 + Math.abs(gaussian()) * 0.3 + 0.2
    this.buzzBaseline.push(buzzRaw)
    if (this.buzzBaseline.length > 60) this.buzzBaseline.shift()
    const buzzMean = mean(this.buzzBaseline)
    const buzzStd = std(this.buzzBaseline)
    const buzzZ = buzzStd > 0 ? (buzzRaw - buzzMean) / buzzStd : 0
    this.socialBuzz = clamp(0.4 + buzzZ * 0.2, 0, 1)

    // 4) Fear & Greed: composite of sentiment + momentum + rsi
    this.fearGreed = clamp(
      50 + this.sentiment * 35 + (tick.rsi14 - 50) * 0.4 + (tick.bbPos - 0.5) * 20,
      2,
      98,
    )

    // Composite crowd score: signed, weighted blend
    // Positive = crowd leaning LONG (greedy/bullish), negative = crowd leaning SHORT (fearful)
    this.composite = clamp(
      this.sentiment * 0.45 +
        Math.tanh(this.fundingRateBps / 15) * 0.35 +
        (tick.rsi14 - 50) / 50 * 0.2,
      -1,
      1,
    )

    // ---- Extreme detection ----
    const now = tick.ts
    const dims: Array<{ dim: CrowdDimension; val: number; thr: number; dir: CrowdDirection; mag: number }> = []

    if (Math.abs(this.fundingRateBps) >= THRESHOLDS.funding) {
      dims.push({
        dim: 'funding',
        val: this.fundingRateBps,
        thr: THRESHOLDS.funding,
        dir: this.fundingRateBps > 0 ? 'long' : 'short',
        mag: clamp(Math.abs(this.fundingRateBps) / 25, 0, 1),
      })
    }
    if (Math.abs(this.sentiment) >= THRESHOLDS.sentiment) {
      dims.push({
        dim: 'sentiment',
        val: this.sentiment,
        thr: THRESHOLDS.sentiment,
        dir: this.sentiment > 0 ? 'long' : 'short',
        mag: clamp(Math.abs(this.sentiment), 0, 1),
      })
    }
    if (buzzZ >= THRESHOLDS.buzz) {
      dims.push({
        dim: 'buzz',
        val: buzzZ,
        thr: THRESHOLDS.buzz,
        dir: recentRet >= 0 ? 'long' : 'short',
        mag: clamp((buzzZ - THRESHOLDS.buzz) / 2, 0, 1),
      })
    }
    if (Math.abs(this.composite) >= THRESHOLDS.composite) {
      dims.push({
        dim: 'composite',
        val: this.composite,
        thr: THRESHOLDS.composite,
        dir: this.composite > 0 ? 'long' : 'short',
        mag: clamp(Math.abs(this.composite), 0, 1),
      })
    }

    // Pick the strongest extreme (if any). Prefer to keep the current one if still active.
    if (dims.length > 0) {
      const strongest = dims.reduce((a, b) => (b.mag > a.mag ? b : a))
      const fresh: CrowdExtreme = {
        dimension: strongest.dim,
        direction: strongest.dir,
        magnitude: strongest.mag,
        triggeredAt: now,
        decay: 1,
      }
      if (!this.extreme) {
        // New extreme — caller will log the event
        this.extreme = fresh
      } else {
        // Existing extreme: refresh magnitude & direction if stronger, keep triggeredAt
        const sameDim = this.extreme.dimension === strongest.dim
        if (sameDim) {
          this.extreme.magnitude = Math.max(this.extreme.magnitude, strongest.mag)
          this.extreme.direction = strongest.dir
          this.extreme.decay = 1 // refresh
        } else if (strongest.mag > (this.extreme.magnitude * this.extreme.decay)) {
          // A different dimension became dominant — escalate to it
          this.extreme = fresh
        } else {
          // existing extreme still dominates; just refresh decay a bit
          this.extreme.decay = Math.min(1, this.extreme.decay + 0.05)
        }
      }
    }

    // ---- Decay ----
    if (this.extreme) {
      const age = now - this.extreme.triggeredAt
      this.extreme.decay = clamp(1 - age / EXTREME_DECAY_MS, 0, 1)
      if (this.extreme.decay <= 0.02) {
        // Extreme has unwound — caller will log the clear event
        this.extreme = null
      }
    }

    // History (keep ~120 points = 2 minutes)
    this.history.push({ ts: now, composite: this.composite })
    if (this.history.length > 120) this.history.shift()
  }

  state(): CrowdState {
    return {
      sentiment: round(this.sentiment, 4),
      fundingRateBps: round(this.fundingRateBps, 2),
      socialBuzz: round(this.socialBuzz, 4),
      fearGreed: round(this.fearGreed, 1),
      composite: round(this.composite, 4),
      extreme: this.extreme
        ? { ...this.extreme, decay: round(this.extreme.decay, 3) }
        : null,
      history: this.history.slice(-120),
    }
  }
}

// ---- helpers ----
function gaussian(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x))
}
function mean(a: number[]) {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0
}
function std(a: number[]) {
  if (a.length < 2) return 0
  const m = mean(a)
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1))
}
function round(x: number, d: number) {
  const f = 10 ** d
  return Math.round(x * f) / f
}
