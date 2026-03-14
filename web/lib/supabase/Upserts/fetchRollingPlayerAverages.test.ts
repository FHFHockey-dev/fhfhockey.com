import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createHistoricalRatioAccumulator,
  createRatioRollingAccumulator,
  updateHistoricalRatioAccumulator,
  updateRatioRollingAccumulator
} from "./rollingMetricAggregation";
import {
  createHistoricalAverageAccumulator,
  updateHistoricalAverageAccumulator
} from "./rollingHistoricalAverages";

let buildGameRecords: typeof import("./fetchRollingPlayerAverages").__testables.buildGameRecords;
let buildRunSummary: typeof import("./fetchRollingPlayerAverages").__testables.buildRunSummary;
let summarizeSourceTracking: typeof import("./fetchRollingPlayerAverages").__testables.summarizeSourceTracking;
let didPlayerCountAsAppearance: typeof import("./fetchRollingPlayerAverages").__testables.didPlayerCountAsAppearance;
let applyGpOutputs: typeof import("./fetchRollingPlayerAverages").__testables.applyGpOutputs;
let getGpOutputCompatibilityMode: typeof import("./fetchRollingPlayerAverages").__testables.getGpOutputCompatibilityMode;
let deriveOutputs: typeof import("./fetchRollingPlayerAverages").__testables.deriveOutputs;
let getOptionalPpContextOutputs: typeof import("./fetchRollingPlayerAverages").__testables.getOptionalPpContextOutputs;
let initAccumulator: typeof import("./fetchRollingPlayerAverages").__testables.initAccumulator;
let normalizePlayerIdList: typeof import("./fetchRollingPlayerAverages").__testables.normalizePlayerIdList;
let shouldUseDateScopedPlayerSelection: typeof import("./fetchRollingPlayerAverages").__testables.shouldUseDateScopedPlayerSelection;
let shouldWarnAboutDisabledImplicitAutoResume: typeof import("./fetchRollingPlayerAverages").__testables.shouldWarnAboutDisabledImplicitAutoResume;
let filterPlayerIdsForResume: typeof import("./fetchRollingPlayerAverages").__testables.filterPlayerIdsForResume;
let upsertRollingPlayerMetricsBatch: typeof import("./fetchRollingPlayerAverages").__testables.upsertRollingPlayerMetricsBatch;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  vi.resetModules();
  ({
    __testables: {
      buildGameRecords,
      buildRunSummary,
      summarizeSourceTracking,
      didPlayerCountAsAppearance,
      applyGpOutputs,
      getGpOutputCompatibilityMode,
      deriveOutputs,
      getOptionalPpContextOutputs,
      initAccumulator,
      normalizePlayerIdList,
      shouldUseDateScopedPlayerSelection,
      shouldWarnAboutDisabledImplicitAutoResume,
      filterPlayerIdsForResume,
      upsertRollingPlayerMetricsBatch
    }
  } = await import("./fetchRollingPlayerAverages"));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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
          pp_share_of_team: 0.65,
          pp_unit_usage_index: 1.2,
          pp_unit_relative_toi: 25,
          pp_vs_unit_avg: 0.2
        } as any
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
      ppCombination: {
        gameId: 2001,
        playerId: 7,
        PPTOI: 150,
        unit: 1,
        pp_share_of_team: 0.65,
        pp_unit_usage_index: 1.2,
        pp_unit_relative_toi: 25,
        pp_vs_unit_avg: 0.2
      },
      lineCombo: { slot: 1, positionGroup: "forward" }
    });
    expect(rows[0].ppCombination).not.toHaveProperty("percentageOfPP");
    expect(rows[0].counts?.goals).toBe(1);
    expect(rows[0].rates?.shots_per_60).toBe(16);
    expect(rows[0].countsOi?.cf).toBe(20);
    expect(rows[0].sourceContext.seasonSource).toBe("counts");
    expect(rows[0].sourceContext.countsSourcePresent).toBe(true);
    expect(rows[0].sourceContext.ratesSourcePresent).toBe(true);
    expect(rows[0].sourceContext.countsOiSourcePresent).toBe(true);
    expect(rows[0].sourceContext.ppSourcePresent).toBe(true);
    expect(rows[0].sourceContext.ppUnitSourcePresent).toBe(true);
    expect(rows[0].sourceContext.lineSourcePresent).toBe(true);
    expect(rows[0].sourceContext.lineAssignmentSourcePresent).toBe(true);
    expect(rows[0].sourceContext.resolvedToiSource).toBe("counts");
    expect(rows[0].sourceContext.toiTrustTier).toBe("authoritative");
    expect(rows[0].sourceContext.wgoToiNormalization).toBe("missing");
  });

  it("maps optional PP context fields to row outputs without changing pp_share semantics", () => {
    expect(
      getOptionalPpContextOutputs({
        ppCombination: {
          gameId: 2001,
          playerId: 7,
          PPTOI: 150,
          unit: 1,
          pp_share_of_team: 0.65,
          pp_unit_usage_index: 1.2,
          pp_unit_relative_toi: 25,
          pp_vs_unit_avg: 0.2
        }
      } as any)
    ).toEqual({
      pp_share_of_team: 0.65,
      pp_unit_usage_index: 1.2,
      pp_unit_relative_toi: 25,
      pp_vs_unit_avg: 0.2
    });
  });

  it("treats pp_unit as an independently trusted contextual label", () => {
    const rows = buildGameRecords(
      [
        {
          player_id: 7,
          game_id: 2002,
          date: "2026-01-18",
          season_id: 20252026,
          team_abbrev: "NYR",
          current_team_abbreviation: "NYR",
          toi_per_game: 18,
          pp_toi: 120
        } as any
      ],
      {},
      {},
      {},
      [],
      [
        {
          gameId: 2002,
          playerId: 7,
          PPTOI: 120,
          unit: null,
          pp_share_of_team: 0.55
        } as any
      ],
      "all",
      new Set([2002])
    );

    expect(rows[0].sourceContext.ppSourcePresent).toBe(true);
    expect(rows[0].sourceContext.ppUnitSourcePresent).toBe(false);
  });

  it("distinguishes line row presence from trusted player line assignment", () => {
    const rows = buildGameRecords(
      [
        {
          player_id: 77,
          game_id: 2003,
          date: "2026-01-20",
          season_id: 20252026,
          team_abbrev: "NYR",
          current_team_abbreviation: "NYR",
          toi_per_game: 15,
          pp_toi: 0
        } as any
      ],
      {},
      {},
      {},
      [
        {
          gameId: 2003,
          teamId: 3,
          forwards: [1, 2, 3],
          defensemen: [4, 5],
          goalies: [6]
        }
      ],
      [],
      "all",
      new Set([2003])
    );

    expect(rows[0].sourceContext.lineSourcePresent).toBe(true);
    expect(rows[0].sourceContext.lineAssignmentSourcePresent).toBe(false);
    expect(rows[0].lineCombo).toEqual({ slot: null, positionGroup: null });
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
          total_primary_assists: 1,
          total_secondary_assists: 1,
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
    expect(summary.missingSources.ppUnit).toBe(1);
    expect(summary.missingSources.line).toBe(2);
    expect(summary.missingSources.lineAssignment).toBe(0);
    expect(summary.wgoFallbacks.goals).toBe(1);
    expect(summary.wgoFallbacks.assists).toBe(1);
    expect(summary.wgoFallbacks.primary_assists).toBe(1);
    expect(summary.wgoFallbacks.secondary_assists).toBe(1);
    expect(summary.wgoFallbacks.shots).toBe(1);
    expect(summary.wgoFallbacks.hits).toBe(1);
    expect(summary.wgoFallbacks.blocks).toBe(1);
    expect(summary.wgoFallbacks.points).toBe(1);
    expect(summary.wgoFallbacks.ixg).toBe(1);
    expect(summary.rateReconstructions.sog_per_60).toBe(1);
    expect(summary.rateReconstructions.ixg_per_60).toBe(1);
    expect(summary.ixgPer60Sources.wgo_raw).toBe(1);
    expect(summary.ixgPer60Sources.rate_reconstruction).toBe(1);
    expect(summary.ixgPer60Sources.counts_raw).toBe(0);
    expect(summary.ixgPer60Sources.unavailable).toBe(0);
    expect(summary.toiSources.fallback).toBe(1);
    expect(summary.toiSources.rates).toBe(1);
    expect(summary.toiTrustTiers.fallback).toBe(1);
    expect(summary.toiTrustTiers.supplementary).toBe(1);
    expect(summary.toiFallbackSeeds.wgo).toBe(1);
    expect(summary.toiWgoNormalizations.minutes_to_seconds).toBe(1);
    expect(summary.toiWgoNormalizations.missing).toBe(1);
    expect(summary.toiSuspiciousReasons.non_finite).toBe(0);
    expect(summary.toiSuspiciousReasons.non_positive).toBe(0);
    expect(summary.toiSuspiciousReasons.above_max_seconds).toBe(0);
  });

  it("builds an exportable structured run summary with source-tracking detail", () => {
    const summary = buildRunSummary({
      rowsUpserted: 5452,
      processedPlayers: 3,
      playersWithRows: 2,
      coverageWarnings: 8,
      suspiciousOutputWarnings: 211766,
      unknownGameIds: 27,
      freshnessBlockers: 4,
      sourceTracking: {
        missingSources: {
          counts: 1176,
          rates: 1177,
          countsOi: 1176,
          pp: 1370,
          ppUnit: 423,
          line: 387,
          lineAssignment: 39,
          knownGameId: 1056
        },
        wgoFallbacks: {
          goals: 1176,
          assists: 1176,
          primary_assists: 0,
          secondary_assists: 0,
          shots: 1176,
          hits: 1176,
          blocks: 1176,
          points: 1176,
          ixg: 0
        },
        rateReconstructions: {
          sog_per_60: 2,
          ixg_per_60: 2
        },
        ixgPer60Sources: {
          counts_raw: 173,
          wgo_raw: 0,
          rate_reconstruction: 2,
          unavailable: 0
        },
        toiSources: {
          counts: 347,
          counts_oi: 2,
          rates: 0,
          fallback: 0,
          wgo: 1175,
          none: 1
        },
        toiFallbackSeeds: {
          counts: 0,
          counts_oi: 0,
          wgo: 0,
          none: 0
        },
        toiTrustTiers: {
          authoritative: 347,
          supplementary: 2,
          fallback: 1175,
          none: 1
        },
        toiWgoNormalizations: {
          minutes_to_seconds: 1175,
          already_seconds: 0,
          missing: 1,
          invalid: 0
        },
        toiSuspiciousReasons: {
          non_finite: 0,
          non_positive: 0,
          above_max_seconds: 0
        }
      }
    });

    expect(summary).toEqual({
      rowsUpserted: 5452,
      processedPlayers: 3,
      playersWithRows: 2,
      coverageWarnings: 8,
      suspiciousOutputWarnings: 211766,
      unknownGameIds: 27,
      freshnessBlockers: 4,
      sourceTracking: expect.objectContaining({
        wgoFallbacks: expect.objectContaining({
          goals: 1176,
          points: 1176,
          primary_assists: 0,
          secondary_assists: 0
        }),
        rateReconstructions: expect.objectContaining({
          sog_per_60: 2,
          ixg_per_60: 2
        }),
        toiSources: expect.objectContaining({
          counts: 347,
          wgo: 1175
        })
      })
    });

    expect(JSON.parse(JSON.stringify(summary))).toEqual(summary);
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
    expect(output.season_participation_pct).toBe(0.4);
    expect(output.three_year_participation_pct).toBe(0.5);
    expect(output.career_participation_pct).toBe(0.6);
    expect(output.season_participation_games).toBe(4);
    expect(output.three_year_participation_games).toBe(15);
    expect(output.career_participation_games).toBe(40);
    expect(output.participation_pct_last3_team_games).toBe(
      Number((1 / 3).toFixed(6))
    );
    expect(output.participation_games_last20_team_games).toBe(4);
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
    expect(output.season_participation_pct).toBeNull();
    expect(output.participation_pct_last3_team_games).toBeNull();
    expect(output.gp_pct_total_all).toBe(output.season_availability_pct);
    expect(output.gp_pct_avg_season).toBe(output.season_availability_pct);
    expect(output.gp_pct_avg_3ya).toBe(output.three_year_availability_pct);
    expect(output.gp_pct_avg_career).toBe(output.career_availability_pct);
    expect(output.gp_pct_total_last3).toBe(
      output.availability_pct_last3_team_games
    );
    expect(output.gp_pct_avg_last3).toBe(output.gp_pct_total_last3);
  });

  it("emits canonical ratio snapshot fields and raw support columns from shared accumulators", () => {
    const ratioMetricsState = {
      primary_points_pct: createRatioRollingAccumulator()
    } as Record<string, any>;
    const historicalRatioMetricsState = {
      primary_points_pct: createHistoricalRatioAccumulator()
    } as Record<string, any>;

    updateRatioRollingAccumulator(
      ratioMetricsState.primary_points_pct,
      { numerator: 2, denominator: 4 },
      { windowFamily: "ratio_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.primary_points_pct,
      { numerator: 1, denominator: 1 },
      { windowFamily: "ratio_performance", anchor: true }
    );

    updateHistoricalRatioAccumulator(historicalRatioMetricsState.primary_points_pct, 20242025, {
      numerator: 3,
      denominator: 6
    });
    updateHistoricalRatioAccumulator(historicalRatioMetricsState.primary_points_pct, 20252026, {
      numerator: 2,
      denominator: 4
    });

    const output = deriveOutputs(
      {},
      ratioMetricsState,
      {},
      {},
      {},
      historicalRatioMetricsState,
      {
        season: 0.7,
        threeYear: 0.6,
        career: 0.6,
        seasonPlayerGames: 7,
        seasonTeamGames: 10,
        threeYearPlayerGames: 12,
        threeYearTeamGames: 20,
        careerPlayerGames: 12,
        careerTeamGames: 20
      },
      {
        windows: {
          3: { playerGames: 2, teamGames: 3, ratio: Number((2 / 3).toFixed(6)) },
          5: { playerGames: 2, teamGames: 5, ratio: 0.4 },
          10: { playerGames: 2, teamGames: 10, ratio: 0.2 },
          20: { playerGames: 2, teamGames: 20, ratio: 0.1 }
        }
      },
      20252026,
      "all"
    );

    expect(output.primary_points_pct_all).toBe(0.6);
    expect(output.primary_points_pct_last3).toBe(0.6);
    expect(output.primary_points_pct_season).toBe(0.5);
    expect(output.primary_points_pct_3ya).toBe(0.5);
    expect(output.primary_points_pct_career).toBe(0.5);
    expect(output.primary_points_pct_primary_points_all).toBe(3);
    expect(output.primary_points_pct_points_all).toBe(5);
    expect(output.primary_points_pct_primary_points_last3).toBe(3);
    expect(output.primary_points_pct_points_last3).toBe(5);
    expect(output.primary_points_pct_primary_points_season).toBe(2);
    expect(output.primary_points_pct_points_season).toBe(4);
    expect(output.primary_points_pct_primary_points_3ya).toBe(5);
    expect(output.primary_points_pct_points_3ya).toBe(10);
  });

  it("stores canonical oz_start_pct support fields including neutral-zone counts", () => {
    const ratioMetricsState = {
      oz_start_pct: createRatioRollingAccumulator()
    } as Record<string, any>;
    const supportMetricsState = {
      oz_start_neutral_zone_starts: initAccumulator()
    } as Record<string, any>;
    const historicalSupportMetricsState = {
      oz_start_neutral_zone_starts: createHistoricalAverageAccumulator()
    } as Record<string, any>;
    const historicalRatioMetricsState = {
      oz_start_pct: createHistoricalRatioAccumulator()
    } as Record<string, any>;

    updateRatioRollingAccumulator(
      ratioMetricsState.oz_start_pct,
      { numerator: 3, denominator: 5 },
      { windowFamily: "ratio_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.oz_start_pct,
      { numerator: 1, denominator: 3 },
      { windowFamily: "ratio_performance", anchor: true }
    );
    supportMetricsState.oz_start_neutral_zone_starts.sumAll = 4;
    supportMetricsState.oz_start_neutral_zone_starts.countAll = 2;
    supportMetricsState.oz_start_neutral_zone_starts.windows[3].sum = 4;
    supportMetricsState.oz_start_neutral_zone_starts.windows[3].count = 2;
    supportMetricsState.oz_start_neutral_zone_starts.windows[5].sum = 4;
    supportMetricsState.oz_start_neutral_zone_starts.windows[5].count = 2;
    supportMetricsState.oz_start_neutral_zone_starts.windows[10].sum = 4;
    supportMetricsState.oz_start_neutral_zone_starts.windows[10].count = 2;
    supportMetricsState.oz_start_neutral_zone_starts.windows[20].sum = 4;
    supportMetricsState.oz_start_neutral_zone_starts.windows[20].count = 2;
    historicalSupportMetricsState.oz_start_neutral_zone_starts.careerSum = 7;
    historicalSupportMetricsState.oz_start_neutral_zone_starts.careerCount = 3;
    historicalSupportMetricsState.oz_start_neutral_zone_starts.bySeason.set(20242025, {
      sum: 3,
      count: 1
    });
    historicalSupportMetricsState.oz_start_neutral_zone_starts.bySeason.set(20252026, {
      sum: 4,
      count: 2
    });
    updateHistoricalRatioAccumulator(historicalRatioMetricsState.oz_start_pct, 20242025, {
      numerator: 4,
      denominator: 9
    });
    updateHistoricalRatioAccumulator(historicalRatioMetricsState.oz_start_pct, 20252026, {
      numerator: 5,
      denominator: 8
    });

    const output = deriveOutputs(
      {},
      ratioMetricsState,
      supportMetricsState,
      {},
      historicalSupportMetricsState,
      historicalRatioMetricsState,
      {
        season: 0.7,
        threeYear: 0.6,
        career: 0.6,
        seasonPlayerGames: 7,
        seasonTeamGames: 10,
        threeYearPlayerGames: 12,
        threeYearTeamGames: 20,
        careerPlayerGames: 12,
        careerTeamGames: 20
      },
      {
        windows: {
          3: { playerGames: 2, teamGames: 3, ratio: Number((2 / 3).toFixed(6)) },
          5: { playerGames: 2, teamGames: 5, ratio: 0.4 },
          10: { playerGames: 2, teamGames: 10, ratio: 0.2 },
          20: { playerGames: 2, teamGames: 20, ratio: 0.1 }
        }
      },
      20252026,
      "all"
    );

    expect(output.oz_start_pct_all).toBe(50);
    expect(output.oz_start_pct_off_zone_starts_all).toBe(4);
    expect(output.oz_start_pct_def_zone_starts_all).toBe(4);
    expect(output.oz_start_pct_neutral_zone_starts_all).toBe(4);
    expect(output.oz_start_pct_off_zone_starts_last3).toBe(4);
    expect(output.oz_start_pct_def_zone_starts_last3).toBe(4);
    expect(output.oz_start_pct_neutral_zone_starts_last3).toBe(4);
    expect(output.oz_start_pct_off_zone_starts_season).toBe(5);
    expect(output.oz_start_pct_def_zone_starts_season).toBe(3);
    expect(output.oz_start_pct_neutral_zone_starts_season).toBe(4);
    expect(output.oz_start_pct_off_zone_starts_3ya).toBe(9);
    expect(output.oz_start_pct_def_zone_starts_3ya).toBe(8);
    expect(output.oz_start_pct_neutral_zone_starts_3ya).toBe(7);
  });

  it("emits optional on-ice save percentage, additive support metrics, and weighted-rate families", () => {
    const simpleMetricsState = {
      pp_toi_seconds: initAccumulator(),
      primary_assists: initAccumulator(),
      secondary_assists: initAccumulator(),
      penalties_drawn: initAccumulator(),
      oz_starts: initAccumulator(),
      dz_starts: initAccumulator(),
      nz_starts: initAccumulator(),
      oi_gf: initAccumulator(),
      oi_ga: initAccumulator(),
      oi_sf: initAccumulator(),
      oi_sa: initAccumulator()
    } as Record<string, any>;
    const ratioMetricsState = {
      on_ice_sv_pct: createRatioRollingAccumulator(),
      goals_per_60: createRatioRollingAccumulator(),
      assists_per_60: createRatioRollingAccumulator(),
      penalties_drawn_per_60: createRatioRollingAccumulator(),
      primary_assists_per_60: createRatioRollingAccumulator(),
      secondary_assists_per_60: createRatioRollingAccumulator()
    } as Record<string, any>;
    const historicalSimpleMetricsState = {
      oz_starts: createHistoricalAverageAccumulator(),
      dz_starts: createHistoricalAverageAccumulator(),
      nz_starts: createHistoricalAverageAccumulator(),
      oi_gf: createHistoricalAverageAccumulator(),
      oi_ga: createHistoricalAverageAccumulator(),
      oi_sf: createHistoricalAverageAccumulator(),
      oi_sa: createHistoricalAverageAccumulator(),
      goals: createHistoricalAverageAccumulator(),
      assists: createHistoricalAverageAccumulator(),
      penalties_drawn: createHistoricalAverageAccumulator(),
      primary_assists: createHistoricalAverageAccumulator(),
      secondary_assists: createHistoricalAverageAccumulator(),
      pp_toi_seconds: createHistoricalAverageAccumulator(),
      toi_seconds: createHistoricalAverageAccumulator(),
      primary_assists_per_60_primary_assists: createHistoricalAverageAccumulator(),
      secondary_assists_per_60_secondary_assists:
        createHistoricalAverageAccumulator()
    } as Record<string, any>;
    const historicalRatioMetricsState = {
      on_ice_sv_pct: createHistoricalRatioAccumulator(),
      goals_per_60: createHistoricalRatioAccumulator(),
      assists_per_60: createHistoricalRatioAccumulator(),
      penalties_drawn_per_60: createHistoricalRatioAccumulator(),
      primary_assists_per_60: createHistoricalRatioAccumulator(),
      secondary_assists_per_60: createHistoricalRatioAccumulator()
    } as Record<string, any>;

    const pushSimple = (acc: any, value: number) => {
      acc.sumAll += value;
      acc.countAll += 1;
      for (const size of [3, 5, 10, 20] as const) {
        acc.windows[size].values.push(value);
        acc.windows[size].sum += value;
        acc.windows[size].count += 1;
      }
    };

    pushSimple(simpleMetricsState.pp_toi_seconds, 120);
    pushSimple(simpleMetricsState.pp_toi_seconds, 60);
    pushSimple(simpleMetricsState.primary_assists, 2);
    pushSimple(simpleMetricsState.primary_assists, 1);
    pushSimple(simpleMetricsState.secondary_assists, 1);
    pushSimple(simpleMetricsState.secondary_assists, 0);
    pushSimple(simpleMetricsState.penalties_drawn, 1);
    pushSimple(simpleMetricsState.penalties_drawn, 2);
    pushSimple(simpleMetricsState.oz_starts, 4);
    pushSimple(simpleMetricsState.oz_starts, 2);
    pushSimple(simpleMetricsState.dz_starts, 3);
    pushSimple(simpleMetricsState.dz_starts, 1);
    pushSimple(simpleMetricsState.nz_starts, 5);
    pushSimple(simpleMetricsState.nz_starts, 2);
    pushSimple(simpleMetricsState.oi_gf, 2);
    pushSimple(simpleMetricsState.oi_gf, 1);
    pushSimple(simpleMetricsState.oi_ga, 1);
    pushSimple(simpleMetricsState.oi_ga, 0);
    pushSimple(simpleMetricsState.oi_sf, 12);
    pushSimple(simpleMetricsState.oi_sf, 8);
    pushSimple(simpleMetricsState.oi_sa, 15);
    pushSimple(simpleMetricsState.oi_sa, 5);

    updateRatioRollingAccumulator(
      ratioMetricsState.on_ice_sv_pct,
      { numerator: 14, denominator: 15 },
      { windowFamily: "ratio_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.on_ice_sv_pct,
      { numerator: 5, denominator: 5 },
      { windowFamily: "ratio_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.goals_per_60,
      { numerator: 2, denominator: 1200 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.goals_per_60,
      { numerator: 1, denominator: 600 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.assists_per_60,
      { numerator: 3, denominator: 1200 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.assists_per_60,
      { numerator: 1, denominator: 600 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.penalties_drawn_per_60,
      { numerator: 1, denominator: 1200 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.penalties_drawn_per_60,
      { numerator: 2, denominator: 600 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.primary_assists_per_60,
      { numerator: 2, denominator: 1200 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.primary_assists_per_60,
      { numerator: 1, denominator: 600 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.secondary_assists_per_60,
      { numerator: 1, denominator: 1200 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.secondary_assists_per_60,
      { numerator: 0, denominator: 600 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );

    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oz_starts, 20242025, 4);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oz_starts, 20252026, 6);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.dz_starts, 20242025, 4);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.dz_starts, 20252026, 4);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.nz_starts, 20242025, 3);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.nz_starts, 20252026, 7);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oi_gf, 20242025, 2);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oi_gf, 20252026, 3);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oi_ga, 20242025, 2);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oi_ga, 20252026, 1);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oi_sf, 20242025, 7);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oi_sf, 20252026, 20);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oi_sa, 20242025, 8);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oi_sa, 20252026, 20);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.goals, 20242025, 3);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.goals, 20252026, 4);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.assists, 20242025, 4);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.assists, 20252026, 5);
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.penalties_drawn,
      20242025,
      2
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.penalties_drawn,
      20252026,
      4
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.primary_assists,
      20242025,
      2
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.primary_assists,
      20252026,
      3
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.secondary_assists,
      20242025,
      2
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.secondary_assists,
      20252026,
      2
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.pp_toi_seconds,
      20242025,
      90
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.pp_toi_seconds,
      20252026,
      120
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.toi_seconds,
      20242025,
      1800
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.toi_seconds,
      20252026,
      1500
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.primary_assists_per_60_primary_assists,
      20242025,
      2
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.primary_assists_per_60_primary_assists,
      20252026,
      3
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.secondary_assists_per_60_secondary_assists,
      20242025,
      2
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.secondary_assists_per_60_secondary_assists,
      20252026,
      2
    );

    updateHistoricalRatioAccumulator(historicalRatioMetricsState.on_ice_sv_pct, 20242025, {
      numerator: 18,
      denominator: 20
    });
    updateHistoricalRatioAccumulator(historicalRatioMetricsState.on_ice_sv_pct, 20252026, {
      numerator: 19,
      denominator: 20
    });
    updateHistoricalRatioAccumulator(historicalRatioMetricsState.goals_per_60, 20242025, {
      numerator: 3,
      denominator: 1800
    });
    updateHistoricalRatioAccumulator(historicalRatioMetricsState.goals_per_60, 20252026, {
      numerator: 4,
      denominator: 1500
    });
    updateHistoricalRatioAccumulator(
      historicalRatioMetricsState.assists_per_60,
      20242025,
      {
        numerator: 4,
        denominator: 1800
      }
    );
    updateHistoricalRatioAccumulator(
      historicalRatioMetricsState.assists_per_60,
      20252026,
      {
        numerator: 5,
        denominator: 1500
      }
    );
    updateHistoricalRatioAccumulator(
      historicalRatioMetricsState.penalties_drawn_per_60,
      20242025,
      {
        numerator: 2,
        denominator: 1800
      }
    );
    updateHistoricalRatioAccumulator(
      historicalRatioMetricsState.penalties_drawn_per_60,
      20252026,
      {
        numerator: 4,
        denominator: 1500
      }
    );
    updateHistoricalRatioAccumulator(
      historicalRatioMetricsState.primary_assists_per_60,
      20242025,
      {
        numerator: 2,
        denominator: 1800
      }
    );
    updateHistoricalRatioAccumulator(
      historicalRatioMetricsState.primary_assists_per_60,
      20252026,
      {
        numerator: 3,
        denominator: 1500
      }
    );
    updateHistoricalRatioAccumulator(
      historicalRatioMetricsState.secondary_assists_per_60,
      20242025,
      {
        numerator: 2,
        denominator: 1800
      }
    );
    updateHistoricalRatioAccumulator(
      historicalRatioMetricsState.secondary_assists_per_60,
      20252026,
      {
        numerator: 2,
        denominator: 1500
      }
    );

    const output = deriveOutputs(
      simpleMetricsState,
      ratioMetricsState,
      {},
      historicalSimpleMetricsState,
      {},
      historicalRatioMetricsState,
      {
        season: 0.7,
        threeYear: 0.6,
        career: 0.6,
        seasonPlayerGames: 7,
        seasonTeamGames: 10,
        threeYearPlayerGames: 12,
        threeYearTeamGames: 20,
        careerPlayerGames: 12,
        careerTeamGames: 20
      },
      {
        windows: {
          3: { playerGames: 2, teamGames: 3, ratio: Number((2 / 3).toFixed(6)) },
          5: { playerGames: 2, teamGames: 5, ratio: 0.4 },
          10: { playerGames: 2, teamGames: 10, ratio: 0.2 },
          20: { playerGames: 2, teamGames: 20, ratio: 0.1 }
        }
      },
      20252026,
      "all"
    );

    expect(output.on_ice_sv_pct_total_all).toBe(95);
    expect(output.on_ice_sv_pct_all).toBe(95);
    expect(output.on_ice_sv_pct_total_last3).toBe(95);
    expect(output.on_ice_sv_pct_season).toBe(95);
    expect(output.on_ice_sv_pct_3ya).toBe(Number(((37 / 40) * 100).toFixed(6)));
    expect(output.oz_starts_total_all).toBe(6);
    expect(output.oz_starts_avg_all).toBe(3);
    expect(output.oz_starts_avg_season).toBe(6);
    expect(output.dz_starts_total_last3).toBe(4);
    expect(output.nz_starts_avg_career).toBe(5);
    expect(output.oi_gf_total_all).toBe(3);
    expect(output.oi_gf_avg_all).toBe(1.5);
    expect(output.oi_ga_total_all).toBe(1);
    expect(output.oi_sf_total_all).toBe(20);
    expect(output.oi_sa_total_all).toBe(20);
    expect(output.oi_sf_avg_season).toBe(20);
    expect(output.oi_sa_avg_3ya).toBe(14);
    expect(output.goals_per_60_total_all).toBe(6);
    expect(output.goals_per_60_all).toBe(6);
    expect(output.goals_per_60_season).toBe(9.6);
    expect(output.goals_per_60_3ya).toBe(Number(((7 / 3300) * 3600).toFixed(6)));
    expect(output.goals_per_60_goals_season).toBe(4);
    expect(output.goals_per_60_toi_seconds_season).toBe(1500);
    expect(output.assists_per_60_total_all).toBe(8);
    expect(output.assists_per_60_all).toBe(8);
    expect(output.assists_per_60_season).toBe(12);
    expect(output.assists_per_60_assists_career).toBe(9);
    expect(output.assists_per_60_toi_seconds_career).toBe(3300);
    expect(output.pp_toi_seconds_total_all).toBe(180);
    expect(output.pp_toi_seconds_avg_all).toBe(90);
    expect(output.pp_toi_seconds_avg_season).toBe(120);
    expect(output.pp_toi_seconds_avg_career).toBe(105);
    expect(output.penalties_drawn_total_all).toBe(3);
    expect(output.penalties_drawn_avg_all).toBe(1.5);
    expect(output.penalties_drawn_avg_season).toBe(4);
    expect(output.penalties_drawn_per_60_total_all).toBe(6);
    expect(output.penalties_drawn_per_60_all).toBe(6);
    expect(output.penalties_drawn_per_60_season).toBe(9.6);
    expect(output.penalties_drawn_per_60_penalties_drawn_career).toBe(6);
    expect(output.penalties_drawn_per_60_toi_seconds_career).toBe(3300);
    expect(output.primary_assists_total_all).toBe(3);
    expect(output.primary_assists_avg_all).toBe(1.5);
    expect(output.primary_assists_avg_season).toBe(3);
    expect(output.secondary_assists_total_all).toBe(1);
    expect(output.secondary_assists_avg_all).toBe(0.5);
    expect(output.secondary_assists_avg_career).toBe(2);
    expect(output.primary_assists_per_60_total_all).toBe(6);
    expect(output.primary_assists_per_60_all).toBe(6);
    expect(output.primary_assists_per_60_primary_assists_season).toBe(3);
    expect(output.primary_assists_per_60_toi_seconds_season).toBe(1500);
    expect(output.secondary_assists_per_60_total_all).toBe(2);
    expect(output.secondary_assists_per_60_all).toBe(2);
    expect(output.secondary_assists_per_60_season).toBe(4.8);
    expect(output.secondary_assists_per_60_secondary_assists_career).toBe(4);
    expect(output.secondary_assists_per_60_toi_seconds_career).toBe(3300);
  });
});

