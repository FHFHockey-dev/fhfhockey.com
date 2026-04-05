import { describe, expect, it } from "vitest";
import {
  computePointPctFromRecord,
  computeUnderlyingStatsTeamScheduleStrength
} from "./teamScheduleStrength";
import type { TeamRating } from "../teamRatingsService";

const buildRating = (
  teamAbbr: string,
  offRating: number,
  defRating: number,
  paceRating: number
): TeamRating => ({
  teamAbbr,
  date: "2026-04-05",
  offRating,
  defRating,
  paceRating,
  ppTier: 2,
  pkTier: 2,
  trend10: 0,
  components: {
    xgf60: 0,
    gf60: 0,
    sf60: 0,
    xga60: 0,
    ga60: 0,
    sa60: 0,
    pace60: 0
  },
  finishingRating: null,
  goalieRating: null,
  dangerRating: null,
  specialRating: null,
  disciplineRating: null,
  varianceFlag: null
});

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
    const ratings = [
      buildRating("TOR", 110, 110, 110),
      buildRating("BOS", 100, 100, 100),
      buildRating("MTL", 90, 90, 90)
    ];

    const result = computeUnderlyingStatsTeamScheduleStrength({
      date: "2026-04-05",
      ratings,
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
      directOpponentPointPct: 0.7,
      opponentScheduleContext: 0.43333333333333335,
      standingsRaw: 0.6333333333333333,
      predictiveRaw: 99.66666666666667,
      opponentGamesPlayed: 3,
      uniqueOpponents: 2
    });
    expect(result.get("TOR")?.standingsComponentScore).toBe(119.47);
    expect(result.get("TOR")?.predictiveComponentScore).toBe(89.39);
    expect(result.get("TOR")?.sos).toBe(104.43);

    expect(result.get("BOS")?.sos).toBe(93.48);
    expect(result.get("MTL")?.sos).toBe(102.09);
  });

  it("falls back to neutral scores when schedule history is missing", () => {
    const result = computeUnderlyingStatsTeamScheduleStrength({
      date: "2026-04-05",
      ratings: [buildRating("SEA", 100, 100, 100)],
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
      standingsComponentScore: 100,
      predictiveComponentScore: 100,
      sos: 100,
      directOpponentPointPct: null,
      opponentScheduleContext: null,
      standingsRaw: null,
      predictiveRaw: null,
      opponentGamesPlayed: 0,
      uniqueOpponents: 0
    });
  });
});
