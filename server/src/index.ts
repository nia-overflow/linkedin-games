/**
 * LinkedIn Games Dashboard — Express API Server
 *
 * Runs at http://localhost:3000
 * Reads from SQLite at ~/.linkedin-games/games.db
 * Serves the Vite-built dashboard from dashboard/dist/
 *
 * Routes:
 *   GET /api/stats?game=all|queens|tango|...
 *   GET /api/history?game=...&days=30
 *   GET /api/leaderboard?game=...&date=YYYY-MM-DD
 *   GET /api/logs
 *   GET /* → serves dashboard SPA
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  getResultsForGame,
  getLeaderboard,
  getRecentLogs,
  getDb,
} from '../../scraper/src/db/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = parseInt(process.env['PORT'] || '3000', 10);

// ── Middleware ─────────────────────────────────────────────────────────────

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json());

// ── /api/stats ─────────────────────────────────────────────────────────────
/**
 * Returns computed stats: streak, win rate, avg completion time.
 * Query params:
 *   game: 'all' | 'queens' | 'tango' | 'pinpoint' | 'crossclimb' | 'zip' | 'wordle'
 *   days: number (default 30, max 365)
 */
app.get('/api/stats', (req, res) => {
  const game = (req.query['game'] as string) || 'all';
  const days = Math.min(parseInt((req.query['days'] as string) || '30', 10), 365);

  const rows = getResultsForGame(game, days);

  if (rows.length === 0) {
    return res.json({
      game,
      streak: 0,
      winRate: 0,
      avgCompletionSecs: null,
      totalPlayed: 0,
      totalCompleted: 0,
      lastPlayedDate: null,
    });
  }

  // Compute streak (consecutive completed days ending today or yesterday)
  const completedDates = [
    ...new Set(
      rows
        .filter(r => r.completed)
        .map(r => r.played_date)
    ),
  ].sort().reverse();

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < completedDates.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split('T')[0];

    if (completedDates[i] === expectedStr) {
      streak++;
    } else {
      // Allow yesterday as the start (in case today's games haven't been played)
      if (i === 0) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        if (completedDates[0] === yesterdayStr) {
          streak++;
          continue;
        }
      }
      break;
    }
  }

  const totalPlayed = rows.length;
  const totalCompleted = rows.filter(r => r.completed).length;
  const winRate = totalPlayed > 0 ? Math.round((totalCompleted / totalPlayed) * 100) : 0;

  const completionTimes = rows
    .filter(r => r.completion_time_secs !== null)
    .map(r => r.completion_time_secs as number);
  const avgCompletionSecs = completionTimes.length > 0
    ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
    : null;

  return res.json({
    game,
    streak,
    winRate,
    avgCompletionSecs,
    totalPlayed,
    totalCompleted,
    lastPlayedDate: rows[0]?.played_date || null,
  });
});

// ── /api/history ────────────────────────────────────────────────────────────
/**
 * Returns raw game result history.
 * Query params:
 *   game: 'all' | game name
 *   days: number (default 30, max 365)
 */
app.get('/api/history', (req, res) => {
  const game = (req.query['game'] as string) || 'all';
  const days = Math.min(parseInt((req.query['days'] as string) || '30', 10), 365);

  const rows = getResultsForGame(game, days);

  return res.json(rows.map(r => ({
    id: r.id,
    gameName: r.game_name,
    playedDate: r.played_date,
    capturedAt: r.captured_at,
    completed: Boolean(r.completed),
    score: r.score,
    completionTimeSecs: r.completion_time_secs,
  })));
});

// ── /api/leaderboard ────────────────────────────────────────────────────────
/**
 * Returns the leaderboard for a specific game and date.
 * Query params:
 *   game: game name (required)
 *   date: 'YYYY-MM-DD' (default: today)
 */
app.get('/api/leaderboard', (req, res) => {
  const game = req.query['game'] as string;
  if (!game) {
    return res.status(400).json({ error: 'game query param is required' });
  }

  const date = (req.query['date'] as string) || new Date().toISOString().split('T')[0];

  const rows = getLeaderboard(game, date);

  return res.json(rows.map(r => ({
    id: r.id,
    gameName: r.game_name,
    playedDate: r.played_date,
    rank: r.rank,
    connectionName: r.connection_name,
    connectionProfileUrl: r.connection_profile_url,
    score: r.score,
    completionTimeSecs: r.completion_time_secs,
    isSelf: Boolean(r.is_self),
  })));
});

// ── /api/logs ──────────────────────────────────────────────────────────────
/**
 * Returns recent scrape log entries (last 7 days).
 */
app.get('/api/logs', (_req, res) => {
  const rows = getRecentLogs(7);
  const lastSuccessRow = rows.find(r => r.status === 'success');

  return res.json({
    lastCapturedAt: lastSuccessRow?.run_at || null,
    entries: rows.map(r => ({
      id: r.id,
      runAt: r.run_at,
      gameName: r.game_name,
      status: r.status,
      errorMessage: r.error_message,
      recordsCaptured: r.records_captured,
    })),
  });
});

// ── /api/games ─────────────────────────────────────────────────────────────
/**
 * Returns the list of known game names (for populating tabs/filters).
 */
app.get('/api/games', (_req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      'SELECT DISTINCT game_name FROM game_results ORDER BY game_name ASC'
    ).all() as { game_name: string }[];
    return res.json(rows.map(r => r.game_name));
  } catch {
    // Return defaults if no data yet
    return res.json(['queens', 'tango', 'pinpoint', 'crossclimb', 'zip', 'mini-sudoku']);
  }
});

// ── Serve dashboard SPA ─────────────────────────────────────────────────────
// In production, serve the built Vite output.
// In dev, the Vite dev server (port 5173) proxies /api to here.
const dashboardDist = path.resolve(__dirname, '../../dashboard/dist');

app.use(express.static(dashboardDist));

// SPA fallback — serve index.html for any non-API route
app.get('*', (_req, res) => {
  const indexPath = path.join(dashboardDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send(`
        <html><body>
          <h2>LinkedIn Games Dashboard</h2>
          <p>Dashboard not built yet. Run: <code>pnpm build</code></p>
          <p>API is running at <a href="/api/logs">/api/logs</a></p>
        </body></html>
      `);
    }
  });
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`LinkedIn Games server running at http://localhost:${PORT}`);
});

export default app;
