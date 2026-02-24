/**
 * Zip game scraper.
 *
 * URL: https://www.linkedin.com/games/zip/
 *
 * Zip is a path-drawing puzzle where you connect numbered nodes in order
 * without crossing. Result shows completion time.
 *
 * Discovery confirmed: results page at /results/ loads with pr-game-results__section
 * and pr-connections-leaderboard-player__* classes. User's time confirmed as 0:08.
 */

import type { Page } from 'playwright';
import type { ScrapeResult } from './types.js';
import { scrapeResultsPage } from './helpers.js';

const RESULTS_URL = 'https://www.linkedin.com/games/zip/results/';
const GAME_NAME = 'zip';

export async function scrape(page: Page): Promise<ScrapeResult> {
  return scrapeResultsPage(page, GAME_NAME, RESULTS_URL);
}
