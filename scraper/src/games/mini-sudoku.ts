/**
 * Mini Sudoku game scraper.
 *
 * URL: https://www.linkedin.com/games/mini-sudoku/
 *
 * LinkedIn's 6th game (launched August 2025). A 6×6 Sudoku puzzle.
 * Result shows completion time.
 *
 * Discovery confirmed: results page at /results/ loads with pr-game-results__section
 * and pr-connections-leaderboard-player__* classes. User's time confirmed as 0:35.
 */

import type { Page } from 'playwright';
import type { ScrapeResult } from './types.js';
import { scrapeResultsPage } from './helpers.js';

const RESULTS_URL = 'https://www.linkedin.com/games/mini-sudoku/results/';
const GAME_NAME = 'mini-sudoku';

export async function scrape(page: Page): Promise<ScrapeResult> {
  return scrapeResultsPage(page, GAME_NAME, RESULTS_URL);
}
