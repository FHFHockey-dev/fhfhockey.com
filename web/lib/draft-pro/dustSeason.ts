export type DustScheduleSeasonMetadata = {
  id?: number;
  game_key: string;
  season: string;
  source_season_id: number;
};

export type DustScheduleSeasonResolution = {
  projectionSeason: string;
  gameKey: string;
  yahooSeason: string;
  sourceSeasonId: number;
};

export class DustScheduleSeasonUnavailableError extends Error {
  statusCode = 503;
  code = "schedule_season_unavailable";
}

export class DustProjectionSeasonMismatchError extends Error {
  statusCode = 400;
  code = "projection_season_mismatch";
}

function unavailable(message: string): never {
  throw new DustScheduleSeasonUnavailableError(message);
}

/**
 * Resolves only a persisted NHL-season to Yahoo-season/game-key mapping.
 * No calendar or provider inference is permitted on the premium request path.
 */
export function resolveDustScheduleSeason(
  projectionSeason: string,
  rows: readonly DustScheduleSeasonMetadata[],
  requestedGameKey?: string,
): DustScheduleSeasonResolution {
  if (!/^\d{8}$/.test(projectionSeason)) {
    return unavailable("DUST requires a canonical NHL projection season id.");
  }
  const sourceSeasonId = Number(projectionSeason);
  const mappings = new Map<string, DustScheduleSeasonMetadata>();
  for (const row of rows) {
    if (row.source_season_id !== sourceSeasonId || !row.game_key || !row.season) continue;
    mappings.set(`${row.game_key}|${row.season}`, row);
  }
  if (mappings.size === 0) {
    return unavailable("No persisted Yahoo schedule mapping is available for this projection season.");
  }
  if (mappings.size !== 1) {
    return unavailable("The persisted Yahoo schedule mapping for this projection season is ambiguous.");
  }
  const mapping = [...mappings.values()][0]!;
  if (requestedGameKey && requestedGameKey !== mapping.game_key) {
    return unavailable("The requested Yahoo game key does not match the persisted projection-season mapping.");
  }
  return { projectionSeason, gameKey: mapping.game_key, yahooSeason: mapping.season, sourceSeasonId };
}

export function assertDustScheduleRowsMatchResolution(
  rows: readonly DustScheduleSeasonMetadata[],
  resolution: DustScheduleSeasonResolution,
) {
  if (rows.length === 0) {
    return unavailable("No schedule rows are available for the requested DUST window.");
  }
  if (rows.some((row) => row.source_season_id !== resolution.sourceSeasonId || row.game_key !== resolution.gameKey || row.season !== resolution.yahooSeason)) {
    return unavailable("Schedule rows do not match the persisted projection-season mapping.");
  }
}

/** Validates caller projection labels before converting every evaluator input to NHL season id. */
export function normalizeDustProjectionSeason<T extends { projectionSeason: string }>(
  players: readonly T[],
  projectionSeason: string,
  canonicalSeason: string,
): T[] {
  if (players.some((player) => player.projectionSeason !== projectionSeason)) {
    throw new DustProjectionSeasonMismatchError("All DUST projections must use the requested projection season.");
  }
  return players.map((player) => ({ ...player, projectionSeason: canonicalSeason }));
}
