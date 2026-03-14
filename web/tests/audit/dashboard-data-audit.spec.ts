import { describe, expect, it } from "vitest";

import {
  auditCtpiRows,
  auditGoalieRows,
  auditStartChartGames,
  auditSustainabilityRows,
  auditTeamRatings
} from "lib/dashboard/invariants";

describe("Dashboard Data Audit Invariants", () => {
  it("accepts valid team ratings payload shape", () => {
    const result = auditTeamRatings([
      {
        team_abbreviation: "NJD",
        date: "2026-03-04",
        off_rating: 102.3,
        def_rating: 98.9,
        pace_rating: 101.1,
        pp_tier: 1,
        pk_tier: 2
      }
    ]);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("rejects invalid probability bounds in goalie payload", () => {
    const result = auditGoalieRows([
      {
        goalie_id: 42,
        goalie_name: "Sample Goalie",
        starter_probability: 1.2,
        proj_win_prob: -0.1,
        proj_shutout_prob: 0.03,
        blowup_risk: 0.5
      }
    ]);
    expect(result.ok).toBe(false);
    expect(result.issues.some((msg) => msg.includes("starter_probability"))).toBe(
      true
    );
    expect(result.issues.some((msg) => msg.includes("proj_win_prob"))).toBe(true);
  });

  it("enforces s_100 bounds on sustainability rows", () => {
    const result = auditSustainabilityRows([
      {
        player_id: 123,
        s_100: 140,
        luck_pressure: 1.2
      }
    ]);
    expect(result.ok).toBe(false);
    expect(result.issues.some((msg) => msg.includes("s_100 out of range"))).toBe(
      true
    );
  });

  it("checks ctpi score range and required keys", () => {
    const result = auditCtpiRows([
      {
        team: "TOR",
        ctpi_0_to_100: 64.1
      },
      {
        team: "",
        ctpi_0_to_100: 120
      }
    ]);
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("validates start-chart game contract and goalie probabilities", () => {
    const result = auditStartChartGames([
      {
        id: 1,
        homeTeamId: 3,
        awayTeamId: 5,
        homeGoalies: [
          { player_id: 12, name: "Home Goalie", start_probability: 0.74 }
        ],
        awayGoalies: [
          { player_id: 99, name: "Away Goalie", start_probability: 0.26 }
        ]
      }
    ]);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});

