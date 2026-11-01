import { currentSeason } from "lib/socialShare/schedule";
import { defineShareModule, shareSettingsKey, type SharePostEvidence, type SharePostLoadResult, type SharePostSource, type ShareSettingField } from "./contract";
import { bsh, competitionRanks, editionDate, lastN, previousN, versusSeason, type ShareWindow } from "./shared/definitions";
import type { CompletedTeamGame } from "./shared/goalieLedger";
import { appearancesByPlayer, type SkaterAppearance } from "./shared/skaterAppearances";
import { shiftDays } from "./teamGames";

/** Shared by this lane's three posts: one window, cohort and coverage rule, so the boards agree with each other. */
export type SkaterWindowId = "l5" | "l10" | "std";
export type SkaterPositionId = "all" | "F" | "D";
export const SKATER_WINDOW_OPTIONS = [{ value: "l5", label: "L5" }, { value: "l10", label: "L10" }, { value: "std", label: "Season to date" }] as const;
export const SKATER_POSITION_OPTIONS = [{ value: "all", label: "All skaters" }, { value: "F", label: "Forwards" }, { value: "D", label: "Defensemen" }] as const;
const WINDOW_LENGTH: Record<SkaterWindowId, number | null> = { l5: 5, l10: 10, std: null };
export const skaterWindowLabel = (window: SkaterWindowId) => window === "std" ? "season to date" : `last ${WINDOW_LENGTH[window]} appearances`;
export const skaterWindowOf = (rows: readonly SkaterAppearance[], window: SkaterWindowId) => {
  const length = WINDOW_LENGTH[window];
  return length === null ? versusSeason(rows, 0).season : lastN(rows, length);
};
/** Rows the 860px post body holds at the dense type size. What falls below is counted in the evidence. */
export const SKATER_BOARD_ROWS = 20;
/** BSH leaders carry a bar under each row, which needs the height of 12 rows. */
export const BSH_LEADER_ROWS = 12;
/** Risers and fallers sit side by side, with a bar and a tile line under each skater: 7 rows a side fit the body. */
export const BSH_MOVER_ROWS = 7;
/** The cohort line's count of ranked rows the card has no room for. */
export const belowTheCard = (notShown: number, tied = 0) => notShown ? `${notShown} more below the card${tied ? `, ${tied} tied with the last row` : ""}` : "";
export const STALE_SETTINGS_NOTE = "Settings changed. Refresh this post to apply them.";
export const perGame = (total: number | null, games: number) => total === null || games === 0 ? null : total / games;
const sumOf = (rows: readonly SkaterAppearance[], pick: (row: SkaterAppearance) => number | null) => rows.some(row => pick(row) === null) ? null : rows.reduce((total, row) => total + pick(row)!, 0);
export const skaterCategoryTotal = sumOf;

/** Through yesterday in New York; the read covers the whole season because "last N appearances" can reach back any distance. */
export function skaterSeasonScope(generatedAt: string) {
  const through = shiftDays(editionDate(generatedAt), -1), season = currentSeason(through);
  return { season, from: `${Math.floor(season / 10000)}-07-01`, through };
}
export type SkaterSeason = { appearances: readonly SkaterAppearance[]; teamGames: readonly CompletedTeamGame[]; scheduledGames: number; through: string };

/** A scheduled team game counts only once the team feed has it and skater rows exist for that team in that game. */
export function skaterSeasonEvidence(season: SkaterSeason, input: { windowLabel: string; cohort: string; note?: string; extraSources?: readonly SharePostSource[] }): { state: "ready" | "partial"; reasons: string[]; evidence: SharePostEvidence } {
  const withSkaters = new Set(season.appearances.map(row => `${row.team}:${row.gameId}`));
  const expected = season.scheduledGames * 2, observed = season.teamGames.filter(game => withSkaters.has(`${game.team}:${game.gameId}`)).length;
  const complete = observed === expected, state = complete ? "ready" as const : "partial" as const;
  const asOf = season.appearances.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null);
  return {
    state, reasons: complete ? [] : [`${observed} of ${expected} scheduled team games have reported skater results.`],
    evidence: {
      sources: [{ name: "NHL.com skater game stats", tables: ["wgo_skater_stats", "wgo_team_stats", "games"], state, asOf, updatedAt: null }, ...(input.extraSources ?? [])],
      sample: `Season through ${season.through}: ${season.appearances.length} appearances. Window: ${input.windowLabel}.${input.note ? ` ${input.note}` : ""}`, strength: "All situations", cohort: input.cohort,
      coverage: { observed, expected, missing: Math.max(0, expected - observed), unit: "team games" },
    },
  };
}

