import type { Json, TablesInsert } from "lib/supabase/database-generated.types";

export type ShiftChartRelationshipUpsert = Pick<
  TablesInsert<"shift_charts">,
  | "game_id"
  | "game_type"
  | "game_date"
  | "season_id"
  | "player_id"
  | "player_first_name"
  | "player_last_name"
  | "team_id"
  | "team_abbreviation"
  | "home_or_away"
  | "opponent_team_id"
  | "opponent_team_abbreviation"
  | "shift_numbers"
  | "periods"
  | "start_times"
  | "end_times"
  | "durations"
  | "pp_shifts"
  | "es_shifts"
  | "game_toi"
  | "game_length"
  | "shifts"
  | "time_spent_with"
  | "percent_toi_with"
  | "time_spent_with_mixed"
  | "percent_toi_with_mixed"
  | "display_position"
  | "primary_position"
  | "player_type"
  | "line_combination"
  | "pairing_combination"
>;

export type ShiftChartRelationshipPayloadInput = Omit<
  ShiftChartRelationshipUpsert,
  | "shift_numbers"
  | "periods"
  | "start_times"
  | "end_times"
  | "durations"
  | "pp_shifts"
  | "es_shifts"
  | "shifts"
> & {
  shifts: Array<{
    shift_number: number;
    period: number;
    start_time: string;
    end_time: string;
    duration: string;
    playerId: number;
  }>;
  pp_shifts: Json;
  es_shifts: Json;
};

export function buildShiftChartRelationshipUpsert(
  input: ShiftChartRelationshipPayloadInput,
): ShiftChartRelationshipUpsert {
  return {
    game_id: input.game_id,
    game_type: input.game_type,
    game_date: input.game_date,
    season_id: input.season_id,
    player_id: input.player_id,
    player_first_name: input.player_first_name,
    player_last_name: input.player_last_name,
    team_id: input.team_id,
    team_abbreviation: input.team_abbreviation,
    home_or_away: input.home_or_away,
    opponent_team_id: input.opponent_team_id,
    opponent_team_abbreviation: input.opponent_team_abbreviation,
    shift_numbers: input.shifts.map((shift) => shift.shift_number),
    periods: input.shifts.map((shift) => shift.period),
    start_times: input.shifts.map((shift) => shift.start_time),
    end_times: input.shifts.map((shift) => shift.end_time),
    durations: input.shifts.map((shift) => shift.duration),
    pp_shifts: input.pp_shifts,
    es_shifts: input.es_shifts,
    game_toi: input.game_toi,
    game_length: input.game_length,
    shifts: input.shifts as unknown as Json,
    time_spent_with: input.time_spent_with,
    percent_toi_with: input.percent_toi_with,
    time_spent_with_mixed: input.time_spent_with_mixed,
    percent_toi_with_mixed: input.percent_toi_with_mixed,
    display_position: input.display_position,
    primary_position: input.primary_position,
    player_type: input.player_type,
    line_combination: input.line_combination,
    pairing_combination: input.pairing_combination,
  };
}
