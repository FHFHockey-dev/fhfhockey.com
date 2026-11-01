import { calculateRankingResult } from "utils/calculatePercentiles";
import { belowTheCard, perGame, shownTeams, skaterCategoryTotal, skaterIdentity, skaterSeasonEvidence, type SkaterIdentity, type SkaterSeason } from "./bshBoard";
import { defineShareModule, shareSettingsKey, type SharePostLoadResult, type ShareSettingField } from "./contract";
import { defaultWeek } from "./shared/categoryCounts";
import { competitionRanks } from "./shared/definitions";
import { customRangeReason, matchupLabel, periodWindowFields, type OwnPeriod, type PeriodControl, type PeriodWindow } from "./shared/periodWindow";
import { appearancesByPlayer, type SkaterAppearance } from "./shared/skaterAppearances";
import { shiftDays } from "./teamGames";

/** WGO's game row with the one column the shared appearance type does not carry. A null is missing, never zero. */
export type MultiCatGame = SkaterAppearance & { plusMinus: number | null };
export type MultiCatSeason = Omit<SkaterSeason, "appearances"> & { appearances: readonly MultiCatGame[] };
export type MultiCatBasis = "total" | "perGame";
export type MultiCatFormula = "standard" | "pointsFirst";
export type MultiCatSettings = { basis: MultiCatBasis; formula: MultiCatFormula; period: string; week: number | null; start: string | null; end: string | null };

/** Spoke order and categories of Wigo's Category percentiles radar (CategoryCoverageChart), clockwise from the top. */
export const MULTI_CAT_CATEGORIES = [
  { id: "goals", label: "G", pick: (row: MultiCatGame) => row.goals },
  { id: "assists", label: "A", pick: (row: MultiCatGame) => row.assists },
  { id: "ppPoints", label: "PPP", pick: (row: MultiCatGame) => row.ppPoints },
  { id: "shots", label: "SOG", pick: (row: MultiCatGame) => row.shots },
  { id: "plusMinus", label: "+/-", pick: (row: MultiCatGame) => row.plusMinus },
  { id: "penaltyMinutes", label: "PIM", pick: (row: MultiCatGame) => row.penaltyMinutes },
  { id: "blocks", label: "BLK", pick: (row: MultiCatGame) => row.blocks },
  { id: "hits", label: "HIT", pick: (row: MultiCatGame) => row.hits },
] as const;
export type MultiCatCategoryId = typeof MULTI_CAT_CATEGORIES[number]["id"];
/** A 2 by 2 board: the body holds four panels with a radar large enough to read. Skaters below are counted on the card. */
export const MULTI_CAT_ROWS = 4;
const MIN_GP: Record<MultiCatBasis, number> = { perGame: 2, total: 1 };
const POINTS_WEIGHT: Record<MultiCatFormula, number> = { standard: 1, pointsFirst: 2 };
export const multiCatMinGp = (basis: MultiCatBasis) => MIN_GP[basis];
export const multiCatFormulaLabel = (formula: MultiCatFormula) => `${formula === "pointsFirst" ? "2 x PTS" : "PTS"} + BLK + SOG + HIT`;

export const MULTI_CAT_CURRENT = "current";
export const MULTI_CAT_CONTROL: PeriodControl = { mode: "past-only" };
/** The matchup week holding the cutoff, so a Monday post shows the week just ended; past the last week, the last one completed. */
export const MULTI_CAT_OWN: Record<string, OwnPeriod> = {
  [MULTI_CAT_CURRENT]: (cutoff, { weeks }) => {
    const week = weeks.find(entry => entry.start <= cutoff && entry.end >= cutoff) ?? defaultWeek(weeks, cutoff);
    return week ? { from: week.start, through: week.end, label: matchupLabel(week) } : { reason: "No matchup week has started." };
  },
};
const FIELDS: readonly ShareSettingField[] = [
  ...periodWindowFields({ mode: MULTI_CAT_CONTROL.mode, default: MULTI_CAT_CURRENT, options: [{ value: MULTI_CAT_CURRENT, label: "Current fantasy week" }, { value: "matchup", label: "Matchup week" }, { value: "custom", label: "Custom range" }] }),
  { id: "basis", label: "Ranking", kind: "select", default: "total", options: [{ value: "total", label: "Period Total" }, { value: "perGame", label: "Per Game (min 2 GP)" }] },
  { id: "formula", label: "Formula", kind: "select", default: "standard", options: [{ value: "standard", label: "Standard: PTS + BLK + SOG + HIT" }, { value: "pointsFirst", label: "Points-First: 2 x PTS + BLK + SOG + HIT" }] },
];
export const validateMultiCat = (settings: MultiCatSettings) => settings.period === "custom" ? customRangeReason(settings) : null;

