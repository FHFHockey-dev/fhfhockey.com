import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  auditInsertMock,
  requireLatestSucceededRunIdMock,
  runProjectionPreflightChecksMock,
  serverSupabaseMock
} = vi.hoisted(() => ({
  auditInsertMock: vi.fn().mockResolvedValue({ error: null }),
  requireLatestSucceededRunIdMock: vi.fn(),
  runProjectionPreflightChecksMock: vi.fn(),
  serverSupabaseMock: {} as Record<string, unknown>
}));

vi.mock("lib/supabase", () => ({
  default: {
    from: vi.fn(() => ({
      insert: auditInsertMock
    }))
  }
}));

vi.mock("lib/supabase/server", () => ({
  default: serverSupabaseMock
}));

vi.mock("lib/projections/apiHelpers", () => ({
  requireLatestSucceededRunId: requireLatestSucceededRunIdMock
}));

vi.mock("../../../../../pages/api/v1/db/run-projection-v2", () => ({
  runProjectionPreflightChecks: runProjectionPreflightChecksMock
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: unknown) => handler
}));

import handler, {
  buildSkaterActualMatchDiagnostics,
  replaceProjectionResultsAtomic
} from "../../../../../pages/api/v1/db/run-projection-accuracy";
import { computeSkaterFantasyPoints } from "lib/projections/accuracy/fantasyPoints";
import { buildForgeInputProvenance } from "lib/projections/calibrationEligibility";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as any,
    headersSent: false,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      this.headersSent = true;
      return this;
    }
  };
  return res;
}

