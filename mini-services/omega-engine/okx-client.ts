// OMEGA Engine — OKX REST client (real exchange connectivity)
//
// HMAC-SHA256 signed REST client for OKX v5 API. Supports:
//   - Public endpoints (no auth): ticker, candles, funding rate
//   - Authenticated endpoints: account balance, place order, cancel order, positions
//   - Testnet (demo trading) via the x-simulated-trading: 1 header
//
// In SIM mode the engine never calls this. In TESTNET/MAINNET mode the engine
// uses the public endpoints for real market data and the auth endpoints for
// real order execution (only when credentials are configured).
//
// OKX API docs: https://www.okx.com/docs-v5/en/

import { createHmac } from 'node:crypto'

const MAINNET_BASE = 'https://www.okx.com'
const INST_ID = 'BTC-USDT-SWAP' // OKX perpetual

export type OkxMode = 'sim' | 'testnet' | 'mainnet'

export interface OkxCredentials {
  apiKey: string
  apiSecret: string
  passphrase: string
}

export interface OkxBalance {
  totalEqUsd: number
  availBalUsd: number
  marginRatio: number
  raw: unknown
}

export interface OkxOrderResult {
  ordId: string
  sCode: number // OKX status code (0 = success)
  sMsg: string
  raw: unknown
}

export interface OkxPosition {
  instId: string
  posSide: 'long' | 'short' | 'net'
  pos: number // contracts
  posCcy: string
  avgPx: number
  upl: number // unrealized PnL in USDT
  uplRatio: number
  lever: string
  margin: string
  raw: unknown
}

export class OkxClient {
  mode: OkxMode = 'sim'
  private creds: OkxCredentials | null = null
  private base = MAINNET_BASE

  configure(mode: OkxMode, creds: OkxCredentials | null) {
    this.mode = mode
    this.creds = creds
    // OKX uses the same base URL for both; demo trading is enabled via header.
    this.base = MAINNET_BASE
  }

  get hasCredentials(): boolean {
    return !!this.creds && !!this.creds.apiKey && !!this.creds.apiSecret && !!this.creds.passphrase
  }

  // ---- Public endpoints (no auth) ----

  /** Fetch the latest ticker for BTC-USDT-SWAP. */
  async getTicker(): Promise<{ last: number; bid: number; ask: number; ts: number }> {
    const res = await fetch(`${this.base}/api/v5/market/ticker?instId=${INST_ID}`)
    if (!res.ok) throw new Error(`OKX ticker HTTP ${res.status}`)
    const json = await res.json() as { code: string; data: Array<{ last: string; bidPx: string; askPx: string; ts: string }> }
    if (json.code !== '0' || !json.data?.length) throw new Error(`OKX ticker error: ${json.code}`)
    const d = json.data[0]
    return { last: parseFloat(d.last), bid: parseFloat(d.bidPx), ask: parseFloat(d.askPx), ts: parseInt(d.ts) }
  }

  /** Fetch recent candles (1s bars). Returns array newest-first. */
  async getCandles(limit = 60): Promise<Array<{ ts: number; open: number; high: number; low: number; close: number; vol: number }>> {
    const res = await fetch(`${this.base}/api/v5/market/candles?instId=${INST_ID}&bar=1s&limit=${limit}`)
    if (!res.ok) throw new Error(`OKX candles HTTP ${res.status}`)
    const json = await res.json() as { code: string; data: string[][] }
    if (json.code !== '0' || !json.data) throw new Error(`OKX candles error: ${json.code}`)
    // OKX returns: [ts, open, high, low, close, vol, volCcy, volCcyQuote, confirm]
    return json.data.map((c) => ({
      ts: parseInt(c[0]),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      vol: parseFloat(c[5]),
    }))
  }

  /** Fetch the current funding rate for BTC-USDT-SWAP. */
  async getFundingRate(): Promise<{ rate: number; nextFundingTs: number }> {
    const res = await fetch(`${this.base}/api/v5/public/funding-rate?instId=${INST_ID}`)
    if (!res.ok) throw new Error(`OKX funding HTTP ${res.status}`)
    const json = await res.json() as { code: string; data: Array<{ fundingRate: string; nextFundingTime: string }> }
    if (json.code !== '0' || !json.data?.length) throw new Error(`OKX funding error: ${json.code}`)
    return { rate: parseFloat(json.data[0].fundingRate), nextFundingTs: parseInt(json.data[0].nextFundingTime) }
  }

  // ---- Authenticated endpoints (need creds) ----

  /** Fetch account balance. Requires credentials. */
  async getBalance(): Promise<OkxBalance> {
    this.requireAuth()
    const path = '/api/v5/account/balance'
    const json = await this.signedGet(path)
    const d = (json.data?.[0] ?? {}) as { totalEq?: string; details?: Array<{ availBal?: string; availEq?: string }> }
    const detail = d.details?.[0] ?? {}
    return {
      totalEqUsd: parseFloat(d.totalEq ?? '0'),
      availBalUsd: parseFloat(detail.availBal ?? detail.availEq ?? '0'),
      marginRatio: 0, // needs /api/v5/account/account-risk-rate; omitted for simplicity
      raw: json,
    }
  }

