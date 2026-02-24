/**
 * Scraper Orchestrator — Phase 1.6
 *
 * Runs all 6 game scrapers sequentially using the dedicated Chrome profile.
 * Saves results to SQLite. Logs each game's outcome.
 *
 * Designed to be run by launchd at 11:55 PM nightly.
 * Exits with code 0 even on partial failure (launchd won't retry).
 *
 * Usage:
 *   pnpm scrape
 */

import { chromium } from 'playwright';
import path from 'path';
import os from 'os';

import { upsertGameResult, upsertLeaderboardEntries, logScrapeRun } from './db/index.js';
import type { ScrapeResult } from './games/types.js';

import { scrape as scrapeQueens }     from './games/queens.js';
import { scrape as scrapeTango }      from './games/tango.js';
import { scrape as scrapePinpoint }   from './games/pinpoint.js';
import { scrape as scrapeCrossclimb } from './games/crossclimb.js';
import { scrape as scrapeZip }        from './games/zip.js';
import { scrape as scrapeMiniSudoku } from './games/mini-sudoku.js';

const PROFILE_PATH = path.join(os.homedir(), '.linkedin-games', 'chrome-profile');

const GAMES = [
  { name: 'queens',     fn: scrapeQueens },
  { name: 'tango',      fn: scrapeTango },
  { name: 'pinpoint',   fn: scrapePinpoint },
  { name: 'crossclimb', fn: scrapeCrossclimb },
  { name: 'zip',        fn: scrapeZip },
  { name: 'mini-sudoku', fn: scrapeMiniSudoku },
] as const;

async function runScraper(): Promise<void> {
  const runAt = new Date().toISOString();
  console.log(`[${runAt}] LinkedIn Games scraper starting...`);

  // Verify the profile exists before launching Chrome
  const { existsSync } = await import('fs');
  if (!existsSync(PROFILE_PATH)) {
    console.error(`❌ Chrome profile not found at: ${PROFILE_PATH}`);
    console.error('   Run `pnpm setup:profile` first.');
    process.exit(1);
  }

  const context = await chromium.launchPersistentContext(PROFILE_PATH, {
    headless: true,   // Run headless for nightly automation
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  console.log('Browser launched. Running scrapers...\n');

  for (const game of GAMES) {
    const gameStart = Date.now();
    console.log(`⏳ Scraping: ${game.name}`);

    try {
      const page = await context.newPage();
      let result: ScrapeResult;

      try {
        result = await game.fn(page);
      } finally {
        await page.close();
      }

      // Compute percentile: % of leaderboard connections beaten.
      // Formula: ((total - selfRank) / total) * 100
      // e.g. rank 3 of 25 → (25-3)/25*100 = 88th percentile
      const selfEntry = result.leaderboard.find(e => e.isSelf);
      const total = result.leaderboard.length;
      const percentile = (selfEntry?.rank != null && total > 0)
        ? Math.round(((total - selfEntry.rank) / total) * 100)
        : undefined;
      const myRank = selfEntry?.rank ?? undefined;

      // Persist game result
      upsertGameResult({
        gameName: result.gameName,
        playedDate: result.playedDate,
        capturedAt: result.capturedAt,
        completed: result.completed,
        score: result.score,
        completionTimeSecs: result.completionTimeSecs,
        percentile,
        myRank,
        rawData: result.rawData,
      });

      // Persist leaderboard entries
      if (result.leaderboard.length > 0) {
        upsertLeaderboardEntries(result.leaderboard);
      }

      // Log the outcome
      const status = result.completed ? 'success' : 'no_result';
      logScrapeRun({
        runAt,
        gameName: result.gameName,
        status,
        recordsCaptured: result.leaderboard.length,
      });

      const elapsed = ((Date.now() - gameStart) / 1000).toFixed(1);
      const statusIcon = result.completed ? '✅' : '⚪';
      const timeStr = result.completionTimeSecs
        ? ` (${Math.floor(result.completionTimeSecs / 60)}:${String(result.completionTimeSecs % 60).padStart(2, '0')})`
        : '';
      const leaderboardStr = result.leaderboard.length > 0
        ? ` | ${result.leaderboard.length} leaderboard entries`
        : '';

      console.log(`${statusIcon} ${game.name}: ${result.completed ? 'completed' : 'not played'}${timeStr}${leaderboardStr} [${elapsed}s]`);

    } catch (err) {
      const error = err as Error;
      console.error(`❌ ${game.name}: ${error.message}`);

      logScrapeRun({
        runAt,
        gameName: game.name,
        status: 'error',
        errorMessage: error.message,
      });
      // Continue with remaining games — don't let one failure block others
    }
  }

  await context.close();

  console.log('\n✅ Scraper run complete.');
  // Exit cleanly (important for launchd — non-zero exit triggers restart)
  process.exit(0);
}

runScraper().catch(err => {
  console.error('Fatal scraper error:', err);
  // Still exit 0 so launchd doesn't spam retries
  process.exit(0);
});
