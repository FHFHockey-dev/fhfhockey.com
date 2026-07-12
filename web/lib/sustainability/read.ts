import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "lib/supabase/database-generated.types";

type SustainabilityClient = SupabaseClient<Database>;
type ScoreRow = Database["public"]["Tables"]["sustainability_scores"]["Row"];
type BandRow = Database["public"]["Tables"]["sustainability_trend_bands"]["Row"];
type ProjectionRow = Database["public"]["Tables"]["sustainability_projections"]["Row"];

function asRecord(value: Json | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function buildFlags(score: number | null) {
  if (score == null) {
    return { overperforming: false, underperforming: false, state: "unavailable" as const };
  }
  return {
    overperforming: score >= 60,
    underperforming: score <= 40,
    state: score >= 60 ? ("overperforming" as const) : score <= 40 ? ("underperforming" as const) : ("stable" as const)
  };
}

function buildExplanations(components: Record<string, unknown>) {
  return Object.entries(components)
    .filter(([key, value]) => key.startsWith("z_") && typeof value === "number")
    .sort((left, right) => Math.abs(Number(right[1])) - Math.abs(Number(left[1])))
    .slice(0, 3)
    .map(([key, value]) => ({
      feature: key.slice(2),
      impact: Number(value),
      direction: Number(value) > 0 ? "up" : Number(value) < 0 ? "down" : "flat"
    }));
}

export function shapePlayerSustainabilityPayload(args: {
  playerId: number;
  window: number;
  horizon: number;
  score: ScoreRow | null;
  bands: BandRow[];
  projections: ProjectionRow[];
}) {
  const scoreComponents = asRecord(args.score?.components ?? null);
  const snapshotDate =
    args.score?.snapshot_date ?? args.projections[0]?.snapshot_date ?? args.bands[0]?.snapshot_date ?? null;
  return {
    player_id: args.playerId,
    snapshot_date: snapshotDate,
    window_code: `l${args.window}`,
    horizon_games: args.horizon,
    sustainability_score: args.score?.s_100 ?? null,
    score_raw: args.score?.s_raw ?? null,
    probabilities: {
      hot: null,
      normal: null,
      cold: null,
      status: "pending_calibration"
    },
    projections: args.projections.map((row) => ({
      metric_key: row.metric_key,
      expected_value: row.expected_value,
      band50: { lower: row.band50_lower, upper: row.band50_upper },
      band80: { lower: row.band80_lower, upper: row.band80_upper },
      distribution_model: row.distribution_model,
      distribution_summary: row.distribution_summary
    })),
    bands: args.bands.map((row) => ({
      metric_key: row.metric_key,
      value: row.value,
      baseline: row.baseline,
      z_score: row.z_score,
      ci_lower: row.ci_lower,
      ci_upper: row.ci_upper
    })),
    flags: buildFlags(args.score?.s_100 ?? null),
    explanations: buildExplanations(scoreComponents),
    metadata: {
      position_group: args.score?.position_group ?? null,
      season_id: args.score?.season_id ?? null,
      score_components: scoreComponents,
      probability_note: "Calibrated Hot/Normal/Cold probabilities remain unavailable until the backtest/calibration gate passes."
    }
  };
}

export async function getPlayerSustainabilityPayload(args: {
  client: SustainabilityClient;
  playerId: number;
  window: number;
  horizon: number;
}) {
  const windowCode = `l${args.window}`;
  const scoreResult = await args.client
    .from("sustainability_scores")
    .select("player_id, season_id, snapshot_date, position_group, window_code, s_raw, s_100, components, computed_at")
    .eq("player_id", args.playerId)
    .eq("window_code", windowCode)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (scoreResult.error) throw scoreResult.error;
  const score = (scoreResult.data as ScoreRow | null) ?? null;

  let snapshotDate = score?.snapshot_date ?? null;
  if (!snapshotDate) {
    const latestProjection = await args.client
      .from("sustainability_projections")
      .select("snapshot_date")
      .eq("player_id", args.playerId)
      .eq("projection_type", "snapshot")
      .eq("horizon_games", args.horizon)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestProjection.error) throw latestProjection.error;
    snapshotDate = latestProjection.data?.snapshot_date ?? null;
  }
  if (!snapshotDate) return null;

  const [bandResult, projectionResult] = await Promise.all([
    args.client
      .from("sustainability_trend_bands")
      .select("*")
      .eq("player_id", args.playerId)
      .eq("snapshot_date", snapshotDate)
      .eq("window_code", windowCode)
      .order("metric_key", { ascending: true })
      .limit(200),
    args.client
      .from("sustainability_projections")
      .select("*")
      .eq("player_id", args.playerId)
      .eq("snapshot_date", snapshotDate)
      .eq("projection_type", "snapshot")
      .eq("horizon_games", args.horizon)
      .order("metric_key", { ascending: true })
      .limit(200)
  ]);
  if (bandResult.error) throw bandResult.error;
  if (projectionResult.error) throw projectionResult.error;

  return shapePlayerSustainabilityPayload({
    playerId: args.playerId,
    window: args.window,
    horizon: args.horizon,
    score,
    bands: (bandResult.data as BandRow[] | null) ?? [],
    projections: (projectionResult.data as ProjectionRow[] | null) ?? []
  });
}

