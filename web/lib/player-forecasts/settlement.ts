import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAYER_FORECAST_SCORING_VERSION } from "./researchContract";

const PROVISIONAL_DELAY_MS = 8 * 60 * 60 * 1000;
const CORRECTION_WINDOW_MS = 48 * 60 * 60 * 1000;
const DEFAULT_SETTLEMENT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SETTLEMENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const SETTLEMENT_PAGE_SIZE = 500;
const SETTLEMENT_GAME_BATCH = 50;
const OUTCOME_TARGET_VERSION = "research-contract-v1";
const OUTCOME_COLUMNS = "id,game_id,player_id,target_key,target_version,outcome_value,available_at,finality,source_revision_key";
const SETTLEMENT_LIMITS = { games: 200, outputs: 50_000,
  boxscores: 20_000, outcomes: 100_000 } as const;

type OutputRow = {
  id: string;
  game_id: number;
  team_id: number;
  player_id: number;
  population: "forward" | "defense" | "goalie";
  target_key: string;
  conditioning: string;
  point_estimate: number | null;
  probability: number | null;
  distribution: Record<string, unknown> | null;
  quantiles: Record<string, unknown> | null;
};

type Actual = { value: number; payload: Record<string, unknown> };
type BoxscoreEvidence = { payload: Record<string, unknown>; payloadHash: string; fetchedAt: string; seasonId: number | null };

const SKATER_COLUMNS: Record<string, string> = {
  goals: "goals",
  assists: "assists",
  shots_on_goal: "shots",
  blocked_shots: "blockedShots",
  hits: "hits",
  penalty_minutes: "pim",
};

function numeric(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || value.trim() === "")) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export function parseTimeOnIceSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parts = /^(\d+):([0-5]\d)$/.exec(value);
  if (!parts) return null;
  const minutes = Number(parts[1]);
  return Number.isSafeInteger(minutes) ? minutes * 60 + Number(parts[2]) : null;
}

function goalieSaveShots(value: unknown): { saves: number; shots: number } | null {
  const match = typeof value === "string" ? /^(\d+)\/(\d+)$/.exec(value) : null;
  if (!match) return null;
  const saves = Number(match[1]), shots = Number(match[2]);
  return Number.isSafeInteger(saves) && Number.isSafeInteger(shots) && saves <= shots ? { saves, shots } : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** An explicit zero-TOI row in a complete final boxscore is evidence; a missing row is not. */
function skaterZeroToiFromBoxscore(output: OutputRow, source: BoxscoreEvidence | undefined): Actual | null {
  if (!source || !["FINAL", "OFF"].includes(String(source.payload.gameState))
    || Number(source.payload.id) !== output.game_id || Number(source.payload.season) !== source.seasonId
    || !Number.isSafeInteger(output.team_id) || !/^[a-f0-9]{64}$/i.test(source.payloadHash)
    || !Number.isFinite(Date.parse(source.fetchedAt))) return null;
  const home = record(source.payload.homeTeam), away = record(source.payload.awayTeam);
  const stats = record(source.payload.playerByGameStats);
  if (!home || !away || Number(home.id) === Number(away.id)
    || ![Number(home.id), Number(away.id)].includes(output.team_id) || !stats) return null;
  const players: Record<string, unknown>[] = [];
  for (const side of ["homeTeam", "awayTeam"] as const) {
    const team = record(stats[side]);
    const forwards = team?.forwards, defense = team?.defense, goalies = team?.goalies;
    if (!Array.isArray(forwards) || !Array.isArray(defense) || !Array.isArray(goalies)
      || !goalies.length || !forwards.length && !defense.length) return null;
    for (const row of [...forwards, ...defense, ...goalies]) {
      const player = record(row);
      if (!player) return null;
      players.push(player);
    }
  }
  const ids = players.map((player) => Number(player.playerId));
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)
    || new Set(ids).size !== ids.length) return null;
  const side = Number(home.id) === output.team_id ? "homeTeam" : "awayTeam";
  const team = record(stats[side])!;
  const player = [...(team.forwards as unknown[]), ...(team.defense as unknown[])].map(record)
    .find((row) => Number(row?.playerId) === output.player_id);
  if (!player || parseTimeOnIceSeconds(player.toi) !== 0) return null;
  const fields: Record<string, string> = { goals: "goals", assists: "assists", shots_on_goal: "shots",
    blocked_shots: "blockedShots", hits: "hits", penalty_minutes: "pim" };
  if (Object.values(fields).some((column) => numeric(player[column]) !== 0)) return null;
  const field = fields[output.target_key];
  if (output.target_key !== "plays" && output.target_key !== "time_on_ice_seconds"
    && (!field || numeric(player[field]) !== 0)) return null;
  return { value: 0, payload: { sourceTable: "nhl_api_game_payloads_raw", endpoint: "boxscore",
    payloadHash: source.payloadHash, sourceFetchedAt: source.fetchedAt,
    sourceField: field ? `playerByGameStats.${side}.${field}` : "playerByGameStats.toi" } };
}

