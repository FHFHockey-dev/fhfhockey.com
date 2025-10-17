import supabase from "lib/supabase/server";
import {
  SUSTAINABILITY_METRICS,
  type SustainabilityMetricKey
} from "./bands";
import {
  computeTrendBandsForPlayer,
  type TrendBandRecord
} from "./bandCalculator";
import type { Database } from "lib/supabase/database-generated.types";
import { WindowCode } from "./windows";

type PlayerGameRow =
  Database["public"]["Views"]["player_stats_unified"]["Row"];
type PlayerSeasonTotal =
  Database["public"]["Views"]["player_totals_unified"]["Row"];

export const DEFAULT_WINDOWS: WindowCode[] = ["l3", "l5", "l10", "l20"];
export const DEFAULT_METRICS: SustainabilityMetricKey[] = [
  "shots_per_60",
  "icf_per_60",
  "ixg_per_60",
  "points_per_60_5v5",
  "pp_goals_per_60",
  "pp_points_per_60",
  "hits_per_60",
  "blocks_per_60",
  "ipp",
  "sh_pct",
  "on_ice_sh_pct",
  "on_ice_sv_pct",
  "pp_toi_pct",
  "pdo",
  "fantasy_score"
];

export function parseDateParam(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return new Date().toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate)
    ? candidate
    : new Date().toISOString().slice(0, 10);
}

export function parseMetricParam(
  value: string | string[] | undefined
): SustainabilityMetricKey[] {
  if (!value) return DEFAULT_METRICS;
  const list = Array.isArray(value)
    ? value
    : String(value)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
  const valid = list.filter((item): item is SustainabilityMetricKey =>
    SUSTAINABILITY_METRICS.includes(item as SustainabilityMetricKey)
  );
  return valid.length ? valid : DEFAULT_METRICS;
}

export function parseWindowParam(
  value: string | string[] | undefined
): WindowCode[] {
  if (!value) return DEFAULT_WINDOWS;
  const list = Array.isArray(value)
    ? value
    : String(value)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
  const valid = list.filter((window): window is WindowCode =>
    (DEFAULT_WINDOWS as readonly string[]).includes(window)
  );
  return valid.length ? valid : DEFAULT_WINDOWS;
}

function normalizeSnapshotDate(value: string | null | undefined): string {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }
  if (value.length >= 10) {
    return value.slice(0, 10);
  }
  return new Date(value).toISOString().slice(0, 10);
}

function normalizeTrendBandRecord(record: TrendBandRecord): TrendBandRecord {
  return {
    ...record,
    snapshot_date: normalizeSnapshotDate(record.snapshot_date),
    ci_lower: Number(record.ci_lower.toFixed(6)),
    ci_upper: Number(record.ci_upper.toFixed(6)),
    value: Number(record.value.toFixed(6)),
    baseline:
      record.baseline != null ? Number(record.baseline.toFixed(6)) : null,
    ewma: record.ewma != null ? Number(record.ewma.toFixed(6)) : null,
    n_eff: record.n_eff != null ? Number(record.n_eff.toFixed(3)) : null,
    exposure:
      record.exposure != null ? Number(record.exposure.toFixed(3)) : null
  };
}

async function upsertTrendBandRows(rows: TrendBandRecord[]): Promise<void> {
  if (!rows.length) return;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error: upsertError } = await (supabase as any)
      .from("sustainability_trend_bands")
      .upsert(chunk, {
        onConflict: "player_id,snapshot_date,metric_key,window_code"
      });
    if (upsertError) throw upsertError;
  }
}

export async function fetchPlayerGameRows(
  playerId: number,
  snapshotDate: string,
  limit = 40
): Promise<PlayerGameRow[]> {
  const columns = [
    "player_id",
    "season_id",
    "date",
    "shots",
    "goals",
    "assists",
    "hits",
    "blocked_shots",
    "points",
    "points_5v5",
    "pp_goals",
    "pp_points",
    "pp_toi",
    "pp_toi_pct_per_game",
    "nst_toi",
    "toi_per_game",
    "ev_time_on_ice",
    "nst_icf",
    "nst_ixg",
    "nst_iscfs",
    "nst_hdcf",
    "nst_oi_gf",
    "nst_oi_sf",
    "nst_oi_sa",
    "nst_oi_ga",
    "nst_oi_pdo",
    "nst_oi_shooting_pct",
    "nst_oi_save_pct"
  ].join(",");

  const { data, error } = await supabase
    .from("player_stats_unified")
    .select(columns)
    .eq("player_id", playerId)
    .lte("date", snapshotDate)
    .order("date", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as unknown) as PlayerGameRow[];
}

export async function fetchSeasonTotals(
  playerId: number
): Promise<PlayerSeasonTotal[]> {
  const { data, error } = await supabase
    .from("player_totals_unified")
    .select("*")
    .eq("player_id", playerId)
    .order("season_id", { ascending: false })
    .limit(4);
  if (error) throw error;
  return ((data ?? []) as unknown) as PlayerSeasonTotal[];
}

