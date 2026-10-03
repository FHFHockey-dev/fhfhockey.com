import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { finalBoxscoreForGame, parseTimeOnIceSeconds, rawPlayerForOutput } from "./settlement";
import { baselineProjectionSchemas, type BaselineProjectionSchema, type BaselineProjectionReceipt } from "./baselinePolicy";
import type { BaselineAppearanceInput, BaselineProjectionInput } from "./baselineRates";
import type { GoalieAppearanceInput, GoalieProjectionInput } from "./goalieBaselineRates";
import { acceptedNewsSupersedes } from "../projections/acceptedNews";

export type BaselineProjectionSelection = Record<string, Record<number, { rowId: string; contentHash: string }>>;
export type BaselineProjectionSelectionReceipt = {
  version: "baseline-projection-selection-v1";
  nhlPlayerId: number;
  seasonId: number;
  importCompleteness: "unverified";
  publicationAt: null;
  sources: Array<{ sourceId: string; tableName: string | null; status: BaselineProjectionReceipt["status"];
    selectionMode: "explicit" | "unique_current" | "excluded";
    requestedRow: { rowId: string; contentHash: string } | null;
    row: Record<string, any> | null; contentHash: string | null }>;
};
export type BaselineBoxscoreReceipt = {
  payloadHash: string; fetchedAt: string; contentHash: string;
  rawRow: Record<string, any>; game: Record<string, any>;
  appearanceSeconds: number;
};

/** Private captured lineage; complete normalization is not complete historical discovery. */
export type BaselineHistoricalSourceReceipt = {
  version: "baseline-history-sources-v1";
  nhlPlayerId: number;
  seasonId: number;
  upperDate: string;
  populationCoverage: "unverified";
  games: Array<{ game: Record<string, any>; roster: Record<string, any> | null;
    normalization: Record<string, any> | null }>;
};

export const BASELINE_NORMALIZATION_COLUMNS = ["game_id", "season_id", "game_date", "status",
  "normalization_version", "normalization_fingerprint", "source_fingerprint", "parser_fingerprint",
  "parser_version", "strength_version", "materializer_version", "pbp_raw_payload_id", "pbp_raw_snapshot_version",
  "pbp_raw_payload_hash", "shift_raw_payload_id", "shift_raw_snapshot_version", "shift_raw_payload_hash",
  "roster_fingerprint", "event_fingerprint", "shift_fingerprint", "expected_roster_rows", "observed_roster_rows",
  "expected_event_rows", "observed_event_rows", "expected_shift_rows", "observed_shift_rows", "completed_at", "updated_at"] as const;
export const BASELINE_HISTORICAL_ROSTER_COLUMNS = ["game_id", "player_id", "team_id", "season_id", "game_date",
  "source_play_by_play_hash", "parser_version"] as const;

export class MissingBaselineBoxscoreError extends Error {
  readonly code = "missing_retained_boxscore";
  constructor(readonly gameId: number, readonly seasonId: number, readonly nhlPlayerId: number) {
    super("Baseline appearance is missing retained boxscore content");
    this.name = "MissingBaselineBoxscoreError";
  }
}

const positiveId = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;
function historicalDateInScope(value: unknown, upperDate: string): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value && value <= upperDate;
}

/** Validate canonical context even when a roster opportunity is outside the regular-season rate scope. */
export function baselineHistoricalGameHash(game: Record<string, any>, scope: { seasonId: number; upperDate: string }) {
  if (!positiveId(game.id) || ![scope.seasonId - 10001, scope.seasonId].includes(game.seasonId)
    || !positiveId(game.type) || !historicalDateInScope(game.date, scope.upperDate)
    || !Number.isFinite(Date.parse(game.startTime)) || !positiveId(game.homeTeamId)
    || !positiveId(game.awayTeamId) || game.homeTeamId === game.awayTeamId) {
    throw new Error("Baseline historical canonical game context is invalid");
  }
  return playerForecastSourcePayloadHash({ id: game.id, date: game.date, seasonId: game.seasonId,
    type: game.type, startTime: new Date(game.startTime).toISOString(),
    homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId });
}