/** The NHL final boxscore supplies actual starter and win-decision labels. It has no shutout award field. */
export function goalieActualFromBoxscore(output: OutputRow, source: BoxscoreEvidence | undefined): Actual | null {
  if (!source || output.population !== "goalie" || !["OFF", "FINAL"].includes(String(source.payload.gameState))
    || Number(source.payload.id) !== output.game_id || !Number.isSafeInteger(output.team_id)
    || source.seasonId !== null && Number(source.payload.season) !== source.seasonId) return null;
  const home = record(source.payload.homeTeam), away = record(source.payload.awayTeam);
  const stats = record(source.payload.playerByGameStats);
  const homeRows = record(stats?.homeTeam)?.goalies, awayRows = record(stats?.awayTeam)?.goalies;
  if (!home || !away || !Array.isArray(homeRows) || !Array.isArray(awayRows)) return null;
  const ownRows = Number(home.id) === output.team_id ? homeRows : Number(away.id) === output.team_id ? awayRows : null;
  if (!ownRows) return null;
  const goalies = [...homeRows, ...awayRows].map(record);
  if (goalies.some(row => !row || !Number.isSafeInteger(Number(row.playerId)))) return null;
  const own = ownRows.map(record);
  const player = own.find(row => Number(row?.playerId) === output.player_id);
  if (!player) return null;
  const provenance = { sourceTable: "nhl_api_game_payloads_raw", endpoint: "boxscore", payloadHash: source.payloadHash,
    sourceFetchedAt: source.fetchedAt };
  if (output.conditioning === "start_probability" && output.target_key === "starts") {
    if (goalies.some(row => typeof row!.starter !== "boolean")
      || homeRows.filter(row => record(row)?.starter === true).length !== 1
      || awayRows.filter(row => record(row)?.starter === true).length !== 1) return null;
    return { value: player?.starter === true ? 1 : 0, payload: { ...provenance, sourceField: "playerByGameStats.goalies.starter" } };
  }
  if (output.target_key === "wins" && ["unconditional", "conditional_start", "conditional_playing"].includes(output.conditioning)) {
    if (goalies.filter(row => row!.decision === "W").length !== 1) return null;
    if (output.conditioning === "conditional_start" && player?.starter !== true) return null;
    if (output.conditioning === "conditional_playing") {
      const toi = parseTimeOnIceSeconds(player?.toi);
      if (toi === null || toi <= 0) return null;
    }
    return { value: player?.decision === "W" ? 1 : 0, payload: { ...provenance, sourceField: "playerByGameStats.goalies.decision" } };
  }
  return null;
}

