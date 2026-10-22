import supabase from "lib/supabase/server";
import { readAlignedCountSupport } from "lib/rollingPlayerCountSupport";
import { isReadOnlyProjectionReconstruction } from "lib/projections/queryCaptureHook";
import { getCompatibilityFieldOrder } from "lib/rollingPlayerMetricCompatibility";
import { ROLLING_PLAYER_SUPPORT_PAYLOAD_TABLE, ROLLING_PLAYER_SUPPORT_PAYLOAD_SCHEMA_VERSION } from "lib/supabase/Upserts/rollingPlayerSupportPayload";
import {
  TREND_BAND_METRIC_PRIORITY,
  TREND_BAND_WINDOW_PRIORITY
} from "../constants/projection-weights";
import type {
  LeaguePhysicalTotals,
  RollingRow,
  SkaterOnIceContextProfile,
  SkaterShotQualityProfile,
  SkaterTrendAdjustment,
  SustainabilityTrendBandRow,
  WgoSkaterDeploymentProfile
} from "../types/run-forge-projections.types";
import { daysBetweenDates } from "../utils/date-utils";
import { clamp, finiteOrNull } from "../utils/number-utils";
import {
  classifyTrendBandRecency,
  compareTrendBandRowsForSelection,
  computeSkaterTrendAdjustment
} from "../utils/trend-adjustments";

const trendBandMetricPriority = new Set<string>(TREND_BAND_METRIC_PRIORITY);
const trendBandWindowPriority = new Set<string>(TREND_BAND_WINDOW_PRIORITY);

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

/** Complete membership validates candidates; a sample must never exclude line skaters. */
export async function fetchCurrentRosterPlayerIds(teamId: number, seasonId: number, db = supabase): Promise<number[]> {
  if (!db || !Number.isSafeInteger(teamId) || teamId <= 0 || !Number.isSafeInteger(seasonId) || seasonId <= 0) {
    throw new Error("Invalid current roster scope");
  }
  const ids: number[] = [];
  let total: number | null = null;
  for (;;) {
    const result = await db.from("rosters").select("playerId,teamId,seasonId", { count: "exact" })
      .eq("teamId", teamId).eq("seasonId", seasonId).eq("is_current", true)
      .order("playerId", { ascending: true }).range(ids.length, ids.length + 499);
    if (result.error) throw result.error;
    if (!Array.isArray(result.data) || !Number.isSafeInteger(result.count) || result.count! < 0
      || result.count! > 1200 || total !== null && result.count !== total
      || result.data.length > result.count! - ids.length) throw new Error("Current roster read was incomplete");
    if (result.data.length !== Math.min(500, result.count! - ids.length)) {
      throw new Error("Current roster read was truncated");
    }
    total = result.count;
    for (const row of result.data) {
      if (!Number.isSafeInteger(row.playerId) || row.playerId <= 0 || row.teamId !== teamId
        || row.seasonId !== seasonId || row.playerId <= (ids.at(-1) ?? 0)) {
        throw new Error("Current roster membership was malformed or duplicated");
      }
      ids.push(row.playerId);
    }
    if (ids.length === total) return ids;
  }
}


