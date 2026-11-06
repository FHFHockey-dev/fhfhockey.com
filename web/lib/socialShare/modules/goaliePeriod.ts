import { calculateWeeklyRanking, isGoalieWeekEligible } from "components/GoaliePage/goalieCalculations";
import type { GoalieWeeklyAggregate, LeagueWeeklyAverage, NumericGoalieStatKey, Ranking, StatColumn } from "components/GoaliePage/goalieTypes";
import { teamsInfo } from "lib/teamsInfo";
import { defineShareModule, type SharePostLoadResult } from "./contract";
import { datedThrough, reconcileSchedule, scheduleNights, type ScheduledGame } from "./creaseShift";
import { completeThrough, completeThroughNote } from "./shared/completeThrough";
import { buildWeekLedgers, CATEGORIES, categoryById, CATEGORY_COUNTS_LABEL, DEFAULT_CATEGORY_IDS, defaultMonth, monthPeriod, periodGoalies, rangePeriod, rankPeriodGoalies, seasonPeriod, spanDays, weekPeriod, type CategoryId, type CellCounts, type MatchupWeek, type PeriodGoalie, type SharePeriod } from "./shared/categoryCounts";
import { BOARD_FIELD_OPTIONS, boardChoice, boardSides, countOf, type BoardChoice, type BoardSide } from "./shared/goalieBoards";
import { teamStartShare, type CompletedTeamGame, type GoalieAppearance } from "./shared/goalieLedger";
import { customRangeReason, periodWindowFields, resolvePeriodWindow, type PeriodControl } from "./shared/periodWindow";
import type { YahooMapRow } from "./goalieRescue";

/** Goalie of the Week and Month, with best and worst (SS 9.0), by Category Counts. TGV grades sit beside it under their own label. */
export type GoaliePeriodSettings = { period: string; week: number | null; month: string; start: string | null; end: string | null; minStartsWeek: number; minStartsMonth: number; minStartsRange: number; minStartsSeason: number; board: string; categories: string };
export const TGV_LABEL = "TGV grade (existing method)";

/** The TGV page's default stats and its column mapping, passed to its own unedited `calculateWeeklyRanking`. */
export const TGV_STAT_KEYS: NumericGoalieStatKey[] = ["wins", "saves", "savePct"];
export const TGV_STAT_COLUMNS: StatColumn[] = [
  { label: "W", value: "wins", dbFieldGoalie: "weekly_wins", dbFieldAverage: "avg_league_weekly_wins" },
  { label: "SV", value: "saves", dbFieldGoalie: "weekly_saves", dbFieldAverage: "avg_league_weekly_saves" },
  { label: "SV%", value: "savePct", dbFieldGoalie: "weekly_sv_pct", dbFieldAverage: "avg_league_weekly_sv_pct", dbFieldRate: true },
];
export const TGV_GRADES: readonly Ranking[] = ["Elite", "Good", "Average", "Bad", "Abysmal"];
/** One matchup week. Null is no grade, which is a gap in the line and never 0 points. */
export type TgvSeasonWeek = { week: number; ranking: Ranking | null; points: number | null; selected: boolean };
export type TgvResult = {
  label: typeof TGV_LABEL; state: "ready" | "unavailable";
  /** Graded weeks by grade and their summed points, season start through the period's last week; null when TGV could not be read. */
  counts: Record<Ranking, number> | null; points: number | null;
  /** Weeks with a row that the existing method leaves unclassified. */
  unclassified: number; series: TgvSeasonWeek[];
};
export type GoaliePeriodRow = { goalieId: number; name: string | null; teams: string[]; categoryCounts: PeriodGoalie; tgv: TgvResult };
export type GoaliePeriodWeek = MatchupWeek & { poolGoalies: number; officialStarts: number };
export type GoaliePeriodData = {
  method: typeof CATEGORY_COUNTS_LABEL; board: BoardChoice; categories: CategoryId[]; minStarts: number;
  period: Pick<SharePeriod, "kind" | "key" | "label" | "inProgress" | "through" | "gameFrom" | "gameTo"> & { weeks: GoaliePeriodWeek[] };
  /** Ordered by the chosen board's rank, then everyone unranked. `winners` are that board's rank 1, or Best's when both show. */
  rows: GoaliePeriodRow[]; winners: number[];
  /** Mean Yahoo average pick of the goalies shown on each board; null when any Yahoo read failed. */
  adp: PeriodAdp | null;
  ranked: number; unavailableCells: number; reliefOnly: { goalieId: number; name: string | null; weeks: number[] }[];
};