/** Validate the complete paginated scope before historical roster maps can hide conflicts. */
export function validateBaselineHistoricalScope(histories: Record<string, any>[], rosters: Record<string, any>[],
  scope: { nhlIds: number[]; seasonId: number; upperDate: string }): void {
  const players = new Set(scope.nhlIds), seasons = new Set([scope.seasonId - 10001, scope.seasonId]);
  const seenHistories = new Set<string>(), seenRosters = new Set<string>();
  const games = new Map<number, Record<string, any>>();
  const gameHashes = new Map<number, string>();
  for (const row of histories) {
    const key = `${row.gameId}:${row.playerId}`, game = row.games;
    if (!positiveId(row.gameId) || !players.has(row.playerId) || seenHistories.has(key)
      || !game || game.id !== row.gameId || game.type !== 2) {
      throw new Error("Baseline historical game/player scope is invalid or duplicated");
    }
    const hash = baselineHistoricalGameHash(game, scope);
    if (gameHashes.has(game.id) && gameHashes.get(game.id) !== hash) {
      throw new Error("Baseline historical canonical game contexts conflict");
    }
    seenHistories.add(key); games.set(game.id, game); gameHashes.set(game.id, hash);
  }
  for (const row of rosters) {
    const key = `${row.game_id}:${row.player_id}`, game = games.get(row.game_id);
    if (!positiveId(row.game_id) || !players.has(row.player_id) || !positiveId(row.team_id)
      || !seasons.has(row.season_id) || !historicalDateInScope(row.game_date, scope.upperDate) || seenRosters.has(key)
      || game && (row.season_id !== game.seasonId || row.game_date !== game.date
        || ![game.homeTeamId, game.awayTeamId].includes(row.team_id))) {
      throw new Error("Baseline historical roster scope is invalid or duplicated");
    }
    seenRosters.add(key);
  }
}

export function baselineHistoricalSources(histories: Record<string, any>[], rosters: Record<string, any>[],
  manifests: Record<string, any>[], scope: { nhlIds: number[]; seasonId: number; upperDate: string },
  nhlPlayerId: number): BaselineHistoricalSourceReceipt {
  validateBaselineHistoricalScope(histories, rosters, scope);
  if (!scope.nhlIds.includes(nhlPlayerId)) throw new Error("Baseline historical source player is outside its scope");
  const games = new Map(histories.map(row => [row.gameId, row.games]));
  const rosterCounts = new Map<number, number>();
  for (const row of rosters) rosterCounts.set(row.game_id, (rosterCounts.get(row.game_id) ?? 0) + 1);
  const byGame = new Map<number, Record<string, any>>();
  for (const row of manifests) {
    const game = games.get(row.game_id);
    if (!game || byGame.has(row.game_id) || row.season_id !== game.seasonId || row.game_date !== game.date
      || !["complete", "stale"].includes(row.status)
      || ["normalization_version", "parser_version", "strength_version", "pbp_raw_payload_id", "pbp_raw_snapshot_version",
        "shift_raw_payload_id", "shift_raw_snapshot_version"].some(key => !positiveId(row[key]))
      || ["normalization_fingerprint", "source_fingerprint", "parser_fingerprint", "pbp_raw_payload_hash",
        "shift_raw_payload_hash", "roster_fingerprint", "event_fingerprint", "shift_fingerprint"]
        .some(key => typeof row[key] !== "string" || !/^[a-f0-9]{64}$/.test(row[key]))
      || typeof row.materializer_version !== "string" || !row.materializer_version.trim()
      || !Number.isFinite(Date.parse(row.completed_at)) || !Number.isFinite(Date.parse(row.updated_at))
      || acceptedNewsSupersedes(row.completed_at, row.updated_at)
      || ["roster", "event", "shift"].some((kind, index) => !Number.isSafeInteger(row[`expected_${kind}_rows`])
        || row[`expected_${kind}_rows`] < 0 || row[`expected_${kind}_rows`] > [100, 2000, 20000][index]
        || row[`expected_${kind}_rows`] !== row[`observed_${kind}_rows`])
      || row.status === "complete" && (rosterCounts.get(row.game_id) ?? 0) > row.observed_roster_rows) {
      throw new Error("Baseline historical normalization manifest is invalid or outside its scope");
    }
    byGame.set(row.game_id, Object.fromEntries(BASELINE_NORMALIZATION_COLUMNS.map(key => [key, row[key]])));
  }
  const selectedRosters = new Map(rosters.filter(row => row.player_id === nhlPlayerId)
    .map(row => [row.game_id, row]));
  const selectedGames = histories.filter(row => row.playerId === nhlPlayerId).sort((a, b) => a.gameId - b.gameId);
  return { version: "baseline-history-sources-v1", nhlPlayerId, seasonId: scope.seasonId,
    upperDate: scope.upperDate, populationCoverage: "unverified", games: selectedGames.map(row => {
      const game = games.get(row.gameId)!, roster = selectedRosters.get(row.gameId), normalization = byGame.get(row.gameId);
      if (normalization?.status === "complete" && roster
        && (roster.source_play_by_play_hash !== normalization.pbp_raw_payload_hash
          || roster.parser_version !== normalization.parser_version)) {
        throw new Error("Baseline historical roster conflicts with its complete normalization manifest");
      }
      return { game: { id: game.id, date: game.date, seasonId: game.seasonId, type: game.type,
        startTime: game.startTime, homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId },
      roster: roster ? Object.fromEntries(BASELINE_HISTORICAL_ROSTER_COLUMNS.map(key => [key, roster[key] ?? null])) : null,
      normalization: normalization ?? null };
    }) };
}

