# 🐺 Crowd-Adaptive Alpha Swarm

> An autonomous, multi-agent crypto trading system that detects crowd extremes and fades them — the contrarian edge that institutions can't execute.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-runtime-f9f1e0)](https://bun.sh/)

---

## 📖 Overview

**Crowd-Adaptive Alpha Swarm** is an institutional-grade trading system built on a single thesis:

> *80% of traders lose because they do what 80% do. This system does the inverse — but only at quantified extremes, not blindly.*

It ingests every market-informative signal — order book microstructure, funding rates, social sentiment, cross-exchange liquidations, on-chain whale movements — and routes them through a Mixture-of-Experts Alpha Swarm with **dynamic weight reconfiguration** driven by crowd extremes.

When the crowd is overcrowded at a statistical extreme, the system deflates crowd-following agents and boosts contrarians — capturing the liquidation cascade that inevitably follows.

### Core Edge

The system unifies three alpha sources:
1. **Narrative alpha** — LLM macro analysis, news sentiment, social buzz
2. **Microstructure alpha** — funding rates, order book imbalance, liquidations, OI delta
3. **Regime-adaptive allocation** — HMM regime detection + dynamic weight routing

All filtered through one question: *is the crowd on the same side as me?* If yes — fade. If no — follow.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│  Layer 1 — Data Nexus                                │
│  OKX WebSocket · 5 exchange adapters · Synthetic sim │
├──────────────────────────────────────────────────────┤
│  Layer 1.5 — Crowd Engine                            │
│  Funding · Sentiment · Buzz · Composite score        │
├──────────────────────────────────────────────────────┤
│  Layer 2 — Alpha Swarm (Mixture of Experts)          │
│  PPO Trend · PPO MeanRev · LLM Macro · StatArb ·     │
│  Contrarian Crowd Agent                              │
├──────────────────────────────────────────────────────┤
│  Layer 2.5 — Boule de Cristal + TimeBandit           │
│  Binance liquidation feed → priority-0 strike        │
├──────────────────────────────────────────────────────┤
│  Layer 3 — Regime Detector + Weight Router           │
│  HMM regimes · Dynamic crowd-deflation weights       │
├──────────────────────────────────────────────────────┤
│  Layer 3.5 — Divine Arsenal (12 weapons)             │
│  Wall Breaker · Ghost Protocol · Symphony Vector ·   │
│  Poison Pill · Chronos · Gamma · Event Horizon ·     │
│  Iceberg Sonar · CEX Vampire · Cross-Pair ·          │
│  Engine Overload · Correlated Domino                 │
├──────────────────────────────────────────────────────┤
│  Layer 3.7 — Breakthrough Lab (25 concepts)          │
│  Quantum Entanglement · Dark Pool Radar · VPIN ·     │
│  Whale Tracker · Depeg Sentinel · Flash Loan ·       │
│  Bridge Arb · Max Pain · Funding Arb · ...           │
├──────────────────────────────────────────────────────┤
│  Layer 4 — Risk Aegis                                │
│  Kelly sizing · ATR-dynamic TP/SL · Hors-Dogme       │
│  hard-stop with contrarian override                  │
├──────────────────────────────────────────────────────┤
│  Layer 5 — Execution Blade                           │
│  Maker-Grid (3-tier limit spiderweb) · Market        │
├──────────────────────────────────────────────────────┤
│  Layer 6 — Multi-Exchange                            │
│  OKX · Coinbase · Kraken · Crypto.com · MetaMask/DEX │
├──────────────────────────────────────────────────────┤
│  Layer 7 — Market Scanner                            │
│  32 symbols · 5 sectors · Meme detector ·            │
│  Sector rotation                                     │
└──────────────────────────────────────────────────────┘
```

---

## ✨ Features

### Trading Intelligence (50+ alpha signals)
- **Crowd Engine** — tracks funding rate, sentiment, social buzz, Fear & Greed, composite crowd score
- **Dynamic Weight Reconfiguration** — crowd extremes deflate crowd-followers, boost contrarians in real time
- **Debate Chamber** — MoE aggregation with explicit conflict detection (defers on disagreement)
- **Boule de Cristal + TimeBandit** — Binance liquidation feed with priority-0 pre-emption (99% confidence)
- **Liquidation Sniper** — OI delta probe, cascade detection, wick capture
- **Order Book Wall + Spoofing** — cancellation-delta detection, front-runs fake walls
- **Toxic Flow Vampire** — MM-flight detection, rides toxic pressure
- **Cross-Exchange Domino** — 3-venue temporal strike (Bybit liq → short OKX)

### Divine Arsenal (12 Weapons)
Wall Breaker, Ghost Protocol, Symphony Vector, Poison Pill, Chronos Parasite, Gamma Squeeze, Event Horizon, Iceberg Sonar, CEX Inflow Vampire, Cross-Pair Vacuum, Engine Overload, Correlated Domino.

### Breakthrough Lab (25 Concepts)
Quantum Entanglement, Dark Pool Radar, Funding Arb Terminator, VPIN Toxicity, Whale Wallet Tracker, Depeg Sentinel, Perp Basis Sniper, MEV Sandwich, Social Tsunami, Options Max Pain, Funding Mean Reversion, Volume Profile, Flash Loan Predator, Bridge Arb, Liq Heatmap Prophet, Tether Printer, Exchange Drain, Miner Capitulation, OI Divergence, Smart Money Shadow, Vol Crush, DEX Pool Drain, Correlation Break, Narrative Alpha.

### Risk Management
- **Hors-Dogme Override** — -3% daily drawdown hard-stop bypassed by viable contrarian opportunities
- **ATR-Dynamic TP/SL** — elastic asymmetry (3.3:1 contrarian, widens with volatility)
- **Fractional Kelly Sizing** — with asymmetric loss-streak penalties

### Execution
- **Maker-Grid** — 3-tier limit spiderweb at -0.1% / -0.5% / -1.0%, zero taker fees, maker rebates

### Multi-Exchange Support
OKX, Coinbase Advanced, Kraken, Crypto.com Exchange, MetaMask/Web3 DEX (Uniswap) — unified adapter interface, smart order routing, best-price aggregation.

### Market Scanner
32 symbols across 5 sectors (Layer 1, Layer 2, DeFi, Meme, Stable), meme pump/dump detector, sector rotation with capital allocation, market breadth indicator.

### Dashboard ("God Mode" Terminal)
- **Glassmorphism dark UI** — translucent panels, ambient gradient glows
- **TradingView Lightweight Charts** — real candlestick chart with ENTRY/TP/SL lines
- **Neon event terminal** — color-coded live stream with glow effects
- **19+ live panels** — Price Action, Crowd Engine, Boule de Cristal, Liquidation Sniper, Order Book, Toxic Flow, RegimeWeightRouter, Alpha Swarm, Risk Aegis, Debate Chamber, Execution Blade, Divine Arsenal, Breakthrough Lab, Market Scanner, Multi-Exchange, Credential Manager, Terminal

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and **Bun** (or npm)
- Windows, macOS, or Linux

### Installation

```bash
git clone https://github.com/AFKmoney/Crowd-Adaptive-Alpha-Swarm.git
cd Crowd-Adaptive-Alpha-Swarm

