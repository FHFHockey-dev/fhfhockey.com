import { SKATER_BOARD_ROWS, belowTheCard, SKATER_POSITION_OPTIONS, SKATER_WINDOW_OPTIONS, shownTeams, skaterCohort, skaterCohortLabel, skaterIdentity, skaterSeasonEvidence, skaterWindowLabel, skaterWindowOf, type SkaterIdentity, type SkaterPositionId, type SkaterSeason, type SkaterWindowId } from "./bshBoard";
import { SKATER_CATEGORIES, type SkaterCategoryId } from "./categoryBlueprint";
import { defineShareModule, shareSettingsKey, type SharePostLoadResult, type ShareSettingField } from "./contract";
import { competitionRanks, ownershipInRange, ownershipOf, strictlyAbove, type OwnershipState } from "./shared/definitions";
import type { SkaterAppearance } from "./shared/skaterAppearances";

export type FloorView = "sog" | "hits" | "blk" | "point" | "cardio" | "zero";
export type NightlyFloorSettings = {
  view: FloorView; xSog: number; xHits: number; xBlk: number; zeroCategory: SkaterCategoryId;
  window: SkaterWindowId; minGp: number; position: SkaterPositionId;
  ownMin: number; ownMax: number; unknownOwnership: "exclude" | "include"; minCoverage: number;
};
/** `numerator` of `denominator` known appearances met the test; `missing` appearances lack the stat and count as neither. */
export type FloorRow = SkaterIdentity & { rank: number; appearances: number; numerator: number; denominator: number; missing: number; pct: number; ownership: OwnershipState };
export type NightlyFloorData = {
  applied: string; through: string; windowLabel: string; viewLabel: string; test: string; rows: FloorRow[];
  cohort: { pool: number; outOfOwnershipRange: number; unknownOwnershipExcluded: number; unadmitted: number; ranked: number };
  notShown: number; tiedBeyondCut: number;
};
export type YahooOwnershipRow = { player_key: string; player_id: string | null; percent_ownership: number | null; last_updated: string | null };
export type OwnershipMapRow = { yahoo_player_id: string | null; nhl_player_id: string | number | null };

const FIELDS: readonly ShareSettingField[] = [
  { id: "view", label: "View", kind: "select", default: "sog", options: [{ value: "sog", label: "SOG above X" }, { value: "hits", label: "Hits above X" }, { value: "blk", label: "Blocks above X" }, { value: "point", label: "At least 1 point" }, { value: "cardio", label: "Cardio Masters (zero points)" }, { value: "zero", label: "Zero in a category" }] },
  { id: "xSog", label: "SOG X", kind: "number", default: 2, min: 0, max: 10, step: 1 },
  { id: "xHits", label: "Hits X", kind: "number", default: 2, min: 0, max: 10, step: 1 },
  { id: "xBlk", label: "Blocks X", kind: "number", default: 1, min: 0, max: 10, step: 1 },
  { id: "zeroCategory", label: "Zero category", kind: "select", default: "shots", options: (Object.keys(SKATER_CATEGORIES) as SkaterCategoryId[]).map(id => ({ value: id, label: SKATER_CATEGORIES[id].name })) },
  { id: "window", label: "Window", kind: "select", default: "l10", options: SKATER_WINDOW_OPTIONS },
  { id: "minGp", label: "Min season GP", kind: "number", default: 5, min: 1, max: 82, step: 1 },
  { id: "position", label: "Position", kind: "select", default: "all", options: SKATER_POSITION_OPTIONS },
  { id: "ownMin", label: "Min rostered %", kind: "number", default: 0, min: 0, max: 100, step: 1 },
  { id: "ownMax", label: "Max rostered %", kind: "number", default: 100, min: 0, max: 100, step: 1 },
  { id: "unknownOwnership", label: "Unknown rostered %", kind: "select", default: "exclude", options: [{ value: "exclude", label: "Exclude" }, { value: "include", label: "Include" }] },
  { id: "minCoverage", label: "Min coverage %", kind: "number", default: 90, min: 50, max: 100, step: 1 },
];

