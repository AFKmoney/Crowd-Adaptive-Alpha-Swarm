// OMEGA Engine — Telegram Alert System
//
// Real-time Telegram notifications for trades, breakthroughs, and risk events.
// The bot sends messages to a Telegram chat via the Bot API.
// You're not watching the dashboard 24/7 — Telegram is on your phone.

import type { EventType } from './types.ts'

export interface TelegramConfig {
  botToken: string
  chatId: string
}

export interface TelegramAlertState {
  connected: boolean
  messagesSent: number
  lastMessage: string | null
  lastMessageTs: number | null
  error: string | null
  // Alert filters
  alertTypes: EventType[]
  minConfidence: number  // only alert for signals >= this confidence
}

const DEFAULT_ALERT_TYPES: EventType[] = [
  'trade_open', 'trade_close', 'risk_override', 'risk_hard_stop',
  'time_bandit_strike', 'crowd_extreme', 'domino_strike',
  'spoof_detected', 'oi_cascade', 'liquidation_snipe',
  'consensus',
]

export class TelegramAlerter {
  private config: TelegramConfig | null = null
  private connected = false
  private messagesSent = 0
  private lastMessage: string | null = null
  private lastMessageTs: number | null = null
  private error: string | null = null
  private alertTypes: EventType[] = DEFAULT_ALERT_TYPES
  private minConfidence = 0.7
  private rateLimitMs = 2000 // 2s between messages
  private lastSendTs = 0

  configure(botToken: string, chatId: string): void {
    this.config = { botToken, chatId }
    this.connected = !!botToken && !!chatId
    if (this.connected) {
      this.send('🤖 OMEGA bot connected — you will receive real-time trading alerts here. Hors dogme. 🚀')
    }
  }

  get isConfigured(): boolean {
    return this.connected
  }

  /** Process an engine event and send a Telegram alert if it matches the filter. */
  async onEvent(type: EventType, message: string, details: Record<string, unknown>): Promise<void> {
    if (!this.connected || !this.config) return

    // Filter by event type
    if (!this.alertTypes.includes(type)) return

    // Filter by confidence (if present in details)
    const confidence = details.confidence as number
    if (typeof confidence === 'number' && confidence < this.minConfidence) return

    // Rate limit
    const now = Date.now()
    if (now - this.lastSendTs < this.rateLimitMs) return
    this.lastSendTs = now

    // Format the message
    const emoji = this.getEmoji(type)
    const formatted = `${emoji} *${type.replace(/_/g, ' ').toUpperCase()}*\n\n${message}`

    await this.send(formatted)
  }

  private async send(text: string): Promise<void> {
    if (!this.config) return
    try {
      const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) {
        const err = await res.text()
        this.error = `Telegram API: ${res.status} ${err.slice(0, 100)}`
        return
      }
      this.messagesSent++
      this.lastMessage = text.slice(0, 100)
      this.lastMessageTs = Date.now()
      this.error = null
    } catch (err) {
      this.error = `Send failed: ${String(err)}`
    }
  }

  private getEmoji(type: EventType): string {
    const map: Partial<Record<EventType, string>> = {
      trade_open: '🟢',
      trade_close: '🔵',
      risk_override: '🔥',
      risk_hard_stop: '🛡️',
      time_bandit_strike: '⏳',
      crowd_extreme: '⚠️',
      domino_strike: '⚡',
      spoof_detected: '🕵️',
      oi_cascade: '🌊',
      liquidation_snipe: '🎯',
      consensus: '🧠',
    }
    return map[type] || '📊'
  }

  state(): TelegramAlertState {
    return {
      connected: this.connected,
      messagesSent: this.messagesSent,
      lastMessage: this.lastMessage,
      lastMessageTs: this.lastMessageTs,
      error: this.error,
      alertTypes: this.alertTypes,
      minConfidence: this.minConfidence,
    }
  }
}
