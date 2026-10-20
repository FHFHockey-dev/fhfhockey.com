import type { GameForecast, PlanningGame, PlanningPlayer, StatLine } from "lib/rosterScheduleOptimizer/planningTypes";

export const FORGE_DAILY_BRIDGE_VERSION = "forge-daily-bridge-v1";
export const BRIDGE_FORECAST_WIRE_VERSION = "forge-daily-bridge-wire-v1" as const;

/** Run fields every row of one FORGE run shares: revisionId, sourceWatermark, modelVersion, issuedAt, cutoffAt. */
type WireRun = [revisionId: string, sourceWatermark: string, modelVersion: string, issuedAt: string, cutoffAt: string];
type WireRow = [playerId: string, gameId: string, run: number, expiresAt: string, stats: StatLine,
  startProbability: number | null, confirmedStart: boolean, conditionalStats: StatLine | null];
/**
 * Interim bridge projections repeat the same provenance on every player-game: the issued context is the player's and
 * game's own identity, and the run fields are shared. The wire keeps only what differs per row and the client
 * rebuilds the identical forecast, so the planner and its checks see exactly what the server built.
 */
export type BridgeForecastWire = { version: typeof BRIDGE_FORECAST_WIRE_VERSION; seasonId: number;
  runs: WireRun[]; limitations: string[]; rows: WireRow[] };
type Inputs = { players: PlanningPlayer[]; games: PlanningGame[] };

