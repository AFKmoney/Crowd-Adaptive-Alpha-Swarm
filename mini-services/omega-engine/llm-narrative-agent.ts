// OMEGA Engine — LLM Narrative Agent (P0)
//
// Real LLM-powered crypto news analysis using z-ai-web-dev-sdk.
// Scrapes RSS feeds (CoinDesk, Bitcoin Magazine), scores sentiment with the LLM,
// extracts entities/catalysts, detects emerging narratives.
//
// This is our #1 edge vs big banks — they're too slow/conservative to use LLMs
// for trading. We do it in seconds.
//
// Runs as a background async task: every 60s, fetches latest headlines, sends
// them to the LLM for structured analysis, and feeds the result to the macro
// agent + crowd engine + breakthrough lab.

import ZAI from 'z-ai-web-dev-sdk'

export interface NewsHeadline {
  title: string
  source: string
  url: string
  publishedAt: number
}

export interface LLMNarrativeAnalysis {
  sentiment: number          // -1..1 (bearish..bullish)
  relevance: number          // 0..1 (how relevant to BTC/crypto)
  volatility_expectation: 'low' | 'medium' | 'high' | 'extreme'
  key_catalysts: string[]    // e.g. ["ETF approval", "Fed rate cut", "exchange hack"]
  mentioned_symbols: string[] // e.g. ["BTC", "ETH", "SOL"]
  narrative_themes: string[] // e.g. ["AI tokens", "DePIN", "RWA"]
  summary: string            // one-sentence LLM summary
  confidence: number         // 0..1
  analyzedAt: number
}

export interface LLMNarrativeState {
  connected: boolean         // z-ai SDK initialized
  lastAnalysis: LLMNarrativeAnalysis | null
  recentHeadlines: NewsHeadline[]
  analysisCount: number
  error: string | null
  // Running narrative signal (smoothed)
  narrativeSignal: number    // -1..1 (bearish..bullish)
  narrativeTrend: 'improving' | 'deteriorating' | 'stable'
  emergingNarratives: string[] // themes that appeared in the last 3 analyses
}

const RSS_FEEDS = [
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk' },
  { url: 'https://bitcoinmagazine.com/.rss/full/', source: 'Bitcoin Magazine' },
  { url: 'https://cointelegraph.com/rss', source: 'Cointelegraph' },
]

const ANALYSIS_INTERVAL_MS = 60_000 // 60 seconds
const KEYWORDS = ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'fed', 'cpi', 'rates', 'etf', 'sec', 'hack', 'liquidation', 'funding', 'stablecoin', 'defi', 'solana', 'sol']

export class LLMNarrativeAgent {
  private zai: any = null
  private connected = false
  private lastAnalysis: LLMNarrativeAnalysis | null = null
  private recentHeadlines: NewsHeadline[] = []
  private analysisCount = 0
  private error: string | null = null
  private narrativeSignal = 0
  private analysisHistory: LLMNarrativeAnalysis[] = []
  private intervalHandle: ReturnType<typeof setInterval> | null = null

  async initialize(): Promise<void> {
    try {
      this.zai = await ZAI.create()
      this.connected = true
      console.log('[llm-narrative] z-ai SDK connected')
      // Start the background analysis loop
      this.intervalHandle = setInterval(() => this.analyze(), ANALYSIS_INTERVAL_MS)
      // Run the first analysis immediately
      this.analyze()
    } catch (err) {
      this.connected = false
      this.error = `z-ai init failed: ${String(err)}`
      console.error('[llm-narrative] init failed:', err)
    }
  }

