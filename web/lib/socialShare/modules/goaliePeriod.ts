import { calculateWeeklyRanking, isGoalieWeekEligible } from "components/GoaliePage/goalieCalculations";
import type { GoalieWeeklyAggregate, LeagueWeeklyAverage, NumericGoalieStatKey, Ranking, StatColumn } from "components/GoaliePage/goalieTypes";
import { defineShareModule, type SharePostLoadResult } from "./contract";
import { reconcileSchedule, type ScheduledGame } from "./creaseShift";
import { buildWeekLedgers, CATEGORIES, categoryById, CATEGORY_COUNTS_LABEL, DEFAULT_CATEGORY_IDS, defaultMonth, defaultWeek, monthPeriod, periodGoalies, rankPeriodGoalies, weekPeriod, type CategoryId, type CellCounts, type MatchupWeek, type PeriodGoalie, type SharePeriod } from "./shared/categoryCounts";
import { teamStartShare, type CompletedTeamGame, type GoalieAppearance } from "./shared/goalieLedger";

/** Goalie of the Week and Month, with best and worst (SS 9.0), by Category Counts. TGV grades sit beside it under their own label. */
export type GoaliePeriodSettings = { period: string; week: number | null; month: string; minStartsWeek: number; minStartsMonth: number; board: string; categories: string };
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
  method: typeof CATEGORY_COUNTS_LABEL; board: "best" | "worst"; categories: CategoryId[]; minStarts: number;
  period: Pick<SharePeriod, "kind" | "key" | "label" | "inProgress" | "through" | "gameFrom" | "gameTo"> & { weeks: GoaliePeriodWeek[] };
  /** Best or worst, ordered by that board's rank, then everyone unranked. */
  rows: GoaliePeriodRow[]; winners: number[];
  ranked: number; unavailableCells: number; reliefOnly: { goalieId: number; name: string | null; weeks: number[] }[];
};

const CATEGORY_ID_SET = new Set<string>(CATEGORIES.map(category => category.id));
export const parseCategories = (value: string) => [...new Set(value.split(",").map(part => part.trim()).filter(Boolean))] as CategoryId[];
export function validateGoaliePeriod(settings: GoaliePeriodSettings) {
  if (settings.month && !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(settings.month)) return "Month must look like 2026-10.";
  const categories = parseCategories(settings.categories);
  if (!categories.length) return "Choose at least one category.";
  return categories.every(id => CATEGORY_ID_SET.has(id)) ? null : `Categories must come from: ${CATEGORIES.map(category => category.id).join(", ")}.`;
}

/** The chosen period, or why there is none. A blank choice is the last completed one. */
export function resolvePeriod(settings: Pick<GoaliePeriodSettings, "period" | "week" | "month">, weeks: readonly MatchupWeek[], through: string): { period: SharePeriod } | { reason: string } {
  if (settings.period === "month") {
    const month = settings.month || defaultMonth(weeks, through);
    if (!month) return { reason: "No matchup month has started." };
    const period = monthPeriod(weeks, month, through);
    if (!period.touchedWeeks.length) return { reason: `${month} has no matchup weeks.` };
    return period.gameFrom > through ? { reason: `${month} has not started; data runs through ${through}.` } : { period };
  }
  const week = settings.week === null ? defaultWeek(weeks, through) : weeks.find(entry => entry.week === settings.week) ?? null;
  if (!week) return { reason: settings.week === null ? "No matchup week has started." : `Week ${settings.week} is not on the matchup calendar.` };
  return week.start > through ? { reason: `Week ${week.week} has not started; data runs through ${through}.` } : { period: weekPeriod(week, through) };
}
/** The dates a period's read must cover: its baselines use every game in every week it touches. */
export const periodReadRange = (period: SharePeriod) => ({
  from: period.touchedWeeks.reduce((first, week) => week.start < first ? week.start : first, period.gameFrom),
  through: [period.touchedWeeks.reduce((last, week) => week.end > last ? week.end : last, period.gameTo), period.through].sort()[0],
});

