import { createClient } from "@supabase/supabase-js";
import { Database } from "lib/supabase/database-generated.types";

// Types for player statistics - Updated to match actual database schema
export interface PlayerGameLogStats {
  player_id: number;
  season: number;
  date_scraped: string;
  gp: number | null;
  toi: number | null;
  goals: number | null;
  total_assists: number | null;
  total_points: number | null;
  shots: number | null;
  hits: number | null;
  shots_blocked: number | null;
  pim: number | null;
  pp_goals?: number | null;
  pp_assists?: number | null;
  pp_points?: number | null;
  sh_goals?: number | null;
  sh_assists?: number | null;
  sh_points?: number | null;
  plus_minus?: number | null;
}

export interface PlayerSeasonStats {
  player_id: number;
  player_name: string | null;
  season: string;
  position_code: string | null;
  games_played: number | null;
  goals: number | null;
  assists: number | null;
  points: number | null;
  shots: number | null;
  hits: number | null;
  blocked_shots: number | null;
  penalty_minutes: number | null;
  plus_minus: number | null;
  pp_goals: number | null;
  pp_assists: number | null;
  pp_points: number | null;
  sh_goals: number | null;
  sh_assists: number | null;
  sh_points: number | null;
  toi_per_game: number | null;
  pp_toi_per_game: number | null;
  sh_toi_per_game: number | null;
}

export interface GoalieStats {
  goalie_id: number;
  goalie_name: string | null;
  season_id: number;
  games_played: number | null;
  games_started: number | null;
  wins: number | null;
  losses: number | null;
  ot_losses: number | null;
  save_pct: number | null;
  saves: number | null;
  goals_against: number | null;
  goals_against_avg: number | null;
  shots_against: number | null;
  shutouts: number | null;
}

export interface TeamStats {
  team_id?: number | null;
  franchise_name: string;
  season_id: number | null;
  games_played: number | null;
  wins: number | null;
  losses: number | null;
  ot_losses: number | null;
  goals_for: number | null;
  goals_against: number | null;
  goal_differential?: number | null;
  shots_for?: number | null;
  shots_against?: number | null;
  save_percentage?: number | null;
}

