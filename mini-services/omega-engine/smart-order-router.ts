// OMEGA Engine — Smart Order Router (SOR)
//
// Routes every order to the exchange with the best effective price (price + fees).
// Polls tickers from all connected exchanges in real-time and picks the best venue.
// Big banks have SOR teams of 20 people. We have an algorithm.

export type ExchangeId = 'okx' | 'coinbase' | 'kraken' | 'cryptocom' | 'metamask'

export interface VenueQuote {
  exchange: ExchangeId
  symbol: string
  bid: number
  ask: number
  spreadBps: number
  feeBps: number           // taker fee for this exchange
  effectiveBuyPrice: number  // ask + fee
  effectiveSellPrice: number // bid - fee
  latency: number           // estimated round-trip latency ms
  score: number             // 0..100, higher = better
}

export interface SmartOrderRouterState {
  quotes: VenueQuote[]
  bestBuyVenue: ExchangeId | null
  bestSellVenue: ExchangeId | null
  bestBuyPrice: number
  bestSellPrice: number
  savingsBps: number        // how much we save vs average
  lastUpdate: number
  routingDecisions: number  // cumulative
  routingHistory: Array<{ ts: number; exchange: ExchangeId; side: string; price: number; savingsBps: number }>
}

// Estimated taker fees per exchange (bps)
const EXCHANGE_FEES: Record<ExchangeId, number> = {
  okx: 5,
  coinbase: 6,
  kraken: 10,
  cryptocom: 4,
  metamask: 30, // Uniswap swap fee 0.3% = 30bps
}

// Estimated latencies
const EXCHANGE_LATENCY: Record<ExchangeId, number> = {
  okx: 50,
  coinbase: 80,
  kraken: 100,
  cryptocom: 60,
  metamask: 2000, // on-chain
}

export class SmartOrderRouter {
  private quotes: VenueQuote[] = []
  private routingDecisions = 0
  private routingHistory: SmartOrderRouterState['routingHistory'] = []

  /** Update quotes from ticker data. */
  updateQuotes(tickers: Array<{ exchange: string; symbol: string; price: number; bid: number; ask: number }>): void {
    const newQuotes: VenueQuote[] = []
    for (const ticker of tickers) {
      const exchange = ticker.exchange as ExchangeId
      const feeBps = EXCHANGE_FEES[exchange] || 10
      const latency = EXCHANGE_LATENCY[exchange] || 100
      const spreadBps = ticker.price > 0 ? ((ticker.ask - ticker.bid) / ticker.price) * 10000 : 0
      const effectiveBuyPrice = ticker.ask * (1 + feeBps / 10000)
      const effectiveSellPrice = ticker.bid * (1 - feeBps / 10000)
      const score = Math.max(0, 100 - spreadBps * 2 - feeBps - latency / 50)
      newQuotes.push({
        exchange, symbol: ticker.symbol, bid: ticker.bid, ask: ticker.ask,
        spreadBps: round(spreadBps, 1), feeBps,
        effectiveBuyPrice: round(effectiveBuyPrice, 2),
        effectiveSellPrice: round(effectiveSellPrice, 2),
        latency, score: round(score, 1),
      })
    }
    this.quotes = newQuotes
  }

  state(): SmartOrderRouterState {
    if (this.quotes.length === 0) {
      return {
        quotes: [], bestBuyVenue: null, bestSellVenue: null,
        bestBuyPrice: 0, bestSellPrice: 0, savingsBps: 0,
        lastUpdate: 0, routingDecisions: 0, routingHistory: [],
      }
    }
    const bestBuy = this.quotes.reduce((min, q) => q.effectiveBuyPrice < min.effectiveBuyPrice ? q : min, this.quotes[0])
    const bestSell = this.quotes.reduce((max, q) => q.effectiveSellPrice > max.effectiveSellPrice ? q : max, this.quotes[0])
    const avgBuy = this.quotes.reduce((a, q) => a + q.effectiveBuyPrice, 0) / this.quotes.length
    const savings = avgBuy > 0 ? ((avgBuy - bestBuy.effectiveBuyPrice) / avgBuy) * 10000 : 0
    return {
      quotes: this.quotes.sort((a, b) => b.score - a.score),
      bestBuyVenue: bestBuy.exchange, bestSellVenue: bestSell.exchange,
      bestBuyPrice: bestBuy.effectiveBuyPrice, bestSellPrice: bestSell.effectiveSellPrice,
      savingsBps: round(savings, 1), lastUpdate: Date.now(),
      routingDecisions: this.routingDecisions, routingHistory: this.routingHistory,
    }
  }
}

function round(x: number, d: number) { const f = 10 ** d; return Math.round(x * f) / f }
