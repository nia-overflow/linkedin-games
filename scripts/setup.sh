#!/usr/bin/env bash
# setup.sh
#
# One-command setup for LinkedIn Games Dashboard.
# Run once after cloning the repo.
#
# Usage:
#   bash scripts/setup.sh

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ok()     { echo -e "${GREEN}✅ $*${NC}"; }
warn()   { echo -e "${YELLOW}⚠️  $*${NC}"; }
err()    { echo -e "${RED}❌ $*${NC}"; exit 1; }
step()   { echo -e "\n${BLUE}▶ $*${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "┌─────────────────────────────────────────┐"
echo "│   LinkedIn Games Dashboard — Setup       │"
echo "└─────────────────────────────────────────┘"
echo ""
echo "Project: $PROJECT_DIR"
echo ""

# ── Step 1: Prerequisites ──────────────────────────────────────────────────
step "Checking prerequisites..."

# Node.js >= 18
if ! command -v node &>/dev/null; then
  err "Node.js not found. Install Node.js 18+ from https://nodejs.org"
fi
NODE_VERSION=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  err "Node.js $NODE_VERSION is too old. Need Node.js 18+."
fi
ok "Node.js v$NODE_VERSION"

# pnpm
if ! command -v pnpm &>/dev/null; then
  warn "pnpm not found. Installing via npm..."
  npm install -g pnpm
fi
PNPM_VERSION=$(pnpm --version)
ok "pnpm v$PNPM_VERSION"

# Chrome/Chromium (Playwright will install it, but warn if missing)
# Playwright downloads its own browser, so this is optional
ok "Playwright will manage its own Chrome installation"

# ── Step 2: Install dependencies ──────────────────────────────────────────
step "Installing dependencies..."
pnpm install --dir "$PROJECT_DIR"
ok "Dependencies installed"

# ── Step 3: Install Playwright browsers ───────────────────────────────────
step "Installing Playwright browser (Chromium)..."
# Use the playwright binary from the scraper's node_modules
PLAYWRIGHT_BIN="$PROJECT_DIR/scraper/node_modules/.bin/playwright"
if [ -f "$PLAYWRIGHT_BIN" ]; then
  "$PLAYWRIGHT_BIN" install chromium
  ok "Playwright Chromium installed"
else
  warn "Playwright binary not found at $PLAYWRIGHT_BIN — try running: pnpm --filter @linkedin-games/scraper exec playwright install chromium"
fi

# ── Step 4: Build dashboard ───────────────────────────────────────────────
step "Building dashboard..."
pnpm --dir "$PROJECT_DIR" build
ok "Dashboard built → dashboard/dist/"

# ── Step 5: Set up LinkedIn Chrome profile ────────────────────────────────
step "Setting up LinkedIn Chrome profile..."
echo ""
echo "  This will open Chrome so you can log in to LinkedIn."
echo "  The login session will be saved for the nightly scraper."
echo ""
read -r -p "  Press Enter to open Chrome and log in, or Ctrl+C to skip... "
pnpm --dir "$PROJECT_DIR" setup:profile

# ── Step 6: Install launchd daemons ───────────────────────────────────────
step "Installing launchd daemons..."
echo ""
echo "  This will:"
echo "  • Start the dashboard server automatically at login"
echo "  • Schedule the scraper to run at 11:55 PM nightly"
echo "  • Schedule your Mac to wake at 11:55 PM (requires sudo for pmset)"
echo ""
read -r -p "  Press Enter to install daemons, or Ctrl+C to skip... "
bash "$SCRIPT_DIR/install-daemons.sh"

# ── Done ──────────────────────────────────────────────────────────────────
echo ""
echo "┌─────────────────────────────────────────────────┐"
echo "│              Setup complete! 🎮                  │"
echo "│                                                 │"
echo "│  Dashboard:  http://localhost:3000              │"
echo "│  Scraper:    runs at 11:55 PM nightly           │"
echo "│  Logs:       ~/.linkedin-games/logs/            │"
echo "│                                                 │"
echo "│  Manual scrape: pnpm scrape                     │"
echo "│  Trigger now:   launchctl start                 │"
echo "│                 com.linkedingames.scraper        │"
echo "└─────────────────────────────────────────────────┘"
echo ""
