'use client'

import { useState } from 'react'
import { Wallet, Zap, Power, Link2, Unlink, Loader2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react'
import { useOmegaEngine } from '@/hooks/use-omega-engine'

const CHAIN_COLORS: Record<string, string> = {
  Ethereum: '#627eea', Polygon: '#8247e5', Arbitrum: '#28a0f0', Optimism: '#ff0420', BSC: '#f0b90b', Avalanche: '#e84142', Base: '#0052ff',
}

export function Web3WalletPanel() {
  const { state, web3Connect, web3Disconnect, web3SwitchChain, web3Trade } = useOmegaEngine()
  const w3 = (state as any)?.web3Wallet
  const [privateKey, setPrivateKey] = useState('')
  const [chainId, setChainId] = useState(1)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [tradeFrom, setTradeFrom] = useState('ETH')
  const [tradeTo, setTradeTo] = useState('USDT')
  const [tradeAmount, setTradeAmount] = useState('0.001')
  const [tradeResult, setTradeResult] = useState<any>(null)

  if (!w3) return null

  async function connect() {
    if (!privateKey.trim()) { setMsg({ type: 'err', text: 'Private key required' }); return }
    setBusy(true); setMsg(null)
    const ack = await web3Connect(privateKey, chainId)
    if (ack.ok) { setMsg({ type: 'ok', text: 'Wallet connected!' }); setPrivateKey('') }
    else setMsg({ type: 'err', text: ack.error || 'Connection failed' })
    setBusy(false)
  }

  async function disconnect() {
    setBusy(true)
    await web3Disconnect()
    setMsg({ type: 'ok', text: 'Disconnected' })
    setBusy(false)
  }

  async function switchChain(id: number) {
    setBusy(true)
    const ack = await web3SwitchChain(id)
    setChainId(id)
    if (!ack.ok) setMsg({ type: 'err', text: ack.error || 'Switch failed' })
    else setMsg({ type: 'ok', text: `Switched to ${id}` })
    setBusy(false)
  }

  async function executeTrade() {
    setBusy(true); setTradeResult(null)
    const ack = await web3Trade(tradeFrom, tradeTo, parseFloat(tradeAmount))
    setTradeResult(ack.result)
    if (ack.ok) setMsg({ type: 'ok', text: `Trade filled! ${ack.result?.amountOut?.toFixed(6)} ${tradeTo}` })
    else setMsg({ type: 'err', text: ack.error || ack.result?.error || 'Trade failed' })
    setBusy(false)
  }

  const chainColor = CHAIN_COLORS[w3.chainName] || '#627eea'

  return (
    <section className={`rounded-xl border p-4 backdrop-blur-sm sm:p-5 ${w3.connected ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800/60 bg-zinc-900/30'}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className={`h-4 w-4 ${w3.connected ? 'text-emerald-400' : 'text-zinc-400'}`} />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">Web3 Wallet</h2>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Any wallet · Any chain</span>
        </div>
        {w3.connected ? (
          <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-[10px] font-bold uppercase text-emerald-300">{w3.chainName}</span>
          </div>
        ) : null}
      </div>

      {/* Connection status */}
      {w3.connected ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
            <span className="font-mono text-[11px] text-zinc-300">{w3.address?.slice(0,10)}...{w3.address?.slice(-8)}</span>
            <button onClick={disconnect} disabled={busy} className="flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/5 px-2 py-0.5 text-[9px] text-rose-400 hover:bg-rose-500/10 disabled:opacity-50">
              <Unlink className="h-2.5 w-2.5" /> Disconnect
            </button>
          </div>

          {/* Chain selector */}
          <div className="flex flex-wrap gap-1">
            {w3.supportedChains?.map((c: any) => (
              <button key={c.id} onClick={() => switchChain(c.id)} disabled={busy || c.id === w3.chainId}
                className={`rounded border px-2 py-0.5 text-[9px] font-medium ${c.id === w3.chainId ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 bg-zinc-800/40 text-zinc-500 hover:text-zinc-300'}`}>
                {c.name}
              </button>
            ))}
          </div>

          {/* Trade stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1.5">
              <div className="text-[9px] uppercase text-zinc-500">Trades</div>
              <div className="font-mono text-sm font-bold text-zinc-200">{w3.stats?.tradeCount || 0}</div>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1.5">
              <div className="text-[9px] uppercase text-zinc-500">Gas spent</div>
              <div className="font-mono text-sm font-bold text-amber-300">${(w3.stats?.totalGasSpentUsd || 0).toFixed(2)}</div>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1.5">
              <div className="text-[9px] uppercase text-zinc-500">Chain</div>
              <div className="font-mono text-sm font-bold" style={{ color: chainColor }}>{w3.chainName}</div>
            </div>
          </div>

          {/* Autonomous trade executor */}
          <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-2.5">
            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-500">Autonomous Trade Execution (Uniswap)</div>
            <div className="flex flex-wrap items-center gap-1.5">
              <input value={tradeFrom} onChange={e => setTradeFrom(e.target.value)} placeholder="From" className="w-16 rounded border border-zinc-700 bg-zinc-900/60 px-1.5 py-1 font-mono text-[10px] text-zinc-200" />
              <ArrowRight className="h-3 w-3 text-zinc-500" />
              <input value={tradeTo} onChange={e => setTradeTo(e.target.value)} placeholder="To" className="w-16 rounded border border-zinc-700 bg-zinc-900/60 px-1.5 py-1 font-mono text-[10px] text-zinc-200" />
              <input value={tradeAmount} onChange={e => setTradeAmount(e.target.value)} placeholder="Amount" type="number" className="w-20 rounded border border-zinc-700 bg-zinc-900/60 px-1.5 py-1 font-mono text-[10px] text-zinc-200" />
              <button onClick={executeTrade} disabled={busy}
                className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />} Execute
              </button>
            </div>
            {tradeResult && (
              <div className={`mt-1.5 rounded px-2 py-1 text-[9px] ${tradeResult.success ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
                {tradeResult.success ? `✅ ${tradeResult.amountIn} ${tradeResult.fromToken} → ${tradeResult.amountOut?.toFixed(6)} ${tradeResult.toToken} | gas $${tradeResult.gasCostUsd?.toFixed(2)} | tx ${tradeResult.txHash?.slice(0,16)}...` : `❌ ${tradeResult.error}`}
              </div>
            )}
          </div>

          {/* Recent trade history */}
          {w3.stats?.tradeHistory?.length > 0 && (
            <div className="max-h-[80px] space-y-0.5 overflow-y-auto custom-scroll">
              <div className="text-[9px] uppercase text-zinc-500">Recent trades</div>
              {w3.stats.tradeHistory.slice(0, 5).map((t: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded px-1.5 py-0.5 text-[9px] font-mono">
                  <span className={t.success ? 'text-emerald-300' : 'text-rose-300'}>{t.success ? '✅' : '❌'} {t.amountIn} {t.fromToken} → {t.amountOut?.toFixed(4)} {t.toToken}</span>
                  <span className="text-zinc-600">${t.gasCostUsd?.toFixed(2)} gas</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Connection form */
        <div className="space-y-2">
          <p className="text-[10px] leading-snug text-zinc-500">
            Connect ANY Web3 wallet (MetaMask, Trust, Rabby, Coinbase) via private key.
            The bot can then trade autonomously via Uniswap on 7 chains.
          </p>
          <input type="password" value={privateKey} onChange={e => setPrivateKey(e.target.value)}
            placeholder="Private key (0x...)"
            className="w-full rounded border border-zinc-700 bg-zinc-900/60 px-2 py-1.5 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none" />
          <select value={chainId} onChange={e => setChainId(parseInt(e.target.value))}
            className="w-full rounded border border-zinc-700 bg-zinc-900/60 px-2 py-1.5 font-mono text-[11px] text-zinc-200">
            {w3.supportedChains?.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.native})</option>)}
          </select>
          <button onClick={connect} disabled={busy || !privateKey.trim()}
            className="flex w-full items-center justify-center gap-2 rounded bg-emerald-600 px-3 py-2 text-[12px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Connect Wallet
          </button>
        </div>
      )}

      {/* Status message */}
      {msg && (
        <div className={`mt-2 flex items-center gap-1.5 rounded px-2 py-1 text-[10px] ${msg.type === 'ok' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
          {msg.type === 'ok' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {msg.text}
        </div>
      )}
    </section>
  )
}