export async function computeAndStoreTrendBands({
  playerId,
  snapshotDate,
  metrics,
  windows,
  gameLimit = 40,
  dry = false
}: {
  playerId: number;
  snapshotDate: string;
  metrics: SustainabilityMetricKey[];
  windows: WindowCode[];
  gameLimit?: number;
  dry?: boolean;
}): Promise<{ rows: TrendBandRecord[]; seasonId: number | null }> {
  const gameRows = await fetchPlayerGameRows(playerId, snapshotDate, gameLimit);
  if (!gameRows.length) {
    return { rows: [], seasonId: null };
  }

  const seasonTotals = await fetchSeasonTotals(playerId);
  const seasonId =
    gameRows[0]?.season_id ?? seasonTotals[0]?.season_id ?? null;

  const bands = computeTrendBandsForPlayer({
    playerId,
    snapshotDate,
    seasonId,
    metrics,
    rows: gameRows,
    totals: seasonTotals,
    windows
  });

  if (!bands.length) {
    return { rows: [], seasonId };
  }

  const payload: TrendBandRecord[] = bands.map(normalizeTrendBandRecord);

  if (!dry) {
    await upsertTrendBandRows(payload);
  }

  return { rows: payload, seasonId };
}

export async function computeAndStoreTrendBandHistory({
  playerId,
  metrics,
  windows,
  startDate,
  endDate,
  gameLimit = 160,
  dry = false
}: {
  playerId: number;
  metrics: SustainabilityMetricKey[];
  windows: WindowCode[];
  startDate?: string | null;
  endDate?: string | null;
  gameLimit?: number;
  dry?: boolean;
}): Promise<{
  rows: TrendBandRecord[];
  snapshots: number;
  totalRows: number;
  seasonIds: Array<number | null>;
}> {
  const effectiveEnd = normalizeSnapshotDate(
    endDate ?? new Date().toISOString().slice(0, 10)
  );
  const normalizedStart = startDate ? normalizeSnapshotDate(startDate) : null;

  if (normalizedStart && normalizedStart > effectiveEnd) {
    return { rows: [], snapshots: 0, totalRows: 0, seasonIds: [] };
  }

  const limit = Math.max(1, gameLimit);
  const gameRows = await fetchPlayerGameRows(playerId, effectiveEnd, limit);
  if (!gameRows.length) {
    return { rows: [], snapshots: 0, totalRows: 0, seasonIds: [] };
  }

  const seasonTotals = await fetchSeasonTotals(playerId);

  const rowsWithIso = gameRows
    .slice()
    .map((row) => {
      const rawDate = (row as any)?.date ?? null;
      if (!rawDate) return null;
      const iso = normalizeSnapshotDate(
        typeof rawDate === "string" ? rawDate : String(rawDate)
      );
      return { row, iso };
    })
    .filter(
      (entry): entry is { row: PlayerGameRow; iso: string } => entry != null
    )
    .sort((a, b) => a.iso.localeCompare(b.iso));

  if (!rowsWithIso.length) {
    return { rows: [], snapshots: 0, totalRows: 0, seasonIds: [] };
  }

  const accumulator: PlayerGameRow[] = [];
  const seenDates = new Set<string>();
  const seasonSet = new Set<number | null>();
  const allRecords: TrendBandRecord[] = [];

  const upperBound = endDate
    ? normalizeSnapshotDate(endDate)
    : rowsWithIso[rowsWithIso.length - 1].iso;

  for (const { row, iso } of rowsWithIso) {
    accumulator.push(row);
    if (accumulator.length > limit) {
      accumulator.shift();
    }

    if (iso > upperBound) {
      break;
    }

    if (normalizedStart && iso < normalizedStart) {
      continue;
    }

    if (seenDates.has(iso)) {
      continue;
    }
    seenDates.add(iso);

    const windowRows = accumulator.slice().reverse();
    const seasonId =
      row.season_id ??
      windowRows.find((item) => item.season_id != null)?.season_id ??
      null;
    seasonSet.add(seasonId ?? null);

    const bands = computeTrendBandsForPlayer({
      playerId,
      snapshotDate: iso,
      seasonId,
      metrics,
      rows: windowRows,
      totals: seasonTotals,
      windows
    });

    if (!bands.length) {
      continue;
    }

    allRecords.push(...bands.map(normalizeTrendBandRecord));
  }

  if (!allRecords.length) {
    return {
      rows: [],
      snapshots: seenDates.size,
      totalRows: 0,
      seasonIds: Array.from(seasonSet)
    };
  }

  if (!dry) {
    await upsertTrendBandRows(allRecords);
  }

  return {
    rows: dry ? allRecords : [],
    snapshots: seenDates.size,
    totalRows: allRecords.length,
    seasonIds: Array.from(seasonSet)
  };
}
