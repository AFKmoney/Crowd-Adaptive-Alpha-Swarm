# Ω OMEGA — Autonomous Multi-Modal AI Hedge Fund

> A self-evolving, multi-agent crypto trading system with crowd-adaptive weight reconfiguration, a 12-weapon "Divine Arsenal" of microstructure exploits, real OKX exchange connectivity, and a real-time glassmorphism trading terminal.

OMEGA is an institutional-grade trading system that ingests every market-informative signal — order book microstructure, on-chain analytics, real-time news, social sentiment, cross-exchange liquidations — and routes them through a Mixture-of-Experts Alpha Swarm with dynamic weight reconfiguration driven by crowd extremes.

**This is an architectural framework, not financial advice. Trading cryptocurrencies involves substantial risk of loss. Never deploy with capital you cannot afford to lose.**

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the System](#running-the-system)
- [Dashboard Guide](#dashboard-guide)
- [Credential Management](#credential-management)
- [Trading Modes](#trading-modes)
- [The Divine Arsenal](#the-divine-arsenal)
- [RL Training](#rl-training)
- [Project Structure](#project-structure)
- [Disclaimer](#disclaimer)
- [License](#license)

---

## Overview

OMEGA is built as a layered, event-driven organism rather than a single bot. Each layer owns one concern and communicates with the next through a strict contract. The system's core thesis is **contrarian**: it does not follow momentum like institutional algorithms — it detects when the crowd is overcrowded at a statistical extreme and fades that position, capturing the liquidation cascade that inevitably follows.

### The Core Edge

> *80% of traders lose because they do what 80% do. OMEGA does the inverse — but only at quantified extremes, not blindly.*

The system unifies three alpha sources:
1. **Narrative alpha** (LLM macro, news, social sentiment)
2. **Microstructure alpha** (funding rates, order book imbalance, liquidations)
3. **Regime-adaptive allocation** (HMM regime detection + dynamic weight routing)

...all filtered through a single question: *is the crowd on the same side as me?* If yes — fade. If no — follow.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Layer 1 — Data Nexus                           │
│  OKX WebSocket · REST · Synthetic sim fallback  │
├─────────────────────────────────────────────────┤
│  Layer 1.5 — Crowd Engine                       │
│  Funding · Sentiment · Buzz · Composite score   │
├─────────────────────────────────────────────────┤
│  Layer 2 — Alpha Swarm (Mixture of Experts)     │
│  PPO Trend · PPO MeanRev · LLM Macro · StatArb  │
│  Contrarian Crowd Agent                         │
├─────────────────────────────────────────────────┤
│  Layer 2.5 — Boule de Cristal + TimeBandit      │
│  Binance liquidation feed → priority-0 strike   │
├─────────────────────────────────────────────────┤
│  Layer 3 — Regime Detector + Weight Router      │
│  HMM regimes · Dynamic crowd-deflation weights  │
├─────────────────────────────────────────────────┤
│  Layer 3.5 — Divine Arsenal (12 weapons)        │
│  Wall Breaker · Ghost Protocol · Symphony       │
│  Poison Pill · Chronos · Gamma · Event Horizon  │
│  Iceberg Sonar · CEX Vampire · Cross-Pair       │
│  Engine Overload · Correlated Domino            │
├─────────────────────────────────────────────────┤
│  Layer 4 — Risk Aegis                           │
│  Kelly sizing · ATR-dynamic TP/SL · Hors-Dogme  │
│  -3% hard-stop with contrarian override         │
├─────────────────────────────────────────────────┤
│  Layer 5 — Execution Blade                      │
│  Maker-Grid (3-tier limit spiderweb) · Market   │
├─────────────────────────────────────────────────┤
│  Layer 6 — Live OKX Connectivity                │
│  HMAC-signed REST · WebSocket · SIM/TESTNET/    │
│  MAINNET mode switch                            │
└─────────────────────────────────────────────────┘
```

---

## Features

### Trading Intelligence
- **Crowd Engine** — tracks funding rate, sentiment, social buzz, Fear & Greed, and a composite crowd score. Fires extreme events when any dimension crosses its threshold.
- **Dynamic Weight Reconfiguration** — when a crowd extreme is detected, the RegimeWeightRouter deflates crowd-following agents (trend, macro) and boosts contrarians (meanrev, crowd) in real time.
- **Debate Chamber** — MoE aggregation with explicit conflict detection. If agents disagree beyond a threshold, the chamber defers — "in regimes of high uncertainty, the best trade is no trade at all."
- **Boule de Cristal + TimeBandit** — a ghost WebSocket listens to Binance's global liquidation feed. When a $500K+ cascade spike is detected, the TimeBandit agent (priority 0, absolute) pre-empts the entire swarm and orders an immediate SHORT/LONG on OKX with 99% confidence and a maximally widened take-profit.

### Risk Management
- **Hors-Dogme Override** — a -3% daily drawdown hard-stop blocks all normal trading, EXCEPT when a viable contrarian opportunity is detected (crowd extreme + high confidence). The override fires because the contrarian edge is sharpest precisely at liquidation cascades.
- **ATR-Dynamic TP/SL** — take-profit and stop-loss are indexed to the Average True Range. In extreme volatility during cascades, the TP widens automatically (elastic asymmetry, up to 3.3:1).
- **Fractional Kelly Sizing** — quarter-Kelly with asymmetric loss-streak penalties and a 20% equity cap per trade.

### Execution
- **Maker-Grid Execution** — contrarian trades deploy a 3-tier limit-order spiderweb at -0.1% / -0.5% / -1.0% from entry, capturing the flash-crash wick at better prices with zero taker fees and maker rebates.

### The Divine Arsenal (12 Weapons)
Twelve microstructure-exploitation weapons that attack where institutional algorithms are blind or too large to move:

| Weapon | Tier | What it does |
|--------|------|-------------|
| Wall Breaker | Phase 4 | Detects retail exhaustion against invisible resistance → SELL into trapped buyers |
| Ghost Protocol | Phase 4 | Exploits the 3s liquidity vacuum when MM bots disconnect at news events |
| Symphony Vector | Phase 4 | Uses BTC as oracle, deploys altcoin maker-grids before HFT aligns (30-90ms window) |
| Poison Pill | Phase 4 | Monitors the mempool for whale DEX sales → shorts CEX before the chain confirms |
| Chronos Parasite | Phase 5 | Sniffs institutional TWAP rhythm, front-runs each scheduled buy |
| Gamma Squeeze | Phase 5 | Buys spot ahead of options MM forced covering (negative gamma) |
| Event Horizon | Phase 5 | Forces the cascade with a brutal SELL, TPs at the bottom of the liquidation hole |
| Iceberg Sonar | Level 6 | Dust-order lidar maps hidden iceberg order sizes |
| CEX Inflow Vampire | Level 6 | Tracks cold-wallet → exchange deposits, shorts before the 3-confirmation credit |
| Cross-Pair Vacuum | Level 6 | Detects liquidity draining from one pair to chase a pump elsewhere |
| Engine Overload | Level 6 | Fades trapped retail when exchange matching engines lag during flash crashes |
| Correlated Domino | Level 6 | Graph theory: SOL drop → DeFi liquidates WIF collateral → short WIF |

### Live OKX Connectivity
- **Real REST + WebSocket** — HMAC-SHA256 signed OKX v5 API client. Public price feed works without credentials; authenticated endpoints place real orders.
- **Three modes** — SIM (synthetic), TESTNET (demo trading with real data), MAINNET (real capital).
- **Credential Manager** — multi-set credential storage with auto-generated passphrases, .txt export/import, one-click activation, key reveal, and secure obfuscated storage.

### Dashboard ("God Mode" Terminal)
- **Glassmorphism dark UI** — translucent panels with ambient gradient glows.
- **TradingView Lightweight Charts** — real candlestick chart with ENTRY/TP/SL price lines.
- **Neon event terminal** — color-coded live event stream with glow effects on signals and overrides.
- **15+ live panels** — Price Action, Crowd Engine, Boule de Cristal, Liquidation Sniper, Order Book, Toxic Flow, Cross-Exchange Domino, RegimeWeightRouter, Alpha Swarm, Risk Aegis, Debate Chamber, Execution Blade, Divine Arsenal, Credential Manager, Terminal.

---

## Prerequisites

- **Node.js** 18+ and **Bun** (recommended) or npm
- **OKX account** with API access (for live trading — create an API key at OKX → API Management)
- Windows, macOS, or Linux

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/omega-trader/omega-hedge-fund.git
cd omega-hedge-fund

# 2. Install dependencies
bun install

# 3. Install mini-service dependencies
cd mini-services/omega-engine && bun install && cd ../..
cd mini-services/omega-trainer && bun install && cd ../..

# 4. Create your .env file
cp .env.example .env
# Edit .env and set OMEGA_SECRET_KEY to a random string

# 5. Initialize the database
bun run db:push
```

### .env file

```env
DATABASE_URL=file:./db/custom.db
OMEGA_SECRET_KEY=your-random-secret-key-here
```

`OMEGA_SECRET_KEY` is used to obfuscate your OKX credentials at rest in the database. Use a strong random string.

---

## Running the System

OMEGA runs as **three services**. Open three terminals:

### Terminal 1 — The Trading Engine (port 3003)

```bash
cd mini-services/omega-engine
bun run dev
```

This runs the core OMEGA loop: market data ingestion, crowd engine, alpha swarm, risk aegis, execution blade, and the Divine Arsenal. It broadcasts live state over WebSocket.

### Terminal 2 — The RL Trainer (port 3004, optional)

```bash
cd mini-services/omega-trainer
bun run dev
```

This runs the reinforcement-learning training service. It generates 250,000 bars of synthetic multi-regime data and trains three PPO-style policy-gradient agents (trend, meanrev, crowd). Connects to the engine for live-data training mode.

### Terminal 3 — The Dashboard (port 3000)

```bash
bun run dev
```

Open your browser to `http://localhost:3000`. You'll see the full God-Mode trading terminal.

> **Windows users:** All commands work in PowerShell or Command Prompt. Use `bun` if installed, or substitute `npm` / `npx`.

---

## Dashboard Guide

The dashboard has 15+ panels organized in rows:

1. **Price Action** — TradingView candlestick chart with your position's ENTRY/TP/SL lines.
2. **OKX Wallet** — mode badge (SIM/TESTNET/MAINNET), WebSocket status, real balance, open positions, mode-switch buttons.
3. **Credential Manager** — manage multiple OKX API key sets (see below).
4. **Crowd Engine** — 4 dimension gauges (funding, sentiment, buzz, composite) with extreme-zone indicators.
5. **Boule de Cristal** — live Binance liquidation feed, signal gauge (-1 to +1), TimeBandit strike status.
6. **Liquidation Sniper** — OI delta, long/short liquidation flow, cascade detector.
7. **Order Book** — L2 imbalance, bid/ask walls, spoofing/cancellation-delta detector.
8. **Toxic Flow + Domino** — MM-flight toxicity gauge + 3-venue cross-exchange domino.
9. **RegimeWeightRouter** — per-agent weight bars with live deflation/boost multipliers.
10. **Alpha Swarm** — 5 agent cards with signals, confidence, and rationale.
11. **Risk Aegis** — equity, daily drawdown bar (-3% threshold), open position, hors-dogme override log.
12. **Debate Chamber** — consensus signal, weighted vote split, conflict threshold meter.
13. **Execution Blade** — maker-grid tier visualization, maker rebates, slippage saved.
14. **Divine Arsenal** — 12 weapon cards with active/idle status and strike counts.
15. **Terminal** — neon live event log.

---

## Credential Management

The **Credential Manager** panel lets you manage multiple OKX API key sets without retyping:

### Adding Credentials

1. Go to [OKX → API Management](https://www.okx.com/account/my-api) and create a new API key.
2. In the dashboard, click **[New]** in the Credential Manager.
3. Enter a label (or leave blank for auto: `okx-1`, `okx-2`, ...).
4. Paste your **API Key** and **API Secret** from OKX.
5. Click **[Gen]** to auto-generate a strong 24-character passphrase — use this exact passphrase when creating your OKX API key.
6. Choose Testnet or Mainnet.
7. Click **Save**.

### Switching Between Credential Sets

- Each saved set has an **[Activate]** button. Click it to make that set the active one.
- The OKX Wallet panel automatically uses the active set when you switch to TESTNET or MAINNET.

### Exporting to a .txt File

- Click **[.txt]** on any credential set to download it as a text file.
- The file downloads to your browser's Downloads folder as `okx-credentials-{label}-{testnet|mainnet}.txt`.

### Importing from an External .txt File

- Click **[Import]** and select a previously exported `.txt` file.
- The file is parsed and saved as a new credential set.

### Viewing and Deleting

- Click **[Reveal]** to view the full API key, secret, and passphrase in plaintext (with copy buttons).
- Click **[Delete]** to permanently remove a credential set (with confirmation).

### Security

- Credentials are stored **obfuscated** (XOR cipher with your `OMEGA_SECRET_KEY`) in the local SQLite database — never in plaintext.
- They are sent to the engine **only** when you switch to a live mode.
- The `.env` file and `db/` directory are gitignored and never committed.

---

## Trading Modes

| Mode | Description | Risk |
|------|-------------|------|
| **SIM** | Synthetic market simulation. All data is simulated. No real orders. | Zero risk — for development and demonstration. |
| **TESTNET** | Real OKX WebSocket price feed + demo trading (OKX demo trading environment). Orders are placed but with virtual funds. | No real capital at risk. Use this to validate the system. |
| **MAINNET** | Real OKX price feed + real signed orders with your actual funds. | **REAL CAPITAL AT RISK.** Only use after extensive testnet validation. |

### How to Go Live

1. **Configure credentials** in the Credential Manager (see above).
2. **Activate** the credential set you want to use.
3. Click **TESTNET** in the OKX Wallet panel to connect to real OKX data with demo trading.
4. Observe the system for several days. Train the agents (see below).
5. Only when confident, switch to **MAINNET** with a small amount you can afford to lose.

> ⚠️ **The agents ship barely trained.** Before any live trading, run the RL trainer (see below) for many episodes. Untrained agents have negative Sharpe ratios and will lose money.

---

## The Divine Arsenal

The 12 weapons are described in the [Features](#features) section above. Each weapon exploits a structural flaw in crypto market microstructure that institutional algorithms cannot attack (too large, too slow, or blocked by compliance).

Weapons fire automatically when their detection conditions are met. You'll see them light up in the **Divine Arsenal** panel and log strikes in the **Terminal** with their dedicated emoji and neon color.

---

## RL Training

The omega-trainer service trains three agents using a real REINFORCE policy-gradient algorithm:

### Starting a Training Run

1. Open the omega-trainer terminal (Terminal 2 above).
2. The trainer auto-connects to the engine for live data.
3. From the dashboard (if a training panel is wired) or via socket.io, emit `trainer:start` with:
   ```json
   {
     "scenarios": ["flash_crash", "euphoria", "v_shape", "liquidation_cascade_long"],
     "episodesPerScenario": 10,
     "mode": "synthetic"
   }
   ```
4. Omit `scenarios` to train on all 15 scenarios.

### Training Scenarios

The synthetic data generator produces realistic bars for 15 market regimes:

`choppy`, `bull_trend`, `euphoria`, `blowoff_top`, `flash_crash`, `v_bounce`, `bear_trend`, `slow_bleed`, `dead_cat_bounce`, `range_breakout_up`, `range_breakout_down`, `high_vol_chop`, `gap_fill`, `liquidation_cascade_long`, `liquidation_cascade_short`.

### Modes

- **synthetic** — train on generated scenario data only.
- **live** — train on real OKX market data accumulated from the engine.
- **both** — train on synthetic then live.

---

## Project Structure

```
omega-hedge-fund/
├── src/                          # Next.js dashboard (port 3000)
│   ├── app/                      # App router pages + API routes
│   │   ├── page.tsx              # The God-Mode dashboard
│   │   └── api/
│   │       ├── credentials/      # Credential CRUD + generate/activate/reveal/export/import
│   │       └── training/         # Training run persistence
│   ├── components/omega/         # Dashboard panels (15+ components)
│   ├── hooks/                    # use-omega-engine (socket.io client)
│   └── lib/                      # crypto, db, omega-types
├── mini-services/
│   ├── omega-engine/             # Core trading engine (port 3003)
│   │   ├── index.ts              # Orchestrator + socket.io server
│   │   ├── market-sim.ts         # Regime-switching market simulation
│   │   ├── crowd-engine.ts       # Crowd positioning detection
│   │   ├── regime-router.ts      # Dynamic weight reconfiguration
│   │   ├── agents.ts             # 5-agent Alpha Swarm
│   │   ├── debate-chamber.ts     # MoE aggregation + conflict detection
│   │   ├── risk-aegis.ts         # Hors-dogme hard-stop + Kelly + ATR TP/SL
│   │   ├── execution-blade.ts    # Maker-grid execution
│   │   ├── crystal-ball.ts       # Binance liquidation feed
│   │   ├── time-bandit.ts        # Priority-0 pre-emption agent
│   │   ├── wall-breaker.ts       # Retail exhaustion detector
│   │   ├── ghost-protocol.ts     # Liquidity vacuum exploiter
│   │   ├── symphony-vector.ts    # BTC-oracle altcoin front-runner
│   │   ├── poison-pill.ts        # Mempool whale DEX shadowing
│   │   ├── quantum-arsenal.ts    # 8 Level-5/6 weapons
│   │   ├── okx-client.ts         # HMAC-signed OKX REST client
│   │   └── okx-ws.ts             # OKX WebSocket real-time feed
│   └── omega-trainer/            # RL training service (port 3004)
│       ├── index.ts              # socket.io server + live data client
│       ├── scenarios.ts          # 15-regime synthetic data generator
│       └── trainer.ts            # REINFORCE policy-gradient training
├── prisma/
│   └── schema.prisma             # Credential, TrainingRun, EquitySnapshot models
├── .env.example                  # Template for environment variables
└── package.json
```

---

## Disclaimer

This is an **architectural framework** for an institutional-grade trading system. Building, deploying, and operating such a system requires expertise in software engineering, distributed systems, financial mathematics, and risk management.

- **Trading cryptocurrencies involves substantial risk of loss.**
- The strategies implemented here are well-established in the quantitative finance literature but their application to live markets requires empirical validation beyond the scope of this codebase.
- **Never deploy with capital you cannot afford to lose.**
- Always start with testnet, paper-trade for weeks before live trading, and keep position sizes tiny until you have empirically validated every layer.
- The kill switch exists for a reason — when in doubt, the system halts.
- The Meta-Cognition layer's trade autopsy exists for a reason — when losses occur, the system learns.

The code in this repository is provided **as-is under the MIT license**. The authors are not responsible for any financial losses incurred through its use.

---

## License

[MIT](./LICENSE) — © OMEGA Quantitative Research
