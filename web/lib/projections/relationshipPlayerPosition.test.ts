import { describe, expect, it } from "vitest";

import {
  buildRelationshipRosterPositionMap,
  isCompleteRelationshipPlayerPosition,
  resolveRelationshipPlayerPosition,
  type RelationshipRosterPosition,
} from "./relationshipPlayerPosition";

const GAME_ID = 2025030417;
const HASH = "a".repeat(64);

function roster(
  positionCode: string | null,
  overrides: Partial<RelationshipRosterPosition> = {},
): RelationshipRosterPosition {
  return {
    game_id: GAME_ID,
    player_id: 10,
    position_code: positionCode,
    source_play_by_play_hash: HASH,
    team_id: 1,
    ...overrides,
  };
}

describe("relationship player positions", () => {
  it.each([
    ["C", "C", "F"],
    ["L", "LW", "F"],
    ["R", "RW", "F"],
    ["D", "D", "D"],
    ["G", "G", "G"],
  ] as const)(
    "falls back from a missing Yahoo row for roster code %s",
    (positionCode, primaryPosition, playerType) => {
      expect(
        resolveRelationshipPlayerPosition({
          expectedPbpRawPayloadHash: HASH,
          gameId: GAME_ID,
          playerId: 10,
          rosterPosition: roster(positionCode),
          teamId: 1,
        }),
      ).toEqual({
        displayPosition: primaryPosition,
        playerType,
        primaryPosition,
        source: "nhl_roster",
      });
    },
  );

  it("preserves valid Yahoo multi-position metadata with same-type roster evidence", () => {
    expect(
      resolveRelationshipPlayerPosition({
        expectedPbpRawPayloadHash: HASH,
        gameId: GAME_ID,
        playerId: 10,
        rosterPosition: roster("R"),
        teamId: 1,
        yahooPosition: {
          display_position: " C, RW ",
          primary_position: "C",
        },
      }),
    ).toEqual({
      displayPosition: "C,RW",
      playerType: "F",
      primaryPosition: "C",
      source: "yahoo",
    });
  });

  it("uses the roster when Yahoo metadata is unusable", () => {
    expect(
      resolveRelationshipPlayerPosition({
        expectedPbpRawPayloadHash: HASH,
        gameId: GAME_ID,
        playerId: 10,
        rosterPosition: roster("L"),
        teamId: 1,
        yahooPosition: {
          display_position: null,
          primary_position: "F",
        },
      }),
    ).toMatchObject({
      displayPosition: "LW",
      playerType: "F",
      primaryPosition: "LW",
      source: "nhl_roster",
    });
  });

  it("rejects a coarse Yahoo/roster type conflict", () => {
    expect(() =>
      resolveRelationshipPlayerPosition({
        expectedPbpRawPayloadHash: HASH,
        gameId: GAME_ID,
        playerId: 10,
        rosterPosition: roster("D"),
        teamId: 1,
        yahooPosition: {
          display_position: "C,LW",
          primary_position: "C",
        },
      }),
    ).toThrow("Conflicting relationship position");
  });

  it.each([
    ["missing", undefined],
    ["wrong game", roster("C", { game_id: GAME_ID + 1 })],
    ["wrong player", roster("C", { player_id: 11 })],
    ["wrong team", roster("C", { team_id: 2 })],
    ["stale hash", roster("C", { source_play_by_play_hash: "b".repeat(64) })],
  ])("rejects %s current-roster evidence", (_name, rosterPosition) => {
    expect(() =>
      resolveRelationshipPlayerPosition({
        expectedPbpRawPayloadHash: HASH,
        gameId: GAME_ID,
        playerId: 10,
        rosterPosition,
        teamId: 1,
      }),
    ).toThrow("Missing current relationship roster position");
  });

  it.each([
    null,
    "",
    "F",
    "W",
    "unknown",
    "LW",
    "RW",
    "LD",
    "RD",
    "GK",
    "GOALIE",
  ])(
    "rejects unknown roster position %s",
    (positionCode) => {
      expect(() =>
        resolveRelationshipPlayerPosition({
          expectedPbpRawPayloadHash: HASH,
          gameId: GAME_ID,
          playerId: 10,
          rosterPosition: roster(positionCode),
          teamId: 1,
        }),
      ).toThrow("Invalid relationship roster position");
    },
  );

  it("rejects duplicate, stale, or cross-game roster-map rows", () => {
    expect(() =>
      buildRelationshipRosterPositionMap({
        expectedPbpRawPayloadHash: HASH,
        gameId: GAME_ID,
        rows: [roster("C"), roster("C")],
      }),
    ).toThrow("Invalid relationship roster identity");
    expect(() =>
      buildRelationshipRosterPositionMap({
        expectedPbpRawPayloadHash: HASH,
        gameId: GAME_ID,
        rows: [roster("C", { source_play_by_play_hash: "b".repeat(64) })],
      }),
    ).toThrow("Invalid relationship roster identity");
    expect(() =>
      buildRelationshipRosterPositionMap({
        expectedPbpRawPayloadHash: HASH,
        gameId: GAME_ID,
        rows: [roster("C", { game_id: GAME_ID + 1 })],
      }),
    ).toThrow("Invalid relationship roster identity");
  });

  it("validates complete relationship position/type consistency", () => {
    expect(
      isCompleteRelationshipPlayerPosition({
        display_position: "C,LW",
        player_type: "F",
        primary_position: "C",
      }),
    ).toBe(true);
    expect(
      isCompleteRelationshipPlayerPosition({
        display_position: null,
        player_type: "F",
        primary_position: "C",
      }),
    ).toBe(false);
    expect(
      isCompleteRelationshipPlayerPosition({
        display_position: "C",
        player_type: "D",
        primary_position: "C",
      }),
    ).toBe(false);
    expect(
      isCompleteRelationshipPlayerPosition({
        display_position: "LW",
        player_type: "F",
        primary_position: "L",
      }),
    ).toBe(false);
    expect(
      isCompleteRelationshipPlayerPosition({
        display_position: "L",
        player_type: "F",
        primary_position: "LW",
      }),
    ).toBe(false);
  });
});
