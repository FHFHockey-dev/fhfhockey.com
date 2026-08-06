import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  PlayerForecastRestOfSeasonAggregate,
  PlayerForecastRestOfSeasonComponent,
  PlayerForecastRestOfSeasonForecast,
} from "./contracts";

const NORMAL_QUANTILES: Record<string, number> = {
  p10: -1.2815515655446004,
  p25: -0.6744897501960817,
  p50: 0,
  p75: 0.6744897501960817,
  p90: 1.2815515655446004,
};

export function aggregatePlayerForecastRestOfSeason(args: {
  components: PlayerForecastRestOfSeasonComponent[];
  conditioning: "conditional_playing" | "unconditional";
  seasonToDateActual?: number;
  scheduleRevisionHash: string;
}): PlayerForecastRestOfSeasonAggregate {
  if (args.components.length === 0) {
    throw new Error("Rest-of-season aggregation requires at least one scheduled game.");
  }
  if (!args.scheduleRevisionHash.trim()) {
    throw new Error("Rest-of-season aggregation requires a schedule revision hash.");
  }
  const gameIds = new Set<number>();
  let remainingMean = 0;
  let remainingVariance = 0;
  const fallbackFlags = new Set<string>();
  for (const component of args.components) {
    if (gameIds.has(component.gameId)) throw new Error("Rest-of-season component games must be unique.");
    gameIds.add(component.gameId);
    if (!Number.isFinite(component.mean) || component.mean < 0) {
      throw new Error("Rest-of-season component mean must be non-negative.");
    }
    if (!Number.isFinite(component.variance) || component.variance < 0) {
      throw new Error("Rest-of-season component variance must be non-negative.");
    }
    const probability = component.playsProbability;
    if (args.conditioning === "unconditional") {
      if (probability == null || probability < 0 || probability > 1) {
        throw new Error("Unconditional rest-of-season aggregation requires a valid plays probability for every game.");
      }
      remainingMean += probability * component.mean;
      remainingVariance +=
        probability * component.variance
        + probability * (1 - probability) * component.mean * component.mean;
    } else {
      remainingMean += component.mean;
      remainingVariance += component.variance;
    }
    for (const flag of component.fallbackFlags ?? []) fallbackFlags.add(flag);
  }
  const standardDeviation = Math.sqrt(remainingVariance);
  const remainingQuantiles = Object.fromEntries(
    Object.entries(NORMAL_QUANTILES).map(([key, zScore]) => [
      key,
      Math.max(0, remainingMean + zScore * standardDeviation),
    ]),
  );
  const seasonToDateActual = args.seasonToDateActual ?? 0;
  return {
    conditioning: args.conditioning,
    remainingGames: args.components.length,
    remainingMean,
    remainingVariance,
    remainingQuantiles,
    seasonToDateActual,
    fullSeasonMean: seasonToDateActual + remainingMean,
    fullSeasonQuantiles: Object.fromEntries(
      Object.entries(remainingQuantiles).map(([key, value]) => [key, seasonToDateActual + value]),
    ),
    distributionKind: "independent_game_moments_normal_approximation",
    scheduleRevisionHash: args.scheduleRevisionHash,
    fallbackFlags: Array.from(fallbackFlags).sort(),
    componentManifest: args.components,
  };
}