export function scoreForecast(args: {
  actual: number;
  pointEstimate: number | null;
  probability: number | null;
  conditioning: string;
  quantiles?: Record<string, unknown> | null;
  baselinePointEstimate?: number | null;
}) {
  const isProbability = args.conditioning === "playing_probability" || args.conditioning === "start_probability";
  const forecast = isProbability ? args.probability : args.pointEstimate;
  if (forecast === null || !Number.isFinite(forecast)) return null;
  const error = forecast - args.actual;
  const metrics: Record<string, number | boolean> = {
    actual: args.actual,
    forecast,
    absoluteError: Math.abs(error),
    squaredError: error * error,
  };
  if (isProbability) {
    const probability = Math.min(1 - 1e-15, Math.max(1e-15, forecast));
    metrics.brier = error * error;
    metrics.logLoss = -(args.actual * Math.log(probability) + (1 - args.actual) * Math.log(1 - probability));
  }
  const p10 = numeric(args.quantiles?.p10);
  const p90 = numeric(args.quantiles?.p90);
  if (p10 !== null && p90 !== null) metrics.interval80Covered = args.actual >= p10 && args.actual <= p90;

  const baseline = args.baselinePointEstimate;
  const baselineMetrics: Record<string, number> = {};
  let compositeSkillScore: number | null = null;
  if (baseline !== null && baseline !== undefined && Number.isFinite(baseline)) {
    const baselineAbsoluteError = Math.abs(baseline - args.actual);
    baselineMetrics.forecast = baseline;
    baselineMetrics.absoluteError = baselineAbsoluteError;
    baselineMetrics.squaredError = (baseline - args.actual) ** 2;
    const denominator = Math.max(baselineAbsoluteError, 1e-9);
    compositeSkillScore = Math.max(0, Math.min(100, 50 + 50 * ((baselineAbsoluteError - Math.abs(error)) / denominator)));
  }
  return { metrics, baselineMetrics, compositeSkillScore };
}

export function actualForOutput(output: OutputRow, skater: Record<string, unknown> | undefined, goalie?: Record<string, unknown>,
  boxscore?: BoxscoreEvidence): Actual | null {
  if (output.population === "goalie") {
    if (output.target_key === "starts" || output.target_key === "wins") return goalieActualFromBoxscore(output, boxscore);
    const toi = goalie ? parseTimeOnIceSeconds(goalie.toi) : null;
    if (output.conditioning === "playing_probability" && output.target_key === "plays") {
      // An absent row may be a partial ingest, not evidence of a non-appearance.
      if (!goalie || toi === null) return null;
      return { value: toi > 0 ? 1 : 0, payload: { sourceTable: "goaliesGameStats", rawToi: goalie.toi } };
    }
    // A goalie appearance and pregame start observation do not establish who started.
    if (!goalie || toi === null || (toi <= 0 && output.conditioning !== "unconditional") || !["conditional_playing", "unconditional"].includes(output.conditioning)) return null;
    const saveShots = goalieSaveShots(goalie.saveShotsAgainst);
    const goalsAgainst = numeric(goalie.goalsAgainst);
    if (toi === 0 && ((saveShots?.shots ?? 0) > 0 || (goalsAgainst ?? 0) > 0)) return null;
    const values: Record<string, number | null> = {
      saves: saveShots?.saves ?? null,
      shots_against: saveShots?.shots ?? null,
      goals_against: goalsAgainst !== null && Number.isInteger(goalsAgainst) && goalsAgainst >= 0 ? goalsAgainst : null,
      time_on_ice_seconds: toi,
      save_percentage: saveShots && saveShots.shots > 0 ? saveShots.saves / saveShots.shots : null,
      goals_against_average: goalsAgainst !== null && goalsAgainst >= 0 && toi !== null && toi > 0 ? goalsAgainst * 3600 / toi : null,
    };
    const value = values[output.target_key];
    return value === null || value === undefined ? null : { value, payload: { sourceTable: "goaliesGameStats", sourceColumns: output.target_key === "time_on_ice_seconds" ? ["toi"] : output.target_key === "goals_against" ? ["goalsAgainst"] : output.target_key === "goals_against_average" ? ["goalsAgainst", "toi"] : ["saveShotsAgainst"] } };
  }
  if (output.conditioning === "playing_probability" && output.target_key === "plays") {
    if (!skater) return skaterZeroToiFromBoxscore(output, boxscore);
    const toi = skater ? parseTimeOnIceSeconds(skater.toi) : null;
    return toi === null ? null : { value: toi > 0 ? 1 : 0, payload: { sourceTable: "skatersGameStats", rawToi: skater!.toi } };
  }
  if (!skater && output.conditioning === "unconditional"
    && (output.target_key === "time_on_ice_seconds" || SKATER_COLUMNS[output.target_key])) {
    return skaterZeroToiFromBoxscore(output, boxscore);
  }
  if (!skater || !["conditional_playing", "unconditional"].includes(output.conditioning)) return null;
  if (output.conditioning === "conditional_playing") {
    const toi = parseTimeOnIceSeconds(skater.toi);
    if (toi === null || toi <= 0) return null;
  }
  if (output.target_key === "time_on_ice_seconds") {
    const value = parseTimeOnIceSeconds(skater.toi);
    return value === null ? null : { value, payload: { sourceTable: "skatersGameStats", rawToi: skater.toi } };
  }
  const column = SKATER_COLUMNS[output.target_key];
  if (!column) return null;
  const value = numeric(skater[column]);
  return value === null ? null : { value, payload: { sourceTable: "skatersGameStats", sourceColumn: column } };
}

