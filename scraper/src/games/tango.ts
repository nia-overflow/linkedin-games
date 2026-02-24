/**
 * Tango game scraper.
 *
 * URL: https://www.linkedin.com/games/tango/
 *
 * Tango is a logic puzzle with sun/moon symbols on a grid.
 * Result shows completion time.
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

const GAME_URL = 'https://www.linkedin.com/games/tango/';
const GAME_NAME = 'tango';

export async function scrape(page: Page): Promise<ScrapeResult> {
  const playedDate = todayDateString();
  const capturedAt = nowIsoString();

  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(4000);

  let completed = false;
  let completionTimeSecs: number | undefined;
  let rawData: Record<string, unknown> = {};

  const resultSelectors = [
    '[class*="result"]',
    '[class*="complete"]',
    '[class*="share"]',
    '[class*="finished"]',
    '[data-test*="result"]',
    '[class*="time"]',
  ];

  for (const sel of resultSelectors) {
    const found = await waitForSelectorSafe(page, sel, 3000);
    if (found) {
      completed = true;
      const timeText = await page.$eval(sel, el => el.textContent?.trim() || '').catch(() => '');
      completionTimeSecs = parseTimeSecs(timeText);
      rawData = { selector: sel, timeText, url: page.url() };
      break;
    }
  }

  if (!completed) {
    const puzzleVisible = await waitForSelectorSafe(page, '[class*="board"], [class*="grid"], [class*="puzzle"]', 3000);
    rawData = { puzzleVisible, url: page.url() };
  }

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
