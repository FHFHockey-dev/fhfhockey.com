// Appended to the unchanged owner's test harness prefix in an isolated test file.
// Existing candidate source/tests stay byte-identical. All providers are mocked.
import serverClient from "lib/supabase/server";

describe("independent NST continuation safety review", () => {
  const stageKey = (id: string) => `rolling_forge_pipeline|daily_incremental:2026-10-19|${id}`;
  const stageRow = () => pipelineStateRows.get(stageKey("upstream_skater_sources"));
  const originalRpc = pipelineStateRpc.getMockImplementation()!;
  const originalFrom = vi.mocked(serverClient.from).getMockImplementation()!;
  const success = async (_req: any, res: any) => res.status(200).json({ success: true });
  const signal = () => {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
  };
  const invoke = async (query: Record<string, string> = {}) => {
    const res = createMockRes();
    await handler({ method: "GET", headers: {}, query: { mode: "daily_incremental", includeAccuracy: "false", ...query } } as any, res);
    return res;
  };
  const seed = (id: string, extras: Record<string, unknown> = {}) => pipelineStateRows.set(stageKey(id), {
    pipeline_key: "rolling_forge_pipeline", scope_key: "daily_incremental:2026-10-19", operation_key: id,
    revision: 1, status: "complete", cursor_game_id: null, cursor_date: "2026-10-19",
    range_start_date: "2026-10-19", range_end_date: "2026-10-19", lease_owner: null,
    lease_expires_at: null, last_error: null, updated_at: "2026-10-19T10:04:00.000Z", ...extras
  });
  const partial = (cursor: unknown, change: (query: Record<string, string>) => any = q => q) => async (req: any, res: any) =>
    res.status(207).json({ success: false, operationStatus: "continuation_required",
      nstProgress: { auditPersistence: "confirmed" },
      resume: { required: true, request: { query: change({ ...req.query, cursor }) } } });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T10:05:00.000Z"));
    pipelineStateRows.clear();
    pipelineStateRpc.mockImplementation(originalRpc);
    vi.mocked(serverClient.from).mockImplementation(originalFrom);
    process.env.CRON_SECRET = "test-secret";
    for (const mock of [updateGamesMock, updateTeamsMock, updatePlayersMock, updateNstGamelogMock,
      updateWgoSkatersMock, updateWgoTotalsMock, updateWgoAveragesMock, updateLineCombinationsMock,
      updatePowerPlayCombinationsMock, updateRollingPlayerAveragesMock, ingestProjectionInputsMock,
      shiftChartsMock, buildProjectionDerivedMock, updateGoalieProjectionsV2Mock, runProjectionV2Mock, runProjectionAccuracyMock]) {
      mock.mockReset().mockImplementation(success);
    }
    seed("core_entity_freshness");
    seed("upstream_skater_sources", { status: "failed", last_error: "stage_handoff", cursor_game_id: 7 });
  });
  afterEach(() => {
    pipelineStateRpc.mockImplementation(originalRpc);
    vi.mocked(serverClient.from).mockImplementation(originalFrom);
    vi.useRealTimers();
  });

  it("must preserve a durable manual-review hold when another same-version invocation read state before the hold", async () => {
    const enteredNst = signal(), releaseNst = signal(), readSnapshot = signal(), releaseSnapshot = signal();
    updateNstGamelogMock.mockImplementationOnce(async (_req: any, res: any) => {
      enteredNst.resolve();
      await releaseNst.promise;
      res.status(500).json({ success: false, error: "audit acknowledgement lost", auditPersistence: "not_confirmed" });
    });
    const firstPromise = invoke();
    await enteredNst.promise;
    let intercept = true;
    vi.mocked(serverClient.from).mockImplementation(((table: string) => {
      const query = originalFrom(table as any);
      if (table === "projection_pipeline_state" && intercept) {
        intercept = false;
        const originalThen = (query as any).then;
        (query as any).then = (resolve: any, reject: any) => originalThen(async (snapshot: any) => {
          readSnapshot.resolve();
          await releaseSnapshot.promise;
          return resolve(snapshot);
        }, reject);
      }
      return query;
    }) as any);
    const observerPromise = invoke();
    await readSnapshot.promise;
    releaseNst.resolve();
    const first = await firstPromise;
    expect(first.body.termination.reason).toBe("manual_review_required");
    expect(stageRow().last_error).toBe("nst_persistence_unconfirmed");
    releaseSnapshot.resolve();
    const observer = await observerPromise;
    console.log("REVIEW_RACE_OBSERVED", JSON.stringify({ nstCalls: updateNstGamelogMock.mock.calls.length,
      observerTermination: observer.body.termination, finalStage: stageRow() }));
    expect.soft(updateNstGamelogMock).toHaveBeenCalledTimes(1);
    expect.soft(observer.body.termination.reason).toBe("manual_review_required");
    expect.soft(stageRow().last_error).toBe("nst_persistence_unconfirmed");
  });

  it("must not advertise retry when a manual-review hold cannot be saved", async () => {
    pipelineStateRpc.mockImplementation(async (name: string, args: any) => {
      if (args.p_transition === "fail" && args.p_last_error === "nst_persistence_unconfirmed") {
        return { data: null, error: { message: "synthetic hold persistence failure" } };
      }
      return originalRpc(name, args);
    });
    updateNstGamelogMock.mockImplementationOnce(async (_req: any, res: any) =>
      res.status(500).json({ success: false, error: "write acknowledgement lost", writePersistence: "not_confirmed" }));
    const first = await invoke();
    console.log("REVIEW_FAILED_HOLD_FIRST", JSON.stringify({ termination: first.body.termination, row: stageRow() }));
    expect.soft(first.body.termination).toMatchObject({ resumeRequired: false, reason: "manual_review_required" });
    vi.setSystemTime(new Date("2026-10-19T10:15:00.000Z"));
    const next = await invoke();
    console.log("REVIEW_FAILED_HOLD_NEXT", JSON.stringify({ nstCalls: updateNstGamelogMock.mock.calls.length,
      termination: next.body.termination, row: stageRow() }));
    expect.soft(updateNstGamelogMock).toHaveBeenCalledTimes(1);
    expect.soft(updateWgoSkatersMock).not.toHaveBeenCalled();
  });

  it.each([
    ["numeric cursor", partial(8)],
    ["unsafe integer cursor", partial("9007199254740992")],
    ["array replay query", partial("8", () => [])],
    ["removed scope field", partial("8", q => { delete q.endDate; return q; })],
  ])("rejects %s without advancing persisted progress", async (_label, responder) => {
    updateNstGamelogMock.mockImplementationOnce(responder);
    const result = await invoke();
    expect(result.body.termination.state).toBe("stopped_on_blocking_failure");
    expect(stageRow().cursor_game_id).toBe(7);
    expect(updateWgoSkatersMock).not.toHaveBeenCalled();
  });

  it("keeps the Eastern completed date across UTC midnight with a new deadline", async () => {
    pipelineStateRows.clear();
    vi.setSystemTime(new Date("2026-10-20T00:30:00.000Z"));
    updateNstGamelogMock.mockImplementationOnce(partial("7"));
    await invoke();
    const firstQuery = updateNstGamelogMock.mock.calls[0][0].query;
    vi.setSystemTime(new Date("2026-10-20T00:35:00.000Z"));
    await invoke();
    const nextQuery = updateNstGamelogMock.mock.calls[1][0].query;
    expect(firstQuery).toMatchObject({ startDate: "2026-10-18", endDate: "2026-10-18" });
    expect(nextQuery).toEqual({ ...firstQuery, cursor: "7", deadlineAt: String(Number(firstQuery.deadlineAt) + 300000) });
  });
});
