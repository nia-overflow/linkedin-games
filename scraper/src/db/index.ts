/**
 * SQLite data access layer for the LinkedIn Games scraper.
 *
 * All functions are synchronous (better-sqlite3 is sync-only).
 * The database file lives at ~/.linkedin-games/games.db
 */

import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import { mkdirSync } from 'fs';
import { applySchema } from './schema.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface GameResult {
  gameName: string;
  playedDate: string;        // 'YYYY-MM-DD'
  capturedAt: string;        // ISO timestamp
  completed: boolean;
  score?: number;
  completionTimeSecs?: number;
  percentile?: number;       // 0–100: % of leaderboard connections beaten
  rawData?: unknown;
}

export interface LeaderboardEntry {
  gameName: string;
  playedDate: string;
  capturedAt: string;
  rank?: number;
  connectionName: string;
  connectionProfileUrl?: string;
  score?: number;
  completionTimeSecs?: number;
  isSelf: boolean;
}

export interface ScrapeLog {
  runAt: string;
  gameName: string;
  status: 'success' | 'error' | 'no_result';
  errorMessage?: string;
  recordsCaptured?: number;
}

// ── DB singleton ────────────────────────────────────────────────────────────

const DATA_DIR = path.join(os.homedir(), '.linkedin-games');
const DB_PATH = path.join(DATA_DIR, 'games.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  mkdirSync(DATA_DIR, { recursive: true });
  _db = new Database(DB_PATH);
  applySchema(_db);
  return _db;
}

// ── Write operations ────────────────────────────────────────────────────────

/**
 * Insert or replace a game result.
 * The UNIQUE(game_name, played_date) constraint means re-running on the same
 * day will overwrite the previous result with fresh data.
 */
export function upsertGameResult(result: GameResult): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO game_results
      (game_name, played_date, captured_at, completed, score, completion_time_secs, percentile, raw_data)
    VALUES
      (@gameName, @playedDate, @capturedAt, @completed, @score, @completionTimeSecs, @percentile, @rawData)
    ON CONFLICT(game_name, played_date) DO UPDATE SET
      captured_at           = excluded.captured_at,
      completed             = excluded.completed,
      score                 = excluded.score,
      completion_time_secs  = excluded.completion_time_secs,
      percentile            = excluded.percentile,
      raw_data              = excluded.raw_data
  `).run({
    gameName: result.gameName,
    playedDate: result.playedDate,
    capturedAt: result.capturedAt,
    completed: result.completed ? 1 : 0,
    score: result.score ?? null,
    completionTimeSecs: result.completionTimeSecs ?? null,
    percentile: result.percentile ?? null,
    rawData: result.rawData ? JSON.stringify(result.rawData) : null,
  });
}

/**
 * Replace all leaderboard entries for a (game, date) pair.
 * Deletes old entries first so stale data never accumulates.
 */
export function upsertLeaderboardEntries(entries: LeaderboardEntry[]): void {
  if (entries.length === 0) return;
  const db = getDb();

  const { gameName, playedDate } = entries[0];

  const deleteOld = db.prepare(`
    DELETE FROM leaderboard_entries
    WHERE game_name = ? AND played_date = ?
  `);

  const insert = db.prepare(`
    INSERT INTO leaderboard_entries
      (game_name, played_date, captured_at, rank, connection_name,
       connection_profile_url, score, completion_time_secs, is_self)
    VALUES
      (@gameName, @playedDate, @capturedAt, @rank, @connectionName,
       @connectionProfileUrl, @score, @completionTimeSecs, @isSelf)
  `);

  const run = db.transaction(() => {
    deleteOld.run(gameName, playedDate);
    for (const e of entries) {
      insert.run({
        gameName: e.gameName,
        playedDate: e.playedDate,
        capturedAt: e.capturedAt,
        rank: e.rank ?? null,
        connectionName: e.connectionName,
        connectionProfileUrl: e.connectionProfileUrl ?? null,
        score: e.score ?? null,
        completionTimeSecs: e.completionTimeSecs ?? null,
        isSelf: e.isSelf ? 1 : 0,
      });
    }
  });

  run();
}

/**
 * Log the outcome of one game's scrape run.
 */
export function logScrapeRun(log: ScrapeLog): void {
  getDb().prepare(`
    INSERT INTO scrape_log (run_at, game_name, status, error_message, records_captured)
    VALUES (@runAt, @gameName, @status, @errorMessage, @recordsCaptured)
  `).run({
    runAt: log.runAt,
    gameName: log.gameName,
    status: log.status,
    errorMessage: log.errorMessage ?? null,
    recordsCaptured: log.recordsCaptured ?? null,
  });
}

// ── Read operations ─────────────────────────────────────────────────────────

export interface GameResultRow {
  id: number;
  game_name: string;
  played_date: string;
  captured_at: string;
  completed: number;
  score: number | null;
  completion_time_secs: number | null;
  percentile: number | null;
  raw_data: string | null;
}

/**
 * Fetch recent results for a game (or all games if gameName === 'all').
 */
export function getResultsForGame(gameName: string, days: number): GameResultRow[] {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  if (gameName === 'all') {
    return db.prepare(`
      SELECT * FROM game_results
      WHERE played_date >= ?
      ORDER BY played_date DESC, game_name ASC
    `).all(cutoffStr) as GameResultRow[];
  }

  return db.prepare(`
    SELECT * FROM game_results
    WHERE game_name = ? AND played_date >= ?
    ORDER BY played_date DESC
  `).all(gameName, cutoffStr) as GameResultRow[];
}

export interface LeaderboardRow {
  id: number;
  game_name: string;
  played_date: string;
  captured_at: string;
  rank: number | null;
  connection_name: string;
  connection_profile_url: string | null;
  score: number | null;
  completion_time_secs: number | null;
  is_self: number;
}

/**
 * Fetch the leaderboard for a specific game and date.
 */
export function getLeaderboard(gameName: string, date: string): LeaderboardRow[] {
  return getDb().prepare(`
    SELECT * FROM leaderboard_entries
    WHERE game_name = ? AND played_date = ?
    ORDER BY rank ASC NULLS LAST, completion_time_secs ASC NULLS LAST
  `).all(gameName, date) as LeaderboardRow[];
}

export interface ScrapeLogRow {
  id: number;
  run_at: string;
  game_name: string;
  status: string;
  error_message: string | null;
  records_captured: number | null;
}

/**
 * Fetch recent scrape log entries.
 */
export function getRecentLogs(days: number): ScrapeLogRow[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return getDb().prepare(`
    SELECT * FROM scrape_log
    WHERE run_at >= ?
    ORDER BY run_at DESC
  `).all(cutoff.toISOString()) as ScrapeLogRow[];
}
