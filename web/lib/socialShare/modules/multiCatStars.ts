import { calculateRankingResult } from "utils/calculatePercentiles";
import { calendarWeekStart } from "lib/socialShare/schedule";
import { belowTheCard, perGame, shownTeams, skaterCategoryTotal, skaterIdentity, skaterSeasonEvidence, type SkaterIdentity, type SkaterSeason } from "./bshBoard";
import { defineShareModule, shareSettingsKey, type SharePostLoadResult, type ShareSettingField } from "./contract";
import { competitionRanks } from "./shared/definitions";
import { appearancesByPlayer, type SkaterAppearance } from "./shared/skaterAppearances";
import { shiftDays } from "./teamGames";

/** WGO's game row with the one column the shared appearance type does not carry. A null is missing, never zero. */
export type MultiCatGame = SkaterAppearance & { plusMinus: number | null };
export type MultiCatSeason = Omit<SkaterSeason, "appearances"> & { appearances: readonly MultiCatGame[] };
export type MultiCatBasis = "total" | "perGame";
export type MultiCatFormula = "standard" | "pointsFirst";
export type MultiCatSettings = { basis: MultiCatBasis; formula: MultiCatFormula };

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

const FIELDS: readonly ShareSettingField[] = [
  { id: "basis", label: "Ranking", kind: "select", default: "total", options: [{ value: "total", label: "Fantasy Week Total" }, { value: "perGame", label: "Per Game (min 2 GP)" }] },
  { id: "formula", label: "Formula", kind: "select", default: "standard", options: [{ value: "standard", label: "Standard: PTS + BLK + SOG + HIT" }, { value: "pointsFirst", label: "Points-First: 2 x PTS + BLK + SOG + HIT" }] },
];
export const multiCatHeadline = ({ basis, formula }: MultiCatSettings) => `Top ${formula === "pointsFirst" ? "Points-First" : "Multi-Cat"} Stars ${basis === "perGame" ? "Per Game" : "of the Week"}`;

