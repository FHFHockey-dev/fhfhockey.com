import { beforeAll, describe, expect, it, vi } from "vitest";

let buildGameRecords: typeof import("./fetchRollingPlayerAverages").__testables.buildGameRecords;
let summarizeSourceTracking: typeof import("./fetchRollingPlayerAverages").__testables.summarizeSourceTracking;
let didPlayerCountAsAppearance: typeof import("./fetchRollingPlayerAverages").__testables.didPlayerCountAsAppearance;
let applyGpOutputs: typeof import("./fetchRollingPlayerAverages").__testables.applyGpOutputs;
let getGpOutputCompatibilityMode: typeof import("./fetchRollingPlayerAverages").__testables.getGpOutputCompatibilityMode;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  vi.resetModules();
  ({
    __testables: {
      buildGameRecords,
      summarizeSourceTracking,
      didPlayerCountAsAppearance,
      applyGpOutputs,
      getGpOutputCompatibilityMode
    }
  } = await import("./fetchRollingPlayerAverages"));
});

describe("fetchRollingPlayerAverages buildGameRecords", () => {
  it("preserves the WGO row spine when NST enrichment rows are missing", () => {
    const rows = buildGameRecords(
      [
        {
          player_id: 42,
          game_id: 1001,
          date: "2026-01-10",
          season_id: 20252026,
          team_abbrev: "COL",
          current_team_abbreviation: "COL",
          toi_per_game: 18.5,
          pp_toi: 0,
          points: 1,
          shots: 2,
          goals: 0,
          assists: 1,
          hits: 3,
          blocked_shots: 1
        } as any
      ],
      {},
      {},
      {},
      [],
      [],
      "all",
      new Set([1001])
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      playerId: 42,
      gameId: 1001,
      gameDate: "2026-01-10",
      season: 20252026,
      strength: "all",
      counts: undefined,
      rates: undefined,
      countsOi: undefined
    });
    expect(rows[0].sourceContext.rowSpine).toBe("wgo");
    expect(rows[0].sourceContext.countsSourcePresent).toBe(false);
    expect(rows[0].sourceContext.ratesSourcePresent).toBe(false);
    expect(rows[0].sourceContext.countsOiSourcePresent).toBe(false);
  });

  it("nulls unknown game ids in the stored row while preserving the source id for diagnostics", () => {
    const rows = buildGameRecords(
      [
        {
          player_id: 99,
          game_id: 5555,
          date: "2026-02-01",
          season_id: 20252026,
          team_abbrev: "NJD",
          current_team_abbreviation: "NJD",
          toi_per_game: 20,
          pp_toi: 120
        } as any
      ],
      {},
      {},
      {},
      [],
      [],
      "all",
      new Set([7777])
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].gameId).toBe(null);
    expect(rows[0].sourceContext.originalGameId).toBe(5555);
    expect(rows[0].sourceContext.hasKnownGameId).toBe(false);
  });

  it("merges counts, rates, on-ice, PP, and line data into a single row with explicit source context", () => {
    const rows = buildGameRecords(
      [
        {
          player_id: 7,
          game_id: 2001,
          date: "2026-01-15",
          season_id: null,
          team_abbrev: "COL",
          current_team_abbreviation: "COL",
          toi_per_game: 19,
          pp_toi: 150
        } as any
      ],
      {
        "2026-01-15": {
          date_scraped: "2026-01-15",
          season: 20252026,
          goals: 1,
          shots: 5,
          toi: 1100
        } as any
      },
      {
        "2026-01-15": {
          date_scraped: "2026-01-15",
          season: 20252026,
          toi_per_gp: 999,
          shots_per_60: 16
        } as any
      },
      {
        "2026-01-15": {
          date_scraped: "2026-01-15",
          toi: 1050,
          cf: 20
        } as any
      },
      [
        {
          gameId: 2001,
          teamId: 21,
          forwards: [7, 8, 9],
          defensemen: [10, 11],
          goalies: [12]
        }
      ],
      [
        {
          gameId: 2001,
          playerId: 7,
          PPTOI: 150,
          percentageOfPP: 1.2,
          unit: 1,
          pp_share_of_team: 0.65
        }
      ],
      "all",
      new Set([2001])
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      playerId: 7,
      gameId: 2001,
      season: 20252026,
      teamId: 21,
      strength: "all",
      ppCombination: { unit: 1, pp_share_of_team: 0.65 },
      lineCombo: { slot: 1, positionGroup: "forward" }
    });
    expect(rows[0].counts?.goals).toBe(1);
    expect(rows[0].rates?.shots_per_60).toBe(16);
    expect(rows[0].countsOi?.cf).toBe(20);
    expect(rows[0].sourceContext.seasonSource).toBe("counts");
    expect(rows[0].sourceContext.countsSourcePresent).toBe(true);
    expect(rows[0].sourceContext.ratesSourcePresent).toBe(true);
    expect(rows[0].sourceContext.countsOiSourcePresent).toBe(true);
    expect(rows[0].sourceContext.ppSourcePresent).toBe(true);
    expect(rows[0].sourceContext.lineSourcePresent).toBe(true);
    expect(rows[0].sourceContext.resolvedToiSource).toBe("counts");
  });

  it("tracks fallback-heavy rows and null-source gaps through sourceTracking summaries", () => {
    const rows = buildGameRecords(
      [
        {
          player_id: 55,
          game_id: 3001,
          date: "2026-02-10",
          season_id: 20252026,
          team_abbrev: "NJD",
          current_team_abbreviation: "NJD",
          toi_per_game: 18,
          pp_toi: 90,
          goals: 1,
          assists: 2,
          shots: 4,
          hits: 3,
          blocked_shots: 2,
          points: 3,
          ixg: 0.9
        } as any,
        {
          player_id: 55,
          game_id: 3002,
          date: "2026-02-12",
          season_id: 20252026,
          team_abbrev: "NJD",
          current_team_abbreviation: "NJD",
          toi_per_game: null,
          pp_toi: 0
        } as any
      ],
      {},
      {
        "2026-02-12": {
          date_scraped: "2026-02-12",
          season: 20252026,
          toi_per_gp: 900,
          shots_per_60: 12,
          ixg_per_60: 3
        } as any
      },
      {},
      [],
      [],
      "all",
      new Set([3001, 3002])
    );

    const summary = summarizeSourceTracking(rows, "all");

    expect(summary.missingSources.counts).toBe(2);
    expect(summary.missingSources.rates).toBe(1);
    expect(summary.missingSources.countsOi).toBe(2);
    expect(summary.missingSources.pp).toBe(1);
    expect(summary.missingSources.line).toBe(2);
    expect(summary.wgoFallbacks.goals).toBe(1);
    expect(summary.wgoFallbacks.assists).toBe(1);
    expect(summary.wgoFallbacks.shots).toBe(1);
    expect(summary.wgoFallbacks.hits).toBe(1);
    expect(summary.wgoFallbacks.blocks).toBe(1);
    expect(summary.wgoFallbacks.points).toBe(1);
    expect(summary.wgoFallbacks.ixg).toBe(1);
    expect(summary.rateReconstructions.sog_per_60).toBe(1);
    expect(summary.rateReconstructions.ixg_per_60).toBe(1);
    expect(summary.toiSources.fallback).toBe(1);
    expect(summary.toiSources.rates).toBe(1);
    expect(summary.toiFallbackSeeds.wgo).toBe(1);
  });

  it("treats split-strength appearance as positive-TOI participation", () => {
    expect(
      didPlayerCountAsAppearance("all", {
        strength: "all",
        sourceContext: {}
      } as any)
    ).toBe(true);
    expect(
      didPlayerCountAsAppearance("ev", {
        strength: "ev",
        counts: { toi: 125 } as any,
        sourceContext: {}
      } as any)
    ).toBe(true);
    expect(
      didPlayerCountAsAppearance("ev", {
        strength: "ev",
        counts: { toi: 0 } as any,
        sourceContext: {}
      } as any)
    ).toBe(false);
    expect(
      didPlayerCountAsAppearance("pp", {
        strength: "pp",
        sourceContext: {}
      } as any)
    ).toBe(false);
  });

  it("suppresses availability-named aliases for split-strength participation outputs", () => {
    const output: Record<string, number | null> = {};

    applyGpOutputs(
      output,
      {
        season: 0.4,
        threeYear: 0.5,
        career: 0.6,
        seasonPlayerGames: 4,
        seasonTeamGames: 10,
        threeYearPlayerGames: 15,
        threeYearTeamGames: 30,
        careerPlayerGames: 40,
        careerTeamGames: 80
      },
      {
        windows: {
          3: { playerGames: 1, teamGames: 3, ratio: Number((1 / 3).toFixed(6)) },
          5: { playerGames: 2, teamGames: 5, ratio: 0.4 },
          10: { playerGames: 3, teamGames: 10, ratio: 0.3 },
          20: { playerGames: 4, teamGames: 10, ratio: 0.4 }
        }
      },
      "ev"
    );

    expect(getGpOutputCompatibilityMode("ev")).toEqual({
      semanticType: "participation",
      emitAvailabilityAliases: false,
      legacyGpFieldMode: "legacy_gp_fields_only_until_participation_schema"
    });
    expect(output.games_played).toBe(4);
    expect(output.team_games_played).toBe(10);
    expect(output.season_games_played).toBe(4);
    expect(output.season_team_games_available).toBe(10);
    expect(output.three_year_games_played).toBe(15);
    expect(output.three_year_team_games_available).toBe(30);
    expect(output.career_games_played).toBe(40);
    expect(output.career_team_games_available).toBe(80);
    expect(output.gp_pct_total_all).toBe(0.4);
    expect(output.gp_pct_total_last3).toBe(Number((1 / 3).toFixed(6)));
    expect(output.games_played_last5_team_games).toBe(2);
    expect(output.team_games_available_last5).toBe(5);
    expect(output.games_played_last20_team_games).toBe(4);
    expect(output.team_games_available_last20).toBe(10);
    expect(output.season_availability_pct).toBeNull();
    expect(output.three_year_availability_pct).toBeNull();
    expect(output.career_availability_pct).toBeNull();
    expect(output.availability_pct_last3_team_games).toBeNull();
    expect(output.availability_pct_last20_team_games).toBeNull();
  });

  it("derives all-strength legacy gp aliases from canonical availability fields", () => {
    const output: Record<string, number | null> = {};

    applyGpOutputs(
      output,
      {
        season: 0.7,
        threeYear: 0.5,
        career: 0.6,
        seasonPlayerGames: 7,
        seasonTeamGames: 10,
        threeYearPlayerGames: 15,
        threeYearTeamGames: 30,
        careerPlayerGames: 40,
        careerTeamGames: 80
      },
      {
        windows: {
          3: { playerGames: 2, teamGames: 3, ratio: Number((2 / 3).toFixed(6)) },
          5: { playerGames: 3, teamGames: 5, ratio: 0.6 },
          10: { playerGames: 7, teamGames: 10, ratio: 0.7 },
          20: { playerGames: 7, teamGames: 10, ratio: 0.7 }
        }
      },
      "all"
    );

    expect(getGpOutputCompatibilityMode("all")).toEqual({
      semanticType: "availability",
      emitAvailabilityAliases: true,
      legacyGpFieldMode: "derived_aliases_from_canonical_availability"
    });
    expect(output.season_availability_pct).toBe(0.7);
    expect(output.three_year_availability_pct).toBe(0.5);
    expect(output.career_availability_pct).toBe(0.6);
    expect(output.three_year_games_played).toBe(15);
    expect(output.three_year_team_games_available).toBe(30);
    expect(output.career_games_played).toBe(40);
    expect(output.career_team_games_available).toBe(80);
    expect(output.availability_pct_last3_team_games).toBe(
      Number((2 / 3).toFixed(6))
    );
    expect(output.games_played_last10_team_games).toBe(7);
    expect(output.team_games_available_last10).toBe(10);
    expect(output.gp_pct_total_all).toBe(output.season_availability_pct);
    expect(output.gp_pct_avg_season).toBe(output.season_availability_pct);
    expect(output.gp_pct_avg_3ya).toBe(output.three_year_availability_pct);
    expect(output.gp_pct_avg_career).toBe(output.career_availability_pct);
    expect(output.gp_pct_total_last3).toBe(
      output.availability_pct_last3_team_games
    );
    expect(output.gp_pct_avg_last3).toBe(output.gp_pct_total_last3);
  });
});