/** Recency requires exact native event identity; rates and historical windows stay unchanged. */
export async function fetchSkaterRecencyEvents(rows: RollingRow[], db = supabase) {
  if (!db) throw new Error("Supabase server client not available");
  const ids = [...new Set(rows.map(row => row.game_id))];
  if (ids.length > 500 || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new Error("Invalid skater recency source game identity");
  const events = new Map<number, { date: string; seasonId: number; type: number }>();
  if (!ids.length) return events;
  const { data, error } = await db.from("games").select("id,date,seasonId,type").in("id", ids).limit(ids.length);
  if (error) throw error;
  if (!Array.isArray(data) || data.length !== ids.length || new Set(data.map(g => g.id)).size !== ids.length
    || data.some(g => !ids.includes(g.id))) throw new Error("Incomplete skater recency source games");
  for (const row of rows) {
    const game = data.find(g => g.id === row.game_id)!;
    if (game.date === row.game_date && game.seasonId === row.season && typeof game.seasonId === "number" && typeof game.type === "number") events.set(row.player_id, { date: game.date, seasonId: game.seasonId, type: game.type });
  }
  return events;
}

export const ROLLING_ROW_SELECT_CLAUSE =
  [
    "player_id",
    "game_id",
    "season",
    "strength_state",
    "game_date",
    "toi_seconds_avg_last5",
    "toi_seconds_avg_all",
    ...getCompatibilityFieldOrder({
      family: "weighted_rate",
      canonicalField: "sog_per_60_last5",
      legacyField: "sog_per_60_avg_last5"
    }),
    ...getCompatibilityFieldOrder({
      family: "weighted_rate",
      canonicalField: "sog_per_60_all",
      legacyField: "sog_per_60_avg_all"
    }),
    "goals_total_last5",
    "shots_total_last5",
    "assists_total_last5",
    "goals_total_all",
    "shots_total_all",
    "assists_total_all",
    // Points over on-ice goals for, as a percentage: the denominator of the assist share.
    "ipp_all",
    ...getCompatibilityFieldOrder({
      family: "weighted_rate",
      canonicalField: "hits_per_60_last5",
      legacyField: "hits_per_60_avg_last5"
    }),
    ...getCompatibilityFieldOrder({
      family: "weighted_rate",
      canonicalField: "hits_per_60_all",
      legacyField: "hits_per_60_avg_all"
    }),
    ...getCompatibilityFieldOrder({
      family: "weighted_rate",
      canonicalField: "blocks_per_60_last5",
      legacyField: "blocks_per_60_avg_last5"
    }),
    ...getCompatibilityFieldOrder({
      family: "weighted_rate",
      canonicalField: "blocks_per_60_all",
      legacyField: "blocks_per_60_avg_all"
    }),
    // Window exposure plus three-season and current-season event/TOI totals for hit and block shrinkage.
    "toi_seconds_total_last5",
    "hits_per_60_hits_3ya",
    "hits_per_60_toi_seconds_3ya",
    "blocks_per_60_blocks_3ya",
    "blocks_per_60_toi_seconds_3ya",
    "hits_per_60_hits_season",
    "hits_per_60_toi_seconds_season",
    "blocks_per_60_blocks_season",
    "blocks_per_60_toi_seconds_season"
  ].join(",");

function normalizeWgoToiToSeconds(value: number | null | undefined): number | null {
  const n = finiteOrNull(value);
  if (n == null || n <= 0) return null;
  if (n <= 60) return Number((n * 60).toFixed(3));
  if (n <= 3600) return Number(n.toFixed(3));
  return 3600;
}

export type SkaterTrendAdjustmentFetchDiagnostics = {
  requestedPlayers: number;
  eligibleRows: number;
  playersWithRows: number;
  playersAdjusted: number;
  playersMissingRows: number;
  playersNeutralizedByRecency: number;
  selectedSoftStaleRows: number;
  selectedHardStaleRows: number;
  fetchFailed: boolean;
  fetchErrorMessage: string | null;
};

export type SkaterTrendAdjustmentFetchResult = {
  adjustments: Map<number, SkaterTrendAdjustment>;
  diagnostics: SkaterTrendAdjustmentFetchDiagnostics;
};

export class SkaterRollingReadIncompleteError extends Error {
  readonly status = "incomplete";

  constructor(
    readonly reason: "invalid_scope" | "read_failed" | "invalid_count" | "count_drift"
      | "row_limit_exceeded" | "invalid_page" | "invalid_row" | "duplicate_row" | "unstable_order" | "invalid_support_row",
    cause?: unknown
  ) {
    super(`Rolling skater history read incomplete: ${reason}`, { cause });
    this.name = "SkaterRollingReadIncompleteError";
  }
}

/** Migration supabase/migrations/20261021182129_forge_latest_rolling_rows.sql. */
const LATEST_ROLLING_ROWS_RPC = "forge_latest_rolling_rows";
const ROLLING_ROW_COLUMNS = ROLLING_ROW_SELECT_CLAUSE.split(",");
const ROLLING_IDENTITY_FIELDS = ["player_id", "game_id", "game_date", "season", "strength_state"];
const ROLLING_METRIC_FIELDS = ROLLING_ROW_COLUMNS.filter(field => !ROLLING_IDENTITY_FIELDS.includes(field));
let legacyWindowScanWarned = false;

type RollingStrength = "ev" | "pp" | "all";
type RollingIdentity = { player_id: number; game_id: number; game_date: string; strength_state: string };

const isIsoDate = (value: unknown): value is string => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString().slice(0, 10) === value;
const rollingRowKey = (row: RollingIdentity) => `${row.player_id}:${row.game_id}:${row.game_date}:${row.strength_state}`;
const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

function isRollingRowInScope(row: RollingRow, requestedIds: Set<number>, strengthState: RollingStrength, cutoffDate: string) {
  return !!row && typeof row === "object" && Number.isSafeInteger(row.player_id)
    && requestedIds.has(row.player_id) && Number.isSafeInteger(row.game_id) && row.game_id > 0
    && Number.isSafeInteger(row.season) && row.season > 0 && row.strength_state === strengthState
    && isIsoDate(row.game_date) && row.game_date < cutoffDate;
}

/**
 * The rolling writer stores pruned historical fields in a durable sidecar.
 * Fill only the matching event identity; absent fields remain unknown.
 */
function hydrateRollingSupport(matched: RollingRow | undefined, support: any, strengthState: RollingStrength, seen: Set<string>) {
  const payload = support?.support_payload?.historicalCompatibility;
  if (!matched || support.season !== matched.season
    || support.payload_schema_version !== ROLLING_PLAYER_SUPPORT_PAYLOAD_SCHEMA_VERSION
    || !support.support_payload || typeof support.support_payload !== "object" || Array.isArray(support.support_payload)
    || payload !== undefined && (!payload || typeof payload !== "object" || Array.isArray(payload))) {
    throw new SkaterRollingReadIncompleteError("invalid_support_row");
  }
  if (seen.has(rollingRowKey(support))) throw new SkaterRollingReadIncompleteError("duplicate_row");
  seen.add(rollingRowKey(support));
  // Aligned NST count support exists only for split-strength rows.
  if (strengthState !== "all" && hasOwn(support.support_payload, "alignedCountSupport")) {
    matched.aligned_count_support = readAlignedCountSupport(support.support_payload.alignedCountSupport, {
      playerId: matched.player_id, strengthState,
      anchor: { gameId: matched.game_id, gameDate: matched.game_date, seasonId: matched.season },
    });
  }
  for (const field of ROLLING_METRIC_FIELDS) {
    const value = payload?.[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new SkaterRollingReadIncompleteError("invalid_support_row");
    }
    const wide = (matched as any)[field];
    if (typeof wide === "number" && Number.isFinite(wide) && wide !== value) {
      throw new SkaterRollingReadIncompleteError("invalid_support_row");
    }
    if (wide === null || wide === undefined) (matched as any)[field] = value;
  }
}

/**
 * Each requested player's latest row for one strength from the 365 days before
 * cutoffDate, hydrated from its sidecar, or reject; never a partial read.
 * Callers keep the latest row per player (pickLatestByPlayer).
 */
export async function fetchRollingRows(
  playerIds: number[],
  strengthState: RollingStrength,
  cutoffDate: string,
  db = supabase
): Promise<RollingRow[]> {
  assertSupabase();
  if (playerIds.length === 0) return [];

  const ids = [...new Set(playerIds)].sort((a, b) => a - b);
  if (ids.length > 500 || ids.some(id => !Number.isSafeInteger(id) || id <= 0)
    || !["ev", "pp", "all"].includes(strengthState) || !isIsoDate(cutoffDate)) {
    throw new SkaterRollingReadIncompleteError("invalid_scope");
  }
  const oneYearAgo = new Date(
    new Date(cutoffDate).getTime() - 365 * 24 * 60 * 60 * 1000
  ).toISOString().split("T")[0];

  // Read-only reconstruction refuses every RPC; read the same scope by table.
  if (isReadOnlyProjectionReconstruction()) {
    return fetchRollingRowsByLegacyWindowScan(ids, strengthState, cutoffDate, oneYearAgo, db);
  }
  let result: { data: unknown; error: unknown } | undefined;
  try {
    // One read-only GET per strength. Not in the generated types until the
    // migration is applied and types are regenerated.
    result = await (db as any).rpc(LATEST_ROLLING_ROWS_RPC, {
      p_player_ids: ids, p_strength: strengthState, p_before: cutoffDate, p_columns: ROLLING_ROW_COLUMNS,
    }, { get: true });
  } catch (cause) {
    // FORGE's capture layer (inputCapture.ts) refuses every RPC during read-only
    // reconstruction, and replaying a snapshot captured on the legacy scan finds
    // no recorded RPC read. Both read the same scope through the legacy scan.
    if (cause instanceof Error && ["RPC is not allowed during read-only FORGE reconstruction",
      `Unrecorded projection input: rpc ${LATEST_ROLLING_ROWS_RPC}`].includes(cause.message)) {
      return fetchRollingRowsByLegacyWindowScan(ids, strengthState, cutoffDate, oneYearAgo, db);
    }
    throw new SkaterRollingReadIncompleteError("read_failed", cause);
  }
  if ((result?.error as { code?: unknown } | null | undefined)?.code === "PGRST202") {
    // Release safety: this code may ship before the migration is applied. Until
    // PostgREST finds the function (PGRST202), read through the legacy scan.
    if (!legacyWindowScanWarned) {
      legacyWindowScanWarned = true;
      console.warn(`${LATEST_ROLLING_ROWS_RPC} is not deployed (PGRST202); FORGE reads rolling rows by the legacy window scan.`);
    }
    return fetchRollingRowsByLegacyWindowScan(ids, strengthState, cutoffDate, oneYearAgo, db);
  }
  if (!result || result.error) throw new SkaterRollingReadIncompleteError("read_failed", result?.error);

  // Coverage proof: exactly one entry per requested player, in ascending ID order.
  if (!Array.isArray(result.data) || result.data.length !== ids.length) {
    throw new SkaterRollingReadIncompleteError("invalid_page");
  }
  const requestedIds = new Set(ids);
  const rows: RollingRow[] = [];
  const supportSeen = new Set<string>();
  let previousId = 0;
  for (const entry of result.data as Array<Record<string, any> | null>) {
    if (!entry || typeof entry !== "object" || !requestedIds.has(entry.player_id)
      || !hasOwn(entry, "rolling_row") || !hasOwn(entry, "support_row")) {
      throw new SkaterRollingReadIncompleteError("invalid_row");
    }
    if (entry.player_id === previousId) throw new SkaterRollingReadIncompleteError("duplicate_row");
    if (entry.player_id < previousId) throw new SkaterRollingReadIncompleteError("unstable_order");
    previousId = entry.player_id;
    const source = entry.rolling_row;
    if (source === null) {
      // No row before the cutoff; a sidecar cannot exist without its wide row.
      if (entry.support_row !== null) throw new SkaterRollingReadIncompleteError("invalid_support_row");
      continue;
    }
    if (!source || typeof source !== "object" || Array.isArray(source)
      || ROLLING_ROW_COLUMNS.some(column => !hasOwn(source, column))) {
      throw new SkaterRollingReadIncompleteError("invalid_row");
    }
    // Exactly the selected columns, as the table select returned them.
    const row = Object.fromEntries(ROLLING_ROW_COLUMNS.map(column => [column, source[column]])) as unknown as RollingRow;
    if (row.player_id !== entry.player_id || !isRollingRowInScope(row, requestedIds, strengthState, cutoffDate)) {
      throw new SkaterRollingReadIncompleteError("invalid_row");
    }
    // The RPC has no lower bound; keep the legacy 365-day scope.
    if (row.game_date <= oneYearAgo) continue;
    const support = entry.support_row;
    if (support !== null) {
      const matched = support && typeof support === "object" && rollingRowKey(support) === rollingRowKey(row) ? row : undefined;
      hydrateRollingSupport(matched, support, strengthState, supportSeen);
    }
    rows.push(row);
  }
  // The legacy scan's order: newest first, then player ascending, then game descending.
  return rows.sort((a, b) => a.game_date !== b.game_date ? (a.game_date < b.game_date ? 1 : -1)
    : a.player_id !== b.player_id ? a.player_id - b.player_id : b.game_id - a.game_id);
}

/**
 * Legacy window scan, used only while the latest-row RPC is unavailable (see
 * fetchRollingRows): every row of the 365 days before the cutoff in counted
 * 500-row pages, then every matching sidecar. Returns the complete bounded
 * history or rejects; never a capped/partial prefix.
 */
async function fetchRollingRowsByLegacyWindowScan(
  ids: number[],
  strengthState: RollingStrength,
  cutoffDate: string,
  oneYearAgo: string,
  db: typeof supabase
): Promise<RollingRow[]> {
  const requestedIds = new Set(ids);
  const rows: RollingRow[] = [];
  const seen = new Set<string>();
  let total: number | null = null;

  // Keep the previous 5000-row bound, but prove coverage with exact counts and 500-row pages.
  for (;;) {
    let result: { data: unknown; count: number | null; error: unknown };
    try {
      result = await db
        .from("rolling_player_game_metrics")
        .select(ROLLING_ROW_SELECT_CLAUSE, { count: "exact" })
        .in("player_id", ids)
        .eq("strength_state", strengthState)
        .lt("game_date", cutoffDate)
        .gt("game_date", oneYearAgo)
        .order("game_date", { ascending: false })
        .order("player_id", { ascending: true })
        .order("game_id", { ascending: false })
        .range(rows.length, rows.length + 499);
    } catch (cause) {
      throw new SkaterRollingReadIncompleteError("read_failed", cause);
    }
    if (result.error) throw new SkaterRollingReadIncompleteError("read_failed", result.error);
    const count = result.count;
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
      throw new SkaterRollingReadIncompleteError("invalid_count");
    }
    if (count > 5000) throw new SkaterRollingReadIncompleteError("row_limit_exceeded");
    if (total !== null && count !== total) throw new SkaterRollingReadIncompleteError("count_drift");
    total = count;
    if (!Array.isArray(result.data) || result.data.length !== Math.min(500, total - rows.length)) {
      throw new SkaterRollingReadIncompleteError("invalid_page");
    }
    for (const value of result.data) {
      const row = value as RollingRow;
      if (!isRollingRowInScope(row, requestedIds, strengthState, cutoffDate) || row.game_date <= oneYearAgo) {
        throw new SkaterRollingReadIncompleteError("invalid_row");
      }
      const key = `${row.player_id}:${row.game_id}:${row.strength_state}`;
      // Even identical repeats invalidate counted coverage; dropping them would hide a missing row.
      if (seen.has(key)) throw new SkaterRollingReadIncompleteError("duplicate_row");
      const previous = rows.at(-1);
      if (previous && (row.game_date > previous.game_date
        || row.game_date === previous.game_date && (row.player_id < previous.player_id
          || row.player_id === previous.player_id && row.game_id > previous.game_id))) {
        throw new SkaterRollingReadIncompleteError("unstable_order");
      }
      seen.add(key);
      rows.push(row);
    }
    if (rows.length === total) break;
  }
  if (!rows.length) return rows;

  // Join sidecars only to matching event identities (hydrateRollingSupport).
  const byKey = new Map(rows.map(row => [rollingRowKey(row), { ...row }]));
  const supportSeen = new Set<string>();
  let offset = 0, supportTotal: number | null = null;
  for (;;) {
    let result: { data: unknown; count: number | null; error: unknown };
    try {
      result = await db.from(ROLLING_PLAYER_SUPPORT_PAYLOAD_TABLE)
        .select("player_id,game_id,game_date,season,strength_state,payload_schema_version,support_payload,updated_at", { count: "exact" })
        .in("player_id", ids).eq("strength_state", strengthState)
        .lt("game_date", cutoffDate).gt("game_date", oneYearAgo)
        .order("game_date", { ascending: false }).order("player_id", { ascending: true })
        .order("game_id", { ascending: false }).range(offset, offset + 499);
    } catch (cause) {
      throw new SkaterRollingReadIncompleteError("read_failed", cause);
    }
    if (result.error) throw new SkaterRollingReadIncompleteError("read_failed", result.error);
    const count = result.count;
    if (!Number.isSafeInteger(count) || count! < 0) throw new SkaterRollingReadIncompleteError("invalid_count");
    if (count! > 5000) throw new SkaterRollingReadIncompleteError("row_limit_exceeded");
    if (supportTotal !== null && count !== supportTotal) throw new SkaterRollingReadIncompleteError("count_drift");
    supportTotal = count;
    if (!Array.isArray(result.data) || result.data.length !== Math.min(500, count! - offset)) {
      throw new SkaterRollingReadIncompleteError("invalid_page");
    }
    for (const support of result.data) {
      hydrateRollingSupport(support ? byKey.get(rollingRowKey(support)) : undefined, support, strengthState, supportSeen);
    }
    offset += result.data.length;
    if (offset === supportTotal) return rows.map(row => byKey.get(rollingRowKey(row))!);
  }
}

