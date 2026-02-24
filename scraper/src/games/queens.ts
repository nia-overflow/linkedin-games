/**
 * Queens game scraper.
 *
 * URL: https://www.linkedin.com/games/queens/
 *
 * Queens is a logic puzzle where you place queens on a colored grid.
 * The result page shows completion time. The leaderboard shows connections'
 * times.
 *
 * NOTE: Exact selectors need to be confirmed after running `pnpm discover`.
 * The selectors below are best guesses based on LinkedIn's common patterns.
 * Update them after inspecting scraper/discovery/queens-html.html.
 */

import type { Page } from 'playwright';
import type { ScrapeResult } from './types.js';
import {
  todayDateString,
  nowIsoString,
  parseTimeSecs,
  waitForSelectorSafe,
  extractLeaderboard,
} from './helpers.js';

const GAME_URL = 'https://www.linkedin.com/games/queens/';
const GAME_NAME = 'queens';

export async function scrape(page: Page): Promise<ScrapeResult> {
  const playedDate = todayDateString();
  const capturedAt = nowIsoString();

  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  // Wait for the game to load (either the puzzle or the results)
  await page.waitForTimeout(4000);

  // ── Detect completed state ─────────────────────────────────────────────────
  // LinkedIn shows a result/share screen after completion.
  // Common patterns: "result", "complete", "share", "time"
  const resultSelectors = [
    '[class*="result"]',
    '[class*="complete"]',
    '[class*="share"]',
    '[class*="finished"]',
    '[data-test*="result"]',
    // Fallback: look for a time display (M:SS format)
    '[class*="time"]',
  ];

  let completed = false;
  let completionTimeSecs: number | undefined;
  let rawData: Record<string, unknown> = {};

  for (const sel of resultSelectors) {
    const found = await waitForSelectorSafe(page, sel, 3000);
    if (found) {
      completed = true;

      // Try to extract the time
      const timeText = await page.$eval(
        sel,
        (el) => el.textContent?.trim() || ''
      ).catch(() => '');

      completionTimeSecs = parseTimeSecs(timeText);
      rawData = { selector: sel, timeText, url: page.url() };
      break;
    }
  }

  // If we didn't find a result, check if we're on the puzzle (not completed)
  if (!completed) {
    // Check if the puzzle iframe or game board is visible (not completed)
    const puzzleVisible = await waitForSelectorSafe(page, '[class*="board"], [class*="grid"], [class*="puzzle"]', 3000);
    rawData = { puzzleVisible, url: page.url() };
  }

  // ── Extract leaderboard ────────────────────────────────────────────────────
  const leaderboard = completed
    ? await extractLeaderboard(page, GAME_NAME, playedDate, capturedAt)
    : [];

  return {
    gameName: GAME_NAME,
    playedDate,
    capturedAt,
    completed,
    completionTimeSecs,
    leaderboard,
    rawData,
  };
}
