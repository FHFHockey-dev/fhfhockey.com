import { SKATER_BOARD_ROWS, SKATER_POSITION_OPTIONS, SKATER_WINDOW_OPTIONS, STALE_SETTINGS_NOTE, perGame, shownTeams, skaterCategoryTotal, skaterCohort, skaterCohortLabel, skaterIdentity, skaterSeasonEvidence, skaterWindowLabel, skaterWindowOf, type SkaterIdentity, type SkaterPositionId, type SkaterSeason, type SkaterWindowId } from "./bshBoard";
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
const CATEGORY_OPTIONS = (Object.keys(SKATER_CATEGORIES) as SkaterCategoryId[]).map(id => ({ value: id, label: SKATER_CATEGORIES[id].name }));
const OPTIONAL_OPTIONS = [{ value: "none", label: "None" }, ...CATEGORY_OPTIONS];

export type CategoryBlueprintSettings = { cat1: SkaterCategoryId; cat2: SkaterCategoryId; cat3: SkaterCategoryId | "none"; cat4: SkaterCategoryId | "none"; window: SkaterWindowId; minGp: number; position: SkaterPositionId; topIn: number };
/** Null values mean a game in the window lacks this stat: shown as missing, with no rank. */
export type CategoryCell = { category: SkaterCategoryId; total: number | null; perGame: number | null; rank: number | null };
export type CategoryRow = SkaterIdentity & { games: number; cells: CategoryCell[] };
/** Separate categories on one basis and cohort. There is deliberately no field that combines them. */
export type CategoryBlueprintData = {
  applied: string; through: string; windowLabel: string; cohortSize: number; topIn: number;
  categories: { id: SkaterCategoryId; label: string; name: string; missing: number }[];
  rows: CategoryRow[]; qualifying: number; notShown: number;
};

const FIELDS: readonly ShareSettingField[] = [
  { id: "cat1", label: "Category 1 (sets the order)", kind: "select", default: "points", options: CATEGORY_OPTIONS },
  { id: "cat2", label: "Category 2", kind: "select", default: "shots", options: CATEGORY_OPTIONS },
  { id: "cat3", label: "Category 3", kind: "select", default: "hits", options: OPTIONAL_OPTIONS },
  { id: "cat4", label: "Category 4", kind: "select", default: "blocks", options: OPTIONAL_OPTIONS },
  { id: "window", label: "Window", kind: "select", default: "l10", options: SKATER_WINDOW_OPTIONS },
  { id: "minGp", label: "Min season GP", kind: "number", default: 5, min: 1, max: 82, step: 1 },
  { id: "position", label: "Position", kind: "select", default: "all", options: SKATER_POSITION_OPTIONS },
  // Specialists dominate each category: on 2026-10-31 nobody of 633 was top 100 in these four, and 16 were top 250.
  { id: "topIn", label: "Top N in every category", kind: "number", default: 250, min: 1, max: 1000, step: 1 },
];
export const chosenCategories = (settings: CategoryBlueprintSettings) => [settings.cat1, settings.cat2, settings.cat3, settings.cat4].filter((id): id is SkaterCategoryId => id !== "none");

/**
 * Every value is per game over the same window for the same cohort. "Top N" is a filter on each category's own rank,
 * and a missing category neither passes nor fails it. Category 1 only orders the rows.
 */
export function buildCategoryBlueprint(season: SkaterSeason, settings: CategoryBlueprintSettings): SharePostLoadResult<CategoryBlueprintData> {
  const chosen = chosenCategories(settings), pool = skaterCohort(season.appearances, settings);
  const players = pool.map(rows => {
    const window = skaterWindowOf(rows, settings.window);
    return { id: skaterIdentity(window.rows), games: window.actual, cells: new Map<SkaterCategoryId, CategoryCell>(chosen.map(category => {
      const total = skaterCategoryTotal(window.rows, SKATER_CATEGORIES[category].pick);
      return [category, { category, total, perGame: perGame(total, window.actual), rank: null }];
    })) };
  });
  for (const category of chosen) for (const { row, rank } of competitionRanks(players, player => player.cells.get(category)!.perGame, player => player.id.playerId)) row.cells.get(category)!.rank = rank;
  const qualifying = players.filter(player => {
    const known = chosen.map(category => player.cells.get(category)!.rank).filter((rank): rank is number => rank !== null);
    return known.length > 0 && known.every(rank => rank <= settings.topIn);
  }).sort((a, b) => (a.cells.get(chosen[0])!.rank ?? Infinity) - (b.cells.get(chosen[0])!.rank ?? Infinity) || a.id.playerId - b.id.playerId);
  const rows = qualifying.slice(0, SKATER_BOARD_ROWS).map(player => ({ ...player.id, games: player.games, cells: chosen.map(category => player.cells.get(category)!) }));
  const categories = chosen.map(id => ({ id, label: SKATER_CATEGORIES[id].label, name: SKATER_CATEGORIES[id].name, missing: players.filter(player => player.cells.get(id)!.perGame === null).length }));
  const windowLabel = skaterWindowLabel(settings.window);
  return {
    ...skaterSeasonEvidence(season, { windowLabel: `${windowLabel}, per game`, cohort: `${skaterCohortLabel(settings)}: ${pool.length} skaters, ${qualifying.length} in the top ${settings.topIn} of every category` }),
    data: { applied: shareSettingsKey(FIELDS, settings), through: season.through, windowLabel, cohortSize: pool.length, topIn: settings.topIn, categories, rows, qualifying: qualifying.length, notShown: qualifying.length - rows.length },
    teams: shownTeams(rows),
  };
}
export const categoryBlueprintCurrent = (data: CategoryBlueprintData, settings: CategoryBlueprintSettings) => data.applied === shareSettingsKey(FIELDS, settings);
export { STALE_SETTINGS_NOTE };

export const categoryBlueprintModule = defineShareModule<CategoryBlueprintSettings, CategoryBlueprintData>({
  id: "category-blueprint", title: "Category Blueprint", summary: "Separate per-game category contributions for a combination you choose, with each category's own rank.", group: "skaters", basis: "observed",
  suggestedUse: "Works for a category-focused post; choose it on any day.",
  fields: FIELDS,
  validate: settings => { const chosen = chosenCategories(settings); return new Set(chosen).size === chosen.length ? null : "Choose each category only once."; },
  load: () => import("./categoryBlueprint.sources").then(sources => sources.loadCategoryBlueprint),
  card: () => import("components/SocialShare/modules/CategoryBlueprintCard").then(card => card.default),
  hasRows: (data, settings) => data.rows.length > 0 && categoryBlueprintCurrent(data, settings),
  altText: (snapshot, data) => `FHFH Category Blueprint, per game over the ${data.windowLabel}, through ${data.through}. ${data.rows.map(row => `${row.name}: ${row.cells.map(cell => `${SKATER_CATEGORIES[cell.category].label} ${cell.perGame === null ? "missing" : `${cell.perGame.toFixed(2)}, rank ${cell.rank}`}`).join(", ")}`).join("; ")}. ${snapshot.evidence.cohort}.`,
});