function revisionKey(actual: Actual, finality: string): string {
  return crypto.createHash("sha256").update(JSON.stringify({ value: actual.value, payload: actual.payload, finality })).digest("hex");
}

async function readCompleteRows(build: () => any, table: string, cap: number): Promise<any[]> {
  const rows: any[] = [];
  let expectedCount: number | null = null;
  while (rows.length <= cap) {
    const offset = rows.length;
    const size = Math.min(SETTLEMENT_PAGE_SIZE, cap + 1 - offset);
    const { data, count, error } = await build().range(offset, offset + size - 1);
    if (error || !Array.isArray(data) || !Number.isSafeInteger(count) || count < 0
      || expectedCount !== null && count !== expectedCount || data.length > size)
      throw new Error(`Settlement ${table} read failed or changed during pagination.`);
    expectedCount = count;
    if (count > cap) throw new Error(`Settlement ${table} exceeded ${cap} rows.`);
    if (!data.length && offset < count || offset + data.length > count)
      throw new Error(`Settlement ${table} read was incomplete.`);
    rows.push(...data);
    if (rows.length === count) return rows;
  }
  throw new Error(`Settlement ${table} exceeded ${cap} rows.`);
}

async function readCompleteGameRows(gameIds: number[], table: string, cap: number,
  build: (batch: number[]) => any): Promise<any[]> {
  const rows: any[] = [];
  for (let index = 0; index < gameIds.length; index += SETTLEMENT_GAME_BATCH) {
    rows.push(...await readCompleteRows(() => build(gameIds.slice(index, index + SETTLEMENT_GAME_BATCH)),
      table, cap - rows.length));
  }
  return rows;
}

export function finalBoxscoreForGame(row: any, game: any): BoxscoreEvidence | null {
  const payload = record(row.payload);
  const home = record(payload?.homeTeam), away = record(payload?.awayTeam);
  const stats = record(payload?.playerByGameStats);
  if (!payload || !home || !away || !stats || !["FINAL", "OFF"].includes(String(payload.gameState))
    || Number(row.game_id) !== Number(game.id) || Number(row.season_id) !== Number(game.seasonId)
    || Number(payload.id) !== Number(game.id) || Number(payload.season) !== Number(game.seasonId)
    || Number(home.id) !== Number(game.homeTeamId) || Number(away.id) !== Number(game.awayTeamId)
    || !/^[a-f0-9]{64}$/i.test(String(row.payload_hash))
    || !Number.isFinite(Date.parse(row.fetched_at))
    || Date.parse(row.fetched_at) < Date.parse(game.startTime)) return null;
  for (const side of ["homeTeam", "awayTeam"] as const) {
    const team = record(stats[side]);
    if (!team || !Array.isArray(team.forwards) || !Array.isArray(team.defense)
      || !Array.isArray(team.goalies) || !team.goalies.length
      || !team.forwards.length && !team.defense.length) return null;
  }
  return { payload, payloadHash: String(row.payload_hash), fetchedAt: String(row.fetched_at),
    seasonId: Number(game.seasonId) };
}

