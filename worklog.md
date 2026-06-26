# OMEGA — Dynamic Weight Reconfiguration Worklog

## Project Goal
Add **dynamic weight reconfiguration** to the OMEGA trading system (per `OMEGA_Whitepaper.pdf`):
when the **Crowd Engine** detects a crowd extreme (extreme funding, sentiment, social buzz),
the **RegimeWeightRouter** dynamically **deflates the other (crowd-following) signals** and
boosts contrarian signals — extending the whitepaper's regime-only weight router with a
second, faster reconfiguration axis driven by crowd extremes.

## Architecture (this build)
A live, browser-visible OMEGA control tower:

- **Backend mini-service** (`mini-services/omega-engine`, port 3003, socket.io):
  runs a continuous market + agent simulation and broadcasts live state.
- **Frontend dashboard** (`src/app/page.tsx`, Next.js): connects via socket.io to
  `/?XTransformPort=3003` and renders the crowd engine, regime router, alpha swarm,
  debate chamber, weight history, and a live event log.

## The Core Feature — Dynamic Weight Reconfiguration
Per the whitepaper (Layer 3, §5), the `RegimeWeightRouter` returns an agent weight dict
based on the HMM regime:
- `calm_bull`:     trend=0.50, meanrev=0.10, macro=0.25, stat_arb=0.15
- `volatile_bull`: trend=0.35, meanrev=0.15, macro=0.30, stat_arb=0.20
- `choppy`:        trend=0.10, meanrev=0.40, macro=0.20, stat_arb=0.30
- `bear`:          trend=0.05, meanrev=0.30, macro=0.40, stat_arb=0.25

**NEW — Crowd Engine axis:** A `CrowdEngine` tracks 4 crowd dimensions and fires an
extreme event when any crosses its threshold:
- funding rate (perp, bps/8h): |x| > 12 bps → extreme
- news/social sentiment: |x| > 0.75 → extreme
- social buzz (volume z): x > 2.0 → extreme
- composite crowd score: |x| > 0.70 → extreme

When an extreme fires, the `RegimeWeightRouter` applies a **deflation multiplier** per agent
role (decaying back to 1.0 as the extreme unwinds over ~30s):
- `crowd_follower` agents (trend, macro): multiplier = 1 - 0.7 * decay  → deflated (down to 0.3x)
- `contrarian` agents (meanrev, crowd):   multiplier = 1 + 0.8 * decay  → boosted (up to 1.8x)
- `neutral` agents (stat_arb):             multiplier = 1 + 0.2 * decay  → slight boost

The crowd engine itself becomes a **5th agent** emitting a contrarian signal
(Sell when crowd extremely long, Buy when crowd extremely short), with weight that is
near-zero at rest and spikes during extremes.

Effective weight = base(regime) * multiplier(crowd), then normalized so the swarm sums to 1.0.
This is the "dégonfle les autres signaux via le RegimeWeightRouter" behavior.

## Data Contract (socket.io, server → client)
Client connects: `io("/?XTransformPort=3003")`. Server emits:

### `omega:state` (full snapshot, every ~1s)
```ts
{
  ts: number,
  regime: {
    current: 'calm_bull'|'volatile_bull'|'choppy'|'bear',
    sinceTs: number, confidence: number,
    history: Array<{ ts, regime }>,
  },
  market: { symbol, price, changePct24h, sparkline: number[] },
  crowd: {
    sentiment: number, fundingRateBps: number, socialBuzz: number,
    fearGreed: number, composite: number,
    extreme: null | { dimension, direction:'long'|'short', magnitude, triggeredAt, decay },
    history: Array<{ ts, composite }>,
  },
  weights: {
    agents: {
      trend:    { base, multiplier, effective, role:'crowd_follower' },
      meanrev:  { base, multiplier, effective, role:'contrarian' },
      macro:    { base, multiplier, effective, role:'crowd_follower' },
      stat_arb: { base, multiplier, effective, role:'neutral' },
      crowd:    { base, multiplier, effective, role:'contrarian' },
    },
    deflationActive: boolean, reason: string|null, totalRaw: number,
  },
  signals: {
    symbol,
    agents: Array<{ agent, side:'BUY'|'SELL'|'FLAT', confidence, weightedConfidence, rationale }>,
    consensus: { side, confidence, conflict:boolean, quorumMet:boolean, voteStd:number },
  },
  events: Array<{ id, ts, type, message, details }>,  // last ~50, newest first
  stats: { uptime, extremeCount, reconfigCount, consensusCount, deferredCount },
}
```
### `omega:event` (single new event, for live log append)
Same shape as one events[] entry.