/** Season start through the period's last assigned week: a card never shows a week later than the one it is about. */
export function tgvSeasonWeeks(weeks: readonly MatchupWeek[], period: Pick<SharePeriod, "cellWeeks">) {
  const last = Math.max(...period.cellWeeks.map(week => week.week), -Infinity);
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

export type GoaliePeriodInput = {
  settings: GoaliePeriodSettings; period: SharePeriod; appearances: readonly GoalieAppearance[]; reported: readonly CompletedTeamGame[]; scheduled: readonly ScheduledGame[];
  /** Null when the existing method's views could not be read; it then reads as unavailable and never as a Category Counts value. */
  tgv: TgvRows | null;
};
export function buildGoaliePeriod(input: GoaliePeriodInput): SharePostLoadResult<GoaliePeriodData> {
  const { settings, period } = input, categories = parseCategories(settings.categories);
  const schedule = reconcileSchedule(input.scheduled, input.reported);
  const unresolved = [...new Set(schedule.games.map(game => game.team))].flatMap(team => teamStartShare(team, schedule.games, input.appearances, null).unresolvedGames.map(gameId => `${team}:${gameId}`));
  const { ledgers, unassigned } = buildWeekLedgers(period.touchedWeeks, input.appearances, categories);
  const minStarts = period.kind === "month" ? settings.minStartsMonth : settings.minStartsWeek, board = settings.board === "worst" ? "worst" : "best";
  const goalies = rankPeriodGoalies(periodGoalies(ledgers, period, categories), minStarts);
  const selectedWeeks = new Set(period.cellWeeks.map(week => week.week));
  const boardRank = (row: PeriodGoalie) => board === "worst" ? row.worstRank : row.rank;
  const rows = goalies.filter(row => row.starts > 0).sort((a, b) => (boardRank(a) ?? Infinity) - (boardRank(b) ?? Infinity) || b.starts - a.starts || a.goalieId - b.goalieId)
    .map((row): GoaliePeriodRow => ({ goalieId: row.goalieId, name: row.name, teams: row.teams, categoryCounts: row,
      tgv: tgvSeason(row.goalieId, input.tgv, selectedWeeks) }));
  const ranked = rows.filter(row => boardRank(row.categoryCounts) !== null);
  const reasons = [
    ...schedule.missing ? [`${schedule.missing} of ${schedule.expected} scheduled team games in this period's weeks have no reported result.`] : [],
    ...unresolved.length ? [`Team games in this period's weeks lacking exactly one labeled starter: ${unresolved.length}.`] : [],
    ...unassigned ? [`Goalie appearances outside every matchup week: ${unassigned}.`] : [],
    ...input.tgv ? [] : [`${TGV_LABEL} could not be read.`],
  ];
  const asOf = input.appearances.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null);
  const weeks = period.cellWeeks.map(week => { const ledger = ledgers.find(entry => entry.week.week === week.week)!; return { ...week, poolGoalies: ledger.poolGoalies, officialStarts: ledger.officialStarts }; });
  const relieved = goalies.filter(row => row.reliefOnlyWeeks.length);
  const state = reasons.length ? "partial" : "ready";
  return {
    state, reasons,
    data: {
      method: CATEGORY_COUNTS_LABEL, board, categories, minStarts,
      period: { kind: period.kind, key: period.key, label: period.label, inProgress: period.inProgress, through: period.through, gameFrom: period.gameFrom, gameTo: period.gameTo, weeks },
      rows, winners: ranked.filter(row => boardRank(row.categoryCounts) === 1).map(row => row.goalieId), ranked: ranked.length,
      unavailableCells: goalies.reduce((total, row) => total + row.game.unavailable + row.week.unavailable, 0),
      reliefOnly: relieved.map(row => ({ goalieId: row.goalieId, name: row.name, weeks: row.reliefOnlyWeeks })),
    },
    evidence: {
      sources: [
        { name: "NHL.com goalie game stats", tables: ["wgo_goalie_stats"], state: unresolved.length ? "partial" : "ready", asOf, updatedAt: null },
        { name: "NHL.com team game stats", tables: ["wgo_team_stats", "games"], state: schedule.missing ? "partial" : "ready", asOf: schedule.games.reduce<string | null>((latest, game) => !latest || game.date > latest ? game.date : latest, null), updatedAt: null },
        { name: "Yahoo matchup weeks", tables: ["yahoo_matchup_weeks"], state: "ready", asOf: null, updatedAt: null },
        { name: `${TGV_LABEL} views`, tables: ["goalie_weekly_aggregates", "league_weekly_goalie_averages"], state: input.tgv ? "ready" : "missing", asOf: null, updatedAt: null },
      ],
      sample: `${period.label}: ${ledgers.reduce((total, ledger) => total + ledger.officialStarts, 0)} official starts in the ${ledgers.length} matchup week${ledgers.length === 1 ? "" : "s"} used`,
      strength: "All situations", cohort: `${ranked.length} goalies with at least ${minStarts} official starts; baselines use every goalie with a start, week by week`,
      coverage: { observed: schedule.observed, expected: schedule.expected, missing: schedule.missing, unit: "team games" },
    },
  };
}

