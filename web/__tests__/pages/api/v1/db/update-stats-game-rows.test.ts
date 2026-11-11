import { describe, expect, it } from "vitest";

import { getPlayersGameStats } from "../../../../../pages/api/v1/db/update-stats/[gameId]";

const skater = (playerId: number, position: string) => ({
  playerId,
  sweaterNumber: 1,
  name: { default: "Test" },
  position,
  goals: 0,
  assists: 0,
  points: 0,
  plusMinus: 0,
  pim: 0,
  hits: 0,
  powerPlayGoals: 0,
  sog: 0,
  faceoffWinningPctg: 0,
  toi: "15:00",
  blockedShots: 0,
  shifts: 20,
  giveaways: 0,
  takeaways: 0,
});

describe("update-stats skater rows (decision 83)", () => {
  it("stores null, not 0/0 or 00:00 placeholders, for faceoffs and PP/SH TOI the boxscore lacks", () => {
    const { skaters } = getPlayersGameStats(
      {
        playerByGameStats: {
          homeTeam: { forwards: [skater(1, "C")], defense: [skater(2, "D")], goalies: [] },
          awayTeam: { forwards: [], defense: [], goalies: [] },
        },
      },
      2025020001,
      {},
      {},
      {}
    );

    expect(skaters).toHaveLength(2);
    for (const row of skaters) {
      expect(row.faceoffs).toBeNull();
      expect(row.powerPlayToi).toBeNull();
      expect(row.shorthandedToi).toBeNull();
      // Values the boxscore does carry are kept.
      expect(row.toi).toBe("15:00");
    }
  });
});