export function rawPlayerForOutput(output: Pick<OutputRow, "team_id" | "player_id">, source: BoxscoreEvidence): {
  skater?: Record<string, unknown>; goalie?: Record<string, unknown>; side: "homeTeam" | "awayTeam";
} | null {
  const home = record(source.payload.homeTeam), away = record(source.payload.awayTeam);
  const stats = record(source.payload.playerByGameStats);
  const side = Number(home?.id) === output.team_id ? "homeTeam"
    : Number(away?.id) === output.team_id ? "awayTeam" : null;
  if (!side || !stats) return null;
  const players = new Set<number>();
  let selectedSkater: Record<string, unknown> | undefined;
  let selectedGoalie: Record<string, unknown> | undefined;
  for (const teamSide of ["homeTeam", "awayTeam"] as const) {
    const team = record(stats[teamSide]);
    if (!team) return null;
    for (const group of ["forwards", "defense", "goalies"] as const) {
      const rows = team[group];
      if (!Array.isArray(rows)) return null;
      for (const value of rows) {
        const player = record(value), playerId = Number(player?.playerId);
        if (!player || !Number.isSafeInteger(playerId) || playerId <= 0 || players.has(playerId)) return null;
        players.add(playerId);
        if (teamSide === side && playerId === output.player_id) {
          if (group === "goalies") selectedGoalie = player;
          else selectedSkater = player;
        }
      }
    }
  }
  return { skater: selectedSkater, goalie: selectedGoalie, side };
}