type PeriodShape = Pick<SharePeriod, "kind" | "gameFrom" | "gameTo">;
/** The matchup calendar's real dates decide: a week of exactly 7 days or fewer is a Week, and a longer one, over a break, is a Matchup. */
export const periodNoun = (period: PeriodShape) => period.kind === "month" ? "Month" : period.kind === "season" ? "Season" : period.kind === "custom" ? "Period" : spanDays(period.gameFrom, period.gameTo) > 7 ? "Matchup" : "Week";
const SETTING_NOUN: Record<string, string> = { month: "Month", season: "Season", custom: "Period" };
export const goaliePeriodHeadline = (settings: Pick<GoaliePeriodSettings, "period">, data?: { period: PeriodShape } | null) => `Goalie of the ${data ? periodNoun(data.period) : SETTING_NOUN[settings.period] ?? "Week"}`;
const minStartsFor = (settings: GoaliePeriodSettings, period: Pick<SharePeriod, "kind">) => period.kind === "month" ? settings.minStartsMonth : period.kind === "season" ? settings.minStartsSeason : period.kind === "custom" ? settings.minStartsRange : settings.minStartsWeek;
/** How §3's game and week cells apply to the two views it does not name: no new method, the month's rules on other dates. */
const PERIOD_METHOD: Partial<Record<SharePeriod["kind"], string>> = {
  custom: "Custom range uses Category Counts' month rules. Game cells cover starts dated in the range, each against its own matchup week's baseline, which uses every game in that week through the data's last date, in the range or not. Week cells cover the weeks with most of their days in the range, an even split going to the side with the week's later days, using those goalies' whole-week totals",
  season: "Season to date uses Category Counts' month rules over every matchup week started. Game cells cover every start, each against its own matchup week's baseline, and every started week gives week cells; the week under way counts through the data's last date",
};

const CATEGORY_ID_SET = new Set<string>(CATEGORIES.map(category => category.id));
export const parseCategories = (value: string) => [...new Set(value.split(",").map(part => part.trim()).filter(Boolean))] as CategoryId[];
export function validateGoaliePeriod(settings: GoaliePeriodSettings) {
  if (settings.month && !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(settings.month)) return "Month must look like 2026-10.";
  const range = settings.period === "custom" ? customRangeReason(settings) : null;
  if (range) return range;
  const categories = parseCategories(settings.categories);
  if (!categories.length) return "Choose at least one category.";
  return categories.every(id => CATEGORY_ID_SET.has(id)) ? null : `Categories must come from: ${CATEGORIES.map(category => category.id).join(", ")}.`;
}

const GOALIE_PERIOD_CONTROL: PeriodControl = { mode: "past-only", matchupValue: "week" };
/** The chosen period, or why there is none. A blank choice is the last completed one. */
export function resolvePeriod(settings: Pick<GoaliePeriodSettings, "period" | "week" | "month"> & Partial<Pick<GoaliePeriodSettings, "start" | "end">>, weeks: readonly MatchupWeek[], through: string): { period: SharePeriod } | { reason: string } {
  if (settings.period === "season") return weeks.some(week => week.start <= through) ? { period: seasonPeriod(weeks, through) } : { reason: "No matchup week has started." };
  if (settings.period === "month") {
    const month = settings.month || defaultMonth(weeks, through);
    if (!month) return { reason: "No matchup month has started." };
    const period = monthPeriod(weeks, month, through);
    if (!period.touchedWeeks.length) return { reason: `${month} has no matchup weeks.` };
    return period.gameFrom > through ? { reason: `${month} has not started; data runs through ${through}.` } : { period };
  }
  const { window, reason } = resolvePeriodWindow({ period: settings.period, week: settings.week, start: settings.start ?? null, end: settings.end ?? null }, { weeks: [...weeks], reasons: [] }, { ...GOALIE_PERIOD_CONTROL, cutoff: through });
  if (!window) return { reason };
  return { period: window.week === null ? rangePeriod(weeks, window.from, window.through, through) : weekPeriod(weeks.find(entry => entry.week === window.week)!, through) };
}
/** The dates a period's read must cover: its baselines use every game in every week it touches. */
export const periodReadRange = (period: SharePeriod) => ({
  from: period.touchedWeeks.reduce((first, week) => week.start < first ? week.start : first, period.gameFrom),
  through: [period.touchedWeeks.reduce((last, week) => week.end > last ? week.end : last, period.gameTo), period.through].sort()[0],
});