export function baselineHistoricalSourceLimitations(receipt: BaselineHistoricalSourceReceipt): string[] {
  const complete = receipt.games.filter(row => row.normalization?.status === "complete").length;
  const stale = receipt.games.filter(row => row.normalization?.status === "stale").length;
  return [`Historical normalization lineage: ${complete} complete, ${stale} stale, ${receipt.games.length - complete - stale} missing among ${receipt.games.length} discovered games.`,
    "Normalization manifests cover roster/PBP/shift scopes; historical appearance-population completeness remains unverified."];
}

/** Recheck retained context and source versions before a capture may be persisted or consumed. */
export function verifyBaselineHistoricalSources(receipt: BaselineHistoricalSourceReceipt | undefined,
  appearances: Record<string, any>[], nhlPlayerId: number, seasonId: number, cutoffAt: string,
  limitations: readonly string[]) {
  if (!receipt || receipt.version !== "baseline-history-sources-v1" || receipt.nhlPlayerId !== nhlPlayerId
    || receipt.seasonId !== seasonId || receipt.upperDate !== cutoffAt.slice(0, 10)
    || receipt.populationCoverage !== "unverified" || !Array.isArray(receipt.games) || receipt.games.length > 3000) {
    throw new Error("Baseline capture historical source receipt is missing or incompatible");
  }
  if (!baselineHistoricalSourceLimitations(receipt).every(value => limitations.includes(value))) {
    throw new Error("Baseline historical source limitations are missing or inconsistent");
  }
  const derived = baselineHistoricalSources(receipt.games.map(row => ({ gameId: row.game.id,
    playerId: nhlPlayerId, games: row.game })), receipt.games.flatMap(row => row.roster ? [row.roster] : []),
  receipt.games.flatMap(row => row.normalization ? [row.normalization] : []),
  { nhlIds: [nhlPlayerId], seasonId, upperDate: receipt.upperDate }, nhlPlayerId);
  if (playerForecastSourcePayloadHash(derived) !== playerForecastSourcePayloadHash(receipt)
    || receipt.games.some(row => row.normalization && (acceptedNewsSupersedes(row.normalization.completed_at, cutoffAt)
      || acceptedNewsSupersedes(row.normalization.updated_at, cutoffAt)))) {
    throw new Error("Baseline historical source receipt changed or exceeds its capture cutoff");
  }
  const byGame = new Map(receipt.games.map(row => [row.game.id, row]));
  for (const appearance of appearances) {
    const row = byGame.get(appearance.gameId);
    if (!row?.roster || row.roster.team_id !== appearance.teamId
      || baselineHistoricalGameHash(row.game, { seasonId, upperDate: receipt.upperDate })
        !== baselineHistoricalGameHash(appearance.finalBoxscore.game, { seasonId, upperDate: receipt.upperDate })) {
      throw new Error("Baseline appearance is outside its captured historical source lineage");
    }
  }
}