export async function loadPlayerForecastRestOfSeason(args: {
  supabase: SupabaseClient<any>;
  playerId?: number | null;
  targetKey?: string | null;
  conditioning?: "conditional_playing" | "unconditional" | null;
}): Promise<PlayerForecastRestOfSeasonForecast[]> {
  let query = args.supabase
    .from("player_forecast_rest_of_season_outputs")
    .select(
      "id,model_artifact_id,season_id,team_id,player_id,population,target_key,conditioning,cutoff_at,issued_at,schedule_revision_hash,remaining_games,season_to_date_actual,point_estimate,variance,distribution_kind,distribution,quantiles,component_manifest,source_high_watermark,fallback_flags",
    )
    .order("issued_at", { ascending: false })
    .limit(500);
  if (args.playerId) query = query.eq("player_id", args.playerId);
  if (args.targetKey) query = query.eq("target_key", args.targetKey);
  if (args.conditioning) query = query.eq("conditioning", args.conditioning);
  const { data, error } = await query;
  if (error) throw error;
  const playerIds = Array.from(new Set((data ?? []).map((row: any) => Number(row.player_id))));
  const { data: players, error: playerError } = playerIds.length
    ? await args.supabase.from("players").select("id,fullName").in("id", playerIds)
    : { data: [], error: null };
  if (playerError) throw playerError;
  const playerNames = new Map((players ?? []).map((row: any) => [Number(row.id), String(row.fullName)]));
  const latest = new Map<string, PlayerForecastRestOfSeasonForecast>();
  for (const row of data ?? []) {
    const key = [row.player_id, row.target_key, row.conditioning, row.model_artifact_id].join(":");
    if (!latest.has(key)) latest.set(key, {
      id: String(row.id),
      modelArtifactId: String(row.model_artifact_id),
      seasonId: Number(row.season_id),
      teamId: Number(row.team_id),
      playerId: Number(row.player_id),
      playerName: playerNames.get(Number(row.player_id)) ?? `Player ${row.player_id}`,
      population: row.population,
      targetKey: String(row.target_key),
      conditioning: row.conditioning,
      remainingGames: Number(row.remaining_games),
      remainingMean: Number(row.point_estimate),
      remainingVariance: Number(row.variance),
      remainingQuantiles: row.quantiles ?? {},
      seasonToDateActual: Number(row.season_to_date_actual),
      fullSeasonMean: Number(row.season_to_date_actual) + Number(row.point_estimate),
      fullSeasonQuantiles: Object.fromEntries(
        Object.entries(row.quantiles ?? {}).map(([quantile, value]) => [
          quantile,
          Number(row.season_to_date_actual) + Number(value),
        ]),
      ),
      issuedAt: String(row.issued_at),
      scheduleRevisionHash: String(row.schedule_revision_hash),
      fallbackFlags: row.fallback_flags ?? [],
    });
  }
  return Array.from(latest.values());
}

export async function persistPlayerForecastRestOfSeason(args: {
  supabase: SupabaseClient<any>;
  modelArtifactId: string;
  seasonId: number;
  teamId: number;
  playerId: number;
  population: "forward" | "defense" | "goalie";
  targetKey: string;
  cutoffAt: string;
  issuedAt: string;
  sourceHighWatermark: string;
  seasonToDateActual: number;
  aggregate: PlayerForecastRestOfSeasonAggregate;
}): Promise<void> {
  const { error } = await args.supabase
    .from("player_forecast_rest_of_season_outputs")
    .insert({
      model_artifact_id: args.modelArtifactId,
      season_id: args.seasonId,
      team_id: args.teamId,
      player_id: args.playerId,
      population: args.population,
      target_key: args.targetKey,
      conditioning: args.aggregate.conditioning,
      cutoff_at: args.cutoffAt,
      issued_at: args.issuedAt,
      schedule_revision_hash: args.aggregate.scheduleRevisionHash,
      remaining_games: args.aggregate.remainingGames,
      season_to_date_actual: args.seasonToDateActual,
      point_estimate: args.aggregate.remainingMean,
      variance: args.aggregate.remainingVariance,
      distribution_kind: args.aggregate.distributionKind,
      distribution: {
        method: args.aggregate.distributionKind,
        fullSeasonMean: args.aggregate.fullSeasonMean,
        fullSeasonQuantiles: args.aggregate.fullSeasonQuantiles,
      },
      quantiles: args.aggregate.remainingQuantiles,
      component_manifest: args.aggregate.componentManifest,
      source_high_watermark: args.sourceHighWatermark,
      fallback_flags: args.aggregate.fallbackFlags,
    });
  if (error?.code !== "23505") {
    if (error) throw error;
  }
}
