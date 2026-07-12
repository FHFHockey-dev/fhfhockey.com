import type { Database } from "lib/supabase/database-generated.types";
import supabase from "lib/supabase/server";
import type { SustainabilityProjectionInput } from "./types";

export type TrendBandRow =
  Database["public"]["Tables"]["sustainability_trend_bands"]["Insert"];
export type SustainabilityProjectionRow =
  Database["public"]["Tables"]["sustainability_projections"]["Insert"];

type UpsertOptions = {
  onConflict: string;
};

type TrendBandClient = {
  from: (table: "sustainability_trend_bands") => {
    upsert: (
      rows: TrendBandRow[],
      options: UpsertOptions
    ) => Promise<{ error: Error | null }>;
    delete: () => {
      eq: (column: string, value: number | string) => any;
      gte: (column: string, value: string) => any;
      lte: (column: string, value: string) => any;
      in: (column: string, value: Array<number | string | null>) => any;
      not: (column: string, operator: string, value: string) => Promise<{ error: Error | null }>;
    };
  };
};

type ProjectionClient = {
  from: (table: "sustainability_projections") => {
    upsert: (
      rows: SustainabilityProjectionRow[],
      options: UpsertOptions
    ) => Promise<{ error: Error | null }>;
  };
};

export const TREND_BAND_ON_CONFLICT =
  "player_id,snapshot_date,metric_key,window_code";
export const SUSTAINABILITY_PROJECTION_ON_CONFLICT =
  "player_id,snapshot_date,metric_key,horizon_games,projection_type,scope_key";

function assertBandOrder(
  band: SustainabilityProjectionInput["band50"],
  label: string
): void {
  if (band && band.lower > band.upper) {
    throw new Error(`${label} lower bound must not exceed its upper bound`);
  }
}

export function toSustainabilityProjectionRow(
  input: SustainabilityProjectionInput
): SustainabilityProjectionRow {
  const projectionType = input.projectionType ?? "snapshot";
  if (!Number.isInteger(input.horizonGames) || input.horizonGames < 1 || input.horizonGames > 10) {
    throw new Error("horizonGames must be an integer from 1 through 10");
  }
  if (!input.metricKey.trim()) {
    throw new Error("metricKey is required");
  }
  if (projectionType === "opponent_game" && (!input.gameId || !input.opponentTeamId)) {
    throw new Error("opponent_game projections require gameId and opponentTeamId");
  }

  assertBandOrder(input.band50, "band50");
  assertBandOrder(input.band80, "band80");

  const scopeKey =
    projectionType === "snapshot"
      ? "overall"
      : input.scopeKey?.trim() || `game:${input.gameId}`;

  return {
    player_id: input.playerId,
    snapshot_date: input.snapshotDate,
    metric_key: input.metricKey.trim(),
    horizon_games: input.horizonGames,
    projection_type: projectionType,
    scope_key: scopeKey,
    game_id: projectionType === "opponent_game" ? input.gameId : null,
    team_id: input.teamId ?? null,
    opponent_team_id:
      projectionType === "opponent_game" ? input.opponentTeamId : null,
    expected_value: input.expectedValue,
    band50_lower: input.band50?.lower ?? null,
    band50_upper: input.band50?.upper ?? null,
    band80_lower: input.band80?.lower ?? null,
    band80_upper: input.band80?.upper ?? null,
    rate_per_60: input.ratePer60 ?? null,
    toi_seconds: input.toiSeconds ?? null,
    attempts: input.attempts ?? null,
    expected_wins: input.expectedWins ?? null,
    distribution_model: input.distributionModel ?? null,
    opponent_adjustment: (input.opponentAdjustment ?? {}) as SustainabilityProjectionRow["opponent_adjustment"],
    distribution_summary: (input.distributionSummary ?? {}) as SustainabilityProjectionRow["distribution_summary"],
    metadata: (input.metadata ?? {}) as SustainabilityProjectionRow["metadata"],
    ...(input.computedAt ? { computed_at: input.computedAt } : {}),
    ...(input.updatedAt ? { updated_at: input.updatedAt } : {})
  };
}

export async function upsertSustainabilityProjectionRows({
  rows,
  client = supabase as unknown as ProjectionClient,
  chunkSize = 400
}: {
  rows: SustainabilityProjectionRow[];
  client?: ProjectionClient;
  chunkSize?: number;
}): Promise<{ inserted: number; chunks: number }> {
  if (!rows.length) return { inserted: 0, chunks: 0 };

  let chunks = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await client
      .from("sustainability_projections")
      .upsert(chunk, { onConflict: SUSTAINABILITY_PROJECTION_ON_CONFLICT });
    if (error) throw error;
    chunks += 1;
  }

  return { inserted: rows.length, chunks };
}

export async function upsertTrendBandRows({
  rows,
  client = supabase as unknown as TrendBandClient,
  chunkSize = 400
}: {
  rows: TrendBandRow[];
  client?: TrendBandClient;
  chunkSize?: number;
}): Promise<{ inserted: number; chunks: number }> {
  const filteredRows = rows.filter(Boolean);
  if (!filteredRows.length) {
    return { inserted: 0, chunks: 0 };
  }

  let chunks = 0;
  for (let i = 0; i < filteredRows.length; i += chunkSize) {
    const chunk = filteredRows.slice(i, i + chunkSize);
    const { error } = await client
      .from("sustainability_trend_bands")
      .upsert(chunk, {
        onConflict: TREND_BAND_ON_CONFLICT
      });
    if (error) throw error;
    chunks += 1;
  }

  return { inserted: filteredRows.length, chunks };
}

function buildInList(values: string[]): string {
  return `(${values.map((value) => `"${value}"`).join(",")})`;
}

export async function deleteStaleTrendBandRows(args: {
  playerId: number;
  seasonIds: Array<number | null>;
  startDate: string;
  endDate: string;
  validDates: string[];
  client?: TrendBandClient;
}): Promise<void> {
  const seasonIds = args.seasonIds.filter(
    (value): value is number => Number.isFinite(Number(value))
  );
  if (!args.validDates.length) {
    return;
  }

  let query = (args.client ?? (supabase as unknown as TrendBandClient))
    .from("sustainability_trend_bands")
    .delete()
    .eq("player_id", args.playerId)
    .gte("snapshot_date", args.startDate)
    .lte("snapshot_date", args.endDate);

  if (seasonIds.length > 0) {
    query = query.in("season_id", seasonIds);
  }

  const { error } = await query.not("snapshot_date", "in", buildInList(args.validDates));
  if (error) throw error;
}
