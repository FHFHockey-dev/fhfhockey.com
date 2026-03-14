import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { supabaseFromMock } = vi.hoisted(() => ({
  supabaseFromMock: vi.fn()
}));

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("lib/supabase/client", () => ({
  default: {
    from: supabaseFromMock
  }
}));

import TrendsDebugPage from "./trendsDebug";

const validationPayload = {
  generatedAt: "2026-03-12T12:00:00.000Z",
  request: {
    playerId: 8478402,
    season: 20252026,
    strength: "all",
    teamId: null,
    gameId: null,
    gameDate: null,
    startDate: null,
    endDate: null,
    metric: null,
    metricFamily: null
  },
  selected: {
    player: {
      id: 8478402,
      fullName: "Jesper Bratt",
      position: "RW"
    },
    focusedRow: {
      rowKey: "2026-03-11:all:2025031101",
      gameId: 2025031101,
      gameDate: "2026-03-11",
      strength: "all",
      season: 20252026,
      teamId: 1
    },
    metric: {
      key: "pp_share_pct_last5",
      family: "pp_usage",
      canonicalField: "pp_share_pct_last5",
      legacyFields: ["pp_share_pct_avg_last5"],
      supportFields: [
        "pp_share_pct_player_pp_toi_last5",
        "pp_share_pct_team_pp_toi_last5"
      ]
    }
  },
  readiness: {
    status: "BLOCKED",
    blockerReasons: ["ppTailLag > 0", "rolling rows stale"],
    cautionReasons: ["mixed-source PP window"],
    nextRecommendedAction:
      "Refresh powerPlayCombinations and recompute rolling_player_game_metrics."
  },
  stored: {
    focusedRow: {
      player_id: 8478402,
      game_id: 2025031101,
      game_date: "2026-03-11",
      season: 20252026,
      team_id: 1,
      strength_state: "all",
      pp_share_pct_last5: 0.52,
      pp_share_pct_player_pp_toi_last5: 156,
      pp_share_pct_team_pp_toi_last5: 300
    },
    rowHistory: [
      {
        player_id: 8478402,
        game_id: 2025031101,
        game_date: "2026-03-11",
        season: 20252026,
        team_id: 1,
        strength_state: "all",
        pp_share_pct_last5: 0.52,
        pp_share_pct_player_pp_toi_last5: 156,
        pp_share_pct_team_pp_toi_last5: 300
      }
    ]
  },
  recomputed: {
    focusedRow: {
      player_id: 8478402,
      game_id: 2025031101,
      game_date: "2026-03-11",
      season: 20252026,
      team_id: 1,
      strength: "all",
      pp_share_pct_last5: 0.495,
      pp_share_pct_player_pp_toi_last5: 149,
      pp_share_pct_team_pp_toi_last5: 301
    },
    rowHistory: [
      {
        player_id: 8478402,
        game_id: 2025031101,
        game_date: "2026-03-11",
        season: 20252026,
        team_id: 1,
        strength: "all",
        pp_share_pct_last5: 0.495,
        pp_share_pct_player_pp_toi_last5: 149,
        pp_share_pct_team_pp_toi_last5: 301
      }
    ],
    error: null
  },
  sourceRows: {
    shared: {
      wgoRows: [
        {
          game_date: "2026-03-11",
          pp_toi: 152,
          pp_toi_pct_per_game: 0.49
        }
      ],
      ppRows: [],
      lineRows: [],
      games: [{ game_date: "2026-03-11", game_id: 2025031101 }]
    },
    selectedStrength: {
      countsRows: [],
      ratesRows: [],
      countsOiRows: [],
      mergedGames: [
        {
          game_date: "2026-03-11",
          game_id: 2025031101,
          strength: "all",
          ppCombination: {
            PPTOI: 31.2,
            pp_share_of_team: 0.52
          },
          sourceContext: {
            countsSourcePresent: true,
            ratesSourcePresent: true,
            countsOiSourcePresent: true,
            resolvedToiSource: "counts",
            fallbackToiSource: "wgo",
            toiTrustTier: "trusted",
            wgoToiNormalization: "minutes_to_seconds",
            ppUnitSourcePresent: true,
            lineSourcePresent: false,
            lineAssignmentSourcePresent: false
          }
        }
      ],
      toiTraceRows: [
        {
          rowKey: "2026-03-11:all:2025031101",
          gameId: 2025031101,
          gameDate: "2026-03-11",
          strength: "all",
          rawCandidates: {
            countsToi: 1200,
            countsOiToi: 1200,
            ratesToiPerGp: 1200,
            wgoToiPerGame: 20
          },
          fallbackSeed: {
            seconds: 1200,
            source: "counts",
            rejectedCandidates: [],
            wgoNormalization: "minutes_to_seconds"
          },
          resolved: {
            seconds: 1200,
            source: "counts",
            trustTier: "authoritative",
            rejectedCandidates: [],
            wgoNormalization: "missing"
          },
          suspiciousNotes: []
        }
      ],
      ppShareTraceRows: [
        {
          rowKey: "2026-03-11:all:2025031101",
          gameId: 2025031101,
          gameDate: "2026-03-11",
          strength: "all",
          builder: {
            playerPpToi: 156,
            share: 0.52,
            teamPpToiInferred: 300,
            valid: true
          },
          wgo: {
            playerPpToi: 152,
            share: 0.49,
            teamPpToiInferred: 310.204082,
            valid: true
          },
          chosen: {
            source: "builder",
            playerPpToi: 156,
            share: 0.52,
            teamPpToiInferred: 300
          }
        }
      ],
      ppShareWindowSummary: {
        last3: {
          windowSize: 3,
          sourcesUsed: ["builder", "wgo"],
          mixedSourceWindow: true,
          missingSourceGameIds: [],
          memberSources: [
            {
              rowKey: "2026-03-09:all:2025030901",
              gameId: 2025030901,
              gameDate: "2026-03-09",
              source: "wgo"
            },
            {
              rowKey: "2026-03-10:all:2025031001",
              gameId: 2025031001,
              gameDate: "2026-03-10",
              source: "builder"
            },
            {
              rowKey: "2026-03-11:all:2025031101",
              gameId: 2025031101,
              gameDate: "2026-03-11",
              source: "builder"
            }
          ]
        },
        last5: {
          windowSize: 5,
          sourcesUsed: ["builder", "wgo"],
          mixedSourceWindow: true,
          missingSourceGameIds: [],
          memberSources: []
        },
        last10: {
          windowSize: 10,
          sourcesUsed: ["builder", "wgo"],
          mixedSourceWindow: true,
          missingSourceGameIds: [],
          memberSources: []
        },
        last20: {
          windowSize: 20,
          sourcesUsed: ["builder", "wgo"],
          mixedSourceWindow: true,
          missingSourceGameIds: [],
          memberSources: []
        }
      }
    }
  },
  diagnostics: {
    coverage: {
      warnings: ["PP builder missing one trailing game."],
      sample: {
        missingCountsDates: [],
        missingRatesDates: [],
        missingCountsOiDates: [],
        missingPpGameIds: [2025031101],
        missingPpShareGameIds: [2025030901],
        missingPpUnitGameIds: [],
        unknownGameIds: []
      },
      ppCoverage: {
        expectedGameIds: [2025030901, 2025031001, 2025031101],
        missingPpGameIds: [2025031101],
        missingPpShareGameIds: [2025030901],
        latestExpectedPpGameId: 2025031101,
        latestBuilderGameCovered: false,
        latestShareGameCovered: true,
        windowBuilderCoverageComplete: false,
        windowShareCoverageComplete: false
      },
      counts: {
        expectedDates: 1,
        countsRows: 1,
        ratesRows: 1,
        countsOiRows: 1,
        ppExpectedGames: 1,
        ppRows: 1,
        ppShareMissingGames: 1,
        ppUnitMissingGames: 0,
        unknownGameIds: 0
      }
    },
    sourceTailFreshness: {
      warnings: ["pp tail lag"],
      countsTailLag: 0,
      ratesTailLag: 0,
      countsOiTailLag: 0,
      ppTailLag: 1,
      lineTailLag: 0,
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
        season: { complete: 1, partial: 0, absent: 0, invalid: 0 },
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
      issueCount: 0,
      warnings: []
    },
    targetFreshness: {
      latestStoredGameDate: "2026-03-11",
      latestRecomputedGameDate: "2026-03-11",
      latestSourceDate: "2026-03-10",
      storedRowCount: 1,
      recomputedRowCount: 1
    },
    snapshot: {
      overallStatus: "blocked",
      blockerCount: 1,
      cautionCount: 2,
      highlights: [
        "1 coverage warning(s) present",
        "pp tail lag 1",
        "1 ratio support completeness issue(s)"
      ],
      categories: {
        coverage: {
          status: "caution",
          issueCount: 3,
          highlights: ["1 coverage warning(s) present"],
          warningCount: 1,
          unknownGameIds: 0,
          ppCoverage: {
            latestExpectedPpGameId: 2025031101,
            latestBuilderGameCovered: false,
            latestShareGameCovered: true,
            windowBuilderCoverageComplete: false,
            windowShareCoverageComplete: false,
            missingPpGameIds: [2025031101],
            missingPpShareGameIds: [2025030901]
          }
        },
        freshness: {
          status: "blocked",
          issueCount: 1,
          highlights: ["pp tail lag 1"],
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
        completeness: {
          status: "caution",
          issueCount: 1,
          highlights: ["1 ratio support completeness issue(s)", "impacted ratio families: ipp"],
          gpIssueCount: 0,
          ratioIssueCount: 1,
          impactedGpScopes: [],
          impactedRatioFamilies: ["ipp"],
          ratioFamilies: {
            primary_points_pct: {
              last3: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } },
              last5: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } },
              last10: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } },
              last20: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } }
            },
            ipp: {
              last3: { state: "valuePresentWithoutComponents", counts: { complete: 0, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 1 } },
              last5: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } },
              last10: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } },
              last20: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } }
            },
            on_ice_sh_pct: {
              last3: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } },
              last5: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } },
              last10: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } },
              last20: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } }
            },
            pp_share_pct: {
              last3: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } },
              last5: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } },
              last10: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } },
              last20: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } }
            },
            pdo: {
              last3: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } },
              last5: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } },
              last10: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } },
              last20: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } }
            }
          },
          selectedMetric: {
            family: "pp_share_pct",
            states: {
              last3: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } },
              last5: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } },
              last10: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } },
              last20: { state: "complete", counts: { complete: 1, partial: 0, absent: 0, invalid: 0, valuePresentWithoutComponents: 0 } }
            }
          }
        },
        suspiciousOutputs: {
          status: "clean",
          issueCount: 0,
          highlights: [],
          warningCount: 0
        },
        targetFreshness: {
          status: "clean",
          issueCount: 0,
          highlights: [],
          latestStoredGameDate: "2026-03-11",
          latestRecomputedGameDate: "2026-03-11",
          latestSourceDate: "2026-03-10",
          storedRowCount: 1,
          recomputedRowCount: 1
        }
      }
    }
  },
  contracts: {
    selectedMetricFamily: "pp_usage",
    selectedWindowFamily: "ratio_performance",
    windowContract: {
      family: "ratio_performance",
      selectionUnit: "chronological_appearances_in_strength_state",
      aggregationMethod: "ratio_of_aggregated_components_over_selected_appearances",
      missingComponentPolicy: {
        selectedWindowSlotBehavior: "selected_slot_always_counts",
        missingNumeratorBehavior: "coerce_to_zero_when_denominator_present",
        missingDenominatorBehavior: "exclude_components_but_keep_selected_slot"
      },
      contractSummary:
        "Last N means the player's last N chronological appearances in the relevant strength state, then aggregate numerator and denominator components inside that fixed appearance window."
    },
    helperSummaries: {
      availability: {},
      ppShare: {},
      ppUnit: {},
      lineContext: {},
      toi: {
        sourcePriority: ["counts", "counts_oi", "rates", "fallback", "wgo"],
        trustTiers: ["authoritative", "supplementary", "fallback", "none"],
        fallbackSeedPriority: ["counts", "counts_oi", "wgo", "none"],
        summary:
          "TOI prefers counts, then counts-on-ice, then rates, then fallback seed, then WGO normalization."
      },
      sourceSelection: {
        additiveMetrics: ["goals", "assists", "shots"],
        authoritySummary:
          "Additive metrics prefer NST counts and fall back to WGO only where the current contract allows it."
      }
    }
  },
  formulas: {
    selectedMetric: {
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
    }
  },
  windows: {
    focusedRowKey: "2026-03-11:all:2025031101",
    selectedMetricFamily: "pp_usage",
    selectedWindowFamily: "ratio_performance",
    memberships: {
      last3: {
        windowSize: 3,
        selectionMode: "appearance_rows",
        members: [
          {
            rowKey: "2026-03-09:all:2025030901",
            gameId: 2025030901,
            gameDate: "2026-03-09",
            season: 20252026,
            teamId: 1,
            strength: "all",
            source: "appearance",
            occupiesSelectedSlot: true,
            hasPlayerAppearance: true
          },
          {
            rowKey: "2026-03-10:all:2025031001",
            gameId: 2025031001,
            gameDate: "2026-03-10",
            season: 20252026,
            teamId: 1,
            strength: "all",
            source: "appearance",
            occupiesSelectedSlot: true,
            hasPlayerAppearance: true
          },
          {
            rowKey: "2026-03-11:all:2025031101",
            gameId: 2025031101,
            gameDate: "2026-03-11",
            season: 20252026,
            teamId: 1,
            strength: "all",
            source: "appearance",
            occupiesSelectedSlot: true,
            hasPlayerAppearance: true
          }
        ]
      },
      last5: { windowSize: 5, selectionMode: "appearance_rows", members: [] },
      last10: { windowSize: 10, selectionMode: "appearance_rows", members: [] },
      last20: { windowSize: 20, selectionMode: "appearance_rows", members: [] }
    }
  },
  comparisons: {
    familySummary: {
      selectedMetricFamily: "pp_usage",
      rowCountCompared: 1,
      fieldCountCompared: 3,
      mismatchFieldCount: 3,
      mismatchRowCount: 1,
      metrics: [
        {
          field: "pp_share_pct_last5",
          family: "pp_usage",
          mismatchedRows: 1,
          comparedRows: 1,
          latestStoredValue: 0.52,
          latestRecomputedValue: 0.495,
          latestDiff: 0.025,
          valuesMatch: false
        }
      ]
    },
    focusedRow: {
      storedRowKey: "2026-03-11:all:2025031101",
      recomputedRowKey: "2026-03-11:all:2025031101",
      selectedMetric: {
        field: "pp_share_pct_last5",
        storedValue: 0.52,
        recomputedValue: 0.495,
        diff: 0.025,
        absoluteDiff: 0.025,
        signedDiff: 0.025,
        percentDiff: 5.050505,
        valuesMatch: false,
        mismatchCauseBucket: "logic defect"
      },
      comparisonMatrix: [
        {
          field: "pp_share_pct_last5",
          family: "pp_usage",
          storedValue: 0.52,
          recomputedValue: 0.495,
          signedDiff: 0.025,
          absoluteDiff: 0.025,
          percentDiff: 5.050505,
          valuesMatch: false,
          fieldRole: "canonical"
        }
      ],
      canonicalVsLegacy: [
        {
          field: "pp_share_pct_avg_last5",
          canonicalValue: 0.52,
          legacyValue: null,
          valuesMatch: false
        }
      ],
      supportComparisons: [
        {
          field: "pp_share_pct_player_pp_toi_last5",
          storedValue: 156,
          recomputedValue: 149,
          valuesMatch: false
        }
      ]
    }
  },
  helpers: null
};

