/**
 * Step 1.4 — Dedicated Chrome Profile Setup
 *
 * This one-time script creates a persistent Chrome profile at
 * ~/.linkedin-games/chrome-profile and opens LinkedIn for you to log in.
 *
 * After you log in, press Enter in the terminal and the script will
 * verify your session is active, then close.
 *
 * Usage:
 *   pnpm setup:profile
 */

import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';

const PROFILE_PATH = path.join(os.homedir(), '.linkedin-games', 'chrome-profile');
const LINKEDIN_HOME = 'https://www.linkedin.com/feed/';
const LINKEDIN_LOGIN = 'https://www.linkedin.com/login';

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

async function main() {
  console.log('LinkedIn Games — Chrome Profile Setup');
  console.log('======================================\n');

  // Create profile directory
  await fs.mkdir(PROFILE_PATH, { recursive: true });
  console.log(`Profile directory: ${PROFILE_PATH}`);

  console.log('\nLaunching Chrome (non-headless so you can log in)...');
  const context = await chromium.launchPersistentContext(PROFILE_PATH, {
    headless: false,
    args: ['--no-sandbox'],
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  // Navigate to LinkedIn login
  await page.goto(LINKEDIN_LOGIN, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  console.log('\n✅ Chrome opened. LinkedIn login page is loading...');
  console.log('\n📌 Instructions:');
  console.log('   1. Log in to LinkedIn with your account.');
  console.log('   2. Complete any 2FA / verification steps.');
  console.log('   3. Make sure you land on the LinkedIn home feed.');
  console.log('   4. Come back here and press Enter.\n');

  await prompt('Press Enter when you are fully logged in...');

  // Verify session by checking for the feed
  console.log('\nVerifying LinkedIn session...');
  try {
    await page.goto(LINKEDIN_HOME, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/authwall')) {
      console.error('\n❌ LinkedIn redirected to login — you may not be fully logged in.');
      console.error('   Please try running `pnpm setup:profile` again.\n');
      await context.close();
      process.exit(1);
    }

    // Check for known feed elements
    const feedVisible = await page.$('main') !== null;
    if (!feedVisible) {
      console.warn('\n⚠️  Could not confirm feed loaded, but URL looks OK:', currentUrl);
      console.warn('   Proceeding — if scraping fails, re-run this setup.\n');
    } else {
      console.log('\n✅ Session verified! LinkedIn feed loaded successfully.');
    }

    console.log(`\n✅ Profile saved to: ${PROFILE_PATH}`);
    console.log('   The scraper will use this profile for all future runs.');
    console.log('   If LinkedIn ever logs you out, run `pnpm setup:profile` again.\n');

  } catch (err) {
    console.error('\n❌ Verification failed:', (err as Error).message);
    console.error('   Re-run `pnpm setup:profile` and try again.\n');
    await context.close();
    process.exit(1);
  }

  await context.close();
  console.log('Chrome closed. Setup complete!\n');
}

main().catch(err => {
  console.error('Fatal error during setup:', err);
  process.exit(1);
});