/** CONTRACT §2: skater posts use the Monday to Sunday week. It is the week holding the cutoff, so a Monday post shows the week just ended. */
export function multiCatDates(through: string) {
  const weekStart = calendarWeekStart(`${through}T12:00:00Z`);
  return { weekStart, weekEnd: shiftDays(weekStart, 6), last7From: shiftDays(through, -6), last7To: through };
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

export type MultiCatLast7 = { games: number; values: { id: MultiCatCategoryId; label: string; total: number | null }[] };
export type MultiCatRow = SkaterIdentity & { rank: number; score: number; week: MultiCatScoreParts; radar: MultiCatPercentile[]; last7: MultiCatLast7 };
export type MultiCatData = {
  applied: string; through: string; weekStart: string; weekEnd: string; last7From: string; last7To: string;
  basis: MultiCatBasis; formula: MultiCatFormula; minGp: number; rows: MultiCatRow[];
  cohort: { percentile: number; weekSkaters: number; belowMinGp: number; missingComponent: number; ranked: number };
  notShown: number; tiedBeyondCut: number;
};

/** Ranks the fantasy week; the radar reads the whole season and the table reads the last 7 days. Equal scores share a rank (1, 2, 2, 4). */
export function buildMultiCatStars(season: MultiCatSeason, settings: MultiCatSettings): SharePostLoadResult<MultiCatData> {
  const dates = multiCatDates(season.through), minGp = multiCatMinGp(settings.basis);
  const players = appearancesByPlayer(season.appearances) as Map<number, MultiCatGame[]>;
  const percentiles = multiCatPercentiles(players);
  let weekSkaters = 0, belowMinGp = 0, missingComponent = 0;
  const candidates = [...players].flatMap(([playerId, rows]) => {
    const week = rows.filter(row => row.date >= dates.weekStart);
    if (!week.length) return [];
    weekSkaters++;
    if (week.length < minGp) { belowMinGp++; return []; }
    const parts = scoreParts(week), score = multiCatScore(parts, settings);
    if (score === null) { missingComponent++; return []; }
    return [{ playerId, rows, week, parts, score }];
  });
  const ranked = competitionRanks(candidates, entry => entry.score, entry => entry.playerId);
  const rows: MultiCatRow[] = ranked.slice(0, MULTI_CAT_ROWS).map(({ row: { playerId, rows: games, week, parts, score }, rank }) => {
    const last7 = games.filter(row => row.date >= dates.last7From);
    return { ...skaterIdentity(week), rank, score, week: parts, radar: percentiles(playerId), last7: { games: last7.length, values: MULTI_CAT_CATEGORIES.map(({ id, label, pick }) => ({ id, label, total: categoryTotal(last7, pick) })) } };
  });
  const lastRank = rows[rows.length - 1]?.rank, notShown = ranked.length - rows.length, tiedBeyondCut = ranked.slice(rows.length).filter(entry => entry.rank === lastRank).length;
  const excluded = [belowMinGp ? `${belowMinGp} under ${minGp} GP` : "", missingComponent ? `${missingComponent} unranked for a missing component` : "", belowTheCard(notShown, tiedBeyondCut)].filter(Boolean).join(", ");
  const cohortLine = `Ranking: ${weekSkaters} skaters played this week, ${ranked.length} ranked${excluded ? `, ${excluded}` : ""}. Radar: ${players.size} skaters with 1+ season GP.`;
  return {
    ...skaterSeasonEvidence(season, { windowLabel: `ranking ${dates.weekStart} to ${dates.weekEnd}, table ${dates.last7From} to ${dates.last7To}, radar full season`, cohort: cohortLine, note: `Ranked by ${multiCatFormulaLabel(settings.formula)}, ${settings.basis === "perGame" ? `per game, min ${minGp} GP` : "fantasy week total"}. Equal scores share a rank. Radar is each skater's season per-game percentile, higher is better on every spoke, PIM included.` }),
    data: { applied: shareSettingsKey(FIELDS, settings), through: season.through, ...dates, basis: settings.basis, formula: settings.formula, minGp, rows, cohort: { percentile: players.size, weekSkaters, belowMinGp, missingComponent, ranked: ranked.length }, notShown, tiedBeyondCut },
    teams: shownTeams(rows),
  };
}
export const multiCatCurrent = (data: MultiCatData, settings: MultiCatSettings) => data.applied === shareSettingsKey(FIELDS, settings);

const missingText = (value: number | null, text = String(value)) => value === null ? "missing" : text;
export const multiCatScoreText = (score: number, basis: MultiCatBasis) => basis === "perGame" ? score.toFixed(2) : String(score);
export const multiCatStarsModule = defineShareModule<MultiCatSettings, MultiCatData>({
  id: "multi-cat-stars", title: "Top Multi-Cat Stars of the Week", summary: "The fantasy week's top skaters by points, blocks, shots and hits, each with a season percentile radar and last 7 days stats.", group: "skaters", basis: "observed",
  headline: multiCatHeadline,
  suggestedUse: "Works for a weekend or Monday recap of the fantasy week; choose it on any day.",
  fields: FIELDS,
  load: () => import("./multiCatStars.sources").then(sources => sources.loadMultiCatStars),
  card: () => import("components/SocialShare/modules/MultiCatStarsCard").then(card => card.default),
  hasRows: (data, settings) => data.rows.length > 0 && multiCatCurrent(data, settings),
  altText: (snapshot, data) => `FHFH ${multiCatHeadline(data)}, fantasy week ${data.weekStart} to ${data.weekEnd} through ${data.through}, ${multiCatFormulaLabel(data.formula)}. ${data.rows.map(row => `${row.rank}. ${row.name}: ${multiCatScoreText(row.score, data.basis)} in ${row.week.games} week GP. Last 7 days, ${data.last7From} to ${data.last7To}, ${row.last7.games} GP: ${row.last7.values.map(value => `${value.label} ${missingText(value.total)}`).join(", ")}. Season percentile: ${row.radar.map(spoke => `${spoke.label} ${missingText(spoke.percentile, spoke.percentile?.toFixed(0))}`).join(", ")}`).join(". ")}. ${snapshot.evidence.cohort}`,
});
