import { describe, expect, it } from "vitest";

import {
  buildGoalieXgExplorerRows,
  buildPlayerXgExplorerRows,
  buildTeamXgExplorerRows,
  buildXgExplorerCoverageReport,
} from "./xgExplorer";

const teams = [
  { id: 1, abbreviation: "BOS", name: "Boston Bruins" },
  { id: 2, abbreviation: "NYR", name: "New York Rangers" },
];

const players = [
  { id: 10, fullName: "Shot Creator", team_id: 1, position: "C" },
  { id: 20, fullName: "No Created Row", team_id: 2, position: "L" },
  { id: 30, fullName: "Net Minder", team_id: 1, position: "G" },
];

const core = (overrides: Record<string, unknown>) => ({
  player_id: 10,
  team_id: 1,
  as_of_game_date: "2026-02-10",
  as_of_game_id: 50,
  games_count: 10,
  ixg: 4.1234567,
  goals: 5,
  shot_attempts: 41,
  ...overrides,
});

const created = (overrides: Record<string, unknown>) => ({
  player_id: 10,
  team_id: 1,
  as_of_game_date: "2026-02-10",
  as_of_game_id: 50,
  games_count: 10,
  created_xg: 3.5,
  shot_assist_created_xg: 2.25,
  transition_created_xg: 1.25,
  shot_assist_events: 6,
  transition_events: 3,
  ...overrides,
});

describe("buildPlayerXgExplorerRows (W3-1 D7: one window and cutoff per row)", () => {
  it("pairs created xG only with the core row's cutoff game and window", () => {
    const rows = buildPlayerXgExplorerRows({
      players,
      teams,
      limit: 5,
      xgRows: [core({}), core({ as_of_game_date: "2026-01-10", as_of_game_id: 20, ixg: 2 })],
      // An older created row (Jan 10) must not sit beside the Feb 10 core row.
      createdRows: [created({ as_of_game_date: "2026-01-10", as_of_game_id: 20, created_xg: 9 }), created({})],
    });

    expect(rows[0]).toMatchObject({
      id: 10,
      asOfGameDate: "2026-02-10",
      ixg: 4.123457,
      createdXg: 3.5,
      shotAssistCreatedXg: 2.25,
      transitionCreatedXg: 1.25,
    });
  });

  it("shows missing or misaligned created xG as null, never 0", () => {
    const rows = buildPlayerXgExplorerRows({
      players,
      teams,
      limit: 5,
      xgRows: [core({}), core({ player_id: 20, team_id: 2, ixg: 9 })],
      // Player 10's only created row is a different window (5 games).
      createdRows: [created({ games_count: 5 })],
    });

    expect(rows.map((row) => [row.id, row.createdXg, row.shotAssistEvents])).toEqual([
      [20, null, null],
      [10, null, null],
    ]);
  });

  it("sorts created xG descending with nulls last and a stable id tie-break", () => {
    const rows = buildPlayerXgExplorerRows({
      players,
      teams,
      limit: 5,
      xgRows: [core({ player_id: 20, team_id: 2, ixg: 9 }), core({})],
      createdRows: [created({ created_xg: 0.5 })],
    });
    expect(rows.map((row) => row.id)).toEqual([10, 20]);
  });
});

describe("team and goalie explorer rows", () => {
  it("serves the latest team window only", () => {
    const rows = buildTeamXgExplorerRows({
      teams,
      limit: 5,
      xgRows: [
        { team_id: 1, as_of_game_date: "2026-02-10", as_of_game_id: 50, games_count: 10, xg_for: 30, xg_against: 20, goals_for: 28, goals_against: 18 },
        { team_id: 1, as_of_game_date: "2026-01-10", as_of_game_id: 20, games_count: 10, xg_for: 1, xg_against: 9, goals_for: 1, goals_against: 9 },
      ],
    });
    expect(rows).toEqual([
      { id: 1, name: "Boston Bruins", abbreviation: "BOS", asOfGameDate: "2026-02-10", gamesCount: 10, xgFor: 30, xgAgainst: 20, xgPct: 0.6, goalsFor: 28, goalsAgainst: 18 },
    ]);
  });

  it("sorts goalies by GSAx with an id tie-break", () => {
    const goalie = (id: number, gsax: number) => ({
      goalie_player_id: id,
      team_id: 1,
      as_of_game_date: "2026-02-10",
      as_of_game_id: 50,
      games_count: 10,
      xg_against: 20,
      goals_against: 18,
      shots_against: 300,
      goals_saved_above_expected: gsax,
    });
    const rows = buildGoalieXgExplorerRows({
      players,
      teams,
      limit: 5,
      xgRows: [goalie(30, 2), goalie(20, 2), goalie(10, 3)],
    });
    expect(rows.map((row) => row.id)).toEqual([10, 20, 30]);
  });
});

describe("buildXgExplorerCoverageReport (W2-3 A4: coverage from served rows)", () => {
  it("is ok only when every served player row has aligned created xG", () => {
    const aligned = { createdXg: 1 } as never;
    const missing = { createdXg: null } as never;
    expect(buildXgExplorerCoverageReport({ scope: "players", rows: [aligned, aligned] })).toMatchObject({
      status: "ok",
      servedRows: 2,
      alignedRows: 2,
    });
    expect(buildXgExplorerCoverageReport({ scope: "players", rows: [aligned, missing] })).toMatchObject({
      status: "warning",
      alignedRows: 1,
    });
    expect(buildXgExplorerCoverageReport({ scope: "teams", rows: [] }).status).toBe("warning");
  });
});
