/**
 * PROTOTYPE (offline, not wired into the writer or the capture). A batched latest-row read of
 * sustainability_trend_bands for the FORGE skater trend adjustment, to replace the history GET in
 * skater-queries.ts `fetchLatestSkaterTrendAdjustments` once Astra/Scout and TJ approve.
 *
 * The old GET asks for every snapshot of the team's players (limit=12000) ordered by snapshot_date only.
 * PostgREST caps it at max_rows = 1,000 rows (production Content-Range 0-999/*, 2026-11-15), so the reader
 * already sees only the newest ~1,000 rows, with an unspecified cut among rows tied on the boundary date. It
 * timed out (57014, 8 s) for one team on 2026-11-15.
 *
 * The candidate RPC `forge_latest_trend_bands` (SQL in tasks/artifacts/forge-pregame-capture-2026-11-14/
 * trend-band-reader/sql) returns one row per requested (player, metric, window): the newest row on or before
 * the as-of date, or nulls when there is none. Selection is unchanged: newest date first, then metric priority,
 * then window priority, through the same compare/compute helpers as the old reader. Because the selected row is
 * always on the player's newest eligible date, the per-key latest rows contain every row the old selection could
 * pick; a stale row comes back as stale, never as missing.
 *
 * Counter change (TJ, 2026-11-15): `eligibleRows` counted the rows the capped GET returned (1,000 per full team in
 * production). Here it counts the latest candidate rows (at most metrics x windows per player). The integration writes
 * it to `data_quality.trend_adjustment_candidate_rows` and drops `trend_adjustment_rows_eligible`. Stale players are
 * reported as stale, not missing (TJ, 2026-11-15). Production plans each probe as a backward primary-key scan
 * (read-only EXPLAIN, 2026-11-15), so no new index is needed.
 */
import {
  TREND_BAND_METRIC_PRIORITY,
  TREND_BAND_WINDOW_PRIORITY
} from "../constants/projection-weights";
import type {
  SkaterTrendAdjustment,
  SustainabilityTrendBandRow
} from "../types/run-forge-projections.types";
import type {
  SkaterTrendAdjustmentFetchDiagnostics,
  SkaterTrendAdjustmentFetchResult
} from "./skater-queries";
import { daysBetweenDates } from "../utils/date-utils";
import {
  classifyTrendBandRecency,
  compareTrendBandRowsForSelection,
  computeSkaterTrendAdjustment
} from "../utils/trend-adjustments";

export const FORGE_LATEST_TREND_BANDS_RPC = "forge_latest_trend_bands";
/** The function refuses more keys than PostgREST's max_rows would return; the reader checks first. */
export const LATEST_TREND_BAND_MAX_KEYS = 1000;
export const LATEST_TREND_BAND_ELIGIBLE_ROWS_MEANING = "latest_candidate_rows" as const;

export type LatestTrendBandKeyRow = {
  player_id: number;
  metric_key: string;
  window_code: string;
  snapshot_date: string | null;
  value: number | null;
  ci_lower: number | null;
  ci_upper: number | null;
  n_eff: number | null;
};

export type LatestTrendBandKey = { playerId: number; metricKey: string; windowCode: string };

/** The requested keys in the function's output order (player_id, metric_key, window_code; text by code point). */
export function expectedLatestTrendBandKeys(
  playerIds: number[],
  metricKeys: readonly string[] = TREND_BAND_METRIC_PRIORITY,
  windowCodes: readonly string[] = TREND_BAND_WINDOW_PRIORITY
): LatestTrendBandKey[] {
  const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const players = Array.from(new Set(playerIds)).sort((a, b) => a - b);
  const metrics = Array.from(new Set(metricKeys)).sort(byCodePoint);
  const windows = Array.from(new Set(windowCodes)).sort(byCodePoint);
  const keys: LatestTrendBandKey[] = [];
  for (const playerId of players) {
    for (const metricKey of metrics) {
      for (const windowCode of windows) keys.push({ playerId, metricKey, windowCode });
    }
  }
  return keys;
}

/**
 * Proves the response covers exactly the requested keys, in order, with a row only on or before the as-of
 * date and either a complete row or none. Returns a problem description, or null when it holds.
 */
export function latestTrendBandCoverageProblem(
  rows: unknown,
  keys: LatestTrendBandKey[],
  asOfDate: string
): string | null {
  if (!Array.isArray(rows)) return "response_not_array";
  if (rows.length !== keys.length) return `row_count:${rows.length}!=${keys.length}`;
  for (let index = 0; index < keys.length; index += 1) {
    const row = rows[index] as Partial<LatestTrendBandKeyRow> | null;
    const key = keys[index];
    if (!row || Number(row.player_id) !== key.playerId || row.metric_key !== key.metricKey || row.window_code !== key.windowCode) {
      return `key_mismatch:${index}`;
    }
    if (row.snapshot_date == null) {
      if (row.value != null || row.ci_lower != null || row.ci_upper != null || row.n_eff != null) return `orphan_values:${index}`;
      continue;
    }
    if (typeof row.snapshot_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.snapshot_date)) return `invalid_date:${index}`;
    if (row.snapshot_date > asOfDate) return `after_as_of:${index}`;
  }
  return null;
}

