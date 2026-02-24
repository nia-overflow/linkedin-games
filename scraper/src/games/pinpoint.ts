/**
 * Pinpoint game scraper.
 *
 * URL: https://www.linkedin.com/games/pinpoint/
 *
 * Pinpoint is a word association game — guess the category from clue words.
 * Scored by number of guesses used (lower = better, 1 = first clue).
 *
 * Discovery confirmed: leaderboard shows integer guess counts ("1", "3", "3")
 * rather than M:SS times. The extractLeaderboard helper handles this by
 * detecting plain integers and storing them in the `score` field instead of
 * `completionTimeSecs`.
 */

import type { Page } from 'playwright';
import type { ScrapeResult } from './types.js';
import { scrapeResultsPage } from './helpers.js';

const RESULTS_URL = 'https://www.linkedin.com/games/pinpoint/results/';
const GAME_NAME = 'pinpoint';

export async function scrape(page: Page): Promise<ScrapeResult> {
  return scrapeResultsPage(page, GAME_NAME, RESULTS_URL);
}