type PeriodShape = Pick<PeriodWindow, "kind" | "days">;
/** What one matchup is called: a Week, or a Matchup when it runs longer over a break. A custom range is neither. */
export const multiCatNoun = ({ kind, days }: PeriodShape) => kind === "custom" ? null : days > 7 ? "Matchup" : "Week";
export function multiCatHeadline(settings: MultiCatSettings, data?: MultiCatData | null) {
  const name = `Top ${settings.formula === "pointsFirst" ? "Points-First" : "Multi-Cat"} Stars`;
  if (settings.basis === "perGame") return `${name} Per Game`;
  const noun = multiCatNoun(data && multiCatCurrent(data, settings) ? data.period : { kind: settings.period, days: 7 });
  return noun ? `${name} of the ${noun}` : name;
}

export type MultiCatScoreParts = { games: number; points: number | null; blocks: number | null; shots: number | null; hits: number | null };
/** Any missing component in any game makes the score unknown, never a smaller total. */
export function multiCatScore(parts: MultiCatScoreParts, settings: MultiCatSettings): number | null {
  if (parts.points === null || parts.blocks === null || parts.shots === null || parts.hits === null) return null;
  const total = POINTS_WEIGHT[settings.formula] * parts.points + parts.blocks + parts.shots + parts.hits;
  return settings.basis === "perGame" ? perGame(total, parts.games) : total;
}
const scoreParts = (rows: readonly MultiCatGame[]): MultiCatScoreParts => ({ games: rows.length, points: skaterCategoryTotal(rows, row => row.points), blocks: skaterCategoryTotal(rows, row => row.blocks), shots: skaterCategoryTotal(rows, row => row.shots), hits: skaterCategoryTotal(rows, row => row.hits) });
const categoryTotal = (rows: readonly MultiCatGame[], pick: (row: MultiCatGame) => number | null) => rows.some(row => pick(row) === null) ? null : rows.reduce((total, row) => total + pick(row)!, 0);

export type MultiCatPercentile = { id: MultiCatCategoryId; label: string; percentile: number | null };
/**
 * Wigo's method: each skater's season per-game average, then calculateRankingResult with higher as better on every
 * category, PIM included ((below + half of equal) / cohort). Each category's cohort is every skater known in it, and a
 * skater with a missing game in a category has no percentile there, rather than a low one.
 */
export function multiCatPercentiles(players: ReadonlyMap<number, readonly MultiCatGame[]>) {
  const pools = new Map(MULTI_CAT_CATEGORIES.map(category => [category.id, [...players].flatMap(([player_id, rows]) => {
    const total = categoryTotal(rows, category.pick);
    return total === null ? [] : [{ player_id, value: total / rows.length }];
  })]));
  return (playerId: number): MultiCatPercentile[] => MULTI_CAT_CATEGORIES.map(({ id, label }) => {
    const result = calculateRankingResult(pools.get(id)!, playerId, true);
    return { id, label, percentile: result ? result.percentile * 100 : null };
  });
}

/** A closed shape needs every spoke. With a gap, only neighbouring known spokes join, so a missing value never reads as zero. */
export function radarRuns(values: readonly (number | null)[]): { closed: boolean; runs: number[][] } {
  if (values.every(value => value !== null)) return { closed: true, runs: [values.map((_, index) => index)] };
  const gap = values.findIndex(value => value === null), runs: number[][] = [];
  let run: number[] = [];
  for (let step = 1; step <= values.length; step++) {
    const index = (gap + step) % values.length;
    if (values[index] !== null) run.push(index);
    else if (run.length) { runs.push(run); run = []; }
  }
  return { closed: false, runs };
}

export type MultiCatTable = { games: number; values: { id: MultiCatCategoryId; label: string; total: number | null }[] };
export type MultiCatRow = SkaterIdentity & { rank: number; score: number; ranked: MultiCatScoreParts; radar: MultiCatPercentile[]; table: MultiCatTable };
export type MultiCatData = {
  /** `through` is the last date read: the period's end, or the cutoff while it is under way. It also ends the radar's season. */
  applied: string; through: string; period: PeriodShape & { label: string; from: string; to: string };
  /** The current fantasy week keeps the last 7 days; a chosen matchup or range shows the ranking's own dates. */
  tableWindow: "last7" | "period"; tableFrom: string; tableTo: string;
  basis: MultiCatBasis; formula: MultiCatFormula; minGp: number; rows: MultiCatRow[];
  cohort: { percentile: number; periodSkaters: number; belowMinGp: number; missingComponent: number; ranked: number };
  notShown: number; tiedBeyondCut: number;
};