function emptyDiagnostics(requestedPlayers: number): SkaterTrendAdjustmentFetchDiagnostics {
  return {
    requestedPlayers,
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
}

/** Same selection and diagnostics as the old reader, over the latest candidate rows. */
export function selectSkaterTrendAdjustmentsFromLatest(
  rows: LatestTrendBandKeyRow[],
  requestedPlayerIds: number[],
  asOfDate: string
): SkaterTrendAdjustmentFetchResult {
  const uniquePlayerIds = Array.from(new Set(requestedPlayerIds)).filter((id) => Number.isFinite(id));
  const diagnostics = emptyDiagnostics(uniquePlayerIds.length);
  const rowsByPlayer = new Map<number, SustainabilityTrendBandRow[]>();
  for (const raw of rows) {
    if (raw.snapshot_date == null) continue;
    const playerId = Number(raw.player_id);
    if (!Number.isFinite(playerId)) continue;
    const candidate: SustainabilityTrendBandRow = {
      player_id: raw.player_id,
      snapshot_date: raw.snapshot_date,
      metric_key: raw.metric_key,
      window_code: raw.window_code,
      value: raw.value,
      ci_lower: raw.ci_lower,
      ci_upper: raw.ci_upper,
      n_eff: raw.n_eff
    };
    const list = rowsByPlayer.get(playerId) ?? [];
    list.push(candidate);
    rowsByPlayer.set(playerId, list);
  }
  diagnostics.eligibleRows = Array.from(rowsByPlayer.values()).reduce((sum, list) => sum + list.length, 0);
  diagnostics.playersWithRows = rowsByPlayer.size;
  diagnostics.playersMissingRows = Math.max(0, uniquePlayerIds.length - diagnostics.playersWithRows);

  const adjustments = new Map<number, SkaterTrendAdjustment>();
  for (const [playerId, list] of rowsByPlayer.entries()) {
    const chosen = list.slice().sort((a, b) => compareTrendBandRowsForSelection(a, b, asOfDate))[0];
    if (!chosen) continue;
    const adjustment = computeSkaterTrendAdjustment({ row: chosen, asOfDate });
    if (!adjustment) continue;
    const recencyClass = classifyTrendBandRecency(Math.max(0, daysBetweenDates(asOfDate, adjustment.snapshotDate)));
    if (recencyClass === "soft_stale") diagnostics.selectedSoftStaleRows += 1;
    if (recencyClass === "hard_stale") diagnostics.selectedHardStaleRows += 1;
    if (adjustment.effectState === "neutralized_by_recency") diagnostics.playersNeutralizedByRecency += 1;
    if (adjustment.effectState === "applied") diagnostics.playersAdjusted += 1;
    adjustments.set(playerId, adjustment);
  }
  return { adjustments, diagnostics };
}

type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>, options: { get: true }) => PromiseLike<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};

/**
 * One GET call for the team's players. A failed or incomplete read keeps the old reader's contract (no
 * adjustments, fetchFailed with a message; the writer runs on), and the capture transport records the HTTP
 * refusal. An oversized request is refused before any call.
 */
export async function fetchLatestSkaterTrendAdjustmentsBatched(
  db: RpcClient,
  playerIds: number[],
  asOfDate: string
): Promise<SkaterTrendAdjustmentFetchResult> {
  const uniquePlayerIds = Array.from(new Set(playerIds)).filter((id) => Number.isSafeInteger(id));
  if (uniquePlayerIds.length === 0) {
    return { adjustments: new Map(), diagnostics: emptyDiagnostics(0) };
  }
  const keys = expectedLatestTrendBandKeys(uniquePlayerIds);
  const failed = (message: string): SkaterTrendAdjustmentFetchResult => {
    const diagnostics = emptyDiagnostics(uniquePlayerIds.length);
    diagnostics.fetchFailed = true;
    diagnostics.fetchErrorMessage = message;
    diagnostics.playersMissingRows = uniquePlayerIds.length;
    return { adjustments: new Map(), diagnostics };
  };
  if (keys.length > LATEST_TREND_BAND_MAX_KEYS) return failed(`trend_band_keys_exceed_limit:${keys.length}`);
  const { data, error } = await db.rpc(
    FORGE_LATEST_TREND_BANDS_RPC,
    {
      p_player_ids: uniquePlayerIds,
      p_metric_keys: [...TREND_BAND_METRIC_PRIORITY],
      p_window_codes: [...TREND_BAND_WINDOW_PRIORITY],
      p_as_of: asOfDate
    },
    { get: true }
  );
  if (error) return failed(error.message ?? "Unknown sustainability trend-band fetch failure");
  const problem = latestTrendBandCoverageProblem(data, keys, asOfDate);
  if (problem) return failed(`trend_band_coverage:${problem}`);
  return selectSkaterTrendAdjustmentsFromLatest(data as LatestTrendBandKeyRow[], uniquePlayerIds, asOfDate);
}
