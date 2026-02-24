/**
 * Tango game scraper.
 *
 * URL: https://www.linkedin.com/games/tango/
 *
 * Tango is a logic puzzle with sun/moon symbols on a grid.
 * Result shows completion time.
 *
 * Note: Tango uses React Server Components (hashed CSS classes internally),
 * but the /results/ page still uses the stable pr-game-results__* BEM classes.
 */

import type { Page } from 'playwright';
import type { ScrapeResult } from './types.js';
import { scrapeResultsPage } from './helpers.js';

const RESULTS_URL = 'https://www.linkedin.com/games/tango/results/';
const GAME_NAME = 'tango';

export async function scrape(page: Page): Promise<ScrapeResult> {
  return scrapeResultsPage(page, GAME_NAME, RESULTS_URL);
}
