import supabase from "lib/supabase/server";

import { LEAGUE_SAVE_PCT_FALLBACK } from "./goalieOutcomes";

// Season-current league save % for the goalie beta prior: this season's saves/shots before the
// as-of date, blended with last season's mean through a 20,000-shot pseudo-sample (about a
// quarter of a season), so October does not swing on a handful of games.
export const LEAGUE_SAVE_PCT_CARRYOVER_SHOTS = 20000;
const PAGE_SIZE = 1000;
const MAX_PAGES = 12;
export const MAX_LEAGUE_SAVE_PCT_DATES = 30;

export type SeasonLeagueSavePct = {
  savePct: number;
  currentSeasonShots: number;
  previousSeasonSavePct: number | null;
  source: "observed" | "fallback";
  warning: string | null;
  excludedRows: number | null;
  sampleComplete: boolean;
};

type ShotRow = { game_date: string; shots_against: unknown; goals_allowed: unknown };

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

function validDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}

function shotCount(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || value.trim() === "")) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

/** One bounded scan for all requested cutoffs. Aggregate locally by date; never reuse later totals for an earlier cutoff. */
async function loadSeasonLeagueSavePctDates(dates: string[]): Promise<Map<string, SeasonLeagueSavePct>> {
  const oldest = seasonStartDate(dates[0], 1), newest = dates[dates.length - 1];
  const daily = new Map<string, { shots: number; goals: number; excluded: number }>();
  let complete = false;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await supabase.from("forge_goalie_game")
      .select("game_date,shots_against,goals_allowed")
      .gte("game_date", oldest).lt("game_date", newest)
      .order("game_date", { ascending: true }).order("game_id", { ascending: true }).order("goalie_id", { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("league save % source rows unavailable");
    for (const row of data as ShotRow[]) {
      if (!validDate(row.game_date) || row.game_date < oldest || row.game_date >= newest) {
        throw new Error("league save % source date outside requested bounds");
      }
      const totals = daily.get(row.game_date) ?? { shots: 0, goals: 0, excluded: 0 };
      const shots = shotCount(row.shots_against), goals = shotCount(row.goals_allowed);
      // A missing goal count is not a shutout. Keep only complete, physically valid pairs.
      if (shots == null || goals == null || goals > shots) totals.excluded += 1;
      else { totals.shots += shots; totals.goals += goals; }
      daily.set(row.game_date, totals);
    }
    if (data.length < PAGE_SIZE) { complete = true; break; }
  }
  if (!complete) throw new Error(`league save % row bound reached (${MAX_PAGES * PAGE_SIZE}); completeness unproven`);

  return new Map(dates.map(date => {
    const currentStart = seasonStartDate(date), previousStart = seasonStartDate(date, 1);
    const totals = { currentShots: 0, currentGoals: 0, previousShots: 0, previousGoals: 0 };
    let excludedRows = 0;
    for (const [day, value] of daily) {
      if (day < previousStart || day >= date) continue;
      excludedRows += value.excluded;
      if (day >= currentStart) { totals.currentShots += value.shots; totals.currentGoals += value.goals; }
      else { totals.previousShots += value.shots; totals.previousGoals += value.goals; }
    }
    const blended = blendSeasonLeagueSavePct(totals);
    const observed = totals.currentShots > 0 || blended.previousSeasonSavePct != null;
    const warnings = [
      ...(!observed ? [`no usable season league save % sample before ${date}; using labelled prior ${LEAGUE_SAVE_PCT_FALLBACK}`] : []),
      ...(excludedRows > 0 ? [`excluded ${excludedRows} incomplete or invalid GA/SA pairs before ${date}`] : []),
    ];
    return [date, { savePct: blended.savePct, currentSeasonShots: totals.currentShots,
      previousSeasonSavePct: blended.previousSeasonSavePct, source: observed ? "observed" : "fallback",
      warning: warnings.join("; ") || null, excludedRows, sampleComplete: true }];
  }));
}

/** One per request/run; no process-global cache that could bypass input capture. */
export type SeasonLeagueSavePctCache = Map<string, Promise<SeasonLeagueSavePct>>;

/** Prime at most 30 dates together so catch-up does not scan two seasons once per day. */
export async function primeSeasonLeagueSavePctCache(dates: string[], cache: SeasonLeagueSavePctCache): Promise<void> {
  const uniqueDates = [...new Set(dates)].sort();
  if (uniqueDates.length > MAX_LEAGUE_SAVE_PCT_DATES) throw new Error(`league save % accepts at most ${MAX_LEAGUE_SAVE_PCT_DATES} dates`);
  if (uniqueDates.some(date => !validDate(date))) throw new Error("Invalid league save % cutoff date");
  const missing = uniqueDates.filter(date => !cache.has(date));
  if (missing.length > 0) {
    const batch = loadSeasonLeagueSavePctDates(missing).catch(error => new Map(missing.map(date => [date, {
      savePct: LEAGUE_SAVE_PCT_FALLBACK, currentSeasonShots: 0, previousSeasonSavePct: null,
      source: "fallback" as const, excludedRows: null, sampleComplete: false,
      warning: `league save % unavailable for ${date}; using labelled prior ${LEAGUE_SAVE_PCT_FALLBACK} (${
        error instanceof Error ? error.message : String(error)})`,
    }])));
    for (const date of missing) cache.set(date, batch.then(results => results.get(date)!));
  }
  await Promise.all(uniqueDates.map(date => cache.get(date)));
}

/** A failed/no-sample read supplies a labelled model prior, never an observed league baseline. */
export async function getSeasonLeagueSavePct(asOfDate: string, cache: SeasonLeagueSavePctCache): Promise<SeasonLeagueSavePct> {
  await primeSeasonLeagueSavePctCache([asOfDate], cache);
  return cache.get(asOfDate)!;
}
