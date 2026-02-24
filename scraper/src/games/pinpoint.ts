/**
 * Pinpoint game scraper.
 *
 * URL: https://www.linkedin.com/games/pinpoint/
 *
 * Pinpoint is a word association game — guess the category from clue words.
 * Result shows number of guesses used. Lower = better.
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

const GAME_URL = 'https://www.linkedin.com/games/pinpoint/';
const GAME_NAME = 'pinpoint';

export async function scrape(page: Page): Promise<ScrapeResult> {
  const playedDate = todayDateString();
  const capturedAt = nowIsoString();

  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(4000);

  let completed = false;
  let score: number | undefined;      // Pinpoint uses "guesses" as score
  let completionTimeSecs: number | undefined;
  let rawData: Record<string, unknown> = {};

  const resultSelectors = [
    '[class*="result"]',
    '[class*="complete"]',
    '[class*="share"]',
    '[class*="finished"]',
    '[data-test*="result"]',
    '[class*="guess"]',
    '[class*="clue"]',
  ];

  for (const sel of resultSelectors) {
    const found = await waitForSelectorSafe(page, sel, 3000);
    if (found) {
      completed = true;
      const text = await page.$eval(sel, el => el.textContent?.trim() || '').catch(() => '');

      // Try to find guess count (e.g. "Got it in 2!")
      const guessMatch = text.match(/(\d+)\s*(guess|clue|attempt)/i);
      if (guessMatch) score = parseInt(guessMatch[1], 10);

      completionTimeSecs = parseTimeSecs(text);
      rawData = { selector: sel, text, url: page.url() };
      break;
    }
  }

  if (!completed) {
    rawData = { url: page.url() };
  }

  const leaderboard = completed
    ? await extractLeaderboard(page, GAME_NAME, playedDate, capturedAt)
    : [];

  return {
    gameName: GAME_NAME,
    playedDate,
    capturedAt,
    completed,
    score,
    completionTimeSecs,
    leaderboard,
    rawData,
  };
}