/** Goalies shown on the card; the rest stay in the snapshot and are counted on it. */
export const GOALIE_PERIOD_SHOWN = 6;
const exactCounts = (counts: CellCounts) => `${counts.above} above, ${counts.below} below, ${counts.tied} tied`;
const tgvAlt = (tgv: TgvResult) => tgv.counts ? `${tgv.label}: ${TGV_GRADES.map(grade => `${grade} ${tgv.counts![grade]}`).join(", ")}, ${tgv.points} points.` : `${tgv.label}: unavailable.`;
const boardRankOf = (data: GoaliePeriodData, row: GoaliePeriodRow) => data.board === "worst" ? row.categoryCounts.worstRank : row.categoryCounts.rank;

export const goaliePeriodModule = defineShareModule<GoaliePeriodSettings, GoaliePeriodData>({
  id: "goalie-period", title: "Goalie of the Period", summary: "Goalie of the Week or Month, best or worst, by per-category counts above, below and tied with the league, beside existing TGV grades.", group: "goalies", basis: "observed",
  fields: [
    { id: "period", label: "Period", kind: "select", default: "week", options: [{ value: "week", label: "Matchup week" }, { value: "month", label: "Calendar month" }] },
    { id: "week", label: "Week (blank is the last completed)", kind: "number", default: null, min: 1, max: 30, step: 1 },
    { id: "month", label: "Month, YYYY-MM (blank is the last completed)", kind: "text", default: "", maxLength: 7 },
    { id: "minStartsWeek", label: "Min starts, week", kind: "number", default: 2, min: 1, max: 7, step: 1 },
    { id: "minStartsMonth", label: "Min starts, month", kind: "number", default: 5, min: 1, max: 20, step: 1 },
    { id: "board", label: "Board", kind: "select", default: "best", options: [{ value: "best", label: "Best" }, { value: "worst", label: "Worst" }] },
    { id: "categories", label: "Categories", kind: "text", default: DEFAULT_CATEGORY_IDS.join(","), maxLength: 80 },
  ],
  validate: validateGoaliePeriod,
  load: () => import("./goaliePeriod.sources").then(sources => sources.loadGoaliePeriod),
  card: () => import("components/SocialShare/modules/GoaliePeriodCard").then(card => card.default),
  hasRows: data => data.ranked > 0,
  altText: (snapshot, data) => `FHFH ${data.board} goalies, ${data.period.label}, by ${CATEGORY_COUNTS_LABEL}. ${data.rows.filter(row => boardRankOf(data, row) !== null).slice(0, GOALIE_PERIOD_SHOWN).map(row => `${boardRankOf(data, row)}. ${row.name ?? row.goalieId}: ${row.categoryCounts.starts} starts, game cells ${row.categoryCounts.game.better} better, ${row.categoryCounts.game.worse} worse, ${row.categoryCounts.game.tied} tied. ${row.categoryCounts.byCategory.map(entry => `${categoryById(entry.category).label}: games ${exactCounts(entry.game)}; weeks ${exactCounts(entry.week)}`).join("; ")}. ${tgvAlt(row.tgv)}`).join(" ")} Not a forecast. ${snapshot.evidence.sample}.`,
});
