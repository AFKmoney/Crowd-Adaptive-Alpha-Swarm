'use client'

import { useState, useEffect } from 'react'
import { Wallet, Power, ShieldAlert, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import type { LiveStatus, LiveMode } from '@/lib/omega-types'

interface LivePanelProps {
  live: LiveStatus
  configureMode: (mode: LiveMode, creds?: { apiKey: string; apiSecret: string; passphrase: string }) => Promise<{ ok: boolean; error?: string }>
}

const MODE_STYLES: Record<LiveMode, { label: string; text: string; bg: string; border: string; ring: string }> = {
  sim: { label: 'SIM', text: 'text-zinc-300', bg: 'bg-zinc-700/60', border: 'border-zinc-600', ring: 'ring-zinc-500' },
  testnet: { label: 'TESTNET', text: 'text-amber-300', bg: 'bg-amber-500/20', border: 'border-amber-500/50', ring: 'ring-amber-500' },
  mainnet: { label: 'MAINNET', text: 'text-rose-300', bg: 'bg-rose-500/20', border: 'border-rose-500/50', ring: 'ring-rose-500' },
}

export function LivePanel({ live, configureMode }: LivePanelProps) {
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [credsConfigured, setCredsConfigured] = useState(false)
  const [showCreds, setShowCreds] = useState(false)

  // Check if credentials are already saved in the DB
  useEffect(() => {
    fetch('/api/credentials/status')
      .then((r) => r.json())
      .then((d) => setCredsConfigured(!!d.configured))
      .catch(() => { /* noop */ })
  }, [live.credentialsConfigured])

  const mode = live.mode
  const modeStyle = MODE_STYLES[mode]
  const isMainnet = mode === 'mainnet'
  const isLive = mode !== 'sim'

  async function saveCredsAndSwitch(targetMode: LiveMode) {
    setBusy(true)
    setMsg(null)
    try {
      // If creds fields are filled, save to DB first
      let creds: { apiKey: string; apiSecret: string; passphrase: string } | undefined
      if (apiKey && apiSecret && passphrase) {
        const saveRes = await fetch('/api/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exchange: 'okx', apiKey, apiSecret, passphrase, testnet: targetMode === 'testnet' }),
        })
        if (!saveRes.ok) {
          const err = await saveRes.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to save credentials')
        }
        creds = { apiKey, apiSecret, passphrase }
        setCredsConfigured(true)
        // Clear the fields after save
        setApiKey('')
        setApiSecret('')
        setPassphrase('')
      }
      // Send to the engine
      const ack = await configureMode(targetMode, creds)
      if (!ack.ok) throw new Error(ack.error || 'Engine rejected configuration')
      setMsg({ type: 'ok', text: `Mode switched to ${targetMode.toUpperCase()}${creds ? ' with saved credentials' : ''}` })
    } catch (e) {
      setMsg({ type: 'err', text: String((e as Error).message || e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`flex h-full flex-col rounded-xl border p-4 backdrop-blur-sm sm:p-5 transition-colors ${
      isMainnet ? 'border-rose-500/50 bg-rose-500/5 shadow-[0_0_25px_rgba(244,63,94,0.12)]' :
      isLive ? 'border-amber-500/40 bg-amber-500/5' :
      'border-zinc-800/60 bg-zinc-900/30'
    }`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet className={`h-4 w-4 ${isMainnet ? 'text-rose-400' : isLive ? 'text-amber-400' : 'text-zinc-400'}`} />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">OKX Wallet</h2>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">{live.instId}</span>
        </div>
        <div className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 ${modeStyle.bg} ${modeStyle.border}`}>
          <Power className={`h-3 w-3 ${modeStyle.text}`} />
          <span className={`text-[10px] font-bold uppercase tracking-wider ${modeStyle.text}`}>{modeStyle.label}</span>
        </div>
      </div>

      {/* MAINNET danger banner */}
      {isMainnet && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-pulse text-rose-400" />
          <span>
            <strong className="text-rose-300">MAINNET — REAL CAPITAL AT RISK.</strong> Real orders will be placed on OKX with your actual funds.
            The agents are barely trained. Start with a tiny amount you can afford to lose. Testnet first is strongly recommended.
          </span>
        </div>
      )}

      {/* Connection + credential status */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className={`rounded-lg border px-3 py-2 ${live.okxConnected ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/40'}`}>
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
            <span className={`h-1.5 w-1.5 rounded-full ${live.okxConnected ? 'animate-pulse bg-emerald-400' : 'bg-zinc-600'}`} /> OKX WebSocket
          </div>
          <div className={`font-mono text-sm font-semibold ${live.okxConnected ? 'text-emerald-300' : 'text-zinc-500'}`}>
            {live.okxConnected ? 'CONNECTED' : 'OFFLINE'}
          </div>
        </div>
        <div className={`rounded-lg border px-3 py-2 ${live.credentialsConfigured || credsConfigured ? 'border-teal-500/30 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/40'}`}>
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
            <Wallet className="h-3 w-3" /> Credentials
          </div>
          <div className={`font-mono text-sm font-semibold ${live.credentialsConfigured || credsConfigured ? 'text-teal-300' : 'text-zinc-500'}`}>
            {live.credentialsConfigured || credsConfigured ? 'CONFIGURED' : 'NOT SET'}
          </div>
        </div>
      </div>

      {/* Real account balance (live mode only) */}
      {isLive && (live.credentialsConfigured || credsConfigured) && (
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-2.5 py-1.5">
            <div className="text-[9px] uppercase tracking-wider text-zinc-500">Equity</div>
            <div className="font-mono text-sm font-bold tabular-nums text-zinc-100">${live.balanceUsd.toFixed(2)}</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-2.5 py-1.5">
            <div className="text-[9px] uppercase tracking-wider text-zinc-500">Available</div>
            <div className="font-mono text-sm font-bold tabular-nums text-zinc-200">${live.availableUsd.toFixed(2)}</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-2.5 py-1.5">
            <div className="text-[9px] uppercase tracking-wider text-zinc-500">Live Trades</div>
            <div className="font-mono text-sm font-bold tabular-nums text-amber-300">{live.liveTrades}</div>
          </div>
        </div>
      )}

      {/* Real positions */}
      {isLive && live.realPositions.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">Open Positions (OKX)</div>
          {live.realPositions.map((p, i) => (
            <div key={i} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1 text-[10px] font-mono">
              <span className={p.side === 'long' ? 'text-emerald-300' : p.side === 'short' ? 'text-rose-300' : 'text-zinc-300'}>
                {p.side.toUpperCase()} {p.pos} @ {p.avgPx.toFixed(2)}
              </span>
              <span className={p.upl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                {p.upl >= 0 ? '+' : ''}{p.upl.toFixed(2)} ({(p.uplRatio * 100).toFixed(2)}%)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Last order result */}
      {isLive && live.lastOrderResult && (
        <div className={`mt-2 rounded-md border px-2.5 py-1.5 text-[10px] ${live.lastOrderResult.sCode === 0 ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300' : 'border-rose-500/30 bg-rose-500/5 text-rose-300'}`}>
          <span className="font-mono">Last order #{live.lastOrderResult.ordId}: {live.lastOrderResult.sMsg}</span>
        </div>
      )}

      {/* Credential input form */}
      <div className="mt-3">
        <button
          onClick={() => setShowCreds(!showCreds)}
          className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
        >
          {showCreds ? '− Hide' : '+ Configure'} OKX API credentials
        </button>
        {showCreds && (
          <div className="mt-2 space-y-1.5">
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API Key"
              className="w-full rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-teal-500/50 focus:outline-none"
            />
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="API Secret"
              className="w-full rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-teal-500/50 focus:outline-none"
            />
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Passphrase"
              className="w-full rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-teal-500/50 focus:outline-none"
            />
            <p className="text-[9px] leading-snug text-zinc-600">
              Credentials are obfuscated (XOR) and stored locally in the app DB. They are sent to the engine only when you switch to a live mode. Leave blank to use already-saved credentials.
            </p>
          </div>
        )}
      </div>

      {/* Mode switcher */}
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <button
          onClick={() => saveCredsAndSwitch('sim')}
          disabled={busy}
          className={`rounded-md border px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${
            mode === 'sim' ? 'border-zinc-500 bg-zinc-700/60 text-zinc-200' : 'border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:border-zinc-600'
          }`}
        >
          SIM
        </button>
        <button
          onClick={() => saveCredsAndSwitch('testnet')}
          disabled={busy}
          className={`rounded-md border px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${
            mode === 'testnet' ? 'border-amber-500/50 bg-amber-500/20 text-amber-300' : 'border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:border-amber-500/40 hover:text-amber-400'
          }`}
        >
          TESTNET
        </button>
        <button
          onClick={() => saveCredsAndSwitch('mainnet')}
          disabled={busy}
          className={`rounded-md border px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${
            mode === 'mainnet' ? 'border-rose-500/50 bg-rose-500/20 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.3)]' : 'border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:border-rose-500/40 hover:text-rose-400'
          }`}
        >
          MAINNET
        </button>
      </div>

      {/* Status message */}
      {busy && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-400">
          <Loader2 className="h-3 w-3 animate-spin" /> Configuring…
        </div>
      )}
      {msg && (
        <div className={`mt-2 flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] ${
          msg.type === 'ok' ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300' : 'border-rose-500/30 bg-rose-500/5 text-rose-300'
        }`}>
          {msg.type === 'ok' ? <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" /> : <XCircle className="mt-0.5 h-3 w-3 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Risk disclaimer */}
      {!isLive && (
        <div className="mt-auto flex items-start gap-1.5 pt-2 text-[9px] leading-snug text-zinc-600">
          <AlertTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0" />
          <span>Currently in SIM (simulation). Switch to TESTNET (demo trading) to validate with real OKX data before risking real capital on MAINNET.</span>
        </div>
      )}
    </section>
  )
}
