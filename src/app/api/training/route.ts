import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/training — recent training runs
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(20, Number(searchParams.get('limit') || 10))
    const runs = await db.trainingRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
    })
    return NextResponse.json({
      runs: runs.map((r) => ({
        id: r.id,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        mode: r.mode,
        scenarios: JSON.parse(r.scenariosJson),
        episodesDone: r.episodesDone,
        totalEpisodes: r.totalEpisodes,
        status: r.status,
        metrics: r.metricsJson ? JSON.parse(r.metricsJson) : null,
        summary: r.summaryJson ? JSON.parse(r.summaryJson) : null,
      })),
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load training runs', detail: String(err) },
      { status: 500 },
    )
  }
}

// POST /api/training — the omega-trainer mini-service calls this:
//   - on run start: { action: 'start', mode, scenarios, totalEpisodes, startedAt }
//   - on run complete: { action: 'complete', id, episodesDone, metrics, summary }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body.action || 'start'

    if (action === 'start') {
      const created = await db.trainingRun.create({
        data: {
          mode: body.mode || 'synthetic',
          scenariosJson: JSON.stringify(body.scenarios || []),
          totalEpisodes: body.totalEpisodes || 0,
          episodesDone: 0,
          status: 'running',
        },
      })
      return NextResponse.json({ status: 'created', id: created.id })
    }

    if (action === 'complete') {
      const updated = await db.trainingRun.update({
        where: { id: body.id },
        data: {
          finishedAt: new Date(),
          episodesDone: body.episodesDone ?? 0,
          status: body.status || 'completed',
          metricsJson: body.metrics ? JSON.stringify(body.metrics) : null,
          summaryJson: body.summary ? JSON.stringify(body.summary) : null,
        },
      })
      return NextResponse.json({ status: 'updated', id: updated.id })
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to record training run', detail: String(err) },
      { status: 500 },
    )
  }
}
