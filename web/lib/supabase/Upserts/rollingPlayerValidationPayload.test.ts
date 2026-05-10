import { describe, expect, it } from "vitest";

import { __testables } from "./rollingPlayerValidationPayload";

describe("rollingPlayerValidationPayload metadata builders", () => {
  it.each([
    {
      label: "primary_assists",
      metric: {
        key: "primary_assists_avg_last5",
        family: "surface_counts",
        canonicalField: null,
        legacyFields: ["primary_assists_avg_last5"],
        supportFields: []
      },
      expected: {
        baseKey: "primary_assists",
        family: "surface_counts",
        windowFamily: "additive_performance",
        formula: "sum(first_assists)"
      }
    },
    {
      label: "secondary_assists",
      metric: {
        key: "secondary_assists_avg_last5",
        family: "surface_counts",
        canonicalField: null,
        legacyFields: ["secondary_assists_avg_last5"],
        supportFields: []
      },
      expected: {
        baseKey: "secondary_assists",
        family: "surface_counts",
        windowFamily: "additive_performance",
        formula: "sum(second_assists)"
      }
    },
    {
      label: "penalties_drawn",
      metric: {
        key: "penalties_drawn_avg_last5",
        family: "surface_counts",
        canonicalField: null,
        legacyFields: ["penalties_drawn_avg_last5"],
        supportFields: []
      },
      expected: {
        baseKey: "penalties_drawn",
        family: "surface_counts",
        windowFamily: "additive_performance",
        formula: "sum(penalties_drawn)"
      }
    },
    {
      label: "penalties_drawn_per_60",
      metric: {
        key: "penalties_drawn_per_60_last5",
        family: "weighted_rates",
        canonicalField: "penalties_drawn_per_60_last5",
        legacyFields: ["penalties_drawn_per_60_avg_last5"],
        supportFields: [
          "penalties_drawn_per_60_penalties_drawn_total_last5",
          "penalties_drawn_per_60_toi_seconds_total_last5"
        ]
      },
      expected: {
        baseKey: "penalties_drawn_per_60",
        family: "weighted_rates",
        windowFamily: "weighted_rate_performance",
        formula: "sum(penalties_drawn) / sum(toi_seconds) * 3600"
      }
    },
    {
      label: "pp_toi_seconds",
      metric: {
        key: "pp_toi_seconds_avg_last5",
        family: "pp_usage",
        canonicalField: null,
        legacyFields: ["pp_toi_seconds_avg_last5"],
        supportFields: []
      },
      expected: {
        baseKey: "pp_toi_seconds",
        family: "pp_usage",
        windowFamily: "additive_performance",
        formula: "sum(player_pp_toi_seconds)"
      }
    }
  ])("resolves formula metadata for optional metric family $label", ({ metric, expected }) => {
    const metadata = __testables.buildFormulaMetadata(metric as any);

    expect(metadata).toMatchObject({
      field: metric.key,
      baseKey: expected.baseKey,
      family: expected.family,
      windowFamily: expected.windowFamily,
      formula: expected.formula,
      formulaSource: "base"
    });
  });

  it("builds exact formula metadata for the selected metric", () => {
    const metadata = __testables.buildFormulaMetadata({
      key: "pp_share_pct_last5",
      family: "pp_usage",
      canonicalField: "pp_share_pct_last5",
      legacyFields: ["pp_share_pct_avg_last5"],
      supportFields: [
        "pp_share_pct_player_pp_toi_last5",
        "pp_share_pct_team_pp_toi_last5"
      ]
    });

    expect(metadata).toMatchObject({
      field: "pp_share_pct_last5",
      baseKey: "pp_share_pct",
      family: "pp_usage",
      windowFamily: "ratio_performance",
      formula:
        "sum(player_pp_toi_seconds) / sum(team_pp_toi_seconds_inferred_from_share)",
      formulaSource: "base",
      canonicalField: "pp_share_pct_last5",
      legacyFields: ["pp_share_pct_avg_last5"],
      supportFields: [
        "pp_share_pct_player_pp_toi_last5",
        "pp_share_pct_team_pp_toi_last5"
      ]
    });
  });

  it("includes metric source and unit contracts in validation metadata", () => {
    const contracts = __testables.buildContractMetadata(
      __testables.buildFormulaMetadata({
        key: "pp_share_pct_last5",
        family: "pp_usage",
        canonicalField: "pp_share_pct_last5",
        legacyFields: ["pp_share_pct_avg_last5"],
        supportFields: [
          "pp_share_pct_player_pp_toi_last5",
          "pp_share_pct_team_pp_toi_last5"
        ]
      })
    );

    expect(contracts?.helperSummaries.metricSourceUnits).toContainEqual(
      expect.objectContaining({
        metricKey: "pp_share_pct",
        unit: "fraction_0_to_1",
        primarySources: [
          "powerPlayCombinations.PPTOI",
          "powerPlayCombinations.pp_share_of_team"
        ]
      })
    );
    expect(contracts?.helperSummaries.metricSourceUnits).toContainEqual(
      expect.objectContaining({
        metricKey: "sog_per_60",
        unit: "count_per_60"
      })
    );
  });

  it("builds appearance-based window membership from row history for non-availability metrics", () => {
    const windows = __testables.buildWindowMembership({
      focusedRow: {
        game_id: 3,
        game_date: "2026-03-03",
        season: 20252026,
        team_id: 1,
        strength_state: "all"
      },
      formulaMetadata: {
        field: "goals_last3",
        baseKey: "goals",
        family: "surface_counts",
        windowFamily: "additive_performance",
        formula: "sum(raw source values across the selected scope)",
        formulaSource: "family_default",
        canonicalField: "goals_last3",
        legacyFields: [],
        supportFields: []
      },
      storedRows: [],
      recomputedRows: [
        {
          game_id: 1,
          game_date: "2026-03-01",
          season: 20252026,
          team_id: 1,
          strength: "all"
        },
        {
          game_id: 2,
          game_date: "2026-03-02",
          season: 20252026,
          team_id: 1,
          strength: "all"
        },
        {
          game_id: 3,
          game_date: "2026-03-03",
          season: 20252026,
          team_id: 1,
          strength: "all"
        }
      ],
      sourceData: null,
      request: {
        playerId: 1,
        season: 20252026,
        strength: "all"
      }
    });

    expect(windows).toMatchObject({
      focusedRowKey: "2026-03-03:all:3",
      selectedMetricFamily: "surface_counts",
      selectedWindowFamily: "additive_performance"
    });
    expect(windows?.memberships?.last3.selectionMode).toBe("appearance_rows");
    expect(windows?.memberships?.last3.members.map((row) => row.gameId)).toEqual([
      1, 2, 3
    ]);
  });

  it("builds availability windows from the team-game ledger instead of appearance rows", () => {
    const windows = __testables.buildWindowMembership({
      focusedRow: {
        game_id: 13,
        game_date: "2026-03-13",
        season: 20252026,
        team_id: 1,
        strength_state: "all"
      },
      formulaMetadata: {
        field: "availability_pct_last3_team_games",
        baseKey: "availability_pct_last3_team_games",
        family: "availability",
        windowFamily: "availability",
        formula: "availability or participation numerator / denominator support fields",
        formulaSource: "family_default",
        canonicalField: "availability_pct_last3_team_games",
        legacyFields: [],
        supportFields: []
      },
      storedRows: [
        {
          player_id: 1,
          game_id: 13,
          game_date: "2026-03-13",
          season: 20252026,
          team_id: 1,
          strength_state: "all"
        } as any
      ],
      recomputedRows: [],
      sourceData: {
        games: [
          { id: 11, date: "2026-03-11", homeTeamId: 1, awayTeamId: 2, seasonId: 20252026 },
          { id: 12, date: "2026-03-12", homeTeamId: 3, awayTeamId: 1, seasonId: 20252026 },
          { id: 13, date: "2026-03-13", homeTeamId: 1, awayTeamId: 4, seasonId: 20252026 }
        ],
        knownGameIds: [11, 12, 13],
        wgoRows: [
          { game_id: 11 },
          { game_id: 13 }
        ] as any,
        ppRows: [],
        lineRows: [],
        byStrength: {} as any
      },
      request: {
        playerId: 1,
        season: 20252026,
        strength: "all"
      }
    });

    expect(windows?.memberships?.last3.selectionMode).toBe("team_games");
    expect(windows?.memberships?.last3.members.map((row) => row.gameId)).toEqual([
      11, 12, 13
    ]);
    expect(
      windows?.memberships?.last3.members.map((row) => row.hasPlayerAppearance)
    ).toEqual([true, false, true]);
  });

  it("builds per-row TOI traces with candidate sources, fallback seed, and rejected candidates", () => {
    const rows = __testables.buildToiTraceRows([
      {
        gameId: 2025031101,
        gameDate: "2026-03-11",
        season: 20252026,
        teamId: 1,
        strength: "all",
        counts: { toi: -1 },
        countsOi: { toi: 1100 },
        rates: { toi_per_gp: 950 },
        wgo: { toi_per_game: 18.5 }
      } as any
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowKey: "2026-03-11:all:2025031101",
      gameId: 2025031101,
      gameDate: "2026-03-11",
      strength: "all",
      rawCandidates: {
        countsToi: -1,
        countsOiToi: 1100,
        ratesToiPerGp: 950,
        wgoToiPerGame: 18.5
      },
      fallbackSeed: {
        seconds: 1100,
        source: "counts_oi"
      },
      resolved: {
        seconds: 1100,
        source: "counts_oi",
        trustTier: "authoritative"
      }
    });
    expect(rows[0].fallbackSeed.rejectedCandidates).toContainEqual({
      source: "counts",
      reason: "non_positive"
    });
    expect(rows[0].resolved.rejectedCandidates).toContainEqual({
      source: "counts",
      reason: "non_positive"
    });
    expect(rows[0].suspiciousNotes).toContain(
      "fallback-seed counts rejected: non_positive"
    );
  });

  it("builds PP-share provenance rows and flags mixed-source windows", () => {
    const ppShareTraceRows = __testables.buildPpShareTraceRows([
      {
        gameId: 1,
        gameDate: "2026-03-09",
        season: 20252026,
        teamId: 1,
        strength: "all",
        ppCombination: {
          PPTOI: 120,
          pp_share_of_team: 0.4
        }
      } as any,
      {
        gameId: 2,
        gameDate: "2026-03-10",
        season: 20252026,
        teamId: 1,
        strength: "all",
        wgo: {
          pp_toi: 80,
          pp_toi_pct_per_game: 0.25
        }
      } as any,
      {
        gameId: 3,
        gameDate: "2026-03-11",
        season: 20252026,
        teamId: 1,
        strength: "all",
        ppCombination: {
          PPTOI: 90,
          pp_share_of_team: 0.3
        }
      } as any
    ]);

    expect(ppShareTraceRows.map((row) => row.chosen.source)).toEqual([
      "builder",
      "wgo",
      "builder"
    ]);
    expect(ppShareTraceRows[0].builder.teamPpToiInferred).toBe(300);
    expect(ppShareTraceRows[1].wgo.teamPpToiInferred).toBe(320);

    const summary = __testables.buildPpShareWindowSummary({
      focusedRow: {
        game_id: 3,
        game_date: "2026-03-11",
        season: 20252026,
        team_id: 1,
        strength_state: "all"
      },
      ppShareTraceRows
    });

    expect(summary?.last3.sourcesUsed).toEqual(["builder", "wgo"]);
    expect(summary?.last3.mixedSourceWindow).toBe(true);
    expect(summary?.last3.memberSources.map((row) => row.gameId)).toEqual([
      1, 2, 3
    ]);
    expect(summary?.last3.memberSources.map((row) => row.source)).toEqual([
      "builder",
      "wgo",
      "builder"
    ]);
  });

  it("builds focused-row comparison matrices and family summaries", () => {
    const focusedRow = __testables.buildFocusedRowComparisons({
      storedRow: {
        game_id: 3,
        game_date: "2026-03-11",
        season: 20252026,
        team_id: 1,
        strength_state: "all",
        pp_share_pct_last5: 0.52,
        pp_share_pct_avg_last5: 0.52,
        pp_share_pct_player_pp_toi_last5: 156
      },
      recomputedRow: {
        game_id: 3,
        game_date: "2026-03-11",
        season: 20252026,
        team_id: 1,
        strength: "all",
        pp_share_pct_last5: 0.495,
        pp_share_pct_avg_last5: 0.495,
        pp_share_pct_player_pp_toi_last5: 149
      },
      selectedMetric: {
        key: "pp_share_pct_last5",
        family: "pp_usage",
        canonicalField: "pp_share_pct_last5",
        legacyFields: ["pp_share_pct_avg_last5"],
        supportFields: ["pp_share_pct_player_pp_toi_last5"]
      },
      selectedMetricField: "pp_share_pct_last5",
      readiness: {
        status: "READY_WITH_CAUTIONS",
        blockerReasons: [],
        cautionReasons: ["mixed-source PP window"],
        nextRecommendedAction: null
      },
      sourceTailFreshness: null,
      latestStoredGameDate: "2026-03-11",
      latestRecomputedGameDate: "2026-03-11"
    });

    expect(focusedRow?.selectedMetric).toMatchObject({
      field: "pp_share_pct_last5",
      storedValue: 0.52,
      recomputedValue: 0.495,
      diff: 0.025,
      absoluteDiff: 0.025,
      signedDiff: 0.025,
      valuesMatch: false,
      mismatchCauseBucket: "logic defect"
    });
    expect(
      focusedRow?.comparisonMatrix.map((entry: { field: string }) => entry.field)
    ).toEqual(
      expect.arrayContaining([
        "pp_share_pct_last5",
        "pp_share_pct_avg_last5",
        "pp_share_pct_player_pp_toi_last5"
      ])
    );
    expect(focusedRow?.supportComparisons).toContainEqual({
      field: "pp_share_pct_player_pp_toi_last5",
      storedValue: 156,
      recomputedValue: 149,
      valuesMatch: false
    });

    const familySummary = __testables.buildFamilyComparisonSummary({
      storedRows: [
        {
          player_id: 1,
          game_id: 2,
          game_date: "2026-03-10",
          season: 20252026,
          team_id: 1,
          strength_state: "all",
          pp_share_pct_last5: 0.5
        },
        {
          player_id: 1,
          game_id: 3,
          game_date: "2026-03-11",
          season: 20252026,
          team_id: 1,
          strength_state: "all",
          pp_share_pct_last5: 0.52
        }
      ] as any,
      recomputedRows: [
        {
          player_id: 1,
          game_id: 2,
          game_date: "2026-03-10",
          season: 20252026,
          team_id: 1,
          strength: "all",
          pp_share_pct_last5: 0.5
        },
        {
          player_id: 1,
          game_id: 3,
          game_date: "2026-03-11",
          season: 20252026,
          team_id: 1,
          strength: "all",
          pp_share_pct_last5: 0.495
        }
      ],
      selectedMetricFamily: "pp_usage"
    });

    expect(familySummary).toMatchObject({
      selectedMetricFamily: "pp_usage",
      rowCountCompared: 2,
      fieldCountCompared: 1,
      mismatchFieldCount: 1,
      mismatchRowCount: 1
    });
    expect(familySummary?.metrics[0]).toMatchObject({
      field: "pp_share_pct_last5",
      mismatchedRows: 1,
      comparedRows: 2,
      latestDiff: 0.025,
      valuesMatch: false
    });
  });

  it("derives payload-only support traces for on_ice_sv_pct from oi_sa and oi_ga companions", () => {
    const metadata = __testables.inferMetricMetadata(
      {
        on_ice_sv_pct_last5: 95,
        oi_sa_total_last5: 100,
        oi_ga_total_last5: 5
      },
      "on_ice_sv_pct_last5",
      "on_ice_context"
    );

    expect(metadata.supportFields).toEqual(
      expect.arrayContaining(["oi_sa_total_last5", "oi_ga_total_last5"])
    );

    const focusedRow = __testables.buildFocusedRowComparisons({
      storedRow: {
        game_id: 3,
        game_date: "2026-03-11",
        season: 20252026,
        team_id: 1,
        strength_state: "all",
        on_ice_sv_pct_last5: 95,
        oi_sa_total_last5: 100,
        oi_ga_total_last5: 5
      },
      recomputedRow: {
        game_id: 3,
        game_date: "2026-03-11",
        season: 20252026,
        team_id: 1,
        strength: "all",
        on_ice_sv_pct_last5: 94.5,
        oi_sa_total_last5: 110,
        oi_ga_total_last5: 6
      },
      selectedMetric: metadata,
      selectedMetricField: "on_ice_sv_pct_last5",
      readiness: {
        status: "READY_WITH_CAUTIONS",
        blockerReasons: [],
        cautionReasons: [],
        nextRecommendedAction: null
      },
      sourceTailFreshness: null,
      latestStoredGameDate: "2026-03-11",
      latestRecomputedGameDate: "2026-03-11"
    });

    expect(focusedRow?.supportComparisons).toEqual(
      expect.arrayContaining([
        {
          field: "oi_sa_total_last5",
          storedValue: 100,
          recomputedValue: 110,
          valuesMatch: false
        },
        {
          field: "oi_ga_total_last5",
          storedValue: 5,
          recomputedValue: 6,
          valuesMatch: false
        },
        {
          field: "on_ice_sv_pct_saves_total_last5",
          storedValue: 95,
          recomputedValue: 104,
          valuesMatch: false
        }
      ])
    );
  });

  it("derives payload-only weighted-rate support traces for lastN scopes from existing row companions", () => {
    const goalsMetadata = __testables.inferMetricMetadata(
      {
        goals_per_60_last5: 4,
        goals_total_last5: 2,
        toi_seconds_total_last5: 1800
      },
      "goals_per_60_last5",
      "weighted_rates"
    );

    expect(goalsMetadata.supportFields).toEqual(
      expect.arrayContaining([
        "goals_per_60_goals_total_last5",
        "goals_per_60_toi_seconds_total_last5"
      ])
    );

    const goalsFocusedRow = __testables.buildFocusedRowComparisons({
      storedRow: {
        game_id: 3,
        game_date: "2026-03-11",
        season: 20252026,
        team_id: 1,
        strength_state: "all",
        goals_per_60_last5: 4,
        goals_total_last5: 2,
        toi_seconds_total_last5: 1800
      },
      recomputedRow: {
        game_id: 3,
        game_date: "2026-03-11",
        season: 20252026,
        team_id: 1,
        strength: "all",
        goals_per_60_last5: 5.4,
        goals_total_last5: 3,
        toi_seconds_total_last5: 2000
      },
      selectedMetric: goalsMetadata,
      selectedMetricField: "goals_per_60_last5",
      readiness: {
        status: "READY_WITH_CAUTIONS",
        blockerReasons: [],
        cautionReasons: [],
        nextRecommendedAction: null
      },
      sourceTailFreshness: null,
      latestStoredGameDate: "2026-03-11",
      latestRecomputedGameDate: "2026-03-11"
    });

    expect(goalsFocusedRow?.supportComparisons).toEqual(
      expect.arrayContaining([
        {
          field: "goals_per_60_goals_total_last5",
          storedValue: 2,
          recomputedValue: 3,
          valuesMatch: false
        },
        {
          field: "goals_per_60_toi_seconds_total_last5",
          storedValue: 1800,
          recomputedValue: 2000,
          valuesMatch: false
        }
      ])
    );

    const primaryAssistMetadata = __testables.inferMetricMetadata(
      {
        primary_assists_per_60_last5: 4,
        toi_seconds_total_last5: 900
      },
      "primary_assists_per_60_last5",
      "weighted_rates"
    );

    expect(primaryAssistMetadata.supportFields).toEqual(
      expect.arrayContaining([
        "primary_assists_per_60_primary_assists_total_last5",
        "primary_assists_per_60_toi_seconds_total_last5"
      ])
    );

    const primaryAssistFocusedRow = __testables.buildFocusedRowComparisons({
      storedRow: {
        game_id: 3,
        game_date: "2026-03-11",
        season: 20252026,
        team_id: 1,
        strength_state: "all",
        primary_assists_per_60_last5: 4,
        toi_seconds_total_last5: 900
      },
      recomputedRow: {
        game_id: 3,
        game_date: "2026-03-11",
        season: 20252026,
        team_id: 1,
        strength: "all",
        primary_assists_per_60_last5: 8,
        toi_seconds_total_last5: 900
      },
      selectedMetric: primaryAssistMetadata,
      selectedMetricField: "primary_assists_per_60_last5",
      readiness: {
        status: "READY_WITH_CAUTIONS",
        blockerReasons: [],
        cautionReasons: [],
        nextRecommendedAction: null
      },
      sourceTailFreshness: null,
      latestStoredGameDate: "2026-03-11",
      latestRecomputedGameDate: "2026-03-11"
    });

    expect(primaryAssistFocusedRow?.supportComparisons).toEqual(
      expect.arrayContaining([
        {
          field: "primary_assists_per_60_primary_assists_total_last5",
          storedValue: 1,
          recomputedValue: 2,
          valuesMatch: false
        },
        {
          field: "primary_assists_per_60_toi_seconds_total_last5",
          storedValue: 900,
          recomputedValue: 900,
          valuesMatch: true
        }
      ])
    );
  });

  it("preserves persisted weighted-rate support aliases for historical scopes", () => {
    const metadata = __testables.inferMetricMetadata(
      {
        goals_per_60_season: 2.5,
        goals_per_60_goals_season: 10,
        goals_per_60_toi_seconds_season: 14400
      },
      "goals_per_60_season",
      "weighted_rates"
    );

    expect(metadata.supportFields).toEqual(
      expect.arrayContaining([
        "goals_per_60_goals_season",
        "goals_per_60_toi_seconds_season"
      ])
    );

    const focusedRow = __testables.buildFocusedRowComparisons({
      storedRow: {
        game_id: 3,
        game_date: "2026-03-11",
        season: 20252026,
        team_id: 1,
        strength_state: "all",
        goals_per_60_season: 2.5,
        goals_per_60_goals_season: 10,
        goals_per_60_toi_seconds_season: 14400
      },
      recomputedRow: {
        game_id: 3,
        game_date: "2026-03-11",
        season: 20252026,
        team_id: 1,
        strength: "all",
        goals_per_60_season: 2.75,
        goals_per_60_goals_season: 11,
        goals_per_60_toi_seconds_season: 14400
      },
      selectedMetric: metadata,
      selectedMetricField: "goals_per_60_season",
      readiness: {
        status: "READY",
        blockerReasons: [],
        cautionReasons: [],
        nextRecommendedAction: null
      },
      sourceTailFreshness: null,
      latestStoredGameDate: "2026-03-11",
      latestRecomputedGameDate: "2026-03-11"
    });

    expect(focusedRow?.supportComparisons).toEqual(
      expect.arrayContaining([
        {
          field: "goals_per_60_goals_season",
          storedValue: 10,
          recomputedValue: 11,
          valuesMatch: false
        },
        {
          field: "goals_per_60_toi_seconds_season",
          storedValue: 14400,
          recomputedValue: 14400,
          valuesMatch: true
        }
      ])
    );
  });

  it("builds a reusable diagnostics snapshot from raw helper summaries", () => {
    const snapshot = __testables.buildDiagnosticsSnapshot({
      coverage: {
        warnings: ["coverage warning"],
        sample: {
          missingCountsDates: ["2026-03-10"],
          missingRatesDates: [],
          missingCountsOiDates: [],
          missingPpGameIds: [],
          missingPpShareGameIds: [],
          missingPpUnitGameIds: [],
          unknownGameIds: [999]
        },
        ppCoverage: {
          expectedGameIds: [2025031101],
          missingPpGameIds: [],
          missingPpShareGameIds: [],
          latestExpectedPpGameId: 2025031101,
          latestBuilderGameCovered: true,
          latestShareGameCovered: true,
          windowBuilderCoverageComplete: true,
          windowShareCoverageComplete: true
        },
        counts: {
          expectedDates: 2,
          countsRows: 1,
          ratesRows: 2,
          countsOiRows: 2,
          ppExpectedGames: 1,
          ppRows: 1,
          ppShareMissingGames: 0,
          ppUnitMissingGames: 0,
          unknownGameIds: 1
        }
      },
      sourceTailFreshness: {
        warnings: ["pp tail lag"],
        blockers: {
          countsTailLag: 0,
          ratesTailLag: 0,
          countsOiTailLag: 0,
          ppTailLag: 1,
          lineTailLag: 0
        },
        latest: {
          wgoDate: "2026-03-11",
          countsDate: "2026-03-11",
          ratesDate: "2026-03-11",
          countsOiDate: "2026-03-11",
          expectedPpGameId: 2025031101,
          ppGameId: 2025031001,
          expectedLineGameId: 2025031101,
          lineGameId: 2025031101
        }
      },
      derivedWindowCompleteness: {
        gpWindows: {
          season: { complete: 0, partial: 1, absent: 0, invalid: 0 },
          "3ya": { complete: 1, partial: 0, absent: 0, invalid: 0 },
          career: { complete: 1, partial: 0, absent: 0, invalid: 0 },
          last3: { complete: 1, partial: 0, absent: 0, invalid: 0 },
          last5: { complete: 1, partial: 0, absent: 0, invalid: 0 },
          last10: { complete: 1, partial: 0, absent: 0, invalid: 0 },
          last20: { complete: 1, partial: 0, absent: 0, invalid: 0 }
        },
        ratioWindows: {
          primary_points_pct: {
            last3: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 },
            last5: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 },
            last10: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 },
            last20: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 }
          },
          ipp: {
            last3: { complete: 0, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 1 },
            last5: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 },
            last10: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 },
            last20: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 }
          },
          on_ice_sh_pct: {
            last3: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 },
            last5: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 },
            last10: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 },
            last20: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 }
          },
          pp_share_pct: {
            last3: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 },
            last5: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 },
            last10: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 },
            last20: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 }
          },
          pdo: {
            last3: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 },
            last5: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 },
            last10: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 },
            last20: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 }
          }
        }
      },
      suspiciousOutputs: {
        issueCount: 1,
        warnings: ["suspicious output"]
      },
      targetFreshness: {
        latestStoredGameDate: "2026-03-10",
        latestRecomputedGameDate: "2026-03-11",
        latestSourceDate: "2026-03-11",
        storedRowCount: 1,
        recomputedRowCount: 1
      },
      selectedMetricFamily: "finishing",
      selectedMetricBaseKey: "ipp"
    });

    expect(snapshot).toMatchObject({
      overallStatus: "blocked",
      blockerCount: 2,
      cautionCount: 3,
      categories: {
        coverage: {
          status: "blocked",
          unknownGameIds: 1,
          ppCoverage: {
            latestExpectedPpGameId: 2025031101,
            latestBuilderGameCovered: true,
            windowBuilderCoverageComplete: true
          }
        },
        freshness: {
          status: "blocked",
          issueCount: 1
        },
        completeness: {
          status: "caution",
          gpIssueCount: 1,
          ratioIssueCount: 1,
          impactedGpScopes: ["season"],
          impactedRatioFamilies: ["ipp"],
          selectedMetric: {
            family: "ipp",
            states: {
              last3: {
                state: "valuePresentWithoutComponents"
              }
            }
          }
        },
        suspiciousOutputs: {
          status: "caution",
          issueCount: 1
        },
        targetFreshness: {
          status: "caution"
        }
      }
    });
    expect(snapshot?.highlights).toEqual(
      expect.arrayContaining([
        "1 unknown game ID(s) detected",
        "pp tail lag 1",
        "1 suspicious output issue(s)"
      ])
    );
    expect(snapshot?.categories.completeness.ratioFamilies.ipp?.last3).toMatchObject({
      state: "valuePresentWithoutComponents",
      counts: {
        valuePresentWithoutComponents: 1
      }
    });
  });

  it("keeps readiness at READY_WITH_CAUTIONS when PP latest game is covered but the window is not fully covered", () => {
    const readiness = __testables.buildReadiness({
      recomputeError: null,
      coverage: {
        warnings: [],
        sample: {
          missingCountsDates: [],
          missingRatesDates: [],
          missingCountsOiDates: [],
          missingPpGameIds: [2025030901],
          missingPpShareGameIds: [2025030901],
          missingPpUnitGameIds: [],
          unknownGameIds: []
        },
        ppCoverage: {
          expectedGameIds: [2025030901, 2025031001, 2025031101],
          missingPpGameIds: [2025030901],
          missingPpShareGameIds: [2025030901],
          latestExpectedPpGameId: 2025031101,
          latestBuilderGameCovered: true,
          latestShareGameCovered: true,
          windowBuilderCoverageComplete: false,
          windowShareCoverageComplete: false
        },
        counts: {
          expectedDates: 3,
          countsRows: 3,
          ratesRows: 3,
          countsOiRows: 3,
          ppExpectedGames: 3,
          ppRows: 2,
          ppShareMissingGames: 1,
          ppUnitMissingGames: 0,
          unknownGameIds: 0
        }
      },
      sourceTailFreshness: {
        warnings: [],
        blockers: {
          countsTailLag: 0,
          ratesTailLag: 0,
          countsOiTailLag: 0,
          ppTailLag: 0,
          lineTailLag: 0
        },
        latest: {
          wgoDate: "2026-03-11",
          countsDate: "2026-03-11",
          ratesDate: "2026-03-11",
          countsOiDate: "2026-03-11",
          expectedPpGameId: 2025031101,
          ppGameId: 2025031101,
          expectedLineGameId: 2025031101,
          lineGameId: 2025031101
        }
      },
      suspiciousOutputs: {
        issueCount: 0,
        warnings: []
      },
      storedRows: [{} as any],
      recomputedRows: [{}]
    });

    expect(readiness).toMatchObject({
      status: "READY_WITH_CAUTIONS",
      blockerReasons: [],
      nextRecommendedAction:
        "Inspect PP builder/share coverage gaps before treating PP validation as signoff-ready."
    });
    expect(readiness.cautionReasons).toEqual(
      expect.arrayContaining([
        "PP builder latest game is covered, but the selected window is still missing builder rows: 2025030901",
        "PP share latest game is covered, but the selected window is still missing share coverage: 2025030901"
      ])
    );
  });
});
