# LinkedIn Games Dashboard

A **local-only** dashboard for your LinkedIn daily game results.

No LinkedIn API required — a Playwright scraper visits the game pages nightly using your logged-in Chrome profile, captures results + leaderboard data, and saves to a local SQLite database.

```
11:55 PM → Mac wakes (pmset)
         → launchd triggers scraper
         → Playwright opens Chrome (your LinkedIn profile)
         → Visits 6 game pages, captures results + leaderboard
         → Saves to ~/.linkedin-games/games.db
         → Browser closes, Mac sleeps

Any time → Open http://localhost:3000
         → Dashboard reads SQLite, shows stats + leaderboard history
```

---

## Prerequisites

- macOS (for launchd + pmset scheduling)
- Node.js 18+
- pnpm (`npm install -g pnpm`)

---

## Setup (one command)

```bash
bash scripts/setup.sh
```

This will:
1. Check prerequisites
2. Install Node dependencies
3. Install Playwright's Chromium browser
4. Build the dashboard
5. Open Chrome so you can log in to LinkedIn (saved profile for scraping)
6. Install launchd daemons (server at login, scraper at 11:55 PM)
7. Schedule Mac wake at 11:55 PM via `pmset`

After setup: open **http://localhost:3000**

---

## Manual steps

### One-time LinkedIn login
```bash
pnpm setup:profile
```
Opens Chrome at `~/.linkedin-games/chrome-profile`. Log in to LinkedIn, then press Enter.

### Run the scraper manually
```bash
pnpm scrape
```

### DOM discovery (before first scrape)
Run this once while logged in to capture screenshots and HTML of each game page:
```bash
pnpm discover
```
This saves to `scraper/discovery/`. Review the HTML to confirm/update the selectors in the scrapers if LinkedIn changes their DOM.

### Start the server in dev mode
```bash
pnpm dev
```
Server runs at http://localhost:3000. Dashboard dev server at http://localhost:5173 (with hot reload).

---

## Project Structure

```
linkedin-games/
├── scraper/             # Playwright scraper
│   └── src/
│       ├── games/       # One scraper per game + helpers
│       ├── db/          # SQLite schema + typed query functions
│       └── index.ts     # Orchestrator
├── server/              # Express API server (port 3000)
│   └── src/
│       └── index.ts     # All API routes + SPA serving
├── dashboard/           # Vite + React dashboard
│   └── src/
│       ├── components/  # StatsBar, HistoryChart, LeaderboardTable, StalenessWarning
│       ├── api.ts       # API client
│       └── App.tsx      # Main app with game tabs
├── scripts/
│   ├── setup.sh         # One-command setup
│   ├── install-daemons.sh
│   ├── setup-profile.ts
│   ├── discover-games.ts
│   └── plist/           # launchd plist files
└── package.json         # pnpm workspace root
```

---

## Data

SQLite database: `~/.linkedin-games/games.db`

Tables:
- `game_results` — one row per game per day (your result)
- `leaderboard_entries` — leaderboard snapshots per game per day
- `scrape_log` — run history with success/error status

---

## Scraper notes

The scrapers in `scraper/src/games/` use best-guess CSS selectors for LinkedIn's game pages. LinkedIn may change their DOM without notice.

**If scraping breaks:**
1. Run `pnpm discover` to take fresh screenshots and save HTML
2. Inspect `scraper/discovery/<game>-html.html` to find the current selectors
3. Update the selector logic in the relevant scraper file
4. Re-run `pnpm scrape` to verify

---

## 6th game

After running `pnpm discover`, check `scraper/discovery/hub-screenshot.png` and the printed game URLs to confirm the 6th game name. Update `scraper/src/games/wordle.ts` (rename the file and update `GAME_URL`/`GAME_NAME`) accordingly.

---

## Logs

- Scraper: `~/.linkedin-games/logs/scraper.log`
- Server: `~/.linkedin-games/logs/server.log`
- Dashboard: `/api/logs` (last 7 days of scrape runs)

---

## Re-login

LinkedIn sessions expire occasionally. If the scraper stops capturing data:

```bash
pnpm setup:profile
```
