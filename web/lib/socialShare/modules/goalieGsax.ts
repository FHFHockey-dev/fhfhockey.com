import type { Database } from "lib/supabase/database-generated.types";
import { defineShareModule, type SharePostLoadResult } from "./contract";
import { reconcileSchedule, type ScheduledGame } from "./creaseShift";
import { competitionRanks, lastN, per60 } from "./shared/definitions";
import type { CompletedTeamGame, GoalieAppearance } from "./shared/goalieLedger";

/**
 * GSAx (SS 9.0): complementary context from one named model, kept apart from Category Counts and TGV. NST-model GSAx is
 * `xg_against − goals_against`, never NST's `gsaa`, which is goals saved above average. It is not a start forecast.
 */
export type GoalieGsaxSettings = { window: string; strength: string; board: string; minAppearances: number; minCoverage: number };
export type GsaxStrength = "all" | "5v5";
type NstGoalieRow = Database["public"]["Tables"]["nst_gamelog_goalie_all_counts"]["Row"];
export const NST_GSAX_COLUMNS = ["player_id", "player_name", "date_scraped", "season", "toi", "xg_against", "goals_against", "shots_against"] as const satisfies readonly (keyof NstGoalieRow)[];
export type NstGsaxRow = Pick<NstGoalieRow, typeof NST_GSAX_COLUMNS[number]>;
export const NST_GSAX_TABLES: Record<GsaxStrength, string> = { all: "nst_gamelog_goalie_all_counts", "5v5": "nst_gamelog_goalie_5v5_counts" };
export const GSAX_STRENGTH_LABELS: Record<GsaxStrength, string> = { all: "All situations", "5v5": "5 on 5" };

export type NstGoalieGame = { goalieId: number; date: string; toiSeconds: number | null; xgAgainst: number | null; goalsAgainst: number | null; shotsAgainst: number | null };
/** NST goalie `toi` is minutes; this is the one place it becomes seconds. Duplicates fail closed. */
export function toNstGoalieGames(rows: readonly NstGsaxRow[], scope: { season: number; through: string }): NstGoalieGame[] {
  const seen = new Set<string>(), games: NstGoalieGame[] = [];
  for (const row of rows) {
    if (row.season !== scope.season || row.date_scraped > scope.through) continue;
    const key = `${row.player_id}:${row.date_scraped}`;
    if (seen.has(key)) throw new Error("NST goalie read returned a duplicate goalie date.");
    seen.add(key);
    games.push({ goalieId: row.player_id, date: row.date_scraped, toiSeconds: row.toi === null ? null : row.toi * 60, xgAgainst: row.xg_against, goalsAgainst: row.goals_against, shotsAgainst: row.shots_against });
  }
  return games;
}
const usable = (game: NstGoalieGame | undefined): game is NstGoalieGame & { xgAgainst: number; goalsAgainst: number } => game !== undefined && game.xgAgainst !== null && game.goalsAgainst !== null;
const cents = (value: number) => Math.round(value * 100) / 100;

export type GoalieGsaxRow = {
  goalieId: number; name: string | null; teams: string[];
  /** Window appearances through NST's through-date, with starts and relief apart. */
  appearances: number; short: boolean; starts: number; relief: number; firstDate: string | null; lastDate: string | null;
  /** Window appearances with this strength's xG and goals against, and those without. */
  covered: number; missing: number; coveragePct: number;
  admitted: boolean;
  /** Positive means fewer goals allowed than the model expected. Null when not admitted. */
  gsax: number | null; xgAgainst: number; goalsAgainst: number; shotsAgainst: number | null; toiSeconds: number | null; gsaxPer60: number | null;
  rank: number | null;
};
export type FhfhModelStatus = { state: "unavailable" | "not-used"; rows: number | null; reason: string };
export type GoalieGsaxData = {
  model: "NST"; strength: GsaxStrength; strengthLabel: string; board: "best" | "worst"; window: number | null; minAppearances: number; minCoverage: number;
  nstThrough: string | null; wgoThrough: string | null; lagDays: number | null;
  /** NHL.com appearances after NST's through-date: not counted anywhere on this card. */
  appearancesBehindNst: number;
  /** NST rows with no NHL.com appearance for that goalie and date: dropped, because the source disagrees about who played. */
  unmatchedNstRows: number;
  rows: GoalieGsaxRow[]; ranked: number; unadmitted: number; fhfhModel: FhfhModelStatus;
};

