import { PERIOD_ROLLING, SKATER_BOARD_ROWS, SKATER_PERIOD_CONTROL, SKATER_PERIOD_FIELDS, belowTheCard, SKATER_POSITION_OPTIONS, SKATER_WINDOW_OPTIONS, STALE_SETTINGS_NOTE, perGame, shownTeams, skaterCategoryTotal, skaterCohort, skaterCohortLabel, skaterIdentity, skaterPeriodReason, skaterPeriodRules, skaterSeasonEvidence, skaterWindowOf, type SkaterIdentity, type SkaterPeriodSettings, type SkaterPositionId, type SkaterSeason, type SkaterWindowId } from "./bshBoard";
import { defineShareModule, shareSettingsKey, type SharePostLoadResult, type ShareSettingField } from "./contract";
import { competitionRanks } from "./shared/definitions";
import type { SkaterAppearance } from "./shared/skaterAppearances";

export const SKATER_CATEGORIES = {
  goals: { label: "G", name: "Goals", pick: (row: SkaterAppearance) => row.goals },
  assists: { label: "A", name: "Assists", pick: (row: SkaterAppearance) => row.assists },
  points: { label: "PTS", name: "Points", pick: (row: SkaterAppearance) => row.points },
  shots: { label: "SOG", name: "Shots", pick: (row: SkaterAppearance) => row.shots },
  hits: { label: "HITS", name: "Hits", pick: (row: SkaterAppearance) => row.hits },
  blocks: { label: "BLK", name: "Blocks", pick: (row: SkaterAppearance) => row.blocks },
  ppPoints: { label: "PPP", name: "Power-play points", pick: (row: SkaterAppearance) => row.ppPoints },
  penaltyMinutes: { label: "PIM", name: "Penalty minutes", pick: (row: SkaterAppearance) => row.penaltyMinutes },
} as const;
export type SkaterCategoryId = keyof typeof SKATER_CATEGORIES;

/** Multi Cat Monsters. TJ's decision: this card alone ranks on a combined score, in place of the separate-categories rule. */
export type MultiCatView = "standard" | "points-first";
export const MULTI_CAT_CATEGORIES = ["points", "shots", "hits", "blocks"] as const;
export type MultiCatCategory = typeof MULTI_CAT_CATEGORIES[number];
const WEIGHTS: Record<MultiCatView, Record<MultiCatCategory, number>> = {
  standard: { points: 1, shots: 1, hits: 1, blocks: 1 },
  "points-first": { points: 2, shots: 1, hits: 1, blocks: 1 },
};
export const MULTI_CAT_FORMULA: Record<MultiCatView, string> = { standard: "average of the four", "points-first": "(2×PTS + SOG + HITS + BLK) / 5" };
/** Points-First ranks only skaters at or above this points percentile. Percentiles still come from the whole eligible cohort. */
export const POINTS_FIRST_FLOOR = 85;
const HEADLINES: Record<MultiCatView, string> = { standard: "MULTI CAT MONSTERS", "points-first": "POINTS-FIRST MULTI CAT MONSTERS" };

export type CategoryBlueprintSettings = SkaterPeriodSettings & { view: MultiCatView; window: SkaterWindowId; minGp: number; position: SkaterPositionId };
/** Null values mean a game in the window lacks this stat: no percentile, never a zero. */
export type CategoryCell = { category: MultiCatCategory; total: number | null; perGame: number | null; percentile: number | null };
export type CategoryRow = SkaterIdentity & { rank: number; score: number; games: number; cells: CategoryCell[] };
export type CategoryBlueprintData = {
  applied: string; view: MultiCatView; through: string; windowLabel: string; periodLabel: string | null; cohortSize: number;
  categories: { id: MultiCatCategory; label: string; name: string; missing: number }[];
  rows: CategoryRow[]; ranked: number; unranked: number; belowFloor: number; notShown: number; tiedBeyondCut: number;
};

