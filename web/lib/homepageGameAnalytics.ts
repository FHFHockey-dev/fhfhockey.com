import type { SupabaseClient } from "@supabase/supabase-js";

import type { PublicGamePrediction } from "lib/game-predictions/publicPredictions";
import { fetchPublicGamePredictions } from "lib/game-predictions/publicPredictions";
import type { Database } from "lib/supabase/database-generated.types";

export type HomepageGameStarter = {
  name: string;
  confirmed: boolean;
  source: string | null;
};

export type HomepageGameAnalytics = {
  gameId: number;
  awayWinProbability?: number;
  homeWinProbability?: number;
  predictedWinnerTeamId?: number;
  favoredTeamAbbreviation?: string;
  edgeTeamAbbreviation?: string;
  edgePercentagePoints?: number;
  awayProjectedGoals?: number;
  homeProjectedGoals?: number;
  awayXg?: number;
  homeXg?: number;
  awayShotsOnGoal?: number;
  homeShotsOnGoal?: number;
  awayStarter?: HomepageGameStarter;
  homeStarter?: HomepageGameStarter;
  predictionComputedAt?: string;
  predictionModelName?: string;
  predictionModelVersion?: string;
  predictionFeatureSetVersion?: string;
  predictionFreshness?: "fresh" | "stale";
  projectedGoalsComputedAt?: string;
  projectedGoalsModelName?: string;
  projectedGoalsModelVersion?: string;
  projectedGoalsFreshness?: "fresh" | "stale";
  xgUpdatedAt?: string;
  shotsUpdatedAt?: string;
};

type ScheduleGame = {
  id?: number;
  startTimeUTC?: string;
  awayTeam?: { id?: number };
  homeTeam?: { id?: number };
  analytics?: HomepageGameAnalytics;
};

type XgAggregateRow =
  Database["public"]["Tables"]["nhl_xg_team_game_aggregates"]["Row"];
type StrengthRow =
  Database["public"]["Tables"]["forge_team_game_strength"]["Row"];
type ForgeScoreOutputRow = Pick<
  Database["public"]["Tables"]["game_prediction_outputs"]["Row"],
  | "game_id"
  | "home_expected_goals"
  | "away_expected_goals"
  | "computed_at"
  | "model_name"
  | "model_version"
>;

const FORGE_SCORE_MODEL_NAME = "forge";
const FORGE_SCORE_MODEL_VERSION = "market-context-v1";
const MAX_PREGAME_SCORE_AGE_MS = 48 * 60 * 60 * 1000;