export function shapeUpcomingSustainabilityPayload(args: {
  playerId: number;
  games: number;
  rows: ProjectionRow[];
}) {
  const byGame = new Map<number, ProjectionRow[]>();
  for (const row of args.rows) {
    if (row.game_id == null) continue;
    byGame.set(row.game_id, [...(byGame.get(row.game_id) ?? []), row]);
  }
  const upcoming = [...byGame.entries()]
    .map(([gameId, rows]) => ({
      game_id: gameId,
      game_date: asRecord(rows[0]?.metadata ?? null).gameDate ?? null,
      team_id: rows[0]?.team_id ?? null,
      opponent_team_id: rows[0]?.opponent_team_id ?? null,
      opponent_team_abbreviation:
        asRecord(rows[0]?.metadata ?? null).opponentTeamAbbreviation ?? null,
      projections: rows
        .sort((left, right) => left.metric_key.localeCompare(right.metric_key))
        .map((row) => ({
          metric_key: row.metric_key,
          expected_value: row.expected_value,
          band50: { lower: row.band50_lower, upper: row.band50_upper },
          band80: { lower: row.band80_lower, upper: row.band80_upper },
          opponent_adjustment: row.opponent_adjustment
        }))
    }))
    .sort((left, right) => String(left.game_date).localeCompare(String(right.game_date)))
    .slice(0, args.games);

  return {
    player_id: args.playerId,
    snapshot_date: args.rows[0]?.snapshot_date ?? null,
    requested_games: args.games,
    games: upcoming,
    rollup: null,
    metadata: {
      rollup_note: "Five/ten-game aggregate projections are available from the player endpoint."
    }
  };
}

export async function getUpcomingSustainabilityPayload(args: {
  client: SustainabilityClient;
  playerId: number;
  games: number;
}) {
  const latest = await args.client
    .from("sustainability_projections")
    .select("snapshot_date")
    .eq("player_id", args.playerId)
    .eq("projection_type", "opponent_game")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest.error) throw latest.error;
  if (!latest.data?.snapshot_date) return null;

  const rowsResult = await args.client
    .from("sustainability_projections")
    .select("*")
    .eq("player_id", args.playerId)
    .eq("snapshot_date", latest.data.snapshot_date)
    .eq("projection_type", "opponent_game")
    .order("game_id", { ascending: true })
    .order("metric_key", { ascending: true })
    .limit(200);
  if (rowsResult.error) throw rowsResult.error;
  return shapeUpcomingSustainabilityPayload({
    playerId: args.playerId,
    games: args.games,
    rows: (rowsResult.data as ProjectionRow[] | null) ?? []
  });
}
