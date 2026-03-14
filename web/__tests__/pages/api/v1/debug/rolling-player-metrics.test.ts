import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildPayloadMock } = vi.hoisted(() => ({
  buildPayloadMock: vi.fn()
}));

vi.mock("lib/supabase/Upserts/rollingPlayerValidationPayload", () => ({
  buildRollingPlayerValidationPayload: buildPayloadMock
}));

import handler from "../../../../../pages/api/v1/debug/rolling-player-metrics";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as any,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

describe("/api/v1/debug/rolling-player-metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildPayloadMock.mockResolvedValue({
      generatedAt: "2026-03-12T12:00:00.000Z",
      request: {
        playerId: 8478402,
        season: 20252026,
        strength: "all"
      },
      selected: {
        player: null,
        focusedRow: null,
        metric: {
          key: null,
          family: null,
          canonicalField: null,
          legacyFields: [],
          supportFields: []
        }
      },
      readiness: {
        status: "READY",
        blockerReasons: [],
        cautionReasons: [],
        nextRecommendedAction: null
      },
      stored: null,
      recomputed: null,
      sourceRows: null,
      diagnostics: null,
      contracts: {
        selectedMetricFamily: null,
        selectedWindowFamily: null,
        windowContract: null,
        helperSummaries: {
          availability: {} as any,
          ppShare: {} as any,
          ppUnit: {} as any,
          lineContext: {} as any,
          toi: {
            sourcePriority: [],
            trustTiers: [],
            fallbackSeedPriority: [],
            summary: ""
          },
          sourceSelection: {
            additiveMetrics: [],
            authoritySummary: ""
          }
        }
      },
      formulas: {
        selectedMetric: null
      },
      windows: {
        focusedRowKey: null,
        selectedMetricFamily: null,
        selectedWindowFamily: null,
        memberships: null
      },
      comparisons: {
        familySummary: null,
        focusedRow: null
      },
      helpers: null
    });
  });

  it("returns 405 for unsupported methods", async () => {
    const req: any = {
      method: "POST",
      query: {}
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET, HEAD");
    expect(res.body).toEqual({
      success: false,
      error: "Method not allowed"
    });
  });

  it("returns 400 when required params are missing", async () => {
    const req: any = {
      method: "GET",
      query: {
        season: "20252026"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(buildPayloadMock).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      success: false,
      error: "Missing required query param: playerId"
    });
  });

  it("parses the request and returns the validation payload", async () => {
    const req: any = {
      method: "GET",
      query: {
        playerId: "8478402",
        season: "20252026",
        strength: "pp",
        teamId: "1",
        gameId: "2025021023",
        gameDate: "2026-03-11",
        startDate: "2026-02-01",
        endDate: "2026-03-11",
        metric: "pp_share_pct_last5",
        metricFamily: "power-play usage",
        includeStoredRows: "false",
        includeRecomputedRows: "true",
        includeSourceRows: "yes",
        includeDiagnostics: "1",
        includeWindowMembership: "true",
        includeContractMetadata: "yes",
        includeComparisons: "true"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(buildPayloadMock).toHaveBeenCalledWith({
      playerId: 8478402,
      season: 20252026,
      strength: "pp",
      teamId: 1,
      gameId: 2025021023,
      gameDate: "2026-03-11",
      startDate: "2026-02-01",
      endDate: "2026-03-11",
      metric: "pp_share_pct_last5",
      metricFamily: "power-play usage",
      includeStoredRows: false,
      includeRecomputedRows: true,
      includeSourceRows: true,
      includeDiagnostics: true,
      includeWindowMembership: true,
      includeContractMetadata: true,
      includeComparisons: true
    });
    expect(res.body).toMatchObject({
      success: true,
      payload: {
        readiness: {
          status: "READY"
        },
        formulas: {
          selectedMetric: null
        },
        contracts: {
          helperSummaries: {
            toi: {
              sourcePriority: []
            }
          }
        },
        windows: {
          memberships: null
        },
        comparisons: {
          familySummary: null
        }
      }
    });
  });

  it("passes richer payload sections through the API response for the UI contract", async () => {
    buildPayloadMock.mockResolvedValueOnce({
      generatedAt: "2026-03-12T12:30:00.000Z",
      request: {
        playerId: 8478402,
        season: 20252026,
        strength: "pp"
      },
      selected: {
        player: null,
        focusedRow: null,
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
        status: "READY_WITH_CAUTIONS",
        blockerReasons: [],
        cautionReasons: ["mixed-source PP window"],
        nextRecommendedAction: "Inspect PP provenance before signoff."
      },
      stored: null,
      recomputed: null,
      sourceRows: {
        shared: null,
        selectedStrength: {
          countsRows: [],
          ratesRows: [],
          countsOiRows: [],
          mergedGames: [],
          toiTraceRows: [
            {
              rowKey: "2026-03-11:pp:2025031101",
              resolved: {
                source: "counts",
                trustTier: "authoritative",
                rejectedCandidates: []
              }
            }
          ],
          ppShareTraceRows: [
            {
              rowKey: "2026-03-11:pp:2025031101",
              chosen: {
                source: "builder",
                teamPpToiInferred: 300
              }
            }
          ],
          ppShareWindowSummary: {
            last5: {
              mixedSourceWindow: true,
              missingSourceGameIds: [2025030901]
            }
          }
        }
      },
      diagnostics: null,
      contracts: {
        selectedMetricFamily: "pp_usage",
        selectedWindowFamily: "ratio_performance",
        windowContract: {
          family: "ratio_performance"
        },
        helperSummaries: {
          availability: {} as any,
          ppShare: {} as any,
          ppUnit: {} as any,
          lineContext: {} as any,
          toi: {
            sourcePriority: ["counts", "counts_oi", "rates"],
            trustTiers: ["authoritative", "fallback"],
            fallbackSeedPriority: ["counts", "wgo"],
            summary: "TOI ordering summary"
          },
          sourceSelection: {
            additiveMetrics: ["goals"],
            authoritySummary: "NST counts preferred"
          }
        }
      },
      formulas: {
        selectedMetric: {
          field: "pp_share_pct_last5",
          formula:
            "sum(player_pp_toi_seconds) / sum(team_pp_toi_seconds_inferred_from_share)"
        }
      },
      windows: {
        focusedRowKey: "2026-03-11:pp:2025031101",
        selectedMetricFamily: "pp_usage",
        selectedWindowFamily: "ratio_performance",
        memberships: {
          last5: {
            selectionMode: "appearance_rows",
            members: [{ gameId: 2025031101 }]
          }
        }
      },
      comparisons: {
        familySummary: {
          mismatchFieldCount: 2,
          mismatchRowCount: 1
        },
        focusedRow: {
          selectedMetric: {
            mismatchCauseBucket: "fallback-side effect"
          }
        }
      },
      helpers: {
        formulaAuditEntry:
          "- ⚠️ `pp_share_pct_last5`\n  - formula: `sum(player_pp_toi_seconds) / sum(team_pp_toi_seconds_inferred_from_share)`"
      }
    } as any);

    const req: any = {
      method: "GET",
      query: {
        playerId: "8478402",
        season: "20252026",
        strength: "pp",
        metric: "pp_share_pct_last5",
        includeWindowMembership: "true",
        includeContractMetadata: "true",
        includeComparisons: "false"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      payload: {
        readiness: {
          status: "READY_WITH_CAUTIONS",
          cautionReasons: ["mixed-source PP window"]
        },
        formulas: {
          selectedMetric: {
            field: "pp_share_pct_last5"
          }
        },
        contracts: {
          helperSummaries: {
            toi: {
              sourcePriority: ["counts", "counts_oi", "rates"]
            }
          }
        },
        windows: {
          memberships: {
            last5: {
              selectionMode: "appearance_rows"
            }
          }
        },
        comparisons: {
          familySummary: {
            mismatchFieldCount: 2
          }
        },
        sourceRows: {
          selectedStrength: {
            toiTraceRows: [
              {
                resolved: {
                  source: "counts"
                }
              }
            ],
            ppShareWindowSummary: {
              last5: {
                mixedSourceWindow: true
              }
            }
          }
        }
      }
    });
  });

  it("passes optional metric formula and comparison sections through the API response", async () => {
    buildPayloadMock.mockResolvedValueOnce({
      generatedAt: "2026-03-14T10:00:00.000Z",
      request: {
        playerId: 8478402,
        season: 20252026,
        strength: "all"
      },
      selected: {
        player: null,
        focusedRow: {
          rowKey: "2026-03-11:all:2025031101",
          gameId: 2025031101,
          gameDate: "2026-03-11",
          strength: "all",
          season: 20252026,
          teamId: 1
        },
        metric: {
          key: "pp_toi_seconds_avg_last5",
          family: "pp_usage",
          canonicalField: null,
          legacyFields: ["pp_toi_seconds_avg_last5"],
          supportFields: []
        }
      },
      readiness: {
        status: "READY",
        blockerReasons: [],
        cautionReasons: [],
        nextRecommendedAction: null
      },
      stored: null,
      recomputed: null,
      sourceRows: null,
      diagnostics: null,
      contracts: {
        selectedMetricFamily: "pp_usage",
        selectedWindowFamily: "additive_performance",
        windowContract: {
          family: "additive_performance"
        },
        helperSummaries: {
          availability: {} as any,
          ppShare: {} as any,
          ppUnit: {} as any,
          lineContext: {} as any,
          toi: {
            sourcePriority: ["counts", "counts_oi", "rates"],
            trustTiers: ["authoritative", "fallback"],
            fallbackSeedPriority: ["counts", "wgo"],
            summary: "TOI ordering summary"
          },
          sourceSelection: {
            additiveMetrics: ["goals", "primary_assists", "penalties_drawn"],
            authoritySummary: "NST counts preferred"
          }
        }
      },
      formulas: {
        selectedMetric: {
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
      windows: {
        focusedRowKey: "2026-03-11:all:2025031101",
        selectedMetricFamily: "pp_usage",
        selectedWindowFamily: "additive_performance",
        memberships: {
          last5: {
            selectionMode: "appearance_rows",
            members: [{ gameId: 2025031101 }]
          }
        }
      },
      comparisons: {
        familySummary: {
          selectedMetricFamily: "pp_usage",
          rowCountCompared: 1,
          fieldCountCompared: 1,
          mismatchFieldCount: 0,
          mismatchRowCount: 0,
          metrics: []
        },
        focusedRow: {
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
          }
        }
      },
      helpers: {
        formulaAuditEntry:
          "- ✅ `pp_toi_seconds_avg_last5`\n  - formula: `sum(player_pp_toi_seconds)`"
      }
    } as any);

    const req: any = {
      method: "GET",
      query: {
        playerId: "8478402",
        season: "20252026",
        strength: "all",
        metric: "pp_toi_seconds_avg_last5",
        includeWindowMembership: "true",
        includeContractMetadata: "true",
        includeComparisons: "true"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      payload: {
        selected: {
          metric: {
            key: "pp_toi_seconds_avg_last5",
            family: "pp_usage"
          }
        },
        formulas: {
          selectedMetric: {
            field: "pp_toi_seconds_avg_last5",
            formula: "sum(player_pp_toi_seconds)"
          }
        },
        windows: {
          selectedWindowFamily: "additive_performance"
        },
        comparisons: {
          focusedRow: {
            selectedMetric: {
              valuesMatch: true
            }
          }
        }
      }
    });
  });

  it("responds to HEAD without building the payload", async () => {
    const req: any = {
      method: "HEAD",
      query: {}
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(buildPayloadMock).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      success: true,
      message: "Rolling player metrics validation endpoint OK."
    });
  });

  it("returns 500 when payload generation fails", async () => {
    buildPayloadMock.mockRejectedValueOnce(new Error("upsert blocker"));

    const req: any = {
      method: "GET",
      query: {
        playerId: "8478402",
        season: "20252026"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: "upsert blocker"
    });
  });
});
