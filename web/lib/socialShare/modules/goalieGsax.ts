import type { Database } from "lib/supabase/database-generated.types";
import { defineShareModule, type SharePostLoadResult } from "./contract";
import { reconcileSchedule, scheduleNights, type ScheduledGame } from "./creaseShift";
import { completeThrough, completeThroughNote } from "./shared/completeThrough";
import { defaultWeek, type MatchupWeek } from "./shared/categoryCounts";
import { competitionRanks, lastN, per60 } from "./shared/definitions";
import { BOARD_FIELD_OPTIONS, boardSides, countOf, type BoardChoice } from "./shared/goalieBoards";
import type { CompletedTeamGame, GoalieAppearance } from "./shared/goalieLedger";
import { customRangeReason, periodWindowFields, type PeriodControl } from "./shared/periodWindow";
import { teamsInfo } from "lib/teamsInfo";

/**
 * GSAx (SS 9.0): complementary context from one named model, kept apart from Category Counts and TGV. NST-model GSAx is
 * `xg_against − goals_against`, never NST's `gsaa`, which is goals saved above average. It is not a start forecast.
 */
export type GoalieGsaxSettings = { period: string; week: number | null; start: string | null; end: string | null; window: string; strength: string; board: string; minAppearances: number; minCoverage: number };
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
  /** Most GSAx is rank 1; `worstRank` is the same order from the bottom. */
  rank: number | null; worstRank: number | null;
};
export type FhfhModelStatus = { state: "unavailable" | "not-used"; rows: number | null; reason: string };
export type GoalieGsaxData = {
  model: "NST"; strength: GsaxStrength; strengthLabel: string; board: BoardChoice; window: GsaxWindow;
  /** The matchup week, when that is the window; the last one NST's logs fully cover. Null if the window is not a week or none is covered. */
  week: MatchupWeek | null; windowLabel: string; minAppearances: number; minCoverage: number;
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

/** Chosen dates, from the period control. `through` can run past the data: the card counts only what NST has. */
export type GsaxDates = { from: string; through: string; label: string; week: number | null };
/** Last N appearances, season to date (null), the last completed matchup week, or chosen dates. */
export type GsaxWindow = number | null | "week" | GsaxDates;
export type GoalieGsaxInput = {
  appearances: readonly GoalieAppearance[]; nstGames: readonly NstGoalieGame[]; strength: GsaxStrength; window: GsaxWindow; weeks: readonly MatchupWeek[]; board: BoardChoice; minAppearances: number; minCoverage: number;
  reported: readonly CompletedTeamGame[]; scheduled: readonly ScheduledGame[]; fhfhRows: number | null;
};
export function buildGoalieGsax(input: GoalieGsaxInput): SharePostLoadResult<GoalieGsaxData> {
  const fhfhModel = fhfhModelStatus(input.fhfhRows), strengthLabel = GSAX_STRENGTH_LABELS[input.strength], table = NST_GSAX_TABLES[input.strength];
  const latest = (dates: readonly string[]) => dates.reduce<string | null>((max, date) => !max || date > max ? date : max, null);
  const nstNewest = latest(input.nstGames.map(game => game.date)), wgoThrough = latest(input.appearances.map(row => row.date));
  // The last week NST fully covers, so a lagging source gives an older complete week rather than part of a newer one.
  const dates = typeof input.window === "object" ? input.window : null, chosen = (date: string) => !!dates && date >= dates.from && date <= dates.through;
  const week = dates ? input.weeks.find(entry => entry.week === dates.week) ?? null : input.window === "week" && nstNewest ? defaultWeek(input.weeks, nstNewest) : null;
  const inWeek = (date: string) => input.window !== "week" || (!!week && date >= week.start && date <= week.end);
  // A late NHL.com feed on the newest nights ends the card at the last complete one, chosen week or not; an older gap stays partial.
  const nights = scheduleNights(input.scheduled.filter(game => (dates ? chosen(game.date) : inWeek(game.date)) && (dates || !nstNewest || game.date <= nstNewest)), input.reported);
  const cut = completeThrough(nights, latest(nights.map(night => night.date)) ?? "");
  const endDate = cut.trimmed.length ? cut.through : null, nstThrough = endDate && nstNewest && endDate < nstNewest ? endDate : nstNewest;
  const lagDays = nstThrough && wgoThrough ? Math.max(0, dayDifference(wgoThrough, nstThrough)) : null;
  const counted = (date: string) => !endDate || date <= endDate;
  const inWindowDates = (date: string) => !!nstThrough && date <= nstThrough && (dates ? chosen(date) : input.window !== "week" || (!!week && date >= week.start && date <= week.end));
  const inScope = input.appearances.filter(row => inWindowDates(row.date));
  const appearancesBehindNst = nstThrough ? input.appearances.filter(row => row.date > nstThrough).length : 0;
  // Only games NST lacks count as behind: a chosen week still under way, or a day with no games, has nothing missing.
  const pastNst = (date: string) => chosen(date) && counted(date) && (!nstThrough || date > nstThrough);
  const appearancesPastNst = input.appearances.filter(row => pastNst(row.date)).length, gamesPastNst = input.scheduled.filter(game => pastNst(game.date)).length;
  const windowLabel = dates ? dates.label : input.window === "week" ? week ? `Week ${week.week}, ${week.start} to ${week.end}${week.end > nstThrough! ? `, through ${nstThrough}` : ""}` : "No matchup week covered" : input.window === null ? "Season to date" : `Last ${input.window} appearances per goalie`;
  const nstByKey = new Map(input.nstGames.map(game => [`${game.goalieId}:${game.date}`, game]));
  const appearanceKeys = new Set(input.appearances.map(row => `${row.goalieId}:${row.date}`));
  const byGoalie = new Map<number, GoalieAppearance[]>();
  for (const row of inScope) byGoalie.set(row.goalieId, [...byGoalie.get(row.goalieId) ?? [], row]);
  const rows = [...byGoalie.entries()].map(([goalieId, own]): GoalieGsaxRow => {
    const window = typeof input.window !== "number" ? { rows: own, actual: own.length, short: false } : lastN(own, input.window);
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
      gsaxPer60: gsax === null || magnitude === null ? null : gsax < 0 ? -magnitude : magnitude, rank: null, worstRank: null,
    };
  });
  const ranked = competitionRanks(rows, row => row.gsax, row => row.goalieId), ranks = new Map(ranked.map(entry => [entry.row.goalieId, entry.rank]));
  const worstRanks = new Map(competitionRanks(rows, row => row.gsax, row => row.goalieId, "low").map(entry => [entry.row.goalieId, entry.rank]));
  const order = (row: GoalieGsaxRow) => input.board === "worst" ? row.worstRank : row.rank;
  const finished = rows.map(row => ({ ...row, rank: ranks.get(row.goalieId) ?? null, worstRank: worstRanks.get(row.goalieId) ?? null })).sort((a, b) => (order(a) ?? Infinity) - (order(b) ?? Infinity) || a.goalieId - b.goalieId);
  // A week window answers only for that week's games, so a gap elsewhere in the season does not touch it.
  const proven = (date: string) => counted(date) && (dates ? chosen(date) : inWeek(date));
  const schedule = reconcileSchedule(input.scheduled.filter(game => proven(game.date)), input.reported.filter(game => proven(game.date)));
  const shownTeams = boardSides(finished, goalieGsaxRanks, input.board, GSAX_SHOWN).sides.flatMap(side => side.entries.map(({ row }) => row.teams[row.teams.length - 1]));
  const covered = rows.reduce((total, row) => total + row.covered, 0), expected = rows.reduce((total, row) => total + row.appearances, 0);
  const reasons = [
    ...nstThrough ? [] : [`NST ${strengthLabel} goalie rows are missing this season.`],
    ...schedule.missing ? [`${schedule.missing} of ${schedule.expected} scheduled team games ${dates ? "in these dates" : "through NST's date"} have no reported result.`] : [],
    ...nstThrough && (appearancesPastNst || gamesPastNst) ? [`${dates!.label} runs past NST's newest date, ${nstThrough}: ${countOf(appearancesPastNst, "appearance")} after it ${appearancesPastNst === 1 ? "is" : "are"} not counted.`] : [],
  ];
  const lagNote = lagDays ? [`${gsaxLagLabel(lagDays)} behind NHL.com`] : [];
  const note = completeThroughNote(cut), unreported = cut.trimmed.length > 0 && !cut.through;
  return {
    state: !nstThrough || unreported ? "missing" : reasons.length ? "partial" : "ready", reasons: unreported ? ["No night in this window is fully reported yet."] : reasons, ...note ? { pageNotes: [note] } : {}, teams: [...new Set(shownTeams)].filter(team => team in teamsInfo),
    data: nstThrough && !unreported ? {
      model: "NST", strength: input.strength, strengthLabel, board: input.board, window: input.window, week, windowLabel, minAppearances: input.minAppearances, minCoverage: input.minCoverage,
      nstThrough, wgoThrough, lagDays, appearancesBehindNst, unmatchedNstRows: input.nstGames.filter(game => !appearanceKeys.has(`${game.goalieId}:${game.date}`)).length,
      rows: finished, ranked: ranked.length, unadmitted: rows.length - ranked.length, fhfhModel,
    } : null,
    evidence: {
      sources: [
        { name: `NST ${strengthLabel} goalie logs (NST model)`, tables: [table], state: nstThrough ? "ready" : "missing", asOf: nstThrough, updatedAt: null, reasons: lagNote },
        { name: "NHL.com goalie game stats", tables: ["wgo_goalie_stats", "wgo_team_stats", "games"], state: schedule.missing ? "partial" : "ready", asOf: wgoThrough, updatedAt: null },
        { name: "FHFH xG model", tables: ["nhl_xg_goalie_game_aggregates"], state: fhfhModel.state === "unavailable" ? "missing" : "ready", asOf: null, updatedAt: null, reasons: [fhfhModel.reason] },
      ],
      sample: `${windowLabel}, NST through ${nstThrough ?? "no date"}${lagDays ? `, ${gsaxLagLabel(lagDays)} behind NHL.com (${wgoThrough})` : ""}: ${covered} of ${countOf(expected, "appearance")} with NST rows. Later appearances not counted: ${appearancesBehindNst}. NST rows dropped for no NHL.com appearance that date: ${input.nstGames.filter(game => !appearanceKeys.has(`${game.goalieId}:${game.date}`)).length}`,
      strength: strengthLabel, cohort: `${countOf(ranked.length, "goalie")} with at least ${countOf(input.minAppearances, "appearance")} and ${input.minCoverage}% NST coverage; ${rows.length - ranked.length} unranked.${dates ? ` Appearances and coverage count only games in the chosen dates through NST's newest date, so a short range ranks on a small sample: at ${countOf(input.minAppearances, "appearance")} that many games qualifies a goalie. Raise Min appearances for a firmer list.` : ""} Above 0 means fewer goals allowed than this model expected; one model's context beside SV% and GAA, not comparable across models or strengths, and nothing about the next start. ${fhfhModel.reason}`,
      coverage: { observed: covered, expected, missing: expected - covered, unit: "goalie appearances" },
    },
  };
}

/** Goalies shown per side; the rest stay in the snapshot and are counted on it. */
export const GSAX_SHOWN = 10;
export const goalieGsaxRanks = { id: (row: GoalieGsaxRow) => row.goalieId, best: (row: GoalieGsaxRow) => row.rank, worst: (row: GoalieGsaxRow) => row.worstRank };
const GSAX_PERIOD_CONTROL: PeriodControl = { mode: "past-only" };
/** The `period` option that keeps the post's own windows, and so every URL from before the control. */
export const GSAX_PERIOD_WINDOW = "window";
export const goalieGsaxModule = defineShareModule<GoalieGsaxSettings, GoalieGsaxData>({
  id: "goalie-gsax", title: "GSAx (NST model)", summary: "Goals saved above expected from NST's model only, with sign, strength, sample and through-date. Context, not a ranking method or a start forecast.", group: "goalies", basis: "observed",
  fields: [
    ...periodWindowFields({ mode: GSAX_PERIOD_CONTROL.mode, default: GSAX_PERIOD_WINDOW, options: [{ value: GSAX_PERIOD_WINDOW, label: "Preset window" }, { value: "matchup", label: "Matchup week" }, { value: "custom", label: "Custom range" }] }),
    { id: "window", label: "Window", kind: "select", onlyForPeriod: GSAX_PERIOD_WINDOW, default: "week", options: [{ value: "week", label: "Last completed matchup week" }, { value: "5", label: "L5 appearances" }, { value: "10", label: "L10 appearances" }, { value: "std", label: "Season to date" }] },
    { id: "strength", label: "Strength", kind: "select", default: "all", options: [{ value: "all", label: "All situations" }, { value: "5v5", label: "5 on 5" }] },
    { id: "board", label: "Board", kind: "select", default: "both", options: BOARD_FIELD_OPTIONS },
    { id: "minAppearances", label: "Min appearances", kind: "number", default: 1, min: 1, max: 82, step: 1 },
    { id: "minCoverage", label: "Min NST coverage %", kind: "number", default: 90, min: 50, max: 100, step: 5 },
  ],
  periodControl: GSAX_PERIOD_CONTROL,
  validate: settings => settings.period === "custom" ? customRangeReason(settings) : null,
  load: () => import("./goalieGsax.sources").then(sources => sources.loadGoalieGsax),
  card: () => import("components/SocialShare/modules/GoalieGsaxCard").then(card => card.default),
  hasRows: data => data.ranked > 0,
  altText: (snapshot, data) => `FHFH GSAx, NST model, ${data.strengthLabel}, ${data.windowLabel}, NST through ${data.nstThrough}. ${boardSides(data.rows, goalieGsaxRanks, data.board, GSAX_SHOWN).sides.map(side => `${side.kind === "best" ? "Best" : "Worst"}: ${side.entries.map(({ row, rank }) => `${rank}. ${row.name ?? row.goalieId}: ${row.gsax} in ${row.covered} of ${countOf(row.appearances, "appearance")}`).join("; ")}`).join(". ")}. ${data.fhfhModel.reason} ${snapshot.evidence.sample}.`,
});