/** Whether one appearance meets the view's test. Null means the stat is missing: neither a pass nor a fail. */
export function floorOutcome(settings: NightlyFloorSettings, row: SkaterAppearance): boolean | null {
  switch (settings.view) {
    case "sog": return strictlyAbove(row.shots, settings.xSog);
    case "hits": return strictlyAbove(row.hits, settings.xHits);
    case "blk": return strictlyAbove(row.blocks, settings.xBlk);
    case "point": return row.points === null ? null : row.points >= 1;
    case "cardio": return row.points === null ? null : row.points === 0;
    case "zero": { const value = SKATER_CATEGORIES[settings.zeroCategory].pick(row); return value === null ? null : value === 0; }
  }
}
export function floorViewLabels(settings: NightlyFloorSettings) {
  switch (settings.view) {
    case "sog": return { viewLabel: `SOG above ${settings.xSog}`, test: `More than ${settings.xSog} SOG. Exactly ${settings.xSog} fails.` };
    case "hits": return { viewLabel: `Hits above ${settings.xHits}`, test: `More than ${settings.xHits} hits. Exactly ${settings.xHits} fails.` };
    case "blk": return { viewLabel: `Blocks above ${settings.xBlk}`, test: `More than ${settings.xBlk} blocks. Exactly ${settings.xBlk} fails.` };
    case "point": return { viewLabel: "At least 1 point", test: "1 point or more." };
    case "cardio": return { viewLabel: "Cardio Masters", test: "Cardio Masters: appeared with exactly 0 points." };
    case "zero": return { viewLabel: `Zero ${SKATER_CATEGORIES[settings.zeroCategory].name.toLowerCase()}`, test: `Appeared with exactly 0 ${SKATER_CATEGORIES[settings.zeroCategory].name.toLowerCase()}.` };
  }
}
/** Admitted at or above the minimum share of window appearances with a known value. An unadmitted skater is unranked, never zero-filled. */
export const floorAdmitted = (denominator: number, appearances: number, minCoverage: number) => denominator > 0 && denominator * 100 >= minCoverage * appearances;

/** NHL id to rostered %. A Yahoo id on two NHL ids is dropped, and two differing values for one NHL id are unknown. */
export function ownershipByPlayer(map: readonly OwnershipMapRow[], yahoo: readonly YahooOwnershipRow[]) {
  const nhlIds = new Map<string, Set<number>>();
  for (const row of map) {
    const id = Number(row.nhl_player_id);
    if (row.yahoo_player_id && Number.isInteger(id) && id > 0) nhlIds.set(row.yahoo_player_id, (nhlIds.get(row.yahoo_player_id) ?? new Set()).add(id));
  }
  const states = new Map<number, OwnershipState[]>();
  for (const row of yahoo) {
    const ids = new Set([row.player_key, row.player_id].flatMap(key => key ? [...(nhlIds.get(key) ?? [])] : []));
    if (ids.size !== 1) continue;
    const [id] = ids, state = ownershipOf(row.percent_ownership, row.last_updated?.slice(0, 10) ?? null);
    if (state.state === "known") states.set(id, [...(states.get(id) ?? []), state]);
  }
  return new Map([...states].map(([id, known]) => [id, new Set(known.map(state => state.pct)).size === 1 ? known[0] : ownershipOf(null)]));
}