describe("/api/v1/db/run-projection-accuracy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runProjectionPreflightChecksMock.mockResolvedValue({
      asOfDate: "2026-03-19",
      bypassed: false,
      status: "PASS",
      gates: []
    });
    requireLatestSucceededRunIdMock.mockRejectedValue(
      new Error(
        "<!DOCTYPE html><html><title>fyhftlxokyjtpndbkfse.supabase.co | 522: Connection timed out</title></html>"
      )
    );
  });

  it("returns structured dependency diagnostics instead of raw html errors", async () => {
    const req: any = {
      method: "GET",
      query: {
        date: "2026-03-20"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      scanSummary: {
        surface: "projection_accuracy_operator",
        status: "blocked",
        fallbackApplied: false,
        rowCounts: {
          rowsUpserted: 0
        },
        blockingIssueCount: 1
      },
      error:
        "Upstream dependency returned an HTML error page instead of structured JSON.",
      dependencyError: {
        kind: "dependency_error",
        classification: "html_upstream_response",
        source: "supabase_or_proxy",
        htmlLike: true
      }
    });
  });

  it("returns 422 when projection freshness preflight fails", async () => {
    runProjectionPreflightChecksMock.mockResolvedValueOnce({
      asOfDate: "2026-03-19",
      bypassed: false,
      status: "FAIL",
      gates: [
        {
          gate_key: "projection_derived_v2",
          status: "FAIL",
          detail: "player_latest=none",
          action: "Run /api/v1/db/build-projection-derived-v2 for recent dates."
        }
      ]
    });

    const req: any = {
      method: "GET",
      query: {
        date: "2026-03-20"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toMatchObject({
      success: false,
      actualDate: "2026-03-20",
      projectionDate: "2026-03-19",
      preflight: {
        status: "FAIL"
      },
      scanSummary: {
        surface: "projection_accuracy_operator",
        requestedDate: "2026-03-20",
        activeDataDate: "2026-03-20",
        fallbackApplied: false,
        status: "blocked",
        rowCounts: {
          skaterRows: 0,
          goalieRows: 0,
          totalRows: 0
        },
        blockingIssueCount: 1
      },
      error:
        "Projection freshness checks failed. Resolve upstream dependencies or use bypassPreflight=true to override."
    });
    expect(requireLatestSucceededRunIdMock).not.toHaveBeenCalled();
  });

  it("reports selected-run actual coverage without counting wrong-date projections", () => {
    const diagnostics = buildSkaterActualMatchDiagnostics({
      playerProjections: [
        { game_id: 1, player_id: 10 },
        { game_id: 1, player_id: 11 },
        { game_id: 2, player_id: 12 },
        { game_id: 1, player_id: null },
      ],
      validGameIds: new Set([1]),
      skaterActuals: new Map([["1:10", { shots: 3 }]]),
    });

    expect(diagnostics).toEqual({
      projectionRows: 4,
      eligibleSameDateRows: 2,
      matchedActualRows: 1,
      missingActualRows: 1,
      wrongDateRows: 1,
      invalidIdentityRows: 1,
      actualMatchRate: 0.5,
    });
  });

  it("atomically replaces an empty canonical result scope so stale rerun rows are removed", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        deleted: 4,
        inserted: 0,
        asOfDate: "2026-03-19",
        actualDate: "2026-03-20",
        sourceRunId: "latest-run",
      },
      error: null,
    });

    await expect(
      replaceProjectionResultsAtomic(
        { rpc },
        {
          asOfDate: "2026-03-19",
          actualDate: "2026-03-20",
          sourceRunId: "latest-run",
          rows: [],
        },
      ),
    ).resolves.toMatchObject({ deleted: 4, inserted: 0 });
    expect(rpc).toHaveBeenCalledWith(
      "replace_forge_projection_results_atomic",
      expect.objectContaining({
        p_as_of_date: "2026-03-19",
        p_actual_date: "2026-03-20",
        p_source_run_id: "latest-run",
        p_rows: [],
      }),
    );
  });

  it("fails closed when the replacement receipt identifies a stale run", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        deleted: 1,
        inserted: 0,
        asOfDate: "2026-03-19",
        actualDate: "2026-03-20",
        sourceRunId: "stale-run",
      },
      error: null,
    });

    await expect(
      replaceProjectionResultsAtomic(
        { rpc },
        {
          asOfDate: "2026-03-19",
          actualDate: "2026-03-20",
          sourceRunId: "latest-run",
          rows: [],
        },
      ),
    ).rejects.toThrow("Atomic projection-result replacement receipt mismatch.");
  });

  it("keeps atomic result replacement service-only and latest-run scoped", () => {
    const repoRoot =
      path.basename(process.cwd()) === "web"
        ? path.resolve(process.cwd(), "..")
        : process.cwd();
    const sql = readFileSync(
      path.join(
        repoRoot,
        "supabase/migrations/20260723121407_replace_forge_projection_results_atomic.sql",
      ),
      "utf8",
    );

    expect(sql).toContain(
      "create or replace function public.replace_forge_projection_results_atomic(",
    );
    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = pg_catalog");
    expect(sql).toMatch(
      /select run_id[\s\S]*status = 'succeeded'[\s\S]*order by created_at desc[\s\S]*limit 1/,
    );
    expect(sql).toContain(
      "metrics #>> '{input_provenance,rolling_player_history_contract}'",
    );
    expect(sql).toContain("full_selected_scope_through_end_date_v1");
    expect(
      sql.indexOf("delete from public.forge_projection_results"),
    ).toBeLessThan(sql.indexOf("insert into public.forge_projection_results"));
    expect(sql).not.toMatch(/exception\s+when\s+others/i);
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });

  it("excludes rows with an unknown prediction from accuracy and counts them", async () => {
    // Same-row fixture: player 11 has ES goals 0.2 with the PP goals head
    // withheld; goalie 31 has a null win probability. Both have actuals.
    const tables: Record<string, unknown[]> = {
      forge_player_projections: [
        {
          game_id: 1, player_id: 10, team_id: 8, opponent_team_id: 10,
          proj_goals_es: 0.4, proj_goals_pp: 0.2, proj_goals_pk: 0,
          proj_assists_es: 0.5, proj_assists_pp: 0.1, proj_assists_pk: 0,
          proj_shots_es: 2.7, proj_shots_pp: 0.8, proj_shots_pk: 0,
          proj_toi_es_seconds: 900, proj_toi_pp_seconds: 120, proj_toi_pk_seconds: 0,
          proj_hits: 0.6, proj_blocks: 0.4, uncertainty: {}
        },
        {
          game_id: 1, player_id: 11, team_id: 8, opponent_team_id: 10,
          proj_goals_es: 0.2, proj_goals_pp: null, proj_goals_pk: null,
          proj_assists_es: 0.3, proj_assists_pp: 0.1, proj_assists_pk: null,
          proj_shots_es: 2, proj_shots_pp: 0.5, proj_shots_pk: null,
          proj_toi_es_seconds: 800, proj_toi_pp_seconds: 60, proj_toi_pk_seconds: null,
          proj_hits: 0.5, proj_blocks: 0.3, uncertainty: {}
        }
      ],
      games: [{ id: 1, date: "2026-03-20" }],
      wgo_skater_stats: [10, 11].map((player_id) => ({
        game_id: 1, player_id, goals: 1, assists: 0, pp_points: 0, shots: 3,
        hits: 1, blocked_shots: 0, date: "2026-03-20", toi_per_game: 18,
        ev_time_on_ice: null, pp_toi: null, sh_time_on_ice: null
      })),
      forge_goalie_projections: [
        { game_id: 1, goalie_id: 30, team_id: 8, opponent_team_id: 10,
          starter_probability: 0.9, proj_shots_against: 30, proj_saves: 27,
          proj_goals_allowed: 3, proj_win_prob: 0.55, proj_shutout_prob: 0.05,
          uncertainty: {} },
        { game_id: 1, goalie_id: 31, team_id: 10, opponent_team_id: 8,
          starter_probability: 0.8, proj_shots_against: 28, proj_saves: 25,
          proj_goals_allowed: 3, proj_win_prob: null, proj_shutout_prob: 0.04,
          uncertainty: {} }
      ],
      goalie_stats_unified: [30, 31].map((player_id) => ({
        player_id, goals_against: 2, saves: 28, wins: player_id === 30 ? 1 : 0,
        shutouts: 0, date: "2026-03-20"
      }))
    };
    const query = (table: string): any => {
      const result = () => {
        const data = tables[table] ?? [];
        return { data, count: data.length, error: null };
      };
      const builder: any = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "then") {
              return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
                Promise.resolve(result()).then(resolve, reject);
            }
            if (prop === "maybeSingle") {
              return () =>
                Promise.resolve({
                  data:
                    table === "forge_runs"
                      ? {
                          metrics: {
                            input_provenance: buildForgeInputProvenance()
                          }
                        }
                      : null,
                  error: null
                });
            }
            return () => builder;
          }
        }
      );
      return builder;
    };
    const rpc = vi.fn(async (_name: string, args: Record<string, any>) => ({
      data: {
        deleted: 0,
        inserted: args.p_rows.length,
        asOfDate: args.p_as_of_date,
        actualDate: args.p_actual_date,
        sourceRunId: args.p_source_run_id
      },
      error: null
    }));
    requireLatestSucceededRunIdMock.mockResolvedValue("run-a08");
    serverSupabaseMock.from = vi.fn(query);
    serverSupabaseMock.rpc = rpc;
    try {
      const res = createMockRes();
      await handler(
        { method: "GET", query: { date: "2026-03-20", ignoreOffSeason: "true" } } as any,
        res
      );

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        skaterRows: 1,
        goalieRows: 1,
        totalRows: 2,
        unknownPredictionSkips: { skaterRows: 1, goalieWinProbabilityRows: 1 },
        scanSummary: {
          rowCounts: {
            skaterUnknownPredictionSkips: 1,
            goalieUnknownWinProbabilitySkips: 1
          }
        }
      });
      const writtenRows = rpc.mock.calls[0][1].p_rows as any[];
      expect(writtenRows.map((row) => row.player_id)).toEqual([10, 30]);
      // The fully known skater row is scored exactly as before.
      expect(writtenRows[0].predicted_fp).toBeCloseTo(
        computeSkaterFantasyPoints({
          goals: 0.6,
          assists: 0.6,
          ppPoints: 0.3,
          shots: 3.5,
          hits: 0.6,
          blockedShots: 0.4
        }),
        6
      );
    } finally {
      delete serverSupabaseMock.from;
      delete serverSupabaseMock.rpc;
    }
  });
});
