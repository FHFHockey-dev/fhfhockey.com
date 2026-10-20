import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.fn();

vi.mock("lib/supabase/server", () => ({
  default: {
    from: vi.fn(() => ({
      insert: insertMock,
    })),
  },
}));

import {
  cronClassificationFromAuditDetails,
  withCronJobAudit,
} from "lib/cron/withCronJobAudit";
import {
  NHL_SEASONAL_GAME_DATA,
  withNhlOffSeasonSkip,
  type NhlSeasonWindow,
} from "lib/cron/nhlOffSeason";
import { withCronJobTiming } from "lib/cron/timingContract";

function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    method: "GET",
    url: "/api/v1/db/example",
    ...overrides,
  } as any;
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headersSent: false,
    headers: {} as Record<string, unknown>,
    body: undefined as unknown,
    setHeader(name: string, value: unknown) {
      this.headers[name] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      this.headersSent = true;
      return this;
    },
    send(body: unknown) {
      this.body = body;
      this.headersSent = true;
      return this;
    },
  };

  return res;
}

describe("withCronJobAudit", () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    insertMock.mockReset();
    insertMock.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds timing to wrapper-generated 500 responses when the handler throws", async () => {
    const wrapped = withCronJobAudit(
      async () => {
        throw new Error("boom");
      },
      { jobName: "test-job" }
    );

    const req = createMockReq();
    const res = createMockRes();

    await wrapped(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      error: "boom",
    });
    expect((res.body as any).timing.startedAt).toMatch(/T/);
    expect((res.body as any).timing.endedAt).toMatch(/T/);
    expect((res.body as any).timing.durationMs).toBeTypeOf("number");
    expect((res.body as any).timing.timer).toMatch(/^\d{2,}:\d{2}$/);

    expect(insertMock).toHaveBeenCalledTimes(1);
    const row = insertMock.mock.calls[0][0];
    expect(row.job_name).toBe("test-job");
    expect(row.status).toBe("failure");
    expect(row.details.timing.source).toBe("audit");
    expect(row.details.error).toBe("boom");
  });

  it("records canonical audit timing even when the handler returns a timed failure payload", async () => {
    const startedAt = "2026-03-20T11:00:00.000Z";
    const endedAt = "2026-03-20T11:00:12.345Z";

    const wrapped = withCronJobAudit(
      async (_req, res) => {
        return res.status(422).json(
          withCronJobTiming(
            {
              success: false,
              error: "preflight failed",
              processedRows: 17,
            },
            startedAt,
            endedAt
          )
        );
      },
      { jobName: "timed-failure-job" }
    );

    const req = createMockReq();
    const res = createMockRes();

    await wrapped(req, res);

    expect(res.statusCode).toBe(422);
    expect((res.body as any).timing).toEqual({
      startedAt,
      endedAt,
      durationMs: 12_345,
      timer: "00:12",
    });

    const row = insertMock.mock.calls[0][0];
    expect(row.status).toBe("failure");
    expect(row.details.durationMs).toBe(12_345);
    expect(row.details.timing).toEqual({
      startedAt,
      endedAt,
      durationMs: 12_345,
      timer: "00:12",
      source: "audit",
    });
  });

  it("records an HTTP 200 partial-processing payload with success false as a failure", async () => {
    const wrapped = withCronJobAudit(
      async (_req, res) => {
        return res.json({
          success: false,
          succeeded: 3,
          failed: 1,
          failedRows: 2,
          failures: [
            {
              kind: "goalie_game_stats_batch_failure",
              code: "GOALIE_GAME_STATS_BATCH_FAILED",
              gameId: 2025020001,
            },
          ],
        });
      },
      { jobName: "season-stats-partial-failure" }
    );

    const req = createMockReq();
    const res = createMockRes();

    await wrapped(req, res);

    expect(res.statusCode).toBe(200);
    const row = insertMock.mock.calls[0][0];
    expect(row.status).toBe("failure");
    expect(row.details.failedRows).toBe(2);
    expect(row.details.response).toContain("GOALIE_GAME_STATS_BATCH_FAILED");
  });

  it("records HTTP 207 and nested request errors as a partial failure", async () => {
    const wrapped = withCronJobAudit(
      async (_req, res) =>
        res.status(207).json({
          message: "Processed 1 day.",
          failedRequests: 1,
          summary: { errors: ["NST helper returned HTTP 503"] },
        }),
      { jobName: "nst-team-daily" }
    );

    const req = createMockReq();
    const res = createMockRes();

    await wrapped(req, res);

    expect(insertMock.mock.calls[0][0].status).toBe("failure");
  });

  it("records a planned continuation 207 as continued, not a failure", async () => {
    const forge = withCronJobAudit(async (_req, res) => res.status(207).json({
      success: false,
      failureSummary: { failedStepCount: 0, firstFailure: null },
      termination: { state: "continuation_required", resumeRequired: true, nextStageId: "rolling" },
      stages: [{ steps: [{ status: "partial", summary: { errors: [] } }] }],
    }), { jobName: "rolling-forge-pipeline" });
    const rolling = withCronJobAudit(async (_req, res) => res.status(207).json({
      resumeCursor: { v: 1, status: "partial", nextResumeFrom: 8477000 },
      message: "Rolling player averages stopped at the runtime budget before every player was processed; resume required.",
      success: false,
      operationStatus: "partial",
      resume: { required: true, nextResumeFrom: 8477000, request: { resumeFrom: 8477000 } },
      runSummary: { rowsUpserted: 120, processedPlayers: 40 },
    }), { jobName: "update-rolling-player-averages" });

    await forge(createMockReq(), createMockRes());
    await rolling(createMockReq(), createMockRes());

    expect(insertMock.mock.calls.map((call) => call[0].status)).toEqual(["continued", "continued"]);
    expect(insertMock.mock.calls[0][0].details.responseOutcome.termination.state).toBe("continuation_required");
  });

  it("keeps a 207 continuation that lists failures or errors as a failure", async () => {
    const forge = withCronJobAudit(async (_req, res) => res.status(207).json({
      success: false,
      failureSummary: { failedStepCount: 1, firstFailure: { stageId: "rolling" } },
      termination: { state: "continuation_required", resumeRequired: true },
    }), { jobName: "rolling-forge-pipeline" });
    const rolling = withCronJobAudit(async (_req, res) => res.status(207).json({
      success: false,
      resume: { required: true, request: { resumeFrom: 8477000 } },
      errors: [{ message: "upsert failed" }],
    }), { jobName: "update-rolling-player-averages" });
    const noCursor = withCronJobAudit(async (_req, res) => res.status(207).json({
      success: false,
      operationStatus: "partial",
    }), { jobName: "update-rolling-player-averages" });

    await forge(createMockReq(), createMockRes());
    await rolling(createMockReq(), createMockRes());
    await noCursor(createMockReq(), createMockRes());

    expect(insertMock.mock.calls.map((call) => call[0].status)).toEqual(["failure", "failure", "failure"]);
  });

  it("uses explicit success before legacy failure words and records the season succeeded count", async () => {
    const wrapped = withCronJobAudit(
      async (_req, res) => {
        return res.json({
          seasonId: 20252026,
          success: true,
          message:
            "Stats update complete. Processed: 12, Succeeded: 7, Failed: 0.",
          processed: 12,
          succeeded: 7,
          failed: 0,
          failedRows: 0,
          skipped: 3,
          deferred: 2,
        });
      },
      { jobName: "season-stats-success" }
    );

    const req = createMockReq();
    const res = createMockRes();

    await wrapped(req, res);

    const row = insertMock.mock.calls[0][0];
    expect(row.status).toBe("success");
    expect(row.rows_affected).toBe(7);
    expect(row.details.rowsUpserted).toBe(7);
    expect(row.details.failedRows).toBe(0);
  });

  it("uses an explicit successful status before legacy error words", async () => {
    const wrapped = withCronJobAudit(
      async (_req, res) => {
        return res.json({
          status: "succeeded",
          message: "Completed with 0 errors.",
        });
      },
      { jobName: "explicit-status-success" }
    );

    const req = createMockReq();
    const res = createMockRes();

    await wrapped(req, res);

    expect(insertMock.mock.calls[0][0].status).toBe("success");
  });

  it("can omit inferred row metrics for an observability-only report", async () => {
    const wrapped = withCronJobAudit(
      async (_req, res) =>
        res.json({
          success: true,
          counts: { totalFailedRows: 50 },
          warnings: {
            partialFailureJobs: [
              { displayName: "daily-cron-report", failedRows: 50 },
            ],
          },
        }),
      { jobName: "daily-cron-report", recordRowMetrics: false }
    );

    await wrapped(createMockReq(), createMockRes());

    const row = insertMock.mock.calls[0][0];
    expect(row.rows_affected).toBeNull();
    expect(row.details.rowsUpserted).toBeNull();
    expect(row.details.failedRows).toBeNull();
  });

  it("limits opted-in audit previews to own primitive fields without changing the API or status inference", async () => {
    const body = Object.assign(Object.create({ inherited: "private-inherited-value" }), {
      success: false,
      attempted: 2,
      failed: 1,
      results: [{ userId: "private-user-id", error: "private-provider-error" }],
      unavailableCount: Number.NaN,
    });
    const wrapped = withCronJobAudit(
      async (_req, res) => res.json(body),
      {
        jobName: "bounded-provider-summary",
        recordRowMetrics: false,
        responsePreviewKeys: ["attempted", "failed", "results", "inherited", "unavailableCount"],
      }
    );
    const res = createMockRes();

    await wrapped(createMockReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(body);
    expect(insertMock).toHaveBeenCalledTimes(1);
    const row = insertMock.mock.calls[0][0];
    expect(row.status).toBe("failure");
    expect(row.rows_affected).toBeNull();
    expect(JSON.parse(row.details.response)).toEqual({ attempted: 2, failed: 1 });
    expect(row.details.responseOutcome).toEqual({});
    expect(JSON.stringify(row)).not.toContain("private-");
  });

  it("uses a fixed audit error for opted-in previews while preserving thrown-response behavior", async () => {
    const wrapped = withCronJobAudit(
      async () => { throw new Error("private-provider-error"); },
      { jobName: "bounded-provider-throw", responsePreviewKeys: ["success"] }
    );
    const res = createMockRes();

    await wrapped(createMockReq(), res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe("private-provider-error");
    expect(insertMock).toHaveBeenCalledTimes(1);
    const row = insertMock.mock.calls[0][0];
    expect(row.status).toBe("failure");
    expect(row.details.error).toBe("Handler failed.");
    expect(JSON.parse(row.details.response)).toEqual({ success: false });
    expect(row.details.responseOutcome).toEqual({ success: false });
    expect(JSON.stringify(row)).not.toContain("private-provider-error");
  });

  it("surfaces a resolved Supabase audit insert error", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    insertMock.mockResolvedValueOnce({
      error: { message: "audit insert unavailable" },
    });
    const wrapped = withCronJobAudit(
      async (_req, res) => res.json({ success: true }),
      { jobName: "audit-insert-error" }
    );

    const req = createMockReq();
    const res = createMockRes();

    await wrapped(req, res);

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "cron_job_audit insert failed",
      "audit insert unavailable"
    );
  });

  it("does not silently skip persistence when runtime configuration is unavailable", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const wrapped = withCronJobAudit(
      async (_req, res) => res.json({ success: true }),
      { jobName: "runtime-config-audit" }
    );

    await wrapped(createMockReq(), createMockRes());

    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("persists the audit before flushing the JSON response", async () => {
    let resolveInsert: ((value: unknown) => void) | undefined;
    insertMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveInsert = resolve;
      })
    );
    const wrapped = withCronJobAudit(
      async (_req, res) => res.json({ success: true, rowsAffected: 0 }),
      { jobName: "durable-audit" }
    );
    const res = createMockRes();

    const pending = wrapped(createMockReq(), res);
    await vi.waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));

    expect(res.headersSent).toBe(false);
    expect(res.body).toBeUndefined();

    resolveInsert?.({});
    await pending;

    expect(res.headersSent).toBe(true);
    expect(res.body).toEqual({ success: true, rowsAffected: 0 });
  });

  it("returns a final-audit receipt only for opted-in long-running routes", async () => {
    const wrapped = withCronJobAudit(
      async (_req, res) =>
        res.json({ success: true, termination: { state: "completed" } }),
      { jobName: "long-running-job", includeFinalAuditReceipt: true }
    );
    const res = createMockRes();

    await wrapped(createMockReq(), res);

    expect(res.body).toMatchObject({
      success: true,
      termination: { state: "completed" },
      finalAudit: {
        owner: "withCronJobAudit",
        status: "persisted",
      },
    });
    expect(insertMock.mock.calls[0][0].details.finalAudit).toEqual({
      owner: "withCronJobAudit",
      status: "persisted",
    });
    expect(insertMock.mock.calls[0][0].details.response).toContain(
      '"finalAudit":{"owner":"withCronJobAudit","status":"persisted"}'
    );
  });

  it("retains structured preflight outcomes when the legacy response preview is truncated", async () => {
    const response = {
      success: false,
      asOfDate: "2026-10-11",
      error: "Preflight freshness checks failed",
      preflight: {
        status: "FAIL",
        asOfDate: "2026-10-11",
        gates: [
          { gate_key: "core_roster_schedule", status: "PASS", detail: "ready" },
          { gate_key: "projection_derived_v2", status: "FAIL", detail: "player_latest=none, team_latest=none, goalie_latest=none" },
          { gate_key: "stale_goalie_game_rows", status: "FAIL", detail: "teams_missing_recent_goalie_rows=5" },
        ],
      },
      termination: { state: "blocked", resumeRequired: true, nextStartDate: "2026-10-11" },
      pipeline: { description: "x".repeat(5000), arbitrary: "not a receipt field" },
    };
    const wrapped = withCronJobAudit(async (_req, res) => res.status(422).json(response));
    const res = createMockRes();

    await wrapped(createMockReq(), res);

    const row = insertMock.mock.calls[0][0];
    expect(row.status).toBe("failure");
    expect(row.details.response).toHaveLength(4000);
    expect(() => JSON.parse(row.details.response)).toThrow();
    expect(row.details.responseTruncated).toBe(true);
    expect(row.details.responseOutcome).toEqual({
      success: false,
      error: "Preflight freshness checks failed",
      asOfDate: "2026-10-11",
      termination: response.termination,
      preflight: {
        status: "FAIL", asOfDate: "2026-10-11", gateCount: 3, failedGateCount: 2,
        failedGates: response.preflight.gates.slice(1),
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual(response);
  });

  it("bounds game failure witnesses and failed gates without losing their total counts", async () => {
    const errors = Array.from({ length: 5 }, (_, index) => ({
      gameId: 2026010056 + index, date: "2026-09-26", stage: "capture_raw_sources",
      message: "INVALID_PROJECTION_RAW_SHIFT_ROWS " + "x".repeat(3000), arbitrary: "excluded",
    }));
    const gates = Array.from({ length: 12 }, (_, index) => ({
      gate_key: `gate_${index}`, status: "FAIL", detail: "x".repeat(1000), arbitrary: "excluded",
    }));
    const wrapped = withCronJobAudit(async (_req, res) => res.json({
      success: false, nextGameId: 2026010056, rowsUpserted: null, errors,
      preflight: { status: "FAIL", gates }, arbitrary: "excluded",
    }));

    await wrapped(createMockReq(), createMockRes());

    const outcome = insertMock.mock.calls[0][0].details.responseOutcome;
    expect(outcome).toMatchObject({ success: false, nextGameId: 2026010056, rowsUpserted: null });
    expect(outcome.errors).toMatchObject({ count: 5 });
    expect(outcome.errors.sample).toHaveLength(3);
    expect(outcome.errors.sample[0]).toMatchObject({ gameId: 2026010056, date: "2026-09-26", stage: "capture_raw_sources" });
    expect(outcome.errors.sample[0].message).toHaveLength(2000);
    expect(outcome.preflight).toMatchObject({ gateCount: 12, failedGateCount: 12 });
    expect(outcome.preflight.failedGates).toHaveLength(10);
    expect(outcome.preflight.failedGates[0].detail).toHaveLength(300);
    expect(JSON.stringify(outcome)).not.toContain("arbitrary");
  });

  it("reports a failed final-audit receipt when persistence returns an error", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    insertMock.mockResolvedValueOnce({
      error: { message: "audit insert unavailable" },
    });
    const wrapped = withCronJobAudit(
      async (_req, res) =>
        res.json({ success: true, termination: { state: "completed" } }),
      { jobName: "long-running-audit-failure", includeFinalAuditReceipt: true }
    );
    const res = createMockRes();

    await wrapped(createMockReq(), res);

    expect(res.body).toMatchObject({
      success: true,
      finalAudit: {
        owner: "withCronJobAudit",
        status: "failed",
      },
    });
    expect(insertMock.mock.calls[0][0].details.finalAudit).toEqual({
      owner: "withCronJobAudit",
      status: "persisted",
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "cron_job_audit insert failed",
      "audit insert unavailable"
    );
  });
});

describe("withCronJobAudit seasonal game-data classification", () => {
  const inSeason: NhlSeasonWindow = {
    state: "in_season",
    today: "2026-10-20",
    seasonId: 20262027,
    activeFrom: "2026-09-19",
    activeUntil: "2027-06-13",
  };
  const offSeason: NhlSeasonWindow = {
    state: "off_season",
    today: "2026-08-01",
    lastSeasonId: 20252026,
    lastActiveUntil: "2026-06-18",
    nextSeasonId: null,
    resumesOn: null,
  };
  const gate = (handler: (req: any, res: any) => unknown, window: NhlSeasonWindow = inSeason) =>
    withNhlOffSeasonSkip(handler, { loadWindow: async () => window });
  const insertedDetails = () => insertMock.mock.calls.at(-1)?.[0].details;

  it("exports the canonical classification value", () => {
    expect(NHL_SEASONAL_GAME_DATA).toBe("nhl_seasonal_game_data");
  });

  beforeEach(() => {
    insertMock.mockReset();
    insertMock.mockResolvedValue({});
  });

  it("stamps the classification from the actual wrapper chain, whatever the route is called", async () => {
    const wrapped = withCronJobAudit(gate(async (_req, res) => res.status(200).json({ success: true, rowsUpserted: 0 })));

    await wrapped(createMockReq({ url: "/api/v1/db/not-a-listed-route", query: {} }), createMockRes());

    expect(insertedDetails().cronClassification).toBe("nhl_seasonal_game_data");
    expect(cronClassificationFromAuditDetails(insertedDetails())).toBe("nhl_seasonal_game_data");
  });

  it("stamps a gate nested inside the audited handler and a gate outside the audit wrapper", async () => {
    const work = gate(async (_req, res) => res.status(200).json({ success: true }));
    const nested = withCronJobAudit(async (req, res) => work(req, res));
    const outer = gate(withCronJobAudit(async (_req, res) => res.status(200).json({ success: true })));

    await nested(createMockReq({ query: {} }), createMockRes());
    expect(insertedDetails().cronClassification).toBe("nhl_seasonal_game_data");
    await outer(createMockReq({ query: {} }), createMockRes());
    expect(insertedDetails().cronClassification).toBe("nhl_seasonal_game_data");
  });

  it("records null for a non-wrapped control, even on a route the legacy list names", async () => {
    const wrapped = withCronJobAudit(async (_req, res) => res.status(200).json({ success: true, rowsUpserted: 0 }));

    await wrapped(createMockReq({ url: "/api/v1/db/update-PbP" }), createMockRes());

    expect(insertedDetails()).toHaveProperty("cronClassification", null);
    expect(cronClassificationFromAuditDetails(insertedDetails())).toBeNull();
  });

  it("ignores an unused import and a comment or string naming the gate", async () => {
    // withNhlOffSeasonSkip is imported by this file but never wraps this handler.
    const unusedImport = withCronJobAudit(async (_req, res) => {
      // withNhlOffSeasonSkip(handler) — a comment is not a wrapper.
      const note = "withNhlOffSeasonSkip lib/cron/nhlOffSeason nhl_seasonal_game_data";
      return res.status(200).json({ success: true, note, cronClassification: NHL_SEASONAL_GAME_DATA });
    });
    void withNhlOffSeasonSkip;

    await unusedImport(createMockReq({ query: {} }), createMockRes());

    expect(insertedDetails().cronClassification).toBeNull();
  });

  it("stamps success, failure, thrown, off-season skip and ignoreOffSeason runs", async () => {
    const cases: Array<[(req: any, res: any) => unknown, NhlSeasonWindow, Record<string, unknown>, string]> = [
      [async (_req, res) => res.status(200).json({ success: true }), inSeason, {}, "success"],
      [async (_req, res) => res.status(500).json({ success: false, error: "boom" }), inSeason, {}, "failure"],
      [async () => { throw new Error("thrown"); }, inSeason, {}, "failure"],
      [async (_req, res) => res.status(200).json({ success: true }), offSeason, {}, "success"],
      [async (_req, res) => res.status(200).json({ success: true }), offSeason, { ignoreOffSeason: "true" }, "success"],
    ];
    for (const [handler, window, query, status] of cases) {
      await withCronJobAudit(gate(handler, window))(createMockReq({ query }), createMockRes());
      expect(insertMock.mock.calls.at(-1)?.[0].status).toBe(status);
      expect(insertedDetails().cronClassification).toBe("nhl_seasonal_game_data");
    }
    expect(insertMock.mock.calls[3][0].details.responseOutcome.success).toBe(true);
  });

  it("keeps the classification when the response preview is truncated", async () => {
    const wrapped = withCronJobAudit(gate(async (_req, res) =>
      res.status(200).json({ success: true, payload: "x".repeat(5000) })));

    await wrapped(createMockReq({ query: {} }), createMockRes());

    expect(insertedDetails().responseTruncated).toBe(true);
    expect(insertedDetails().cronClassification).toBe("nhl_seasonal_game_data");
  });

  it("keeps the classification and continued status on a planned 207 continuation", async () => {
    const wrapped = withCronJobAudit(gate(async (_req, res) => res.status(207).json({
      success: false,
      termination: { state: "continuation_required", resumeRequired: true },
      payload: "x".repeat(5000),
    })));

    await wrapped(createMockReq({ query: {} }), createMockRes());

    expect(insertMock.mock.calls[0][0].status).toBe("continued");
    expect(insertedDetails().responseTruncated).toBe(true);
    expect(insertedDetails().cronClassification).toBe("nhl_seasonal_game_data");
  });

  it("reports a historical row without the field as unknown, not as unclassified", () => {
    const historical = { statusCode: 200, rowsUpserted: 0, response: "{}" };

    expect(cronClassificationFromAuditDetails(historical)).toBeUndefined();
    expect(cronClassificationFromAuditDetails(null)).toBeUndefined();
    expect(cronClassificationFromAuditDetails("not-an-object")).toBeUndefined();
    expect(cronClassificationFromAuditDetails({ cronClassification: "something_else" })).toBeUndefined();
    expect(cronClassificationFromAuditDetails({ cronClassification: null })).toBeNull();
  });
});
