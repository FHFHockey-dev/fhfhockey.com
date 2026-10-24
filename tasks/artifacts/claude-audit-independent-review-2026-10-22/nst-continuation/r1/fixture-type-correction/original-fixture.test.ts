import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
}));

const {
  updateGamesMock,
  updateTeamsMock,
  updatePlayersMock,
  updateNstGamelogMock,
  updateWgoSkatersMock,
  updateWgoTotalsMock,
  updateWgoAveragesMock,
  updateLineCombinationsMock,
  updatePowerPlayCombinationsMock,
  updateRollingPlayerAveragesMock,
  ingestProjectionInputsMock,
  shiftChartsMock,
  buildProjectionDerivedMock,
  updateGoalieProjectionsV2Mock,
  runProjectionV2Mock,
  runProjectionAccuracyMock,
  auditInsertMock,
  gamesSelectMock,
  gamesGteMock,
  gamesLteMock,
  gamesOrderMock,
  lineCombosInMock,
  lineCombosSelectMock,
  pipelineStateRows,
  pipelineStateFrom,
  pipelineStateRpc
} = vi.hoisted(() => {
  // In-memory projection_pipeline_state with the lease rules of
  // advance_projection_pipeline_state_v1 that the pipeline relies on.
  const pipelineStateRows = new Map<string, any>();
  const rowKey = (pipeline: string, scope: string, operation: string) =>
    `${pipeline}|${scope}|${operation}`;
  const pipelineStateFrom = () => {
    const filters: Record<string, unknown> = {};
    const rows = () =>
      [...pipelineStateRows.values()].filter((row) =>
        Object.entries(filters).every(([key, value]) => row[key] === value)
      );
    const query: any = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return query;
      },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      then: (resolve: any, reject: any) =>
        Promise.resolve({ data: rows(), error: null }).then(resolve, reject)
    };
    return query;
  };
  const pipelineStateRpc = vi.fn(async (_name: string, a: any) => {
    const key = rowKey(a.p_pipeline_key, a.p_scope_key, a.p_operation_key);
    const current = pipelineStateRows.get(key);
    const fail = (message: string) => ({ data: null, error: { message } });
    if (!current && (a.p_transition !== "acquire" || a.p_expected_revision !== 0)) {
      return fail("PROJECTION_PIPELINE_STATE_ABSENT");
    }
    if (current) {
      if (current.revision !== a.p_expected_revision) {
        return fail("PROJECTION_PIPELINE_REVISION_MISMATCH");
      }
      if (a.p_transition === "acquire" && current.status === "complete") {
        return { data: [current], error: null };
      }
      if (
        a.p_transition === "acquire" &&
        current.status === "running" &&
        Date.parse(current.lease_expires_at) > Date.now() &&
        current.lease_owner !== a.p_lease_owner
      ) {
        return fail("PROJECTION_PIPELINE_LEASE_HELD");
      }
      if (
        a.p_transition !== "acquire" &&
        (current.status !== "running" || current.lease_owner !== a.p_lease_owner)
      ) {
        return fail("PROJECTION_PIPELINE_LEASE_MISMATCH");
      }
      if (
        a.p_transition === "advance" &&
        current.cursor_game_id != null &&
        (a.p_next_cursor_game_id == null || a.p_next_cursor_game_id < current.cursor_game_id)
      ) {
        return fail("PROJECTION_PIPELINE_CURSOR_REGRESSION");
      }
    }
    const running = a.p_next_status === "running";
    const row = {
      pipeline_key: a.p_pipeline_key,
      scope_key: a.p_scope_key,
      operation_key: a.p_operation_key,
      revision: (current?.revision ?? 0) + 1,
      status: a.p_next_status,
      cursor_game_id: a.p_next_cursor_game_id,
      cursor_date: a.p_next_cursor_date,
      range_start_date: a.p_range_start_date,
      range_end_date: a.p_range_end_date,
      lease_owner: running ? a.p_lease_owner : null,
      lease_expires_at: running ? a.p_lease_expires_at : null,
      last_error: a.p_next_status === "failed" ? a.p_last_error : null,
      updated_at: new Date().toISOString()
    };
    pipelineStateRows.set(key, row);
    return { data: [row], error: null };
  });

  const successResponder = vi.fn(async (_req: any, res: any) => {
    res.status(200).json({ success: true });
  });
  const gamesOrderMock = vi.fn(async () => ({
    data: [{ id: 2025021023 }, { id: 2025021024 }],
    error: null
  }));
  const gamesLteMock = vi.fn(() => ({
    order: gamesOrderMock
  }));
  const gamesGteMock = vi.fn(() => ({
    lte: gamesLteMock
  }));
  const gamesSelectMock = vi.fn(() => ({
    gte: gamesGteMock
  }));
  // lineCombinations rows for the source date's games; both teams by default.
  const lineCombosInMock = vi.fn(async (_column: string, gameIds: number[]) => ({
    data: gameIds.flatMap((gameId) => [
      { gameId, teamId: 1 },
      { gameId, teamId: 2 }
    ]),
    error: null
  }));
  const lineCombosSelectMock = vi.fn(() => ({ in: lineCombosInMock }));
  return {
    updateGamesMock: vi.fn(successResponder),
    updateTeamsMock: vi.fn(successResponder),
    updatePlayersMock: vi.fn(successResponder),
    updateNstGamelogMock: vi.fn(successResponder),
    updateWgoSkatersMock: vi.fn(successResponder),
    updateWgoTotalsMock: vi.fn(successResponder),
    updateWgoAveragesMock: vi.fn(successResponder),
    updateLineCombinationsMock: vi.fn(successResponder),
    updatePowerPlayCombinationsMock: vi.fn(successResponder),
    updateRollingPlayerAveragesMock: vi.fn(successResponder),
    ingestProjectionInputsMock: vi.fn(successResponder),
    shiftChartsMock: vi.fn(successResponder),
    buildProjectionDerivedMock: vi.fn(successResponder),
    updateGoalieProjectionsV2Mock: vi.fn(successResponder),
    runProjectionV2Mock: vi.fn(successResponder),
    runProjectionAccuracyMock: vi.fn(successResponder),
    auditInsertMock: vi.fn().mockResolvedValue({ error: null }),
    gamesSelectMock,
    gamesGteMock,
    gamesLteMock,
    gamesOrderMock,
    lineCombosInMock,
    lineCombosSelectMock,
    pipelineStateRows,
    pipelineStateFrom,
    pipelineStateRpc
  };
});

