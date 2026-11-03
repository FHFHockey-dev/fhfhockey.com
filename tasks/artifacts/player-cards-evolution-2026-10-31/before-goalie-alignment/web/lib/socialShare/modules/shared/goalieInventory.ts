import type { ShareDataState } from "lib/socialShare/types";

/**
 * FROZEN consumer interface for the goalie schedule and risk inventory (CONTRACT.md §5): SS 11.0 Risky Starts and Start/Sit,
 * and Player Cards PC-R11 read this shape and nothing else. Types only, so a consumer imports no Supabase code. The
 * adapter is `goalieInventory.sources.ts` (SS 11.0). A breaking change needs a new version id and both owners' agreement.
 */
export const GOALIE_INVENTORY_VERSION = "goalie-inventory-v1" as const;

/** A sourced value with its unit; null is unknown, never zero. Cohort rank is present only with a complete population. */
export type InventoryMetric = { value: number | null; unit: string; window: string; sampleGames: number; leagueRank: number | null; leagueCohort: number | null };

export type GoalieConfirmation =
  /** Source-confirmed status. It says nothing about forecast quality and needs no forecast. */
  | { state: "confirmed" | "projected"; source: string; observedAt: string; expiresAt: string | null; sourceUrl: string | null }
  | { state: "none"; source: null; observedAt: null; expiresAt: null; sourceUrl: null };

export type GoalieForecast =
  /** Only an admitted Start Chart `startParticipation` (official_starter, start basis, unexpired) qualifies. */
  | { state: "qualified"; startProbability: number; revisionId: string; modelLabel: string; issuedAt: string; expiresAt: string }
  /** Includes every raw `goalie_start_projections.start_probability` without that admission. */
  | { state: "unavailable"; reason: string };

/** Three separate lenses. They are correlated, so nothing may sum them into one score. */
export type GoalieGameSignals = {
  /** Volume upside: opponent SF against this team's SA. */
  volume: { opponentShotsForPerGame: InventoryMetric; teamShotsAgainstPerGame: InventoryMetric };
  /** Ratio exposure: opponent xGF and chances against this team's xGA and chances allowed, PP against PK, penalty exposure. */
  ratioExposure: {
    opponentXgfPerGame: InventoryMetric; teamXgaPerGame: InventoryMetric;
    opponentScoringChancesPerGame: InventoryMetric; teamScoringChancesAgainstPerGame: InventoryMetric;
    opponentPowerPlayPct: InventoryMetric; teamPenaltyKillPct: InventoryMetric; teamTimesShorthandedPerGame: InventoryMetric;
  };
  /** Win support: goals results, stated without win odds. */
  winSupport: { teamGoalsForPerGame: InventoryMetric; opponentGoalsAgainstPerGame: InventoryMetric; teamGoalDifferentialPerGame: InventoryMetric };
};

export type GoalieInventoryGame = {
  gameId: number; date: string; startTimeUtc: string | null; team: string; opponent: string; home: boolean;
  /** Back-to-back facts from the schedule; null when the prior day is not covered. */
  teamSecondNight: boolean | null; opponentSecondNight: boolean | null;
  confirmation: GoalieConfirmation; forecast: GoalieForecast; signals: GoalieGameSignals;
};
export type GoalieInventoryEntry = {
  goalieId: number; name: string; team: string;
  /** Descriptive team-game share, from `teamStartShare`; never a start probability. */
  recentStarts: { window: "L10"; teamGames: number; starts: number | null; reliefAppearances: number; share: number | null; complete: boolean };
  games: GoalieInventoryGame[];
};
export type GoalieInventorySource = { name: string; tables: readonly string[]; state: ShareDataState; asOf: string | null; updatedAt: string | null; reasons: readonly string[] };
export type GoalieInventory = {
  version: typeof GOALIE_INVENTORY_VERSION;
  season: number; generatedAt: string; from: string; through: string;
  state: ShareDataState; reasons: readonly string[]; sources: readonly GoalieInventorySource[];
  /** Every goalie with a recent appearance for a team scheduled in the range, including teams with no confirmed starter. */
  goalies: readonly GoalieInventoryEntry[];
};
export type GoalieInventoryRequest = { season: number; from: string; through: string; generatedAt: string };
/** Implemented by SS 11.0's adapter; the first argument is a read-only Supabase client. */
export type LoadGoalieInventory = (client: { from: (table: string) => unknown }, request: GoalieInventoryRequest) => Promise<GoalieInventory>;
/** Case- and accent-insensitive name or team search over a loaded inventory; implemented with the adapter. */
export type SearchGoalieInventory = (inventory: GoalieInventory, query: string) => readonly GoalieInventoryEntry[];
