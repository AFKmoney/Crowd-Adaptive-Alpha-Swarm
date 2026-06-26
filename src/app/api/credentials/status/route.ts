import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/credentials/status — lightweight status for the dashboard header
export async function GET() {
  try {
    const active = await db.credential.findFirst({
      where: { active: true },
      orderBy: { updatedAt: 'desc' },
    })
    if (!active) {
      return NextResponse.json({ configured: false, exchange: null, testnet: true, mode: 'unconfigured' })
    }
    return NextResponse.json({
      configured: true,
      exchange: active.exchange,
      label: active.label,
      testnet: active.testnet,
      mode: active.testnet ? 'testnet' : 'mainnet',
      updatedAt: active.updatedAt,
    })
  } catch (err) {
    return NextResponse.json({ configured: false, error: String(err) }, { status: 200 })
  }
}
