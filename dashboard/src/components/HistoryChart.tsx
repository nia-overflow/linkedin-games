import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts'
import { api } from '../api'
import type { GameHistoryEntry } from '../api'

interface ChartPoint {
  date: string
  completed: number
  missed: number
  timeSecs: number | null
  gameName?: string
}

interface Props {
  game: string
}

function formatTime(secs: number | null): string {
  if (secs === null) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function CustomTooltip({ active, payload, label, isPinpoint }: any) {
  if (!active || !payload?.length) return null
  const data = payload[0]?.payload as ChartPoint
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-date">{label}</p>
      {data.gameName && <p>Game: {data.gameName}</p>}
      <p>{data.completed ? '✅ Completed' : '❌ Not completed'}</p>
      {data.timeSecs !== null && data.timeSecs !== undefined && (
        isPinpoint
          ? <p>Guesses: {data.timeSecs}</p>
          : <p>Time: {formatTime(data.timeSecs)}</p>
      )}
    </div>
  )
}

export function HistoryChart({ game }: Props) {
  const [history, setHistory] = useState<GameHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.getHistory(game, 30)
      .then(setHistory)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [game])

  if (loading) {
    return <div className="chart-placeholder skeleton" style={{ height: 220 }} />
  }

  if (error) {
    return <div className="chart-error">Unable to load history: {error}</div>
  }

  if (history.length === 0) {
    return (
      <div className="chart-empty">
        <p>No data yet. Run the scraper to capture game results.</p>
        <code>pnpm scrape</code>
      </div>
    )
  }

  // For "all games" view: aggregate by date, count games completed per day
  // For single game: show completion time trend (or guess count for Pinpoint)
  let chartData: ChartPoint[]

  const isPinpoint = game === 'pinpoint'

  if (game === 'all') {
    const byDate: Record<string, { completed: number; missed: number }> = {}
    history.forEach(h => {
      if (!byDate[h.playedDate]) byDate[h.playedDate] = { completed: 0, missed: 0 }
      if (h.completed) byDate[h.playedDate].completed++
      else byDate[h.playedDate].missed++
    })
    chartData = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, counts]) => ({
        date: date.slice(5), // MM-DD
        ...counts,
        timeSecs: null,
      }))
  } else {
    chartData = history
      .slice(0, 30)
      .reverse()
      .map(h => ({
        date: h.playedDate.slice(5),
        completed: h.completed ? 1 : 0,
        missed: h.completed ? 0 : 1,
        // Pinpoint stores guess count in `score`; all other games store seconds in `completionTimeSecs`
        timeSecs: isPinpoint ? h.score : h.completionTimeSecs,
        gameName: h.gameName,
      }))
  }

  if (game === 'all') {
    return (
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="completed" name="Completed" stackId="a" fill="#0a66c2" />
            <Bar dataKey="missed" name="Missed" stackId="a" fill="#e8e8e8" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // Single game: color bars by completion, height by time (or guess count for Pinpoint)
  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => isPinpoint ? String(v) : formatTime(v as number)}
          />
          <Tooltip content={<CustomTooltip isPinpoint={isPinpoint} />} />
          <Bar dataKey="timeSecs" name={isPinpoint ? 'Guesses' : 'Completion Time'}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.completed ? '#0a66c2' : '#e8e8e8'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="chart-legend-note">
        <span style={{ color: '#0a66c2' }}>■</span> Completed &nbsp;
        <span style={{ color: '#ccc' }}>■</span> Not played
      </p>
    </div>
  )
}