/** Season start through the period's last assigned week: a card never shows a week later than the one it is about. */
export function tgvSeasonWeeks(weeks: readonly MatchupWeek[], period: Pick<SharePeriod, "cellWeeks"> & Partial<Pick<SharePeriod, "touchedWeeks">>) {
  // A short custom range holds no week's cells, but its line still runs to the week it is in.
  const last = Math.max(...(period.cellWeeks.length ? period.cellWeeks : period.touchedWeeks ?? []).map(week => week.week), -Infinity);
  return weeks.filter(week => week.week <= last);
}
export type TgvRows = { weeks: readonly MatchupWeek[]; goalies: readonly GoalieWeeklyAggregate[]; league: readonly LeagueWeeklyAverage[] };
/** Existing TGV, read through its own functions, week by week. A week with no row, or one its own rule leaves unclassified, has no grade. */
export function tgvSeason(goalieId: number, tgv: TgvRows | null, selected: ReadonlySet<number>): TgvResult {
  if (!tgv) return { label: TGV_LABEL, state: "unavailable", counts: null, points: null, unclassified: 0, series: [] };
  const own = tgv.goalies.filter(entry => entry.goalie_id === goalieId), counts: Record<Ranking, number> = { Elite: 0, Good: 0, Average: 0, Bad: 0, Abysmal: 0 };
  let points = 0, unclassified = 0;
  const series = tgv.weeks.map((week): TgvSeasonWeek => {
    const row = own.find(entry => entry.week === week.week), league = tgv.league.find(entry => entry.week === week.week), base = { week: week.week, selected: selected.has(week.week) };
    if (!row) return { ...base, ranking: null, points: null };
    if (!league || !isGoalieWeekEligible(row)) { unclassified++; return { ...base, ranking: null, points: null }; }
    const grade = calculateWeeklyRanking(row, league, TGV_STAT_KEYS, TGV_STAT_COLUMNS);
    counts[grade.ranking]++; points += grade.points;
    return { ...base, ranking: grade.ranking, points: grade.points };
  });
  return { label: TGV_LABEL, state: "ready", counts, points, unclassified, series };
}

export type YahooAdpGoalieRow = { player_key: string; player_id: string | null; average_pick: string | number | null };
export type GoalieAdpRows = { goalies: readonly YahooAdpGoalieRow[]; map: readonly YahooMapRow[]; averagePicks: readonly (string | number | null)[] };
export type PeriodAdpSide = { kind: "best" | "worst"; average: number; goalies: number; undrafted: number };
export type PeriodAdp = { highestPick: number; undraftedValue: number; sides: PeriodAdpSide[] };
/** Yahoo stores "-" for no pick. Zero, blank and anything else that isn't a positive number is no pick either. */
export function numericPick(value: string | number | null | undefined) {
  const text = String(value ?? "").trim(), pick = /^\d+(\.\d+)?$/.test(text) ? Number(text) : 0;
  return pick > 0 ? pick : null;
}
/** The value an undrafted goalie counts as: the highest pick of any player, rounded up to a multiple of 10. Null when no pick exists, never a guess. */
export function undraftedAdp(picks: readonly (string | number | null)[]) {
  const numeric = picks.flatMap(pick => numericPick(pick) ?? []);
  return numeric.length ? { highestPick: Math.max(...numeric), undraftedValue: Math.ceil(Math.max(...numeric) / 10) * 10 } : null;
}
/** The rows are this Yahoo season's only, and join as Goalie Rescue joins: a Yahoo row with two NHL ids, or an NHL id claimed by two rows, has no match. */
export function goaliePicks(rows: GoalieAdpRows) {
  const nhlIds = new Map<string, Set<number>>();
  for (const row of rows.map) {
    const id = Number(row.nhl_player_id);
    if (row.yahoo_player_id && Number.isSafeInteger(id) && id > 0) nhlIds.set(row.yahoo_player_id, (nhlIds.get(row.yahoo_player_id) ?? new Set()).add(id));
  }
  const claimed = new Map<number, YahooAdpGoalieRow[]>();
  for (const row of rows.goalies) {
    const ids = new Set([...nhlIds.get(row.player_key) ?? [], ...row.player_id ? nhlIds.get(row.player_id) ?? [] : []]);
    if (ids.size === 1) { const [id] = ids; claimed.set(id, [...claimed.get(id) ?? [], row]); }
  }
  return new Map([...claimed].flatMap(([id, owners]) => owners.length === 1 ? [[id, numericPick(owners[0].average_pick)] as const] : []));
}
export function periodAdp(rows: GoalieAdpRows | null, sides: readonly BoardSide<GoaliePeriodRow>[]): PeriodAdp | null {
  const fallback = rows && undraftedAdp(rows.averagePicks);
  if (!rows || !fallback) return null;
  const picks = goaliePicks(rows);
  return { ...fallback, sides: sides.filter(side => side.entries.length).map(side => {
    const shown = side.entries.map(({ row }) => picks.get(row.goalieId) ?? null);
    return { kind: side.kind, goalies: shown.length, undrafted: shown.filter(pick => pick === null).length, average: shown.reduce<number>((total, pick) => total + (pick ?? fallback.undraftedValue), 0) / shown.length };
  }) };
}
const ADP_SIDE = { best: "Best", worst: "Worst" };
export function adpLine(adp: PeriodAdp | null) {
  if (!adp) return "Avg ADP: unavailable";
  return `Avg ADP: ${adp.sides.map(side => `${ADP_SIDE[side.kind]} ${side.average.toFixed(1)}`).join(" · ")}. Counted as undrafted (${adp.undraftedValue}): ${adp.sides.map(side => `${ADP_SIDE[side.kind]} ${side.undrafted} of ${side.goalies}`).join(" · ")}.`;
}