const FIELDS: readonly ShareSettingField[] = [
  { id: "view", label: "View", kind: "select", default: "standard", options: [{ value: "standard", label: "Multi Cat Monsters" }, { value: "points-first", label: "Points-First" }] },
  ...SKATER_PERIOD_FIELDS,
  { id: "window", label: "Window", kind: "select", default: "l10", options: SKATER_WINDOW_OPTIONS, onlyForPeriod: PERIOD_ROLLING },
  { id: "minGp", label: "Min season GP", kind: "number", default: 5, min: 1, max: 82, step: 1, onlyForPeriod: PERIOD_ROLLING },
  { id: "position", label: "Position", kind: "select", default: "all", options: SKATER_POSITION_OPTIONS },
];

/**
 * The share of the other skaters with a known value that this one beats, 0 to 100, with a tie counting as half.
 * Every category then averages 50 however many skaters tie in it, so a category full of ties weighs the same in the score. A lone skater is 50.
 */
export function categoryPercentiles(values: readonly (number | null)[]): (number | null)[] {
  const known = values.filter((value): value is number => value !== null);
  return values.map(value => {
    if (value === null) return null;
    if (known.length === 1) return 50;
    const below = known.filter(other => other < value).length, tied = known.filter(other => other === value).length - 1;
    return (below + tied / 2) * 100 / (known.length - 1);
  });
}
/** The weighted average of the percentiles, rounded so two equal scores tie instead of parting on floating-point noise. Any missing category has no score. */
export function multiCatScore(percentiles: Record<MultiCatCategory, number | null>, view: MultiCatView): number | null {
  const weights = WEIGHTS[view];
  if (MULTI_CAT_CATEGORIES.some(category => percentiles[category] === null)) return null;
  const sum = MULTI_CAT_CATEGORIES.reduce((total, category) => total + weights[category] * percentiles[category]!, 0), weight = MULTI_CAT_CATEGORIES.reduce((total, category) => total + weights[category], 0);
  return Math.round(sum / weight * 1e6) / 1e6;
}
/** One scale for every category. Null is a missing category: it has no band, so it can never read as weak. */
export const CATEGORY_PERCENTILE_BANDS = [{ id: "p95", floor: 95, label: "95+" }, { id: "p85", floor: 85, label: "85+" }, { id: "p70", floor: 70, label: "70+" }, { id: "p50", floor: 50, label: "50+" }, { id: "lower", floor: 0, label: "below" }] as const;
export type CategoryPercentileBand = typeof CATEGORY_PERCENTILE_BANDS[number]["id"];
export function categoryPercentileBand(percentile: number | null): CategoryPercentileBand | null {
  return percentile === null ? null : CATEGORY_PERCENTILE_BANDS.find(band => percentile >= band.floor)!.id;
}