export type SkaterIdentity = { playerId: number; name: string; position: string | null; team: string | null; teams: string[] };
/** Each game binds to the team of that game; the latest one is shown, and a traded skater's other window teams stay listed. */
export function skaterIdentity(rows: readonly SkaterAppearance[]): SkaterIdentity {
  const latest = rows[rows.length - 1];
  return { playerId: latest.playerId, name: latest.name ?? `Player ${latest.playerId}`, position: latest.position, team: latest.team, teams: [...new Set(rows.flatMap(row => row.team ? [row.team] : []).reverse())] };
}
/** Season GP over this position. A position the source does not state matches only "all". */
export function skaterCohort(appearances: readonly SkaterAppearance[], settings: { position: SkaterPositionId; minGp: number }) {
  return [...appearancesByPlayer(appearances).values()].filter(rows => rows.length >= settings.minGp && (settings.position === "all" || rows[rows.length - 1].group === settings.position));
}
export const skaterCohortLabel = (settings: { position: SkaterPositionId; minGp: number }) => `${SKATER_POSITION_OPTIONS.find(option => option.value === settings.position)!.label}, ${settings.minGp}+ season GP`;
export const shownTeams = (rows: readonly { team: string | null }[]) => [...new Set(rows.flatMap(row => row.team ? [row.team] : []))].sort();

export type BshView = "leaders" | "movers";
export type BshComparison = "previous" | "std";
export type BshBoardSettings = { view: BshView; window: SkaterWindowId; comparison: BshComparison; minGp: number; position: SkaterPositionId };
/** A null component total means a game in the window lacks that stat. Shot attempts never stand in for shots. */
export type BshTotals = { games: number; blocks: number | null; shots: number | null; hits: number | null; bsh: number | null; blocksPerGame: number | null; shotsPerGame: number | null; hitsPerGame: number | null; bshPerGame: number | null };
export type BshRow = SkaterIdentity & { rank: number; recent: BshTotals; baseline: BshTotals | null; delta: number | null };
export type BshBoardData = {
  applied: string; view: BshView; through: string; windowLabel: string; comparisonLabel: string | null;
  /** Leaders view. The movers view fills `risers` and `fallers`. */
  rows: BshRow[]; risers: BshRow[]; fallers: BshRow[];
  cohort: { eligible: number; comparable: number; ranked: number; risers: number; fallers: number; missingComponent: number; shortWindow: number; flat: number };
  notShown: number; tiedBeyondCut: number;
};

export function bshTotals(rows: readonly SkaterAppearance[]): BshTotals {
  const blocks = sumOf(rows, row => row.blocks), shots = sumOf(rows, row => row.shots), hits = sumOf(rows, row => row.hits), games = rows.length;
  const known = rows.every(row => bsh(row) !== null);
  const total = known ? rows.reduce((sum, row) => sum + bsh(row)!, 0) : null;
  return { games, blocks, shots, hits, bsh: total, blocksPerGame: perGame(blocks, games), shotsPerGame: perGame(shots, games), hitsPerGame: perGame(hits, games), bshPerGame: perGame(total, games) };
}
export type BshLayer = "b" | "s" | "h";
export type BshBarSection = { layer: BshLayer; value: number; share: number; letter: boolean };
export type BshBar = { state: "missing" | "empty"; sections: [] } | { state: "split"; sections: BshBarSection[] };
/** Drawn width of a full bar, by view, and the width a section needs to hold its letter without clipping. */
export const BSH_BAR_PX = { leaders: 982, movers: 481 } as const;
export const BSH_LETTER_PX = 18;
/** Each section's width is its share of the total. A zero has no section, all zeros split nothing, and a missing value is never shared out. */
export function bshBar(totals: Pick<BshTotals, "blocksPerGame" | "shotsPerGame" | "hitsPerGame">, barPx: number): BshBar {
  const values = [["b", totals.blocksPerGame], ["s", totals.shotsPerGame], ["h", totals.hitsPerGame]] as const;
  if (values.some(([, value]) => value === null)) return { state: "missing", sections: [] };
  const known = values.map(([layer, value]) => ({ layer, value: value! })), sum = known.reduce((total, entry) => total + entry.value, 0);
  if (sum === 0) return { state: "empty", sections: [] };
  return { state: "split", sections: known.filter(entry => entry.value > 0).map(entry => ({ ...entry, share: entry.value / sum, letter: entry.value / sum * barPx >= BSH_LETTER_PX })) };
}
/** Differences of per-game rates, rounded so two equal changes tie instead of parting on floating-point noise. */
const tieSafe = (value: number) => Math.round(value * 1e6) / 1e6;

