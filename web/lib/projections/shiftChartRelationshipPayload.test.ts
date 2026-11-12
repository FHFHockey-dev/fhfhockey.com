import { describe, expect, it } from "vitest";

import { buildShiftChartRelationshipUpsert } from "./shiftChartRelationshipPayload";

describe("shift chart relationship payload ownership", () => {
  it("emits numeric assignments and never writes strength totals", () => {
    const payload = buildShiftChartRelationshipUpsert({
      game_id: 2025020001,
      game_type: "2",
      game_date: "2025-10-07",
      season_id: 20252026,
      player_id: 10,
      player_first_name: "Home",
      player_last_name: "Player",
      team_id: 1,
      team_abbreviation: "AAA",
      home_or_away: "home",
      opponent_team_id: 2,
      opponent_team_abbreviation: "BBB",
      shifts: [
        {
          shift_number: 1,
          period: 1,
          start_time: "0:00",
          end_time: "0:30",
          duration: "0:30",
          playerId: 10,
        },
      ],
      pp_shifts: [],
      es_shifts: [],
      game_toi: "0:30",
      game_length: "60:00",
      time_spent_with: {},
      percent_toi_with: {},
      time_spent_with_mixed: {},
      percent_toi_with_mixed: {},
      display_position: "C",
      primary_position: "C",
      player_type: "F",
      line_combination: 1,
      pairing_combination: null,
    });

    expect(payload).toMatchObject({
      line_combination: 1,
      pairing_combination: null,
      home_or_away: "home",
      opponent_team_id: 2,
    });
    expect(payload).not.toHaveProperty("total_es_toi");
    expect(payload).not.toHaveProperty("total_pp_toi");
    expect(payload).not.toHaveProperty("total_pk_toi");
  });

  it("normalizes shift and strength-segment ordering deterministically", () => {
    const input = {
      game_id: 2025020001,
      game_type: "2",
      game_date: "2025-10-07",
      season_id: 20252026,
      player_id: 10,
      player_first_name: "Home",
      player_last_name: "Player",
      team_id: 1,
      team_abbreviation: "AAA",
      home_or_away: "home" as const,
      opponent_team_id: 2,
      opponent_team_abbreviation: "BBB",
      shifts: [
        {
          shift_number: 2,
          period: 2,
          start_time: "0:00",
          end_time: "0:30",
          duration: "0:30",
          playerId: 10,
        },
        {
          shift_number: 1,
          period: 1,
          start_time: "0:00",
          end_time: "0:30",
          duration: "0:30",
          playerId: 10,
        },
      ],
      pp_shifts: [
        { period: 2, start_time: "0:00", shift_number: 2 },
        { period: 1, start_time: "0:00", shift_number: 1 },
      ],
      es_shifts: [],
      game_toi: "1:00",
      game_length: "60:00",
      time_spent_with: {},
      percent_toi_with: {},
      time_spent_with_mixed: {},
      percent_toi_with_mixed: {},
      display_position: "C",
      primary_position: "C",
      player_type: "F" as const,
      line_combination: 1,
      pairing_combination: null,
    };

    const reversed = {
      ...input,
      shifts: [...input.shifts].reverse(),
      pp_shifts: [...input.pp_shifts].reverse(),
    };

    expect(buildShiftChartRelationshipUpsert(input)).toEqual(
      buildShiftChartRelationshipUpsert(reversed),
    );
  });

  it("sorts unpadded clocks and multi-digit periods numerically with aligned arrays", () => {
    const shift = (period: number, start: string, end: string, number: number) => ({
      shift_number: number,
      period,
      start_time: start,
      end_time: end,
      duration: number === 2 ? "8:00" : "0:30",
      playerId: 10,
    });
    const shifts = [
      shift(1, "10:00", "10:30", 3),
      shift(1, "2:00", "10:00", 2),
      shift(1, "2:00", "2:30", 1),
      shift(10, "0:00", "0:30", 5),
      shift(2, "0:00", "0:30", 4),
    ];
    const build = (ordered: typeof shifts) => buildShiftChartRelationshipUpsert({
      game_id: 2025020001,
      shifts: ordered,
      pp_shifts: ordered,
      es_shifts: ordered,
    });
    const row = build(shifts);

    expect(row.periods).toEqual([1, 1, 1, 2, 10]);
    expect(row.start_times).toEqual(["2:00", "2:00", "10:00", "0:00", "0:00"]);
    expect(row.end_times).toEqual(["2:30", "10:00", "10:30", "0:30", "0:30"]);
    expect(row.shift_numbers).toEqual([1, 2, 3, 4, 5]);
    expect(row.durations).toEqual(["0:30", "8:00", "0:30", "0:30", "0:30"]);
    expect(row.pp_shifts).toEqual(row.shifts);
    expect(row.es_shifts).toEqual(row.shifts);
    expect(build([...shifts].reverse())).toEqual(row);
    const equalClockValues = [
      shifts[2],
      { ...shifts[2], start_time: "02:00", end_time: "02:30", duration: "00:30" },
    ];
    expect(build(equalClockValues)).toEqual(build([...equalClockValues].reverse()));
  });
});
