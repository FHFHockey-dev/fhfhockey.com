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

  it("treats players.position wing codes L and R as forwards", () => {
    // players.position stores NHL's single-letter codes; LW/RW never appear there.
    const nhlCodes = players.map((player) => ({
      ...player,
      position: player.position === "LW" ? "L" : player.position === "RW" ? "R" : player.position,
    }));
    const shifts = [101, 102, 103, 104, 105, 106].map((playerId) =>
      shift({ playerId, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
    ).concat([201, 202, 203, 204, 205, 206].map((playerId) =>
      shift({ playerId, teamId: 2, teamAbbrev: "BBB", start: 0, end: 60 }),
    ));

    const rows = buildEvenStrengthTeamUnitToiRows({
      shifts,
      players: nhlCodes,
      season: 20262027,
      snapshotDate: "2026-11-08",
    });

    expect(rows).toHaveLength(4);
    expect(
      rows.find((row) => row.team_id === 1 && row.unit_type === "forward_line"),
    ).toMatchObject({ player_ids: [101, 102, 103], unit_toi_seconds: 180, coverage_status: "complete" });
    expect(
      rows.find((row) => row.team_id === 2 && row.unit_type === "defense_pair"),
    ).toMatchObject({ player_ids: [204, 205], coverage_status: "complete" });
  });

  it("marks a team-game partial when a skater's position is unknown", () => {
    // 107 has no position: segment 0-60 cannot be read as 5v5 for team 1 and is skipped,
    // so team 1's units from 60-120 are incomplete. Team 2 is unaffected.
    const withUnknown = [...players, { id: 107, position: null }];
    const shifts = [
      ...[101, 102, 103, 104, 107, 106].map((playerId) =>
        shift({ playerId, teamId: 1, teamAbbrev: "AAA", start: 0, end: 60 }),
      ),
      ...[101, 102, 103, 104, 105, 106].map((playerId) =>
        shift({ playerId, teamId: 1, teamAbbrev: "AAA", start: 60, end: 120 }),
      ),
      ...[201, 202, 203, 204, 205, 206].map((playerId) =>
        shift({ playerId, teamId: 2, teamAbbrev: "BBB", start: 0, end: 120 }),
      ),
    ];

    const rows = buildEvenStrengthTeamUnitToiRows({
      shifts,
      players: withUnknown,
      season: 20262027,
      snapshotDate: "2026-11-08",
    });

    const team1 = rows.filter((row) => row.team_id === 1);
    expect(team1.length).toBeGreaterThan(0);
    team1.forEach((row) =>
      expect(row).toMatchObject({
        coverage_status: "partial",
        coverage_warnings: ["unclassified_skater_positions:107"],
      }),
    );
    rows
      .filter((row) => row.team_id === 2)
      .forEach((row) => expect(row).toMatchObject({ coverage_status: "complete", coverage_warnings: [] }));
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
