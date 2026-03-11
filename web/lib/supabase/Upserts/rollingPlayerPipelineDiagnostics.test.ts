import { describe, expect, it } from "vitest";
import {
  summarizeCoverage,
  summarizeDerivedWindowDiagnostics,
  summarizeSourceTailFreshness,
  summarizeSuspiciousOutputs
} from "./rollingPlayerPipelineDiagnostics";

describe("summarizeCoverage", () => {
  it("flags missing all-strength source dates and PP builder row/share/unit gaps", () => {
    const result = summarizeCoverage({
      playerId: 1,
      strength: "all",
      wgoRows: [
        { date: "2025-10-01", game_id: 10, pp_toi: 120 },
        { date: "2025-10-03", game_id: 11, pp_toi: 0 },
        { date: "2025-10-05", game_id: 12, pp_toi: 90 }
      ],
      countsRows: [{ date_scraped: "2025-10-01" }],
      ratesRows: [
        { date_scraped: "2025-10-01" },
        { date_scraped: "2025-10-03" }
      ],
      countsOiRows: [{ date_scraped: "2025-10-01" }],
      ppRows: [{ gameId: 10, pp_share_of_team: null, unit: null }],
      knownGameIds: new Set([10, 11])
    });

    expect(result.counts.expectedDates).toBe(3);
    expect(result.sample.missingCountsDates).toEqual([
      "2025-10-03",
      "2025-10-05"
    ]);
    expect(result.sample.missingCountsOiDates).toEqual([
      "2025-10-03",
      "2025-10-05"
    ]);
    expect(result.sample.missingPpGameIds).toEqual([12]);
    expect(result.sample.missingPpShareGameIds).toEqual([10]);
    expect(result.sample.missingPpUnitGameIds).toEqual([10]);
    expect(result.sample.unknownGameIds).toEqual([12]);
    expect(result.warnings[0]).toContain("missingCountsDates:2");
    expect(result.warnings[0]).toContain("missingPpGameIds:1");
    expect(result.warnings[0]).toContain("missingPpShareGameIds:1");
    expect(result.warnings[0]).toContain("missingPpUnitGameIds:1");
  });

  it("uses split-source union dates for non-all strengths", () => {
    const result = summarizeCoverage({
      playerId: 2,
      strength: "pp",
      wgoRows: [
        { date: "2025-10-01", game_id: 20, pp_toi: 100 },
        { date: "2025-10-03", game_id: 21, pp_toi: 0 }
      ],
      countsRows: [{ date_scraped: "2025-10-01" }],
      ratesRows: [],
      countsOiRows: [{ date_scraped: "2025-10-01" }],
      ppRows: [{ gameId: 20, pp_share_of_team: 0.5, unit: 1 }],
      knownGameIds: new Set([20, 21])
    });

    expect(result.counts.expectedDates).toBe(1);
    expect(result.sample.missingRatesDates).toEqual(["2025-10-01"]);
    expect(result.sample.missingCountsDates).toEqual([]);
  });

  it("preserves unknown-game diagnostics even when other source gaps are absent", () => {
    const result = summarizeCoverage({
      playerId: 9,
      strength: "all",
      wgoRows: [{ date: "2025-10-01", game_id: 999, pp_toi: 0 }],
      countsRows: [{ date_scraped: "2025-10-01" }],
      ratesRows: [{ date_scraped: "2025-10-01" }],
      countsOiRows: [{ date_scraped: "2025-10-01" }],
      ppRows: [],
      knownGameIds: new Set([1000])
    });

    expect(result.counts.unknownGameIds).toBe(1);
    expect(result.sample.unknownGameIds).toEqual([999]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("player:9");
    expect(result.warnings[0]).toContain("strength:all");
    expect(result.warnings[0]).toContain("unknownGameIds:1");
  });
});

describe("summarizeSuspiciousOutputs", () => {
  it("flags bounded metrics outside their valid range", () => {
    const result = summarizeSuspiciousOutputs({
      playerId: 3,
      strength: "all",
      rows: [
        {
          game_date: "2025-11-01",
          shooting_pct_total_all: 150,
          pp_share_pct_total_all: 1.4,
          pdo_total_all: 1.03
        },
        {
          game_date: "2025-11-03",
          ipp_total_all: -5
        },
        {
          game_date: "2025-11-05",
          gp_pct_total_all: 0.2,
          games_played: 5,
          team_games_played: 4
        }
      ]
    });

    expect(result.issueCount).toBe(4);
    expect(result.warnings[0]).toContain("shooting_pct_total_all=150");
    expect(result.warnings[0]).toContain("pp_share_pct_total_all=1.4");
    expect(result.warnings[0]).toContain("ipp_total_all=-5");
    expect(result.warnings[0]).toContain("issues:4");
  });

  it("ignores null and in-range values", () => {
    const result = summarizeSuspiciousOutputs({
      playerId: 4,
      strength: "all",
      rows: [
        {
          game_date: "2025-12-01",
          shooting_pct_total_all: 12.5,
          pp_share_pct_total_all: 0.55,
          pdo_total_all: 0.997,
          ipp_total_all: null,
          gp_pct_total_all: 0.6,
          games_played: 6,
          team_games_played: 10,
          season_availability_pct: 0.6,
          season_games_played: 6,
          season_team_games_available: 10,
          three_year_availability_pct: 0.5,
          three_year_games_played: 15,
          three_year_team_games_available: 30,
          career_availability_pct: 0.5,
          career_games_played: 40,
          career_team_games_available: 80,
          gp_pct_total_last3: Number((2 / 3).toFixed(6)),
          games_played_last3_team_games: 2,
          team_games_available_last3: 3,
          availability_pct_last3_team_games: Number((2 / 3).toFixed(6))
        }
      ]
    });

    expect(result.issueCount).toBe(0);
    expect(result.warnings).toEqual([]);
  });

  it("flags canonical availability ratios when raw support fields disagree", () => {
    const result = summarizeSuspiciousOutputs({
      playerId: 5,
      strength: "all",
      rows: [
        {
          game_date: "2025-12-03",
          season_availability_pct: 0.9,
          season_games_played: 3,
          season_team_games_available: 10,
          three_year_availability_pct: 0.9,
          three_year_games_played: 18,
          three_year_team_games_available: 30,
          career_availability_pct: 0.2,
          career_games_played: 40,
          career_team_games_available: 80,
          availability_pct_last5_team_games: 0.9,
          games_played_last5_team_games: 2,
          team_games_available_last5: 5
        }
      ]
    });

    expect(result.issueCount).toBe(4);
    expect(result.warnings[0]).toContain("issues:4");
    expect(result.warnings[0]).toContain("season_availability_pct=0.9");
    expect(result.warnings[0]).toContain("three_year_availability_pct=0.9");
    expect(result.warnings[0]).toContain("career_availability_pct=0.2");
  });

  it("preserves suspicious-output warning formatting for downstream log consumers", () => {
    const result = summarizeSuspiciousOutputs({
      playerId: 12,
      strength: "pp",
      rows: [
        {
          game_date: "2025-12-09",
          pp_share_pct_total_all: 1.4
        }
      ]
    });

    expect(result.issueCount).toBe(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain(
      "[fetchRollingPlayerAverages] suspicious-output player:12 strength:pp"
    );
    expect(result.warnings[0]).toContain("issues:1");
    expect(result.warnings[0]).toContain("2025-12-09:pp_share_pct_total_all=1.4");
  });

  it("ignores raw support columns while still flagging true scaled snapshot violations", () => {
    const result = summarizeSuspiciousOutputs({
      playerId: 13,
      strength: "pp",
      rows: [
        {
          game_date: "2025-12-10",
          expected_sh_pct_shots_season: 2,
          expected_sh_pct_ixg_season: 0.8,
          pp_share_pct_player_pp_toi_all: 82,
          pp_share_pct_team_pp_toi_all: 732.142857,
          pp_share_pct_all: 1.2
        }
      ]
    });

    expect(result.issueCount).toBe(1);
    expect(result.warnings[0]).toContain("issues:1");
    expect(result.warnings[0]).toContain("2025-12-10:pp_share_pct_all=1.2");
    expect(result.warnings[0]).not.toContain("expected_sh_pct_shots_season");
    expect(result.warnings[0]).not.toContain("pp_share_pct_player_pp_toi_all");
    expect(result.warnings[0]).not.toContain("pp_share_pct_team_pp_toi_all");
  });
});

describe("summarizeDerivedWindowDiagnostics", () => {
  it("reports GP window denominator support and invalid numerator overflow", () => {
    const result = summarizeDerivedWindowDiagnostics({
      rows: [
        {
          season_games_played: 10,
          season_team_games_available: 12,
          three_year_games_played: 30,
          three_year_team_games_available: 20,
          career_games_played: null,
          career_team_games_available: null,
          games_played_last3_team_games: 2,
          team_games_available_last3: 3,
          games_played_last5_team_games: 6,
          team_games_available_last5: 5
        }
      ]
    });

    expect(result.gpWindows.season).toEqual({
      complete: 1,
      partial: 0,
      absent: 0,
      invalid: 0
    });
    expect(result.gpWindows["3ya"]).toEqual({
      complete: 1,
      partial: 0,
      absent: 0,
      invalid: 1
    });
    expect(result.gpWindows.career).toEqual({
      complete: 0,
      partial: 0,
      absent: 1,
      invalid: 0
    });
    expect(result.gpWindows.last5.invalid).toBe(1);
  });

  it("reports fixed-window ratio component completeness versus value presence", () => {
    const result = summarizeDerivedWindowDiagnostics({
      rows: [
        {
          primary_points_pct_last3: 0.5,
          primary_points_pct_primary_points_last3: 1,
          primary_points_pct_points_last3: 2,
          pp_share_pct_last3: 0.7,
          pp_share_pct_player_pp_toi_last3: 140,
          pdo_last3: 1.01,
          pdo_goals_for_last3: 2,
          pdo_shots_for_last3: 20,
          pdo_goals_against_last3: null,
          pdo_shots_against_last3: 30
        }
      ]
    });

    expect(result.ratioWindows.primary_points_pct.last3).toEqual({
      complete: 1,
      partial: 0,
      absent: 0,
      invalid: 0,
      valuePresentWithoutComponents: 0
    });
    expect(result.ratioWindows.pp_share_pct.last3).toEqual({
      complete: 0,
      partial: 1,
      absent: 0,
      invalid: 0,
      valuePresentWithoutComponents: 1
    });
    expect(result.ratioWindows.pdo.last3).toEqual({
      complete: 0,
      partial: 1,
      absent: 0,
      invalid: 0,
      valuePresentWithoutComponents: 1
    });
  });
});

describe("summarizeSourceTailFreshness", () => {
  it("flags stale date tails for NST sources and stale latest game coverage for contextual builders", () => {
    const result = summarizeSourceTailFreshness({
      playerId: 21,
      strength: "all",
      wgoRows: [
        { date: "2025-10-01", game_id: 100, pp_toi: 60 },
        { date: "2025-10-03", game_id: 101, pp_toi: 0 },
        { date: "2025-10-05", game_id: 102, pp_toi: 90 }
      ],
      countsRows: [{ date_scraped: "2025-10-03" }],
      ratesRows: [{ date_scraped: "2025-10-05" }],
      countsOiRows: [],
      ppRows: [{ gameId: 100, pp_share_of_team: 0.4, unit: 1 }],
      lineRows: [{ gameId: 101 }]
    });

    expect(result.blockers).toEqual({
      countsTailLag: 1,
      ratesTailLag: 0,
      countsOiTailLag: 3,
      ppTailLag: 1,
      lineTailLag: 1
    });
    expect(result.latest).toEqual({
      wgoDate: "2025-10-05",
      countsDate: "2025-10-03",
      ratesDate: "2025-10-05",
      countsOiDate: null,
      expectedPpGameId: 102,
      ppGameId: 100,
      expectedLineGameId: 102,
      lineGameId: 101
    });
    expect(result.warnings[0]).toContain("player:21");
    expect(result.warnings[0]).toContain("countsTailLag:1");
    expect(result.warnings[0]).toContain("countsOiTailLag:3");
    expect(result.warnings[0]).toContain("ppTailLag:1");
    expect(result.warnings[0]).toContain("lineTailLag:1");
  });

  it("stays quiet when source tails reach the latest WGO appearance window", () => {
    const result = summarizeSourceTailFreshness({
      playerId: 22,
      strength: "pp",
      wgoRows: [
        { date: "2025-10-01", game_id: 200, pp_toi: 60 },
        { date: "2025-10-03", game_id: 201, pp_toi: 90 }
      ],
      countsRows: [
        { date_scraped: "2025-10-01" },
        { date_scraped: "2025-10-03" }
      ],
      ratesRows: [
        { date_scraped: "2025-10-01" },
        { date_scraped: "2025-10-03" }
      ],
      countsOiRows: [
        { date_scraped: "2025-10-01" },
        { date_scraped: "2025-10-03" }
      ],
      ppRows: [
        { gameId: 200, pp_share_of_team: 0.4, unit: 1 },
        { gameId: 201, pp_share_of_team: 0.5, unit: 1 }
      ],
      lineRows: [{ gameId: 200 }, { gameId: 201 }]
    });

    expect(result.blockers).toEqual({
      countsTailLag: 0,
      ratesTailLag: 0,
      countsOiTailLag: 0,
      ppTailLag: 0,
      lineTailLag: 0
    });
    expect(result.warnings).toEqual([]);
  });
});
