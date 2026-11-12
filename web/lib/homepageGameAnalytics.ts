import type { SupabaseClient } from "@supabase/supabase-js";

import type { PublicGamePrediction } from "lib/game-predictions/publicPredictions";
import { fetchPublicGamePredictions } from "lib/game-predictions/publicPredictions";
import type { Database } from "lib/supabase/database-generated.types";
import {
  fetchActiveXgModel,
  type XgActiveModelPin,
} from "lib/xg/modelRegistry";
import {
  coherentProbabilityPair,
  displayedWinPair,
} from "components/HomePage/homepageWinPair";

export {
  displayedWinPair,
  type HomepageDisplayedWinPair,
} from "components/HomePage/homepageWinPair";

export type HomepageGameStarter = {
  name: string;
  confirmed: boolean;
  source: string | null;
};

export type HomepageGameAnalytics = {
  gameId: number;
  awayWinProbability?: number;
  homeWinProbability?: number;
  /** Displayed whole percentages: one side rounded, the other its complement. */
  awayWinPercent?: number;
  homeWinPercent?: number;
  /** Follows the displayed pair (decision 43); a displayed 50/50 is a tie. */
  predictionPick?: "home" | "away" | "tie";
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

  const displayed = displayedWinPair(
    prediction.awayWinProbability,
    prediction.homeWinProbability,
  );
  const market = coherentProbabilityPair(
    prediction.market?.awayNoVigProbability,
    prediction.market?.homeNoVigProbability,
  );
  // Model vs market, in percentage points, for the side the model rates
  // above the market. Only a coherent model pair and a coherent de-vigged
  // market pair produce an edge.
  const homeEdge =
    displayed && market
      ? Number(
          (
            (Number(prediction.homeWinProbability) - market.home) *
            100
          ).toFixed(3),
        )
      : undefined;
  const selectedEdge =
    homeEdge == null
      ? null
      : homeEdge >= 0
        ? { abbreviation: prediction.homeTeam.abbreviation, value: homeEdge }
        : {
            abbreviation: prediction.awayTeam.abbreviation,
            value: Number((-homeEdge).toFixed(3)),
          };
  const pickedTeam =
    displayed?.pick === "home"
      ? prediction.homeTeam
      : displayed?.pick === "away"
        ? prediction.awayTeam
        : null;

  return {
    ...modelContext,
    predictionFreshness: "fresh",
    ...(displayed
      ? {
          awayWinProbability: Number(prediction.awayWinProbability),
          homeWinProbability: Number(prediction.homeWinProbability),
          awayWinPercent: displayed.awayPercent,
          homeWinPercent: displayed.homePercent,
          predictionPick: displayed.pick,
        }
      : {}),
    // The stored winner id came from the retired 0.52 rule; the pick now
    // follows the displayed pair only.
    predictedWinnerTeamId:
      typeof pickedTeam?.id === "number" ? pickedTeam.id : undefined,
    favoredTeamAbbreviation: pickedTeam?.abbreviation,
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

type GameSide = "home" | "away";

const sideOfTeam = (game: ScheduleGame, teamId: number): GameSide | null =>
  teamId === game.homeTeam?.id
    ? "home"
    : teamId === game.awayTeam?.id
      ? "away"
      : null;

/**
 * A stored side can describe a game only if it was written after the game
 * started. With no known start time the check cannot run and is skipped; the
 * presentation's live-freshness check still applies.
 */
const writtenAfterStart = (updatedAt: string, game: ScheduleGame): boolean => {
  const startMs = Date.parse(game.startTimeUTC ?? "");
  if (!Number.isFinite(startMs)) return true;
  const updatedMs = Date.parse(updatedAt);
  return Number.isFinite(updatedMs) && updatedMs >= startMs;
};

type SideValue = { value: number; updatedAt: string };

/**
 * Collects one value per side. A side seen twice with different values is a
 * conflict and becomes unknown, so the result never depends on row order.
 */
function collectSides(
  entries: Array<{ side: GameSide; value: number | undefined; updatedAt: string }>,
): Partial<Record<GameSide, SideValue | null>> {
  const sides: Partial<Record<GameSide, SideValue | null>> = {};
  for (const entry of entries) {
    const next =
      entry.value == null ? null : { value: entry.value, updatedAt: entry.updatedAt };
    if (!(entry.side in sides)) {
      sides[entry.side] = next;
      continue;
    }
    const current = sides[entry.side];
    if (!current || !next || current.value !== next.value) {
      sides[entry.side] = null;
    } else if (next.updatedAt < current.updatedAt) {
      sides[entry.side] = next;
    }
  }
  return sides;
}

/** Both sides or nothing; the pair is dated by its older side (rule 23). */
function completePair(
  sides: Partial<Record<GameSide, SideValue | null>>,
): { home: number; away: number; updatedAt: string } | null {
  const home = sides.home;
  const away = sides.away;
  if (!home || !away) return null;
  return {
    home: home.value,
    away: away.value,
    updatedAt: home.updatedAt < away.updatedAt ? home.updatedAt : away.updatedAt,
  };
}

/**
 * Joins stored in-house xG and strength-split SOG to the slate (W3-2 A1,
 * W3-3 D5). Per side: SOG needs every strength bucket (ES, PP and PK; an
 * unknown bucket makes the side unknown, never a partial sum), xG needs the
 * selector's model version AND feature version from an approved model, and
 * each row must post-date the game start. A pair is served only when both
 * sides pass, and it carries the older side's timestamp.
 */
export function mergePersistedGameMetrics(args: {
  games: ScheduleGame[];
  analyticsByGameId: Map<number, HomepageGameAnalytics>;
  /** The L14 selector's pin; null means in-house xG is unavailable (decision 99). */
  xgModel: XgActiveModelPin | null;
  xgRows: XgAggregateRow[];
  strengthRows: StrengthRow[];
}): void {
  for (const game of args.games) {
    if (typeof game.id !== "number") continue;
    const gameId = game.id;

    const xgPair = args.xgModel
      ? completePair(
          collectSides(
            args.xgRows.flatMap((row) => {
              const side =
                row.game_id === gameId ? sideOfTeam(game, row.team_id) : null;
              if (!side) return [];
              const admitted =
                row.model_version === args.xgModel!.modelVersion &&
                Number(row.feature_version) === args.xgModel!.featureVersion &&
                row.source_model_approved === true &&
                (row.source_prediction_type == null ||
                  row.source_prediction_type === args.xgModel!.predictionType) &&
                writtenAfterStart(row.updated_at, game);
              return [
                {
                  side,
                  value: admitted ? finiteNumber(row.xg_for) : undefined,
                  updatedAt: row.updated_at,
                },
              ];
            }),
          ),
        )
      : null;

    const sogPair = completePair(
      collectSides(
        args.strengthRows.flatMap((row) => {
          const side =
            row.game_id === gameId ? sideOfTeam(game, row.team_id) : null;
          if (!side) return [];
          const buckets = [row.shots_es, row.shots_pp, row.shots_pk].map(
            finiteNumber,
          );
          const complete =
            buckets.every((value) => value != null && value >= 0) &&
            writtenAfterStart(row.updated_at, game);
          return [
            {
              side,
              value: complete
                ? (buckets as number[]).reduce((total, value) => total + value, 0)
                : undefined,
              updatedAt: row.updated_at,
            },
          ];
        }),
      ),
    );

    if (!xgPair && !sogPair) continue;
    const analytics = args.analyticsByGameId.get(gameId) ?? { gameId };
    if (xgPair) {
      analytics.homeXg = xgPair.home;
      analytics.awayXg = xgPair.away;
      analytics.xgUpdatedAt = xgPair.updatedAt;
    }
    if (sogPair) {
      analytics.homeShotsOnGoal = sogPair.home;
      analytics.awayShotsOnGoal = sogPair.away;
      analytics.shotsUpdatedAt = sogPair.updatedAt;
    }
    args.analyticsByGameId.set(gameId, analytics);
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

  let xgModel: XgActiveModelPin | null = null;
  let xgRows: XgAggregateRow[] = [];
  try {
    // L14 selector: the single active approved model, pinned on model_version
    // AND feature_version. Null = in-house xG unavailable (decision 99).
    const selection = await fetchActiveXgModel({
      supabase: args.supabase,
      predictionType: "shot_goal",
    });
    if (selection.model) {
      const { data, error } = await args.supabase
        .from("nhl_xg_team_game_aggregates")
        .select(
          "game_id,team_id,is_home,xg_for,updated_at,model_version,feature_version,source_model_approved,source_prediction_type",
        )
        .in("game_id", gameIds)
        .eq("model_version", selection.model.modelVersion)
        .eq("feature_version", selection.model.featureVersion)
        .eq("source_model_approved", true)
        .eq("source_prediction_type", selection.model.predictionType);
      if (error) throw error;
      xgModel = selection.model;
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
    xgModel,
    xgRows,
    strengthRows,
  });

  return attachHomepageGameAnalytics(args.games, analyticsByGameId);
}