export class LeaguePhysicalTotalsReadError extends Error {
  constructor(readonly reason: "invalid_scope" | "rpc_missing" | "read_only_reconstruction" | "read_failed" | "invalid_rows", cause?: unknown) {
    super(`League physical totals read failed: ${reason}`, { cause });
    this.name = "LeaguePhysicalTotalsReadError";
  }
}

/** League all-situation hits, blocks and TOI by F/D: this season before cutoffDate and the two prior seasons. */
export async function fetchLeaguePhysicalTotals(
  seasonId: number,
  cutoffDate: string,
  db = supabase
): Promise<LeaguePhysicalTotals> {
  if (!db) throw new Error("Supabase server client not available");
  if (!Number.isSafeInteger(seasonId) || seasonId % 10000 !== Math.floor(seasonId / 10000) + 1
    || !isIsoDate(cutoffDate)) {
    throw new LeaguePhysicalTotalsReadError("invalid_scope");
  }
  // Offline reconstruction has no league-totals table contract and forbids RPCs.
  // Select the unscaled fallback before dispatch, rather than swallowing a fence violation.
  if (isReadOnlyProjectionReconstruction()) {
    throw new LeaguePhysicalTotalsReadError("read_only_reconstruction");
  }
  let result: { data: unknown; error: unknown };
  try {
    // Not in the generated types until the migration is applied and types are regenerated.
    result = await (db as any).rpc("forge_league_skater_physical_totals", { p_season_id: seasonId, p_cutoff: cutoffDate }, { get: true });
  } catch (cause) {
    throw new LeaguePhysicalTotalsReadError("read_failed", cause);
  }
  // Migration 88 is optional for this candidate. Missing RPC means constant F/D
  // priors with scale=1; do not replace the bounded RPC with a league-wide scan.
  if ((result.error as { code?: unknown } | null)?.code === "PGRST202") {
    throw new LeaguePhysicalTotalsReadError("rpc_missing", result.error);
  }
  if (result.error) throw new LeaguePhysicalTotalsReadError("read_failed", result.error);
  const rows = Array.isArray(result.data) ? result.data : [];
  const totals: Partial<Record<string, { hits: number; blocks: number; toiSeconds: number }>> = {};
  for (const row of rows) {
    const key = `${row?.position_group}:${row?.scope}`;
    // bigint columns may arrive as numeric strings; null or blank must not read as zero.
    const raw = [row?.hits, row?.blocks, row?.toi_seconds];
    const values = raw.map(Number);
    if (!["F:to_date", "F:prior2", "D:to_date", "D:prior2"].includes(key) || totals[key]
      || raw.some(value => typeof value !== "number" && !(typeof value === "string" && value.trim() !== ""))
      || values.some(value => !Number.isFinite(value) || value < 0)) {
      throw new LeaguePhysicalTotalsReadError("invalid_rows");
    }
    totals[key] = { hits: values[0], blocks: values[1], toiSeconds: values[2] };
  }
  if (rows.length !== 4) throw new LeaguePhysicalTotalsReadError("invalid_rows");
  return {
    F: { toDate: totals["F:to_date"]!, prior: totals["F:prior2"]! },
    D: { toDate: totals["D:to_date"]!, prior: totals["D:prior2"]! },
  };
}

