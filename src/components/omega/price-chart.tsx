'use client'

import { useEffect, useRef } from 'react'
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi } from 'lightweight-charts'
import { CandlestickChart as ChartIcon } from 'lucide-react'

interface CandleData {
  time: number
  open: number
  high: number
  low: number
  close: number
}

interface PriceChartProps {
  candles: CandleData[]
  positionPrice?: number | null
  takeProfit?: number | null
  stopLoss?: number | null
  symbol?: string
}

export function PriceChart({ candles, positionPrice, takeProfit, stopLoss, symbol }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const priceLinesRef = useRef<unknown[]>([])

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#71717a',
        fontFamily: 'ui-monospace, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(63, 63, 70, 0.3)' },
        horzLines: { color: 'rgba(63, 63, 70, 0.3)' },
      },
      rightPriceScale: { borderColor: 'rgba(63, 63, 70, 0.5)' },
      timeScale: { borderColor: 'rgba(63, 63, 70, 0.5)', timeVisible: true, secondsVisible: true },
      crosshair: {
        vertLine: { color: '#5eead4', width: 1, style: 2, labelBackgroundColor: '#0d9488' },
        horzLine: { color: '#5eead4', width: 1, style: 2, labelBackgroundColor: '#0d9488' },
      },
      width: containerRef.current.clientWidth,
      height: 260,
    })
    chartRef.current = chart
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#34d399',
      downColor: '#fb7185',
      borderUpColor: '#34d399',
      borderDownColor: '#fb7185',
      wickUpColor: '#34d399',
      wickDownColor: '#fb7185',
    })
    seriesRef.current = series

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    if (seriesRef.current && candles.length > 0) {
      const data = candles.map((c) => ({ time: c.time as never, open: c.open, high: c.high, low: c.low, close: c.close }))
      seriesRef.current.setData(data)
    }
  }, [candles])

  useEffect(() => {
    if (!seriesRef.current) return
    // clear old price lines
    for (const pl of priceLinesRef.current) {
      try {
        seriesRef.current.removePriceLine(pl as never)
      } catch {
        /* noop */
      }
    }
    priceLinesRef.current = []
    if (positionPrice) {
      priceLinesRef.current.push(
        seriesRef.current.createPriceLine({
          price: positionPrice,
          color: '#5eead4',
          lineWidth: 1,
          lineStyle: 0,
          axisLabelVisible: true,
          title: 'ENTRY',
        }),
      )
    }
    if (takeProfit) {
      priceLinesRef.current.push(
        seriesRef.current.createPriceLine({
          price: takeProfit,
          color: '#34d399',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'TP',
        }),
      )
    }
    if (stopLoss) {
      priceLinesRef.current.push(
        seriesRef.current.createPriceLine({
          price: stopLoss,
          color: '#fb7185',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'SL',
        }),
      )
    }
  }, [positionPrice, takeProfit, stopLoss])

  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 backdrop-blur-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChartIcon className="h-4 w-4 text-teal-400" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">
            Price Action{symbol && <span className="ml-2 text-teal-300">{symbol}/USDT</span>}
          </h2>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">TradingView · 1s candles · {symbol || 'BTC'}</span>
        </div>
        {candles.length > 0 && (
          <span className="font-mono text-[10px] text-zinc-500">{candles.length} bars</span>
        )}
      </div>
      <div ref={containerRef} className="w-full" style={{ height: 260 }} />
    </section>
  )
}
