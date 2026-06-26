// OMEGA Engine — OKX WebSocket public feed (real-time market data)
//
// Connects to wss://ws.okx.com:8443/ws/v5/public and subscribes to the
// BTC-USDT-SWAP ticker + 1s candles. Emits a continuous stream of real
// market ticks that replace the MarketSim synthetic feed in live mode.
//
// Reconnects with exponential backoff on disconnect. No auth needed for
// public market data — this works even without credentials, so live PRICE
// observation is possible before the user configures their API keys.

import WebSocket from 'ws'
import type { OkxMode } from './okx-client.ts'
import { INST_ID } from './okx-client.ts'

export interface OkxLiveTick {
  ts: number
  price: number
  bid: number
  ask: number
  changePct24h: number
  // OHLC of the current 1s candle (built incrementally)
  open: number
  high: number
  low: number
  close: number
  vol: number
  fundingRate: number
  source: 'okx'
}

type TickListener = (tick: OkxLiveTick) => void

export class OkxWebSocket {
  private ws: WebSocket | null = null
  private mode: OkxMode = 'sim'
  private connected = false
  private listeners: TickListener[] = []
  private reconnectAttempts = 0
  private lastPrice = 0
  private candleOpen = 0
  private candleHigh = 0
  private candleLow = Infinity
  private candleClose = 0
  private candleVol = 0
  private candleTs = 0
  private fundingRate = 0
  private change24h = 0
  private intentionalClose = false

  configure(mode: OkxMode) {
    this.mode = mode
  }

  get isConnected(): boolean {
    return this.connected
  }

  onTick(fn: TickListener) {
    this.listeners.push(fn)
  }

  /** Start the WebSocket connection. */
  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }
    this.intentionalClose = false
    const url = 'wss://ws.okx.com:8443/ws/v5/public'
    console.log(`[okx-ws] connecting to ${url} (mode=${this.mode})...`)
    try {
      this.ws = new WebSocket(url)
    } catch (err) {
      console.error(`[okx-ws] failed to create WebSocket:`, err)
      this.scheduleReconnect()
      return
    }

    this.ws.on('open', () => {
      console.log('[okx-ws] connected — subscribing to ticker + candles')
      this.connected = true
      this.reconnectAttempts = 0
      // Subscribe to ticker (gives last price, bid/ask, 24h change)
      this.ws!.send(JSON.stringify({ op: 'subscribe', args: [{ channel: 'tickers', instId: INST_ID }] }))
      // Subscribe to 1s candles (gives OHLCV)
      this.ws!.send(JSON.stringify({ op: 'subscribe', args: [{ channel: 'candle1s', instId: INST_ID }] }))
    })

    this.ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString())
        this.handleMessage(msg)
      } catch {
        // ignore non-JSON (e.g. pong)
      }
    })

    this.ws.on('close', () => {
      this.connected = false
      console.log('[okx-ws] disconnected')
      if (!this.intentionalClose) this.scheduleReconnect()
    })

    this.ws.on('error', (err: Error) => {
      console.error('[okx-ws] error:', err.message)
      this.connected = false
      // close handler will reconnect
    })

    // Ping every 20s to keep alive (OKX expects ping frame, but text ping works too)
    const pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping()
      }
    }, 20000)
    this.ws.on('close', () => clearInterval(pingInterval))
  }

  disconnect() {
    this.intentionalClose = true
    if (this.ws) {
      try { this.ws.close() } catch { /* noop */ }
      this.ws = null
    }
    this.connected = false
  }

  private handleMessage(msg: Record<string, unknown>) {
    if (!msg.arg || !msg.data) return
    const arg = msg.arg as { channel: string; instId: string }
    const data = msg.data as Array<Record<string, string>>

    if (arg.channel === 'tickers' && data.length) {
      const t = data[0]
      const price = parseFloat(t.last ?? '0')
      if (price > 0) {
        this.lastPrice = price
        const bid = parseFloat(t.bidPx ?? '0')
        const ask = parseFloat(t.askPx ?? '0')
        this.change24h = parseFloat(t.last ?? '0') && parseFloat(t.open24h ?? '0')
          ? ((parseFloat(t.last) - parseFloat(t.open24h)) / parseFloat(t.open24h)) * 100
          : 0
        this.emit({ ts: parseInt(t.ts ?? String(Date.now())), price, bid, ask })
      }
    } else if (arg.channel === 'candle1s' && data.length) {
      // OKX candle: [ts, open, high, low, close, vol, volCcy, volCcyQuote, confirm]
      const c = data[0]
      const candleData = c as unknown as string[]
      const ts = parseInt(candleData[0])
      const o = parseFloat(candleData[1])
      const h = parseFloat(candleData[2])
      const l = parseFloat(candleData[3])
      const cl = parseFloat(candleData[4])
      const v = parseFloat(candleData[5])
      if (ts !== this.candleTs) {
        // new candle started
        this.candleTs = ts
        this.candleOpen = o
        this.candleHigh = h
        this.candleLow = l
      } else {
        this.candleHigh = Math.max(this.candleHigh, h)
        this.candleLow = Math.min(this.candleLow === 0 ? l : this.candleLow, l)
      }
      this.candleClose = cl
      this.candleVol = v
      if (cl > 0) {
        this.lastPrice = cl
        this.emit({ ts, price: cl, bid: cl, ask: cl })
      }
    }
  }

  private emit(partial: { ts: number; price: number; bid: number; ask: number }) {
    if (this.lastPrice <= 0) return
    const tick: OkxLiveTick = {
      ts: partial.ts,
      price: this.lastPrice,
      bid: partial.bid || this.lastPrice,
      ask: partial.ask || this.lastPrice,
      changePct24h: this.change24h,
      open: this.candleOpen || this.lastPrice,
      high: this.candleHigh || this.lastPrice,
      low: (this.candleLow > 0 ? this.candleLow : this.lastPrice),
      close: this.candleClose || this.lastPrice,
      vol: this.candleVol,
      fundingRate: this.fundingRate,
      source: 'okx',
    }
    for (const fn of this.listeners) {
      try { fn(tick) } catch { /* noop */ }
    }
  }

  private scheduleReconnect() {
    this.reconnectAttempts++
    const delay = Math.min(30000, 1000 * 2 ** this.reconnectAttempts)
    console.log(`[okx-ws] reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`)
    setTimeout(() => {
      if (!this.intentionalClose) this.connect()
    }, delay)
  }
}
