import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "lib/supabase/database-generated.types";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import { getPriorSeasonIds } from "./priors";
import { SUSTAINABILITY_SCORE_WINDOW_CODES } from "./runtimeContract";

type SustainabilityClient = SupabaseClient<Database>;
type ScoreRow = Database["public"]["Tables"]["sustainability_scores"]["Row"];
type BandRow = Database["public"]["Tables"]["sustainability_trend_bands"]["Row"];
type ProjectionRow = Database["public"]["Tables"]["sustainability_projections"]["Row"];
type PlayerTotalRow = Pick<
  Database["public"]["Views"]["player_totals_unified"]["Row"],
  "player_id" | "player_name" | "position_code" | "season_id" | "games_played"
>;

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

export function shapePlayerSustainabilitySummaryPayload(args: {
  playerId: number;
  rows: ScoreRow[];
}) {
  const latestByWindow = new Map<string, ScoreRow>();
  for (const row of args.rows) {
    const current = latestByWindow.get(row.window_code);
    if (!current || row.snapshot_date > current.snapshot_date) {
      latestByWindow.set(row.window_code, row);
    }
  }
  const windows = SUSTAINABILITY_SCORE_WINDOW_CODES.flatMap((windowCode) => {
    const row = latestByWindow.get(windowCode);
    if (!row) return [];
    const components = asRecord(row.components);
    return [{
      window_code: windowCode,
      snapshot_date: row.snapshot_date,
      season_id: row.season_id,
      position_group: row.position_group,
      s_raw: row.s_raw,
      s_100: row.s_100,
      model_version: components.modelVersion ?? null,
      config_hash: components.configHash ?? null
    }];
  });

  if (windows.length === 0) return null;
  return {
    player_id: args.playerId,
    snapshot_date: windows.reduce(
      (latest, row) => row.snapshot_date > latest ? row.snapshot_date : latest,
      windows[0].snapshot_date
    ),
    window_contract: [...SUSTAINABILITY_SCORE_WINDOW_CODES],
    windows
  };
}

export async function getPlayerSustainabilitySummaryPayload(args: {
  client: SustainabilityClient;
  playerId: number;
}) {
  const result = await args.client
    .from("sustainability_scores")
    .select(
      "player_id, season_id, snapshot_date, position_group, window_code, s_raw, s_100, components, computed_at"
    )
    .eq("player_id", args.playerId)
    .in("window_code", [...SUSTAINABILITY_SCORE_WINDOW_CODES])
    .order("snapshot_date", { ascending: false })
    .order("window_code", { ascending: true })
    .limit(100);
  if (result.error) throw result.error;
  return shapePlayerSustainabilitySummaryPayload({
    playerId: args.playerId,
    rows: (result.data ?? []) as ScoreRow[]
  });
}

export type SustainabilityLeaderboardOptions = {
  windowCode: typeof SUSTAINABILITY_SCORE_WINDOW_CODES[number];
  minGames: number;
  minScore: number;
  rookieOnly: boolean;
  page: number;
  pageSize: number;
  includeComponents: boolean;
};

export function shapeSustainabilityLeaderboardPayload(args: {
  snapshotDate: string;
  seasonId: number;
  scoreRows: ScoreRow[];
  playerTotalRows: PlayerTotalRow[];
  options: SustainabilityLeaderboardOptions;
}) {
  const currentTotals = new Map<number, PlayerTotalRow>();
  const priorPlayers = new Set<number>();
  for (const row of args.playerTotalRows) {
    if (row.player_id == null || row.season_id == null) continue;
    if (row.season_id === args.seasonId) {
      currentTotals.set(row.player_id, row);
    } else if ((row.games_played ?? 0) > 0) {
      priorPlayers.add(row.player_id);
    }
  }

  const filtered = args.scoreRows
    .map((row) => {
      const totals = currentTotals.get(row.player_id);
      const components = asRecord(row.components);
      return {
        player_id: row.player_id,
        player_name: totals?.player_name ?? null,
        position_code: totals?.position_code ?? null,
        position_group: row.position_group,
        season_id: row.season_id,
        snapshot_date: row.snapshot_date,
        window_code: row.window_code,
        games_played: totals?.games_played ?? 0,
        rookie_status: totals != null && !priorPlayers.has(row.player_id),
        s_raw: row.s_raw,
        s_100: row.s_100,
        model_version: components.modelVersion ?? null,
        config_hash: components.configHash ?? null,
        ...(args.options.includeComponents ? { components } : {})
      };
    })
    .filter((row) => row.games_played >= args.options.minGames)
    .filter((row) => !args.options.rookieOnly || row.rookie_status)
    .sort((left, right) => right.s_100 - left.s_100 || left.player_id - right.player_id);
  const start = (args.options.page - 1) * args.options.pageSize;

  return {
    snapshot_date: args.snapshotDate,
    season_id: args.seasonId,
    window_code: args.options.windowCode,
    filters: {
      min_games: args.options.minGames,
      min_score: args.options.minScore,
      rookie_only: args.options.rookieOnly
    },
    pagination: {
      page: args.options.page,
      page_size: args.options.pageSize,
      total: filtered.length,
      total_pages: Math.ceil(filtered.length / args.options.pageSize)
    },
    rows: filtered.slice(start, start + args.options.pageSize)
  };
}

export async function getSustainabilityLeaderboardPayload(args: {
  client: SustainabilityClient;
  options: SustainabilityLeaderboardOptions;
}) {
  const latestResult = await args.client
    .from("sustainability_scores")
    .select("snapshot_date, season_id")
    .eq("window_code", args.options.windowCode)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestResult.error) throw latestResult.error;
  if (!latestResult.data) return null;

  const snapshotDate = latestResult.data.snapshot_date;
  const seasonId = latestResult.data.season_id;
  const seasonIds = getPriorSeasonIds(seasonId);
  const [scoreRows, playerTotalRows] = await Promise.all([
    fetchAllSupabasePages<ScoreRow>(({ from, to }) =>
      args.client
        .from("sustainability_scores")
        .select(
          "player_id, season_id, snapshot_date, position_group, window_code, s_raw, s_100, components, computed_at"
        )
        .eq("snapshot_date", snapshotDate)
        .eq("window_code", args.options.windowCode)
        .gte("s_100", args.options.minScore)
        .order("s_100", { ascending: false })
        .order("player_id", { ascending: true })
        .range(from, to)
    ),
    fetchAllSupabasePages<PlayerTotalRow>(({ from, to }) =>
      args.client
        .from("player_totals_unified")
        .select("player_id, player_name, position_code, season_id, games_played")
        .in("season_id", seasonIds)
        .order("season_id", { ascending: false })
        .order("player_id", { ascending: true })
        .range(from, to)
    )
  ]);

  return shapeSustainabilityLeaderboardPayload({
    snapshotDate,
    seasonId,
    scoreRows,
    playerTotalRows,
    options: args.options
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
