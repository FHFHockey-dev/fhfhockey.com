import supabase from "lib/supabase/server";
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

export const ROLLING_ROW_SELECT_CLAUSE =
  [
    "player_id",
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

export async function fetchRollingRows(
  playerIds: number[],
  strengthState: "ev" | "pp",
  cutoffDate: string
): Promise<RollingRow[]> {
  assertSupabase();
  if (playerIds.length === 0) return [];

  const oneYearAgo = new Date(
    new Date(cutoffDate).getTime() - 365 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  const { data, error } = await supabase
    .from("rolling_player_game_metrics")
    .select(ROLLING_ROW_SELECT_CLAUSE)
    .in("player_id", playerIds)
    .eq("strength_state", strengthState)
    .lt("game_date", cutoffDate)
    .gt("game_date", oneYearAgo)
    .order("game_date", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return ((data ?? []) as unknown) as RollingRow[];
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

export async function fetchLatestSkaterShotQualityProfiles(
  playerIds: number[],
  cutoffDate: string
): Promise<Map<number, SkaterShotQualityProfile>> {
  assertSupabase();
  if (playerIds.length === 0) return new Map();

  const oneYearAgo = new Date(
    new Date(cutoffDate).getTime() - 365 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  const { data, error } = await supabase
    .from("player_stats_unified")
    .select(
      "player_id,date,nst_shots_per_60,nst_ixg_per_60,nst_rush_attempts_per_60,nst_rebounds_created_per_60"
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

  const profiles = new Map<number, SkaterShotQualityProfile>();
  for (const [playerId, row] of latestByPlayer.entries()) {
    profiles.set(playerId, {
      sourceDate: typeof row?.date === "string" ? row.date : null,
      nstShotsPer60: finiteOrNull(row?.nst_shots_per_60),
      nstIxgPer60: finiteOrNull(row?.nst_ixg_per_60),
      nstRushAttemptsPer60: finiteOrNull(row?.nst_rush_attempts_per_60),
      nstReboundsCreatedPer60: finiteOrNull(row?.nst_rebounds_created_per_60)
    });
  }
  return profiles;
}

export async function fetchLatestSkaterOnIceContextProfiles(
  playerIds: number[],
  cutoffDate: string
): Promise<Map<number, SkaterOnIceContextProfile>> {
  assertSupabase();
  if (playerIds.length === 0) return new Map();

  const oneYearAgo = new Date(
    new Date(cutoffDate).getTime() - 365 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  const { data, error } = await supabase
    .from("player_stats_unified")
    .select(
      "player_id,date,nst_oi_xgf_per_60,nst_oi_xga_per_60,nst_oi_cf_pct_rates,nst_oi_cf_pct,possession_pct_safe"
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

  const profiles = new Map<number, SkaterOnIceContextProfile>();
  for (const [playerId, row] of latestByPlayer.entries()) {
    profiles.set(playerId, {
      sourceDate: typeof row?.date === "string" ? row.date : null,
      nstOiXgfPer60: finiteOrNull(row?.nst_oi_xgf_per_60),
      nstOiXgaPer60: finiteOrNull(row?.nst_oi_xga_per_60),
      nstOiCfPct:
        finiteOrNull(row?.nst_oi_cf_pct_rates) ?? finiteOrNull(row?.nst_oi_cf_pct),
      possessionPctSafe: finiteOrNull(row?.possession_pct_safe)
    });
  }
  return profiles;
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
