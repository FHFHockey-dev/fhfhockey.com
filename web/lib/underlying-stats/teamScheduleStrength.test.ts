import { describe, expect, it } from "vitest";
import {
  computeUnderlyingStatsScheduleTexture,
  computePointPctFromRecord,
  computeUnderlyingStatsTeamScheduleStrength
} from "./teamScheduleStrength";
describe("computePointPctFromRecord", () => {
  it("respects overtime-loss standings value", () => {
    expect(computePointPctFromRecord(7, 3, 0)).toBeCloseTo(0.7, 5);
    expect(computePointPctFromRecord(7, 2, 1)).toBeCloseTo(0.75, 5);
  });

  it("returns null when no games are present", () => {
    expect(computePointPctFromRecord(0, 0, 0)).toBeNull();
  });
});

describe("computeUnderlyingStatsTeamScheduleStrength", () => {
  it("computes standings, predictive, and blended sos scores from snapshot inputs", () => {
    const result = computeUnderlyingStatsTeamScheduleStrength({
      date: "2026-04-05",
      scheduleRows: [
        {
          game_date: "2026-04-05",
          team_abbrev: "TOR",
          past_opponent_total_wins: 7,
          past_opponent_total_losses: 3,
          past_opponent_total_ot_losses: 0,
          past_opponents: [
            { opponent: "BOS", date: "2026-03-01" },
            { opponent: "BOS", date: "2026-03-10" },
            { opponent: "MTL", date: "2026-03-20" }
          ]
        },
        {
          game_date: "2026-04-05",
          team_abbrev: "BOS",
          past_opponent_total_wins: 5,
          past_opponent_total_losses: 5,
          past_opponent_total_ot_losses: 0,
          past_opponents: [
            { opponent: "TOR", date: "2026-03-01" },
            { opponent: "MTL", date: "2026-03-10" },
            { opponent: "MTL", date: "2026-03-20" }
          ]
        },
        {
          game_date: "2026-04-05",
          team_abbrev: "MTL",
          past_opponent_total_wins: 3,
          past_opponent_total_losses: 7,
          past_opponent_total_ot_losses: 0,
          past_opponents: [
            { opponent: "TOR", date: "2026-03-01" },
            { opponent: "TOR", date: "2026-03-10" },
            { opponent: "BOS", date: "2026-03-20" }
          ]
        }
      ]
    });

    expect(result.get("TOR")).toMatchObject({
      past: {
        directOpponentPointPct: 0.7,
        indirectOpponentPointPct: 0.43333333333333335,
        opponentGamesPlayed: 3,
        rank: 1,
        sos: 0.611111111111111,
        uniqueOpponents: 2
      }
    });
    expect(result.get("BOS")?.past.rank).toBe(2);
    expect(result.get("MTL")?.past.rank).toBe(3);
  });

  it("falls back to neutral scores when schedule history is missing", () => {
    const result = computeUnderlyingStatsTeamScheduleStrength({
      date: "2026-04-05",
      scheduleRows: [
        {
          game_date: "2026-04-05",
          team_abbrev: "SEA",
          past_opponent_total_wins: 0,
          past_opponent_total_losses: 0,
          past_opponent_total_ot_losses: 0,
          past_opponents: []
        }
      ]
    });

    expect(result.get("SEA")).toMatchObject({
      future: {
        directOpponentPointPct: null,
        indirectOpponentPointPct: null,
        opponentGamesPlayed: 0,
        rank: null,
        sos: null,
        uniqueOpponents: 0
      },
      past: {
        directOpponentPointPct: null,
        indirectOpponentPointPct: null,
        opponentGamesPlayed: 0,
        rank: null,
        sos: null,
        uniqueOpponents: 0
      },
      sos: null
    });
  });

  it("computes future schedule texture from upcoming games", () => {
    const result = computeUnderlyingStatsScheduleTexture({
      date: "2026-04-05",
      games: [
        { date: "2026-04-04", homeTeamId: 10, awayTeamId: 6 },
        { date: "2026-04-06", homeTeamId: 10, awayTeamId: 6 },
        { date: "2026-04-07", homeTeamId: 8, awayTeamId: 10 },
        { date: "2026-04-09", homeTeamId: 10, awayTeamId: 3 },
        { date: "2026-04-10", homeTeamId: 3, awayTeamId: 10 },
        { date: "2026-04-15", homeTeamId: 10, awayTeamId: 5 },
        { date: "2026-04-05", homeTeamId: 6, awayTeamId: 8 },
        { date: "2026-04-08", homeTeamId: 6, awayTeamId: 3 },
        { date: "2026-04-08", homeTeamId: 3, awayTeamId: 5 },
        { date: "2026-04-14", homeTeamId: 5, awayTeamId: 10 }
      ]
    });

    expect(result.get("TOR")).toMatchObject({
      backToBacksNext14: 3,
      gamesNext14: 6,
      gamesNext7: 4,
      homeGamesNext14: 3,
      restAdvantageGamesNext14: 2,
      restDisadvantageGamesNext14: 2,
      roadGamesNext14: 3,
      threeInFourNext14: 2
    });
  });
});