function jsonResponse(data: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => data
  } as Response;
}

function buildPlayersQuery() {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.ilike = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(async () => ({
    data: [
      {
        id: 8478402,
        fullName: "Jesper Bratt",
        position: "RW"
      }
    ],
    error: null
  }));
  return chain;
}

function buildFaceoffTotalsQuery() {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({
    data: {
      fow_percentage: 52.3,
      total_faceoffs: 143,
      games_played: 61
    },
    error: null
  }));
  return chain;
}

describe("TrendsDebugPage validation console", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "players") return buildPlayersQuery();
      if (table === "wgo_skater_stats_totals") return buildFaceoffTotalsQuery();
      throw new Error(`Unexpected supabase table: ${table}`);
    });

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/debug/rolling-player-metrics")) {
        return jsonResponse({
          success: true,
          payload: validationPayload
        });
      }
      return jsonResponse({}, false, 404);
    }));

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn(async () => undefined)
      }
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders blocked freshness and comparison views from the validation payload", async () => {
    render(<TrendsDebugPage />);

    fireEvent.change(screen.getByLabelText("Find Player"), {
      target: { value: "Jesper" }
    });

    const playerButton = await screen.findByRole("button", {
      name: /Jesper Bratt/i
    });
    fireEvent.click(playerButton);

    expect(await screen.findByText("Copy Helpers")).toBeTruthy();
    expect(screen.getAllByText(/readiness BLOCKED/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/2 blocker\(s\) require refresh or investigation/i).length
    ).toBeGreaterThan(0);
    expect(screen.getByText(/ppTailLag > 0/i)).toBeTruthy();
    expect(screen.getByText(/mixed-source PP window/i)).toBeTruthy();
    expect(screen.getAllByText("pp_share_pct_last5").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/0\.025000/).length).toBeGreaterThan(0);
    expect(screen.getByText("TOI Trust Panel")).toBeTruthy();
    expect(screen.getByText("PP Context Panel")).toBeTruthy();
    expect(screen.getByText("Stored-vs-Reconstructed Diff Panel")).toBeTruthy();
    expect(screen.getByText("Diagnostics Panel")).toBeTruthy();
    expect(screen.getByText("Family Mismatches")).toBeTruthy();
    expect(screen.getByText("1 row(s) with mismatches")).toBeTruthy();
    expect(screen.getByText("Trust tier")).toBeTruthy();
    expect(screen.getByText("trusted")).toBeTruthy();
    expect(screen.getByText("Chosen PP-share source")).toBeTruthy();
    expect(screen.getByText("builder")).toBeTruthy();
    expect(screen.getByText("Mixed-source windows")).toBeTruthy();
    expect(screen.getByText("last3, last5, last10, last20")).toBeTruthy();
    expect(screen.getByText("Diagnostics status")).toBeTruthy();
    expect(screen.getAllByText("blocked").length).toBeGreaterThan(0);
    expect(screen.getByText("Coverage status")).toBeTruthy();
    expect(screen.getByText("Freshness status")).toBeTruthy();
    expect(screen.getByText("Completeness status")).toBeTruthy();
    expect(screen.getAllByText(/pp tail lag 1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 ratio support completeness issue\(s\)/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Mismatch cause")).toBeTruthy();
    expect(screen.getByText("logic defect")).toBeTruthy();
    expect(
      screen.getAllByText(
        /sum\(player_pp_toi_seconds\) \/ sum\(team_pp_toi_seconds_inferred_from_share\)/i
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Support completeness family")).toBeTruthy();
    expect(screen.getAllByText(/pp_share_pct/i).length).toBeGreaterThan(0);
    expect(screen.getByText("last5 support completeness")).toBeTruthy();
    expect(screen.getAllByText("complete").length).toBeGreaterThan(0);
    expect(screen.getByText("last5 completeness counts")).toBeTruthy();
    expect(screen.getByText(/Refresh `powerPlayCombinations` for the selected validation games\./i)).toBeTruthy();
  });

  it("renders READY WITH CAUTIONS as a distinct readiness state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/debug/rolling-player-metrics")) {
          return jsonResponse({
            success: true,
            payload: {
              ...validationPayload,
              readiness: {
                status: "READY_WITH_CAUTIONS",
                blockerReasons: [],
                cautionReasons: [
                  "mixed-source PP window",
                  "PP builder latest game is covered, but the selected window is still missing builder rows: 2025030901",
                  "PP share latest game is covered, but the selected window is still missing share coverage: 2025030901"
                ],
                nextRecommendedAction:
                  "Inspect PP builder/share coverage gaps before treating PP validation as signoff-ready."
              },
              diagnostics: {
                ...validationPayload.diagnostics,
                coverage: {
                  ...validationPayload.diagnostics.coverage,
                  sample: {
                    ...validationPayload.diagnostics.coverage.sample,
                    missingPpGameIds: [2025030901],
                    missingPpShareGameIds: [2025030901]
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
                  }
                },
                sourceTailFreshness: {
                  ...validationPayload.diagnostics.sourceTailFreshness,
                  ppTailLag: 0,
                  blockers: {
                    ...validationPayload.diagnostics.sourceTailFreshness.blockers,
                    ppTailLag: 0
                  },
                  latest: {
                    ...validationPayload.diagnostics.sourceTailFreshness.latest,
                    ppGameId: 2025031101
                  }
                },
                snapshot: {
                  overallStatus: "caution",
                  blockerCount: 0,
                  cautionCount: 2,
                  highlights: [
                    "latest PP game covered, but builder window coverage is incomplete: 2025030901",
                    "latest PP share game covered, but share window coverage is incomplete: 2025030901"
                  ],
                  categories: {
                    ...validationPayload.diagnostics.snapshot.categories,
                    coverage: {
                      status: "caution",
                      issueCount: 4,
                      highlights: [
                        "latest PP game covered, but builder window coverage is incomplete: 2025030901",
                        "latest PP share game covered, but share window coverage is incomplete: 2025030901"
                      ],
                      warningCount: 1,
                      unknownGameIds: 0,
                      ppCoverage: {
                        latestExpectedPpGameId: 2025031101,
                        latestBuilderGameCovered: true,
                        latestShareGameCovered: true,
                        windowBuilderCoverageComplete: false,
                        windowShareCoverageComplete: false,
                        missingPpGameIds: [2025030901],
                        missingPpShareGameIds: [2025030901]
                      }
                    },
                    freshness: {
                      ...validationPayload.diagnostics.snapshot.categories.freshness,
                      status: "clean",
                      issueCount: 0,
                      highlights: [],
                      blockers: {
                        ...validationPayload.diagnostics.snapshot.categories.freshness.blockers,
                        ppTailLag: 0
                      },
                      latest: {
                        ...validationPayload.diagnostics.snapshot.categories.freshness.latest,
                        ppGameId: 2025031101
                      }
                    }
                  }
                }
              }
            }
          });
        }
        return jsonResponse({}, false, 404);
      })
    );

    render(<TrendsDebugPage />);

    fireEvent.change(screen.getByLabelText("Find Player"), {
      target: { value: "Jesper" }
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /Jesper Bratt/i
      })
    );

    expect(await screen.findAllByText(/readiness READY WITH CAUTIONS/i)).toHaveLength(2);
    expect(
      screen.getAllByText(/3 caution\(s\) should be reviewed before signoff/i)
        .length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /Inspect PP builder\/share coverage gaps before treating PP validation as signoff-ready\./i
      )
    ).toBeTruthy();
    expect(screen.getByText("Latest PP game covered")).toBeTruthy();
    expect(screen.getByText("PP window fully covered")).toBeTruthy();
    expect(screen.getAllByText("true").length).toBeGreaterThan(0);
    expect(screen.getAllByText("false").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2025030901/).length).toBeGreaterThan(0);
  });

  it("avoids reloading the heavy validation payload when only the selected metric changes", async () => {
    const apiCallUrls: string[] = [];
    const heavyPayload = {
      ...validationPayload,
      contracts: null,
      formulas: null,
      windows: null,
      comparisons: null
    };
    const detailPayload = {
      ...validationPayload,
      stored: null,
      recomputed: null,
      sourceRows: null,
      diagnostics: null
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/debug/rolling-player-metrics")) {
          apiCallUrls.push(url);
          const params = new URL(url, "http://localhost").searchParams;
          const includeSourceRows = params.get("includeSourceRows");
          const includeDiagnostics = params.get("includeDiagnostics");
          const includeComparisons = params.get("includeComparisons");
          const isHeavyRequest =
            includeSourceRows === "true" &&
            includeDiagnostics === "true" &&
            includeComparisons === "false";

          return jsonResponse({
            success: true,
            payload: isHeavyRequest ? heavyPayload : detailPayload
          });
        }
        return jsonResponse({}, false, 404);
      })
    );

    render(<TrendsDebugPage />);

    fireEvent.change(screen.getByLabelText("Find Player"), {
      target: { value: "Jesper" }
    });

    const playerButton = await screen.findByRole("button", {
      name: /Jesper Bratt/i
    });
    fireEvent.click(playerButton);

    await screen.findByText("Copy Helpers");

    await waitFor(() => {
      expect(
        apiCallUrls.some(
          (url) =>
            url.includes("includeSourceRows=true") &&
            url.includes("includeDiagnostics=true") &&
            url.includes("includeComparisons=false")
        )
      ).toBe(true);
    });

    const heavyCountBeforeMetricChange = apiCallUrls.filter(
      (url) =>
        url.includes("includeSourceRows=true") &&
        url.includes("includeDiagnostics=true") &&
        url.includes("includeComparisons=false")
    ).length;
    const detailCountBeforeMetricChange = apiCallUrls.filter(
      (url) =>
        url.includes("includeSourceRows=false") &&
        url.includes("includeDiagnostics=false") &&
        url.includes("includeComparisons=true")
    ).length;

    fireEvent.change(screen.getByLabelText("Metric / Field"), {
      target: { value: "pp_share_pct_player_pp_toi_last5" }
    });

    await waitFor(() => {
      const detailCountAfterMetricChange = apiCallUrls.filter(
        (url) =>
          url.includes("includeSourceRows=false") &&
          url.includes("includeDiagnostics=false") &&
          url.includes("includeComparisons=true")
      ).length;
      expect(detailCountAfterMetricChange).toBeGreaterThan(
        detailCountBeforeMetricChange
      );
    });

    const heavyCountAfterMetricChange = apiCallUrls.filter(
      (url) =>
        url.includes("includeSourceRows=true") &&
        url.includes("includeDiagnostics=true") &&
        url.includes("includeComparisons=false")
    ).length;

    expect(heavyCountAfterMetricChange).toBe(heavyCountBeforeMetricChange);
  });

  it("keeps the validation console primary and moves the legacy sandbox behind a secondary tab", async () => {
    render(<TrendsDebugPage />);

    fireEvent.change(screen.getByLabelText("Find Player"), {
      target: { value: "Jesper" }
    });

    const playerButton = await screen.findByRole("button", {
      name: /Jesper Bratt/i
    });
    fireEvent.click(playerButton);

    expect(await screen.findByText("Copy Helpers")).toBeTruthy();
    expect(screen.queryByText("Legacy Sandbox Outputs")).toBeNull();
    expect(screen.queryByText("Legacy Sandbox Inputs")).toBeNull();
    expect(screen.getByRole("button", { name: "Validation Console" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Legacy Sandbox" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Legacy Sandbox" }));

    expect(await screen.findByText("Legacy Sandbox Outputs")).toBeTruthy();
    expect(screen.getByText("Legacy Sandbox Inputs")).toBeTruthy();
    expect(screen.queryByText("Stored-vs-Reconstructed Diff Panel")).toBeNull();
  });

  it("copies formula ledger entries, comparison blocks, and refresh prerequisites", async () => {
    render(<TrendsDebugPage />);

    fireEvent.change(screen.getByLabelText("Find Player"), {
      target: { value: "Jesper" }
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /Jesper Bratt/i
      })
    );

    await screen.findByText("Copy Helpers");

    const writeTextMock = vi.mocked(window.navigator.clipboard.writeText);

    fireEvent.click(screen.getByRole("button", { name: "Copy Formula Audit Entry" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        "- ⚠️ `pp_share_pct_last5`\n  - formula: `sum(player_pp_toi_seconds) / sum(team_pp_toi_seconds_inferred_from_share)`"
      );
    });
    expect(await screen.findByText("Formula audit entry copied.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Copy Comparison Block" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        [
          "- player: `Jesper Bratt`",
          "- season / strength: `20252026` / `all`",
          "- row: `2026-03-11:all:2025031101`",
          "- metric: `pp_share_pct_last5`",
          "- stored value: `0.520000`",
          "- reconstructed value: `0.495000`",
          "- diff: `0.025000`",
          "- mismatch cause: `logic defect`",
          "- readiness: `BLOCKED`"
        ].join("\n")
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy Refresh Prereqs" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        [
          "- metric family: `pp_usage`",
          "- Refresh `powerPlayCombinations` for the selected validation games.",
          "- Verify PP tail lag is zero and inspect PP builder coverage cautions.",
          "- Recompute `rolling_player_game_metrics` before validating PP-share metrics."
        ].join("\n")
      );
    });
  });

  it("renders richer mismatch summaries, alias drift, and support comparisons from the payload", async () => {
    render(<TrendsDebugPage />);

    fireEvent.change(screen.getByLabelText("Find Player"), {
      target: { value: "Jesper" }
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /Jesper Bratt/i
      })
    );

    await screen.findByText("Stored-vs-Reconstructed Diff Panel");

    expect(screen.getByText(/comparisonMatrix/i)).toBeTruthy();
    expect(screen.getByText(/canonicalVsLegacy/i)).toBeTruthy();
    expect(screen.getByText(/supportComparisons/i)).toBeTruthy();
    expect(screen.getAllByText(/pp_share_pct_avg_last5/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/pp_share_pct_player_pp_toi_last5/i).length
    ).toBeGreaterThan(0);
    expect(screen.getByText(/percentDiff/i)).toBeTruthy();
    expect(screen.getAllByText(/5\.050505/i).length).toBeGreaterThan(0);
  });

  it("renders payload-derived on_ice_sv_pct support traces without persisted support columns", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/debug/rolling-player-metrics")) {
          return jsonResponse({
            success: true,
            payload: {
              ...validationPayload,
              selected: {
                ...validationPayload.selected,
                metric: {
                  key: "on_ice_sv_pct_last5",
                  family: "on_ice_context",
                  canonicalField: "on_ice_sv_pct_last5",
                  legacyFields: ["on_ice_sv_pct_avg_last5"],
                  supportFields: ["oi_sa_total_last5", "oi_ga_total_last5"]
                }
              },
              formulas: {
                selectedMetric: {
                  ...validationPayload.formulas.selectedMetric,
                  field: "on_ice_sv_pct_last5",
                  baseKey: "on_ice_sv_pct",
                  family: "on_ice_context",
                  formula:
                    "sum(on_ice_shots_against - on_ice_goals_against) / sum(on_ice_shots_against) * 100",
                  canonicalField: "on_ice_sv_pct_last5",
                  legacyFields: ["on_ice_sv_pct_avg_last5"],
                  supportFields: ["oi_sa_total_last5", "oi_ga_total_last5"]
                }
              },
              stored: {
                ...validationPayload.stored,
                focusedRow: {
                  ...validationPayload.stored.focusedRow,
                  on_ice_sv_pct_last5: 95,
                  oi_sa_total_last5: 100,
                  oi_ga_total_last5: 5
                }
              },
              recomputed: {
                ...validationPayload.recomputed,
                focusedRow: {
                  ...validationPayload.recomputed.focusedRow,
                  on_ice_sv_pct_last5: 94.545455,
                  oi_sa_total_last5: 110,
                  oi_ga_total_last5: 6
                }
              },
              comparisons: {
                ...validationPayload.comparisons,
                focusedRow: {
                  ...validationPayload.comparisons.focusedRow,
                  selectedMetric: {
                    field: "on_ice_sv_pct_last5",
                    storedValue: 95,
                    recomputedValue: 94.545455,
                    diff: 0.454545,
                    absoluteDiff: 0.454545,
                    signedDiff: 0.454545,
                    percentDiff: 0.480769,
                    valuesMatch: false,
                    mismatchCauseBucket: "logic defect"
                  },
                  supportComparisons: [
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
                  ]
                }
              }
            }
          });
        }
        return jsonResponse({}, false, 404);
      })
    );

    render(<TrendsDebugPage />);

    fireEvent.change(screen.getByLabelText("Find Player"), {
      target: { value: "Jesper" }
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /Jesper Bratt/i
      })
    );

    await screen.findByText("Numerator / Denominator Panel");

    expect(screen.getAllByText(/oi_sa_total_last5/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/oi_ga_total_last5/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/on_ice_sv_pct_saves_total_last5/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/stored 95/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/recomputed 104/i).length).toBeGreaterThan(0);
  });

  it("renders payload-derived weighted-rate support traces for all and lastN scopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/debug/rolling-player-metrics")) {
          return jsonResponse({
            success: true,
            payload: {
              ...validationPayload,
              selected: {
                ...validationPayload.selected,
                metric: {
                  key: "goals_per_60_last5",
                  family: "weighted_rates",
                  canonicalField: "goals_per_60_last5",
                  legacyFields: ["goals_per_60_avg_last5"],
                  supportFields: [
                    "goals_per_60_goals_total_last5",
                    "goals_per_60_toi_seconds_total_last5"
                  ]
                }
              },
              formulas: {
                selectedMetric: {
                  ...validationPayload.formulas.selectedMetric,
                  field: "goals_per_60_last5",
                  baseKey: "goals_per_60",
                  family: "weighted_rates",
                  formula: "sum(goals) / sum(toi_seconds) * 3600",
                  canonicalField: "goals_per_60_last5",
                  legacyFields: ["goals_per_60_avg_last5"],
                  supportFields: [
                    "goals_per_60_goals_total_last5",
                    "goals_per_60_toi_seconds_total_last5"
                  ]
                }
              },
              stored: {
                ...validationPayload.stored,
                focusedRow: {
                  ...validationPayload.stored.focusedRow,
                  goals_per_60_last5: 4,
                  goals_total_last5: 2,
                  toi_seconds_total_last5: 1800
                }
              },
              recomputed: {
                ...validationPayload.recomputed,
                focusedRow: {
                  ...validationPayload.recomputed.focusedRow,
                  goals_per_60_last5: 5.4,
                  goals_total_last5: 3,
                  toi_seconds_total_last5: 2000
                }
              },
              comparisons: {
                ...validationPayload.comparisons,
                focusedRow: {
                  ...validationPayload.comparisons.focusedRow,
                  selectedMetric: {
                    field: "goals_per_60_last5",
                    storedValue: 4,
                    recomputedValue: 5.4,
                    diff: -1.4,
                    absoluteDiff: 1.4,
                    signedDiff: -1.4,
                    percentDiff: -25.925926,
                    valuesMatch: false,
                    mismatchCauseBucket: "logic defect"
                  },
                  supportComparisons: [
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
                  ]
                }
              }
            }
          });
        }
        return jsonResponse({}, false, 404);
      })
    );

    render(<TrendsDebugPage />);

    fireEvent.change(screen.getByLabelText("Find Player"), {
      target: { value: "Jesper" }
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /Jesper Bratt/i
      })
    );

    await screen.findByText("Numerator / Denominator Panel");

    expect(screen.getAllByText(/goals_per_60_goals_total_last5/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/goals_per_60_toi_seconds_total_last5/i).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/stored 2/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/recomputed 3/i).length).toBeGreaterThan(0);
  });

  it("renders direct pp_toi_seconds validation output under the PP-usage surface", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/debug/rolling-player-metrics")) {
          return jsonResponse({
            success: true,
            payload: {
              ...validationPayload,
              selected: {
                ...validationPayload.selected,
                metric: {
                  key: "pp_toi_seconds_avg_last5",
                  family: "pp_usage",
                  canonicalField: null,
                  legacyFields: ["pp_toi_seconds_avg_last5"],
                  supportFields: []
                }
              },
              formulas: {
                selectedMetric: {
                  ...validationPayload.formulas.selectedMetric,
                  field: "pp_toi_seconds_avg_last5",
                  baseKey: "pp_toi_seconds",
                  family: "pp_usage",
                  windowFamily: "additive_performance",
                  formula: "sum(player_pp_toi_seconds)",
                  formulaSource: "base",
                  canonicalField: null,
                  legacyFields: ["pp_toi_seconds_avg_last5"],
                  supportFields: []
                }
              },
              stored: {
                ...validationPayload.stored,
                focusedRow: {
                  ...validationPayload.stored.focusedRow,
                  pp_toi_seconds_avg_last5: 90
                }
              },
              recomputed: {
                ...validationPayload.recomputed,
                focusedRow: {
                  ...validationPayload.recomputed.focusedRow,
                  pp_toi_seconds_avg_last5: 90
                }
              },
              comparisons: {
                ...validationPayload.comparisons,
                focusedRow: {
                  ...validationPayload.comparisons.focusedRow,
                  selectedMetric: {
                    field: "pp_toi_seconds_avg_last5",
                    storedValue: 90,
                    recomputedValue: 90,
                    diff: 0,
                    absoluteDiff: 0,
                    signedDiff: 0,
                    percentDiff: 0,
                    valuesMatch: true,
                    mismatchCauseBucket: null
                  },
                  comparisonMatrix: [
                    {
                      field: "pp_toi_seconds_avg_last5",
                      family: "pp_usage",
                      storedValue: 90,
                      recomputedValue: 90,
                      signedDiff: 0,
                      absoluteDiff: 0,
                      percentDiff: 0,
                      valuesMatch: true,
                      fieldRole: "legacy"
                    }
                  ],
                  canonicalVsLegacy: [],
                  supportComparisons: []
                }
              }
            }
          });
        }
        return jsonResponse({}, false, 404);
      })
    );

    render(<TrendsDebugPage />);

    fireEvent.change(screen.getByLabelText("Find Player"), {
      target: { value: "Jesper" }
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /Jesper Bratt/i
      })
    );

    await screen.findByText("Formula Panel");

    expect(screen.getAllByText(/pp_toi_seconds_avg_last5/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/sum\(player_pp_toi_seconds\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/pp_usage/i).length).toBeGreaterThan(0);
  });

  it("keeps authoritative legacy optional metrics visible in canonical view while hiding compatibility-only aliases", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/debug/rolling-player-metrics")) {
          return jsonResponse({
            success: true,
            payload: {
              ...validationPayload,
              stored: {
                ...validationPayload.stored,
                focusedRow: {
                  ...validationPayload.stored.focusedRow,
                  primary_assists_avg_last5: 1.2,
                  penalties_drawn_avg_last5: 0.8,
                  pp_toi_seconds_avg_last5: 90,
                  penalties_drawn_per_60_last5: 2.4,
                  penalties_drawn_per_60_avg_last5: 2.4
                }
              },
              recomputed: {
                ...validationPayload.recomputed,
                focusedRow: {
                  ...validationPayload.recomputed.focusedRow,
                  primary_assists_avg_last5: 1.2,
                  penalties_drawn_avg_last5: 0.8,
                  pp_toi_seconds_avg_last5: 90,
                  penalties_drawn_per_60_last5: 2.4,
                  penalties_drawn_per_60_avg_last5: 2.4
                }
              }
            }
          });
        }
        return jsonResponse({}, false, 404);
      })
    );

    render(<TrendsDebugPage />);

    fireEvent.change(screen.getByLabelText("Find Player"), {
      target: { value: "Jesper" }
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /Jesper Bratt/i
      })
    );

    await screen.findByText("Metric Selection");

    const metricSelect = screen.getByLabelText("Metric / Field") as HTMLSelectElement;
    const optionValues = Array.from(metricSelect.options).map((option) => option.value);

    expect(optionValues).toContain("primary_assists_avg_last5");
    expect(optionValues).toContain("penalties_drawn_avg_last5");
    expect(optionValues).toContain("pp_toi_seconds_avg_last5");
    expect(optionValues).toContain("penalties_drawn_per_60_last5");
    expect(optionValues).not.toContain("penalties_drawn_per_60_avg_last5");
  });

  it("copies formula audit entries for optional metrics using their selected formula metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/debug/rolling-player-metrics")) {
          return jsonResponse({
            success: true,
            payload: {
              ...validationPayload,
              readiness: {
                status: "READY",
                blockerReasons: [],
                cautionReasons: [],
                nextRecommendedAction: null
              },
              selected: {
                ...validationPayload.selected,
                metric: {
                  key: "pp_toi_seconds_avg_last5",
                  family: "pp_usage",
                  canonicalField: null,
                  legacyFields: ["pp_toi_seconds_avg_last5"],
                  supportFields: []
                }
              },
              formulas: {
                selectedMetric: {
                  ...validationPayload.formulas.selectedMetric,
                  field: "pp_toi_seconds_avg_last5",
                  baseKey: "pp_toi_seconds",
                  family: "pp_usage",
                  windowFamily: "additive_performance",
                  formula: "sum(player_pp_toi_seconds)",
                  formulaSource: "base",
                  canonicalField: null,
                  legacyFields: ["pp_toi_seconds_avg_last5"],
                  supportFields: []
                }
              },
              stored: {
                ...validationPayload.stored,
                focusedRow: {
                  ...validationPayload.stored.focusedRow,
                  pp_toi_seconds_avg_last5: 90
                }
              },
              recomputed: {
                ...validationPayload.recomputed,
                focusedRow: {
                  ...validationPayload.recomputed.focusedRow,
                  pp_toi_seconds_avg_last5: 90
                }
              },
              comparisons: {
                ...validationPayload.comparisons,
                focusedRow: {
                  ...validationPayload.comparisons.focusedRow,
                  selectedMetric: {
                    field: "pp_toi_seconds_avg_last5",
                    storedValue: 90,
                    recomputedValue: 90,
                    diff: 0,
                    absoluteDiff: 0,
                    signedDiff: 0,
                    percentDiff: 0,
                    valuesMatch: true,
                    mismatchCauseBucket: null
                  },
                  comparisonMatrix: [
                    {
                      field: "pp_toi_seconds_avg_last5",
                      family: "pp_usage",
                      storedValue: 90,
                      recomputedValue: 90,
                      signedDiff: 0,
                      absoluteDiff: 0,
                      percentDiff: 0,
                      valuesMatch: true,
                      fieldRole: "legacy"
                    }
                  ],
                  canonicalVsLegacy: [],
                  supportComparisons: []
                }
              }
            }
          });
        }
        return jsonResponse({}, false, 404);
      })
    );

    render(<TrendsDebugPage />);

    fireEvent.change(screen.getByLabelText("Find Player"), {
      target: { value: "Jesper" }
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /Jesper Bratt/i
      })
    );

    await screen.findByText("Copy Helpers");

    const writeTextMock = vi.mocked(window.navigator.clipboard.writeText);
    fireEvent.click(screen.getByRole("button", { name: "Copy Formula Audit Entry" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        "- ✅ `pp_toi_seconds_avg_last5`\n  - formula: `sum(player_pp_toi_seconds)`"
      );
    });
  });
});
