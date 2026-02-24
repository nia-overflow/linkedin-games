/**
 * Shared helpers for game scrapers.
 *
 * All 6 LinkedIn games use the same /games/{name}/results/ URL pattern and
 * the same pr-game-results__section + pr-connections-leaderboard-player__*
 * class naming on their results pages. This was confirmed by running the
 * discovery scripts (scraper/discovery/*-after-click.json).
 *
 * The unified `scrapeResultsPage()` handles all games. Individual game
 * files just call it with game-specific config.
 */

import type { Page } from 'playwright';
import type { LeaderboardEntry, ScrapeResult } from './types.js';

/** Today's date in YYYY-MM-DD format (local time). */
export function todayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** ISO timestamp string for "right now". */
export function nowIsoString(): string {
  return new Date().toISOString();
}

/**
 * Parse a time string like "1:23" or "01:23" into total seconds.
 * Returns undefined if the string doesn't match.
 */
export function parseTimeSecs(timeStr: string | null | undefined): number | undefined {
  if (!timeStr) return undefined;
  const match = timeStr.match(/^(\d+):(\d{2})$/);
  if (!match) return undefined;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/**
 * Wait for a selector to appear, with a custom timeout.
 * Returns true if found, false if timed out.
 */
export async function waitForSelectorSafe(
  page: Page,
  selector: string,
  timeoutMs = 10_000
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract leaderboard entries from a LinkedIn game results page.
 *
 * All 6 games use the same BEM class structure:
 *   .pr-connections-leaderboard-player__container  → one row per player
 *   .pr-connections-leaderboard-player__ranking    → rank number (may be empty for "You")
 *   .pr-connections-leaderboard-player__text-wrapper → player name ("You" for self)
 *   .pr-connections-leaderboard-player__score      → M:SS time OR integer guess count (Pinpoint)
 *
 * Confirmed for: Crossclimb, Zip, Pinpoint, Mini-Sudoku.
 * Queens/Tango use the same framework and should work with a longer wait.
 */
export async function extractLeaderboard(
  page: Page,
  gameName: string,
  playedDate: string,
  capturedAt: string,
): Promise<LeaderboardEntry[]> {
  const entries = await page.evaluate(
    ({ gameName, playedDate, capturedAt }) => {
      type RawEntry = {
        rank?: number;
        connectionName: string;
        connectionProfileUrl?: string;
        score?: number;
        completionTimeSecs?: number;
        isSelf: boolean;
      };

      const results: RawEntry[] = [];
      const containers = document.querySelectorAll(
        '.pr-connections-leaderboard-player__container'
      );

      containers.forEach((container, idx) => {
        const rankEl = container.querySelector('.pr-connections-leaderboard-player__ranking');
        const nameEl = container.querySelector('.pr-connections-leaderboard-player__text-wrapper');
        const scoreEl = container.querySelector('.pr-connections-leaderboard-player__score');
        const linkEl = container.querySelector('a[href*="/in/"]') as HTMLAnchorElement | null;

        // Clone the __text-wrapper and strip the __subtitle child before
        // reading text — the subtitle contains "🌎 You outplayed..." and
        // "Flawless 💎" badges that must not be included in the player name.
        let name = '';
        if (nameEl) {
          const clone = nameEl.cloneNode(true) as HTMLElement;
          clone.querySelector('.pr-connections-leaderboard-player__subtitle')?.remove();
          name = clone.textContent?.trim() ?? '';
        }
        // Skip empty or "See full leaderboard" button rows
        if (!name || name === 'See full leaderboard') return;

        const isSelf = name === 'You';
        const rankText = rankEl?.textContent?.trim() ?? '';
        const scoreText = scoreEl?.textContent?.trim() ?? '';

        const rankNum = rankText ? (parseInt(rankText.replace(/\D/g, ''), 10) || idx + 1) : idx + 1;

        // Pinpoint uses integer guess counts; all other games use M:SS time strings
        let completionTimeSecs: number | undefined;
        let score: number | undefined;

        if (scoreText) {
          const timeMatch = scoreText.match(/^(\d+):(\d{2})$/);
          if (timeMatch) {
            completionTimeSecs = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
          } else if (/^\d+$/.test(scoreText)) {
            score = parseInt(scoreText, 10);
          }
        }

        results.push({
          rank: rankNum,
          connectionName: isSelf ? 'You' : name,
          connectionProfileUrl: linkEl?.href,
          score,
          completionTimeSecs,
          isSelf,
        });
      });

      return results;
    },
    { gameName, playedDate, capturedAt }
  );

  return entries.map(e => ({
    gameName,
    playedDate,
    capturedAt,
    rank: e.rank,
    connectionName: e.connectionName,
    connectionProfileUrl: e.connectionProfileUrl,
    score: e.score,
    completionTimeSecs: e.completionTimeSecs,
    isSelf: e.isSelf,
  }));
}

/**
 * Scrape a LinkedIn game by navigating directly to its /results/ page.
 *
 * Strategy confirmed by discovery (scraper/discovery/*-after-click.json):
 * - Navigate to https://www.linkedin.com/games/{name}/results/
 * - Wait up to 20s for .pr-game-results__section to appear
 * - Extract leaderboard using .pr-connections-leaderboard-player__* selectors
 * - User's own time/score comes from the "You" entry (isSelf: true)
 *
 * If the results page doesn't load within 20s (game not yet played, or
 * redirect back to the puzzle), returns completed: false.
 */
export async function scrapeResultsPage(
  page: Page,
  gameName: string,
  resultsUrl: string,
): Promise<ScrapeResult> {
  const playedDate = todayDateString();
  const capturedAt = nowIsoString();

  await page.goto(resultsUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  // Queens/Tango use React Server Components and take longer to hydrate than
  // Crossclimb/Zip/Pinpoint/Mini-Sudoku. 20s covers all cases observed.
  const resultsLoaded = await waitForSelectorSafe(page, '.pr-game-results__section', 20_000);

  if (!resultsLoaded) {
    return {
      gameName,
      playedDate,
      capturedAt,
      completed: false,
      leaderboard: [],
      rawData: { url: page.url(), reason: '.pr-game-results__section not found within 20s' },
    };
  }

  // The results page initially shows a snapshot (top 3 connections).
  // Click "See full leaderboard" to expand, then scroll until no new entries
  // appear — LinkedIn lazy-loads entries as you scroll, with no fixed limit.
  try {
    const btn = page.getByRole('button', { name: 'See full leaderboard' });
    if (await btn.count() > 0) {
      await btn.first().click();
      // Wait for the first page of ranked entries to render.
      // No scrolling — the list is sorted so the first page contains all
      // connections who actually played. Scrolling further loads un-played
      // connections with no score, which is noise we don't want.
      //
      // TODO: ideal version scrolls until it hits the first entry with no
      // score/time, capturing every connection who played without including
      // those who haven't.
      await page.waitForTimeout(2000);
    }
  } catch {
    // Non-fatal — proceed with snapshot if button not found or click fails
  }

  const leaderboard = await extractLeaderboard(page, gameName, playedDate, capturedAt);

  // Self entry carries the user's own time (or guess count for Pinpoint)
  const selfEntry = leaderboard.find(e => e.isSelf);

  return {
    gameName,
    playedDate,
    capturedAt,
    completed: true,
    completionTimeSecs: selfEntry?.completionTimeSecs,
    score: selfEntry?.score,
    leaderboard,
    rawData: { url: page.url() },
  };
}
