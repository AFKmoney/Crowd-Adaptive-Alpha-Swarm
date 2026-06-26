// OMEGA Engine — Debate Chamber (Layer 2.4, MoE meta-agent)
// Aggregates raw signals from all agents into a single consensus per symbol using
// the RegimeWeightRouter's effective weights. Implements explicit conflict detection:
// if the std-dev of normalized per-agent votes exceeds 0.55, the chamber DEFERS
// (emits FLAT) — "in regimes of high uncertainty, the best trade is no trade at all."

import type { AgentSignal, Consensus, WeightsState, AgentName, Side } from './types.ts'

const CONFLICT_STD_THRESHOLD = 0.55
const QUORUM = 2
const QUORUM_CONFIDENCE = 0.2
const CONSENSUS_VOTE_THRESHOLD = 0.12

const SIDE_SIGN: Record<Side, number> = { BUY: 1, SELL: -1, FLAT: 0 }

export interface DebateResult {
  signals: AgentSignal[]
  consensus: Consensus
}

export function debate(
  rawSignals: Array<Omit<AgentSignal, 'weightedConfidence'>>,
  weights: WeightsState,
): DebateResult {
  // Attach weighted confidence to each signal
  const signals: AgentSignal[] = rawSignals.map((s) => {
    const w = weights.agents[s.agent as AgentName]?.effective ?? 0
    return { ...s, weightedConfidence: round(s.confidence * w, 4) }
  })

  // Weighted vote
  let weightedVote = 0
  let totalWeightedConf = 0
  const normalizedVotes: number[] = []
  let contributing = 0

  for (const s of signals) {
    const w = weights.agents[s.agent as AgentName]?.effective ?? 0
    const wc = s.confidence * w
    if (s.confidence > QUORUM_CONFIDENCE && s.side !== 'FLAT') contributing++
    if (wc > 0) {
      const vote = SIDE_SIGN[s.side] * wc
      weightedVote += vote
      totalWeightedConf += wc
      // normalized vote for conflict std: sign * confidence (pre-weight) so we measure
      // disagreement between agents, not their size
      if (s.side !== 'FLAT') normalizedVotes.push(SIDE_SIGN[s.side] * s.confidence)
    }
  }

  const score = totalWeightedConf > 0 ? weightedVote / totalWeightedConf : 0
  const voteStd = normalizedVotes.length > 1 ? std(normalizedVotes) : 0

  const quorumMet = contributing >= QUORUM
  const conflict = voteStd > CONFLICT_STD_THRESHOLD

  let side: Side
  let confidence: number
  if (!quorumMet) {
    side = 'FLAT'
    confidence = 0
  } else if (conflict) {
    side = 'FLAT'
    confidence = round(voteStd, 3) // report the disagreement magnitude
  } else if (Math.abs(score) < CONSENSUS_VOTE_THRESHOLD) {
    side = 'FLAT'
    confidence = round(Math.abs(score), 3)
  } else {
    side = score > 0 ? 'BUY' : 'SELL'
    confidence = round(Math.min(0.98, Math.abs(score)), 3)
  }

  return {
    signals,
    consensus: {
      side,
      confidence,
      conflict,
      quorumMet,
      voteStd: round(voteStd, 3),
    },
  }
}

function std(a: number[]) {
  if (a.length < 2) return 0
  const m = a.reduce((x, y) => x + y, 0) / a.length
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1))
}
function round(x: number, d: number) {
  const f = 10 ** d
  return Math.round(x * f) / f
}
