import supabase from "lib/supabase/server";

import type {
  Game,
  GoalieGameStatsRow,
  GoalieStatsAdapter,
  IngestedDataAdapters,
  PbpPlayRow,
  PlayByPlayAdapter,
  ScheduleAdapter,
  ShiftChartRow,
  ShiftsAdapter
} from "./types";

function assertSupabaseAvailable() {
  if (!supabase) {
    throw new Error(
      "Supabase server client is not available. Ensure SUPABASE_SERVICE_ROLE_KEY is configured."
    );
  }
}

export class SupabaseScheduleAdapter implements ScheduleAdapter {
  async listGamesByDate(date: string): Promise<Game[]> {
    assertSupabaseAvailable();
    const { data, error } = await supabase
      .from("games")
      .select("id,date,homeTeamId,awayTeamId")
      .eq("date", date);
    if (error) throw error;
    return (data ?? []) as Game[];
  }

  async listGamesInDateRange(startDate: string, endDate: string): Promise<Game[]> {
    assertSupabaseAvailable();
    const { data, error } = await supabase
      .from("games")
      .select("id,date,homeTeamId,awayTeamId")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Game[];
  }
}

export class SupabaseShiftsAdapter implements ShiftsAdapter {
  async listShiftChartsByGame(gameId: number): Promise<ShiftChartRow[]> {
    assertSupabaseAvailable();
    const { data, error } = await supabase
      .from("shift_charts")
      .select(
        "game_id,player_id,team_id,opponent_team_id,game_date,total_es_toi,total_pp_toi"
      )
      .eq("game_id", gameId);
    if (error) throw error;
    return (data ?? []) as ShiftChartRow[];
  }
}

export class SupabasePlayByPlayAdapter implements PlayByPlayAdapter {
  async listPlaysByGame(gameId: number): Promise<PbpPlayRow[]> {
    assertSupabaseAvailable();
    const { data, error } = await supabase
      .from("pbp_plays")
      .select(
        "gameid,game_date,sortorder,situationcode,typedesckey,typecode,shootingplayerid,scoringplayerid,assist1playerid,assist2playerid,eventownerteamid"
      )
      .eq("gameid", gameId)
      .order("sortorder", { ascending: true });
    if (error) throw error;
    return (data ?? []) as PbpPlayRow[];
  }
}

export class SupabaseGoalieStatsAdapter implements GoalieStatsAdapter {
  async listGoalieGameStatsByGame(gameId: number): Promise<GoalieGameStatsRow[]> {
    assertSupabaseAvailable();
    const { data, error } = await supabase
      .from("goaliesGameStats")
      .select("gameId,playerId,goalsAgainst,saveShotsAgainst,toi")
      .eq("gameId", gameId);
    if (error) throw error;
    return (data ?? []) as GoalieGameStatsRow[];
  }
}

export function createSupabaseIngestedDataAdapters(): IngestedDataAdapters {
  return {
    schedule: new SupabaseScheduleAdapter(),
    shifts: new SupabaseShiftsAdapter(),
    pbp: new SupabasePlayByPlayAdapter(),
    goalie: new SupabaseGoalieStatsAdapter()
  };
}