export function fhfhModelStatus(rows: number | null): FhfhModelStatus {
  if (rows === null) return { state: "unavailable", rows, reason: "FHFH xG model: unavailable, its rows could not be checked. It is not mixed into this card." };
  return rows === 0 ? { state: "unavailable", rows, reason: "FHFH xG model: unavailable this season, 0 goalie games." } : { state: "not-used", rows, reason: `FHFH xG model: ${rows} goalie games exist, not shown here. The two models are not interchangeable.` };
}
export const gsaxLagLabel = (days: number) => `${days} day${days === 1 ? "" : "s"}`;
const dayDifference = (later: string, earlier: string) => Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86400000);

export type GoalieGsaxInput = {
  appearances: readonly GoalieAppearance[]; nstGames: readonly NstGoalieGame[]; strength: GsaxStrength; window: number | null; board: "best" | "worst"; minAppearances: number; minCoverage: number;
  reported: readonly CompletedTeamGame[]; scheduled: readonly ScheduledGame[]; fhfhRows: number | null;
};
export function buildGoalieGsax(input: GoalieGsaxInput): SharePostLoadResult<GoalieGsaxData> {
  const fhfhModel = fhfhModelStatus(input.fhfhRows), strengthLabel = GSAX_STRENGTH_LABELS[input.strength], table = NST_GSAX_TABLES[input.strength];
  const latest = (dates: readonly string[]) => dates.reduce<string | null>((max, date) => !max || date > max ? date : max, null);
  const nstThrough = latest(input.nstGames.map(game => game.date)), wgoThrough = latest(input.appearances.map(row => row.date));
  const lagDays = nstThrough && wgoThrough ? Math.max(0, dayDifference(wgoThrough, nstThrough)) : null;
  const inScope = nstThrough ? input.appearances.filter(row => row.date <= nstThrough) : [];
  const nstByKey = new Map(input.nstGames.map(game => [`${game.goalieId}:${game.date}`, game]));
  const appearanceKeys = new Set(input.appearances.map(row => `${row.goalieId}:${row.date}`));
  const byGoalie = new Map<number, GoalieAppearance[]>();
  for (const row of inScope) byGoalie.set(row.goalieId, [...byGoalie.get(row.goalieId) ?? [], row]);
  const rows = [...byGoalie.entries()].map(([goalieId, own]): GoalieGsaxRow => {
    const window = input.window === null ? { rows: own, actual: own.length, short: false } : lastN(own, input.window);
    const games = window.rows.map(row => nstByKey.get(`${goalieId}:${row.date}`)).filter(usable);
    const covered = games.length, appearances = window.actual, coveragePct = appearances ? covered * 100 / appearances : 0;
    const admitted = appearances >= input.minAppearances && covered > 0 && coveragePct >= input.minCoverage;
    const xgAgainst = games.reduce((total, game) => total + game.xgAgainst, 0), goalsAgainst = games.reduce((total, game) => total + game.goalsAgainst, 0);
    const toiSeconds = games.every(game => game.toiSeconds !== null) && covered ? games.reduce((total, game) => total + game.toiSeconds!, 0) : null;
    const shotsAgainst = games.every(game => game.shotsAgainst !== null) && covered ? games.reduce((total, game) => total + game.shotsAgainst!, 0) : null;
    const gsax = admitted ? cents(xgAgainst - goalsAgainst) : null;
    const magnitude = gsax === null ? null : per60(Math.abs(gsax), toiSeconds);
    return {
      goalieId, name: own.reduce<string | null>((name, row) => row.name ?? name, null), teams: [...new Set(window.rows.map(row => row.team))],
      appearances, short: window.short, starts: window.rows.filter(row => row.started === true).length, relief: window.rows.filter(row => row.started === false).length,
      firstDate: window.rows[0]?.date ?? null, lastDate: window.rows[window.rows.length - 1]?.date ?? null,
      covered, missing: appearances - covered, coveragePct, admitted, gsax, xgAgainst: cents(xgAgainst), goalsAgainst, shotsAgainst, toiSeconds,
      gsaxPer60: gsax === null || magnitude === null ? null : gsax < 0 ? -magnitude : magnitude, rank: null,
    };
  });
  const ranked = competitionRanks(rows, row => row.gsax, row => row.goalieId, input.board === "worst" ? "low" : "high"), ranks = new Map(ranked.map(entry => [entry.row.goalieId, entry.rank]));
  const finished = rows.map(row => ({ ...row, rank: ranks.get(row.goalieId) ?? null })).sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.goalieId - b.goalieId);
  const schedule = reconcileSchedule(input.scheduled, input.reported);
  const covered = rows.reduce((total, row) => total + row.covered, 0), expected = rows.reduce((total, row) => total + row.appearances, 0);
  const reasons = [
    ...nstThrough ? [] : [`NST ${strengthLabel} goalie rows are missing this season.`],
    ...schedule.missing ? [`${schedule.missing} of ${schedule.expected} scheduled team games through NST's date have no reported result.`] : [],
  ];
  const lagNote = lagDays ? [`${gsaxLagLabel(lagDays)} behind NHL.com`] : [];
  return {
    state: !nstThrough ? "missing" : reasons.length ? "partial" : "ready", reasons,
    data: nstThrough ? {
      model: "NST", strength: input.strength, strengthLabel, board: input.board, window: input.window, minAppearances: input.minAppearances, minCoverage: input.minCoverage,
      nstThrough, wgoThrough, lagDays, appearancesBehindNst: input.appearances.length - inScope.length, unmatchedNstRows: input.nstGames.filter(game => !appearanceKeys.has(`${game.goalieId}:${game.date}`)).length,
      rows: finished, ranked: ranked.length, unadmitted: rows.length - ranked.length, fhfhModel,
    } : null,
    evidence: {
      sources: [
        { name: `NST ${strengthLabel} goalie logs (NST model)`, tables: [table], state: nstThrough ? "ready" : "missing", asOf: nstThrough, updatedAt: null, reasons: lagNote },
        { name: "NHL.com goalie game stats", tables: ["wgo_goalie_stats", "wgo_team_stats", "games"], state: schedule.missing ? "partial" : "ready", asOf: wgoThrough, updatedAt: null },
        { name: "FHFH xG model", tables: ["nhl_xg_goalie_game_aggregates"], state: fhfhModel.state === "unavailable" ? "missing" : "ready", asOf: null, updatedAt: null, reasons: [fhfhModel.reason] },
      ],
      sample: `${input.window === null ? "Season to date" : `Last ${input.window} appearances per goalie`} through ${nstThrough ?? "no date"}: ${covered} of ${expected} appearances with NST rows`,
      strength: strengthLabel, cohort: `${ranked.length} goalies with at least ${input.minAppearances} appearances and ${input.minCoverage}% NST coverage; ${rows.length - ranked.length} unranked`,
      coverage: { observed: covered, expected, missing: expected - covered, unit: "goalie appearances" },
    },
  };
}

