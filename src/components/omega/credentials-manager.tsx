'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  KeyRound, Plus, Upload, Download, Trash2, Eye, EyeOff, Power,
  RefreshCw, Wand2, CheckCircle2, XCircle, Loader2, Copy
} from 'lucide-react'

interface CredentialEntry {
  id: string
  exchange: string
  label: string
  apiKey: string
  apiSecretMasked: string
  passphraseMasked: string
  testnet: boolean
  active: boolean
  hasPassphrase: boolean
  createdAt: string
}

interface RevealedCreds {
  apiKey: string
  apiSecret: string
  passphrase: string
}

export function CredentialsManager() {
  const [creds, setCreds] = useState<CredentialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [revealed, setRevealed] = useState<Record<string, RevealedCreds>>({})
  const [revealing, setRevealing] = useState<Record<string, boolean>>({})
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // Add form state
  const [showAdd, setShowAdd] = useState(false)
  const [fLabel, setFLabel] = useState('')
  const [fApiKey, setFApiKey] = useState('')
  const [fApiSecret, setFApiSecret] = useState('')
  const [fPassphrase, setFPassphrase] = useState('')
  const [fTestnet, setFTestnet] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/credentials')
      const d = await res.json()
      setCreds(d.credentials || [])
    } catch {
      /* noop */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function flash(type: 'ok' | 'err', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  // ---- Reveal / Hide ----
  async function reveal(id: string) {
    if (revealed[id]) {
      const copy = { ...revealed }
      delete copy[id]
      setRevealed(copy)
      return
    }
    setRevealing((p) => ({ ...p, [id]: true }))
    try {
      const res = await fetch(`/api/credentials/reveal?id=${id}`)
      const d = await res.json()
      if (res.ok) {
        setRevealed((p) => ({ ...p, [id]: { apiKey: d.apiKey, apiSecret: d.apiSecret, passphrase: d.passphrase } }))
      } else {
        flash('err', d.error || 'Failed to reveal')
      }
    } catch {
      flash('err', 'Network error')
    } finally {
      setRevealing((p) => ({ ...p, [id]: false }))
    }
  }

  // ---- Activate ----
  async function activate(id: string, label: string) {
    setBusy(id)
    try {
      const res = await fetch('/api/credentials/activate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        flash('ok', `Activated "${label}" — it will be used on next mode switch`)
        await load()
      } else {
        flash('err', 'Failed to activate')
      }
    } finally {
      setBusy(null)
    }
  }

  // ---- Delete ----
  async function remove(id: string, label: string) {
    if (!confirm(`Delete credential "${label}"? This cannot be undone.`)) return
    setBusy(id)
    try {
      await fetch(`/api/credentials?id=${id}`, { method: 'DELETE' })
      flash('ok', `Deleted "${label}"`)
      await load()
    } finally {
      setBusy(null)
    }
  }

  // ---- Export (download .txt) ----
  function exportCred(id: string) {
    window.open(`/api/credentials/export?id=${id}`, '_blank')
  }

  // ---- Generate passphrase ----
  async function generatePassphrase() {
    try {
      // Generate locally (no need for API call for just a passphrase)
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
      const bytes = new Uint8Array(24)
      crypto.getRandomValues(bytes)
      let pp = ''
      for (let i = 0; i < 24; i++) pp += chars[bytes[i] % chars.length]
      setFPassphrase(pp)
      flash('ok', 'Strong passphrase generated — use it when creating your OKX API key')
    } catch {
      flash('err', 'Generation failed')
    }
  }

  // ---- Save new credential ----
  async function saveNew() {
    if (!fApiKey || !fApiSecret) {
      flash('err', 'API Key and Secret are required')
      return
    }
    setBusy('new')
    try {
      const res = await fetch('/api/credentials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: 'okx', label: fLabel || undefined,
          apiKey: fApiKey, apiSecret: fApiSecret,
          passphrase: fPassphrase || undefined, testnet: fTestnet,
        }),
      })
      if (res.ok) {
        flash('ok', 'Credential set saved')
        setFLabel(''); setFApiKey(''); setFApiSecret(''); setFPassphrase('')
        setShowAdd(false)
        await load()
      } else {
        const d = await res.json()
        flash('err', d.error || 'Save failed')
      }
    } finally {
      setBusy(null)
    }
  }

  // ---- Import from file ----
  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const content = String(reader.result || '')
      setBusy('import')
      try {
        const res = await fetch('/api/credentials/import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        })
        const d = await res.json()
        if (res.ok) {
          flash('ok', `Imported "${d.label}" from file`)
          await load()
        } else {
          flash('err', d.error || 'Import failed')
        }
      } finally {
        setBusy(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  // ---- Copy to clipboard ----
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      flash('ok', `${label} copied to clipboard`)
    } catch {
      flash('err', 'Copy failed')
    }
  }

  return (
    <section className="flex h-full flex-col rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 backdrop-blur-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-teal-400" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">Credential Manager</h2>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">{creds.length} saved</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-[10px] font-medium text-zinc-300 hover:border-teal-500/40 hover:text-teal-300"
          >
            <Plus className="h-3 w-3" /> New
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy === 'import'}
            className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-[10px] font-medium text-zinc-300 hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-50"
          >
            {busy === 'import' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Import
          </button>
          <input ref={fileInputRef} type="file" accept=".txt,.text" onChange={onFileSelected} className="hidden" />
          <button
            onClick={load}
            className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-[10px] font-medium text-zinc-300 hover:border-zinc-500"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Message */}
      {msg && (
        <div className={`mb-2 flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] ${
          msg.type === 'ok' ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300' : 'border-rose-500/30 bg-rose-500/5 text-rose-300'
        }`}>
          {msg.type === 'ok' ? <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" /> : <XCircle className="mt-0.5 h-3 w-3 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Credential list */}
      <div className="flex-1 space-y-2 overflow-y-auto custom-scroll" style={{ maxHeight: '320px' }}>
        {loading ? (
          <div className="text-center text-[11px] text-zinc-600 py-4">Loading…</div>
        ) : creds.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-6 text-center text-[11px] text-zinc-600">
            No credentials saved yet. Click <strong className="text-zinc-400">New</strong> to add your OKX keys, or <strong className="text-zinc-400">Import</strong> a .txt file.
          </div>
        ) : (
          creds.map((c) => {
            const rev = revealed[c.id]
            return (
              <div key={c.id} className={`rounded-lg border p-2.5 ${
                c.active ? 'border-teal-500/40 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/40'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs font-bold ${c.active ? 'text-teal-300' : 'text-zinc-200'}`}>{c.label}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                      c.testnet ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>{c.testnet ? 'TESTNET' : 'MAINNET'}</span>
                    {c.active && (
                      <span className="flex items-center gap-1 text-[8px] font-bold uppercase text-teal-400">
                        <Power className="h-2.5 w-2.5" /> ACTIVE
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-zinc-600">{c.exchange}</span>
                </div>

                {/* Key display */}
                <div className="mt-1.5 space-y-0.5 font-mono text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Key:</span>
                    <span className="text-zinc-300">{rev ? rev.apiKey : c.apiKey}</span>
                    {rev && <button onClick={() => copy(rev.apiKey, 'API Key')} className="text-zinc-600 hover:text-teal-300"><Copy className="h-2.5 w-2.5" /></button>}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Secret:</span>
                    <span className="text-zinc-300">{rev ? rev.apiSecret : c.apiSecretMasked}</span>
                    {rev && <button onClick={() => copy(rev.apiSecret, 'API Secret')} className="text-zinc-600 hover:text-teal-300"><Copy className="h-2.5 w-2.5" /></button>}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Pass:</span>
                    <span className="text-zinc-300">{rev ? (rev.passphrase || '—') : (c.passphraseMasked || '—')}</span>
                    {rev && rev.passphrase && <button onClick={() => copy(rev.passphrase, 'Passphrase')} className="text-zinc-600 hover:text-teal-300"><Copy className="h-2.5 w-2.5" /></button>}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <button
                    onClick={() => reveal(c.id)}
                    disabled={revealing[c.id]}
                    className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800/40 px-1.5 py-0.5 text-[9px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
                  >
                    {revealing[c.id] ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : rev ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                    {rev ? 'Hide' : 'Reveal'}
                  </button>
                  <button
                    onClick={() => exportCred(c.id)}
                    className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800/40 px-1.5 py-0.5 text-[9px] text-zinc-400 hover:border-sky-500/40 hover:text-sky-300"
                  >
                    <Download className="h-2.5 w-2.5" /> .txt
                  </button>
                  {!c.active && (
                    <button
                      onClick={() => activate(c.id, c.label)}
                      disabled={busy === c.id}
                      className="flex items-center gap-1 rounded border border-teal-500/30 bg-teal-500/10 px-1.5 py-0.5 text-[9px] text-teal-300 hover:bg-teal-500/20 disabled:opacity-50"
                    >
                      <Power className="h-2.5 w-2.5" /> Activate
                    </button>
                  )}
                  <button
                    onClick={() => remove(c.id, c.label)}
                    disabled={busy === c.id}
                    className="flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/5 px-1.5 py-0.5 text-[9px] text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-2.5 w-2.5" /> Delete
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add new form */}
      {showAdd && (
        <div className="mt-3 space-y-1.5 rounded-lg border border-zinc-700 bg-zinc-900/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Add New Credential Set</div>
          <input value={fLabel} onChange={(e) => setFLabel(e.target.value)} placeholder="Label (auto: okx-N)"
            className="w-full rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-teal-500/50 focus:outline-none" />
          <input value={fApiKey} onChange={(e) => setFApiKey(e.target.value)} placeholder="API Key *"
            className="w-full rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-teal-500/50 focus:outline-none" />
          <input value={fApiSecret} onChange={(e) => setFApiSecret(e.target.value)} type="password" placeholder="API Secret *"
            className="w-full rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-teal-500/50 focus:outline-none" />
          <div className="flex gap-1">
            <input value={fPassphrase} onChange={(e) => setFPassphrase(e.target.value)} type="password" placeholder="Passphrase"
              className="flex-1 rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-teal-500/50 focus:outline-none" />
            <button onClick={generatePassphrase}
              className="flex items-center gap-1 rounded border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-1 text-[10px] text-fuchsia-300 hover:bg-fuchsia-500/20 whitespace-nowrap">
              <Wand2 className="h-3 w-3" /> Gen
            </button>
          </div>
          <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <input type="checkbox" checked={fTestnet} onChange={(e) => setFTestnet(e.target.checked)} className="accent-amber-500" />
            Testnet (demo trading)
          </label>
          <div className="flex gap-1.5 pt-1">
            <button onClick={saveNew} disabled={busy === 'new'}
              className="flex items-center gap-1 rounded-md bg-teal-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-teal-500 disabled:opacity-50">
              {busy === 'new' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Save
            </button>
            <button onClick={() => setShowAdd(false)}
              className="rounded-md border border-zinc-700 px-3 py-1 text-[11px] text-zinc-400 hover:text-zinc-200">
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
