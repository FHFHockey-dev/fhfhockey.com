import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  leagueSavePctMock,
  auditInsertMock,
  requireLatestSucceededRunIdMock,
  requireExternalInputProvenRunMock,
  runProjectionPreflightChecksMock,
  serverSupabaseMock
} = vi.hoisted(() => ({
  leagueSavePctMock: vi.fn(),
  auditInsertMock: vi.fn().mockResolvedValue({ error: null }),
  requireLatestSucceededRunIdMock: vi.fn(),
  requireExternalInputProvenRunMock: vi.fn(),
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
  default: {
    from: (table: string) => table === "cron_job_audit"
      ? { insert: auditInsertMock }
      : (serverSupabaseMock.from as (table: string) => unknown)(table),
    rpc: (...args: unknown[]) => (serverSupabaseMock.rpc as (...args: unknown[]) => unknown)(...args)
  }
}));

vi.mock("lib/projections/goalie/leagueSavePct", () => ({ getSeasonLeagueSavePct: leagueSavePctMock }));

vi.mock("lib/projections/apiHelpers", () => ({
  requireLatestSucceededRunId: requireLatestSucceededRunIdMock
}));

vi.mock("lib/projections/externalInputProof", () => ({
  requireExternalInputProvenRun: requireExternalInputProvenRunMock
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
import { computeGoalieFantasyPoints, computeSkaterFantasyPoints } from "lib/projections/accuracy/fantasyPoints";
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

const pregame = "2026-03-19T12:00:00.000Z";
const issued = { horizon_games: 1, run_id: "run-a08", as_of_date: "2026-03-19", created_at: pregame, updated_at: pregame };
const game = (id = 1) => ({ id, date: "2026-03-20", startTime: "2026-03-20T19:00:00Z", homeTeamId: 8, awayTeamId: 10 });
const candidate = (id: number, p = 0.7, wins: number | null = 0.55, shutout: number | null = 0.05) => ({
  goalie_id: id, rank: 1, start_probability: p, start_probability_status: "uncalibrated_model",
  confirmation_evidence_ids: [],
  if_starts: { shots_against: 30, saves: 27, goals_allowed: 3, credited_win_prob: wins, shutout_prob: shutout, modeled_save_pct: 0.9 },
  unconditional: { shots_against: 30 * p, saves: 27 * p, goals_allowed: 3 * p, credited_win_prob: wins, shutout_prob: shutout == null ? null : shutout * p },
});
const goalieProjection = (rows = [candidate(30)], gameId = 1, teamId = 8) => ({
  ...issued, game_id: gameId, goalie_id: rows[0].goalie_id, team_id: teamId, opponent_team_id: teamId === 8 ? 10 : 8,
  starter_probability: rows[0].start_probability, proj_shots_against: 30, proj_saves: 27, proj_goals_allowed: 3,
  proj_win_prob: rows[0].if_starts.credited_win_prob, proj_shutout_prob: rows[0].if_starts.shutout_prob,
  uncertainty: { goalie_candidates: {
    contract: "forge_goalie_candidates_v1", population: "candidate_goalie_game", values_per: "single_game",
    game_id: gameId, team_id: teamId,
    issuance: { run_id: issued.run_id, as_of_date: issued.as_of_date, issued_at: pregame, information_cutoff_at: pregame },
    rows,
  } },
});
const goalieAppearance = (goalieId: number, gameId = 1, teamId = 8) => ({ game_id: gameId, team_id: teamId, goalie_id: goalieId,
  game_date: "2026-03-20", goals_allowed: 2, saves: 28 });
const goalieActual = (playerId: number, gameId = 1, teamId = 8) => ({ game_id: gameId, team_id: teamId, player_id: playerId,
  date: "2026-03-20", goals_against: 2, saves: 28, wins: 1, shutouts: 0 });

type UpsertCall = { table: string; rows: unknown };

async function runAccuracyWithTables(tables: Record<string, unknown[]>) {
  const upserts: UpsertCall[] = [];
  const query = (table: string): any => {
    const filters: Array<(row: any) => boolean> = [];
    const result = () => {
      const data = (tables[table] ?? []).filter(row => filters.every(filter => filter(row)));
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
          if (["eq", "in", "gte", "lte", "lt"].includes(String(prop))) {
            return (column: string, value: any) => {
              filters.push(row => prop === "eq" ? row[column] === value : prop === "in" ? value.includes(row[column])
                : prop === "gte" ? row[column] >= value : prop === "lte" ? row[column] <= value : row[column] < value);
              return builder;
            };
          }
          if (prop === "upsert") {
            return (rows: unknown) => {
              upserts.push({ table, rows });
              return builder;
            };
          }
          if (prop === "maybeSingle") {
            return () =>
              Promise.resolve({
                data:
                  table === "forge_runs"
                    ? {
                        created_at: pregame,
                        metrics: {
                          finished_at: (tables.forge_runs?.[0] as any)?.metrics?.finished_at ?? pregame,
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
    return { res, rpc, upserts };
  } finally {
    delete serverSupabaseMock.from;
    delete serverSupabaseMock.rpc;
  }
}

describe("/api/v1/db/run-projection-accuracy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leagueSavePctMock.mockResolvedValue({ savePct: 0.92, source: "observed", warning: null });
    requireExternalInputProvenRunMock.mockImplementation(async (runId: string) => ({ runId,
      proof: { ...buildForgeInputProvenance({ externalFantasyInputsExcluded: true }), basis: "verified_producer_closure" } }));
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

  it("accepts exact-run producer proof without requiring a run-start exclusion label", async () => {
    const { res } = await runAccuracyWithTables({});
    expect(requireExternalInputProvenRunMock).toHaveBeenCalledWith("run-a08");
    expect(res.statusCode).toBe(200);
  });

  it("rejects an unproven latest run before any calibration reads or writes", async () => {
    requireLatestSucceededRunIdMock.mockResolvedValue("unproven-latest");
    requireExternalInputProvenRunMock.mockRejectedValue(Object.assign(new Error("Selected projection run lacks external fantasy exclusion provenance."),
      { statusCode: 422, details: { reason: "external_input_provenance_unproven" } }));
    serverSupabaseMock.from = vi.fn();
    serverSupabaseMock.rpc = vi.fn();
    try {
      const res = createMockRes();
      await handler({ method: "GET", query: { date: "2026-03-20", ignoreOffSeason: "true" } } as any, res);
      expect(res.statusCode).toBe(422);
      expect(requireExternalInputProvenRunMock).toHaveBeenCalledWith("unproven-latest");
      expect(serverSupabaseMock.from).not.toHaveBeenCalled();
      expect(serverSupabaseMock.rpc).not.toHaveBeenCalled();
    } finally {
      delete serverSupabaseMock.from;
      delete serverSupabaseMock.rpc;
    }
  });

  it("still rejects legacy rolling-history proof", async () => {
    requireLatestSucceededRunIdMock.mockResolvedValue("legacy-latest");
    requireExternalInputProvenRunMock.mockResolvedValue({ runId: "legacy-latest", proof: {
      external_fantasy_input_contract: "excluded_from_native_inputs_v1", rolling_player_history_contract: null } });
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-03-20", ignoreOffSeason: "true" } } as any, res);
    expect(res.statusCode).toBe(422);
    expect(res.body.calibrationEligibility.reason).toBe("missing_or_legacy_rolling_history_contract");
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
          ...issued, game_id: 1, player_id: 10, team_id: 8, opponent_team_id: 10,
          proj_goals_es: 0.4, proj_goals_pp: 0.2, proj_goals_pk: 0,
          proj_assists_es: 0.5, proj_assists_pp: 0.1, proj_assists_pk: 0,
          proj_shots_es: 2.7, proj_shots_pp: 0.8, proj_shots_pk: 0,
          proj_toi_es_seconds: 900, proj_toi_pp_seconds: 120, proj_toi_pk_seconds: 0,
          proj_hits: 0.6, proj_blocks: 0.4, uncertainty: {}
        },
        {
          ...issued, game_id: 1, player_id: 11, team_id: 8, opponent_team_id: 10,
          proj_goals_es: 0.2, proj_goals_pp: null, proj_goals_pk: null,
          proj_assists_es: 0.3, proj_assists_pp: 0.1, proj_assists_pk: null,
          proj_shots_es: 2, proj_shots_pp: 0.5, proj_shots_pk: null,
          proj_toi_es_seconds: 800, proj_toi_pp_seconds: 60, proj_toi_pk_seconds: null,
          proj_hits: 0.5, proj_blocks: 0.3, uncertainty: {}
        }
      ],
      games: [game()],
      wgo_skater_stats: [10, 11].map((player_id) => ({
        game_id: 1, player_id, goals: 1, assists: 0, pp_points: 0, shots: 3,
        hits: 1, blocked_shots: 0, date: "2026-03-20", toi_per_game: 1080,
        ev_time_on_ice: null, pp_toi: null, sh_time_on_ice: null
      })),
      forge_goalie_projections: [goalieProjection([candidate(30, 0.9)]), goalieProjection([candidate(31, 0.8, null)], 1, 10)],
      goalie_stats_unified: [goalieActual(30), goalieActual(31, 1, 10)],
      forge_goalie_game: [goalieAppearance(30), goalieAppearance(31, 1, 10)],
      wgo_goalie_stats: [30, 31].map(goalie_id => ({ game_id: 1, goalie_id, games_started: 1 })),
    };
    const { res, rpc } = await runAccuracyWithTables(tables);

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
  });

  it("scores each candidate against credited starts and never attributes the team slot line to a goalie", async () => {
    const projection = goalieProjection([candidate(30, 0.7), { ...candidate(31, 0.3), rank: 2 }]);
    projection.proj_saves = 100;
    projection.proj_win_prob = 0.99;
    const { res, rpc } = await runAccuracyWithTables({
      games: [game()], forge_goalie_projections: [projection],
      forge_goalie_game: [{ ...goalieAppearance(30), toi_seconds: 600 }, { ...goalieAppearance(31), toi_seconds: 3000 }],
      wgo_goalie_stats: [{ game_id: 1, goalie_id: 30, games_started: 1 }, { game_id: 1, goalie_id: 31, games_started: 0 }],
      goalie_stats_unified: [goalieActual(30), goalieActual(31)],
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.goalieProbabilityCalibration).toMatchObject({
      starter_probability: { sample_count: 1, brier_score: 0.09 },
      all_candidate_starter_probability: { sample_count: 2, brier_score: 0.09 },
      win_probability: { sample_count: 1 },
    });
    expect(rpc.mock.calls[0][1].p_rows).toEqual([expect.objectContaining({ player_id: 30,
      predicted_fp: computeGoalieFantasyPoints({ saves: 27, goalsAgainst: 3, wins: 0.55, shutouts: 0.05 }) })]);
    expect(res.body.goalieHoldoutComparison.saves.baseline_mae).toBeCloseTo(Math.abs(30 * 0.92 - 28));
    expect(res.body.goalieHoldoutComparison.baseline_definition).toContain("season_league_save_pct");
  });

  it.each(["missing", "contradictory", "partial"])("excludes %s starter labels instead of guessing from appearances", async mode => {
    const labels = mode === "missing" ? [] : [
      { game_id: 1, goalie_id: 30, games_started: 1 },
      ...(mode === "contradictory" ? [{ game_id: 1, goalie_id: 31, games_started: 1 }] : []),
    ];
    const { res, rpc } = await runAccuracyWithTables({
      games: [game()], forge_goalie_projections: [goalieProjection([candidate(30, 0.7), candidate(31, 0.3)])],
      forge_goalie_game: [goalieAppearance(30), goalieAppearance(31)], wgo_goalie_stats: labels,
      goalie_stats_unified: [goalieActual(30), goalieActual(31)],
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.goalieProbabilityCalibration.starter_probability.sample_count).toBe(0);
    expect(res.body.goalieRows).toBe(0);
    expect(rpc.mock.calls[0][1].p_rows).toEqual([]);
    const gate = res.body.goalieLaunchGates.gates.find((g: any) => g.gate_key === "starter_brier_max_30d");
    expect(gate).toMatchObject({ status: "FAIL", available: false, actual_value: null });
  });

  it.each(["post-start", "missing-clock", "wrong-run", "no-contract", "cutoff-after-issuance", "post-start-update"])("excludes %s issuance without bypassing the date-wide SQL fence", async mode => {
    const projection = goalieProjection();
    if (mode === "post-start") projection.uncertainty.goalie_candidates.issuance.issued_at = "2026-03-20T20:00:00Z";
    if (mode === "missing-clock") projection.uncertainty.goalie_candidates.issuance.issued_at = "";
    if (mode === "wrong-run") projection.uncertainty.goalie_candidates.issuance.run_id = "another-run";
    if (mode === "no-contract") projection.uncertainty = {} as any;
    if (mode === "cutoff-after-issuance") projection.uncertainty.goalie_candidates.issuance.information_cutoff_at = "2026-03-19T13:00:00Z";
    if (mode === "post-start-update") projection.updated_at = "2026-03-20T20:00:00Z";
    const { res, rpc } = await runAccuracyWithTables({
      games: [game()], forge_goalie_projections: [projection], forge_goalie_game: [goalieAppearance(30)],
      wgo_goalie_stats: [{ game_id: 1, goalie_id: 30, games_started: 1 }], goalie_stats_unified: [goalieActual(30)],
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.goalieRows).toBe(0);
    expect(res.body.goalieProbabilityCalibration.starter_probability.sample_count).toBe(0);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_source_run_id: "run-a08", p_rows: [] });
    expect(res.body.issuanceDiagnostics.latestPregameSelectionDeferred).toBe(true);
  });

  it("admits pregame database creation after the application's row timestamp", async () => {
    const projection = goalieProjection();
    projection.created_at = "2026-03-19T12:00:00.500Z";
    const { res } = await runAccuracyWithTables({
      games: [game()], forge_runs: [{ metrics: { finished_at: "2026-03-19T12:00:01Z" } }],
      forge_goalie_projections: [projection], forge_goalie_game: [goalieAppearance(30)],
      wgo_goalie_stats: [{ game_id: 1, goalie_id: 30, games_started: 1 }], goalie_stats_unified: [goalieActual(30)],
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.goalieRows).toBe(1);
  });

  it("scores the second candidate's own line when the top pick relieved", async () => {
    const second = { ...candidate(31, 0.3), rank: 2 };
    second.if_starts.saves = 22;
    const { res, rpc } = await runAccuracyWithTables({
      games: [game()], forge_goalie_projections: [goalieProjection([candidate(30, 0.7), second])],
      forge_goalie_game: [goalieAppearance(30), goalieAppearance(31)],
      wgo_goalie_stats: [{ game_id: 1, goalie_id: 30, games_started: 0 }, { game_id: 1, goalie_id: 31, games_started: 1 }],
      goalie_stats_unified: [goalieActual(30), goalieActual(31)],
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.goalieProbabilityCalibration).toMatchObject({ starter_probability: { sample_count: 1, brier_score: 0.49 },
      all_candidate_starter_probability: { sample_count: 2, brier_score: 0.49 } });
    expect(rpc.mock.calls[0][1].p_rows).toEqual([expect.objectContaining({ player_id: 31,
      predicted_fp: computeGoalieFantasyPoints({ saves: 22, goalsAgainst: 3, wins: 0.55, shutouts: 0.05 }) })]);
  });

  it("does not join another game's actual decision onto the credited starter", async () => {
    const { res } = await runAccuracyWithTables({
      games: [game()], forge_goalie_projections: [goalieProjection()], forge_goalie_game: [goalieAppearance(30)],
      wgo_goalie_stats: [{ game_id: 1, goalie_id: 30, games_started: 1 }], goalie_stats_unified: [goalieActual(30, 2)],
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.goalieRows).toBe(0);
    expect(res.body.goalieProbabilityCalibration.win_probability).toMatchObject({ sample_count: 0, brier_score: null });
    expect(res.body.goalieStatDiagnostics.saves.daily.player_count).toBe(1);
  });

  it("builds 30-day gates from versioned raw sums and includes the fresh day exactly once", async () => {
    const empty = { count: 0, brier_sum: 0, bins: Array.from({ length: 10 }, () => ({ count: 0, predicted_sum: 0, observed_sum: 0 })) };
    const prior = { count: 2, brier_sum: 0.5, bins: empty.bins.map((bin, i) => i === 5 ? { count: 2, predicted_sum: 1, observed_sum: 2 } : bin) };
    const historic = { date: "2026-03-01", scope: "goalie_evaluation_accumulators_v1", metrics: {
      contract: "credited_candidate_pregame_v1",
      probability: { starter_probability: prior, all_candidate_starter_probability: prior, win_probability: empty, shutout_probability: empty },
      coverage: {},
      stats: [{ date: "2026-03-01", stat_key: "saves", player_count: 2, error_abs_sum: 6, error_sq_sum: 20 }],
    } };
    const { res } = await runAccuracyWithTables({
      games: [game()], forge_goalie_projections: [goalieProjection()], forge_goalie_game: [goalieAppearance(30)],
      wgo_goalie_stats: [{ game_id: 1, goalie_id: 30, games_started: 1 }], goalie_stats_unified: [goalieActual(30)],
      forge_projection_calibration_daily: [historic, { ...historic, date: "2026-03-20" }, { ...historic, date: "2026-02-18" }],
      forge_projection_accuracy_stat_daily: [{ date: "2026-03-19", scope: "goalie", stat_key: "saves", player_count: 999, error_abs_sum: 0, error_sq_sum: 0 }],
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.goalieStatDiagnostics.saves).toMatchObject({
      daily: { player_count: 1, mae: 1 }, rolling_7d: { player_count: 1, mae: 1 }, rolling_30d: { player_count: 3, mae: 2.3333 },
    });
    expect(res.body.goalieProbabilityCalibration.starter_probability).toMatchObject({ sample_count: 1, brier_score: 0.09 });
    expect(res.body.goalieRollingDiagnostics.probability.starter_probability).toMatchObject({ sample_count: 3, brier_score: 0.1967 });
    expect(res.body.goalieRollingDiagnostics.dates).toEqual(["2026-03-01", "2026-03-20"]);
    expect(res.body.goalieLaunchGates.gates.find((g: any) => g.gate_key === "starter_brier_max_30d").actual_value).toBe(0.1967);
  });

  it("uses only the observed day in a new 30-day accumulator and marks empty subgates unavailable", async () => {
    const { res, upserts } = await runAccuracyWithTables({
      games: [game()], forge_goalie_projections: [goalieProjection([candidate(30, 0.7, null)])],
      forge_goalie_game: [goalieAppearance(30)], wgo_goalie_stats: [{ game_id: 1, goalie_id: 30, games_started: 1 }],
      goalie_stats_unified: [goalieActual(30)],
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.goalieStatDiagnostics.saves.rolling_30d).toMatchObject({ player_count: 1, mae: 1 });
    expect(res.body.goalieRollingDiagnostics.probability.starter_probability.sample_count).toBe(1);
    expect(res.body.goalieLaunchGates.gates.find((g: any) => g.gate_key === "win_brier_max_30d"))
      .toMatchObject({ status: "FAIL", available: false, actual_value: null });
    const daily = upserts.filter(u => u.table === "forge_projection_calibration_daily").flatMap(u => u.rows as any[]);
    expect(daily.find(row => row.scope === "goalie_evaluation_accumulators_v1").metrics.probability.starter_probability)
      .toMatchObject({ count: 1, brier_sum: expect.closeTo(0.09) });
    expect(res.body.goalieRollingDiagnostics.intervals).toEqual({});
  });

  it("rejects malformed historical accumulators before replacing any results", async () => {
    const { res, rpc, upserts } = await runAccuracyWithTables({ forge_projection_calibration_daily: [
      { date: "2026-03-19", scope: "goalie_evaluation_accumulators_v1", metrics: { contract: "credited_candidate_pregame_v1" } },
    ] });
    expect(res.statusCode).toBe(500);
    expect(rpc).not.toHaveBeenCalled();
    expect(upserts).toEqual([]);
  });

  it("excludes an entire post-start latest run, including skaters, while preserving the SQL source fence", async () => {
    const { res, rpc, upserts } = await runAccuracyWithTables({
      games: [game()], forge_runs: [{ metrics: { finished_at: "2026-03-20T20:00:00Z" } }],
      forge_player_projections: [{ ...issued, game_id: 1, player_id: 10, team_id: 8, opponent_team_id: 10,
        proj_goals_es: 0, proj_goals_pp: 0, proj_goals_pk: 0, proj_assists_es: 0, proj_assists_pp: 0, proj_assists_pk: 0,
        proj_shots_es: 2, proj_shots_pp: 0, proj_shots_pk: 0, proj_hits: 0, proj_blocks: 0 }],
      wgo_skater_stats: [{ game_id: 1, player_id: 10, date: "2026-03-20", goals: 0, assists: 0, pp_points: 0, shots: 1, hits: 0, blocked_shots: 0 }],
      forge_goalie_projections: [goalieProjection()], forge_goalie_game: [goalieAppearance(30)],
      wgo_goalie_stats: [{ game_id: 1, goalie_id: 30, games_started: 1 }], goalie_stats_unified: [goalieActual(30)],
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ totalRows: 0, issuanceDiagnostics: { skaterRowsExcluded: 1, goalieTeamRowsExcluded: 1 } });
    const statRows = upserts.filter(u => u.table === "forge_projection_accuracy_stat_daily").flatMap(u => u.rows as any[]);
    expect(statRows.filter(row => row.scope === "goalie")).toHaveLength(4);
    expect(statRows.every(row => row.player_count === 0)).toBe(true);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_source_run_id: "run-a08", p_rows: [] });
  });

  it("keeps a 45-second actual stint in seconds in the served TOI attribution", async () => {
    const { res } = await runAccuracyWithTables({
      games: [game()],
      forge_player_projections: [{ ...issued, game_id: 1, player_id: 10, team_id: 8, opponent_team_id: 10,
        proj_goals_es: 0, proj_goals_pp: 0, proj_goals_pk: 0, proj_assists_es: 0, proj_assists_pp: 0, proj_assists_pk: 0,
        proj_shots_es: 2, proj_shots_pp: 0, proj_shots_pk: 0, proj_toi_es_seconds: 900, proj_toi_pp_seconds: 0, proj_toi_pk_seconds: 0,
        proj_hits: 0, proj_blocks: 0, uncertainty: {} }],
      wgo_skater_stats: [{ game_id: 1, player_id: 10, goals: 0, assists: 0, pp_points: 0, shots: 1, hits: 0, blocked_shots: 0,
        date: "2026-03-20", toi_per_game: 45, ev_time_on_ice: 45, pp_toi: 0, sh_time_on_ice: 0 }],
    });
    expect(res.statusCode).toBe(200);
    // 2 shots × 0.2 FP/shot × |45/900 - 1| = 0.38 (not the old 0.8).
    expect(res.body.skaterMissAttributionDiagnostics.toi_miss.contribution).toBeCloseTo(0.38);
  });

  it("treats a null predicted or actual stat as unknown, never as zero", async () => {
    // Skater 12: proj_hits null. Skater 13: actual hits null. Goalie 32:
    // candidate if-starts shutout probability null. Goalie 33: actuals only
    // in forge_goalie_game (a real 30-save shutout win), so wins/shutouts are
    // unknown there.
    const skater = (player_id: number, proj_hits: number | null) => ({
      ...issued, game_id: 1, player_id, team_id: 8, opponent_team_id: 10,
      proj_goals_es: 0.4, proj_goals_pp: 0.2, proj_goals_pk: 0,
      proj_assists_es: 0.5, proj_assists_pp: 0.1, proj_assists_pk: 0,
      proj_shots_es: 2.7, proj_shots_pp: 0.8, proj_shots_pk: 0,
      proj_toi_es_seconds: 900, proj_toi_pp_seconds: 120, proj_toi_pk_seconds: 0,
      proj_hits, proj_blocks: 0.4, uncertainty: {}
    });
    const goalie = (id: number, p: number, shutout: number | null) => goalieProjection([candidate(id, p, 0.55, shutout)], id);
    const tables: Record<string, unknown[]> = {
      forge_player_projections: [skater(10, 0.6), skater(12, null), skater(13, 0.6)],
      games: [game(), game(30), game(32), game(33)],
      wgo_skater_stats: [10, 12, 13].map((player_id) => ({
        game_id: 1, player_id, goals: 1, assists: 0, pp_points: 0, shots: 3,
        hits: player_id === 13 ? null : 1, blocked_shots: 0, date: "2026-03-20",
        toi_per_game: 1080, ev_time_on_ice: null, pp_toi: null, sh_time_on_ice: null
      })),
      forge_goalie_projections: [
        goalie(30, 0.9, 0.05),
        goalie(32, 0.8, null),
        goalie(33, 0.7, 0.06)
      ],
      goalie_stats_unified: [30, 32].map(id => goalieActual(id, id)),
      forge_goalie_game: [30, 32, 33].map(id => goalieAppearance(id, id)),
      wgo_goalie_stats: [30, 32, 33].map(id => ({ game_id: id, goalie_id: id, games_started: 1 })),
    };

    const { res, rpc, upserts } = await runAccuracyWithTables(tables);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      skaterRows: 1,
      goalieRows: 1,
      unknownStatSkips: {
        prediction: { hits: 1, shutout_prob: 1 },
        actual: { hits: 1, win_prob: 1, shutout_prob: 1 },
        skaterFantasyRows: 2,
        goalieFantasyRows: 2
      },
      scanSummary: {
        rowCounts: { skaterUnknownStatRows: 2, goalieUnknownStatRows: 2 }
      },
      goalieProbabilityCalibration: {
        starter_probability: { sample_count: 3 },
        win_probability: { sample_count: 2 },
        shutout_probability: { sample_count: 1 }
      }
    });
    const writtenRows = rpc.mock.calls[0][1].p_rows as any[];
    expect(writtenRows.map((row) => row.player_id)).toEqual([10, 30]);

    const statRows = upserts
      .filter((u) => u.table === "forge_projection_accuracy_stat_daily")
      .flatMap((u) => u.rows as any[]);
    const count = (scope: string, key: string) =>
      statRows.find((r) => r.scope === scope && r.stat_key === key)?.player_count;
    expect(count("skater", "goals")).toBe(3);
    expect(count("skater", "hits")).toBe(1);
    expect(count("goalie", "saves")).toBe(3);
    expect(count("goalie", "win_prob")).toBe(2);
    expect(count("goalie", "shutout_prob")).toBe(1);
  });
});
