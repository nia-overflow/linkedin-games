/**
 * Step 1.2 — Game URL & DOM Discovery
 *
 * This throwaway script opens each known LinkedIn game URL using the
 * dedicated Chrome profile, takes screenshots (both the completed puzzle
 * state and the leaderboard), and saves the full page HTML for offline
 * DOM inspection.
 *
 * Usage:
 *   pnpm discover
 *
 * Prerequisites:
 *   - Run `pnpm setup:profile` first so a logged-in Chrome profile exists
 *     at ~/.linkedin-games/chrome-profile
 *   - LinkedIn must be logged in on that profile
 *
 * Output:
 *   scraper/discovery/<game>-screenshot.png
 *   scraper/discovery/<game>-html.html
 */

import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';

const PROFILE_PATH = path.join(os.homedir(), '.linkedin-games', 'chrome-profile');
const DISCOVERY_DIR = path.join('scraper', 'discovery');

const GAMES = [
  { name: 'queens',     url: 'https://www.linkedin.com/games/queens/' },
  { name: 'tango',      url: 'https://www.linkedin.com/games/tango/' },
  { name: 'pinpoint',   url: 'https://www.linkedin.com/games/pinpoint/' },
  { name: 'crossclimb', url: 'https://www.linkedin.com/games/crossclimb/' },
  { name: 'zip',         url: 'https://www.linkedin.com/games/zip/' },
  { name: 'mini-sudoku', url: 'https://www.linkedin.com/games/mini-sudoku/' },
];

const HUB_URL = 'https://www.linkedin.com/games/';

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

async function main() {
  console.log('LinkedIn Games DOM Discovery Script');
  console.log('====================================');

  // Check profile exists
  try {
    await fs.access(PROFILE_PATH);
  } catch {
    console.error(`\n❌ Chrome profile not found at: ${PROFILE_PATH}`);
    console.error('Run `pnpm setup:profile` first to create it.\n');
    process.exit(1);
  }

  await fs.mkdir(DISCOVERY_DIR, { recursive: true });

  console.log(`\nLaunching Chrome with profile: ${PROFILE_PATH}`);
  const context = await chromium.launchPersistentContext(PROFILE_PATH, {
    headless: false,
    args: ['--no-sandbox'],
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  // ── Visit the hub first to discover the 6th game ──────────────────────────
  console.log('\n📍 Visiting games hub to discover all available games...');
  await page.goto(HUB_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(3000);
  const hubPath = path.join(DISCOVERY_DIR, 'hub-screenshot.png');
  const hubHtmlPath = path.join(DISCOVERY_DIR, 'hub-html.html');
  await page.screenshot({ path: hubPath, fullPage: true });
  await fs.writeFile(hubHtmlPath, await page.content(), 'utf-8');
  console.log(`  ✅ Hub screenshot → ${hubPath}`);
  console.log(`  ✅ Hub HTML       → ${hubHtmlPath}`);

  // Print all game links visible on the hub
  const gameLinks = await page.$$eval(
    'a[href*="/games/"]',
    (links) => [...new Set(links.map(a => (a as HTMLAnchorElement).href))]
  );
  console.log('\n  Discovered game URLs on hub:');
  gameLinks.forEach(link => console.log(`    ${link}`));

  await prompt('\nPress Enter to continue visiting individual game pages...');

  // ── Visit each known game ──────────────────────────────────────────────────
  for (const game of GAMES) {
    console.log(`\n📍 Visiting ${game.name}: ${game.url}`);
    try {
      await page.goto(game.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      // Wait for game content to stabilize
      await page.waitForTimeout(5000);

      // Screenshot 1: initial state (completed puzzle or "play now")
      const screenshotPath = path.join(DISCOVERY_DIR, `${game.name}-screenshot.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  ✅ Screenshot → ${screenshotPath}`);

      // Save HTML for DOM inspection
      const htmlPath = path.join(DISCOVERY_DIR, `${game.name}-html.html`);
      await fs.writeFile(htmlPath, await page.content(), 'utf-8');
      console.log(`  ✅ HTML       → ${htmlPath}`);

      // Try to scroll down to see if leaderboard is visible
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
      const leaderboardPath = path.join(DISCOVERY_DIR, `${game.name}-leaderboard.png`);
      await page.screenshot({ path: leaderboardPath, fullPage: true });
      console.log(`  ✅ Leaderboard screenshot → ${leaderboardPath}`);

      // Dump interesting selectors for analysis
      const selectors = await page.evaluate(() => {
        const info: Record<string, string> = {};
        // Common result-related selectors to check
        const candidates = [
          '.games-result',
          '.games-leaderboard',
          '[data-test*="result"]',
          '[data-test*="score"]',
          '[data-test*="leaderboard"]',
          '[class*="result"]',
          '[class*="leaderboard"]',
          '[class*="score"]',
          '[class*="completion"]',
        ];
        for (const sel of candidates) {
          const els = document.querySelectorAll(sel);
          if (els.length > 0) {
            info[sel] = `${els.length} element(s) found. First: ${(els[0] as HTMLElement).outerHTML.slice(0, 300)}`;
          }
        }
        return info;
      });

      const selectorsPath = path.join(DISCOVERY_DIR, `${game.name}-selectors.json`);
      await fs.writeFile(selectorsPath, JSON.stringify(selectors, null, 2), 'utf-8');
      console.log(`  ✅ Selectors  → ${selectorsPath}`);

    } catch (err) {
      console.error(`  ❌ Error visiting ${game.name}: ${(err as Error).message}`);
    }

    await prompt(`\nReview ${game.name} screenshots/HTML, then press Enter for next game...`);
  }

  console.log('\n✅ Discovery complete! Review files in scraper/discovery/');
  console.log('   Use the HTML files and selector dumps to write the scrapers in Step 1.5.\n');

  await context.close();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
