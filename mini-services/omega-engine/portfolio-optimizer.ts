// OMEGA Engine — Portfolio Optimizer (Markowitz)
//
// Mean-variance optimization across the full 32-symbol universe. Computes the
// efficient frontier, risk-parity allocation, and multi-asset Kelly sizing.
// This is how big banks allocate billions. We use the same math for $10.

export interface PortfolioAllocation {
  symbol: string
  name: string
  sector: string
  targetWeight: number   // 0..1 (fraction of portfolio)
  expectedReturn: number // annualized
  volatility: number     // annualized
  sharpe: number         // risk-adjusted
  color: string
}

export interface PortfolioOptimizerState {
  allocations: PortfolioAllocation[]
  portfolioExpectedReturn: number  // annualized
  portfolioVolatility: number      // annualized
  portfolioSharpe: number
  // Risk parity (equal risk contribution)
  riskParityWeights: Array<{ symbol: string; weight: number }>
  // Kelly optimal leverage
  kellyLeverage: number            // optimal leverage factor
  kellyFraction: number            // safe fraction (quarter Kelly)
  // Efficient frontier (sampled points)
  efficientFrontier: Array<{ return: number; volatility: number; sharpe: number }>
  // Rebalance recommendation
  rebalanceRequired: boolean
  rebalanceTrades: Array<{ symbol: string; action: 'buy' | 'sell'; weightDelta: number; reason: string }>
  lastOptimization: number
}

const SECTOR_COLORS: Record<string, string> = {
  layer1: '#5eead4', layer2: '#7dd3fc', defi: '#c4b5fd', meme: '#f0abfc', stable: '#a3e635',
}

export class PortfolioOptimizer {
  private currentWeights: Map<string, number> = new Map()
  private lastOptimization = 0
  private readonly OPTIMIZE_INTERVAL = 30_000 // re-optimize every 30s

