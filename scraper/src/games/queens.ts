/**
 * Queens game scraper.
 *
 * URL: https://www.linkedin.com/games/queens/
 *
 * Queens is a logic puzzle where you place queens on a colored grid.
 * Result shows completion time and leaderboard with connections' times.
 *
 * Note: Queens uses React Server Components (hashed CSS classes internally),
 * but the /results/ page still uses the stable pr-game-results__* BEM classes.
 * The 20-second wait in scrapeResultsPage handles the slower hydration.
 */

import type { Page } from 'playwright';
import type { ScrapeResult } from './types.js';
import { scrapeResultsPage } from './helpers.js';

const RESULTS_URL = 'https://www.linkedin.com/games/queens/results/';
const GAME_NAME = 'queens';

export async function scrape(page: Page): Promise<ScrapeResult> {
  return scrapeResultsPage(page, GAME_NAME, RESULTS_URL);
}
