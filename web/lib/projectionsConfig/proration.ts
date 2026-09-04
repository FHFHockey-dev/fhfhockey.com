// web/lib/projectionsConfig/proration.ts
// Helpers for full-season pacing (proration) of skater counting stats.
// Centralizes logic so fantasy points (and derived value metrics) can optionally
// be recomputed on the current NHL schedule pace without mutating projection data.

import {
  DEFAULT_SKATER_FANTASY_POINTS,
  DEFAULT_GOALIE_FANTASY_POINTS
} from "./fantasyPointsConfig";
import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";

export const NHL_REGULAR_SEASON_GAMES = 84;

// Stats that should be prorated for skaters when full-season pacing is enabled.
// Excludes plus/minus, TOI, rate or percentage stats, goalie stats.
export const PRORATABLE_SKATER_STAT_KEYS = new Set<string>([
  "GOALS",
  "ASSISTS",
  "POINTS",
  "SHOTS_ON_GOAL",
  "HITS",
  "BLOCKED_SHOTS",
  "FACEOFFS_WON",
  "FACEOFFS_LOST",
  "PENALTY_MINUTES",
  "PP_GOALS",
  "PP_ASSISTS",
  "PP_POINTS",
  "SH_GOALS",
  "SH_ASSISTS",
  "SH_POINTS"
]);

export const isGoaliePlayer = (player: ProcessedPlayer): boolean => {
  const pos = (player.displayPosition || "").toUpperCase();
  return pos
    .split(",")
    .map((p) => p.trim())
    .includes("G");
};

export function canProrateStat(
  player: ProcessedPlayer,
  statKey: string,
): boolean {
  if (!PRORATABLE_SKATER_STAT_KEYS.has(statKey) || isGoaliePlayer(player)) {
    return false;
  }
  const raw = (player.combinedStats as any)?.[statKey]?.projected;
  const gp = (player.combinedStats as any)?.["GAMES_PLAYED"]?.projected;
  return (
    typeof raw === "number" &&
    Number.isFinite(raw) &&
    typeof gp === "number" &&
    Number.isFinite(gp) &&
    gp > 0
  );
}

/** Return (raw / GP) * season games for eligible skater counting stats. */
export function getProratedStat(
  player: ProcessedPlayer,
  statKey: string,
  enable: boolean
): number | null | undefined {
  const raw = (player.combinedStats as any)?.[statKey]?.projected as
    | number
    | null
    | undefined;
  if (!enable) return raw;
  if (raw == null || !Number.isFinite(raw)) return raw;
  if (!canProrateStat(player, statKey)) return raw;
  const gp = (player.combinedStats as any)?.["GAMES_PLAYED"]?.projected as
    | number
    | null
    | undefined;
  if (!gp || !Number.isFinite(gp) || gp <= 0) return raw;
  return (raw / gp) * NHL_REGULAR_SEASON_GAMES;
}

/** Compute fantasy points total using (optionally) prorated counting stats. */
export function computeProratedFantasyPoints(
  player: ProcessedPlayer,
  enable: boolean,
  customScoring?: Record<string, number>
): number | null {
  // If not enabled just return existing projected FP to avoid tiny rounding drift.
  if (!enable) return player.fantasyPoints.projected ?? null;
  const isGoalie = isGoaliePlayer(player);
  // Merge default configs (custom overrides > defaults)
  const scoring: Record<string, number> = {
    ...(isGoalie
      ? DEFAULT_GOALIE_FANTASY_POINTS
      : DEFAULT_SKATER_FANTASY_POINTS),
    ...(customScoring || {})
  };
  let total = 0;
  let used = false;
  for (const statKey in scoring) {
    const weight = scoring[statKey];
    if (!weight) continue;
    const val = getProratedStat(player, statKey, enable);
    if (val != null && Number.isFinite(val)) {
      total += val * weight;
      used = true;
    }
  }
  return used ? total : null;
}
