/**
 * Non-interactive discovery script — auto-proceeds through all 6 games.
 * Saves screenshots + HTML + selector dumps to scraper/discovery/
 */

import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const PROFILE_PATH = path.join(os.homedir(), '.linkedin-games', 'chrome-profile');
const DISCOVERY_DIR = path.join('scraper', 'discovery');

const GAMES = [
  { name: 'hub',         url: 'https://www.linkedin.com/games/' },
  { name: 'queens',      url: 'https://www.linkedin.com/games/queens/' },
  { name: 'tango',       url: 'https://www.linkedin.com/games/tango/' },
  { name: 'pinpoint',    url: 'https://www.linkedin.com/games/pinpoint/' },
  { name: 'crossclimb',  url: 'https://www.linkedin.com/games/crossclimb/' },
  { name: 'zip',         url: 'https://www.linkedin.com/games/zip/' },
  { name: 'mini-sudoku', url: 'https://www.linkedin.com/games/mini-sudoku/' },
];

async function main() {
  console.log('LinkedIn Games — Auto Discovery');
  console.log('Profile:', PROFILE_PATH);

  await fs.mkdir(DISCOVERY_DIR, { recursive: true });

  const context = await chromium.launchPersistentContext(PROFILE_PATH, {
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    viewport: { width: 1440, height: 900 },
  });

  for (const game of GAMES) {
    console.log(`\n→ ${game.name}: ${game.url}`);
    const page = await context.newPage();

    try {
      await page.goto(game.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(4000);

      // Scroll to bottom to trigger lazy-loaded leaderboard
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);

      const finalUrl = page.url();
      console.log(`  Final URL: ${finalUrl}`);

      // Full-page screenshot
      await page.screenshot({
        path: path.join(DISCOVERY_DIR, `${game.name}.png`),
        fullPage: true,
      });

      // Save HTML
      await fs.writeFile(
        path.join(DISCOVERY_DIR, `${game.name}.html`),
        await page.content(),
        'utf-8'
      );

      // Selector dump — what class names are present on the page
      const classInfo = await page.evaluate(() => {
        const allClasses = new Set<string>();
        document.querySelectorAll('[class]').forEach(el => {
          (el.getAttribute('class') || '').split(/\s+/).forEach(c => {
            if (c) allClasses.add(c);
          });
        });

        // Look for relevant patterns
        const relevant = [...allClasses].filter(c =>
          /result|complete|finish|share|time|score|leaderboard|player|rank|connection|self|board|grid|puzzle|sudoku|game/i.test(c)
        );

        // Also collect data-test attributes
        const dataTests = [...document.querySelectorAll('[data-test]')]
          .map(el => el.getAttribute('data-test'))
          .filter(Boolean);

        // Collect all anchor hrefs with /in/ (LinkedIn profile URLs = leaderboard players)
        const profileLinks = [...document.querySelectorAll('a[href*="/in/"]')]
          .map(a => ({
            text: (a as HTMLAnchorElement).textContent?.trim(),
            href: (a as HTMLAnchorElement).href,
          }))
          .slice(0, 20);

        return { relevant, dataTests, profileLinks, totalClasses: allClasses.size };
      });

      await fs.writeFile(
        path.join(DISCOVERY_DIR, `${game.name}-selectors.json`),
        JSON.stringify(classInfo, null, 2),
        'utf-8'
      );

      console.log(`  Classes with relevant keywords (${classInfo.relevant.length}):`, classInfo.relevant.slice(0, 15).join(', '));
      if (classInfo.profileLinks.length > 0) {
        console.log(`  Profile links found (leaderboard candidates): ${classInfo.profileLinks.length}`);
        classInfo.profileLinks.forEach(l => console.log(`    "${l.text}" → ${l.href}`));
      }
      if (classInfo.dataTests.length > 0) {
        console.log(`  data-test attrs:`, classInfo.dataTests.slice(0, 10).join(', '));
      }
      console.log(`  ✅ Saved ${game.name}.png + .html + -selectors.json`);

    } catch (err) {
      console.error(`  ❌ Error: ${(err as Error).message}`);
    } finally {
      await page.close();
    }
  }

  await context.close();
  console.log('\n✅ Discovery complete → scraper/discovery/');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