## Agent signal roles (for the swarm)
- `trend`   — PPO trend: follows momentum; side aligns with recent price move (crowd-follower)
- `meanrev` — PPO meanrev: fades RSI/BB extremes (contrarian)
- `macro`   — LLM macro: follows narrative = news sentiment direction (crowd-follower)
- `stat_arb`— stat-arb: pair reversion vs ETH; mildly contrarian
- `crowd`   — Crowd Engine: contrarian to composite crowd score (the new agent)

## Debate Chamber aggregation
- weighted vote = Σ(side_sign * confidence * effectiveWeight) / Σ(confidence * effectiveWeight)
- side_sign: BUY=+1, SELL=-1, FLAT=0
- conflict if voteStd (std of normalized per-agent votes) > 0.55 → DEFER (emit FLAT)
- quorum = at least 2 agents with confidence > 0.2
- consensus side = sign(weighted vote) thresholded; confidence = |weighted vote|

---

---
Task ID: 3-a
Agent: main (backend)
Task: Build the OMEGA engine mini-service (crowd engine + dynamic RegimeWeightRouter + agents + debate chamber + socket.io).

Work Log:
- Read OMEGA_Whitepaper.pdf (13 pages) — extracted Layer 3 RegimeWeightRouter spec and Debate Chamber (§4.4, §5).
- Scaffolded mini-services/omega-engine/ (package.json, socket.io dep, port 3003).
- types.ts — full data contract (OmegaState, CrowdState, WeightsState, etc.).
- market-sim.ts — regime-switching mean-reverting random walk (BTCUSDT, 1s bars), RSI-14, Bollinger pos, OBI.
- crowd-engine.ts — tracks funding/sentiment/buzz/fearGreed/composite; fires extreme events with 30s decay across 4 dimensions.
- regime-detector.ts — lightweight HMM stand-in classifying calm_bull/volatile_bull/choppy/bear with hysteresis.
- regime-router.ts — THE FEATURE: RegimeWeightRouter.compute() applies per-role deflation multipliers driven by crowd extreme decay (crowd_follower ×0.3, contrarian ×1.8, neutral ×1.2, crowd agent ×4.5), then normalizes effective weights to sum to 1.0.
- agents.ts — 5 agents (trend, meanrev, macro, stat_arb, crowd) each producing a raw SignalEvent.
- debate-chamber.ts — MoE aggregation: weighted vote, conflict detection (voteStd > 0.55 → DEFER), quorum=2.
- index.ts — orchestrator loop (1s tick) + socket.io server emitting omega:state, omega:event, omega:backlog.
- Verified via socket.io probe: crowd extreme fired → weights reconfigured live → conflict deferred. Engine runs clean on port 3003.

Stage Summary:
- Backend complete and verified. Dynamic weight reconfiguration is the core delivered feature.
- Data contract emitted: `omega:state` (1s full snapshot) + `omega:event` (live events) + `omega:backlog` (history on connect).
- Frontend can now connect to `io("/?XTransformPort=3003")` and render the dashboard.

---
Task ID: 3-b
Agent: main (frontend)
Task: Build the OMEGA dashboard frontend visualizing the crowd engine, dynamic RegimeWeightRouter weights, alpha swarm signals, debate chamber, weight history chart, and live event stream.