vi.mock("lib/supabase", () => ({
  default: {
    from: vi.fn(() => ({
      insert: auditInsertMock
    }))
  }
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: vi.fn((table: string) =>
      table === "cron_job_audit"
        ? { insert: auditInsertMock }
        : table === "projection_pipeline_state"
          ? pipelineStateFrom()
          : table === "lineCombinations"
            ? { select: lineCombosSelectMock }
            : { select: gamesSelectMock }
    ),
    rpc: pipelineStateRpc
  }
}));

vi.mock("../../../../../pages/api/v1/db/update-games", () => ({ default: updateGamesMock }));
vi.mock("../../../../../pages/api/v1/db/update-teams", () => ({ default: updateTeamsMock }));
vi.mock("../../../../../pages/api/v1/db/update-players", () => ({ default: updatePlayersMock }));
vi.mock("../../../../../pages/api/v1/db/update-nst-gamelog", () => ({ default: updateNstGamelogMock }));
vi.mock("../../../../../pages/api/v1/db/update-wgo-skaters", () => ({ default: updateWgoSkatersMock }));
vi.mock("../../../../../pages/api/v1/db/update-wgo-totals", () => ({ default: updateWgoTotalsMock }));
vi.mock("../../../../../pages/api/v1/db/update-wgo-averages", () => ({ default: updateWgoAveragesMock }));
vi.mock("../../../../../pages/api/v1/db/update-line-combinations", () => ({
  default: updateLineCombinationsMock
}));
vi.mock("../../../../../pages/api/v1/db/update-power-play-combinations", () => ({
  default: updatePowerPlayCombinationsMock
}));
vi.mock("../../../../../pages/api/v1/db/update-rolling-player-averages", () => ({
  default: updateRollingPlayerAveragesMock
}));
vi.mock("../../../../../pages/api/v1/db/ingest-projection-inputs", () => ({
  default: ingestProjectionInputsMock
}));
vi.mock("../../../../../pages/api/v1/db/shift-charts", () => ({
  default: shiftChartsMock
}));
vi.mock("../../../../../pages/api/v1/db/build-projection-derived-v2", () => ({
  default: buildProjectionDerivedMock
}));
vi.mock("../../../../../pages/api/v1/db/update-goalie-projections-v2", () => ({
  default: updateGoalieProjectionsV2Mock
}));
vi.mock("../../../../../pages/api/v1/db/run-projection-v2", () => ({ default: runProjectionV2Mock }));
vi.mock("../../../../../pages/api/v1/db/run-projection-accuracy", () => ({
  default: runProjectionAccuracyMock
}));

import handler, { __testables } from "../../../../../pages/api/v1/db/run-rolling-forge-pipeline";
import { readRollingForgeRunState, readRollingForgeStageKills, recordRollingForgeStageKill } from "lib/rollingForgePipelineRunState";

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

// Appended to the unchanged owner's test harness prefix in an isolated test file.
// Existing candidate source/tests stay byte-identical. All providers are mocked.
import serverClient from "lib/supabase/server";

