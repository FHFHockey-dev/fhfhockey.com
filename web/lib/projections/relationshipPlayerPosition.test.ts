import { describe, expect, it } from "vitest";

import {
  buildRelationshipRosterPositionMap,
  isCompleteRelationshipPlayerPosition,
  resolveRelationshipPlayerPosition,
  selectRelationshipYahooPosition,
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

  it("uses the roster when same-name Yahoo players are ambiguous", () => {
    // Yahoo rows for Vancouver's two "Elias Pettersson"s, ordered by player_key.
    const yahooRows = [
      { player_key: "427.p.7520", display_position: "C,LW", primary_position: "C" },
      { player_key: "477.p.32762", display_position: "D", primary_position: "D" },
      { player_key: "477.p.7520", display_position: "C", primary_position: "C" },
    ];
    const defensemanArgs = {
      expectedPbpRawPayloadHash: HASH,
      gameId: GAME_ID,
      playerId: 8483678,
      rosterPosition: roster("D", { player_id: 8483678 }),
      teamId: 1,
    };
    // The first full-name match is the C, which aborted the 2026-10-12 run.
    expect(() =>
      resolveRelationshipPlayerPosition({
        ...defensemanArgs,
        yahooPosition: yahooRows[0],
      }),
    ).toThrow("Conflicting relationship position for player 8483678");

    const selected = selectRelationshipYahooPosition(yahooRows);
    expect(selected).toBeUndefined();
    expect(
      resolveRelationshipPlayerPosition({
        ...defensemanArgs,
        yahooPosition: selected,
      }),
    ).toEqual({
      displayPosition: "D",
      playerType: "D",
      primaryPosition: "D",
      source: "nhl_roster",
    });
  });

  it("uses the newest Yahoo game key for one player across seasons", () => {
    const current = {
      player_key: "477.p.7520",
      display_position: "C",
      primary_position: "C",
    };
    expect(
      selectRelationshipYahooPosition([
        { player_key: "427.p.7520", display_position: "C,LW", primary_position: "C" },
        current,
      ]),
    ).toBe(current);
  });

  it("keeps a single name match but rejects unparseable keys among several", () => {
    const legacy = {
      player_key: "legacy",
      display_position: "C",
      primary_position: "C",
    };
    expect(selectRelationshipYahooPosition([])).toBeUndefined();
    expect(selectRelationshipYahooPosition([legacy])).toBe(legacy);
    expect(
      selectRelationshipYahooPosition([
        legacy,
        { player_key: "477.p.7520", display_position: "C", primary_position: "C" },
      ]),
    ).toBeUndefined();
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