Work Log:
- Created src/lib/omega-types.ts — frontend mirror of the engine data contract.
- Created src/hooks/use-omega-engine.ts — socket.io client hook connecting to io("/?XTransformPort=3003"); manages state, events, weight history (120 bars), composite history.
- Created src/components/omega/shared.ts — display helpers (side/regime/agent/role styles, formatters, bar colors).
- Created src/components/omega/header.tsx — sticky top bar: OMEGA brand, live connection indicator, BTC price ticker, regime badge, consensus badge, stats counters (extremes/reconfigs/uptime).
- Created src/components/omega/crowd-panel.tsx — Crowd Engine: 4 dimension gauges (funding/sentiment/buzz/composite) with extreme zones + value markers, breakdown tiles, active-extreme banner.
- Created src/components/omega/weights-panel.tsx — RegimeWeightRouter: per-agent dual bars (base ghost + effective solid), multiplier badges (↓×0.63 amber = deflated, ↑×1.43 fuchsia = boosted), role tags, reconfig-reason banner. Min-width floor for tiny bars.
- Created src/components/omega/swarm-panel.tsx — Alpha Swarm: 5 agent cards with side/confidence badges, rationale text, weighted-confidence mini bars.
- Created src/components/omega/debate-panel.tsx — Debate Chamber: big consensus display, quorum/conflict status, weighted vote split bar (LONG/FLAT/SHORT), conflict-threshold meter.
- Created src/components/omega/weight-history-chart.tsx — recharts multi-line chart of effective weights over time with amber reference lines marking deflation-active moments.
- Created src/components/omega/event-log.tsx — color-coded scrolling event stream (crowd_extreme=amber, weight_reconfig=fuchsia, regime_change=teal, conflict_defer=rose, consensus=emerald).
- Rewrote src/app/page.tsx — dark zinc-950 dashboard layout: feature banner → Crowd Panel (full width) → Weights + Swarm (2-col) → Weight History + Debate (2-col) → Event Log (full width) → sticky footer.

Stage Summary:
- Frontend complete. Single-page dashboard at / renders all 6 panels, connects to engine via socket.io through the Caddy gateway (XTransformPort=3003).
- Polished: chart y-axis top margin fixed (no clipping), tiny weight bars get min 6px width, responsive single-column on mobile.
- Lint clean. No console/runtime errors.

---
Task ID: 6
Agent: main (verification)
Task: Integrate, lint, start dev servers, self-verify with Agent Browser.

Work Log:
- Installed socket.io-client (main project) + socket.io (mini-service).
- Started omega-engine mini-service on port 3003 (bun --hot index.ts) — runs clean.
- Next.js dev server on port 3000 — runs clean, GET / 200.
- Lint: `bun run lint` passes with zero errors.
- Agent Browser verification via Caddy gateway (port 81, required for XTransformPort routing):
  * Page loads, all 6 panels render with live data.
  * No console errors, no page errors.
  * Desktop (1280px): Crowd extreme active (EXTREME LONG via funding, mag 1.00, decay 47%); RegimeWeightRouter shows dynamic reconfiguration — trend ×0.67 (deflated), macro ×0.67 (deflated), meanrev ×1.37 (boosted), crowd ×2.34 (boosted), stat_arb ×1.09 (slight boost). Chart renders 5 lines, footer sticky at bottom.
  * Mobile (390px): single-column stacking, all panels readable, no overflow, footer at bottom.
  * VLM visual assessment: "Professional Bloomberg-terminal/hedge-fund dark-UI aesthetic" — 6/6 desktop checks pass, 6/6 mobile checks pass.

Stage Summary:
- FEATURE DELIVERED & VERIFIED: "quand le crowd engine détecte un extrême, il dégonfle les autres signaux via le RegimeWeightRouter".
- The Crowd Engine fires extremes across 4 dimensions (funding/sentiment/buzz/composite); the RegimeWeightRouter applies per-role deflation multipliers (crowd-followers deflated ×0.3, contrarians boosted ×1.8, crowd agent ×4.5) that decay over 30s as the extreme unwinds; effective weights normalize to 1.0; the Debate Chamber re-aggregates with the new weights every second.
- Dashboard is live, interactive, responsive, and error-free. Accessible via the Preview Panel.
