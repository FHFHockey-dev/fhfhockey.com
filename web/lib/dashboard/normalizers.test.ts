import { describe, expect, it } from "vitest";

import {
  normalizeGoalieResponse,
  normalizeStartChartResponse,
  normalizeSustainabilityResponse
} from "./normalizers";

describe("dashboard normalizers", () => {
  it("normalizes sustainability payloads while dropping incomplete rows", () => {
    const normalized = normalizeSustainabilityResponse({
      snapshot_date: "2026-03-14",
      rows: [
        {
          player_id: 12,
          player_name: "Trustworthy Skater",
          position_group: "F",
          position_code: "C",
          window_code: "l10",
          s_100: 71.4,
          luck_pressure: -1.1,
          z_shp: -0.2
        },
        {
          player_id: null,
          player_name: "Broken Row",
          s_100: 50
        }
      ]
    });

    expect(normalized.snapshot_date).toBe("2026-03-14");
    expect(normalized.rows).toHaveLength(1);
    expect(normalized.rows[0]).toMatchObject({
      player_id: 12,
      player_name: "Trustworthy Skater",
      position_group: "F",
      position_code: "C",
      window_code: "l10",
      s_100: 71.4,
      luck_pressure: -1.1,
      z_shp: -0.2
    });
  });

  it("normalizes start-chart games with goalie and rating payloads", () => {
    const normalized = normalizeStartChartResponse({
      dateUsed: "2026-03-14",
      games: [
        {
          id: 1,
          date: "2026-03-14",
          homeTeamId: 1,
          awayTeamId: 2,
          homeGoalies: [
            {
              player_id: 10,
              name: "Home Goalie",
              start_probability: 0.71,
              confirmed_status: true
            }
          ],
          awayGoalies: [
            {
              player_id: 11,
              name: "Away Goalie",
              start_probability: 0.63,
              projected_gsaa_per_60: 0.15
            }
          ],
          homeRating: {
            offRating: 84,
            defRating: 81,
            paceRating: 79,
            trend10: 1.4,
            ppTier: 1,
            pkTier: 2
          },
          awayRating: {
            off_rating: 78,
            def_rating: 76,
            pace_rating: 77,
            trend10: -0.4,
            pp_tier: 2,
            pk_tier: 2
          }
        }
      ]
    });

    expect(normalized.dateUsed).toBe("2026-03-14");
    expect(normalized.games).toHaveLength(1);
    expect(normalized.games[0].homeGoalies[0]).toMatchObject({
      player_id: 10,
      name: "Home Goalie",
      start_probability: 0.71,
      confirmed_status: true
    });
    expect(normalized.games[0].awayRating).toMatchObject({
      offRating: 78,
      defRating: 76,
      paceRating: 77,
      trend10: -0.4,
      ppTier: 2,
      pkTier: 2
    });
  });

  it("normalizes goalie projections with starter-selection detail", () => {
    const normalized = normalizeGoalieResponse({
      asOfDate: "2026-03-14",
      data: [
        {
          goalie_id: 8474593,
          goalie_name: "Jacob Markstrom",
          team_abbreviation: "NJD",
          team_name: "New Jersey Devils",
          opponent_team_abbreviation: "NYI",
          opponent_team_name: "New York Islanders",
          starter_probability: 0.61,
          proj_win_prob: 0.53,
          proj_shutout_prob: 0.05,
          modeled_save_pct: 0.918,
          volatility_index: 1.18,
          blowup_risk: 0.22,
          confidence_tier: "HIGH",
          recommendation: "Start",
          uncertainty: {
            model: {
              starter_selection: {
                model_context: {
                  is_back_to_back: false,
                  opponent_is_weak: true
                },
                opponent_offense_context: {
                  context_adjustment_pct: -0.042
                },
                candidate_goalies: [
                  {
                    goalie_id: 8474593,
                    days_since_last_played: 2,
                    l10_starts: 7
                  }
                ]
              }
            }
          }
        }
      ]
    });

    expect(normalized.asOfDate).toBe("2026-03-14");
    expect(normalized.data).toHaveLength(1);
    expect(normalized.data[0].starter_selection).toMatchObject({
      is_back_to_back: false,
      opponent_is_weak: true,
      days_since_last_played: 2,
      l10_starts: 7,
      opponent_context_adjustment_pct: -0.042
    });
  });
});
