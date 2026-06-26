import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { deobfuscate } from '@/lib/crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/credentials/export?id=... — downloads a .txt file with the full
// credential set in plaintext (key=value format, re-importable).
// The file downloads to the user's browser downloads directory.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return new Response('id required', { status: 400 })
    }
    const cred = await db.credential.findUnique({ where: { id } })
    if (!cred) {
      return new Response('not found', { status: 404 })
    }

    const apiSecret = deobfuscate(cred.apiSecret)
    const passphrase = cred.passphrase ? deobfuscate(cred.passphrase) : ''

    const content = [
      '# OMEGA / SkyTrader OKX Credentials',
      `# Exported: ${new Date().toISOString()}`,
      `# Exchange: ${cred.exchange} | Label: ${cred.label} | ${cred.testnet ? 'TESTNET' : 'MAINNET'}`,
      '# WARNING: This file contains plaintext API secrets. Store securely.',
      '',
      `exchange=${cred.exchange}`,
      `label=${cred.label}`,
      `apiKey=${cred.apiKey}`,
      `apiSecret=${apiSecret}`,
      `passphrase=${passphrase}`,
      `testnet=${cred.testnet}`,
      '',
    ].join('\n')

    const filename = `okx-credentials-${cred.label}-${cred.testnet ? 'testnet' : 'mainnet'}.txt`
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    return new Response(`Failed to export: ${String(err)}`, { status: 500 })
  }
}