const finiteNumber = (value: unknown): number | undefined => {
  if (value == null || value === "" || typeof value === "boolean") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const starterFromPrediction = (
  name: string | null | undefined,
  confirmed: boolean | undefined,
  source: string | null | undefined,
): HomepageGameStarter | undefined =>
  name
    ? {
        name,
        confirmed: confirmed === true,
        source: source ?? null,
      }
    : undefined;

export function analyticsFromPrediction(
  prediction: PublicGamePrediction,
): HomepageGameAnalytics {
  const modelContext = {
    gameId: prediction.gameId,
    predictionComputedAt: prediction.computedAt,
    predictionModelName: prediction.modelName,
    predictionModelVersion: prediction.modelVersion,
    ...(prediction.featureSetVersion
      ? { predictionFeatureSetVersion: prediction.featureSetVersion }
      : {}),
  };

  if (prediction.freshness.hasStaleSource) {
    return {
      ...modelContext,
      predictionFreshness: "stale",
    };
  }

  const homeProbability = finiteNumber(prediction.homeWinProbability);
  const awayProbability = finiteNumber(prediction.awayWinProbability);
  const homeFavored =
    homeProbability != null &&
    (awayProbability == null || homeProbability >= awayProbability);
  const homeMarketProbability = finiteNumber(
    prediction.market?.homeNoVigProbability,
  );
  const awayMarketProbability = finiteNumber(
    prediction.market?.awayNoVigProbability,
  );
  const homeEdge =
    homeProbability != null && homeMarketProbability != null
      ? Number(((homeProbability - homeMarketProbability) * 100).toFixed(3))
      : undefined;
  const awayEdge =
    awayProbability != null && awayMarketProbability != null
      ? Number(((awayProbability - awayMarketProbability) * 100).toFixed(3))
      : undefined;
  const selectedEdge =
    homeEdge == null
      ? awayEdge == null
        ? null
        : { abbreviation: prediction.awayTeam.abbreviation, value: awayEdge }
      : awayEdge == null || homeEdge >= awayEdge
        ? { abbreviation: prediction.homeTeam.abbreviation, value: homeEdge }
        : { abbreviation: prediction.awayTeam.abbreviation, value: awayEdge };

  return {
    ...modelContext,
    predictionFreshness: "fresh",
    awayWinProbability: awayProbability,
    homeWinProbability: homeProbability,
    predictedWinnerTeamId: prediction.predictedWinnerTeamId ?? undefined,
    favoredTeamAbbreviation:
      homeProbability == null && awayProbability == null
        ? undefined
        : homeFavored
          ? prediction.homeTeam.abbreviation
          : prediction.awayTeam.abbreviation,
    edgeTeamAbbreviation: selectedEdge?.abbreviation,
    edgePercentagePoints: selectedEdge?.value,
    awayProjectedGoals:
      finiteNumber(prediction.matchup?.awayProjectedGoals) ?? undefined,
    homeProjectedGoals:
      finiteNumber(prediction.matchup?.homeProjectedGoals) ?? undefined,
    projectedGoalsComputedAt:
      prediction.matchup?.awayProjectedGoals != null ||
      prediction.matchup?.homeProjectedGoals != null
        ? prediction.computedAt
        : undefined,
    projectedGoalsModelName:
      prediction.matchup?.awayProjectedGoals != null ||
      prediction.matchup?.homeProjectedGoals != null
        ? FORGE_SCORE_MODEL_NAME
        : undefined,
    projectedGoalsModelVersion:
      prediction.matchup?.awayProjectedGoals != null ||
      prediction.matchup?.homeProjectedGoals != null
        ? FORGE_SCORE_MODEL_VERSION
        : undefined,
    projectedGoalsFreshness:
      prediction.matchup?.awayProjectedGoals != null ||
      prediction.matchup?.homeProjectedGoals != null
        ? "fresh"
        : undefined,
    awayStarter: starterFromPrediction(
      prediction.matchup?.awayGoalieName,
      prediction.matchup?.awayGoalieConfirmed,
      prediction.matchup?.awayGoalieSource,
    ),
    homeStarter: starterFromPrediction(
      prediction.matchup?.homeGoalieName,
      prediction.matchup?.homeGoalieConfirmed,
      prediction.matchup?.homeGoalieSource,
    ),
  };
}

function isFreshPregameScore(
  row: ForgeScoreOutputRow,
  game: ScheduleGame,
): boolean {
  const computedAt = Date.parse(row.computed_at);
  const startTime = Date.parse(game.startTimeUTC ?? "");
  if (!Number.isFinite(computedAt) || !Number.isFinite(startTime)) return false;
  const leadTime = startTime - computedAt;
  return leadTime >= -60_000 && leadTime <= MAX_PREGAME_SCORE_AGE_MS;
}

export function mergeForgeProjectedScores(args: {
  games: ScheduleGame[];
  analyticsByGameId: Map<number, HomepageGameAnalytics>;
  rows: ForgeScoreOutputRow[];
}): void {
  const gamesById = new Map(
    args.games.flatMap((game) =>
      typeof game.id === "number" ? [[game.id, game] as const] : [],
    ),
  );
  const latestRows = new Map<number, ForgeScoreOutputRow>();

  for (const row of args.rows) {
    const current = latestRows.get(row.game_id);
    if (!current || row.computed_at > current.computed_at) {
      latestRows.set(row.game_id, row);
    }
  }

  for (const [gameId, row] of latestRows) {
    const game = gamesById.get(gameId);
    if (!game) continue;
    const analytics = args.analyticsByGameId.get(gameId) ?? { gameId };
    const fresh = isFreshPregameScore(row, game);

    analytics.projectedGoalsComputedAt = row.computed_at;
    analytics.projectedGoalsModelName = row.model_name;
    analytics.projectedGoalsModelVersion = row.model_version;
    analytics.projectedGoalsFreshness = fresh ? "fresh" : "stale";

    if (
      fresh &&
      analytics.awayProjectedGoals == null &&
      analytics.homeProjectedGoals == null
    ) {
      analytics.awayProjectedGoals =
        finiteNumber(row.away_expected_goals) ?? undefined;
      analytics.homeProjectedGoals =
        finiteNumber(row.home_expected_goals) ?? undefined;
    }
    args.analyticsByGameId.set(gameId, analytics);
  }
}

export function mergePersistedGameMetrics(args: {
  games: ScheduleGame[];
  analyticsByGameId: Map<number, HomepageGameAnalytics>;
  xgRows: XgAggregateRow[];
  strengthRows: StrengthRow[];
}): void {
  const gamesById = new Map(
    args.games.flatMap((game) =>
      typeof game.id === "number" ? [[game.id, game] as const] : [],
    ),
  );

  for (const row of args.xgRows) {
    const game = gamesById.get(row.game_id);
    if (!game) continue;
    const analytics = args.analyticsByGameId.get(row.game_id) ?? {
      gameId: row.game_id,
    };
    if (row.team_id === game.homeTeam?.id || row.is_home === true) {
      analytics.homeXg = finiteNumber(row.xg_for);
    } else if (row.team_id === game.awayTeam?.id || row.is_home === false) {
      analytics.awayXg = finiteNumber(row.xg_for);
    }
    analytics.xgUpdatedAt =
      !analytics.xgUpdatedAt ||
      row.updated_at > analytics.xgUpdatedAt
        ? row.updated_at
        : analytics.xgUpdatedAt;
    args.analyticsByGameId.set(row.game_id, analytics);
  }

  for (const row of args.strengthRows) {
    const game = gamesById.get(row.game_id);
    if (!game) continue;
    const shots = [row.shots_es, row.shots_pp, row.shots_pk]
      .map(finiteNumber)
      .filter((value): value is number => value != null)
      .reduce((total, value) => total + value, 0);
    if (
      row.shots_es == null &&
      row.shots_pp == null &&
      row.shots_pk == null
    ) {
      continue;
    }

    const analytics = args.analyticsByGameId.get(row.game_id) ?? {
      gameId: row.game_id,
    };
    if (row.team_id === game.homeTeam?.id) {
      analytics.homeShotsOnGoal = shots;
    } else if (row.team_id === game.awayTeam?.id) {
      analytics.awayShotsOnGoal = shots;
    }
    analytics.shotsUpdatedAt =
      !analytics.shotsUpdatedAt ||
      row.updated_at > analytics.shotsUpdatedAt
        ? row.updated_at
        : analytics.shotsUpdatedAt;
    args.analyticsByGameId.set(row.game_id, analytics);
  }
}

export function attachHomepageGameAnalytics<T extends ScheduleGame>(
  games: T[],
  analyticsByGameId: Map<number, HomepageGameAnalytics>,
): T[] {
  return games.map((game) => {
    const analytics =
      typeof game.id === "number" ? analyticsByGameId.get(game.id) : undefined;
    return analytics ? { ...game, analytics } : game;
  });
}

export async function enrichHomepageGames<T extends ScheduleGame>(args: {
  supabase: SupabaseClient<Database>;
  games: T[];
  date: string;
}): Promise<T[]> {
  const gameIds = args.games.flatMap((game) =>
    typeof game.id === "number" ? [game.id] : [],
  );
  if (gameIds.length === 0) return args.games;

  const analyticsByGameId = new Map<number, HomepageGameAnalytics>();

  try {
    const predictionPayload = await fetchPublicGamePredictions({
      client: args.supabase,
      fromDate: args.date,
      toDate: args.date,
      limit: Math.min(100, Math.max(16, gameIds.length * 4)),
    });
    for (const prediction of predictionPayload.predictions) {
      if (!gameIds.includes(prediction.gameId)) continue;
      analyticsByGameId.set(
        prediction.gameId,
        analyticsFromPrediction(prediction),
      );
    }
  } catch (error) {
    console.warn("Homepage prediction enrichment unavailable", error);
  }

  try {
    const { data, error } = await args.supabase
      .from("game_prediction_outputs")
      .select(
        "game_id,home_expected_goals,away_expected_goals,computed_at,model_name,model_version",
      )
      .in("game_id", gameIds)
      .eq("prediction_scope", "pregame")
      .eq("model_name", FORGE_SCORE_MODEL_NAME)
      .eq("model_version", FORGE_SCORE_MODEL_VERSION)
      .order("computed_at", { ascending: false });
    if (error) throw error;
    mergeForgeProjectedScores({
      games: args.games,
      analyticsByGameId,
      rows: (data ?? []) as ForgeScoreOutputRow[],
    });
  } catch (error) {
    console.warn("Homepage projected-score enrichment unavailable", error);
  }

  let xgRows: XgAggregateRow[] = [];
  try {
    const { data: registryRows, error: registryError } = await args.supabase
      .from("nhl_xg_model_registry")
      .select("model_version,feature_version,is_active,is_champion,updated_at")
      .eq("prediction_type", "shot_goal")
      .eq("model_approved", true)
      .or("is_active.eq.true,is_champion.eq.true")
      .order("is_active", { ascending: false })
      .order("is_champion", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1);
    if (registryError) throw registryError;

    const activeModel = registryRows?.[0];
    if (activeModel) {
      const { data, error } = await args.supabase
        .from("nhl_xg_team_game_aggregates")
        .select(
          "game_id,team_id,is_home,xg_for,updated_at,model_version,feature_version",
        )
        .in("game_id", gameIds)
        .eq("model_version", activeModel.model_version)
        .eq("feature_version", activeModel.feature_version)
        .eq("source_model_approved", true);
      if (error) throw error;
      xgRows = (data ?? []) as XgAggregateRow[];
    }
  } catch (error) {
    console.warn("Homepage xG enrichment unavailable", error);
  }

  let strengthRows: StrengthRow[] = [];
  try {
    const { data, error } = await args.supabase
      .from("forge_team_game_strength")
      .select(
        "game_id,team_id,shots_es,shots_pp,shots_pk,updated_at,game_date",
      )
      .in("game_id", gameIds);
    if (error) throw error;
    strengthRows = (data ?? []) as StrengthRow[];
  } catch (error) {
    console.warn("Homepage SOG enrichment unavailable", error);
  }

  mergePersistedGameMetrics({
    games: args.games,
    analyticsByGameId,
    xgRows,
    strengthRows,
  });

  return attachHomepageGameAnalytics(args.games, analyticsByGameId);
}
