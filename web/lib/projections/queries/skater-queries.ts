import supabase from "lib/supabase/server";
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
import { parseDateOnly, daysBetweenDates } from "../utils/date-utils";
import { clamp, finiteOrNull } from "../utils/number-utils";

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

export const ROLLING_ROW_SELECT_CLAUSE =
  "player_id,strength_state,game_date,toi_seconds_avg_last5,toi_seconds_avg_all,sog_per_60_last5,sog_per_60_all,sog_per_60_avg_last5,sog_per_60_avg_all,goals_total_last5,shots_total_last5,assists_total_last5,goals_total_all,shots_total_all,assists_total_all,hits_per_60_last5,hits_per_60_all,hits_per_60_avg_last5,hits_per_60_avg_all,blocks_per_60_last5,blocks_per_60_all,blocks_per_60_avg_last5,blocks_per_60_avg_all";

function normalizeWgoToiToSeconds(value: number | null | undefined): number | null {
  const n = finiteOrNull(value);
  if (n == null || n <= 0) return null;
  if (n <= 60) return Number((n * 60).toFixed(3));
  if (n <= 3600) return Number(n.toFixed(3));
  return 3600;
}

function computeSkaterTrendAdjustment(args: {
  row: SustainabilityTrendBandRow;
  asOfDate: string;
}): SkaterTrendAdjustment | null {
  const value = finiteOrNull(args.row.value);
  const ciLower = finiteOrNull(args.row.ci_lower);
  const ciUpper = finiteOrNull(args.row.ci_upper);
  const snapshotDate = parseDateOnly(args.row.snapshot_date);
  if (value == null || ciLower == null || ciUpper == null || !snapshotDate) {
    return null;
  }

  const lower = Math.min(ciLower, ciUpper);
  const upper = Math.max(ciLower, ciUpper);
  const bandWidth = Math.max(upper - lower, 1e-4);
  let signedDistance = 0;
  if (value > upper) {
    signedDistance = (value - upper) / bandWidth;
  } else if (value < lower) {
    signedDistance = -((lower - value) / bandWidth);
  }

  const boundedDistance = clamp(signedDistance, -2, 2);
  if (Math.abs(boundedDistance) < 1e-6) {
    return {
      metricKey: args.row.metric_key,
      windowCode: args.row.window_code,
      snapshotDate,
      value,
      ciLower: lower,
      ciUpper: upper,
      nEff: finiteOrNull(args.row.n_eff),
      confidence: 0,
      signedDistance: 0,
      shotRateMultiplier: 1,
      goalRateMultiplier: 1,
      assistRateMultiplier: 1,
      uncertaintyVolatilityMultiplier: 1
    };
  }

  const nEff = finiteOrNull(args.row.n_eff);
  const nEffWeight = nEff == null ? 0.6 : clamp(nEff / 8, 0.35, 1);
  const ageDays = Math.max(0, daysBetweenDates(args.asOfDate, snapshotDate));
  const recencyWeight =
    ageDays <= 3 ? 1 : ageDays >= 28 ? 0.35 : 1 - ((ageDays - 3) / 25) * 0.65;
  const confidence = clamp(nEffWeight * recencyWeight, 0.2, 1);
  const weightedSignal = boundedDistance * confidence;

  return {
    metricKey: args.row.metric_key,
    windowCode: args.row.window_code,
    snapshotDate,
    value,
    ciLower: lower,
    ciUpper: upper,
    nEff,
    confidence: Number(confidence.toFixed(4)),
    signedDistance: Number(weightedSignal.toFixed(4)),
    shotRateMultiplier: Number(clamp(1 + weightedSignal * 0.08, 0.88, 1.12).toFixed(4)),
    goalRateMultiplier: Number(clamp(1 + weightedSignal * 0.1, 0.86, 1.14).toFixed(4)),
    assistRateMultiplier: Number(clamp(1 + weightedSignal * 0.08, 0.88, 1.12).toFixed(4)),
    uncertaintyVolatilityMultiplier: Number(
      (1 + clamp(Math.abs(weightedSignal) * 0.45, 0, 0.55)).toFixed(4)
    )
  };
}

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
  return (data ?? []) as RollingRow[];
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
): Promise<Map<number, SkaterTrendAdjustment>> {
  assertSupabase();
  const uniquePlayerIds = Array.from(new Set(playerIds)).filter((id) =>
    Number.isFinite(id)
  );
  if (uniquePlayerIds.length === 0) return new Map();

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
    console.warn("Error fetching sustainability trend bands for projections:", error);
    return new Map();
  }

  const metricPriority = new Map<string, number>(
    TREND_BAND_METRIC_PRIORITY.map((metric, idx) => [metric, idx])
  );
  const windowPriority = new Map<string, number>(
    TREND_BAND_WINDOW_PRIORITY.map((window, idx) => [window, idx])
  );
  const rowsByPlayer = new Map<number, SustainabilityTrendBandRow[]>();
  for (const raw of (data ?? []) as unknown as SustainabilityTrendBandRow[]) {
    const playerId = Number(raw.player_id);
    if (!Number.isFinite(playerId)) continue;
    if (!metricPriority.has(raw.metric_key)) continue;
    if (!windowPriority.has(raw.window_code)) continue;
    const rows = rowsByPlayer.get(playerId) ?? [];
    rows.push(raw);
    rowsByPlayer.set(playerId, rows);
  }

  const out = new Map<number, SkaterTrendAdjustment>();
  for (const [playerId, rows] of rowsByPlayer.entries()) {
    const chosen = rows.slice().sort((a, b) => {
      const metricDelta =
        (metricPriority.get(a.metric_key) ?? 99) -
        (metricPriority.get(b.metric_key) ?? 99);
      if (metricDelta !== 0) return metricDelta;
      const windowDelta =
        (windowPriority.get(a.window_code) ?? 99) -
        (windowPriority.get(b.window_code) ?? 99);
      if (windowDelta !== 0) return windowDelta;
      const dateA = parseDateOnly(a.snapshot_date) ?? "";
      const dateB = parseDateOnly(b.snapshot_date) ?? "";
      return dateB.localeCompare(dateA);
    })[0];
    if (!chosen) continue;

    const adjustment = computeSkaterTrendAdjustment({ row: chosen, asOfDate });
    if (!adjustment) continue;
    out.set(playerId, adjustment);
  }

  return out;
}
