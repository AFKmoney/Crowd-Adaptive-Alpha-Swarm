import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deobfuscate } from '@/lib/crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/credentials/reveal?id=... — returns the DEOBFUSCATED (plaintext) keys
// for viewing in the UI. Use sparingly — this exposes real secrets.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }
    const cred = await db.credential.findUnique({ where: { id } })
    if (!cred) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    return NextResponse.json({
      id: cred.id,
      exchange: cred.exchange,
      label: cred.label,
      apiKey: cred.apiKey,
      apiSecret: deobfuscate(cred.apiSecret),
      passphrase: cred.passphrase ? deobfuscate(cred.passphrase) : '',
      testnet: cred.testnet,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to reveal credentials', detail: String(err) },
      { status: 500 },
    )
  }
}
