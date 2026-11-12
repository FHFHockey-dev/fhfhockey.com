import { describe, expect, it } from "vitest";

import {
  normalizeGoalieResponse,
  normalizeSkaterTrendResponse,
  normalizeStartChartResponse,
  normalizeSustainabilityResponse,
  normalizeTeamRatings,
  toFiniteNumber
} from "./normalizers";

describe("dashboard normalizers", () => {
  it("preserves nullish and blank numeric fields instead of coercing them to zero", () => {
    expect(toFiniteNumber(null)).toBeNull();
    expect(toFiniteNumber(undefined)).toBeNull();
    expect(toFiniteNumber("")).toBeNull();
    expect(toFiniteNumber("0")).toBe(0);
  });

  it("normalizes sustainability payloads while dropping incomplete rows", () => {
    const normalized = normalizeSustainabilityResponse({
      requested_snapshot_date: "2026-03-15",
      snapshot_date: "2026-03-14",
      serving: {
        requestedDate: "2026-03-15",
        resolvedDate: "2026-03-14",
        fallbackApplied: true,
        isSameDay: false,
        state: "fallback",
        strategy: "latest_available_with_data",
        gapDays: 1,
        severity: "warn",
        status: "fallback_recent",
        message: "Sustainability trends are using the nearest available date.",
        requestedScheduledGames: null,
        resolvedScheduledGames: null,
        requestedHadGames: null,
        resolvedHadGames: null
      },
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

    expect(normalized.requested_snapshot_date).toBe("2026-03-15");
    expect(normalized.snapshot_date).toBe("2026-03-14");
    expect(normalized.serving).toMatchObject({
      requestedDate: "2026-03-15",
      resolvedDate: "2026-03-14",
      fallbackApplied: true,
      status: "fallback_recent"
    });
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

  it("preserves serving metadata while ignoring compatibility metadata on start-chart reader payloads", () => {
    const normalized = normalizeStartChartResponse({
      dateUsed: "2026-03-15",
      requestedDate: "2026-03-16",
      fallbackApplied: true,
      serving: {
        requestedDate: "2026-03-16",
        resolvedDate: "2026-03-15",
        fallbackApplied: true,
        state: "fallback",
        strategy: "previous_date_with_games",
        gapDays: 1,
        severity: "warn",
        status: "fallback_recent",
        message:
          "Start-chart slate is serving the nearest available date (2026-03-15), 1 day behind the requested date."
      },
      scanSummary: {
        requestedDate: "2026-03-16",
        activeDataDate: "2026-03-15",
        fallbackApplied: true,
        rowCounts: {
          returned: 1
        }
      },
      compatibilityInventory: {
        canonicalReadRoute: "/api/v1/start-chart",
        retiredLegacyMaterializerRoute:
          "/api/v1/db/update-start-chart-projections",
        legacyMaterializerRemoved: true
      },
      games: [
        {
          id: 2,
          date: "2026-03-15",
          homeTeamId: 3,
          awayTeamId: 4,
          homeGoalies: [
            {
              player_id: 20,
              name: "Fallback Home Goalie",
              start_probability: 0.58
            }
          ],
          awayGoalies: [],
          homeRating: {
            offRating: 81,
            defRating: 79,
            paceRating: 80
          },
          awayRating: {}
        }
      ]
    });

    expect(normalized).toEqual({
      dateUsed: "2026-03-15",
      requestedDate: "2026-03-16",
      fallbackApplied: true,
      serving: {
        requestedDate: "2026-03-16",
        resolvedDate: "2026-03-15",
        fallbackApplied: true,
        isSameDay: false,
        state: "fallback",
        strategy: "previous_date_with_games",
        gapDays: 1,
        severity: "warn",
        status: "fallback_recent",
        message:
          "Start-chart slate is serving the nearest available date (2026-03-15), 1 day behind the requested date.",
        requestedScheduledGames: null,
        resolvedScheduledGames: null,
        requestedHadGames: null,
        resolvedHadGames: null
      },
      goalieStartBasis: null,
      games: [
        {
          id: 2,
          date: "2026-03-15",
          homeTeamId: 3,
          awayTeamId: 4,
          homeGoalies: [
            {
              player_id: 20,
              name: "Fallback Home Goalie",
              start_probability: 0.58,
              start_probability_basis: null,
              projected_gsaa_per_60: null,
              confirmed_status: null,
              percent_ownership: null
            }
          ],
          awayGoalies: [],
          homeRating: {
            offRating: 81,
            defRating: 79,
            paceRating: 80,
            trend10: null,
            ppTier: null,
            pkTier: null
          },
          awayRating: null
        }
      ]
    });
  });

  it("keeps an unknown PP/PK tier unknown instead of tier 2 (W1 P0 #13)", () => {
    const [row] = normalizeTeamRatings([
      { team_abbreviation: "UTA", date: "2026-03-14", off_rating: 101, def_rating: 99,
        pace_rating: 100, pp_tier: null, pk_tier: 3, trend10: 0 }
    ]);
    expect(row.ppTier).toBeNull();
    expect(row.pkTier).toBe(3);
  });

  it("normalizes goalie projections with starter-selection detail", () => {
    const normalized = normalizeGoalieResponse({
      asOfDate: "2026-03-14",
      requestedDate: "2026-03-14",
      fallbackApplied: false,
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
    expect(normalized.requestedDate).toBe("2026-03-14");
    expect(normalized.fallbackApplied).toBe(false);
    expect(normalized.serving).toBeNull();
    expect(normalized.data).toHaveLength(1);
    expect(normalized.data[0].starter_selection).toMatchObject({
      is_back_to_back: false,
      opponent_is_weak: true,
      days_since_last_played: 2,
      l10_starts: 7,
      opponent_context_adjustment_pct: -0.042
    });
  });

  it("carries the Start Chart goalie start basis onto every goalie (W1 P0 #17)", () => {
    const game = { id: 1, date: "2026-03-14", homeTeamId: 1, awayTeamId: 2,
      homeGoalies: [{ player_id: 10, name: "Home Goalie", start_probability: 0.7 }],
      awayGoalies: [{ player_id: 11, name: "Away Goalie", start_probability: 0.6 }] };
    const legacy = normalizeStartChartResponse({ dateUsed: "2026-03-14", goalieStartBasis: "l10_start_share", games: [game] });
    expect(legacy.goalieStartBasis).toBe("l10_start_share");
    expect([legacy.games[0].homeGoalies[0].start_probability_basis, legacy.games[0].awayGoalies[0].start_probability_basis])
      .toEqual(["l10_start_share", "l10_start_share"]);
    const unlabelled = normalizeStartChartResponse({ dateUsed: "2026-03-14", games: [game] });
    expect(unlabelled.goalieStartBasis).toBeNull();
    expect(unlabelled.games[0].homeGoalies[0].start_probability_basis).toBeNull();
  });

  it("keeps each candidate goalie's own Win apart from the team win (decision 25)", () => {
    const normalized = normalizeGoalieResponse({ data: [
      { goalie_id: 1, goalie_name: "Starter", row_basis: "candidate_goalie_game", is_projected_starter: true,
        starter_probability: 0.62, proj_win_prob: 0.42, team_win_prob: 0.45, unconditional: { credited_win_prob: 0.27 } },
      { goalie_id: 2, goalie_name: "Backup", row_basis: "candidate_goalie_game", is_projected_starter: false,
        starter_probability: 0.38, proj_win_prob: 0.33, team_win_prob: 0.45, unconditional: { credited_win_prob: 0.13 } },
      { goalie_id: 3, goalie_name: "Old slot", row_basis: "team_goalie_slot_legacy", starter_probability: 0.6,
        proj_win_prob: null, team_win_prob: null, unconditional: null },
    ] });
    expect(normalized.data.map((row) => [row.goalie_id, row.row_basis, row.is_projected_starter, row.proj_win_prob,
      row.team_win_prob, row.unconditional_win_prob])).toEqual([
      [1, "candidate_goalie_game", true, 0.42, 0.45, 0.27],
      [2, "candidate_goalie_game", false, 0.33, 0.45, 0.13],
      [3, "team_goalie_slot_legacy", null, null, null, null],
    ]);
  });

  it("normalizes skater trend serving metadata for degraded fallback scope", () => {
    const normalized = normalizeSkaterTrendResponse({
      generatedAt: "2026-03-29T12:00:00.000Z",
      requestedDate: "2026-03-29",
      dateUsed: "2026-03-11",
      fallbackApplied: true,
      serving: {
        requestedDate: "2026-03-29",
        resolvedDate: "2026-03-11",
        fallbackApplied: true,
        isSameDay: false,
        state: "fallback",
        strategy: "latest_available_with_data",
        gapDays: 18,
        severity: "error",
        status: "blocked",
        message:
          "Trend movement fallback is materially stale: requested 2026-03-29, but latest available scope is 2026-03-11 (18 days old). Treat this module as degraded until fresher trend rows exist."
      },
      categories: {},
      playerMetadata: {}
    });

    expect(normalized).toMatchObject({
      generatedAt: "2026-03-29T12:00:00.000Z",
      requestedDate: "2026-03-29",
      dateUsed: "2026-03-11",
      fallbackApplied: true,
      serving: {
        requestedDate: "2026-03-29",
        resolvedDate: "2026-03-11",
        fallbackApplied: true,
        state: "fallback",
        strategy: "latest_available_with_data",
        gapDays: 18,
        severity: "error",
        status: "blocked"
      }
    });
  });
});
