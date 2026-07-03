'use client'

import { useState, useEffect } from 'react'
import { Wallet, Zap, Unlink, Loader2, CheckCircle2, XCircle, ArrowRight, RefreshCw, Activity } from 'lucide-react'
import { useOmegaEngine } from '@/hooks/use-omega-engine'

const CHAIN_COLORS: Record<string, string> = {
  Ethereum: '#627eea', Polygon: '#8247e5', Arbitrum: '#28a0f0', Optimism: '#ff0420', BSC: '#f0b90b', Avalanche: '#e84142', Base: '#0052ff',
}
const CHAIN_ICONS: Record<string, string> = {
  Ethereum: '⟠', Polygon: '🟣', Arbitrum: '🔵', Optimism: '🔴', BSC: '🟡', Avalanche: '🔺', Base: '🔵',
}

export function Web3WalletPanel() {
  const { state, web3Disconnect, web3SwitchChain, web3Trade, web3Connect } = useOmegaEngine()
  const w3 = (state as any)?.web3Wallet
  const consensus = state?.signals?.consensus
  const risk = state?.risk
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [tradeFrom, setTradeFrom] = useState('ETH')
  const [tradeTo, setTradeTo] = useState('USDT')
  const [tradeAmount, setTradeAmount] = useState('0.001')
  const [tradeResult, setTradeResult] = useState<any>(null)
  const [autoTrade, setAutoTrade] = useState(false)
  const [pkInput, setPkInput] = useState('')

  // Auto-trade: when consensus is strong and autoTrade is on, execute
  useEffect(() => {
    if (!autoTrade || !w3?.connected) return
    if (consensus?.side !== 'FLAT' && consensus?.confidence > 0.8 && (w3?.stats?.tradeCount || 0) < 100) {
      const side = consensus.side === 'BUY' ? { from: 'USDT', to: 'ETH' } : { from: 'ETH', to: 'USDT' }
      // Execute auto trade (throttled by confidence threshold)
      web3Trade(side.from, side.to, 0.001).then(ack => {
        if (ack.ok) setTradeResult(ack.result)
      })
    }
  }, [consensus?.side, consensus?.confidence, autoTrade, w3?.connected])

  if (!w3) return null

  const chainColor = CHAIN_COLORS[w3.chainName] || '#627eea'
  const chainIcon = CHAIN_ICONS[w3.chainName] || '⛓'
  const balance = w3.balance || { native: 0, nativeSymbol: 'ETH', usdValue: 0 }
  const tokens = w3.tokenBalances || []
  const tradeHistory = w3.stats?.tradeHistory || []

  async function connect() {
    if (!pkInput.trim()) return
    setBusy(true)
    const ack = await web3Connect(pkInput, w3.chainId || 1)
    if (ack.ok) { setMsg({ type: 'ok', text: 'Connected!' }); setPkInput('') }
    else setMsg({ type: 'err', text: ack.error || 'Failed' })
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
    if (!ack.ok) setMsg({ type: 'err', text: ack.error || 'Switch failed' })
    setBusy(false)
  }

  async function executeTrade() {
    setBusy(true); setTradeResult(null)
    const ack = await web3Trade(tradeFrom, tradeTo, parseFloat(tradeAmount))
    setTradeResult(ack.result)
    if (ack.ok) setMsg({ type: 'ok', text: `✅ ${ack.result?.amountOut?.toFixed(6)} ${tradeTo}` })
    else setMsg({ type: 'err', text: ack.error || ack.result?.error || 'Trade failed' })
    setBusy(false)
  }

  return (
    <section className={`rounded-xl border p-4 backdrop-blur-sm sm:p-5 transition-colors ${
      w3.connected ? 'border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.08)]' : 'border-zinc-800/60 bg-zinc-900/30'
    }`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className={`h-5 w-5 ${w3.connected ? 'text-emerald-400' : 'text-zinc-400'}`} />
          <h2 className="font-mono text-base font-bold tracking-wider text-zinc-100">Web3 Wallet</h2>
          {w3.connected && (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-[10px] font-bold uppercase text-emerald-300">LIVE</span>
            </span>
          )}
        </div>
        {w3.connected && (
          <button onClick={disconnect} disabled={busy} className="flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/5 px-2 py-1 text-[10px] text-rose-400 hover:bg-rose-500/10 disabled:opacity-50">
            <Unlink className="h-3 w-3" /> Disconnect
          </button>
        )}
      </div>

      {w3.connected ? (
        <div className="space-y-3">
          {/* Wallet address + chain badge */}
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-lg" style={{ color: chainColor }}>{chainIcon}</span>
              <div>
                <div className="font-mono text-xs font-bold text-zinc-100">{w3.address?.slice(0,8)}...{w3.address?.slice(-6)}</div>
                <div className="text-[9px] text-zinc-500">{w3.chainName} (Chain {w3.chainId})</div>
              </div>
            </div>
            <a href={`https://etherscan.io/address/${w3.address}`} target="_blank" rel="noopener noreferrer" className="text-[9px] text-zinc-500 hover:text-teal-300">
              Etherscan ↗
            </a>
          </div>

          {/* Real-time balance */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
              <div className="text-[9px] uppercase tracking-wider text-zinc-500">{balance.nativeSymbol} Balance</div>
              <div className="font-mono text-lg font-bold tabular-nums text-emerald-300">{balance.native?.toFixed(6)}</div>
              <div className="text-[9px] text-zinc-600">≈ ${balance.usdValue?.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
              <div className="text-[9px] uppercase tracking-wider text-zinc-500">Bot Trades</div>
              <div className="font-mono text-lg font-bold tabular-nums text-zinc-100">{w3.stats?.tradeCount || 0}</div>
              <div className="text-[9px] text-zinc-600">executed</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
              <div className="text-[9px] uppercase tracking-wider text-zinc-500">Gas Spent</div>
              <div className="font-mono text-lg font-bold tabular-nums text-amber-300">${(w3.stats?.totalGasSpentUsd || 0).toFixed(3)}</div>
              <div className="text-[9px] text-zinc-600">total</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
              <div className="text-[9px] uppercase tracking-wider text-zinc-500">Bot Signal</div>
              <div className={`font-mono text-lg font-bold ${consensus?.side === 'BUY' ? 'text-emerald-300' : consensus?.side === 'SELL' ? 'text-rose-300' : 'text-zinc-400'}`}>
                {consensus?.side || 'FLAT'}
              </div>
              <div className="text-[9px] text-zinc-600">@ {(consensus?.confidence * 100)?.toFixed(0)}%</div>
            </div>
          </div>

          {/* Token balances */}
          {tokens.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tokens.map((t: any, i: number) => (
                <div key={i} className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/40 px-2 py-1">
                  <span className="font-mono text-[10px] font-bold text-zinc-200">{t.balance.toFixed(2)}</span>
                  <span className="text-[9px] text-zinc-500">{t.symbol}</span>
                </div>
              ))}
            </div>
          )}

          {/* Chain switcher */}
          <div className="flex flex-wrap gap-1">
            {w3.supportedChains?.map((c: any) => (
              <button key={c.id} onClick={() => switchChain(c.id)} disabled={busy || c.id === w3.chainId}
                className={`flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium transition-colors ${
                  c.id === w3.chainId ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 bg-zinc-800/40 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500'
                }`}>
                <span>{CHAIN_ICONS[c.name] || '⛓'}</span> {c.name}
              </button>
            ))}
          </div>

          {/* Autonomous trade executor */}
          <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-400">
                <Zap className="h-3 w-3 text-amber-400" /> Trade Executor
              </span>
              {/* Auto-trade toggle */}
              <button onClick={() => setAutoTrade(!autoTrade)}
                className={`flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold uppercase ${autoTrade ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>
                <Activity className="h-2.5 w-2.5" /> Auto: {autoTrade ? 'ON' : 'OFF'}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <input value={tradeFrom} onChange={e => setTradeFrom(e.target.value)} placeholder="From" className="w-20 rounded border border-zinc-700 bg-zinc-900/60 px-2 py-1.5 font-mono text-[11px] text-zinc-200 focus:border-emerald-500/50 focus:outline-none" />
              <ArrowRight className="h-4 w-4 text-zinc-500" />
              <input value={tradeTo} onChange={e => setTradeTo(e.target.value)} placeholder="To" className="w-20 rounded border border-zinc-700 bg-zinc-900/60 px-2 py-1.5 font-mono text-[11px] text-zinc-200 focus:border-emerald-500/50 focus:outline-none" />
              <input value={tradeAmount} onChange={e => setTradeAmount(e.target.value)} placeholder="Amount" type="number" step="0.0001" className="w-24 rounded border border-zinc-700 bg-zinc-900/60 px-2 py-1.5 font-mono text-[11px] text-zinc-200 focus:border-emerald-500/50 focus:outline-none" />
              <button onClick={executeTrade} disabled={busy}
                className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Execute
              </button>
            </div>
            {autoTrade && (
              <p className="mt-1.5 text-[9px] text-emerald-400/70">
                ⚡ Auto-trade ON — bot will execute trades automatically when signal confidence &gt; 80%
              </p>
            )}
            {tradeResult && (
              <div className={`mt-2 rounded-md px-2.5 py-1.5 text-[10px] ${tradeResult.success ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
                {tradeResult.success
                  ? `✅ ${tradeResult.amountIn} ${tradeResult.fromToken} → ${tradeResult.amountOut?.toFixed(6)} ${tradeResult.toToken} | gas $${tradeResult.gasCostUsd?.toFixed(3)} | tx ${tradeResult.txHash?.slice(0,18)}...`
                  : `❌ ${tradeResult.error}`}
              </div>
            )}
          </div>

          {/* Trade history */}
          {tradeHistory.length > 0 && (
            <div className="max-h-[100px] space-y-0.5 overflow-y-auto custom-scroll">
              <div className="text-[9px] uppercase tracking-wider text-zinc-500">Recent Trades</div>
              {tradeHistory.slice(0, 8).map((t: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded px-2 py-0.5 text-[10px] font-mono hover:bg-zinc-800/40">
                  <span className={t.success ? 'text-emerald-300' : 'text-rose-300'}>
                    {t.success ? '✅' : '❌'} {t.amountIn} {t.fromToken} → {t.amountOut?.toFixed(4)} {t.toToken}
                  </span>
                  <span className="text-zinc-600">${t.gasCostUsd?.toFixed(3)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Connection form — simplified */
        <div className="space-y-2">
          <p className="text-[11px] leading-snug text-zinc-500">
            Connect your Web3 wallet (MetaMask, Trust, Rabby, Coinbase — any wallet). The bot trades autonomously via Uniswap on 7 chains.
          </p>
          <input type="password" value={pkInput} onChange={e => setPkInput(e.target.value)}
            placeholder="Private key (0x...)"
            className="w-full rounded border border-zinc-700 bg-zinc-900/60 px-3 py-2 font-mono text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none" />
          <button onClick={connect} disabled={busy || !pkInput.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2.5 text-[13px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} Connect Wallet
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
