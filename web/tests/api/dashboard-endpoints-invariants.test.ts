import { describe, expect, it } from "vitest";

import {
  normalizeGoalieResponse,
  normalizeStartChartResponse,
  normalizeSustainabilityResponse,
  normalizeTeamRatings
} from "lib/dashboard/normalizers";
import {
  auditGoalieRows,
  auditStartChartGames,
  auditSustainabilityRows,
  auditTeamRatings
} from "lib/dashboard/invariants";

describe("Dashboard Endpoint Invariant Guards", () => {
  it("enforces probability bounds for goalie and start-chart payloads", () => {
    const goalieAudit = auditGoalieRows(
      normalizeGoalieResponse({
        asOfDate: "2026-03-04",
        data: [
          {
            goalie_id: 1,
            goalie_name: "Valid Goalie",
            starter_probability: 1.1,
            proj_win_prob: 0.4,
            proj_shutout_prob: 0.02,
            blowup_risk: -0.2
          }
        ]
      }).data
    );

    const startChartAudit = auditStartChartGames(
      normalizeStartChartResponse({
        dateUsed: "2026-03-04",
        games: [
          {
            id: 22,
            homeTeamId: 4,
            awayTeamId: 5,
            homeGoalies: [
              {
                player_id: 10,
                name: "Home",
                start_probability: 1.2
              }
            ],
            awayGoalies: [
              {
                player_id: 11,
                name: "Away",
                start_probability: -0.1
              }
            ]
          }
        ]
      }).games
    );

    expect(goalieAudit.ok).toBe(false);
    expect(goalieAudit.issues.some((msg) => msg.includes("starter_probability"))).toBe(
      true
    );
    expect(startChartAudit.ok).toBe(false);
    expect(
      startChartAudit.issues.some((msg) => msg.includes("start_probability"))
    ).toBe(true);
  });

  it("enforces required-field presence for normalized team ratings", () => {
    const normalized = normalizeTeamRatings([
      {
        team_abbreviation: "BOS",
        // missing date on purpose
        off_rating: 103,
        def_rating: 97,
        pace_rating: 100,
        pp_tier: 1,
        pk_tier: 2
      },
      {
        team_abbreviation: "NJD",
        date: "2026-03-04",
        off_rating: 101,
        def_rating: 99,
        pace_rating: 100,
        pp_tier: 2,
        pk_tier: 2
      }
    ]);

    expect(normalized.length).toBe(1);
    const audit = auditTeamRatings(normalized);
    expect(audit.ok).toBe(true);
  });

  it("maintains stable normalized type shape for sustainability rows", () => {
    const normalized = normalizeSustainabilityResponse({
      success: true,
      snapshot_date: "2026-03-04",
      rows: [
        {
          player_id: "8478402",
          player_name: "Skater",
          position_group: "F",
          position_code: "C",
          window_code: "l10",
          s_100: "73.5",
          luck_pressure: "0.81"
        }
      ]
    });

    expect(normalized.snapshot_date).toBe("2026-03-04");
    expect(normalized.rows[0]).toEqual({
      player_id: 8478402,
      player_name: "Skater",
      position_group: "F",
      position_code: "C",
      window_code: "l10",
      s_100: 73.5,
      luck_pressure: 0.81,
      z_shp: null,
      z_oishp: null,
      z_ipp: null,
      z_ppshp: null
    });

    const audit = auditSustainabilityRows(normalized.rows);
    expect(audit.ok).toBe(true);
  });
});
