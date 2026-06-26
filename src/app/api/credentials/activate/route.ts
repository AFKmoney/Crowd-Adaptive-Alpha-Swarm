import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/credentials/activate
// Body: { id } — sets this credential as active (deactivates all others)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id } = body
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }
    const cred = await db.credential.findUnique({ where: { id } })
    if (!cred) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    // Deactivate all for this exchange
    await db.credential.updateMany({
      where: { exchange: cred.exchange, active: true },
      data: { active: false },
    })
    // Activate the selected one
    await db.credential.update({ where: { id }, data: { active: true } })
    return NextResponse.json({ status: 'activated', id, exchange: cred.exchange, label: cred.label })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to activate credential', detail: String(err) },
      { status: 500 },
    )
  }
}