// Types for xFS predictions and audit data
export interface XFSPrediction {
  id: number;
  player_id: number;
  player_name: string | null;
  prediction_date: string;
  game_date: string;
  xfs_score: number;
  min_xfs: number;
  max_xfs: number;
  confidence_interval: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface XFSAuditLog {
  id: number;
  player_id: number;
  player_name: string | null;
  prediction_date: string;
  game_date: string;
  predicted_xfs: number;
  actual_fantasy_score: number | null;
  accuracy_score: number | null;
  prediction_horizon: number;
  created_at: string | null;
}

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Retrieves game log statistics for a specific player
 * @param playerId - The player's ID
 * @param season - The season (optional, defaults to current season)
 * @param startDate - Start date filter (optional)
 * @param endDate - End date filter (optional)
 * @returns Promise with player game log data
 */
export async function getPlayerGameLogStats(
  playerId: number,
  season?: number,
  startDate?: string,
  endDate?: string
): Promise<PlayerGameLogStats[]> {
  let query = supabase
    .from("nst_gamelog_as_counts")
    .select(
      `
      player_id,
      season,
      date_scraped,
      gp,
      toi,
      goals,
      total_assists,
      total_points,
      shots,
      hits,
      shots_blocked,
      pim
    `
    )
    .eq("player_id", playerId)
    .order("date_scraped", { ascending: false });

  if (season) {
    query = query.eq("season", season);
  }

  if (startDate) {
    query = query.gte("date_scraped", startDate);
  }

  if (endDate) {
    query = query.lte("date_scraped", endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error fetching player game log stats: ${error.message}`);
  }

  return (
    data?.map((item) => ({
      player_id: item.player_id,
      season: item.season,
      date_scraped: item.date_scraped,
      gp: item.gp,
      toi: item.toi,
      goals: item.goals,
      total_assists: item.total_assists,
      total_points: item.total_points,
      shots: item.shots,
      hits: item.hits,
      shots_blocked: item.shots_blocked,
      pim: item.pim
    })) || []
  );
}

/**
 * Retrieves season totals for a specific player
 * @param playerId - The player's ID
 * @param season - The season (optional)
 * @returns Promise with player season stats
 */
export async function getPlayerSeasonStats(
  playerId: number,
  season?: string
): Promise<PlayerSeasonStats[]> {
  let query = supabase
    .from("wgo_skater_stats_totals")
    .select(
      `
      player_id,
      player_name,
      season,
      position_code,
      games_played,
      goals,
      assists,
      points,
      shots,
      hits,
      blocked_shots,
      penalty_minutes,
      plus_minus,
      pp_goals,
      pp_assists,
      pp_points,
      sh_goals,
      sh_assists,
      sh_points,
      toi_per_game,
      pp_toi_per_game,
      sh_toi_per_game
    `
    )
    .eq("player_id", playerId)
    .order("season", { ascending: false });

  if (season) {
    query = query.eq("season", season);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error fetching player season stats: ${error.message}`);
  }

  return data || [];
}

/**
 * Retrieves multiple players' season stats for comparison
 * @param playerIds - Array of player IDs
 * @param season - The season (optional)
 * @param position - Position filter (optional)
 * @returns Promise with multiple players' season stats
 */
export async function getMultiplePlayersSeasonStats(
  playerIds: number[],
  season?: string,
  position?: string
): Promise<PlayerSeasonStats[]> {
  let query = supabase
    .from("wgo_skater_stats_totals")
    .select(
      `
      player_id,
      player_name,
      season,
      position_code,
      games_played,
      goals,
      assists,
      points,
      shots,
      hits,
      blocked_shots,
      penalty_minutes,
      plus_minus,
      pp_goals,
      pp_assists,
      pp_points,
      sh_goals,
      sh_assists,
      sh_points,
      toi_per_game,
      pp_toi_per_game,
      sh_toi_per_game
    `
    )
    .in("player_id", playerIds)
    .order("player_name", { ascending: true });

  if (season) {
    query = query.eq("season", season);
  }

  if (position) {
    query = query.eq("position_code", position);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Error fetching multiple players season stats: ${error.message}`
    );
  }

  return data || [];
}

/**
 * Retrieves goalie statistics
 * @param goalieId - The goalie's ID
 * @param season - The season (optional)
 * @returns Promise with goalie stats
 */
export async function getGoalieStats(
  goalieId: number,
  season?: number
): Promise<GoalieStats[]> {
  let query = supabase
    .from("wgo_goalie_stats_totals")
    .select(
      `
      goalie_id,
      goalie_name,
      season_id,
      games_played,
      games_started,
      wins,
      losses,
      ot_losses,
      save_pct,
      saves,
      goals_against,
      goals_against_avg,
      shots_against,
      shutouts
    `
    )
    .eq("goalie_id", goalieId)
    .order("season_id", { ascending: false });

  if (season) {
    query = query.eq("season_id", season);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error fetching goalie stats: ${error.message}`);
  }

  return data || [];
}

/**
 * Retrieves team statistics for opponent strength calculations
 * @param teamAbbreviation - Team abbreviation (optional)
 * @param season - The season (optional)
 * @returns Promise with team stats
 */
