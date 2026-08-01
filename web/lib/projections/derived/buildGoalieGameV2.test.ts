import { describe, expect, it } from "vitest";

import { prepareGoalieGameV2 } from "./buildGoalieGameV2";
import type {
  ProjectionDerivedGame,
  ProjectionDerivedPbpPlayRow,
} from "./buildStrengthTablesV2";

const game: ProjectionDerivedGame = {
  id: 2025020001,
  date: "2025-10-07",
  homeTeamId: 1,
  awayTeamId: 2,
};

function play(
  overrides: Partial<ProjectionDerivedPbpPlayRow> = {},
): ProjectionDerivedPbpPlayRow {
  return {
    id: 1,
    gameid: game.id,
    situationcode: "1551",
    typedesckey: "shot-on-goal",
    eventownerteamid: game.homeTeamId,
    shootingplayerid: 10,
    scoringplayerid: null,
    assist1playerid: null,
    assist2playerid: null,
    goalieinnetid: 20,
    ...overrides,
  };
}

describe("goalie game preparation", () => {
  it("keeps every observed goalie so the RPC can replace the exact prior scope", () => {
    const result = prepareGoalieGameV2({
      game,
      plays: [play(), play({ id: 2, typedesckey: "goal", goalieinnetid: 21 })],
    });
    expect(result).toEqual({
      outcome: "complete",
      justification: null,
      emptyNetEvents: 0,
      rows: [
        expect.objectContaining({
          goalie_id: 20,
          team_id: 2,
          shots_against: 1,
          goals_allowed: 0,
          saves: 1,
        }),
        expect.objectContaining({
          goalie_id: 21,
          team_id: 2,
          shots_against: 1,
          goals_allowed: 1,
          saves: 0,
        }),
      ],
    });
  });

  it("returns an explicit justified not_observed outcome for an empty-net-only scope", () => {
    const result = prepareGoalieGameV2({
      game,
      plays: [play({ situationcode: "0551", goalieinnetid: null })],
    });
    expect(result).toEqual({
      rows: [],
      outcome: "not_observed",
      justification: "completed_pbp_countable_events_are_all_empty_net",
      emptyNetEvents: 1,
    });
  });

  it("returns a distinct justified status when completed PBP has no shot events", () => {
    const result = prepareGoalieGameV2({
      game,
      plays: [play({ typedesckey: "game-end", goalieinnetid: null })],
    });
    expect(result).toMatchObject({
      rows: [],
      outcome: "not_observed",
      justification: "completed_pbp_contains_no_countable_shot_events",
    });
  });

  it("fails closed when a non-empty-net shot lacks goalie identity", () => {
    expect(() =>
      prepareGoalieGameV2({
        game,
        plays: [play({ goalieinnetid: null })],
      }),
    ).toThrow("missing a goalie");
  });

  it("fails closed when an empty-net situation claims a goalie identity", () => {
    expect(() =>
      prepareGoalieGameV2({
        game,
        plays: [play({ situationcode: "0551", goalieinnetid: 20 })],
      }),
    ).toThrow("contradictory goalie metadata");
  });
});