function baselineOf(rows: readonly SkaterAppearance[], window: SkaterWindowId, comparison: BshComparison): ShareWindow<SkaterAppearance> {
  const length = WINDOW_LENGTH[window]!;
  return comparison === "previous" ? previousN(rows, length, length) : versusSeason(rows, length).seasonExcludingRecent;
}
export const bshComparisonLabel = (settings: Pick<BshBoardSettings, "view" | "window" | "comparison">) => {
  if (settings.view === "leaders") return null;
  return settings.comparison === "previous" ? `the previous ${WINDOW_LENGTH[settings.window]} appearances` : "season to date excluding the recent window";
};

const BSH_FIELDS: readonly ShareSettingField[] = [
  { id: "view", label: "View", kind: "select", default: "leaders", options: [{ value: "leaders", label: "Leaders" }, { value: "movers", label: "Risers and fallers" }] },
  { id: "window", label: "Window", kind: "select", default: "l10", options: SKATER_WINDOW_OPTIONS },
  { id: "comparison", label: "Comparison (risers, fallers)", kind: "select", default: "previous", options: [{ value: "previous", label: "Previous N" }, { value: "std", label: "Season excl. recent" }] },
  { id: "minGp", label: "Min season GP", kind: "number", default: 5, min: 1, max: 82, step: 1 },
  { id: "position", label: "Position", kind: "select", default: "all", options: SKATER_POSITION_OPTIONS },
];

