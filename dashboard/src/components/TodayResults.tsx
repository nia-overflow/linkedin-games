import React, { useState, useEffect } from 'react'
import { api } from '../api'
import type { GameHistoryEntry } from '../api'

interface Props {
  games: string[]
}

/** Format seconds as M:SS */
function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Get today's local date as YYYY-MM-DD */
function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function TodayResults({ games }: Props) {
  const [entries, setEntries] = useState<GameHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getHistory('all', 1)
      .then(data => {
        const today = todayLocal()
        setEntries(data.filter(e => e.playedDate === today))
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="today-results">
        {games.map(g => (
          <div key={g} className="today-card today-card--loading skeleton" />
        ))}
      </div>
    )
  }

  // Build a lookup: gameName -> entry (prefer completed entry if multiple)
  const byGame = new Map<string, GameHistoryEntry>()
  for (const entry of entries) {
    const existing = byGame.get(entry.gameName)
    if (!existing || entry.completed) {
      byGame.set(entry.gameName, entry)
    }
  }

  return (
    <div className="today-results">
      {games.map(game => {
        const entry = byGame.get(game)

        // Not played today
        if (!entry) {
          return (
            <div key={game} className="today-card today-card--unplayed">
              <span className="today-card__status">⬜</span>
              <span className="today-card__name">{capitalize(game)}</span>
              <span className="today-card__time today-card__time--none">—</span>
            </div>
          )
        }

        // Played — completed or not
        const timeLabel = entry.completed
          ? getTimeLabel(game, entry)
          : 'Did not finish'

        return (
          <div
            key={game}
            className={`today-card ${entry.completed ? 'today-card--completed' : 'today-card--incomplete'}`}
          >
            <span className="today-card__status">{entry.completed ? '✅' : '❌'}</span>
            <span className="today-card__name">{capitalize(game)}</span>
            <span className="today-card__time">{timeLabel}</span>
            {entry.percentile !== null && entry.percentile !== undefined && (
              <span className="today-card__percentile">{entry.percentile}th %ile</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Returns the display string for a game entry's result */
function getTimeLabel(game: string, entry: GameHistoryEntry): string {
  if (game === 'pinpoint') {
    // score = number of guesses used
    if (entry.score !== null) {
      return `${entry.score} guess${entry.score === 1 ? '' : 'es'}`
    }
    return 'Completed'
  }
  if (entry.completionTimeSecs !== null) {
    return formatTime(entry.completionTimeSecs)
  }
  return 'Completed'
}