const ALLOWED_USES = { assignment: true, totals: true, comparison: true, conditionalTieBreak: false };
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
  : value && typeof value === "object" ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`
    : JSON.stringify(value) ?? "null";

function lookup({ players, games }: Inputs) {
  const playerById = new Map(players.map(player => [player.id, player]));
  const gameBySide = new Map(games.map(game => [`${game.id}|${game.teamAbbreviation}`, game]));
  return (playerId: string, gameId: string) => {
    const player = playerById.get(playerId);
    const game = player ? gameBySide.get(`${gameId}|${player.teamAbbreviation}`) : undefined;
    return player && game ? { player, game } : null;
  };
}

function expandRow(row: WireRow, run: WireRun, limitations: string[], seasonId: number, player: PlanningPlayer, game: PlanningGame): GameForecast {
  const [playerId, gameId, , expiresAt, stats, startProbability, confirmedStart, conditionalStats] = row;
  const [revisionId, sourceWatermark, modelVersion, issuedAt, cutoffAt] = run;
  return { sourceKind: "detailed", cutoffAt, expiresAt, sourceWatermark,
    issuedContext: { version: "forge-issued-context-v1", playerId, gameId, nhlPlayerId: player.nhlId!, seasonId,
      teamId: player.nhlTeamId!, scheduledAt: game.startsAt!, scheduleRevision: game.scheduleRevision!, rosterRevision: player.rosterRevision!,
      observedAt: issuedAt, scheduleSourceUpdatedAt: null, scheduleFetchedAt: null, identityUpdatedAt: null, membershipCreatedAt: [] },
    allowedUses: { ...ALLOWED_USES }, ...(conditionalStats ? { conditionalStats } : {}),
    playerId, gameId, stats, conditioning: "unconditional", startProbability, confirmedStart,
    revisionId, issuedAt, modelVersion, limitations: [...limitations] };
}

/** Moves bridge rows the client can rebuild exactly into the wire; every other forecast stays as it is. */
export function compactBridgeForecasts(forecasts: GameForecast[], inputs: Inputs, seasonId: number): { forecasts: GameForecast[]; wire: BridgeForecastWire | null } {
  const find = lookup(inputs);
  const runs: WireRun[] = [], runIndex = new Map<string, number>(), rows: WireRow[] = [], kept: GameForecast[] = [];
  let limitations: string[] | null = null;
  for (const forecast of forecasts) {
    const match = forecast.revisionId?.startsWith(`${FORGE_DAILY_BRIDGE_VERSION}:`) ? find(forecast.playerId, forecast.gameId) : null;
    limitations ??= match ? forecast.limitations : null;
    if (!match || !forecast.expiresAt || !forecast.sourceWatermark || !forecast.modelVersion || !forecast.cutoffAt || !limitations) { kept.push(forecast); continue; }
    const run: WireRun = [forecast.revisionId, forecast.sourceWatermark, forecast.modelVersion, forecast.issuedAt, forecast.cutoffAt];
    const index = runIndex.get(canonical(run)) ?? runs.length;
    const row: WireRow = [forecast.playerId, forecast.gameId, index, forecast.expiresAt, forecast.stats,
      forecast.startProbability, forecast.confirmedStart, forecast.conditionalStats ?? null];
    // Only rows the client rebuilds exactly leave the forecast list, so the wire is lossless.
    if (canonical(expandRow(row, run, limitations, seasonId, match.player, match.game)) !== canonical(forecast)) { kept.push(forecast); continue; }
    if (index === runs.length) { runs.push(run); runIndex.set(canonical(run), index); }
    rows.push(row);
  }
  return { forecasts: kept, wire: rows.length ? { version: BRIDGE_FORECAST_WIRE_VERSION, seasonId, runs, limitations: limitations ?? [], rows } : null };
}

const isStatLine = (value: unknown): value is StatLine => !!value && typeof value === "object" && !Array.isArray(value)
  && Object.values(value).every(item => item === null || typeof item === "number" && Number.isFinite(item));
const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 200;

/** Rebuilds bridge forecasts beside the data they came with. A missing or malformed wire adds nothing. */
export function expandBridgeForecasts(wire: unknown, inputs: Inputs): GameForecast[] {
  if (!wire || typeof wire !== "object") return [];
  const { version, seasonId, runs, limitations, rows } = wire as Partial<BridgeForecastWire>;
  if (version !== BRIDGE_FORECAST_WIRE_VERSION || !Number.isSafeInteger(seasonId) || !Array.isArray(runs) || !Array.isArray(rows)
    || !Array.isArray(limitations) || !limitations.every(isText)
    || !runs.every(run => Array.isArray(run) && run.length === 5 && run.every(isText))) return [];
  const find = lookup(inputs), result: GameForecast[] = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== 8) continue;
    const [playerId, gameId, run, expiresAt, stats, startProbability, confirmedStart, conditionalStats] = row;
    if (!isText(playerId) || !isText(gameId) || !Number.isSafeInteger(run) || !runs[run] || !isText(expiresAt) || !isStatLine(stats)
      || !(startProbability === null || typeof startProbability === "number" && startProbability >= 0 && startProbability <= 1)
      || typeof confirmedStart !== "boolean" || !(conditionalStats === null || isStatLine(conditionalStats))) continue;
    const match = find(playerId, gameId);
    if (match) result.push(expandRow(row, runs[run], limitations, seasonId!, match.player, match.game));
  }
  return result;
}

/** Wire size of one forecast as the bridge budget counts it. */
export function bridgeWireRowBytes(forecast: GameForecast): number {
  return JSON.stringify([forecast.playerId, forecast.gameId, 0, forecast.expiresAt, forecast.stats, forecast.startProbability,
    forecast.confirmedStart, forecast.conditionalStats ?? null]).length + 1;
}

const PACKED_KEY = "bridgeForecastWire";
type SnapshotLike = Inputs & { forecasts: GameForecast[]; context: { seasonId: number } };
const isSnapshotLike = (value: Record<string, unknown>): value is SnapshotLike => Array.isArray(value.forecasts)
  && Array.isArray(value.players) && Array.isArray(value.games) && !!value.context && typeof value.context === "object"
  && Number.isSafeInteger((value.context as { seasonId?: unknown }).seasonId);

/**
 * Compacts interim bridge rows inside every planning snapshot in a JSON value (workspace saves and loads,
 * preservation backups and journals). A snapshot is packed only when every forecast in it rebuilds exactly,
 * so unpacking restores the same rows in the same order and backup checksums are unchanged.
 */
export function packPlanningSnapshots<T>(value: T): T {
  if (Array.isArray(value)) return value.map(packPlanningSnapshots) as T;
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if (isSnapshotLike(record) && record.forecasts.length) {
    const { forecasts, wire } = compactBridgeForecasts(record.forecasts, record, record.context.seasonId);
    if (wire && !forecasts.length) return { ...Object.fromEntries(Object.entries(record).map(([key, item]) =>
      [key, key === "forecasts" ? [] : packPlanningSnapshots(item)])), [PACKED_KEY]: wire } as T;
  }
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, packPlanningSnapshots(item)])) as T;
}

/** Restores every snapshot `packPlanningSnapshots` compacted; values without packed snapshots come back unchanged. */
export function unpackPlanningSnapshots<T>(value: T): T {
  if (Array.isArray(value)) return value.map(unpackPlanningSnapshots) as T;
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const entries = Object.entries(record).filter(([key]) => key !== PACKED_KEY).map(([key, item]) => [key, unpackPlanningSnapshots(item)] as const);
  const result = Object.fromEntries(entries) as Record<string, unknown>;
  if (PACKED_KEY in record && Array.isArray(result.forecasts) && Array.isArray(result.players) && Array.isArray(result.games)) {
    const rows = (record[PACKED_KEY] as { rows?: unknown })?.rows;
    const expanded = expandBridgeForecasts(record[PACKED_KEY], result as Inputs);
    // A packed snapshot that does not rebuild completely is unusable, never silently partial.
    if (!Array.isArray(rows) || expanded.length !== rows.length) throw new Error("Packed planning snapshot could not be restored.");
    result.forecasts = [...result.forecasts as GameForecast[], ...expanded];
  }
  return result as T;
}
