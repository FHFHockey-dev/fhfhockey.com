import supabase from "lib/supabase/server";

export async function persistForgePlayerProjectionRows(
  rows: Array<Record<string, unknown>>,
): Promise<number> {
  const { error } = await supabase
    .from("forge_player_projections")
    .upsert(rows as any, {
      onConflict: "run_id,game_id,player_id,horizon_games",
    });
  if (error) throw error;
  return rows.length;
}

export async function persistForgeTeamProjection(
  row: Record<string, unknown>,
): Promise<number> {
  const { error } = await supabase
    .from("forge_team_projections")
    .upsert(row as any, {
      onConflict: "run_id,game_id,team_id,horizon_games",
    });
  if (error) throw error;
  return 1;
}

export async function persistForgeGoalieProjection(
  row: Record<string, unknown>,
): Promise<number> {
  const { error } = await supabase
    .from("forge_goalie_projections")
    .upsert(row as any, {
      onConflict: "run_id,game_id,goalie_id,horizon_games",
    });
  if (error) throw error;
  return 1;
}

export async function persistPerGameAnalyticsOutputs(args: {
  asOfDate: string;
  gameId: number;
  modelName: string;
  modelVersion: string;
  playerPredictionOutputRows: Array<Record<string, unknown>>;
  gamePredictionOutput: Record<string, unknown>;
  modelMarketFlagRows: Array<Record<string, unknown>>;
}): Promise<void> {
  const { error: deletePlayerPredictionError } = await supabase
    .from("player_prediction_outputs" as any)
    .delete()
    .eq("snapshot_date", args.asOfDate)
    .eq("game_id", args.gameId)
    .eq("model_name", args.modelName)
    .eq("model_version", args.modelVersion)
    .eq("prediction_scope", "pregame");
  if (deletePlayerPredictionError) throw deletePlayerPredictionError;

  if (args.playerPredictionOutputRows.length > 0) {
    const { error: playerPredictionError } = await supabase
      .from("player_prediction_outputs" as any)
      .upsert(args.playerPredictionOutputRows as any, {
        onConflict:
          "snapshot_date,player_id,model_name,model_version,prediction_scope,metric_key,game_id",
      });
    if (playerPredictionError) throw playerPredictionError;
  }

  const { error: deleteGamePredictionError } = await supabase
    .from("game_prediction_outputs" as any)
    .delete()
    .eq("snapshot_date", args.asOfDate)
    .eq("game_id", args.gameId)
    .eq("model_name", args.modelName)
    .eq("model_version", args.modelVersion)
    .eq("prediction_scope", "pregame");
  if (deleteGamePredictionError) throw deleteGamePredictionError;

  const { error: gamePredictionError } = await supabase
    .from("game_prediction_outputs" as any)
    .upsert(args.gamePredictionOutput as any, {
      onConflict:
        "snapshot_date,game_id,model_name,model_version,prediction_scope",
    });
  if (gamePredictionError) throw gamePredictionError;

  const { error: deleteModelFlagError } = await supabase
    .from("model_market_flags_daily" as any)
    .delete()
    .eq("snapshot_date", args.asOfDate)
    .eq("game_id", args.gameId)
    .eq("model_name", args.modelName)
    .eq("model_version", args.modelVersion);
  if (deleteModelFlagError) throw deleteModelFlagError;

  if (args.modelMarketFlagRows.length > 0) {
    const { error: modelFlagError } = await supabase
      .from("model_market_flags_daily" as any)
      .upsert(args.modelMarketFlagRows as any, {
        onConflict:
          "snapshot_date,entity_type,entity_id,model_name,model_version,market_type,flag_type,game_id",
      });
    if (modelFlagError) throw modelFlagError;
  }
}
