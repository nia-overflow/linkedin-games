import React, { useEffect, useState } from 'react'
import { api } from '../api'
import type { GameStats } from '../api'

function formatTime(secs: number | null): string {
  if (secs === null) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

interface Props {
  game: string
}

export function StatsBar({ game }: Props) {
  const [stats, setStats] = useState<GameStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.getStats(game, 30)
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [game])

  if (loading) {
    return (
      <div className="stats-bar stats-bar--loading">
        <div className="stat-card skeleton" />
        <div className="stat-card skeleton" />
        <div className="stat-card skeleton" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="stats-bar stats-bar--error">
        <p>Unable to load stats: {error}</p>
      </div>
    )
  }

  return (
    <div className="stats-bar">
      <div className="stat-card">
        <div className="stat-value stat-value--streak">
          {stats.streak}
          <span className="stat-emoji">🔥</span>
        </div>
        <div className="stat-label">Current Streak</div>
        <div className="stat-sub">days</div>
      </div>

      <div className="stat-card">
        <div className="stat-value">{stats.winRate}%</div>
        <div className="stat-label">Win Rate</div>
        <div className="stat-sub">{stats.totalCompleted}/{stats.totalPlayed} completed</div>
      </div>

      <div className="stat-card">
        <div className="stat-value">{formatTime(stats.avgCompletionSecs)}</div>
        <div className="stat-label">Avg Time</div>
        <div className="stat-sub">last 30 days</div>
      </div>

      <div className="stat-card">
        <div className="stat-value">
          {stats.avgPercentile !== null ? `${stats.avgPercentile}th` : '—'}
        </div>
        <div className="stat-label">Avg Percentile</div>
        <div className="stat-sub">vs connections</div>
      </div>
    </div>
  )
}