describe("independent R1 fencing and recovery review", () => {
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

  it.each([
    ["active", "2026-10-19T10:09:30.000Z", "stage_in_progress_elsewhere"],
    ["expired", "2026-10-19T10:04:00.000Z", "manual_review_required"],
    ["missing", null, "manual_review_required"],
  ])("does not mutate or reacquire an existing %s NST lease", async (_label, expires, expectedReason) => {
    seed("upstream_skater_sources", { status: "running", cursor_game_id: 7, lease_owner: "prior-owner", lease_expires_at: expires });
    const before = { ...stageRow() };
    const response = await invoke();
    expect(response.body.termination.reason).toBe(expectedReason);
    expect(stageRow()).toEqual(before);
    expect(pipelineStateRpc).not.toHaveBeenCalled();
    expect(updateNstGamelogMock).not.toHaveBeenCalled();
    expect(updateWgoSkatersMock).not.toHaveBeenCalled();
    expect([...pipelineStateRows.keys()].some(key => key.includes(":kill:"))).toBe(false);
  });

  it("fences a newer durable hold written after the fresh acquisition read", async () => {
    let intercept = true;
    vi.mocked(serverClient.from).mockImplementation(((table: string) => {
      const query = originalFrom(table as any);
      if (table === "projection_pipeline_state" && intercept) {
        const single = (query as any).maybeSingle;
        (query as any).maybeSingle = async () => {
          const snapshot = await single();
          if (intercept && snapshot.data?.operation_key === "upstream_skater_sources") {
            intercept = false;
            pipelineStateRows.set(stageKey("upstream_skater_sources"), { ...snapshot.data,
              revision: snapshot.data.revision + 1, status: "failed", last_error: "nst_persistence_unconfirmed" });
          }
          return snapshot;
        };
      }
      return query;
    }) as any);
    const response = await invoke();
    expect(response.body.termination.reason).toBe("stage_in_progress_elsewhere");
    expect(response.body.termination.detail).toContain("REVISION_MISMATCH");
    expect(stageRow()).toMatchObject({ revision: 2, last_error: "nst_persistence_unconfirmed" });
    expect(updateNstGamelogMock).not.toHaveBeenCalled();
    const next = await invoke();
    expect(next.body.termination).toMatchObject({ reason: "manual_review_required", resumeRequired: false });
    expect(updateNstGamelogMock).not.toHaveBeenCalled();
  });

  it("does not invoke NST after a committed acquisition returns a mismatched receipt", async () => {
    let corrupt = true;
    pipelineStateRpc.mockImplementation(async (name: string, args: any) => {
      const result = await originalRpc(name, args);
      if (corrupt && args.p_operation_key === "upstream_skater_sources" && args.p_transition === "acquire") {
        corrupt = false;
        return { ...result, data: [{ ...result.data[0], cursor_game_id: 99 }] };
      }
      return result;
    });
    const response = await invoke();
    expect(response.body.termination).toMatchObject({ reason: "state_error" });
    expect(updateNstGamelogMock).not.toHaveBeenCalled();
    expect(stageRow()).toMatchObject({ status: "running", cursor_game_id: 7 });
    vi.setSystemTime(new Date("2026-10-19T10:15:00.000Z"));
    const next = await invoke();
    expect(next.body.termination).toMatchObject({ reason: "manual_review_required", resumeRequired: false });
    expect(updateNstGamelogMock).not.toHaveBeenCalled();
  });

  it.each([true, false])("requires a durable handoff row when its acknowledgement was lost (committed=%s)", async committed => {
    pipelineStateRpc.mockImplementation(async (name: string, args: any) => {
      if (args.p_transition === "fail" && args.p_last_error === "stage_handoff") {
        if (committed) await originalRpc(name, args);
        return { data: null, error: { message: "handoff acknowledgement lost" } };
      }
      return originalRpc(name, args);
    });
    updateNstGamelogMock.mockImplementationOnce(partial("15"));
    const first = await invoke();
    expect(first.body.termination.reason).toBe("state_error");
    expect(stageRow()).toMatchObject({ cursor_game_id: 15, status: committed ? "failed" : "running" });
    expect(updateWgoSkatersMock).not.toHaveBeenCalled();
    vi.setSystemTime(new Date("2026-10-19T10:15:00.000Z"));
    const next = await invoke();
    if (committed) {
      expect(next.body.termination.state).toBe("completed");
      expect(updateNstGamelogMock).toHaveBeenCalledTimes(2);
      expect(updateNstGamelogMock.mock.calls[1][0].query.cursor).toBe("15");
      expect(updateWgoSkatersMock).toHaveBeenCalledTimes(1);
    } else {
      expect(next.body.termination).toMatchObject({ reason: "manual_review_required", resumeRequired: false });
      expect(updateNstGamelogMock).toHaveBeenCalledTimes(1);
      expect(updateWgoSkatersMock).not.toHaveBeenCalled();
    }
  });

  it("retains the normal bounded retry for an acknowledged non-ambiguous NST failure", async () => {
    updateNstGamelogMock.mockImplementation(async (_req: any, res: any) => res.status(503).json({ success: false, error: "provider rejected request" }));
    const first = await invoke();
    expect(first.body.termination).toMatchObject({ reason: "retry_on_next_invocation", resumeRequired: true });
    const second = await invoke();
    expect(second.body.termination).toMatchObject({ reason: "attempts_exhausted", resumeRequired: false });
    const third = await invoke();
    expect(third.body.termination).toMatchObject({ reason: "attempts_exhausted", resumeRequired: false });
    expect(updateNstGamelogMock).toHaveBeenCalledTimes(2);
    expect(updateWgoSkatersMock).not.toHaveBeenCalled();
  });
});