export type GoaliePeriodInput = {
  settings: GoaliePeriodSettings; period: SharePeriod; appearances: readonly GoalieAppearance[]; reported: readonly CompletedTeamGame[]; scheduled: readonly ScheduledGame[];
  /** Null when the existing method's views could not be read; it then reads as unavailable and never as a Category Counts value. */
  tgv: TgvRows | null;
  /** Null when a Yahoo read failed: unread is unknown, so no goalie counts as undrafted. */
  adp: GoalieAdpRows | null;
};
/** The same period ending at `through`: a week or month says "through <date>", a custom range keeps its label and stops counting there. */
function periodThrough(period: SharePeriod, through: string): SharePeriod {
  if (period.kind === "week") return weekPeriod(period.cellWeeks[0], through);
  if (period.kind === "month") return monthPeriod(period.touchedWeeks, period.key, through);
  if (period.kind === "season") return seasonPeriod(period.touchedWeeks, through);
  return { ...period, through, inProgress: true };
}
/** A late newest night ends the period at the last complete one, with a page note; an older gap still makes it partial. */
export function buildGoaliePeriod(input: GoaliePeriodInput): SharePostLoadResult<GoaliePeriodData> {
  const cut = completeThrough(scheduleNights(input.scheduled, input.reported), input.period.through);
  if (!cut.trimmed.length) return buildPeriodResult(input);
  if (!cut.through) return { ...buildPeriodResult(input), state: "missing", reasons: [`No night in ${input.period.label} is fully reported yet.`], data: null };
  const result = buildPeriodResult({ ...input, period: periodThrough(input.period, cut.through), appearances: datedThrough(input.appearances, cut.through), reported: datedThrough(input.reported, cut.through), scheduled: datedThrough(input.scheduled, cut.through) });
  return { ...result, pageNotes: [completeThroughNote(cut)!] };
}
function buildPeriodResult(input: GoaliePeriodInput): SharePostLoadResult<GoaliePeriodData> {
  const { settings, period } = input, categories = parseCategories(settings.categories);
  const schedule = reconcileSchedule(input.scheduled, input.reported);
  const unresolved = [...new Set(schedule.games.map(game => game.team))].flatMap(team => teamStartShare(team, schedule.games, input.appearances, null).unresolvedGames.map(gameId => `${team}:${gameId}`));
  const { ledgers, unassigned } = buildWeekLedgers(period.touchedWeeks, input.appearances, categories);
  const minStarts = minStartsFor(settings, period), board = boardChoice(settings.board);
  const goalies = rankPeriodGoalies(periodGoalies(ledgers, period, categories), minStarts);
  const selectedWeeks = new Set(period.cellWeeks.map(week => week.week));
  const boardRank = (row: PeriodGoalie) => board === "worst" ? row.worstRank : row.rank;
  const rows = goalies.filter(row => row.starts > 0).sort((a, b) => (boardRank(a) ?? Infinity) - (boardRank(b) ?? Infinity) || b.starts - a.starts || a.goalieId - b.goalieId)
    .map((row): GoaliePeriodRow => ({ goalieId: row.goalieId, name: row.name, teams: row.teams, categoryCounts: row,
      tgv: tgvSeason(row.goalieId, input.tgv, selectedWeeks) }));
  const ranked = rows.filter(row => row.categoryCounts.rank !== null);
  const { sides } = boardSides(rows, goaliePeriodRanks, board), shownTeams = sides.flatMap(side => side.entries.map(({ row }) => row.teams[row.teams.length - 1]));
  const adp = periodAdp(input.adp, sides);
  const reasons = [
    ...schedule.missing ? [`${schedule.missing} of ${schedule.expected} scheduled team games in this period's weeks have no reported result.`] : [],
    ...unresolved.length ? [`Team games in this period's weeks lacking exactly one labeled starter: ${unresolved.length}.`] : [],
    ...unassigned ? [`Goalie appearances outside every matchup week: ${unassigned}.`] : [],
    ...input.tgv ? [] : [`${TGV_LABEL} could not be read.`],
    ...adp ? [] : ["Average draft position could not be read."],
  ];
  const asOf = input.appearances.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null);
  const weeks = period.cellWeeks.map(week => { const ledger = ledgers.find(entry => entry.week.week === week.week)!; return { ...week, poolGoalies: ledger.poolGoalies, officialStarts: ledger.officialStarts }; });
  const relieved = goalies.filter(row => row.reliefOnlyWeeks.length);
  const state = reasons.length ? "partial" : "ready";
  return {
    state, reasons, teams: [...new Set(shownTeams)].filter(team => team in teamsInfo),
    data: {
      method: CATEGORY_COUNTS_LABEL, board, categories, minStarts,
      period: { kind: period.kind, key: period.key, label: period.label, inProgress: period.inProgress, through: period.through, gameFrom: period.gameFrom, gameTo: period.gameTo, weeks },
      rows, winners: ranked.filter(row => boardRank(row.categoryCounts) === 1).map(row => row.goalieId), ranked: ranked.length, adp,
      unavailableCells: goalies.reduce((total, row) => total + row.game.unavailable + row.week.unavailable, 0),
      reliefOnly: relieved.map(row => ({ goalieId: row.goalieId, name: row.name, weeks: row.reliefOnlyWeeks })),
    },
    evidence: {
      sources: [
        { name: "NHL.com goalie game stats", tables: ["wgo_goalie_stats"], state: unresolved.length ? "partial" : "ready", asOf, updatedAt: null },
        { name: "NHL.com team game stats", tables: ["wgo_team_stats", "games"], state: schedule.missing ? "partial" : "ready", asOf: schedule.games.reduce<string | null>((latest, game) => !latest || game.date > latest ? game.date : latest, null), updatedAt: null },
        { name: "Yahoo matchup weeks", tables: ["yahoo_matchup_weeks"], state: "ready", asOf: null, updatedAt: null },
        { name: `${TGV_LABEL} views`, tables: ["goalie_weekly_aggregates", "league_weekly_goalie_averages"], state: input.tgv ? "ready" : "missing", asOf: null, updatedAt: null },
        { name: "Yahoo average pick", tables: ["yahoo_players", "yahoo_nhl_player_map_read"], state: adp ? "ready" : "missing", asOf: null, updatedAt: null },
      ],
      sample: `${period.label}: ${countOf(ledgers.reduce((total, ledger) => total + ledger.officialStarts, 0), "official start")} in the ${countOf(ledgers.length, "matchup week")} used. ${weeks.map(week => `Week ${week.week}: ${countOf(week.poolGoalies, "goalie")}, ${countOf(week.officialStarts, "start")}`).join("; ")}. Comparisons not available: ${goalies.reduce((total, row) => total + row.game.unavailable + row.week.unavailable, 0)}. Relief-only goalies, not compared: ${relieved.length}. Avg ADP is the mean of Yahoo's average pick for the goalies shown, from this season's Yahoo row only. An undrafted goalie, or one with no numeric pick, 0, "-", null or no Yahoo match, counts as the highest average pick of any player in yahoo_players, in any season, rounded up to the next 10${adp ? `: ${adp.highestPick} gives ${adp.undraftedValue}` : ""}`,
      strength: "All situations",
      cohort: `${countOf(ranked.length, "goalie")} with at least ${countOf(minStarts, "official start")}; baselines use every goalie with a start, week by week. Ranked by ${CATEGORY_COUNTS_LABEL}: games net (better minus worse results), then week net, then share better; equal goalies share a rank; lower GAA counts as better. ${TGV_LABEL} is a separate method, not applied to ${CATEGORY_COUNTS_LABEL}; Average cannot occur with its three default stats${PERIOD_METHOD[period.kind] ? `. ${PERIOD_METHOD[period.kind]}` : ""}`,
      coverage: { observed: schedule.observed, expected: schedule.expected, missing: schedule.missing, unit: "team games" },
    },
  };
}