export function buildNightlyFloor(season: SkaterSeason, settings: NightlyFloorSettings, ownership: { byPlayer: ReadonlyMap<number, OwnershipState>; updatedAt: string | null }): SharePostLoadResult<NightlyFloorData> {
  const pool = skaterCohort(season.appearances, settings), includeUnknown = settings.unknownOwnership === "include";
  let outOfOwnershipRange = 0, unknownOwnershipExcluded = 0, unadmitted = 0;
  const admitted = pool.flatMap(rows => {
    const owned = ownership.byPlayer.get(rows[0].playerId) ?? ownershipOf(null);
    if (!ownershipInRange(owned, settings.ownMin, settings.ownMax, includeUnknown)) {
      if (owned.state === "known") outOfOwnershipRange++; else unknownOwnershipExcluded++;
      return [];
    }
    const window = skaterWindowOf(rows, settings.window), outcomes = window.rows.map(row => floorOutcome(settings, row));
    const denominator = outcomes.filter(outcome => outcome !== null).length;
    if (!floorAdmitted(denominator, window.actual, settings.minCoverage)) { unadmitted++; return []; }
    const numerator = outcomes.filter(outcome => outcome === true).length;
    return [{ id: skaterIdentity(window.rows), appearances: window.actual, numerator, denominator, missing: window.actual - denominator, pct: numerator / denominator, ownership: owned }];
  });
  const ranked = competitionRanks(admitted, row => row.pct, row => row.id.playerId);
  const rows: FloorRow[] = ranked.slice(0, SKATER_BOARD_ROWS).map(({ row, rank }) => ({ ...row.id, rank, appearances: row.appearances, numerator: row.numerator, denominator: row.denominator, missing: row.missing, pct: row.pct, ownership: row.ownership }));
  const lastRank = rows[rows.length - 1]?.rank, windowLabel = skaterWindowLabel(settings.window);
  const notShown = ranked.length - rows.length, tiedBeyondCut = ranked.slice(rows.length).filter(row => row.rank === lastRank).length;
  const excluded = [outOfOwnershipRange ? `${outOfOwnershipRange} outside the rostered range` : "", unknownOwnershipExcluded ? `${unknownOwnershipExcluded} unknown rostered % excluded` : "", unadmitted ? `${unadmitted} below min coverage` : "", belowTheCard(notShown, tiedBeyondCut)].filter(Boolean).join(", ");
  return {
    ...skaterSeasonEvidence(season, {
      windowLabel, note: "A DNP is not an appearance. A missing stat counts as neither a pass nor a fail.", cohort: `${skaterCohortLabel(settings)}, ${settings.ownMin}-${settings.ownMax}% rostered: ${pool.length} eligible, ${ranked.length} ranked${excluded ? `, ${excluded}` : ""}`,
      extraSources: [{ name: "Yahoo rostered %", tables: ["yahoo_players", "yahoo_nhl_player_map_read"], state: "ready", asOf: ownership.updatedAt?.slice(0, 10) ?? null, updatedAt: ownership.updatedAt }],
    }),
    data: {
      applied: shareSettingsKey(FIELDS, settings), through: season.through, windowLabel, ...floorViewLabels(settings), rows,
      cohort: { pool: pool.length, outOfOwnershipRange, unknownOwnershipExcluded, unadmitted, ranked: ranked.length },
      notShown, tiedBeyondCut,
    },
    teams: shownTeams(rows),
  };
}
export const nightlyFloorCurrent = (data: NightlyFloorData, settings: NightlyFloorSettings) => data.applied === shareSettingsKey(FIELDS, settings);

export const nightlyFloorModule = defineShareModule<NightlyFloorSettings, NightlyFloorData>({
  id: "nightly-floor", title: "Nightly Floor", summary: "How often skaters clear a strict threshold, score a point, or post a zero (Cardio Masters), counted over real appearances.", group: "skaters", basis: "observed",
  suggestedUse: "Works for a streaming or waiver post; choose it on any day.",
  fields: FIELDS,
  validate: settings => settings.ownMin > settings.ownMax ? "Min rostered % cannot be above max rostered %." : null,
  load: () => import("./nightlyFloor.sources").then(sources => sources.loadNightlyFloor),
  card: () => import("components/SocialShare/modules/NightlyFloorCard").then(card => card.default),
  // A board of nobody clearing the test has nothing to publish.
  hasRows: (data, settings) => data.rows.some(row => row.numerator > 0) && nightlyFloorCurrent(data, settings),
  altText: (snapshot, data) => `FHFH Nightly Floor: ${data.viewLabel}, ${data.windowLabel}, through ${data.through}. ${data.test} ${data.rows.map(row => `${row.rank}. ${row.name}: ${row.numerator} of ${row.denominator} (${Math.round(row.pct * 100)}%), ${row.missing} missing`).join("; ")}. ${snapshot.evidence.cohort}.`,
});
