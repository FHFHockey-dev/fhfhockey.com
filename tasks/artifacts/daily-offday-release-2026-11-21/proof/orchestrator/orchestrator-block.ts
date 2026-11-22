
// ---- Scratch proof (2026-11-21): resumable daily_incremental run whose source date has zero games ----
import { readFileSync as __rf, writeFileSync as __wf } from "node:fs";
const __BODIES = JSON.parse(__rf(process.env.ROUTE_BODIES_JSON!, "utf8"));
const __ROLLING_ZERO = __BODIES.rolling;
const __reply = (r: any) => async (_req: any, res: any) => { res.status(r.statusCode).json(r.body); };
const __OUT = process.env.ORCH_OUT_JSON!;

describe("ZERO-GAME source date: slate 2026-11-21, source 2026-11-20", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pipelineStateRows.clear();
    process.env.CRON_SECRET = "test-secret";
    vi.useFakeTimers({ toFake: ["Date"] });
    // games for the source date 2026-11-20: none.
    gamesOrderMock.mockResolvedValue({ data: [], error: null });
    // The RC producer's verified off-day answer (shape from the RC's own update-nst-gamelog test).
    updateNstGamelogMock.mockImplementation(async (_req: any, res: any) => {
      res.status(200).json({ success: true, operationStatus: "skipped_no_completed_games",
        nstProgress: { state: "skipped_no_completed_games", networkAttempts: 0, plannedRequestCount: 0,
          verifiedOffDates: ["2026-11-20"], missingScheduleDates: [], auditPersistence: "confirmed",
          continuation: { nextIndex: 0, totalUrls: 0, blocked: false } } });
    });
    updateRollingPlayerAveragesMock.mockImplementation(async (_req: any, res: any) => {
      res.status(__ROLLING_ZERO.statusCode).json(__ROLLING_ZERO.body);
    });
    updateWgoSkatersMock.mockImplementation(__reply(__BODIES.wgoSkaters));
    updateLineCombinationsMock.mockImplementation(__reply(__BODIES.lineCombinations));
  });
  afterEach(() => { vi.useRealTimers(); });

  it("runs every blocking stage to completion in one scheduled invocation", async () => {
    vi.setSystemTime(new Date("2026-11-21T10:05:31.000Z"));
    const req: any = { method: "GET", query: { mode: "daily_incremental", includeDownstream: "true",
      includeAccuracy: "false", stopOnFailure: "false" },
      url: "/api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental&includeDownstream=true&includeAccuracy=false&stopOnFailure=false" };
    const res = createMockRes();
    await handler(req, res);

    const stages = res.body.stages.map((s: any) => ({ id: s.id, status: s.status,
      steps: s.steps.map((st: any) => ({ id: st.id, status: st.status, query: st.query, reason: st.reason ?? null })) }));
    const calls = (m: any) => m.mock.calls.map((c: any[]) => c[0].query);
    __wf(__OUT, JSON.stringify({
      statusCode: res.statusCode, success: res.body.success, termination: res.body.termination,
      dateWindow: res.body.dateWindow, stages,
      pipelineState: [...pipelineStateRows.values()].map((r) => ({ op: r.operation_key, status: r.status, last_error: r.last_error })),
      childCalls: {
        nst: calls(updateNstGamelogMock), wgoSkaters: calls(updateWgoSkatersMock), wgoTotals: calls(updateWgoTotalsMock),
        lineCombinations: calls(updateLineCombinationsMock), powerPlay: calls(updatePowerPlayCombinationsMock),
        rolling: calls(updateRollingPlayerAveragesMock), ingest: calls(ingestProjectionInputsMock),
        relationships: calls(shiftChartsMock), derived: calls(buildProjectionDerivedMock),
        goalie: calls(updateGoalieProjectionsV2Mock), projection: calls(runProjectionV2Mock)
      },
      lineContextReads: lineCombosInMock.mock.calls.length, ppContextReads: ppCombosInMock.mock.calls.length
    }, null, 2));

    const byId = Object.fromEntries(res.body.stages.map((s: any) => [s.id, s]));
    expect(res.body.dateWindow).toMatchObject({ date: "2026-11-21", sourceStartDate: "2026-11-20", sourceEndDate: "2026-11-20",
      rollingStartDate: "2026-11-20", rollingEndDate: "2026-11-20" });
    expect(byId.upstream_skater_sources.steps.map((s: any) => [s.id, s.status])).toEqual([
      ["update-nst-gamelog", "skipped"], ["update-wgo-skaters", "success"], ["update-wgo-totals", "success"]]);
    // Zero source games: line combinations fall back to the recent-gap mode, power play is skipped, no verify reads.
    expect(byId.contextual_builders.steps.map((s: any) => [s.id, s.status])).toEqual([
      ["update-line-combinations", "success"], ["update-power-play-combinations-batch", "skipped"]]);
    expect(updateLineCombinationsMock.mock.calls[0][0].query).toEqual({ count: "10" });
    expect(updatePowerPlayCombinationsMock).not.toHaveBeenCalled();
    expect(lineCombosInMock).not.toHaveBeenCalled();
    expect(updateRollingPlayerAveragesMock.mock.calls[0][0].query).toMatchObject({ startDate: "2026-11-20", endDate: "2026-11-20" });
    for (const id of ["core_entity_freshness", "upstream_skater_sources", "contextual_builders", "rolling_player_recompute",
      "projection_input_ingest", "projection_relationship_build", "projection_derived_build", "projection_execution"]) {
      expect([id, ["success", "skipped"].includes(byId[id].status)]).toEqual([id, true]);
      expect([...pipelineStateRows.values()].find((r) => r.operation_key === id)?.status).toBe("complete");
    }
    expect(runProjectionV2Mock.mock.calls.map((c: any[]) => c[0].query.date)).toEqual(["2026-11-21", "2026-11-22"]);
    expect(res.body.termination).toMatchObject({ state: "completed", resumeRequired: false });
  });
  it("RECOVERY CHECK: with the live 11-21 state (upstream failed at attempt 2) the scheduled RC run does not retry", async () => {
    // Seed the production state read at 10:10Z (projection_pipeline_state, daily_incremental:2026-11-21).
    const seed = (op: string, status: string, revision: number, last_error: string | null) =>
      pipelineStateRows.set(`rolling_forge_pipeline|daily_incremental:2026-11-21|${op}`, {
        pipeline_key: "rolling_forge_pipeline", scope_key: "daily_incremental:2026-11-21", operation_key: op,
        revision, status, cursor_game_id: null, cursor_date: null, range_start_date: null, range_end_date: null,
        lease_owner: null, lease_expires_at: null, last_error, updated_at: "2026-11-21T10:10:27Z" });
    seed("core_entity_freshness", "complete", 2, null);
    seed("upstream_skater_sources", "failed", 4, "stage_failed:attempt-2");
    vi.setSystemTime(new Date("2026-11-21T19:00:00.000Z"));
    const req: any = { method: "GET", query: { mode: "daily_incremental", includeDownstream: "true",
      includeAccuracy: "false", stopOnFailure: "false" }, url: "/api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental" };
    const res = createMockRes();
    await handler(req, res);
    __wf(process.env.ORCH_RECOVERY_OUT_JSON!, JSON.stringify({ statusCode: res.statusCode, termination: res.body.termination,
      stages: res.body.stages.map((s: any) => ({ id: s.id, status: s.status, reason: s.reason ?? null })),
      nstCalls: updateNstGamelogMock.mock.calls.length }, null, 2));
    expect(updateNstGamelogMock).not.toHaveBeenCalled();
    expect(res.body.termination).toMatchObject({ state: "stopped_on_blocking_failure", reason: "attempts_exhausted",
      nextStageId: "upstream_skater_sources" });
  });
});