export async function fetchLatestWgoSkaterDeploymentProfiles(
  playerIds: number[],
  cutoffDate: string
): Promise<Map<number, WgoSkaterDeploymentProfile>> {
  assertSupabase();
  if (playerIds.length === 0) return new Map();

  const oneYearAgo = new Date(
    new Date(cutoffDate).getTime() - 365 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  const { data, error } = await supabase
    .from("wgo_skater_stats")
    .select("player_id,date,toi_per_game,es_toi_per_game,pp_toi_per_game")
    .in("player_id", playerIds)
    .lt("date", cutoffDate)
    .gte("date", oneYearAgo)
    .order("date", { ascending: false })
    .limit(5000);
  if (error) throw error;

  const latestByPlayer = new Map<number, any>();
  for (const row of (data ?? []) as any[]) {
    const playerId = Number(row?.player_id);
    if (!Number.isFinite(playerId)) continue;
    if (!latestByPlayer.has(playerId)) latestByPlayer.set(playerId, row);
  }

  const profiles = new Map<number, WgoSkaterDeploymentProfile>();
  for (const [playerId, row] of latestByPlayer.entries()) {
    const totalToiSec = normalizeWgoToiToSeconds(row?.toi_per_game);
    const esToiSecRaw = normalizeWgoToiToSeconds(row?.es_toi_per_game);
    const ppToiSecRaw = normalizeWgoToiToSeconds(row?.pp_toi_per_game);
    const ppToiSec = ppToiSecRaw != null ? clamp(ppToiSecRaw, 0, 1200) : null;
    const esToiSec =
      esToiSecRaw != null
        ? clamp(esToiSecRaw, 0, 2400)
        : totalToiSec != null && ppToiSec != null
          ? clamp(totalToiSec - ppToiSec, 0, 2400)
          : null;

    profiles.set(playerId, {
      toiPerGameSec: totalToiSec,
      esToiPerGameSec: esToiSec,
      ppToiPerGameSec: ppToiSec
    });
  }

  return profiles;
}

export async function fetchLatestSkaterContextProfiles(
  playerIds: number[],
  cutoffDate: string
): Promise<{
  shotQuality: Map<number, SkaterShotQualityProfile>;
  onIceContext: Map<number, SkaterOnIceContextProfile>;
}> {
  assertSupabase();
  const shotQuality = new Map<number, SkaterShotQualityProfile>();
  const onIceContext = new Map<number, SkaterOnIceContextProfile>();
  if (playerIds.length === 0) return { shotQuality, onIceContext };

  const oneYearAgo = new Date(
    new Date(cutoffDate).getTime() - 365 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  const { data, error } = await supabase
    .from("player_stats_unified")
    .select(
      "player_id,date,nst_shots_per_60,nst_ixg_per_60,nst_rush_attempts_per_60,nst_rebounds_created_per_60,nst_oi_xgf_per_60,nst_oi_xga_per_60,nst_oi_cf_pct_rates,nst_oi_cf_pct,possession_pct_safe"
    )
    .in("player_id", playerIds)
    // These are per-game actuals; the target slate is not pregame context.
    .lt("date", cutoffDate)
    .gte("date", oneYearAgo)
    .order("date", { ascending: false })
    .limit(5000);
  if (error) throw error;

  const latestByPlayer = new Map<number, any>();
  for (const row of (data ?? []) as any[]) {
    const playerId = Number(row?.player_id);
    if (!Number.isFinite(playerId)) continue;
    if (!latestByPlayer.has(playerId)) latestByPlayer.set(playerId, row);
  }

  for (const [playerId, row] of latestByPlayer.entries()) {
    shotQuality.set(playerId, {
      sourceDate: typeof row?.date === "string" ? row.date : null,
      nstShotsPer60: finiteOrNull(row?.nst_shots_per_60),
      nstIxgPer60: finiteOrNull(row?.nst_ixg_per_60),
      nstRushAttemptsPer60: finiteOrNull(row?.nst_rush_attempts_per_60),
      nstReboundsCreatedPer60: finiteOrNull(row?.nst_rebounds_created_per_60)
    });
    onIceContext.set(playerId, {
      sourceDate: typeof row?.date === "string" ? row.date : null,
      nstOiXgfPer60: finiteOrNull(row?.nst_oi_xgf_per_60),
      nstOiXgaPer60: finiteOrNull(row?.nst_oi_xga_per_60),
      nstOiCfPct:
        finiteOrNull(row?.nst_oi_cf_pct_rates) ?? finiteOrNull(row?.nst_oi_cf_pct),
      possessionPctSafe: finiteOrNull(row?.possession_pct_safe)
    });
  }
  return { shotQuality, onIceContext };
}

export async function fetchLatestSkaterShotQualityProfiles(playerIds: number[], cutoffDate: string) {
  return (await fetchLatestSkaterContextProfiles(playerIds, cutoffDate)).shotQuality;
}

export async function fetchLatestSkaterOnIceContextProfiles(playerIds: number[], cutoffDate: string) {
  return (await fetchLatestSkaterContextProfiles(playerIds, cutoffDate)).onIceContext;
}

export async function fetchLatestSkaterTrendAdjustments(
  playerIds: number[],
  asOfDate: string
): Promise<SkaterTrendAdjustmentFetchResult> {
  assertSupabase();
  const uniquePlayerIds = Array.from(new Set(playerIds)).filter((id) =>
    Number.isFinite(id)
  );
  const diagnostics: SkaterTrendAdjustmentFetchDiagnostics = {
    requestedPlayers: uniquePlayerIds.length,
    eligibleRows: 0,
    playersWithRows: 0,
    playersAdjusted: 0,
    playersMissingRows: 0,
    playersNeutralizedByRecency: 0,
    selectedSoftStaleRows: 0,
    selectedHardStaleRows: 0,
    fetchFailed: false,
    fetchErrorMessage: null
  };
  if (uniquePlayerIds.length === 0) {
    return {
      adjustments: new Map(),
      diagnostics
    };
  }

  const { data, error } = await supabase
    .from("sustainability_trend_bands")
    .select(
      "player_id,snapshot_date,metric_key,window_code,value,ci_lower,ci_upper,n_eff"
    )
    .in("player_id", uniquePlayerIds)
    .in("metric_key", [...TREND_BAND_METRIC_PRIORITY])
    .in("window_code", [...TREND_BAND_WINDOW_PRIORITY])
    .lte("snapshot_date", asOfDate)
    .order("snapshot_date", { ascending: false })
    .limit(12000);
  if (error) {
    diagnostics.fetchFailed = true;
    diagnostics.fetchErrorMessage =
      error.message ?? "Unknown sustainability trend-band fetch failure";
    console.warn("Error fetching sustainability trend bands for projections:", error);
    diagnostics.playersMissingRows = uniquePlayerIds.length;
    return {
      adjustments: new Map(),
      diagnostics
    };
  }

  const rowsByPlayer = new Map<number, SustainabilityTrendBandRow[]>();
  for (const raw of (data ?? []) as unknown as SustainabilityTrendBandRow[]) {
    const playerId = Number(raw.player_id);
    if (!Number.isFinite(playerId)) continue;
    if (!trendBandMetricPriority.has(raw.metric_key)) continue;
    if (!trendBandWindowPriority.has(raw.window_code)) continue;
    const rows = rowsByPlayer.get(playerId) ?? [];
    rows.push(raw);
    rowsByPlayer.set(playerId, rows);
  }
  diagnostics.eligibleRows = Array.from(rowsByPlayer.values()).reduce(
    (sum, rows) => sum + rows.length,
    0
  );
  diagnostics.playersWithRows = rowsByPlayer.size;
  diagnostics.playersMissingRows = Math.max(
    0,
    uniquePlayerIds.length - diagnostics.playersWithRows
  );

  const out = new Map<number, SkaterTrendAdjustment>();
  for (const [playerId, rows] of rowsByPlayer.entries()) {
    const chosen = rows
      .slice()
      .sort((a, b) => compareTrendBandRowsForSelection(a, b, asOfDate))[0];
    if (!chosen) continue;

    const adjustment = computeSkaterTrendAdjustment({ row: chosen, asOfDate });
    if (!adjustment) continue;
    const recencyClass = classifyTrendBandRecency(
      Math.max(0, daysBetweenDates(asOfDate, adjustment.snapshotDate))
    );
    if (recencyClass === "soft_stale") diagnostics.selectedSoftStaleRows += 1;
    if (recencyClass === "hard_stale") diagnostics.selectedHardStaleRows += 1;
    if (adjustment.effectState === "neutralized_by_recency") {
      diagnostics.playersNeutralizedByRecency += 1;
    }
    if (adjustment.effectState === "applied") diagnostics.playersAdjusted += 1;
    out.set(playerId, adjustment);
  }

  return {
    adjustments: out,
    diagnostics
  };
}