export async function getTeamStats(
  teamAbbreviation?: string,
  season?: number
): Promise<TeamStats[]> {
  let query = supabase
    .from("wgo_team_stats")
    .select(
      `
      team_id,
      franchise_name,
      season_id,
      games_played,
      wins,
      losses,
      ot_losses,
      goals_for,
      goals_against
    `
    )
    .order("season_id", { ascending: false });

  if (teamAbbreviation) {
    query = query.eq("franchise_name", teamAbbreviation);
  }

  if (season) {
    query = query.eq("season_id", season);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error fetching team stats: ${error.message}`);
  }

  return (
    data?.map((team) => ({
      team_id: team.team_id,
      franchise_name: team.franchise_name,
      season_id: team.season_id,
      games_played: team.games_played,
      wins: team.wins,
      losses: team.losses,
      ot_losses: team.ot_losses,
      goals_for: team.goals_for,
      goals_against: team.goals_against,
      goal_differential:
        team.goals_for && team.goals_against
          ? team.goals_for - team.goals_against
          : null
    })) || []
  );
}

/**
 * Retrieves players by position for positional analysis
 * @param position - Position code (C, LW, RW, D, G)
 * @param season - The season (optional)
 * @param minGamesPlayed - Minimum games played filter (optional)
 * @returns Promise with players matching position criteria
 */
export async function getPlayersByPosition(
  position: string,
  season?: string,
  minGamesPlayed?: number
): Promise<PlayerSeasonStats[]> {
  let query = supabase
    .from("wgo_skater_stats_totals")
    .select(
      `
      player_id,
      player_name,
      season,
      position_code,
      games_played,
      goals,
      assists,
      points,
      shots,
      hits,
      blocked_shots,
      penalty_minutes,
      plus_minus,
      pp_goals,
      pp_assists,
      pp_points,
      sh_goals,
      sh_assists,
      sh_points,
      toi_per_game,
      pp_toi_per_game,
      sh_toi_per_game
    `
    )
    .eq("position_code", position)
    .order("points", { ascending: false });

  if (season) {
    query = query.eq("season", season);
  }

  if (minGamesPlayed) {
    query = query.gte("games_played", minGamesPlayed);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error fetching players by position: ${error.message}`);
  }

  return data || [];
}

/**
 * Retrieves all players for a given season with basic stats
 * @param season - The season
 * @param limit - Maximum number of players to return (optional)
 * @param offset - Number of players to skip (optional)
 * @returns Promise with players data
 */