describe("fetchRollingPlayerAverages upsertRollingPlayerMetricsBatch", () => {
  it("posts wide rolling metric rows through the direct PostgREST endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 200, statusText: "OK" }));
    vi.stubGlobal("fetch", fetchMock);

    const batch = [
      {
        player_id: 8470613,
        game_date: "2025-10-07",
        season: 20252026,
        strength_state: "all",
        goals_total_last20: 0,
        toi_seconds_total_last20: 1210,
        pp_share_pct_last20: 0.226
      }
    ];

    await expect(upsertRollingPlayerMetricsBatch(batch)).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/rolling_player_game_metrics?on_conflict=player_id,game_date,strength_state",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "test-service-role-key",
          Authorization: "Bearer test-service-role-key",
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal"
        }),
        body: JSON.stringify(batch)
      })
    );
  });

  it("surfaces structured response details when the direct upsert fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "column \"bogus_metric\" of relation \"rolling_player_game_metrics\" does not exist",
          code: "42703",
          details: "Failing row contains an unknown column.",
          hint: "Check generated types and migrations."
        }),
        {
          status: 400,
          statusText: "Bad Request",
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      upsertRollingPlayerMetricsBatch([
        {
          player_id: 8470613,
          game_date: "2025-10-07",
          season: 20252026,
          strength_state: "all",
          bogus_metric: 1
        }
      ])
    ).rejects.toSatisfy((error: unknown) => {
      const typed = error as Record<string, unknown>;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        'column "bogus_metric" of relation "rolling_player_game_metrics" does not exist'
      );
      expect(typed.code).toBe("42703");
      expect(typed.details).toBe("Failing row contains an unknown column.");
      expect(typed.hint).toBe("Check generated types and migrations.");
      expect(typed.status).toBe(400);
      expect(typed.statusCode).toBe(400);
      expect(String(typed.responseText)).toContain("bogus_metric");
      return true;
    });
  });
});

