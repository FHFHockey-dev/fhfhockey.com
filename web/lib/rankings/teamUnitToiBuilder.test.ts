import { describe, expect, it } from "vitest";

import {
  buildEvenStrengthTeamUnitToiRows,
  buildPowerPlayTeamUnitToiRows,
  buildTeamUnitToiRows,
  type TeamUnitToiPlayerPositionRow,
  type TeamUnitToiShiftRow,
} from "./teamUnitToiBuilder";

const players: TeamUnitToiPlayerPositionRow[] = [
  { id: 101, position: "C" },
  { id: 102, position: "LW" },
  { id: 103, position: "RW" },
  { id: 104, position: "D" },
  { id: 105, position: "D" },
  { id: 106, position: "G" },
  { id: 201, position: "C" },
  { id: 202, position: "LW" },
  { id: 203, position: "RW" },
  { id: 204, position: "D" },
  { id: 205, position: "D" },
  { id: 206, position: "G" },
];

function shift(args: {
  playerId: number;
  teamId: number;
  teamAbbrev: string;
  start: number;
  end: number;
}): TeamUnitToiShiftRow {
  return {
    game_id: 2025020001,
    season_id: 20252026,
    game_date: "2025-10-07",
    team_id: args.teamId,
    team_abbrev: args.teamAbbrev,
    player_id: args.playerId,
    period: 1,
    start_seconds: args.start,
    end_seconds: args.end,
    duration_seconds: args.end - args.start,
  };
}

describe("teamUnitToiBuilder", () => {
  it("derives 5v5 forward-line and defense-pair pooled player-second rows", () => {
    const shifts = [
      shift({ playerId: 101, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
      shift({ playerId: 102, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
      shift({ playerId: 103, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
      shift({ playerId: 104, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
      shift({ playerId: 105, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
      shift({ playerId: 106, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
      shift({ playerId: 201, teamId: 2, teamAbbrev: "BBB", start: 0, end: 60 }),
      shift({ playerId: 202, teamId: 2, teamAbbrev: "BBB", start: 0, end: 60 }),
      shift({ playerId: 203, teamId: 2, teamAbbrev: "BBB", start: 0, end: 60 }),
      shift({ playerId: 204, teamId: 2, teamAbbrev: "BBB", start: 0, end: 60 }),
      shift({ playerId: 205, teamId: 2, teamAbbrev: "BBB", start: 0, end: 60 }),
      shift({ playerId: 206, teamId: 2, teamAbbrev: "BBB", start: 0, end: 60 }),
    ];

    const rows = buildEvenStrengthTeamUnitToiRows({
      shifts,
      players,
      season: 20252026,
      snapshotDate: "2026-06-22",
    });

    expect(rows).toHaveLength(4);
    expect(
      rows.find((row) => row.team_id === 1 && row.unit_type === "forward_line"),
    ).toMatchObject({
      player_ids: [101, 102, 103],
      unit_number: 1,
      unit_toi_seconds: 180,
      team_unit_pool_toi_seconds: 180,
      toi_basis: "pooled_player_seconds",
      source_table: "nhl_api_shift_rows",
    });
    expect(
      rows.find((row) => row.team_id === 1 && row.unit_type === "defense_pair"),
    ).toMatchObject({
      player_ids: [104, 105],
      unit_toi_seconds: 120,
      team_unit_pool_toi_seconds: 120,
    });
  });

  it("skips non-5v5 segments instead of fabricating unit usage", () => {
    const rows = buildEvenStrengthTeamUnitToiRows({
      shifts: [
        shift({ playerId: 101, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
        shift({ playerId: 102, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
        shift({ playerId: 103, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
        shift({ playerId: 104, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
        shift({ playerId: 106, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
        shift({ playerId: 201, teamId: 2, teamAbbrev: "BBB", start: 0, end: 60 }),
        shift({ playerId: 202, teamId: 2, teamAbbrev: "BBB", start: 0, end: 60 }),
        shift({ playerId: 203, teamId: 2, teamAbbrev: "BBB", start: 0, end: 60 }),
        shift({ playerId: 204, teamId: 2, teamAbbrev: "BBB", start: 0, end: 60 }),
        shift({ playerId: 205, teamId: 2, teamAbbrev: "BBB", start: 0, end: 60 }),
        shift({ playerId: 206, teamId: 2, teamAbbrev: "BBB", start: 0, end: 60 }),
      ],
      players,
      season: 20252026,
      snapshotDate: "2026-06-22",
    });

    expect(rows).toEqual([]);
  });

  it("aggregates PP unit pooled player-seconds by team resolved from shifts", () => {
    const shifts = [
      shift({ playerId: 101, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
      shift({ playerId: 102, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
      shift({ playerId: 103, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
      shift({ playerId: 201, teamId: 2, teamAbbrev: "BBB", start: 0, end: 60 }),
    ];

    const rows = buildPowerPlayTeamUnitToiRows({
      shifts,
      season: 20252026,
      snapshotDate: "2026-06-22",
      ppRows: [
        { gameId: 2025020001, playerId: 101, unit: 1, PPTOI: 120 },
        { gameId: 2025020001, playerId: 102, unit: 1, PPTOI: 100 },
        { gameId: 2025020001, playerId: 103, unit: 2, PPTOI: 80 },
        { gameId: 2025020001, playerId: 201, unit: 1, PPTOI: 60 },
      ],
    });

    expect(rows).toHaveLength(3);
    expect(
      rows.find((row) => row.team_id === 1 && row.unit_number === 1),
    ).toMatchObject({
      player_ids: [101, 102],
      unit_type: "power_play",
      unit_toi_seconds: 220,
      team_unit_pool_toi_seconds: 300,
      source_table: "powerPlayCombinations",
    });
    expect(
      rows.find((row) => row.team_id === 1 && row.unit_number === 2),
    ).toMatchObject({
      player_ids: [103],
      unit_toi_seconds: 80,
      team_unit_pool_toi_seconds: 300,
    });
  });

  it("combines even-strength and power-play aggregate rows", () => {
    const shifts = [
      shift({ playerId: 101, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
      shift({ playerId: 102, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
      shift({ playerId: 103, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
      shift({ playerId: 104, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
      shift({ playerId: 105, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
      shift({ playerId: 201, teamId: 2, teamAbbrev: "BBB", start: 0, end: 60 }),
      shift({ playerId: 202, teamId: 2, teamAbbrev: "BBB", start: 0, end: 60 }),
      shift({ playerId: 203, teamId: 2, teamAbbrev: "BBB", start: 0, end: 60 }),
      shift({ playerId: 204, teamId: 2, teamAbbrev: "BBB", start: 0, end: 60 }),
      shift({ playerId: 205, teamId: 2, teamAbbrev: "BBB", start: 0, end: 60 }),
    ];
    const rows = buildTeamUnitToiRows({
      shifts,
      players,
      ppRows: [{ gameId: 2025020001, playerId: 101, unit: 1, PPTOI: 120 }],
      season: 20252026,
      snapshotDate: "2026-06-22",
    });

    expect(rows.map((row) => row.unit_type).sort()).toEqual([
      "defense_pair",
      "defense_pair",
      "forward_line",
      "forward_line",
      "power_play",
    ]);
  });
});
