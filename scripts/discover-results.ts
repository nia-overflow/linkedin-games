/**
 * Discovery pass 2: click "See results" on each game and capture
 * what the result screen looks like (timer + leaderboard).
 */

import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const PROFILE_PATH = path.join(os.homedir(), '.linkedin-games', 'chrome-profile');
const DISCOVERY_DIR = path.join('scraper', 'discovery');

const GAMES = [
  { name: 'queens',      url: 'https://www.linkedin.com/games/queens/' },
  { name: 'tango',       url: 'https://www.linkedin.com/games/tango/' },
  { name: 'zip',         url: 'https://www.linkedin.com/games/zip/' },
  { name: 'crossclimb',  url: 'https://www.linkedin.com/games/crossclimb/' },
  { name: 'pinpoint',    url: 'https://www.linkedin.com/games/pinpoint/' },
  { name: 'mini-sudoku', url: 'https://www.linkedin.com/games/mini-sudoku/' },
];

async function main() {
  console.log('Discovery Pass 2: Clicking "See results" on each game\n');
  await fs.mkdir(DISCOVERY_DIR, { recursive: true });

  const context = await chromium.launchPersistentContext(PROFILE_PATH, {
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    viewport: { width: 1440, height: 900 },
  });

  for (const game of GAMES) {
    console.log(`\n→ ${game.name}`);
    const page = await context.newPage();

    try {
      await page.goto(game.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(5000); // Let React/Ember hydrate fully

      // ── Try clicking "See results" ────────────────────────────────────────
      const seeResults = page.getByText('See results', { exact: true });
      const count = await seeResults.count();
      console.log(`  "See results" elements: ${count}`);

      if (count > 0) {
        await seeResults.first().click();
        console.log('  Clicked "See results"');
        await page.waitForTimeout(4000); // Wait for result modal/page to load
      }

      // Screenshot after clicking
      await page.screenshot({
        path: path.join(DISCOVERY_DIR, `${game.name}-after-click.png`),
        fullPage: true,
      });

      // Save HTML after clicking
      const postClickHtml = await page.content();
      await fs.writeFile(
        path.join(DISCOVERY_DIR, `${game.name}-after-click.html`),
        postClickHtml,
        'utf-8'
      );

      // ── Extract post-click data ───────────────────────────────────────────
      const postClickData = await page.evaluate(() => {
        // Timer text — look for M:SS patterns
        const allText = document.body.innerText;
        const timeMatches = allText.match(/\d{1,2}:\d{2}/g) || [];

        // All visible text lines (non-empty)
        const textLines = allText.split('\n')
          .map((l: string) => l.trim())
          .filter((l: string) => l.length > 0 && l.length < 200);

        // Leaderboard-like items: names + times
        const playerRows = [...document.querySelectorAll(
          '[class*="leaderboard"] *, [class*="result"] *, [class*="player"] *, ' +
          '[class*="connection"] *, [class*="score"] *'
        )].map(el => (el as HTMLElement).innerText?.trim()).filter(Boolean).slice(0, 50);

        // Profile links
        const profileLinks = [...document.querySelectorAll('a[href*="/in/"]')]
          .map(a => ({
            text: (a as HTMLAnchorElement).innerText?.trim(),
            href: (a as HTMLAnchorElement).href,
          })).filter(l => l.text).slice(0, 20);

        // Class names on new elements after click
        const allClasses = new Set<string>();
        document.querySelectorAll('[class]').forEach(el => {
          (el.getAttribute('class') || '').split(/\s+/).forEach(c => {
            if (c && /result|complete|finish|share|time|score|leaderboard|player|rank|win|congrat|medal/i.test(c)) {
              allClasses.add(c);
            }
          });
        });

        return {
          timeMatches,
          textLines: textLines.slice(0, 40),
          playerRows,
          profileLinks,
          relevantClasses: [...allClasses],
          url: window.location.href,
        };
      });

      console.log(`  Final URL: ${postClickData.url}`);
      console.log(`  Time patterns found: ${postClickData.timeMatches.join(', ') || 'none'}`);
      console.log(`  Relevant classes: ${postClickData.relevantClasses.slice(0, 10).join(', ')}`);
      if (postClickData.profileLinks.length > 0) {
        console.log(`  Profile links (leaderboard): ${postClickData.profileLinks.length}`);
        postClickData.profileLinks.forEach(l => console.log(`    "${l.text}" → ${l.href}`));
      }
      console.log('  Text lines:');
      postClickData.textLines.slice(0, 20).forEach(l => console.log(`    ${l}`));

      await fs.writeFile(
        path.join(DISCOVERY_DIR, `${game.name}-after-click.json`),
        JSON.stringify(postClickData, null, 2),
        'utf-8'
      );
      console.log(`  ✅ Saved after-click files`);

    } catch (err) {
      console.error(`  ❌ Error: ${(err as Error).message}`);
    } finally {
      await page.close();
    }
  }

  await context.close();
  console.log('\n✅ Results discovery complete');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
