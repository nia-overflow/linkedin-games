/**
 * Shared helpers for game scrapers.
 *
 * LinkedIn's game pages are React SPAs — they load asynchronously and
 * the DOM structure may change. These helpers provide:
 * - Robust wait strategies with timeouts and retries
 * - leaderboard extraction logic shared across games
 * - Time string parsing (e.g. "1:23" → 83 seconds)
 */

import type { Page } from 'playwright';
import type { LeaderboardEntry } from './types.js';

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
 * Attempt to extract leaderboard entries from a LinkedIn game page.
 *
 * LinkedIn renders leaderboards in a list of player entries. The exact
 * class names vary by game but follow similar patterns. This function
 * tries multiple selector strategies and returns the best result.
 *
 * After running the discovery script (Step 1.2), update the selectors
 * in LEADERBOARD_SELECTORS based on what was actually found.
 */
export async function extractLeaderboard(
  page: Page,
  gameName: string,
  playedDate: string,
  capturedAt: string,
): Promise<LeaderboardEntry[]> {
  // Scroll to load lazy leaderboard content
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);

  // Try to find leaderboard container
  // These selectors are based on LinkedIn's common game page structure.
  // Run `pnpm discover` and inspect the HTML to confirm/update them.
  const entries = await page.evaluate(
    ({ gameName, playedDate, capturedAt }) => {
      const results: Array<{
        rank?: number;
        connectionName: string;
        connectionProfileUrl?: string;
        score?: number;
        completionTimeSecs?: number;
        isSelf: boolean;
      }> = [];

      // Strategy 1: look for elements with "leaderboard" in their class/data attrs
      let rows = document.querySelectorAll(
        '[class*="leaderboard"] [class*="player"], ' +
        '[class*="leaderboard"] [class*="entry"], ' +
        '[class*="leaderboard"] [class*="row"], ' +
        '[data-test*="leaderboard"] li, ' +
        '.games-leaderboard__entry'
      );

      // Strategy 2: if that yields nothing, look for a list of players in the result section
      if (rows.length === 0) {
        rows = document.querySelectorAll(
          '[class*="result"] [class*="player"], ' +
          '[class*="result"] li, ' +
          '[class*="score"] [class*="player"]'
        );
      }

      // Strategy 3: look for any anchor with /in/ profile URLs (connection names)
      if (rows.length === 0) {
        const links = document.querySelectorAll('a[href*="/in/"]');
        links.forEach((link, idx) => {
          const el = link as HTMLAnchorElement;
          results.push({
            rank: idx + 1,
            connectionName: el.textContent?.trim() || 'Unknown',
            connectionProfileUrl: el.href,
            isSelf: el.classList.contains('is-self') || el.closest('[class*="self"]') !== null,
          });
        });
        return results;
      }

      rows.forEach((row, idx) => {
        const nameEl = row.querySelector('[class*="name"], [class*="player-name"], strong, b');
        const linkEl = row.querySelector('a[href*="/in/"]') as HTMLAnchorElement | null;
        const timeEl = row.querySelector('[class*="time"], [class*="score"], [class*="duration"]');
        const rankEl = row.querySelector('[class*="rank"], [class*="position"]');

        const name = nameEl?.textContent?.trim() || linkEl?.textContent?.trim() || 'Unknown';
        const profileUrl = linkEl?.href;
        const timeText = timeEl?.textContent?.trim();
        const rankText = rankEl?.textContent?.trim();

        // Parse time string "1:23" → 83 seconds
        let completionTimeSecs: number | undefined;
        if (timeText) {
          const match = timeText.match(/(\d+):(\d{2})/);
          if (match) {
            completionTimeSecs = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
          }
        }

        const rank = rankText ? parseInt(rankText.replace(/\D/g, ''), 10) || idx + 1 : idx + 1;

        // LinkedIn typically marks your own row with a specific class or "You" text
        const isSelf = name === 'You' ||
          row.classList.contains('is-self') ||
          row.closest('[class*="self"]') !== null ||
          (row as HTMLElement).getAttribute('data-is-self') === 'true';

        results.push({
          rank,
          connectionName: name,
          connectionProfileUrl: profileUrl,
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
