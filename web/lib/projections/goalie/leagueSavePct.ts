import supabase from "lib/supabase/server";

import { LEAGUE_SAVE_PCT_FALLBACK } from "./goalieOutcomes";

// Season-current league save % for the goalie beta prior: this season's saves/shots before the
// as-of date, blended with last season's mean through a 20,000-shot pseudo-sample (about a
// quarter of a season), so October does not swing on a handful of games.
export const LEAGUE_SAVE_PCT_CARRYOVER_SHOTS = 20000;
const PAGE_SIZE = 1000;
const MAX_PAGES = 12;

export type SeasonLeagueSavePct = {
  savePct: number;
  currentSeasonShots: number;
  previousSeasonSavePct: number | null;
  source: "observed" | "fallback";
  warning: string | null;
};

type ShotRow = { game_date: string; shots_against: number | null; goals_allowed: number | null };

function seasonStartDate(asOfDate: string, yearsBack = 0): string {
  const [year, month] = asOfDate.split("-").map(Number);
  const startYear = (month >= 7 ? year : year - 1) - yearsBack;
  return `${startYear}-07-01`;
}

export function blendSeasonLeagueSavePct(args: {
  currentShots: number;
  currentGoals: number;
  previousShots: number;
  previousGoals: number;
}): { savePct: number; previousSeasonSavePct: number | null } {
  const previousSeasonSavePct = args.previousShots >= LEAGUE_SAVE_PCT_CARRYOVER_SHOTS
    ? 1 - args.previousGoals / args.previousShots : null;
  const prior = previousSeasonSavePct ?? LEAGUE_SAVE_PCT_FALLBACK;
  const savePct = (args.currentShots - args.currentGoals + LEAGUE_SAVE_PCT_CARRYOVER_SHOTS * prior) /
    (args.currentShots + LEAGUE_SAVE_PCT_CARRYOVER_SHOTS);
  return { savePct, previousSeasonSavePct };
}

async function loadSeasonLeagueSavePct(asOfDate: string): Promise<SeasonLeagueSavePct> {
  const currentStart = seasonStartDate(asOfDate);
  const previousStart = seasonStartDate(asOfDate, 1);
  const totals = { currentShots: 0, currentGoals: 0, previousShots: 0, previousGoals: 0 };
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await supabase
      .from("forge_goalie_game")
      .select("game_date,shots_against,goals_allowed")
      .gte("game_date", previousStart)
      .lt("game_date", asOfDate)
      .order("game_date", { ascending: true })
      .order("game_id", { ascending: true })
      .order("goalie_id", { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as ShotRow[];
    for (const row of rows) {
      const shots = Number(row.shots_against);
      const goals = Number(row.goals_allowed);
      if (!Number.isFinite(shots) || !Number.isFinite(goals) || shots <= 0) continue;
      if (row.game_date >= currentStart) {
        totals.currentShots += shots;
        totals.currentGoals += goals;
      } else {
        totals.previousShots += shots;
        totals.previousGoals += goals;
      }
    }
    if (rows.length < PAGE_SIZE) break;
  }
  const blended = blendSeasonLeagueSavePct(totals);
  return {
    savePct: blended.savePct,
    currentSeasonShots: totals.currentShots,
    previousSeasonSavePct: blended.previousSeasonSavePct,
    source: "observed",
    warning: null,
  };
}

/** One per projection run (created beside the run's other caches), keyed by as-of date. */
export type SeasonLeagueSavePctCache = Map<string, Promise<SeasonLeagueSavePct>>;

/**
 * Memoized per run and as-of date, never across runs: every run makes its own read, so
 * reconstruction input capture records it even when a process runs several times. A failed
 * read falls back to the fitted constant with a warning.
 */
export function getSeasonLeagueSavePct(
  asOfDate: string,
  cache: SeasonLeagueSavePctCache
): Promise<SeasonLeagueSavePct> {
  const cached = cache.get(asOfDate);
  if (cached) return cached;
  const pending = (async () => {
    try {
      return await loadSeasonLeagueSavePct(asOfDate);
    } catch (error) {
      return {
        savePct: LEAGUE_SAVE_PCT_FALLBACK,
        currentSeasonShots: 0,
        previousSeasonSavePct: null,
        source: "fallback" as const,
        warning: `league save % unavailable for ${asOfDate}; using ${LEAGUE_SAVE_PCT_FALLBACK} (${
          error instanceof Error ? error.message : String(error)})`,
      };
    }
  })();
  cache.set(asOfDate, pending);
  return pending;
}