/** Ranks the period; the radar reads the season through its last date. Equal scores share a rank (1, 2, 2, 4). */
export function buildMultiCatStars(season: MultiCatSeason, settings: MultiCatSettings, window: PeriodWindow): SharePostLoadResult<MultiCatData> {
  const through = window.through < season.through ? window.through : season.through, minGp = multiCatMinGp(settings.basis);
  const tableWindow = settings.period === MULTI_CAT_CURRENT ? "last7" as const : "period" as const;
  const tableFrom = tableWindow === "last7" ? shiftDays(through, -6) : window.from;
  const players = appearancesByPlayer(season.appearances.filter(row => row.date <= through)) as Map<number, MultiCatGame[]>;
  const percentiles = multiCatPercentiles(players);
  let periodSkaters = 0, belowMinGp = 0, missingComponent = 0;
  const candidates = [...players].flatMap(([playerId, rows]) => {
    const inPeriod = rows.filter(row => row.date >= window.from);
    if (!inPeriod.length) return [];
    periodSkaters++;
    if (inPeriod.length < minGp) { belowMinGp++; return []; }
    const parts = scoreParts(inPeriod), score = multiCatScore(parts, settings);
    if (score === null) { missingComponent++; return []; }
    return [{ playerId, rows, inPeriod, parts, score }];
  });
  const ranked = competitionRanks(candidates, entry => entry.score, entry => entry.playerId);
  const rows: MultiCatRow[] = ranked.slice(0, MULTI_CAT_ROWS).map(({ row: { playerId, rows: games, inPeriod, parts, score }, rank }) => {
    const table = games.filter(row => row.date >= tableFrom);
    return { ...skaterIdentity(inPeriod), rank, score, ranked: parts, radar: percentiles(playerId), table: { games: table.length, values: MULTI_CAT_CATEGORIES.map(({ id, label, pick }) => ({ id, label, total: categoryTotal(table, pick) })) } };
  });
  const lastRank = rows[rows.length - 1]?.rank, notShown = ranked.length - rows.length, tiedBeyondCut = ranked.slice(rows.length).filter(entry => entry.rank === lastRank).length;
  const excluded = [belowMinGp ? `${belowMinGp} under ${minGp} GP` : "", missingComponent ? `${missingComponent} unranked for a missing component` : "", belowTheCard(notShown, tiedBeyondCut)].filter(Boolean).join(", ");
  const cohortLine = `Ranking: ${periodSkaters} skaters played in the period, ${ranked.length} ranked${excluded ? `, ${excluded}` : ""}. Radar: ${players.size} skaters with 1+ season GP.`;
  return {
    ...skaterSeasonEvidence(season, { windowLabel: `ranking ${window.from} to ${window.through}, table ${tableFrom} to ${through}, radar season through ${through}`, cohort: cohortLine, note: `Ranked by ${multiCatFormulaLabel(settings.formula)}, ${settings.basis === "perGame" ? `per game, min ${minGp} GP` : "period total"}. Equal scores share a rank. Radar is each skater's season per-game percentile through the period's last date, higher is better on every spoke, PIM included.`, extraSources: [{ name: "Yahoo matchup weeks", tables: ["yahoo_matchup_weeks"], state: "ready", asOf: null, updatedAt: null }] }),
    data: { applied: shareSettingsKey(FIELDS, settings), through, period: { kind: window.kind, days: window.days, label: window.label.replace(/^Week /, "fantasy week "), from: window.from, to: window.through }, tableWindow, tableFrom, tableTo: through, basis: settings.basis, formula: settings.formula, minGp, rows, cohort: { percentile: players.size, periodSkaters, belowMinGp, missingComponent, ranked: ranked.length }, notShown, tiedBeyondCut },
    teams: shownTeams(rows),
  };
}
export const multiCatCurrent = (data: MultiCatData, settings: MultiCatSettings) => data.applied === shareSettingsKey(FIELDS, settings);

const missingText = (value: number | null, text = String(value)) => value === null ? "missing" : text;
export const multiCatScoreText = (score: number, basis: MultiCatBasis) => basis === "perGame" ? score.toFixed(2) : String(score);
export const multiCatStarsModule = defineShareModule<MultiCatSettings, MultiCatData>({
  id: "multi-cat-stars", title: "Top Multi-Cat Stars of the Week", summary: "The fantasy week's, or chosen dates', top skaters by points, blocks, shots and hits, each with a season percentile radar and a stats table.", group: "skaters", basis: "observed",
  headline: multiCatHeadline,
  suggestedUse: "Works for a weekend or Monday recap of the fantasy week; choose it on any day.",
  fields: FIELDS,
  periodControl: MULTI_CAT_CONTROL,
  validate: validateMultiCat,
  load: () => import("./multiCatStars.sources").then(sources => sources.loadMultiCatStars),
  card: () => import("components/SocialShare/modules/MultiCatStarsCard").then(card => card.default),
  hasRows: (data, settings) => data.rows.length > 0 && multiCatCurrent(data, settings),
  altText: (snapshot, data, settings) => `FHFH ${multiCatHeadline(settings, data)}, ranked ${data.period.from} to ${data.period.to} through ${data.through}, ${multiCatFormulaLabel(data.formula)}. ${data.rows.map(row => `${row.rank}. ${row.name}: ${multiCatScoreText(row.score, data.basis)} in ${row.ranked.games} ranked GP. ${data.tableWindow === "last7" ? "Last 7 days" : "Same dates"}, ${data.tableFrom} to ${data.tableTo}, ${row.table.games} GP: ${row.table.values.map(value => `${value.label} ${missingText(value.total)}`).join(", ")}. Season percentile through ${data.through}: ${row.radar.map(spoke => `${spoke.label} ${missingText(spoke.percentile, spoke.percentile?.toFixed(0))}`).join(", ")}`).join(". ")}. ${snapshot.evidence.cohort}`,
});
