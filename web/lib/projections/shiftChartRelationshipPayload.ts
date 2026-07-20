import type { Json, TablesInsert } from "lib/supabase/database-generated.types";

import { stableJsonStringify } from "./materializationFingerprint";

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

function sortShiftSegments(value: Json): Json {
  if (!Array.isArray(value)) return value;
  return [...value].sort((left, right) => {
    const leftRow =
      left && typeof left === "object" && !Array.isArray(left) ? left : {};
    const rightRow =
      right && typeof right === "object" && !Array.isArray(right) ? right : {};
    const leftKey = [
      Number(leftRow.period ?? 0),
      String(leftRow.start_time ?? ""),
      String(leftRow.end_time ?? ""),
      Number(leftRow.shift_number ?? 0),
      String(leftRow.duration ?? ""),
      stableJsonStringify(left),
    ];
    const rightKey = [
      Number(rightRow.period ?? 0),
      String(rightRow.start_time ?? ""),
      String(rightRow.end_time ?? ""),
      Number(rightRow.shift_number ?? 0),
      String(rightRow.duration ?? ""),
      stableJsonStringify(right),
    ];
    return leftKey.join("\u0000").localeCompare(rightKey.join("\u0000"));
  }) as Json;
}

export function buildShiftChartRelationshipUpsert(
  input: ShiftChartRelationshipPayloadInput,
): ShiftChartRelationshipUpsert {
  const shifts = [...input.shifts].sort(
    (left, right) =>
      left.period - right.period ||
      left.start_time.localeCompare(right.start_time) ||
      left.end_time.localeCompare(right.end_time) ||
      left.shift_number - right.shift_number ||
      left.duration.localeCompare(right.duration),
  );
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
    shift_numbers: shifts.map((shift) => shift.shift_number),
    periods: shifts.map((shift) => shift.period),
    start_times: shifts.map((shift) => shift.start_time),
    end_times: shifts.map((shift) => shift.end_time),
    durations: shifts.map((shift) => shift.duration),
    pp_shifts: sortShiftSegments(input.pp_shifts),
    es_shifts: sortShiftSegments(input.es_shifts),
    game_toi: input.game_toi,
    game_length: input.game_length,
    shifts: shifts as unknown as Json,
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
