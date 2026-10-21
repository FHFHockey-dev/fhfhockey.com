import supabase from "lib/supabase/server";
import { isReadOnlyProjectionReconstruction } from "lib/projections/queryCaptureHook";
import { getCompatibilityFieldOrder } from "lib/rollingPlayerMetricCompatibility";
import {
  TREND_BAND_METRIC_PRIORITY,
  TREND_BAND_WINDOW_PRIORITY
} from "../constants/projection-weights";
import type {
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
    })
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
let legacyWindowScanWarned = false;

type RollingStrength = "ev" | "pp";

const isIsoDate = (value: unknown): value is string => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString().slice(0, 10) === value;
const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

function isRollingRowInScope(row: RollingRow, requestedIds: Set<number>, strengthState: RollingStrength, cutoffDate: string) {
  return !!row && typeof row === "object" && Number.isSafeInteger(row.player_id)
    && requestedIds.has(row.player_id) && Number.isSafeInteger(row.game_id) && row.game_id > 0
    && Number.isSafeInteger(row.season) && row.season > 0 && row.strength_state === strengthState
    && isIsoDate(row.game_date) && row.game_date < cutoffDate;
}

/**
 * Each requested player's latest row for one strength from the 365 days before
 * cutoffDate, or reject; never a partial read. Callers keep the latest row per
 * player (pickLatestByPlayer). The RPC's support_row (durable sidecar) is not
 * read here: this reader returns the wide columns only, as the legacy scan does.
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
    || (strengthState !== "ev" && strengthState !== "pp") || !isIsoDate(cutoffDate)) {
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
    rows.push(row);
  }
  // The legacy scan's order: newest first, then player ascending, then game descending.
  return rows.sort((a, b) => a.game_date !== b.game_date ? (a.game_date < b.game_date ? 1 : -1)
    : a.player_id !== b.player_id ? a.player_id - b.player_id : b.game_id - a.game_id);
}

/**
 * Legacy window scan, used only while the latest-row RPC is unavailable (see
 * fetchRollingRows): every row of the 365 days before the cutoff in counted
 * 500-row pages. Returns the complete bounded history or rejects; never a
 * capped/partial prefix.
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
    if (rows.length === total) return rows;
  }
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
    .lte("date", cutoffDate)
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