describe("fetchRollingPlayerAverages resume behavior", () => {
  it("uses date-scoped player selection only for incremental date-bounded runs", () => {
    expect(
      shouldUseDateScopedPlayerSelection({
        startDate: "2026-03-14",
        endDate: "2026-03-14"
      })
    ).toBe(true);
    expect(
      shouldUseDateScopedPlayerSelection({
        season: 20252026,
        startDate: "2026-03-10",
        endDate: "2026-03-14"
      })
    ).toBe(true);
    expect(
      shouldUseDateScopedPlayerSelection({
        season: 20252026
      })
    ).toBe(false);
    expect(
      shouldUseDateScopedPlayerSelection({
        startDate: "2026-03-14",
        forceFullRefresh: true
      })
    ).toBe(false);
    expect(
      shouldUseDateScopedPlayerSelection({
        playerId: 8470613,
        startDate: "2026-03-14"
      })
    ).toBe(false);
  });

  it("normalizes player-id lists into sorted unique values", () => {
    expect(normalizePlayerIdList([8470613, 8478398, 8470613, 8485702])).toEqual([
      8470613,
      8478398,
      8485702
    ]);
  });

  it("does not infer an implicit auto-resume for broad runs", () => {
    expect(
      shouldWarnAboutDisabledImplicitAutoResume({
        playerId: undefined,
        season: undefined,
        startDate: undefined,
        endDate: undefined,
        forceFullRefresh: undefined,
        resumePlayerId: undefined
      })
    ).toBe(true);
    expect(filterPlayerIdsForResume([8478398, 8478402, 8485702])).toEqual([
      8478398,
      8478402,
      8485702
    ]);
  });

  it("still honors an explicit resume boundary when requested", () => {
    expect(
      shouldWarnAboutDisabledImplicitAutoResume({
        resumePlayerId: 8478402
      })
    ).toBe(false);
    expect(
      filterPlayerIdsForResume([8478398, 8478402, 8478403, 8485702], 8478402)
    ).toEqual([8478403, 8485702]);
  });
});