/** Hourly callers use the last seven days; explicit scopes may cover at most 30 days or 200 games. */
export async function settlePlayerForecasts(args: {
  supabase: SupabaseClient<any>;
  now?: Date;
  startAt?: string;
  endAt?: string;
  seasonId?: number;
  gameIds?: number[];
}) {
  const now = args.now ?? new Date();
  const cutoffMs = now.getTime() - PROVISIONAL_DELAY_MS;
  const startMs = args.startAt ? Date.parse(args.startAt) : now.getTime() - DEFAULT_SETTLEMENT_LOOKBACK_MS;
  const endMs = args.endAt ? Date.parse(args.endAt) : cutoffMs;
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(startMs) || !Number.isFinite(endMs)
    || startMs > endMs || endMs > cutoffMs || endMs - startMs > MAX_SETTLEMENT_WINDOW_MS
    || args.seasonId !== undefined && (!Number.isSafeInteger(args.seasonId) || args.seasonId <= 0)
    || args.gameIds !== undefined && (!args.gameIds.length || args.gameIds.length > SETTLEMENT_LIMITS.games
      || new Set(args.gameIds).size !== args.gameIds.length
      || args.gameIds.some((id) => !Number.isSafeInteger(id) || id <= 0))) {
    throw new Error("Invalid or unbounded settlement scope.");
  }
  const games = await readCompleteRows(() => {
    let query = args.supabase.from("games")
      .select("id,seasonId,startTime,date,homeTeamId,awayTeamId", { count: "exact" })
      .gte("startTime", new Date(startMs).toISOString()).lte("startTime", new Date(endMs).toISOString());
    if (args.seasonId !== undefined) query = query.eq("seasonId", args.seasonId);
    if (args.gameIds) query = query.in("id", args.gameIds);
    return query.order("id");
  }, "games", SETTLEMENT_LIMITS.games);
  const gameMap = new Map(games.map((game: any) => [Number(game.id), game]));
  const gameIds = [...gameMap.keys()];
  if (gameIds.length === 0) return { eligibleOutputs: 0, outcomesAppended: 0, evaluationsAppended: 0, unsupportedOutputs: 0 };

  const typedOutputs = await readCompleteGameRows(gameIds, "outputs", SETTLEMENT_LIMITS.outputs,
    (batch) => args.supabase.from("player_forecast_outputs")
      .select("id,game_id,team_id,player_id,population,target_key,conditioning,point_estimate,probability,distribution,quantiles", { count: "exact" })
      .in("game_id", batch).order("id")) as OutputRow[];
  if (typedOutputs.length === 0) return { eligibleOutputs: 0, outcomesAppended: 0, evaluationsAppended: 0, unsupportedOutputs: 0 };

  const outputGameIds = [...new Set(typedOutputs.map((output) => output.game_id))];
  const rawBoxscores = await readCompleteGameRows(outputGameIds, "boxscores", SETTLEMENT_LIMITS.boxscores,
    (batch) => args.supabase.from("nhl_api_game_payloads_raw")
      .select("id,game_id,season_id,payload_hash,payload,fetched_at", { count: "exact" })
      .in("game_id", batch).eq("endpoint", "boxscore").lte("fetched_at", now.toISOString())
      .order("fetched_at", { ascending: false }).order("id", { ascending: false }));
  const boxscores = new Map<number, BoxscoreEvidence>();
  const seenBoxscoreGames = new Set<number>();
  for (const row of rawBoxscores) {
    const gameId = Number(row.game_id), game = gameMap.get(gameId);
    if (seenBoxscoreGames.has(gameId) || !game) continue;
    seenBoxscoreGames.add(gameId);
    const verified = finalBoxscoreForGame(row, game);
    if (verified) boxscores.set(gameId, verified);
  }

  const outcomeKeys = new Set(typedOutputs.map((output) => `${output.game_id}:${output.player_id}:${output.target_key}`));
  const existingOutcomes = await readCompleteGameRows(outputGameIds, "outcomes", SETTLEMENT_LIMITS.outcomes,
    (batch) => args.supabase.from("player_forecast_outcome_revisions")
      .select(OUTCOME_COLUMNS, { count: "exact" })
      .in("game_id", batch).eq("target_version", OUTCOME_TARGET_VERSION).lte("available_at", now.toISOString())
      .order("available_at", { ascending: false }).order("id", { ascending: false }));
  const latestOutcomes = new Map<string, any>();
  for (const row of existingOutcomes) {
    const key = `${row.game_id}:${row.player_id}:${row.target_key}`;
    if (outcomeKeys.has(key) && !latestOutcomes.has(key)) latestOutcomes.set(key, row);
  }

  let outcomesAppended = 0;
  let evaluationsAppended = 0;
  let unsupportedOutputs = 0;
  const outcomeByKey = new Map<string, any>();
  for (const output of typedOutputs) {
    const boxscore = boxscores.get(output.game_id);
    if (!boxscore) { unsupportedOutputs += 1; continue; }
    const player = rawPlayerForOutput(output, boxscore);
    if (!player) { unsupportedOutputs += 1; continue; }
    const observed = actualForOutput(output, player.skater, player.goalie, boxscore);
    if (!observed) {
      unsupportedOutputs += 1;
      continue;
    }
    const group = output.population === "goalie" ? "goalies"
      : output.population === "defense" ? "defense" : "forwards";
    const columns = typeof observed.payload.sourceColumn === "string" ? [observed.payload.sourceColumn]
      : Array.isArray(observed.payload.sourceColumns) ? observed.payload.sourceColumns
        : observed.payload.rawToi !== undefined ? ["toi"] : [];
    const actual = { ...observed, payload: {
      ...observed.payload, sourceTable: "nhl_api_game_payloads_raw", endpoint: "boxscore",
      payloadHash: boxscore.payloadHash, sourceFetchedAt: boxscore.fetchedAt,
      sourceField: observed.payload.sourceField ?? columns.map((column) =>
        `playerByGameStats.${player.side}.${group}.${column}`),
      gameId: output.game_id, seasonId: boxscore.seasonId, gameState: boxscore.payload.gameState,
    } };
    const key = `${output.game_id}:${output.player_id}:${output.target_key}`;
    if (!outcomeByKey.has(key)) {
      const latest = latestOutcomes.get(key);
      const game = gameMap.get(output.game_id);
      const startMs = Date.parse(game.startTime);
      const sameValue = latest && numeric(latest.outcome_value) === actual.value;
      const finality = latest && !sameValue
        ? "corrected"
        : latest?.finality === "corrected" || latest?.finality === "final"
          ? latest.finality
          : now.getTime() >= startMs + CORRECTION_WINDOW_MS
            ? "final"
            : "provisional";
      const sourceRevisionKey = revisionKey(actual, finality);
      if (sameValue && latest.finality === finality && latest.source_revision_key === sourceRevisionKey) {
        outcomeByKey.set(key, latest);
      } else {
        const row = {
          game_id: output.game_id,
          player_id: output.player_id,
          target_key: output.target_key,
          target_version: OUTCOME_TARGET_VERSION,
          outcome_value: actual.value,
          outcome_payload: actual.payload,
          source: actual.payload.sourceTable === "nhl_api_game_payloads_raw" ? "nhl_raw_boxscore" : "nhl_game_stats",
          source_revision_key: sourceRevisionKey,
          observed_at: now.toISOString(),
          available_at: now.toISOString(),
          finality,
          supersedes_id: latest?.id ?? null,
        };
        const { data, error } = await args.supabase
          .from("player_forecast_outcome_revisions")
          .upsert(row as never, {
            onConflict: "game_id,player_id,target_key,target_version,source_revision_key",
            ignoreDuplicates: true,
          })
          .select(OUTCOME_COLUMNS)
          .maybeSingle();
        if (error) throw error;
        // An ignored insert means another writer owns this exact immutable
        // revision. The previously read latest row can describe a different actual.
        let stored = data;
        if (!stored) {
          const winner = await args.supabase.from("player_forecast_outcome_revisions")
            .select(OUTCOME_COLUMNS).eq("game_id", output.game_id).eq("player_id", output.player_id)
            .eq("target_key", output.target_key).eq("target_version", OUTCOME_TARGET_VERSION)
            .eq("source_revision_key", sourceRevisionKey).maybeSingle();
          if (winner.error) throw winner.error;
          stored = winner.data;
        }
        if (!stored?.id || stored.game_id !== output.game_id || stored.player_id !== output.player_id
          || stored.target_key !== output.target_key || stored.target_version !== OUTCOME_TARGET_VERSION
          || stored.source_revision_key !== sourceRevisionKey || numeric(stored.outcome_value) !== actual.value
          || stored.finality !== finality || !Number.isFinite(Date.parse(stored.available_at))
          || Date.parse(stored.available_at) > now.getTime()) {
          throw new Error("Outcome revision could not be resolved consistently after insert.");
        }
        outcomeByKey.set(key, stored);
        if (data) outcomesAppended += 1;
      }
    }
    const outcome = outcomeByKey.get(key);
    const baselinePointEstimate = numeric(output.distribution?.baselinePointEstimate);
    const score = scoreForecast({
      actual: actual.value,
      pointEstimate: numeric(output.point_estimate),
      probability: numeric(output.probability),
      conditioning: output.conditioning,
      quantiles: output.quantiles,
      baselinePointEstimate,
    });
    if (!score) continue;
    const { data: evaluation, error: evaluationError } = await args.supabase
      .from("player_forecast_evaluation_revisions")
      .upsert({
        forecast_output_id: output.id,
        outcome_revision_id: outcome.id,
        scoring_version: PLAYER_FORECAST_SCORING_VERSION,
        settlement_status: outcome.finality ?? "provisional",
        evaluated_at: now.toISOString(),
        metrics: score.metrics,
        baseline_metrics: score.baselineMetrics,
        composite_skill_score: score.compositeSkillScore,
      } as never, {
        onConflict: "forecast_output_id,outcome_revision_id,scoring_version",
        ignoreDuplicates: true,
      })
      .select("id")
      .maybeSingle();
    if (evaluationError) throw evaluationError;
    if (evaluation) evaluationsAppended += 1;
  }

  return {
    eligibleOutputs: typedOutputs.length,
    outcomesAppended,
    evaluationsAppended,
    unsupportedOutputs,
  };
}
