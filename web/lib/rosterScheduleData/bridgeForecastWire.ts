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
