/**
 * Shared types for all game scrapers.
 */

import type { Page } from 'playwright';

export interface LeaderboardEntry {
  gameName: string;
  playedDate: string;        // 'YYYY-MM-DD'
  capturedAt: string;
  rank?: number;
  connectionName: string;
  connectionProfileUrl?: string;
  score?: number;
  completionTimeSecs?: number;
  isSelf: boolean;
}

export interface ScrapeResult {
  gameName: string;
  playedDate: string;        // 'YYYY-MM-DD'
  capturedAt: string;
  completed: boolean;
  score?: number;
  completionTimeSecs?: number;
  leaderboard: LeaderboardEntry[];
  rawData: unknown;
}

export type GameScraper = (page: Page) => Promise<ScrapeResult>;
