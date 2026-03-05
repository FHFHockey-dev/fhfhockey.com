import { describe, expect, it } from "vitest";

import {
  normalizeGoalieResponse,
  normalizeSkaterMoversResponse,
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

describe("Dashboard Endpoint Contracts", () => {
  it("validates /api/team-ratings contract", () => {
    const payload = [
      {
        team_abbreviation: "BOS",
        date: "2026-03-04",
        off_rating: 105.2,
        def_rating: 97.7,
        pace_rating: 101.4,
        pp_tier: 1,
        pk_tier: 2,
        trend10: 1.6
      }
    ];

    const normalized = normalizeTeamRatings(payload);
    const audit = auditTeamRatings(normalized);

    expect(normalized.length).toBe(1);
    expect(audit.ok).toBe(true);
    expect(audit.issues).toHaveLength(0);
  });

  it("validates /api/v1/trends/team-power contract", () => {
    const payload = {
      seasonId: 20252026,
      generatedAt: "2026-03-04T16:00:00.000Z",
      categories: {
        offense: {
          series: {
            BOS: [
              { gp: 1, percentile: 62 },
              { gp: 2, percentile: 66 }
            ]
          },
          rankings: [
            {
              team: "BOS",
              percentile: 66,
              gp: 2,
              rank: 1,
              previousRank: 2,
              delta: 1
            }
          ]
        }
      }
    };

    expect(typeof payload.seasonId).toBe("number");
    expect(typeof payload.generatedAt).toBe("string");
    expect(payload.categories).toBeTypeOf("object");
  });

  it("validates /api/v1/trends/skater-power contract", () => {
    const payload = {
      seasonId: 20252026,
      generatedAt: "2026-03-04T16:00:00.000Z",
      categories: {
        shotsPer60: {
          rankings: [
            { playerId: 8478402, delta: 3.1 },
            { playerId: 8480801, delta: -2.3 }
          ]
        }
      },
      playerMetadata: {
        "8478402": {
          fullName: "Sample Skater",
          imageUrl: null
        }
      }
    };

    const normalized = normalizeSkaterMoversResponse(payload);
    expect(normalized.rankings.length).toBe(2);
    expect(normalized.playerMetadata["8478402"].fullName).toBe(
      "Sample Skater"
    );
    expect(typeof normalized.generatedAt).toBe("string");
  });

  it("validates /api/v1/sustainability/trend-bands contract", () => {
    const payload = {
      success: true,
      rows: [
        {
          player_id: 8478402,
          season_id: 20252026,
          snapshot_date: "2026-03-04",
          metric_key: "sh_pct",
          window_code: "l10",
          baseline: 0.11,
          ewma: 0.14,
          value: 0.13,
          ci_lower: 0.08,
          ci_upper: 0.17,
          n_eff: 8.2,
          prior_weight: 0.42,
          z_score: 1.8,
          percentile: 88.4,
          exposure: 1.0
        }
      ]
    };

    expect(payload.success).toBe(true);
    expect(Array.isArray(payload.rows)).toBe(true);
    expect(payload.rows[0]).toMatchObject({
      player_id: expect.any(Number),
      snapshot_date: expect.any(String),
      metric_key: expect.any(String),
      window_code: expect.any(String),
      value: expect.any(Number),
      ci_lower: expect.any(Number),
      ci_upper: expect.any(Number)
    });
  });

  it("validates /api/v1/start-chart contract", () => {
    const payload = {
      dateUsed: "2026-03-04",
      games: [
        {
          id: 123,
          homeTeamId: 1,
          awayTeamId: 2,
          homeGoalies: [
            { player_id: 9001, name: "Home G", start_probability: 0.72 }
          ],
          awayGoalies: [
            { player_id: 9002, name: "Away G", start_probability: 0.28 }
          ]
        }
      ]
    };

    const normalized = normalizeStartChartResponse(payload);
    const audit = auditStartChartGames(normalized.games);

    expect(normalized.dateUsed).toBe("2026-03-04");
    expect(audit.ok).toBe(true);
  });

  it("validates /api/v1/forge/goalies contract", () => {
    const payload = {
      asOfDate: "2026-03-04",
      data: [
        {
          goalie_id: 9003,
          goalie_name: "Goalie A",
          team_abbreviation: "NJD",
          team_name: "Devils",
          opponent_team_abbreviation: "NYI",
          opponent_team_name: "Islanders",
          starter_probability: 0.68,
          proj_win_prob: 0.54,
          proj_shutout_prob: 0.05,
          volatility_index: 1.1,
          blowup_risk: 0.24
        }
      ]
    };

    const normalized = normalizeGoalieResponse(payload);
    const audit = auditGoalieRows(normalized.data);

    expect(normalized.asOfDate).toBe("2026-03-04");
    expect(audit.ok).toBe(true);
  });

  it("validates /api/v1/sustainability/trends contract used by dashboard", () => {
    const payload = {
      success: true,
      snapshot_date: "2026-03-04",
      rows: [
        {
          player_id: 8478402,
          player_name: "Skater A",
          position_group: "F",
          position_code: "C",
          window_code: "l10",
          s_100: 72.4,
          luck_pressure: 0.88
        }
      ]
    };

    const normalized = normalizeSustainabilityResponse(payload);
    const audit = auditSustainabilityRows(normalized.rows);

    expect(normalized.snapshot_date).toBe("2026-03-04");
    expect(audit.ok).toBe(true);
  });
});
