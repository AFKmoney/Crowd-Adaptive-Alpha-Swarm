// Shared display helpers for the OMEGA dashboard.
import type { Side, Regime, AgentName, AgentRole, CrowdDirection } from '@/lib/omega-types'

export const SIDE_STYLES: Record<Side, { label: string; text: string; bg: string; border: string; dot: string }> = {
  BUY: { label: 'LONG', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', dot: 'bg-emerald-400' },
  SELL: { label: 'SHORT', text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/40', dot: 'bg-rose-400' },
  FLAT: { label: 'FLAT', text: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-600/40', dot: 'bg-zinc-500' },
}

export const REGIME_STYLES: Record<Regime, { label: string; text: string; bg: string; border: string; icon: string }> = {
  calm_bull: { label: 'CALM BULL', text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', icon: '🐂' },
  volatile_bull: { label: 'VOLATILE BULL', text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/40', icon: '🐂' },
  choppy: { label: 'CHOPPY', text: 'text-zinc-300', bg: 'bg-zinc-500/10', border: 'border-zinc-600/40', icon: '~' },
  bear: { label: 'BEAR', text: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/40', icon: 'x' },
}

export const AGENT_META: Record<AgentName, { label: string; short: string; desc: string; accent: string }> = {
  trend: { label: 'PPO Trend', short: 'TREND', desc: 'Momentum capture', accent: 'text-sky-300' },
  meanrev: { label: 'PPO MeanRev', short: 'MREV', desc: 'Fades extremes', accent: 'text-violet-300' },
  macro: { label: 'LLM Macro', short: 'MACRO', desc: 'Narrative economist', accent: 'text-teal-300' },
  stat_arb: { label: 'StatArb', short: 'SARB', desc: 'Pair reversion', accent: 'text-amber-300' },
  crowd: { label: 'Crowd Engine', short: 'CROWD', desc: 'Contrarian fade', accent: 'text-fuchsia-300' },
}

export const ROLE_STYLES: Record<AgentRole, { label: string; text: string; bg: string }> = {
  crowd_follower: { label: 'crowd-follower', text: 'text-amber-300', bg: 'bg-amber-500/10' },
  contrarian: { label: 'contrarian', text: 'text-fuchsia-300', bg: 'bg-fuchsia-500/10' },
  neutral: { label: 'neutral', text: 'text-zinc-300', bg: 'bg-zinc-500/10' },
}

export const AGENT_BAR_COLOR: Record<AgentName, string> = {
  trend: '#7dd3fc', // sky-300
  meanrev: '#c4b5fd', // violet-300
  macro: '#5eead4', // teal-300
  stat_arb: '#fcd34d', // amber-300
  crowd: '#f0abfc', // fuchsia-300
}

export const VOL_REGIME_STYLES: Record<string, { label: string; text: string; bg: string; border: string }> = {
  low: { label: 'LOW', text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  normal: { label: 'NORMAL', text: 'text-teal-300', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
  high: { label: 'HIGH', text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  extreme: { label: 'EXTREME', text: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/40' },
}

export const VENUE_COLORS: Record<string, string> = {
  OKX: '#5eead4',
  Binance: '#fcd34d',
  Bybit: '#f0abfc',
}

export function fmtPrice(p: number): string {
  return p.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

export function fmtPct(p: number, digits = 2): string {
  return (p >= 0 ? '+' : '') + p.toFixed(digits) + '%'
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false })
}

export function fmtUptime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (m < 1) return `${sec}s`
  if (m < 60) return `${m}m ${sec}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export function crowdDirectionLabel(d: CrowdDirection): string {
  return d === 'long' ? 'EXTREME LONG (greedy)' : 'EXTREME SHORT (fearful)'
}
