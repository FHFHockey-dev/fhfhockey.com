import { describe, expect, it, vi } from "vitest";

import {
  assertCompletePlayerGameStatsBatches,
  assertCompletePlayerGameStatsSource,
  assertCompleteTeamGameStatsSource,
  assertMatchingGameIdentity,
  GameIdentityMismatchError,
  getGameStatsCompletenessFailureDetails,
  persistTeamGameStatsBatch,
  PlayerGameStatsSourceError,
  TeamGameStatsError,
  type TeamGameStatsRow,
} from "lib/cron/gameStatsCompleteness";

const gameId = 2025020001;

const completeTeamStats = [
  { category: "sog", awayValue: 31, homeValue: 29 },
  { category: "faceoffWinningPctg", awayValue: 0.48, homeValue: 0.52 },
  { category: "powerPlay", awayValue: "1/3", homeValue: "0/2" },
  { category: "powerPlayPctg", awayValue: 0.333333, homeValue: 0 },
  { category: "pim", awayValue: 4, homeValue: 6 },
  { category: "hits", awayValue: 12, homeValue: 15 },
  { category: "blockedShots", awayValue: 14, homeValue: 11 },
  { category: "giveaways", awayValue: 7, homeValue: 8 },
  { category: "takeaways", awayValue: 5, homeValue: 6 },
];

const teamRows: TeamGameStatsRow[] = [
  {
    gameId,
    teamId: 1,
    score: 3,
    sog: 29,
    faceoffPctg: 0.52,
    pim: 6,
    hits: 15,
    blockedShots: 11,
    giveaways: 8,
    takeaways: 6,
    powerPlay: "0/2",
    powerPlayConversion: "0",
    powerPlayToi: "04:00",
  },
  {
    gameId,
    teamId: 2,
    score: 4,
    sog: 31,
    faceoffPctg: 0.48,
    pim: 4,
    hits: 12,
    blockedShots: 14,
    giveaways: 7,
    takeaways: 5,
    powerPlay: "1/3",
    powerPlayConversion: "0.333333",
    powerPlayToi: "05:21",
  },
];

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error("Expected promise to reject, but it resolved.");
}

describe("team game-stat completeness", () => {
  it("accepts the complete nine-category source contract", () => {
    expect(() =>
      assertCompleteTeamGameStatsSource({
        gameId,
        teamGameStats: completeTeamStats,
        teamIds: [1, 2],
      }),
    ).not.toThrow();
  });

  it("rejects missing and invalid categories with bounded diagnostics", () => {
    const incomplete = completeTeamStats
      .filter((stat) => stat.category !== "takeaways")
      .map((stat) =>
        stat.category === "sog" ? { ...stat, homeValue: "" } : stat,
      );

    let error: unknown;
    try {
      assertCompleteTeamGameStatsSource({
        gameId,
        teamGameStats: incomplete,
        teamIds: [1, 2],
      });
    } catch (caught) {
      error = caught;
    }
    if (!error) throw new Error("Expected source validation to throw.");

    expect(error).toBeInstanceOf(TeamGameStatsError);
    expect(getGameStatsCompletenessFailureDetails(error)).toMatchObject({
      kind: "team_game_stats_failure",
      code: "TEAM_GAME_STATS_FAILED",
      phase: "source_validation",
      gameId,
      requestedRows: 2,
      teamIds: [1, 2],
      missingCategories: ["takeaways"],
      invalidCategories: ["sog"],
    });
  });

  it("rejects a returned Supabase upsert error instead of resolving", async () => {
    const upsert = vi.fn().mockResolvedValue({
      error: {
        code: "42501",
        message:
          "team stats denied at https://example.test/private Bearer sensitive-token\ncontinued",
      },
    });
    const supabase = {
      from: vi.fn(() => ({ upsert })),
    } as any;

    const error = await captureRejection(
      persistTeamGameStatsBatch({
        supabase,
        rows: teamRows,
        gameId,
        sourceStatCount: completeTeamStats.length,
      }),
    );

    expect(error).toBeInstanceOf(TeamGameStatsError);
    expect(getGameStatsCompletenessFailureDetails(error)).toMatchObject({
      kind: "team_game_stats_failure",
      phase: "upsert",
      gameId,
      requestedRows: 2,
      teamIds: [1, 2],
      terminalError: {
        code: "42501",
        message:
          "team stats denied at [redacted-url] Bearer [redacted] continued",
      },
    });
    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledWith(teamRows);
  });
});

describe("game identity completeness", () => {
  it("rejects a requested/landing ID mismatch with bounded structured details", () => {
    let error: unknown;
    try {
      assertMatchingGameIdentity({
        requestedGameId: gameId,
        landingGameId: gameId + 1,
      });
    } catch (caught) {
      error = caught;
    }
    if (!error) throw new Error("Expected identity validation to throw.");

    expect(error).toBeInstanceOf(GameIdentityMismatchError);
    expect(getGameStatsCompletenessFailureDetails(error)).toMatchObject({
      kind: "game_identity_mismatch",
      code: "GAME_IDENTITY_MISMATCH",
      gameId,
      requestedRows: 1,
      requestedGameId: gameId,
      landingGameId: gameId + 1,
    });
  });
});

describe("player game-stat source completeness", () => {
  it("rejects missing playerByGameStats before an empty write can succeed", () => {
    let error: unknown;
    try {
      assertCompletePlayerGameStatsSource({ gameId, boxscore: {} });
    } catch (caught) {
      error = caught;
    }
    if (!error) throw new Error("Expected source validation to throw.");

    expect(error).toBeInstanceOf(PlayerGameStatsSourceError);
    expect(getGameStatsCompletenessFailureDetails(error)).toMatchObject({
      kind: "player_game_stats_source_failure",
      code: "PLAYER_GAME_STATS_SOURCE_INCOMPLETE",
      phase: "source_validation",
      gameId,
      skaterRows: 0,
      goalieRows: 0,
      missingBatches: ["skaters", "goalies"],
    });
  });

  it("rejects an empty processed goalie batch", () => {
    expect(() =>
      assertCompletePlayerGameStatsBatches({
        gameId,
        skaters: [{ playerId: 1, gameId }],
        goalies: [],
      }),
    ).toThrow(PlayerGameStatsSourceError);
  });
});