  optimize(
    symbols: Array<{ symbol: string; name: string; sector: string; price: number; changePct: number; volatility: number; sparkline: number[] }>,
    currentEquity: number,
  ): PortfolioOptimizerState {
    const now = Date.now()

    // Filter out stables (they're for parking, not optimization)
    const tradeable = symbols.filter(s => s.sector !== 'stable' && s.sparkline.length >= 10)

    // Compute per-symbol expected return (from recent momentum) and volatility
    const stats = tradeable.map(s => {
      const returns = this.computeReturns(s.sparkline)
      const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length
      const variance = returns.reduce((a, r) => a + (r - meanReturn) ** 2, 0) / returns.length
      const vol = Math.sqrt(variance)
      // Annualized (1s bars → 252*1440*3600 seconds per year)
      const annualReturn = meanReturn * 252 * 1440 * 3600
      const annualVol = vol * Math.sqrt(252 * 1440 * 3600)
      const sharpe = annualVol > 0 ? annualReturn / annualVol : 0
      return {
        symbol: s.symbol, name: s.name, sector: s.sector,
        expectedReturn: annualReturn,
        volatility: annualVol || 0.001,
        sharpe,
        color: SECTOR_COLORS[s.sector] || '#a1a1aa',
        sparkline: s.sparkline,
      }
    })

    // ---- Markowitz: maximize Sharpe (tangency portfolio) ----
    // Simplified: weight ∝ sharpe (in practice: solve quadratic program)
    // The max-Sharpe portfolio weights are proportional to Σ⁻¹ × μ
    // Here we use a simplified inverse-volatility × momentum approach
    const totalSharpe = stats.reduce((a, s) => a + Math.max(0, s.sharpe), 0)
    const allocations: PortfolioAllocation[] = stats.map(s => {
      const rawWeight = totalSharpe > 0 ? Math.max(0, s.sharpe) / totalSharpe : 1 / stats.length
      // Cap at 25% per symbol (diversification)
      const cappedWeight = Math.min(0.25, rawWeight)
      return {
        symbol: s.symbol,
        name: s.name,
        sector: s.sector,
        targetWeight: round(cappedWeight, 4),
        expectedReturn: round(s.expectedReturn * 100, 2),
        volatility: round(s.volatility * 100, 2),
        sharpe: round(s.sharpe, 2),
        color: s.color,
      }
    })

    // Renormalize after capping
    const totalWeight = allocations.reduce((a, al) => a + al.targetWeight, 0)
    allocations.forEach(al => { al.targetWeight = round(al.targetWeight / totalWeight, 4) })

    // ---- Portfolio-level metrics ----
    const portReturn = allocations.reduce((a, al) => a + al.targetWeight * al.expectedReturn, 0) / 100
    const portVol = Math.sqrt(allocations.reduce((a, al) => a + al.targetWeight ** 2 * (al.volatility / 100) ** 2, 0))
    const portSharpe = portVol > 0 ? portReturn / portVol : 0

    // ---- Risk Parity (equal risk contribution) ----
    // Weight ∝ 1/volatility (inverse vol)
    const totalInvVol = stats.reduce((a, s) => a + 1 / (s.volatility || 0.001), 0)
    const riskParityWeights = stats.map(s => ({
      symbol: s.symbol,
      weight: round((1 / (s.volatility || 0.001)) / totalInvVol, 4),
    }))

    // ---- Kelly Optimal Leverage ----
    // f* = μ / σ² (for single asset; multi-asset: f* = Σ⁻¹ × μ)
    // Simplified: use portfolio Sharpe / portfolio volatility
    const kellyLeverage = portVol > 0 ? portReturn / (portVol ** 2) : 0
    const kellyFraction = kellyLeverage * 0.25 // quarter Kelly

    // ---- Efficient Frontier (sampled) ----
    const efficientFrontier: Array<{ return: number; volatility: number; sharpe: number }> = []
    for (let i = 0; i <= 10; i++) {
      const riskAversion = i / 10
      // At one extreme: all max-return, at other: all min-vol
      const ret = portReturn * (1 - riskAversion) + Math.max(...stats.map(s => s.expectedReturn)) * riskAversion
      const vol = portVol * (1 - riskAversion) + Math.min(...stats.map(s => s.volatility)) * riskAversion
      efficientFrontier.push({
        return: round(ret * 100, 2),
        volatility: round(vol * 100, 2),
        sharpe: round(vol > 0 ? ret / vol : 0, 2),
      })
    }

    // ---- Rebalance recommendations ----
    const rebalanceTrades: Array<{ symbol: string; action: 'buy' | 'sell'; weightDelta: number; reason: string }> = []
    for (const al of allocations) {
      const current = this.currentWeights.get(al.symbol) || 0
      const delta = al.targetWeight - current
      if (Math.abs(delta) > 0.03) { // >3% drift
        rebalanceTrades.push({
          symbol: al.symbol,
          action: delta > 0 ? 'buy' : 'sell',
          weightDelta: round(delta, 4),
          reason: `${delta > 0 ? 'Underweight' : 'Overweight'} by ${Math.abs(delta * 100).toFixed(1)}%`,
        })
      }
    }
    // Update current weights
    allocations.forEach(al => this.currentWeights.set(al.symbol, al.targetWeight))

    this.lastOptimization = now

    return {
      allocations: allocations.sort((a, b) => b.targetWeight - a.targetWeight),
      portfolioExpectedReturn: round(portReturn * 100, 2),
      portfolioVolatility: round(portVol * 100, 2),
      portfolioSharpe: round(portSharpe, 2),
      riskParityWeights: riskParityWeights.sort((a, b) => b.weight - a.weight),
      kellyLeverage: round(kellyLeverage, 2),
      kellyFraction: round(kellyFraction, 2),
      efficientFrontier,
      rebalanceRequired: rebalanceTrades.length > 0,
      rebalanceTrades: rebalanceTrades.slice(0, 5),
      lastOptimization: now,
    }
  }

  private computeReturns(prices: number[]): number[] {
    const returns: number[] = []
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1] > 0) returns.push((prices[i] - prices[i - 1]) / prices[i - 1])
    }
    return returns
  }
}

function round(x: number, d: number) { const f = 10 ** d; return Math.round(x * f) / f }