/** Leaders rank BSH per game in the window. Risers and fallers need a full recent window and a baseline at least as long. */
export function buildBshBoard(season: SkaterSeason, settings: BshBoardSettings): SharePostLoadResult<BshBoardData> {
  const pool = skaterCohort(season.appearances, settings), leaders = settings.view === "leaders";
  let missingComponent = 0, shortWindow = 0;
  const candidates = pool.flatMap((rows): (Omit<BshRow, "rank" | keyof SkaterIdentity> & { id: SkaterIdentity })[] => {
    const recent = skaterWindowOf(rows, settings.window);
    if (leaders) {
      const totals = bshTotals(recent.rows);
      if (totals.bsh === null) { missingComponent++; return []; }
      return [{ id: skaterIdentity(recent.rows), recent: totals, baseline: null, delta: null }];
    }
    const base = baselineOf(rows, settings.window, settings.comparison);
    if (recent.short || base.actual < recent.requested!) { shortWindow++; return []; }
    const totals = bshTotals(recent.rows), baseline = bshTotals(base.rows);
    if (totals.bshPerGame === null || baseline.bshPerGame === null) { missingComponent++; return []; }
    return [{ id: skaterIdentity(recent.rows), recent: totals, baseline, delta: tieSafe(totals.bshPerGame - baseline.bshPerGame) }];
  });
  const board = (entries: typeof candidates, limit: number, value: (row: typeof candidates[number]) => number | null, direction: "high" | "low") => {
    const ranked = competitionRanks(entries, value, row => row.id.playerId, direction);
    const rows: BshRow[] = ranked.slice(0, limit).map(({ row: { id, ...row }, rank }) => ({ ...id, rank, ...row }));
    const lastRank = rows[rows.length - 1]?.rank;
    return { rows, ranked: ranked.length, notShown: ranked.length - rows.length, tied: ranked.slice(rows.length).filter(row => row.rank === lastRank).length };
  };
  const top = leaders ? board(candidates, BSH_LEADER_ROWS, row => row.recent.bshPerGame, "high") : null;
  const up = leaders ? null : board(candidates.filter(row => row.delta! > 0), BSH_MOVER_ROWS, row => row.delta, "high");
  const down = leaders ? null : board(candidates.filter(row => row.delta! < 0), BSH_MOVER_ROWS, row => row.delta, "low");
  const comparisonLabel = bshComparisonLabel(settings), flat = leaders ? 0 : candidates.filter(row => row.delta === 0).length;
  const counted = top ? `${top.ranked} ranked` : `${candidates.length} comparable, ${up!.ranked} risers, ${down!.ranked} fallers`;
  const below = top ? [belowTheCard(top.notShown, top.tied)] : [up!.notShown ? `risers: ${belowTheCard(up!.notShown, up!.tied)}` : "", down!.notShown ? `fallers: ${belowTheCard(down!.notShown, down!.tied)}` : ""];
  const excluded = [missingComponent ? `${missingComponent} unranked for a missing component` : "", shortWindow ? `${shortWindow} short of a full comparison` : "", flat ? `${flat} unchanged` : "", ...below].filter(Boolean).join(", ");
  const windowLabel = skaterWindowLabel(settings.window), shown = top ? top.rows : [...up!.rows, ...down!.rows];
  return {
    ...skaterSeasonEvidence(season, { windowLabel: comparisonLabel ? `${windowLabel} vs ${comparisonLabel}` : windowLabel, cohort: `${skaterCohortLabel(settings)}: ${pool.length} eligible, ${counted}${excluded ? `, ${excluded}` : ""}`, note: leaders ? "Ranked by BSH per game. A missing component leaves a skater unranked; shot attempts never stand in. The bar splits each skater's BSH per game into blocks, shots and hits." : "Ranked by the change in BSH per game. Both windows must be full. The bar splits each skater's recent-window BSH per game into blocks, shots and hits." }),
    data: {
      applied: shareSettingsKey(BSH_FIELDS, settings), view: settings.view, through: season.through, windowLabel, comparisonLabel,
      rows: top?.rows ?? [], risers: up?.rows ?? [], fallers: down?.rows ?? [],
      cohort: { eligible: pool.length, comparable: candidates.length, ranked: top ? top.ranked : up!.ranked + down!.ranked, risers: up?.ranked ?? 0, fallers: down?.ranked ?? 0, missingComponent, shortWindow, flat },
      notShown: top ? top.notShown : up!.notShown + down!.notShown, tiedBeyondCut: top ? top.tied : up!.tied + down!.tied,
    },
    teams: shownTeams(shown),
  };
}
export const bshBoardCurrent = (data: BshBoardData, settings: BshBoardSettings) => data.applied === shareSettingsKey(BSH_FIELDS, settings);

const fixed = (value: number | null) => value === null ? "missing" : value.toFixed(2);
const altRows = (rows: readonly BshRow[]) => rows.map(row => `${row.rank}. ${row.name}: ${fixed(row.recent.bshPerGame)} BSH per game (BLK ${fixed(row.recent.blocksPerGame)}, SOG ${fixed(row.recent.shotsPerGame)}, HITS ${fixed(row.recent.hitsPerGame)}) in ${row.recent.games} GP${row.delta === null ? "" : `, change ${row.delta.toFixed(2)}`}`).join("; ");
export const bshBoardModule = defineShareModule<BshBoardSettings, BshBoardData>({
  id: "bsh-board", title: "BSH Board", summary: "BLK + SOG + HITS leaders, risers and fallers, with all three components per game.", group: "skaters", basis: "observed",
  suggestedUse: "Works for a midweek category post; choose it on any day.",
  fields: BSH_FIELDS,
  validate: settings => settings.view !== "leaders" && settings.window === "std" ? "Risers and fallers compare a recent window: choose L5 or L10." : null,
  load: () => import("./bshBoard.sources").then(sources => sources.loadBshBoard),
  card: () => import("components/SocialShare/modules/BshBoardCard").then(card => card.default),
  hasRows: (data, settings) => data.rows.length + data.risers.length + data.fallers.length > 0 && bshBoardCurrent(data, settings),
  altText: (snapshot, data) => `FHFH BSH ${data.view === "leaders" ? "leaders" : "risers and fallers"}, ${data.windowLabel}${data.comparisonLabel ? ` versus ${data.comparisonLabel}` : ""}, through ${data.through}. ${data.view === "leaders" ? altRows(data.rows) : `Risers: ${altRows(data.risers) || "none"}. Fallers: ${altRows(data.fallers) || "none"}`}. ${snapshot.evidence.cohort}.`,
});
