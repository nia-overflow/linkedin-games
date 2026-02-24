/**
 * Crossclimb game scraper.
 *
 * URL: https://www.linkedin.com/games/crossclimb/
 *
 * Crossclimb is a word ladder / crossword hybrid where you fill in words
 * that differ by one letter at each rung. Result shows completion time.
 *
 * Discovery confirmed: results URL includes ?gameUrn param when navigating
 * from the game page, but the bare /results/ URL also loads correctly.
 * User's time confirmed as 0:34 in discovery.
 */

import type { Page } from 'playwright';
import type { ScrapeResult } from './types.js';
import { scrapeResultsPage } from './helpers.js';

const RESULTS_URL = 'https://www.linkedin.com/games/crossclimb/results/';
const GAME_NAME = 'crossclimb';

export async function scrape(page: Page): Promise<ScrapeResult> {
  return scrapeResultsPage(page, GAME_NAME, RESULTS_URL);
}
