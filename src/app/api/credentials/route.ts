import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { obfuscate, deobfuscate, maskSecret } from '@/lib/crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/credentials — returns the active credential set (secrets masked)
export async function GET() {
  try {
    const creds = await db.credential.findMany({
      orderBy: { createdAt: 'desc' },
    })
    const safe = creds.map((c) => ({
      id: c.id,
      exchange: c.exchange,
      label: c.label,
      apiKey: c.apiKey,
      apiSecretMasked: maskSecret(deobfuscate(c.apiSecret)),
      passphraseMasked: c.passphrase ? maskSecret(deobfuscate(c.passphrase)) : '',
      testnet: c.testnet,
      active: c.active,
      hasPassphrase: !!c.passphrase,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }))
    return NextResponse.json({ credentials: safe, count: safe.length })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load credentials', detail: String(err) },
      { status: 500 },
    )
  }
}

// POST /api/credentials — upsert the active credential set
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { exchange = 'okx', label = 'default', apiKey, apiSecret, passphrase, testnet = true } = body

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'apiKey and apiSecret are required' },
        { status: 400 },
      )
    }

    await db.credential.updateMany({
      where: { exchange, active: true },
      data: { active: false },
    })

    const created = await db.credential.upsert({
      where: { exchange_label: { exchange, label } },
      create: {
        exchange,
        label,
        apiKey,
        apiSecret: obfuscate(apiSecret),
        passphrase: passphrase ? obfuscate(passphrase) : null,
        testnet,
        active: true,
      },
      update: {
        apiKey,
        apiSecret: obfuscate(apiSecret),
        passphrase: passphrase ? obfuscate(passphrase) : null,
        testnet,
        active: true,
      },
    })

    return NextResponse.json({
      status: 'saved',
      id: created.id,
      exchange,
      label,
      testnet,
      apiSecretMasked: maskSecret(apiSecret),
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to save credentials', detail: String(err) },
      { status: 500 },
    )
  }
}

// DELETE /api/credentials?id=...
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }
    await db.credential.delete({ where: { id } })
    return NextResponse.json({ status: 'deleted', id })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to delete credentials', detail: String(err) },
      { status: 500 },
    )
  }
}
