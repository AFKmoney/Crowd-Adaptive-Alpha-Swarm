import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { obfuscate } from '@/lib/crypto'
import { randomBytes } from 'node:crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/credentials/generate
// Creates a NEW credential entry with an auto-generated strong passphrase.
// The user provides their OKX apiKey + apiSecret (from OKX's API management page),
// and we generate a secure passphrase they can use when creating the OKX API key.
// Body: { exchange?, label?, apiKey, apiSecret, testnet? }
// Returns: { id, label, passphrase (plaintext — shown once), ... }
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const exchange = body.exchange || 'okx'
    const apiKey = body.apiKey || ''
    const apiSecret = body.apiSecret || ''
    const testnet = body.testnet !== false

    // Generate a strong 24-char passphrase (alphanumeric, no ambiguous chars)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    const bytes = randomBytes(24)
    let passphrase = ''
    for (let i = 0; i < 24; i++) {
      passphrase += chars[bytes[i] % chars.length]
    }

    // Auto-generate label
    const count = await db.credential.count({ where: { exchange } })
    const label = body.label || `${exchange}-${count + 1}`

    if (!apiKey || !apiSecret) {
      // Just return the generated passphrase + label without saving
      return NextResponse.json({
        status: 'generated',
        label,
        passphrase,
        message: 'Passphrase generated. Enter your OKX API Key + Secret, then save.',
      })
    }

    // Save with the generated passphrase
    const created = await db.credential.create({
      data: {
        exchange,
        label,
        apiKey,
        apiSecret: obfuscate(apiSecret),
        passphrase: obfuscate(passphrase),
        testnet,
        active: false,
      },
    })

    return NextResponse.json({
      status: 'saved',
      id: created.id,
      exchange,
      label,
      passphrase, // plaintext — shown once so the user can set it on OKX
      testnet,
      message: 'Credential set created with auto-generated passphrase. Use this passphrase when creating your OKX API key.',
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to generate credentials', detail: String(err) },
      { status: 500 },
    )
  }
}