export async function getAllPlayersForSeason(
  season: string,
  limit?: number,
  offset?: number
): Promise<PlayerSeasonStats[]> {
  let query = supabase
    .from("wgo_skater_stats_totals")
    .select(
      `
      player_id,
      player_name,
      season,
      position_code,
      games_played,
      goals,
      assists,
      points,
      shots,
      hits,
      blocked_shots,
      penalty_minutes,
      plus_minus,
      pp_goals,
      pp_assists,
      pp_points,
      sh_goals,
      sh_assists,
      sh_points,
      toi_per_game,
      pp_toi_per_game,
      sh_toi_per_game
    `
    )
    .eq("season", season)
    .order("points", { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  if (offset) {
    query = query.range(offset, offset + (limit || 100) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error fetching all players for season: ${error.message}`);
  }

  return data || [];
}

// xFS Prediction Functions

/**
 * Retrieves 5-game xFS predictions for a specific player
 * @param playerId - The player's ID
 * @param startDate - Start date filter (optional)
 * @param endDate - End date filter (optional)
 * @param limit - Maximum number of predictions to return (optional)
 * @returns Promise with 5-game xFS predictions
 */
export async function getXFS5GamePredictions(
  playerId: number,
  startDate?: string,
  endDate?: string,
  limit?: number
): Promise<XFSPrediction[]> {
  let query = supabase
    .from("xfs_predictions_5_game")
    .select(
      `
      id,
      player_id,
      player_name,
      prediction_date,
      game_date,
      xfs_score,
      min_xfs,
      max_xfs,
      confidence_interval,
      created_at,
      updated_at
    `
    )
    .eq("player_id", playerId)
    .order("prediction_date", { ascending: false });

  if (startDate) {
    query = query.gte("prediction_date", startDate);
  }

  if (endDate) {
    query = query.lte("prediction_date", endDate);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error fetching 5-game xFS predictions: ${error.message}`);
  }

  return data || [];
}

/**
 * Retrieves 10-game xFS predictions for a specific player
 * @param playerId - The player's ID
 * @param startDate - Start date filter (optional)
 * @param endDate - End date filter (optional)
 * @param limit - Maximum number of predictions to return (optional)
 * @returns Promise with 10-game xFS predictions
 */
export async function getXFS10GamePredictions(
  playerId: number,
  startDate?: string,
  endDate?: string,
  limit?: number
): Promise<XFSPrediction[]> {
  let query = supabase
    .from("xfs_predictions_10_game")
    .select(
      `
      id,
      player_id,
      player_name,
      prediction_date,
      game_date,
      xfs_score,
      min_xfs,
      max_xfs,
      confidence_interval,
      created_at,
      updated_at
    `
    )
    .eq("player_id", playerId)
    .order("prediction_date", { ascending: false });

  if (startDate) {
    query = query.gte("prediction_date", startDate);
  }

  if (endDate) {
    query = query.lte("prediction_date", endDate);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error fetching 10-game xFS predictions: ${error.message}`);
  }

  return data || [];
}

/**
 * Retrieves latest xFS predictions for multiple players (5-game)
 * @param playerIds - Array of player IDs
 * @param gameDate - Specific game date for predictions (optional)
 * @returns Promise with latest 5-game xFS predictions for multiple players
 */
export async function getLatestXFS5GamePredictionsForPlayers(
  playerIds: number[],
  gameDate?: string
): Promise<XFSPrediction[]> {
  let query = supabase
    .from("xfs_predictions_5_game")
    .select(
      `
      id,
      player_id,
      player_name,
      prediction_date,
      game_date,
      xfs_score,
      min_xfs,
      max_xfs,
      confidence_interval,
      created_at,
      updated_at
    `
    )
    .in("player_id", playerIds)
    .order("prediction_date", { ascending: false });

  if (gameDate) {
    query = query.eq("game_date", gameDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Error fetching latest 5-game xFS predictions for players: ${error.message}`
    );
  }

  // Group by player_id and get only the latest prediction for each player
  const latestPredictions = data?.reduce((acc: XFSPrediction[], prediction) => {
    const existingIndex = acc.findIndex(
      (p) => p.player_id === prediction.player_id
    );
    if (existingIndex === -1) {
      acc.push(prediction);
    } else if (
      new Date(prediction.prediction_date) >
      new Date(acc[existingIndex].prediction_date)
    ) {
      acc[existingIndex] = prediction;
    }
    return acc;
  }, []);

  return latestPredictions || [];
}

/**
 * Retrieves latest xFS predictions for multiple players (10-game)
 * @param playerIds - Array of player IDs
 * @param gameDate - Specific game date for predictions (optional)
 * @returns Promise with latest 10-game xFS predictions for multiple players
 */
export async function getLatestXFS10GamePredictionsForPlayers(
  playerIds: number[],
  gameDate?: string
): Promise<XFSPrediction[]> {
  let query = supabase
    .from("xfs_predictions_10_game")
    .select(
      `
      id,
      player_id,
      player_name,
      prediction_date,
      game_date,
      xfs_score,
      min_xfs,
      max_xfs,
      confidence_interval,
      created_at,
      updated_at
    `
    )
    .in("player_id", playerIds)
    .order("prediction_date", { ascending: false });

  if (gameDate) {
    query = query.eq("game_date", gameDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Error fetching latest 10-game xFS predictions for players: ${error.message}`
    );
  }

  // Group by player_id and get only the latest prediction for each player
  const latestPredictions = data?.reduce((acc: XFSPrediction[], prediction) => {
    const existingIndex = acc.findIndex(
      (p) => p.player_id === prediction.player_id
    );
    if (existingIndex === -1) {
      acc.push(prediction);
    } else if (
      new Date(prediction.prediction_date) >
      new Date(acc[existingIndex].prediction_date)
    ) {
      acc[existingIndex] = prediction;
    }
    return acc;
  }, []);

  return latestPredictions || [];
}

/**
 * Creates a new xFS prediction record (5-game)
 * @param prediction - The prediction data to insert
 * @returns Promise with the created prediction
 */
export async function createXFS5GamePrediction(
  prediction: Omit<XFSPrediction, "id" | "created_at" | "updated_at">
): Promise<XFSPrediction> {
  const { data, error } = await supabase
    .from("xfs_predictions_5_game")
    .insert([prediction])
    .select()
    .single();

  if (error) {
    throw new Error(`Error creating 5-game xFS prediction: ${error.message}`);
  }

  return data;
}

/**
 * Creates a new xFS prediction record (10-game)
 * @param prediction - The prediction data to insert
 * @returns Promise with the created prediction
 */
export async function createXFS10GamePrediction(
  prediction: Omit<XFSPrediction, "id" | "created_at" | "updated_at">
): Promise<XFSPrediction> {
  const { data, error } = await supabase
    .from("xfs_predictions_10_game")
    .insert([prediction])
    .select()
    .single();

  if (error) {
    throw new Error(`Error creating 10-game xFS prediction: ${error.message}`);
  }

  return data;
}

/**
 * Updates an existing xFS prediction record (5-game)
 * @param id - The prediction ID
 * @param updates - The fields to update
 * @returns Promise with the updated prediction
 */
export async function updateXFS5GamePrediction(
  id: number,
  updates: Partial<Omit<XFSPrediction, "id" | "created_at">>
): Promise<XFSPrediction> {
  const { data, error } = await supabase
    .from("xfs_predictions_5_game")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Error updating 5-game xFS prediction: ${error.message}`);
  }

  return data;
}

/**
 * Updates an existing xFS prediction record (10-game)
 * @param id - The prediction ID
 * @param updates - The fields to update
 * @returns Promise with the updated prediction
 */
export async function updateXFS10GamePrediction(
  id: number,
  updates: Partial<Omit<XFSPrediction, "id" | "created_at">>
): Promise<XFSPrediction> {
  const { data, error } = await supabase
    .from("xfs_predictions_10_game")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Error updating 10-game xFS prediction: ${error.message}`);
  }

  return data;
}

// xFS Audit Log Functions

/**
 * Retrieves audit log entries for xFS predictions
 * @param playerId - The player's ID (optional)
 * @param predictionHorizon - Prediction horizon (5 or 10 games) (optional)
 * @param startDate - Start date filter (optional)
 * @param endDate - End date filter (optional)
 * @param limit - Maximum number of entries to return (optional)
 * @returns Promise with audit log entries
 */
export async function getXFSAuditLogs(
  playerId?: number,
  predictionHorizon?: number,
  startDate?: string,
  endDate?: string,
  limit?: number
): Promise<XFSAuditLog[]> {
  let query = supabase
    .from("xfs_audit_log")
    .select(
      `
      id,
      player_id,
      player_name,
      prediction_date,
      game_date,
      predicted_xfs,
      actual_fantasy_score,
      accuracy_score,
      prediction_horizon,
      created_at
    `
    )
    .order("created_at", { ascending: false });

  if (playerId) {
    query = query.eq("player_id", playerId);
  }

  if (predictionHorizon) {
    query = query.eq("prediction_horizon", predictionHorizon);
  }

  if (startDate) {
    query = query.gte("prediction_date", startDate);
  }

  if (endDate) {
    query = query.lte("prediction_date", endDate);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error fetching xFS audit logs: ${error.message}`);
  }

  return data || [];
}

