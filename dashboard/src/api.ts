/**
 * API client — all calls go to http://localhost:3000/api/*
 */

const BASE = '/api'

export interface GameStats {
  game: string
  streak: number
  winRate: number
  avgCompletionSecs: number | null
  avgPercentile: number | null
  totalPlayed: number
  totalCompleted: number
  lastPlayedDate: string | null
}

export interface GameHistoryEntry {
  id: number
  gameName: string
  playedDate: string
  capturedAt: string
  completed: boolean
  score: number | null
  completionTimeSecs: number | null
  percentile: number | null
  myRank: number | null
}

export interface LeaderboardEntry {
  id: number
  gameName: string
  playedDate: string
  rank: number | null
  connectionName: string
  connectionProfileUrl: string | null
  score: number | null
  completionTimeSecs: number | null
  isSelf: boolean
}

export interface ScrapeLogEntry {
  id: number
  runAt: string
  gameName: string
  status: 'success' | 'error' | 'no_result'
  errorMessage: string | null
  recordsCaptured: number | null
}

export interface LogsResponse {
  lastCapturedAt: string | null
  entries: ScrapeLogEntry[]
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(BASE + path, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  return res.json()
}

export const api = {
  getStats: (game: string, days = 30) =>
    get<GameStats>('/stats', { game, days: String(days) }),

  getHistory: (game: string, days = 30) =>
    get<GameHistoryEntry[]>('/history', { game, days: String(days) }),

  getLeaderboard: (game: string, date?: string) =>
    get<LeaderboardEntry[]>('/leaderboard', {
      game,
      ...(date ? { date } : {}),
    }),

  getLogs: () => get<LogsResponse>('/logs'),

  getGames: () => get<string[]>('/games'),
}