export function baselineNumber(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

export function baselineProjectionContentHash(schema: BaselineProjectionSchema, row: Record<string, any>): string {
  const columns = ["player_id", "upload_batch_id", schema.appearanceColumn,
    ...(schema.startColumn ? [schema.startColumn] : []), ...schema.statMappings.map(mapping => mapping.dbColumnName)];
  return playerForecastSourcePayloadHash({ sourceId: schema.id, tableName: schema.tableName,
    row: Object.fromEntries([...new Set(columns)].sort().map(column => [column, row[column] ?? null])) });
}

/** Select current row versions explicitly; row UUIDs do not establish import completion or publication. */
export function baselineProjectionSelectionReceipt(sources: Array<{ schema: BaselineProjectionSchema;
  rows: Record<string, any>[]; status: BaselineProjectionReceipt["status"] }>, nhlPlayerId: number, seasonId: number,
  selection?: BaselineProjectionSelection): BaselineProjectionSelectionReceipt {
  const selectedSources = sources.map(({ schema, rows, status }) => {
    const selected = selection?.[schema.id], requestedRow = selected?.[nhlPlayerId] ?? null;
    const matching = rows.filter(row => row.player_id === nhlPlayerId);
    if (matching.length > 1) throw new Error(`Ambiguous baseline projection row: ${schema.id}`);
    const row = matching[0] ?? null;
    const selectionMode: BaselineProjectionSelectionReceipt["sources"][number]["selectionMode"] =
      selected ? requestedRow ? "explicit" : "excluded" : "unique_current";
    const contentHash = row ? baselineProjectionContentHash(schema, row) : null;
    if (status !== "available" && row || selectionMode === "excluded" && row
      || requestedRow && status === "available" && (!row || String(row.upload_batch_id) !== requestedRow.rowId
        || contentHash !== requestedRow.contentHash)) throw new Error("Baseline projection selection is inconsistent");
    return { sourceId: schema.id, tableName: schema.tableName, status, selectionMode,
      requestedRow: requestedRow ? { ...requestedRow } : null, row, contentHash };
  });
  return { version: "baseline-projection-selection-v1", nhlPlayerId, seasonId,
    importCompleteness: "unverified", publicationAt: null, sources: selectedSources };
}

export function baselineProjectionSelectionLimitations(receipt: BaselineProjectionSelectionReceipt): string[] {
  const excluded = receipt.sources.filter(row => row.selectionMode === "excluded").length;
  return ["Projection row versions cover the captured requested-player scope; complete imports and original publication times remain unverified.",
    ...(excluded ? [`Excluded ${excluded} projection sources by explicit row selection.`] : [])];
}

export function verifyBaselineProjectionSelection(receipt: BaselineProjectionSelectionReceipt | undefined,
  projections: Array<BaselineProjectionInput | GoalieProjectionInput>, sourceReceipts: BaselineProjectionReceipt[],
  nhlPlayerId: number, seasonId: number, cutoffAt: string, population: "skater" | "goalie", limitations: readonly string[]) {
  const schemas = baselineProjectionSchemas(population, seasonId);
  if (!receipt || receipt.version !== "baseline-projection-selection-v1" || receipt.nhlPlayerId !== nhlPlayerId
    || receipt.seasonId !== seasonId || receipt.importCompleteness !== "unverified" || receipt.publicationAt !== null
    || !Array.isArray(receipt.sources) || receipt.sources.length !== schemas.length
    || sourceReceipts.length !== schemas.length) throw new Error("Baseline projection selection receipt is missing or incompatible");
  const selection: BaselineProjectionSelection = {};
  const sources = receipt.sources.map((source, index) => {
    const schema = schemas[index], observed = sourceReceipts[index];
    if (source.sourceId !== schema.id || source.tableName !== schema.tableName
      || !["available", "table_unavailable", "no_versioned_schema"].includes(source.status)
      || (schema.tableName === null) !== (source.status === "no_versioned_schema")
      || observed.sourceId !== source.sourceId || observed.tableName !== source.tableName
      || observed.status !== source.status || observed.rowCount !== (source.row ? 1 : 0)
      || !["explicit", "unique_current", "excluded"].includes(source.selectionMode)
      || source.selectionMode === "explicit" && (!source.requestedRow?.rowId?.trim()
        || !/^[a-f0-9]{64}$/.test(source.requestedRow.contentHash))
      || source.selectionMode !== "explicit" && source.requestedRow !== null
      || source.row && (source.row.player_id !== nhlPlayerId || !String(source.row.upload_batch_id ?? "").trim()
        || baselineProjectionContentHash(schema, source.row) !== source.contentHash)
      || !source.row && source.contentHash !== null) throw new Error("Baseline projection source selection is inconsistent");
    if (source.selectionMode !== "unique_current") selection[source.sourceId] = source.requestedRow
      ? { [nhlPlayerId]: source.requestedRow } : {};
    return { schema, rows: source.row ? [source.row] : [], status: source.status };
  });
  const derived = baselineProjectionSelectionReceipt(sources, nhlPlayerId, seasonId, selection);
  const selectedProjections = sources.flatMap(({ schema, rows }) => rows.flatMap(row => {
    const projection = population === "goalie" ? baselineProjectionFromRow(schema, row, seasonId, cutoffAt, true)
      : baselineProjectionFromRow(schema, row, seasonId, cutoffAt);
    return projection ? [projection] : [];
  }));
  if (playerForecastSourcePayloadHash(derived) !== playerForecastSourcePayloadHash(receipt)
    || playerForecastSourcePayloadHash(selectedProjections) !== playerForecastSourcePayloadHash(projections)
    || !baselineProjectionSelectionLimitations(receipt).every(value => limitations.includes(value))) {
    throw new Error("Baseline projection selection, derived values or limitations do not match the captured receipt");
  }
}

/** Capture the actual selected row, not just its mutable-table UUID. */
export function baselineProjectionFromRow(schema: BaselineProjectionSchema, row: Record<string, any>,
  seasonId: number, availableAt: string, goalie?: false): BaselineProjectionInput | null;
export function baselineProjectionFromRow(schema: BaselineProjectionSchema, row: Record<string, any>,
  seasonId: number, availableAt: string, goalie: true): GoalieProjectionInput | null;
export function baselineProjectionFromRow(schema: BaselineProjectionSchema, row: Record<string, any>,
  seasonId: number, availableAt: string, goalie = false): BaselineProjectionInput | GoalieProjectionInput | null {
  if (!schema.tableName) return null;
  const projectedAppearances = baselineNumber(row[schema.appearanceColumn]);
  if (projectedAppearances == null || projectedAppearances <= 0) return null;
  if (row.upload_batch_id == null || !String(row.upload_batch_id).trim()) throw new Error("Baseline projection lacks upload lineage");
  const totals = Object.fromEntries(schema.statMappings.map(mapping => [mapping.key, baselineNumber(row[mapping.dbColumnName])]));
  if (goalie) {
    const saves = totals.SAVES_GOALIE, goalsAgainst = totals.GOALS_AGAINST_GOALIE;
    totals.SHOTS_AGAINST_GOALIE = saves != null && saves >= 0 && goalsAgainst != null && goalsAgainst >= 0
      ? saves + goalsAgainst : null;
  }
  const common = { sourceId: schema.id, sourceTable: schema.tableName!, sourceRowId: String(row.upload_batch_id),
    sourceContentHash: baselineProjectionContentHash(schema, row), sourcePayload: row,
    seasonId, availableAt, projectedAppearances, totals };
  return goalie ? { ...common, projectedStarts: schema.startColumn ? baselineNumber(row[schema.startColumn]) : null } : common;
}

/** Missing raw components remain missing; percentage fields cannot reconstruct counts. */
export function baselineSkaterTargets(player: Record<string, any>): Record<string, number | null> {
  const count = (key: string) => {
    const value = baselineNumber(player[key]);
    return value != null && Number.isSafeInteger(value) && value >= 0 ? value : null;
  };
  const goals = count("goals"), assists = count("assists");
  const shots = count("sog") ?? count("shots");
  if (count("sog") != null && count("shots") != null && count("sog") !== count("shots")) {
    throw new Error("Conflicting boxscore shot components");
  }
  const points = count("points") ?? (goals != null && assists != null ? goals + assists : null);
  if (points != null && goals != null && assists != null && points !== goals + assists) {
    throw new Error("Conflicting boxscore point components");
  }
  const faceoffs = /^(\d+)\/(\d+)$/.exec(String(player.faceoffs ?? ""));
  return { GOALS: goals, ASSISTS: assists, POINTS: points,
    PLUS_MINUS: Number.isSafeInteger(baselineNumber(player.plusMinus)) ? baselineNumber(player.plusMinus) : null,
    PENALTY_MINUTES: count("pim"),
    HITS: count("hits"), BLOCKED_SHOTS: count("blockedShots"), PP_GOALS: count("powerPlayGoals"),
    PP_POINTS: count("powerPlayPoints"), SH_GOALS: count("shorthandedGoals"), SH_POINTS: count("shPoints"),
    SHOTS_ON_GOAL: shots, FACEOFFS_WON: faceoffs ? Number(faceoffs[1]) : null,
    FACEOFFS_LOST: faceoffs ? Number(faceoffs[2]) : null };
}

export function baselineGoalieComponents(player: Record<string, any>) {
  const match = /^(\d+)\/(\d+)$/.exec(String(player.saveShotsAgainst ?? ""));
  const saves = baselineNumber(player.saves) ?? (match ? Number(match[1]) : null);
  const shotsAgainst = baselineNumber(player.shotsAgainst) ?? (match ? Number(match[2]) : null);
  const goalsAgainst = baselineNumber(player.goalsAgainst);
  const seconds = parseTimeOnIceSeconds(player.toi);
  if (saves == null || shotsAgainst == null || goalsAgainst == null || seconds == null
    || ![saves, shotsAgainst, goalsAgainst].every(Number.isSafeInteger)
    || saves < 0 || goalsAgainst < 0 || saves + goalsAgainst !== shotsAgainst
    || match && (saves !== Number(match[1]) || shotsAgainst !== Number(match[2]))) {
    throw new Error("Incomplete or conflicting boxscore goalie components");
  }
  return { saves, shotsAgainst, goalsAgainst, toiMinutes: seconds / 60 };
}

/** Bind canonical game/team/player and derived values to retained canonical JSON content. */
type AppearanceArgs = {
  rawRow: Record<string, any>; game: Record<string, any>; nhlPlayerId: number; teamId: number;
  cutoffAt: string; population: "skater" | "goalie";
};
export function baselineAppearanceFromBoxscore(args: AppearanceArgs & { population: "skater" }): BaselineAppearanceInput | null;
export function baselineAppearanceFromBoxscore(args: AppearanceArgs & { population: "goalie" }): GoalieAppearanceInput | null;
export function baselineAppearanceFromBoxscore(args: AppearanceArgs): BaselineAppearanceInput | GoalieAppearanceInput | null;
export function baselineAppearanceFromBoxscore(args: AppearanceArgs): BaselineAppearanceInput | GoalieAppearanceInput | null {
  const { rawRow, game } = args;
  const evidence = finalBoxscoreForGame(rawRow, game);
  if (!evidence || rawRow.id == null || !Number.isFinite(Date.parse(args.cutoffAt))
    || !Number.isFinite(Date.parse(game.startTime))
    || acceptedNewsSupersedes(rawRow.fetched_at, args.cutoffAt)
    || evidence.payload.gameDate !== game.date || Number(evidence.payload.gameType) !== 2
    || evidence.payload.startTimeUTC != null && Date.parse(String(evidence.payload.startTimeUTC)) !== Date.parse(game.startTime)
    || Number(game.type) !== 2) throw new Error("Baseline boxscore identity/finality/cutoff is inconsistent");
  const own = rawPlayerForOutput({ team_id: args.teamId, player_id: args.nhlPlayerId }, evidence);
  const player = args.population === "goalie" ? own?.goalie : own?.skater;
  const seconds = parseTimeOnIceSeconds(player?.toi);
  if (!player || seconds == null) throw new Error("Baseline boxscore player or appearance is unverified");
  if (!seconds) return null;
  const finalBoxscore: BaselineBoxscoreReceipt = { payloadHash: String(rawRow.payload_hash),
    fetchedAt: String(rawRow.fetched_at), contentHash: playerForecastSourcePayloadHash(rawRow.payload),
    rawRow, game, appearanceSeconds: seconds };
  const common = { gameId: Number(game.id), seasonId: Number(game.seasonId), gameDate: String(game.date),
    availableAt: args.cutoffAt, teamId: args.teamId, regularSeason: true, finalBoxscore };
  return args.population === "goalie" ? { ...common, ...baselineGoalieComponents(player) }
    : { ...common, targets: baselineSkaterTargets(player) };
}

/** Provider byte hashes and canonical retained-content hashes are deliberately distinct. */
export function verifyBaselineBoxscoreReceipt(appearance: Record<string, any>, nhlPlayerId: number,
  cutoffAt: string, population: "skater" | "goalie") {
  const receipt = appearance.finalBoxscore as BaselineBoxscoreReceipt | undefined;
  if (!receipt?.rawRow || !receipt.game
    || receipt.contentHash !== playerForecastSourcePayloadHash(receipt.rawRow.payload)
    || receipt.payloadHash !== receipt.rawRow.payload_hash || receipt.fetchedAt !== receipt.rawRow.fetched_at) {
    throw new Error("Baseline appearance requires bound retained boxscore content");
  }
  const derived = baselineAppearanceFromBoxscore({ rawRow: receipt.rawRow, game: receipt.game,
    teamId: appearance.teamId, nhlPlayerId, cutoffAt, population });
  if (!derived || playerForecastSourcePayloadHash(derived) !== playerForecastSourcePayloadHash(appearance)) {
    throw new Error("Baseline appearance values do not match retained boxscore content");
  }
}