/**
 * Creates a new audit log entry for xFS predictions
 * @param auditEntry - The audit data to insert
 * @returns Promise with the created audit entry
 */
export async function createXFSAuditLog(
  auditEntry: Omit<XFSAuditLog, "id" | "created_at">
): Promise<XFSAuditLog> {
  const { data, error } = await supabase
    .from("xfs_audit_log")
    .insert([auditEntry])
    .select()
    .single();

  if (error) {
    throw new Error(`Error creating xFS audit log entry: ${error.message}`);
  }

  return data;
}

/**
 * Updates an audit log entry with actual performance data
 * @param id - The audit log entry ID
 * @param actualPerformance - The actual performance value
 * @param accuracyScore - The calculated accuracy score
 * @returns Promise with the updated audit entry
 */
export async function updateXFSAuditLogWithActual(
  id: number,
  actualPerformance: number,
  accuracyScore: number
): Promise<XFSAuditLog> {
  const { data, error } = await supabase
    .from("xfs_audit_log")
    .update({
      actual_fantasy_score: actualPerformance,
      accuracy_score: accuracyScore
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(
      `Error updating xFS audit log with actual performance: ${error.message}`
    );
  }

  return data;
}

/**
 * Retrieves xFS prediction accuracy statistics
 * @param predictionHorizon - Prediction horizon (5 or 10 games) (optional)
 * @param startDate - Start date filter (optional)
 * @param endDate - End date filter (optional)
 * @returns Promise with accuracy statistics
 */
export async function getXFSAccuracyStats(
  predictionHorizon?: number,
  startDate?: string,
  endDate?: string
): Promise<{
  total_predictions: number;
  completed_predictions: number;
  average_accuracy: number;
  median_accuracy: number;
}> {
  let query = supabase
    .from("xfs_audit_log")
    .select("accuracy_score")
    .not("actual_fantasy_score", "is", null)
    .not("accuracy_score", "is", null);

  if (predictionHorizon) {
    query = query.eq("prediction_horizon", predictionHorizon);
  }

  if (startDate) {
    query = query.gte("prediction_date", startDate);
  }

  if (endDate) {
    query = query.lte("prediction_date", endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error fetching xFS accuracy stats: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return {
      total_predictions: 0,
      completed_predictions: 0,
      average_accuracy: 0,
      median_accuracy: 0
    };
  }

  const accuracyScores = data
    .map((d) => d.accuracy_score)
    .filter((score) => score !== null) as number[];
  const sortedScores = accuracyScores.sort((a, b) => a - b);

  const average =
    accuracyScores.reduce((sum, score) => sum + score, 0) /
    accuracyScores.length;
  const median = sortedScores[Math.floor(sortedScores.length / 2)];

  return {
    total_predictions: data.length,
    completed_predictions: accuracyScores.length,
    average_accuracy: average,
    median_accuracy: median
  };
}

// Import player mapping utilities
import {
  getNhlPlayerIdFromYahooId,
  getYahooPlayerIdFromNhlId,
  getPlayerMappingFromNhlId,
  getPlayerMappingFromYahooId,
  getYahooPlayerDetails,
  batchGetNhlPlayerIds,
  batchGetYahooPlayerIds,
  batchGetPlayerMappings,
  hasPlayerMapping,
  getTeamPlayerMappings,
  getPositionPlayerMappings,
  type YahooNhlPlayerMapping,
  type YahooPlayerDetails
} from "./player-id-mapping";

// Re-export player mapping types and functions for convenience
export {
  getNhlPlayerIdFromYahooId,
  getYahooPlayerIdFromNhlId,
  getPlayerMappingFromNhlId,
  getPlayerMappingFromYahooId,
  getYahooPlayerDetails,
  batchGetNhlPlayerIds,
  batchGetYahooPlayerIds,
  batchGetPlayerMappings,
  hasPlayerMapping,
  getTeamPlayerMappings,
  getPositionPlayerMappings,
  type YahooNhlPlayerMapping,
  type YahooPlayerDetails
};
