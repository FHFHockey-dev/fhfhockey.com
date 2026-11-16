/**
 * Latest-row trend-band read for the FORGE skater trend adjustment (skater-queries.ts
 * `fetchLatestSkaterTrendAdjustments`).
 *
 * The old read was one GET for every snapshot of the team's players (limit=12000), ordered by snapshot_date only.
 * PostgREST caps it at max_rows = 1,000 rows (production Content-Range 0-999/*, 2026-11-15), so it saw only the
 * newest ~1,000 rows, with an unspecified cut among rows tied on the boundary date, and it timed out (57014, 8 s)
 * for one team on 2026-11-15. Players whose newest rows fell past the cap read as missing.
 *
 * `forge_latest_trend_bands` (STABLE GET RPC) returns one row per requested (player, metric, window): the newest row
 * on or before the as-of date, or nulls when there is none. Selection is unchanged: newest date first, then metric
 * priority, then window priority, through the same compare/compute helpers. The selected row is always on the
 * player's newest eligible date, so the per-key latest rows hold every row the selection could pick; a stale row
 * comes back as stale, never as missing (TJ, 2026-11-15). Production plans each probe as a backward primary-key scan
 * (read-only EXPLAIN, 2026-11-15). Evidence: tasks/artifacts/forge-pregame-capture-2026-11-14/trend-band-reader/.
 *
 * `candidateRows` counts the latest candidate rows (at most metrics x windows per player) and is written to
 * `data_quality.trend_adjustment_candidate_rows`, replacing `trend_adjustment_rows_eligible`, which counted the
 * capped GET's rows (1,000 per full team) (TJ, 2026-11-15).
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

const metricKeys = new Set<string>(TREND_BAND_METRIC_PRIORITY);
const windowCodes = new Set<string>(TREND_BAND_WINDOW_PRIORITY);

/** The requested keys in the function's output order (player_id, metric_key, window_code; text by code point). */
export function expectedLatestTrendBandKeys(
  playerIds: number[],
  metrics: readonly string[] = TREND_BAND_METRIC_PRIORITY,
  windows: readonly string[] = TREND_BAND_WINDOW_PRIORITY
): LatestTrendBandKey[] {
  const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const players = Array.from(new Set(playerIds)).sort((a, b) => a - b);
  const sortedMetrics = Array.from(new Set(metrics)).sort(byCodePoint);
  const sortedWindows = Array.from(new Set(windows)).sort(byCodePoint);
  const keys: LatestTrendBandKey[] = [];
  for (const playerId of players) {
    for (const metricKey of sortedMetrics) {
      for (const windowCode of sortedWindows) keys.push({ playerId, metricKey, windowCode });
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

/**
 * The legacy history read's rows reduced to the newest row per key, for the table-read path (read-only
 * reconstruction, replay of a legacy snapshot, or before the RPC is deployed). It keeps the old selection exactly,
 * but still sees only the capped history.
 */
export function latestTrendBandRowsFromHistory(rows: SustainabilityTrendBandRow[]): LatestTrendBandKeyRow[] {
  const latest = new Map<string, LatestTrendBandKeyRow>();
  for (const row of rows) {
    if (!Number.isFinite(Number(row.player_id)) || !metricKeys.has(row.metric_key) || !windowCodes.has(row.window_code)) continue;
    const key = `${Number(row.player_id)}|${row.metric_key}|${row.window_code}`;
    const held = latest.get(key);
    if (!held || (held.snapshot_date ?? "") < row.snapshot_date) latest.set(key, { ...row, player_id: Number(row.player_id) });
  }
  return Array.from(latest.values());
}

export function emptyTrendAdjustmentDiagnostics(requestedPlayers: number): SkaterTrendAdjustmentFetchDiagnostics {
  return {
    requestedPlayers,
    candidateRows: 0,
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

/** No adjustments and every player missing: the writer continues without trend modifiers; a capture refuses. */
export function failedTrendAdjustmentFetch(requestedPlayers: number, message: string): SkaterTrendAdjustmentFetchResult {
  const diagnostics = emptyTrendAdjustmentDiagnostics(requestedPlayers);
  diagnostics.fetchFailed = true;
  diagnostics.fetchErrorMessage = message;
  diagnostics.playersMissingRows = requestedPlayers;
  return { adjustments: new Map(), diagnostics };
}

/** Selection and diagnostics over the latest candidate rows (null rows are keys without data). */
export function selectSkaterTrendAdjustmentsFromLatest(
  rows: LatestTrendBandKeyRow[],
  requestedPlayerIds: number[],
  asOfDate: string
): SkaterTrendAdjustmentFetchResult {
  const uniquePlayerIds = Array.from(new Set(requestedPlayerIds)).filter((id) => Number.isFinite(id));
  const diagnostics = emptyTrendAdjustmentDiagnostics(uniquePlayerIds.length);
  const rowsByPlayer = new Map<number, SustainabilityTrendBandRow[]>();
  for (const raw of rows) {
    if (raw.snapshot_date == null) continue;
    const playerId = Number(raw.player_id);
    if (!Number.isFinite(playerId)) continue;
    const list = rowsByPlayer.get(playerId) ?? [];
    list.push({
      player_id: raw.player_id,
      snapshot_date: raw.snapshot_date,
      metric_key: raw.metric_key,
      window_code: raw.window_code,
      value: raw.value,
      ci_lower: raw.ci_lower,
      ci_upper: raw.ci_upper,
      n_eff: raw.n_eff
    });
    rowsByPlayer.set(playerId, list);
  }
  diagnostics.candidateRows = Array.from(rowsByPlayer.values()).reduce((sum, list) => sum + list.length, 0);
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
