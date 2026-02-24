import React, { useState, useEffect } from 'react'
import { StatsBar } from './components/StatsBar'
import { HistoryChart } from './components/HistoryChart'
import { LeaderboardTable } from './components/LeaderboardTable'
import { StalenessWarning } from './components/StalenessWarning'
import { api } from './api'
import type { ScrapeLogEntry } from './api'
import './styles.css'

const KNOWN_GAMES = ['queens', 'tango', 'pinpoint', 'crossclimb', 'zip', 'mini-sudoku']

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function DevTab({ logs }: { logs: ScrapeLogEntry[] }) {
  const errors = logs.filter(e => e.status === 'error')

  return (
    <div className="dev-tab">
      <section className="section">
        <h2 className="section-title">Scrape Errors ({errors.length})</h2>
        {errors.length === 0 ? (
          <p className="dev-empty">No scrape errors recorded.</p>
        ) : (
          <table className="dev-log-table">
            <thead>
              <tr>
                <th>Run Time</th>
                <th>Game</th>
                <th>Status</th>
                <th>Error Message</th>
              </tr>
            </thead>
            <tbody>
              {errors.map(e => (
                <tr key={e.id} className="dev-log-row dev-log-row--error">
                  <td className="dev-log-time">{new Date(e.runAt).toLocaleString()}</td>
                  <td className="dev-log-game">{e.gameName}</td>
                  <td><span className="dev-status dev-status--error">{e.status}</span></td>
                  <td className="dev-log-msg">{e.errorMessage ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">Full Scrape Log ({logs.length} entries)</h2>
        {logs.length === 0 ? (
          <p className="dev-empty">No log entries found.</p>
        ) : (
          <table className="dev-log-table">
            <thead>
              <tr>
                <th>Run Time</th>
                <th>Game</th>
                <th>Status</th>
                <th>Records</th>
                <th>Error Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(e => (
                <tr key={e.id} className={`dev-log-row dev-log-row--${e.status}`}>
                  <td className="dev-log-time">{new Date(e.runAt).toLocaleString()}</td>
                  <td className="dev-log-game">{e.gameName}</td>
                  <td><span className={`dev-status dev-status--${e.status}`}>{e.status}</span></td>
                  <td className="dev-log-records">{e.recordsCaptured ?? '—'}</td>
                  <td className="dev-log-msg">{e.errorMessage ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

export default function App() {
  const [selectedGame, setSelectedGame] = useState<string>('all')
  const [games, setGames] = useState<string[]>(KNOWN_GAMES)
  const [lastCapturedAt, setLastCapturedAt] = useState<string | null>(null)
  const [allLogs, setAllLogs] = useState<ScrapeLogEntry[]>([])

  // Load available games and last capture time
  useEffect(() => {
    api.getGames().then(setGames).catch(() => {})
    api.getLogs().then(data => {
      setLastCapturedAt(data.lastCapturedAt)
      setAllLogs(data.entries)
    }).catch(() => {})
  }, [])

  // Determine if data is stale (last capture > 25 hours ago)
  const isStale = lastCapturedAt
    ? Date.now() - new Date(lastCapturedAt).getTime() > 25 * 60 * 60 * 1000
    : true

  const tabs = ['all', ...games, 'dev']

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
              className={`tab ${selectedGame === game ? 'tab--active' : ''}${game === 'dev' ? ' tab--dev' : ''}`}
              onClick={() => setSelectedGame(game)}
              aria-pressed={selectedGame === game}
            >
              {game === 'all' ? 'All Games' : game === 'dev' ? 'Dev' : capitalize(game)}
            </button>
          ))}
        </nav>

        {selectedGame === 'dev' ? (
          <DevTab logs={allLogs} />
        ) : (
          <>
            {/* Stats bar */}
            <StatsBar game={selectedGame} />

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
          </>
        )}
      </main>
    </div>
  )
}