export const goaliePeriodRanks = { id: (row: GoaliePeriodRow) => row.goalieId, best: (row: GoaliePeriodRow) => row.categoryCounts.rank, worst: (row: GoaliePeriodRow) => row.categoryCounts.worstRank };
const exactCounts = (counts: CellCounts) => `${counts.above} above, ${counts.below} below, ${counts.tied} tied`;
const tgvAlt = (tgv: TgvResult) => tgv.counts ? `${tgv.label}: ${TGV_GRADES.map(grade => `${grade} ${tgv.counts![grade]}`).join(", ")}, ${tgv.points} points.` : `${tgv.label}: unavailable.`;

export const goaliePeriodModule = defineShareModule<GoaliePeriodSettings, GoaliePeriodData>({
  id: "goalie-period", title: "Goalie of the Period", headline: goaliePeriodHeadline, summary: "Goalie of the Week or Month, Best and Worst, by how often each goalie beat the league average category by category, beside existing TGV grades.", group: "goalies", basis: "observed",
  fields: [
    ...periodWindowFields({ mode: GOALIE_PERIOD_CONTROL.mode, default: "week", options: [{ value: "week", label: "Matchup week" }, { value: "month", label: "Calendar month" }, { value: "custom", label: "Custom range" }, { value: "season", label: "Season to date" }] }),
    { id: "month", label: "Month (YYYY-MM)", blank: "the last completed", kind: "text", default: "", maxLength: 7, onlyForPeriod: "month" },
    { id: "minStartsWeek", label: "Min starts, week", kind: "number", default: 2, min: 1, max: 7, step: 1 },
    { id: "minStartsMonth", label: "Min starts, month", kind: "number", default: 5, min: 1, max: 20, step: 1 },
    { id: "minStartsRange", label: "Min starts, custom range", kind: "number", default: 2, min: 1, max: 82, step: 1 },
    { id: "minStartsSeason", label: "Min starts, season", kind: "number", default: 1, min: 1, max: 82, step: 1 },
    { id: "board", label: "Board", kind: "select", default: "both", options: BOARD_FIELD_OPTIONS },
    { id: "categories", label: "Categories", kind: "text", default: DEFAULT_CATEGORY_IDS.join(","), maxLength: 80, choices: CATEGORIES.map(category => ({ value: category.id, label: category.label })) },
  ],
  periodControl: GOALIE_PERIOD_CONTROL,
  validate: validateGoaliePeriod,
  load: () => import("./goaliePeriod.sources").then(sources => sources.loadGoaliePeriod),
  card: () => import("components/SocialShare/modules/GoaliePeriodCard").then(card => card.default),
  hasRows: data => data.ranked > 0,
  altText: (snapshot, data) => `FHFH goalies, ${data.period.label}, by ${CATEGORY_COUNTS_LABEL}. ${boardSides(data.rows, goaliePeriodRanks, data.board).sides.map(side => `${side.kind === "best" ? "Best" : "Worst"}: ${side.entries.map(({ row, rank }) => `${rank}. ${row.name ?? row.goalieId}: ${countOf(row.categoryCounts.starts, "start")}, game cells ${row.categoryCounts.game.better} better, ${row.categoryCounts.game.worse} worse, ${row.categoryCounts.game.tied} tied. ${row.categoryCounts.byCategory.map(entry => `${categoryById(entry.category).label}: games ${exactCounts(entry.game)}; weeks ${exactCounts(entry.week)}`).join("; ")}. ${tgvAlt(row.tgv)}`).join(" ")}`).join(" ")} ${adpLine(data.adp)} Not a forecast. ${snapshot.evidence.sample}.`,
});