# Install dependencies
bun install
cd mini-services/omega-engine && bun install && cd ../..
cd mini-services/omega-trainer && bun install && cd ../..

# Create .env
cp .env.example .env
# Edit .env: set OMEGA_SECRET_KEY to a random string

# Initialize database
bun run db:push
```

### Running

Open **three terminals**:

```bash
# Terminal 1 — Trading Engine (port 3003)
cd mini-services/omega-engine && bun run dev

# Terminal 2 — RL Trainer (port 3004, optional)
cd mini-services/omega-trainer && bun run dev

# Terminal 3 — Dashboard (port 3000)
bun run dev
```

Open `http://localhost:3000` in your browser.

---

## 📊 Dashboard Guide

| Panel | Description |
|-------|-------------|
| **Price Action** | TradingView candlestick chart with position lines |
| **OKX Wallet** | Mode badge, balance, positions, mode switch |
| **Credential Manager** | Multi-set API key storage with import/export |
| **Multi-Exchange** | 5 exchange adapters with connection status |
| **Market Scanner** | 32 symbols, sector heatmap, top opportunities |
| **Crowd Engine** | Funding/sentiment/buzz/composite gauges |
| **Boule de Cristal** | Binance liquidation feed + TimeBandit |
| **Liquidation Sniper** | OI delta, cascade detector |
| **Order Book** | L2 imbalance, walls, spoofing detector |
| **RegimeWeightRouter** | Agent weights with live multipliers |
| **Alpha Swarm** | 5 agent cards with signals |
| **Risk Aegis** | Equity, drawdown, hors-dogme override |
| **Divine Arsenal** | 12 weapon cards |
| **Breakthrough Lab** | 25 concept cards |
| **Terminal** | Neon live event log |

---

## 🔐 Credential Management

- Add multiple API key sets (OKX, Coinbase, Kraken, Crypto.com, MetaMask)
- Auto-generate strong passphrases
- Export/import `.txt` files
- One-click activation (switch without retyping)
- Reveal/hide keys, delete sets
- Credentials obfuscated at rest (XOR cipher with `OMEGA_SECRET_KEY`)

---

## 📁 Project Structure

```
Crowd-Adaptive-Alpha-Swarm/
├── src/                          # Next.js dashboard
│   ├── app/                      # Pages + API routes
│   ├── components/omega/         # 19+ dashboard panels
│   ├── hooks/                    # Socket.io client hook
│   └── lib/                      # Crypto, DB, types
├── mini-services/
│   ├── omega-engine/             # Core trading engine (port 3003)
│   │   ├── index.ts              # Orchestrator
│   │   ├── market-sim.ts         # Market simulation
│   │   ├── crowd-engine.ts       # Crowd positioning
│   │   ├── regime-router.ts      # Dynamic weight reconfiguration
│   │   ├── agents.ts             # 5-agent Alpha Swarm
│   │   ├── risk-aegis.ts         # Hors-dogme risk layer
│   │   ├── execution-blade.ts    # Maker-grid execution
│   │   ├── crystal-ball.ts       # Binance liquidation feed
│   │   ├── time-bandit.ts        # Priority-0 agent
│   │   ├── wall-breaker.ts       # Retail exhaustion
│   │   ├── ghost-protocol.ts     # Liquidity vacuum
│   │   ├── breakthrough-lab.ts   # 25 disruptive concepts
│   │   ├── market-scanner.ts     # 32-symbol scanner
│   │   ├── exchange/             # 5 exchange adapters
│   │   └── okx-client.ts         # OKX REST + WebSocket
│   └── omega-trainer/            # RL training (port 3004)
├── prisma/                       # Database schema
└── .env.example                  # Environment template
```

---

## ⚠️ Disclaimer

This is an **architectural framework**, not financial advice.

- Trading cryptocurrencies involves **substantial risk of loss**
- The agents ship **barely trained** — run the RL trainer before live trading
- Always start with **testnet** or **tiny amounts** you can afford to lose
- The kill switch exists for a reason — when in doubt, the system halts

The code is provided **as-is under the MIT license**. The authors are not responsible for any financial losses.

---

## 📄 License

[MIT](./LICENSE) — © Crowd-Adaptive Alpha Swarm
