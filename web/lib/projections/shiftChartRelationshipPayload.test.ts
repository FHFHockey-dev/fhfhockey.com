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
});
