import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { obfuscate } from '@/lib/crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/credentials/import
// Body: { content: string } — the text content of an exported .txt file
// Parses key=value lines and saves a new credential set.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const content: string = body.content || ''
    if (!content.trim()) {
      return NextResponse.json({ error: 'empty content' }, { status: 400 })
    }

    // Parse key=value lines (skip comments and blanks)
    const fields: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx < 0) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const value = trimmed.slice(eqIdx + 1).trim()
      fields[key] = value
    }

    const exchange = fields.exchange || 'okx'
    const apiKey = fields.apiKey || ''
    const apiSecret = fields.apiSecret || ''
    const passphrase = fields.passphrase || ''
    const testnet = fields.testnet !== 'false'

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'File missing apiKey or apiSecret', parsed: fields },
        { status: 400 },
      )
    }

    // Auto-generate label if not provided or already exists
    let label = fields.label || ''
    if (!label) {
      const count = await db.credential.count({ where: { exchange } })
      label = `${exchange}-${count + 1}`
    }

    const created = await db.credential.upsert({
      where: { exchange_label: { exchange, label } },
      create: {
        exchange,
        label,
        apiKey,
        apiSecret: obfuscate(apiSecret),
        passphrase: passphrase ? obfuscate(passphrase) : null,
        testnet,
        active: false,
      },
      update: {
        apiKey,
        apiSecret: obfuscate(apiSecret),
        passphrase: passphrase ? obfuscate(passphrase) : null,
        testnet,
      },
    })

    return NextResponse.json({
      status: 'imported',
      id: created.id,
      exchange,
      label,
      testnet,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to import credentials', detail: String(err) },
      { status: 500 },
    )
  }
}
