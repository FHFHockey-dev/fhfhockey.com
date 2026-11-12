import { describe, expect, it, vi } from "vitest";

vi.mock("lib/supabase/server", () => ({ default: {} }));

import {
  aggregateSplitGoalieGames,
  creditedStartersByGame,
  leagueSavePctFromOfficialLogs,
} from "./splitsServer";

const goalieRow = (playerId: number, gameId: number, saves: number, shots: number, toi: string) => ({
  playerId,
  gameId,
  goalsAgainst: shots - saves,
  saveShotsAgainst: `${saves}/${shots}`,
  toi,
});

const log = (goalieId: number, gameId: number, started: number, saves: number, shots: number) => ({
  goalie_id: goalieId,
  game_id: gameId,
  games_played: 1,
  games_started: started,
  saves,
  shots_against: shots,
});

describe("Splits goalie Quality Starts (decision 40)", () => {
  it("pools the league average over regular-season official appearances", () => {
    const savePct = leagueSavePctFromOfficialLogs({
      logs: [log(1, 1, 1, 9, 10), log(2, 2, 1, 89, 100), log(3, 3, 1, 0, 50)],
      regularSeasonGameIds: new Set([1, 2]),
    });
    // 98/110, not .90 and .89 averaged, and the preseason game 3 is excluded.
    expect(savePct).toBeCloseTo(98 / 110, 12);
  });

  it("uses Vollman's league-average rule instead of a fixed .910", () => {
    // 27/30 = .900 with 3 GA: below the old .910 threshold, above a .890
    // league average, so Vollman credits a Quality Start (old rule: 0).
    const result = aggregateSplitGoalieGames({
      rowsByGame: new Map([[1, [goalieRow(1, 1, 27, 30, "60:00")]]]),
      creditedStartersByGame: creditedStartersByGame([log(1, 1, 1, 27, 30)]),
      outcomeByGameId: new Map([[1, "WIN"]]),
      leagueSavePct: 0.89,
    });
    expect(result.get(1)).toMatchObject({ gamesStarted: 1, qualityStarts: 1, wins: 1, qualityStartsUnavailable: false });
  });

  it("credits the official starter, not the goalie with the longest TOI", () => {
    // The starter was pulled after 12 minutes; the reliever played 48. The old
    // longest-TOI rule gave the reliever the start, the QS and the win.
    const result = aggregateSplitGoalieGames({
      rowsByGame: new Map([[1, [goalieRow(1, 1, 5, 9, "12:00"), goalieRow(2, 1, 20, 20, "48:00")]]]),
      creditedStartersByGame: creditedStartersByGame([log(1, 1, 1, 5, 9), log(2, 1, 0, 20, 20)]),
      outcomeByGameId: new Map([[1, "WIN"]]),
      leagueSavePct: 0.9,
    });
    expect(result.get(1)).toMatchObject({ gamesStarted: 1, qualityStarts: 0, wins: 1 });
    expect(result.get(2)).toMatchObject({ gamesPlayed: 1, gamesStarted: 0, qualityStarts: 0, wins: 0 });
  });

  it("leaves QS unavailable without a credited starter or a league average", () => {
    const noStarter = aggregateSplitGoalieGames({
      rowsByGame: new Map([[1, [goalieRow(1, 1, 30, 30, "60:00")]]]),
      creditedStartersByGame: new Map(),
      outcomeByGameId: new Map([[1, "WIN"]]),
      leagueSavePct: 0.9,
    });
    expect(noStarter.get(1)).toMatchObject({ gamesStarted: 0, wins: 0, qualityStartsUnavailable: true });

    const noLeague = aggregateSplitGoalieGames({
      rowsByGame: new Map([[1, [goalieRow(1, 1, 30, 30, "60:00")]]]),
      creditedStartersByGame: creditedStartersByGame([log(1, 1, 1, 30, 30)]),
      outcomeByGameId: new Map(),
      leagueSavePct: null,
    });
    expect(noLeague.get(1)).toMatchObject({ gamesStarted: 1, qualityStarts: 0, qualityStartsUnavailable: true });
  });
});
