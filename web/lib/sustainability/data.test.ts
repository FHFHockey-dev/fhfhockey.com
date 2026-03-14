import { describe, expect, it } from "vitest";

import {
  mergeUpcomingOpponents,
  mapOpponentStrengthRecord,
  mapUpcomingGamesForTeam
} from "./data";

describe("mapUpcomingGamesForTeam", () => {
  it("maps future games into opponent-aware schedule rows", () => {
    const rows = mapUpcomingGamesForTeam(10, [
      {
        id: 2,
        date: "2026-03-12T00:00:00Z",
        homeTeamId: 11,
        awayTeamId: 10
      },
      {
        id: 1,
        date: "2026-03-10",
        homeTeamId: 10,
        awayTeamId: 12
      }
    ]);

    expect(rows).toEqual([
      {
        gameId: 1,
        gameDate: "2026-03-10",
        teamId: 10,
        opponentTeamId: 12,
        isHome: true
      },
      {
        gameId: 2,
        gameDate: "2026-03-12",
        teamId: 10,
        opponentTeamId: 11,
        isHome: false
      }
    ]);
  });
});

describe("mapOpponentStrengthRecord", () => {
  it("converts NST totals into per-60 opponent context", () => {
    const row = mapOpponentStrengthRecord(
      {
        team_abbreviation: "CAR",
        date: "2026-03-09",
        gp: 60,
        toi: 3600,
        xga: 120,
        ca: 3000,
        sca: 1200,
        hdca: 420,
        sv_pct: 0.917
      },
      "nst_team_all",
      1
    );

    expect(row).toEqual({
      teamAbbreviation: "CAR",
      source: "nst_team_all",
      sourceDate: "2026-03-09",
      gamesPlayed: 60,
      xgaPer60: 2,
      caPer60: 50,
      scaPer60: 20,
      hdcaPer60: 7,
      svPct: 0.917,
      pkTier: 1
    });
  });
});

describe("mergeUpcomingOpponents", () => {
  it("joins upcoming games to opponent abbreviations and strength rows", () => {
    const rows = mergeUpcomingOpponents(
      [
        {
          gameId: 1,
          gameDate: "2026-03-10",
          teamId: 10,
          opponentTeamId: 12,
          isHome: true
        }
      ],
      { 12: "CAR" },
      {
        CAR: {
          teamAbbreviation: "CAR",
          source: "nst_team_all",
          sourceDate: "2026-03-09",
          gamesPlayed: 60,
          xgaPer60: 2,
          caPer60: 50,
          scaPer60: 20,
          hdcaPer60: 7,
          svPct: 0.917,
          pkTier: 1
        }
      }
    );

    expect(rows[0]).toEqual({
      gameId: 1,
      gameDate: "2026-03-10",
      teamId: 10,
      opponentTeamId: 12,
      isHome: true,
      opponentTeamAbbreviation: "CAR",
      opponentStrength: {
        teamAbbreviation: "CAR",
        source: "nst_team_all",
        sourceDate: "2026-03-09",
        gamesPlayed: 60,
        xgaPer60: 2,
        caPer60: 50,
        scaPer60: 20,
        hdcaPer60: 7,
        svPct: 0.917,
        pkTier: 1
      }
    });
  });
});
