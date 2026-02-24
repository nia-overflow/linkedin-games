import React, { useState, useEffect } from 'react'
import { StatsBar } from './components/StatsBar'
import { HistoryChart } from './components/HistoryChart'
import { LeaderboardTable } from './components/LeaderboardTable'
import { StalenessWarning } from './components/StalenessWarning'
import { TodayResults } from './components/TodayResults'
import { api } from './api'
import type { ScrapeLogEntry } from './api'
import './styles.css'

const KNOWN_GAMES = ['queens', 'tango', 'pinpoint', 'crossclimb', 'zip', 'mini-sudoku']

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function App() {
  const [selectedGame, setSelectedGame] = useState<string>('all')
  const [games, setGames] = useState<string[]>(KNOWN_GAMES)
  const [lastCapturedAt, setLastCapturedAt] = useState<string | null>(null)
  const [recentErrors, setRecentErrors] = useState<ScrapeLogEntry[]>([])

  // Load available games and last capture time
  useEffect(() => {
    api.getGames().then(setGames).catch(() => {})
    api.getLogs().then(data => {
      setLastCapturedAt(data.lastCapturedAt)
      setRecentErrors(data.entries.filter(e => e.status === 'error'))
    }).catch(() => {})
  }, [])

  // Determine if data is stale (last capture > 25 hours ago)
  const isStale = lastCapturedAt
    ? Date.now() - new Date(lastCapturedAt).getTime() > 25 * 60 * 60 * 1000
    : true

  const tabs = ['all', ...games]

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-title">
            <span className="header-logo">🎮</span>
            <h1>LinkedIn Games Dashboard</h1>
          </div>
          {lastCapturedAt && (
            <div className="header-meta">
              Last updated: {new Date(lastCapturedAt).toLocaleString()}
            </div>
          )}
        </div>
      </header>

      {isStale && <StalenessWarning lastCapturedAt={lastCapturedAt} />}

      <main className="app-main">
        {/* Game tabs */}
        <nav className="tabs" aria-label="Game filter">
          {tabs.map(game => (
            <button
              key={game}
              className={`tab ${selectedGame === game ? 'tab--active' : ''}`}
              onClick={() => setSelectedGame(game)}
              aria-pressed={selectedGame === game}
            >
              {game === 'all' ? 'All Games' : capitalize(game)}
            </button>
          ))}
        </nav>

        {/* Stats bar */}
        <StatsBar game={selectedGame} />

        {/* Today's Results — only shown on the All Games tab */}
        {selectedGame === 'all' && (
          <section className="section">
            <h2 className="section-title">Today's Results</h2>
            <TodayResults games={games} />
          </section>
        )}

        {/* History chart */}
        <section className="section">
          <h2 className="section-title">
            {selectedGame === 'all' ? 'All Games History' : `${capitalize(selectedGame)} History`}
          </h2>
          <HistoryChart game={selectedGame} />
        </section>

        {/* Leaderboard (only for specific games, not "all") */}
        {selectedGame !== 'all' && (
          <section className="section">
            <h2 className="section-title">Today's Leaderboard</h2>
            <LeaderboardTable game={selectedGame} />
          </section>
        )}

        {/* Error log */}
        {recentErrors.length > 0 && (
          <section className="section">
            <h2 className="section-title">Recent Scrape Errors</h2>
            <div className="error-list">
              {recentErrors.slice(0, 5).map(e => (
                <div key={e.id} className="error-item">
                  <span className="error-game">{e.gameName}</span>
                  <span className="error-time">{new Date(e.runAt).toLocaleString()}</span>
                  <span className="error-msg">{e.errorMessage}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
