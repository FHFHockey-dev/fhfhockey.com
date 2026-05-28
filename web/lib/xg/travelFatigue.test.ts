import { describe, expect, it } from "vitest";

import {
  buildTeamGameTravelFatigueFeatures,
  type TravelFatigueGameRow,
} from "./travelFatigue";

function game(overrides: Partial<TravelFatigueGameRow>): TravelFatigueGameRow {
  return {
    id: 2025020001,
    seasonId: 20252026,
    date: "2025-10-07",
    startTime: "2025-10-07T23:00:00.000Z",
    homeTeamId: 10,
    awayTeamId: 26,
    type: 2,
    ...overrides,
  };
}

describe("buildTeamGameTravelFatigueFeatures", () => {
  it("builds home/away rows with local puck-drop and body-clock deltas", () => {
    const rows = buildTeamGameTravelFatigueFeatures({
      games: [game({ homeTeamId: 10, awayTeamId: 26 })],
      generatedAt: "2026-05-27T20:00:00.000Z",
    });

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.team_id === 10)).toMatchObject({
      is_home: true,
      venue_timezone: "America/Toronto",
      team_home_timezone: "America/Toronto",
      local_puck_drop_date: "2025-10-07",
      local_puck_drop_hour: 19,
      body_clock_delta_hours: 0,
      feature_availability: "pregame_safe",
    });
    expect(rows.find((row) => row.team_id === 26)).toMatchObject({
      is_home: false,
      venue_timezone: "America/Toronto",
      team_home_timezone: "America/Los_Angeles",
      local_puck_drop_hour: 19,
      team_body_clock_puck_drop_hour: 16,
      body_clock_delta_hours: 3,
      road_trip_game_number: 1,
    });
  });

  it("detects back-to-backs, three-in-four, road-trip sequences, and eastward travel", () => {
    const rows = buildTeamGameTravelFatigueFeatures({
      games: [
        game({
          id: 1,
          date: "2025-10-07",
          startTime: "2025-10-08T02:00:00.000Z",
          homeTeamId: 26,
          awayTeamId: 10,
        }),
        game({
          id: 2,
          date: "2025-10-08",
          startTime: "2025-10-09T00:00:00.000Z",
          homeTeamId: 21,
          awayTeamId: 10,
        }),
        game({
          id: 3,
          date: "2025-10-10",
          startTime: "2025-10-11T00:00:00.000Z",
          homeTeamId: 10,
          awayTeamId: 6,
        }),
      ],
      generatedAt: "2026-05-27T20:00:00.000Z",
    });

    expect(rows.find((row) => row.game_id === 2 && row.team_id === 10)).toMatchObject({
      previous_game_id: 1,
      previous_is_home: false,
      hours_since_previous_game: 22,
      rest_days: 0,
      is_back_to_back: true,
      road_trip_game_number: 2,
      timezone_delta_hours_from_previous_game: 1,
      travel_direction_from_previous_game: "east",
    });
    expect(rows.find((row) => row.game_id === 3 && row.team_id === 10)).toMatchObject({
      previous_game_id: 2,
      is_home: true,
      road_trip_game_number: 0,
      home_stand_game_number: 1,
      games_in_last_4_days: 3,
      is_three_in_four: true,
      timezone_delta_hours_from_previous_game: 2,
      travel_direction_from_previous_game: "east",
    });
  });

  it("marks missing timezone inference without throwing", () => {
    const rows = buildTeamGameTravelFatigueFeatures({
      games: [
        game({
          id: 4,
          homeTeamId: 999,
          awayTeamId: 10,
          startTime: "2025-10-07T23:00:00.000Z",
        }),
      ],
      generatedAt: "2026-05-27T20:00:00.000Z",
    });

    expect(rows.find((row) => row.team_id === 999)).toMatchObject({
      venue_timezone: null,
      venue_timezone_source: "missing_home_team_timezone",
      local_puck_drop_hour: null,
      is_neutral_site_inferred: false,
    });
    expect(rows.find((row) => row.team_id === 10)).toMatchObject({
      venue_timezone: null,
      team_home_timezone: "America/Toronto",
      body_clock_delta_hours: null,
    });
  });
});
