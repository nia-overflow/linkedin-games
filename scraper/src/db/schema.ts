/**
 * SQLite schema migrations for LinkedIn Games scraper.
 *
 * Uses better-sqlite3 (synchronous) — no async/await needed.
 * Running this module is idempotent: CREATE TABLE IF NOT EXISTS ensures
 * re-runs are safe.
 */

import Database from 'better-sqlite3';

export function applySchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- ── game_results ────────────────────────────────────────────────────────
    -- One row per (game, date). Upserted each scrape run.
    CREATE TABLE IF NOT EXISTS game_results (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      game_name             TEXT    NOT NULL,
      played_date           DATE    NOT NULL,         -- 'YYYY-MM-DD'
      captured_at           TIMESTAMP NOT NULL,
      completed             BOOLEAN NOT NULL,
      score                 INTEGER,                  -- game-specific numeric score
      completion_time_secs  INTEGER,                  -- seconds to complete, if available
      raw_data              JSON,                     -- full scraped JSON for debugging
      UNIQUE(game_name, played_date)
    );

    -- ── leaderboard_entries ─────────────────────────────────────────────────
    -- One row per (game, date, connection_name). Multiple rows per game/date.
    CREATE TABLE IF NOT EXISTS leaderboard_entries (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      game_name             TEXT    NOT NULL,
      played_date           DATE    NOT NULL,
      captured_at           TIMESTAMP NOT NULL,
      rank                  INTEGER,
      connection_name       TEXT    NOT NULL,
      connection_profile_url TEXT,
      score                 INTEGER,
      completion_time_secs  INTEGER,
      is_self               BOOLEAN NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_leaderboard_game_date
      ON leaderboard_entries(game_name, played_date);

    -- ── scrape_log ──────────────────────────────────────────────────────────
    -- One row per (run, game). Tracks success/failure of each scrape.
    CREATE TABLE IF NOT EXISTS scrape_log (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      run_at                TIMESTAMP NOT NULL,
      game_name             TEXT    NOT NULL,
      status                TEXT    NOT NULL  CHECK(status IN ('success', 'error', 'no_result')),
      error_message         TEXT,
      records_captured      INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_scrape_log_run_at
      ON scrape_log(run_at DESC);
  `);

  // ── Migrations ─────────────────────────────────────────────────────────────
  // ALTER TABLE is idempotent via the existence check below.
  const gameResultsCols = (db.prepare("PRAGMA table_info(game_results)").all() as { name: string }[]).map(c => c.name);
  if (!gameResultsCols.includes('percentile')) {
    db.exec(`ALTER TABLE game_results ADD COLUMN percentile INTEGER`);
  }
  if (!gameResultsCols.includes('my_rank')) {
    db.exec(`ALTER TABLE game_results ADD COLUMN my_rank INTEGER`);
  }
}
