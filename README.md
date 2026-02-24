# LinkedIn Games Dashboard

A personal dashboard for your LinkedIn daily game results — tracks your scores, ranks you against connections, and shows history over time.

No LinkedIn API required. A Playwright scraper visits the game pages each night using your saved Chrome session, captures results and leaderboard data, and stores everything locally in SQLite.

```
11:55 PM → Mac wakes
         → Scraper opens Chrome (your LinkedIn session)
         → Visits Queens, Tango, Pinpoint, Crossclimb, Zip, Mini-Sudoku
         → Saves scores, rank, percentile, and leaderboard to SQLite
         → Browser closes

Any time → Open http://localhost:3000
         → See your stats, history charts, and leaderboard standings
```

---

## Requirements

- **macOS** (scheduling uses launchd + pmset — Windows/Linux not supported)
- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **A LinkedIn account** with games played

---

## Setup

```bash
git clone https://github.com/nia-overflow/linkedin-games.git
cd linkedin-games
bash scripts/setup.sh
```

That's it. The script will:

1. Install dependencies
2. Download Playwright's Chromium browser
3. Build the dashboard
4. Open Chrome so you can log in to LinkedIn (session is saved locally)
5. Install launchd agents (server starts at login, scraper runs at 11:55 PM)
6. Schedule a Mac wake at 11:55 PM via `pmset`

When it's done, open **[http://localhost:3000](http://localhost:3000)**.

---

## First scrape

After setup, run the scraper once manually to populate your dashboard:

```bash
pnpm scrape
```

After that, it runs automatically every night at 11:55 PM.

---

## What you see

**All Games tab**
- Today's result for each game — completion time, rank among connections, percentile
- 30-day history chart
- Aggregate stats: streak, win rate, avg time, avg percentile

**Per-game tabs** (Queens, Tango, Pinpoint, Crossclimb, Zip, Mini-Sudoku)
- 5 stat cards: streak · win rate · avg time (avg guesses for Pinpoint) · avg rank · avg percentile
- Completion time history chart
- Today's leaderboard with your connections

**Dev tab** — full scrape log for debugging

---

## Re-login

LinkedIn sessions expire occasionally. If the scraper stops capturing data:

```bash
pnpm setup:profile
```

This opens Chrome so you can log back in. No other changes needed.

---

## Manual commands

```bash
pnpm scrape          # Run scraper now (captures today's results)
pnpm dev             # Start dev server with hot reload (port 5173)
pnpm build           # Rebuild dashboard for production
```

---

## Project structure

```
linkedin-games/
├── scraper/src/
│   ├── games/       # One scraper per game + shared helpers
│   ├── db/          # SQLite schema and query functions
│   └── index.ts     # Scraper orchestrator
├── server/src/
│   └── index.ts     # Express API + serves built dashboard
├── dashboard/src/
│   ├── components/  # StatsBar, HistoryChart, LeaderboardTable, TodayResults
│   ├── api.ts       # API client
│   └── App.tsx      # Main app
└── scripts/
    ├── setup.sh         # One-command setup
    ├── install-daemons.sh
    └── setup-profile.ts # LinkedIn login helper
```

Data lives at `~/.linkedin-games/`:
- `games.db` — SQLite database (game results, leaderboard snapshots, scrape log)
- `chrome-profile/` — saved LinkedIn session
- `logs/` — scraper and server logs

---

## If scraping breaks

LinkedIn occasionally changes their page structure. If you see scrape errors:

1. Run `pnpm discover` to capture fresh screenshots and HTML of each game page
2. Check `scraper/discovery/` for the current DOM structure
3. Update selectors in `scraper/src/games/<game>.ts` if needed
4. Run `pnpm scrape` to verify

---

## Notes

- Each install is fully independent — your data never leaves your machine
- The leaderboard only shows connections LinkedIn displays on the results page (up to ~25)
- Percentile is calculated as: `((total shown - your rank) / total shown) × 100`