/** Goalies shown on the card; the rest stay in the snapshot and are counted on it. */
export const GSAX_SHOWN = 10;
export const goalieGsaxModule = defineShareModule<GoalieGsaxSettings, GoalieGsaxData>({
  id: "goalie-gsax", title: "GSAx (NST model)", summary: "Goals saved above expected from NST's model only, with sign, strength, sample and through-date. Context, not a ranking method or a start forecast.", group: "goalies", basis: "observed",
  fields: [
    { id: "window", label: "Window", kind: "select", default: "10", options: [{ value: "5", label: "L5 appearances" }, { value: "10", label: "L10 appearances" }, { value: "std", label: "Season to date" }] },
    { id: "strength", label: "Strength", kind: "select", default: "all", options: [{ value: "all", label: "All situations" }, { value: "5v5", label: "5 on 5" }] },
    { id: "board", label: "Board", kind: "select", default: "best", options: [{ value: "best", label: "Most GSAx" }, { value: "worst", label: "Least GSAx" }] },
    { id: "minAppearances", label: "Min appearances", kind: "number", default: 3, min: 1, max: 82, step: 1 },
    { id: "minCoverage", label: "Min NST coverage %", kind: "number", default: 90, min: 50, max: 100, step: 5 },
  ],
  load: () => import("./goalieGsax.sources").then(sources => sources.loadGoalieGsax),
  card: () => import("components/SocialShare/modules/GoalieGsaxCard").then(card => card.default),
  hasRows: data => data.ranked > 0,
  altText: (snapshot, data) => `FHFH GSAx, NST model, ${data.strengthLabel}, through ${data.nstThrough}. ${data.rows.filter(row => row.rank !== null).slice(0, GSAX_SHOWN).map(row => `${row.rank}. ${row.name ?? row.goalieId}: ${row.gsax} in ${row.covered} of ${row.appearances} appearances`).join("; ")}. ${data.fhfhModel.reason} ${snapshot.evidence.sample}.`,
});