/** Every value is per game over the same window, and every percentile is among the same eligible skaters. */
export function buildCategoryBlueprint(season: SkaterSeason, settings: CategoryBlueprintSettings): SharePostLoadResult<CategoryBlueprintData> {
  const rules = skaterPeriodRules(season, settings), cohortRule = { position: settings.position, minGp: rules.minGp }, pool = skaterCohort(season.appearances, cohortRule);
  const players = pool.map(rows => {
    const window = skaterWindowOf(rows, rules.window);
    return { id: skaterIdentity(window.rows), games: window.actual, cells: MULTI_CAT_CATEGORIES.map((category): CategoryCell => {
      const total = skaterCategoryTotal(window.rows, SKATER_CATEGORIES[category].pick);
      return { category, total, perGame: perGame(total, window.actual), percentile: null };
    }) };
  });
  MULTI_CAT_CATEGORIES.forEach((_, at) => {
    const percentiles = categoryPercentiles(players.map(player => player.cells[at].perGame));
    players.forEach((player, index) => { player.cells[at].percentile = percentiles[index]; });
  });
  const scored = players.map(player => ({ ...player, score: multiCatScore(Object.fromEntries(player.cells.map(cell => [cell.category, cell.percentile])) as Record<MultiCatCategory, number | null>, settings.view) }));
  const clearsFloor = (player: typeof scored[number]) => settings.view !== "points-first" || player.cells[0].percentile! >= POINTS_FIRST_FLOOR;
  const complete = scored.filter(player => player.score !== null), ranked = competitionRanks(complete.filter(clearsFloor), player => player.score, player => player.id.playerId);
  const rows: CategoryRow[] = ranked.slice(0, SKATER_BOARD_ROWS).map(({ row, rank, score }) => ({ ...row.id, rank, score, games: row.games, cells: row.cells }));
  const lastRank = rows[rows.length - 1]?.rank, notShown = ranked.length - rows.length, tiedBeyondCut = ranked.slice(rows.length).filter(row => row.rank === lastRank).length, unranked = pool.length - complete.length, belowFloor = complete.length - ranked.length;
  const categories = MULTI_CAT_CATEGORIES.map((id, at) => ({ id, label: SKATER_CATEGORIES[id].label, name: SKATER_CATEGORIES[id].name, missing: players.filter(player => player.cells[at].perGame === null).length }));
  const { windowLabel, periodLabel } = rules, notes = [belowFloor ? `${belowFloor} below points P${POINTS_FIRST_FLOOR}` : "", unranked ? `${unranked} unranked for a missing category` : "", ...categories.filter(category => category.missing).map(category => `${category.name} missing for ${category.missing}`), belowTheCard(notShown, tiedBeyondCut)].filter(Boolean).join(", ");
  return {
    ...skaterSeasonEvidence(season, { windowLabel: `${windowLabel}, per game`, note: `Each cell's percentile is the share of the other eligible skaters it beats in that category, with a tie counting as half. The score is ${settings.view === "standard" ? "the average of the four percentiles" : "the percentiles averaged with points counted twice"}, and it sets the order.${settings.view === "points-first" ? ` Only skaters at P${POINTS_FIRST_FLOOR} or better in points are ranked: ${ranked.length} of ${pool.length} eligible; percentiles stay over all ${pool.length}.` : ""} A missing category leaves a skater unranked, never a zero.`, cohort: `${skaterCohortLabel(cohortRule, !!periodLabel)}: ${pool.length} eligible, ${ranked.length} ranked${notes ? `, ${notes}` : ""}` }),
    data: { applied: shareSettingsKey(FIELDS, settings), view: settings.view, through: season.through, windowLabel, periodLabel, cohortSize: pool.length, categories, rows, ranked: ranked.length, unranked, belowFloor, notShown, tiedBeyondCut },
    teams: shownTeams(rows),
  };
}
export const categoryBlueprintCurrent = (data: CategoryBlueprintData, settings: CategoryBlueprintSettings) => data.applied === shareSettingsKey(FIELDS, settings);
export { STALE_SETTINGS_NOTE };

export const categoryBlueprintModule = defineShareModule<CategoryBlueprintSettings, CategoryBlueprintData>({
  id: "category-blueprint", title: "Multi Cat Monsters", summary: "Skaters ranked on their percentiles in points, shots, hits and blocks, with a Points-First view that counts points twice.", group: "skaters", basis: "observed",
  suggestedUse: "Works for a category-focused post; choose it on any day.",
  fields: FIELDS,
  periodControl: SKATER_PERIOD_CONTROL,
  validate: skaterPeriodReason,
  headline: settings => HEADLINES[settings.view],
  load: () => import("./categoryBlueprint.sources").then(sources => sources.loadCategoryBlueprint),
  card: () => import("components/SocialShare/modules/CategoryBlueprintCard").then(card => card.default),
  hasRows: (data, settings) => data.rows.length > 0 && categoryBlueprintCurrent(data, settings),
  altText: (snapshot, data) => `FHFH ${data.view === "standard" ? "Multi Cat Monsters" : "Points-First Multi Cat Monsters"}, per game over ${data.periodLabel ?? `the ${data.windowLabel}`}, through ${data.through}. Score is ${MULTI_CAT_FORMULA[data.view]} category percentiles.${data.view === "points-first" ? ` Only skaters at points percentile ${POINTS_FIRST_FLOOR} or better are ranked.` : ""} ${data.rows.map(row => `${row.rank}. ${row.name}, score ${row.score.toFixed(1)}: ${row.cells.map(cell => `${SKATER_CATEGORIES[cell.category].label} ${cell.perGame === null ? "missing" : `${cell.perGame.toFixed(2)}, percentile ${Math.round(cell.percentile!)}`}`).join(", ")}`).join("; ")}. ${snapshot.evidence.cohort}.`,
});
