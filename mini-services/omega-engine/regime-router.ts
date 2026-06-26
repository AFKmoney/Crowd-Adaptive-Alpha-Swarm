// OMEGA Engine — RegimeWeightRouter with DYNAMIC weight reconfiguration
//
// The whitepaper's router only re-weights on HMM regime transitions. This extended
// router adds a SECOND, faster reconfiguration axis: when the Crowd Engine fires an
// extreme, the router applies a per-role DEFALTION MULTIPLIER that:
//   - DEFLATES crowd-following agents (trend, macro)        → multiplier 1.0 → 0.3
//   - BOOSTS   contrarian agents (meanrev, crowd)           → multiplier 1.0 → 1.8
//   - lightly boosts neutral agents (stat_arb)              → multiplier 1.0 → 1.2
//
// The multiplier scales with the extreme's decay (1.0 fresh → 0.0 unwound), so weights
// smoothly reconfigure the moment an extreme fires and relax back as it clears.
//
// This is the "dégonfle les autres signaux via le RegimeWeightRouter" behavior requested.

import type { Regime, WeightsState, AgentName, AgentRole, CrowdState } from './types.ts'

// Base weight matrix from the whitepaper (Layer 3, §5) — sums to 1.0 per regime.
// The crowd agent is new: near-zero at rest, but its EFFECTIVE weight spikes during
// extremes via the multiplier (its base stays tiny so regimes are unaffected at rest).
const BASE_WEIGHTS: Record<Regime, Record<AgentName, number>> = {
  calm_bull:     { trend: 0.48, meanrev: 0.10, macro: 0.24, stat_arb: 0.15, crowd: 0.03 },
  volatile_bull: { trend: 0.33, meanrev: 0.15, macro: 0.29, stat_arb: 0.20, crowd: 0.03 },
  choppy:        { trend: 0.10, meanrev: 0.38, macro: 0.19, stat_arb: 0.30, crowd: 0.03 },
  bear:          { trend: 0.05, meanrev: 0.28, macro: 0.39, stat_arb: 0.25, crowd: 0.03 },
}

const AGENT_ROLE: Record<AgentName, AgentRole> = {
  trend: 'crowd_follower',
  macro: 'crowd_follower',
  meanrev: 'contrarian',
  crowd: 'contrarian',
  stat_arb: 'neutral',
}

// How strongly the crowd extreme deflates/boosts each role.
// multiplier = 1 + ROLE_SENSITIVITY[role] * decay  (decay ∈ 0..1)
const ROLE_SENSITIVITY: Record<AgentRole, number> = {
  crowd_follower: -0.7, // deflated up to 0.3x
  contrarian: 0.8, // boosted up to 1.8x
  neutral: 0.2, // boosted up to 1.2x
}

export interface ReconfigResult {
  weights: WeightsState
  changed: boolean // did the dynamic multiplier change meaningfully since last call?
  reason: string | null
}

export class RegimeWeightRouter {
  private lastDeflationActive = false

  /**
   * Compute the current weights given the regime and the crowd state.
   */
  compute(regime: Regime, crowd: CrowdState): ReconfigResult {
    const base = BASE_WEIGHTS[regime]
    const extreme = crowd.extreme
    const decay = extreme ? extreme.decay : 0
    const deflationActive = !!extreme && decay > 0.05

    const agents = {} as WeightsState['agents']
    let totalRaw = 0

    ;(Object.keys(base) as AgentName[]).forEach((name) => {
      const role = AGENT_ROLE[name]
      let multiplier = 1 + ROLE_SENSITIVITY[role] * decay

      // The crowd agent gets an EXTRA boost during extremes — it is the voice of the
      // crowd engine and should be heard when it speaks. At rest, multiplier ~1 but
      // base is tiny (0.03), so it stays quiet.
      if (name === 'crowd' && deflationActive) {
        multiplier *= 1 + 1.5 * decay // up to ~4.5x during a fresh extreme
      }

      multiplier = Math.max(0.05, multiplier) // floor so an agent never fully dies
      const raw = base[name] * multiplier
      totalRaw += raw
      agents[name] = {
        base: round(base[name], 4),
        multiplier: round(multiplier, 4),
        effective: 0, // filled after normalization
        role,
      }
    })

    // Normalize effective weights so the swarm sums to 1.0
    ;(Object.keys(agents) as AgentName[]).forEach((name) => {
      agents[name].effective = round(agents[name].base * agents[name].multiplier / totalRaw, 4)
    })

    let reason: string | null = null
    if (deflationActive && extreme) {
      reason =
        `Crowd extreme (${extreme.dimension}, ${extreme.direction}, ` +
        `mag ${extreme.magnitude.toFixed(2)}, decay ${(extreme.decay * 100).toFixed(0)}%) → ` +
        `deflating trend/macro ×${(1 + ROLE_SENSITIVITY.crowd_follower * decay).toFixed(2)}, ` +
        `boosting meanrev/crowd ×${(1 + ROLE_SENSITIVITY.contrarian * decay).toFixed(2)}`
    }

    // "changed" = transitioned between active/inactive (the moments we log a reconfig event)
    const changed = deflationActive !== this.lastDeflationActive
    this.lastDeflationActive = deflationActive

    return {
      weights: { agents, deflationActive, reason, totalRaw: round(totalRaw, 4) },
      changed,
      reason,
    }
  }
}

function round(x: number, d: number) {
  const f = 10 ** d
  return Math.round(x * f) / f
}
