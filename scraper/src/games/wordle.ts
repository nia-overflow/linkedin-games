/**
 * LinkedIn Wordle-style game scraper.
 *
 * LinkedIn's 6th game is currently "LinkedIn Wordle" (called "Guess").
 * URL: https://www.linkedin.com/games/guess/  (or similar)
 *
 * NOTE: After running `pnpm discover` and visiting the games hub, confirm
 * the exact URL and game name. Update GAME_URL and GAME_NAME below.
 *
 * If LinkedIn has a different 6th game, rename this file accordingly.
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

// TODO: Update these after `pnpm discover` confirms the 6th game
const GAME_URL = 'https://www.linkedin.com/games/wordle/';
const GAME_NAME = 'wordle';

export async function scrape(page: Page): Promise<ScrapeResult> {
  const playedDate = todayDateString();
  const capturedAt = nowIsoString();

  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(4000);

  // Check if the URL 404s (game doesn't exist at this URL)
  const finalUrl = page.url();
  if (finalUrl.includes('404') || finalUrl.includes('not-found')) {
    return {
      gameName: GAME_NAME,
      playedDate,
      capturedAt,
      completed: false,
      leaderboard: [],
      rawData: { error: 'Game URL returned 404 — update GAME_URL after discovery', url: finalUrl },
    };
  }

  let completed = false;
  let score: number | undefined;      // Wordle uses guesses as score (1-6)
  let completionTimeSecs: number | undefined;
  let rawData: Record<string, unknown> = {};

  const resultSelectors = [
    '[class*="result"]',
    '[class*="complete"]',
    '[class*="share"]',
    '[class*="finished"]',
    '[data-test*="result"]',
    '[class*="guess"]',
    '[class*="word"]',
  ];

  for (const sel of resultSelectors) {
    const found = await waitForSelectorSafe(page, sel, 3000);
    if (found) {
      completed = true;
      const text = await page.$eval(sel, el => el.textContent?.trim() || '').catch(() => '');
      const guessMatch = text.match(/(\d)\s*\/\s*6/);
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