  /** Fetch open positions. */
  async getPositions(): Promise<OkxPosition[]> {
    this.requireAuth()
    const path = `/api/v5/account/positions?instId=${INST_ID}`
    const json = await this.signedGet(path)
    if (!json.data) return []
    return (json.data as Array<Record<string, string>>).map((p) => ({
      instId: p.instId ?? INST_ID,
      posSide: (p.posSide as 'long' | 'short' | 'net') ?? 'net',
      pos: parseFloat(p.pos ?? '0'),
      posCcy: p.posCcy ?? '',
      avgPx: parseFloat(p.avgPx ?? '0'),
      upl: parseFloat(p.upl ?? '0'),
      uplRatio: parseFloat(p.uplRatio ?? '0'),
      lever: p.lever ?? '1',
      margin: p.margin ?? '0',
      raw: p,
    }))
  }

  /** Place a market order. side = 'buy' | 'sell'. sz = number of contracts. */
  async placeMarketOrder(side: 'buy' | 'sell', sz: number): Promise<OkxOrderResult> {
    this.requireAuth()
    const body = {
      instId: INST_ID,
      tdMode: 'cross', // cross margin
      side,
      ordType: 'market',
      sz: String(sz),
    }
    const json = await this.signedPost('/api/v5/trade/order', body)
    const d = (json.data?.[0] ?? {}) as { ordId?: string; sCode?: string; sMsg?: string }
    return {
      ordId: d.ordId ?? '',
      sCode: parseInt(d.sCode ?? json.code ?? '1'),
      sMsg: d.sMsg ?? json.msg ?? '',
      raw: json,
    }
  }

  /** Place a limit order at a specific price. */
  async placeLimitOrder(side: 'buy' | 'sell', sz: number, px: number): Promise<OkxOrderResult> {
    this.requireAuth()
    const body = {
      instId: INST_ID,
      tdMode: 'cross',
      side,
      ordType: 'limit',
      sz: String(sz),
      px: String(px),
    }
    const json = await this.signedPost('/api/v5/trade/order', body)
    const d = (json.data?.[0] ?? {}) as { ordId?: string; sCode?: string; sMsg?: string }
    return {
      ordId: d.ordId ?? '',
      sCode: parseInt(d.sCode ?? json.code ?? '1'),
      sMsg: d.sMsg ?? json.msg ?? '',
      raw: json,
    }
  }

  /** Cancel an order by ordId. */
  async cancelOrder(ordId: string): Promise<OkxOrderResult> {
    this.requireAuth()
    const body = { instId: INST_ID, ordId }
    const json = await this.signedPost('/api/v5/trade/cancel-order', body)
    const d = (json.data?.[0] ?? {}) as { sCode?: string; sMsg?: string }
    return {
      ordId,
      sCode: parseInt(d.sCode ?? json.code ?? '1'),
      sMsg: d.sMsg ?? json.msg ?? '',
      raw: json,
    }
  }

  // ---- Internal signing helpers ----

  private requireAuth() {
    if (!this.hasCredentials || !this.creds) {
      throw new Error('OKX auth required but no credentials configured')
    }
  }

  private sign(timestamp: string, method: string, requestPath: string, body: string): string {
    const prehash = timestamp + method.toUpperCase() + requestPath + body
    return createHmac('sha256', this.creds!.apiSecret).update(prehash).digest('base64')
  }

  private authHeaders(method: string, requestPath: string, body: string): Record<string, string> {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    const sign = this.sign(timestamp, method, requestPath, body)
    const headers: Record<string, string> = {
      'OKX-ACCESS-KEY': this.creds!.apiKey,
      'OKX-ACCESS-SIGN': sign,
      'OKX-ACCESS-TIMESTAMP': timestamp,
      'OKX-ACCESS-PASSPHRASE': this.creds!.passphrase,
      'Content-Type': 'application/json',
    }
    // Demo trading (testnet) header
    if (this.mode === 'testnet') {
      headers['x-simulated-trading'] = '1'
    }
    return headers
  }

  private async signedGet(requestPath: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.base}${requestPath}`, {
      method: 'GET',
      headers: this.authHeaders('GET', requestPath, ''),
    })
    if (!res.ok) throw new Error(`OKX GET ${requestPath} HTTP ${res.status}`)
    return res.json() as Promise<Record<string, unknown>>
  }

  private async signedPost(requestPath: string, bodyObj: unknown): Promise<Record<string, unknown>> {
    const body = JSON.stringify(bodyObj)
    const res = await fetch(`${this.base}${requestPath}`, {
      method: 'POST',
      headers: this.authHeaders('POST', requestPath, body),
      body,
    })
    if (!res.ok) throw new Error(`OKX POST ${requestPath} HTTP ${res.status}`)
    return res.json() as Promise<Record<string, unknown>>
  }
}

export { INST_ID }