  private async fetchHeadlines(): Promise<NewsHeadline[]> {
    const headlines: NewsHeadline[] = []
    for (const feed of RSS_FEEDS) {
      try {
        const res = await fetch(feed.url, { signal: AbortSignal.timeout(10000) })
        if (!res.ok) continue
        const xml = await res.text()
        // Parse RSS <title> and <pubDate> tags (simple regex — no XML lib needed)
        const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []
        for (const item of items.slice(0, 5)) {
          const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/)
          const linkMatch = item.match(/<link>(.*?)<\/link>/)
          const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/)
          if (titleMatch) {
            const title = titleMatch[1].trim()
            // Keyword filter — skip irrelevant headlines
            const lower = title.toLowerCase()
            if (!KEYWORDS.some(k => lower.includes(k))) continue
            headlines.push({
              title,
              source: feed.source,
              url: linkMatch ? linkMatch[1].trim() : '',
              publishedAt: dateMatch ? new Date(dateMatch[1]).getTime() : Date.now(),
            })
          }
        }
      } catch {
        // RSS fetch failed — skip this feed
      }
    }
    return headlines.slice(0, 15) // max 15 headlines
  }

  private async analyze(): Promise<void> {
    if (!this.connected || !this.zai) return
    try {
      const headlines = await this.fetchHeadlines()
      if (headlines.length === 0) {
        this.error = 'No headlines fetched'
        return
      }
      this.recentHeadlines = headlines
      this.error = null

      // Build the LLM prompt
      const headlinesText = headlines.map((h, i) => `${i+1}. [${h.source}] ${h.title}`).join('\n')
      const prompt = `You are a senior crypto macro strategist. Analyze these crypto news headlines and return a JSON object.

Headlines:
${headlinesText}

Return ONLY this JSON (no markdown, no explanation):
{
  "sentiment": <number -1 to 1>,
  "relevance": <number 0 to 1>,
  "volatility_expectation": "<low|medium|high|extreme>",
  "key_catalysts": [<array of strings>],
  "mentioned_symbols": [<array of strings>],
  "narrative_themes": [<array of strings>],
  "summary": "<one sentence>",
  "confidence": <number 0 to 1>
}`

      const completion = await this.zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: 'You are a crypto market analyst. Respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        thinking: { type: 'disabled' },
      })

      const raw = completion.choices[0]?.message?.content || ''
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        this.error = 'LLM returned no JSON'
        return
      }
      const parsed = JSON.parse(jsonMatch[0])

      const analysis: LLMNarrativeAnalysis = {
        sentiment: clamp(parsed.sentiment || 0, -1, 1),
        relevance: clamp(parsed.relevance || 0, 0, 1),
        volatility_expectation: parsed.volatility_expectation || 'medium',
        key_catalysts: parsed.key_catalysts || [],
        mentioned_symbols: parsed.mentioned_symbols || [],
        narrative_themes: parsed.narrative_themes || [],
        summary: parsed.summary || '',
        confidence: clamp(parsed.confidence || 0, 0, 1),
        analyzedAt: Date.now(),
      }

      this.lastAnalysis = analysis
      this.analysisCount++
      this.analysisHistory.push(analysis)
      if (this.analysisHistory.length > 10) this.analysisHistory.shift()

      // Smoothed narrative signal (EMA)
      this.narrativeSignal = this.narrativeSignal * 0.7 + analysis.sentiment * 0.3

      console.log(`[llm-narrative] analysis #${this.analysisCount}: sentiment=${analysis.sentiment.toFixed(2)} vol=${analysis.volatility_expectation} themes=[${analysis.narrative_themes.join(',')}]`)

    } catch (err) {
      this.error = `Analysis failed: ${String(err)}`
      console.error('[llm-narrative] analysis error:', err)
    }
  }

  state(): LLMNarrativeState {
    // Compute trend
    let trend: 'improving' | 'deteriorating' | 'stable' = 'stable'
    if (this.analysisHistory.length >= 2) {
      const recent = this.analysisHistory.slice(-2)
      if (recent[1].sentiment > recent[0].sentiment + 0.1) trend = 'improving'
      else if (recent[1].sentiment < recent[0].sentiment - 0.1) trend = 'deteriorating'
    }

    // Emerging narratives: themes from last 3 analyses
    const recent3 = this.analysisHistory.slice(-3)
    const allThemes = recent3.flatMap(a => a.narrative_themes)
    const emergingNarratives = [...new Set(allThemes)].slice(0, 5)

    return {
      connected: this.connected,
      lastAnalysis: this.lastAnalysis,
      recentHeadlines: this.recentHeadlines,
      analysisCount: this.analysisCount,
      error: this.error,
      narrativeSignal: round(this.narrativeSignal, 3),
      narrativeTrend: trend,
      emergingNarratives,
    }
  }

  stop() {
    if (this.intervalHandle) clearInterval(this.intervalHandle)
  }
}

function clamp(x: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, x)) }
function round(x: number, d: number) { const f = 10 ** d; return Math.round(x * f) / f }
