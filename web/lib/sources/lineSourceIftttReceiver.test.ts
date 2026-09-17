import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, insertMock, upsertMock, rpcMock, dispatchMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  insertMock: vi.fn(),
  upsertMock: vi.fn(),
  rpcMock: vi.fn(),
  dispatchMock: vi.fn(),
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: fromMock,
    rpc: rpcMock,
  },
}));
vi.mock("lib/projections/starterBoardQueue", () => ({ dispatchStarterBoardJobs: dispatchMock }));

import { createLineSourceIftttReceiver } from "lib/sources/lineSourceIftttReceiver";
import scheduler from "../../pages/api/internal/starter-board";

function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    method: "POST",
    headers: {
      "x-fhfh-ifttt-secret": "test-secret",
    },
    query: {},
    body: {
      source: "ifttt",
      source_account: "GameDayGoalies",
      text: "Confirmed Wild Starting Goalie: Filip Gustavsson",
      username: "GameDayGoalies",
      link_to_tweet:
        "https://twitter.com/GameDayGoalies/status/2049999999999999999",
      created_at: "April 30, 2026 at 06:05PM",
    },
    ...overrides,
  } as any;
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as unknown,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("createLineSourceIftttReceiver", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("processes automatically with capture enabled, respects explicit deferral, and never trusts Host", async () => {
    vi.stubEnv("STARTER_BOARD_CAPTURE_ENABLED", "true");
    vi.stubEnv("STARTER_BOARD_WORKER_ORIGIN", "https://trusted.example");
    const request = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", request);
    const handler = createLineSourceIftttReceiver({ sourceGroup: "gdl_suite", sourceKey: "gamedaygoalies",
      sourceAccount: "GameDayGoalies", secretEnvVar: "IFTTT_GAMEDAYGOALIES_WEBHOOK_SECRET",
      processorPath: "/api/v1/db/update-line-sources" });
    await handler(createMockReq({ headers: { "x-fhfh-ifttt-secret": "test-secret", host: "untrusted.example" } }), createMockRes());
    expect(new URL(request.mock.calls[0][0]).origin).toBe("https://trusted.example");
    expect(request.mock.calls[0][1]).toMatchObject({ redirect: "error", signal: expect.any(AbortSignal) });
    await handler(createMockReq({ query: { process: "false" } }), createMockRes());
    expect(request).toHaveBeenCalledOnce();
  });
  it("preserves pending work when production has no trusted processor origin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STARTER_BOARD_CAPTURE_ENABLED", "true");
    vi.stubEnv("STARTER_BOARD_WORKER_ORIGIN", "");
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const handler = createLineSourceIftttReceiver({ sourceGroup: "gdl_suite", sourceKey: "gamedaygoalies",
      sourceAccount: "GameDayGoalies", secretEnvVar: "IFTTT_GAMEDAYGOALIES_WEBHOOK_SECRET",
      processorPath: "/api/v1/db/update-line-sources" });
    const res = createMockRes();
    await handler(createMockReq(), res);
    expect(upsertMock).toHaveBeenCalledOnce();
    expect(request).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ success: true, processor: { success: false } });
  });
  it.each(["2026-01-01T02:00:00Z", "2026-07-01T02:00:00Z"])("keeps evening news on the Eastern slate at %s", async (now) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    const request = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", request);
    try {
      const handler = createLineSourceIftttReceiver({ sourceGroup: "gdl_suite", sourceKey: "gamedaygoalies",
        sourceAccount: "GameDayGoalies", secretEnvVar: "IFTTT_GAMEDAYGOALIES_WEBHOOK_SECRET",
        processorPath: "/api/v1/db/update-line-sources" });
      await handler(createMockReq({ query: { process: "true" } }), createMockRes());
      expect(new URL(request.mock.calls[0][0]).searchParams.get("date")).toBe(now.startsWith("2026-01") ? "2025-12-31" : "2026-06-30");
    } finally { vi.useRealTimers(); vi.unstubAllGlobals(); }
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    rpcMock.mockResolvedValue({ data: 0, error: null });
    dispatchMock.mockResolvedValue({ dispatched: 16, failed: 0, results: [] });
    process.env.IFTTT_GAMEDAYGOALIES_WEBHOOK_SECRET = "test-secret";
    process.env.IFTTT_GAMEDAYLINES_WEBHOOK_SECRET = "test-secret";
    upsertMock.mockResolvedValue({ error: null });
    insertMock.mockResolvedValue({ error: null });
    fromMock.mockReturnValue({
      insert: insertMock,
      upsert: upsertMock,
    });
  });

  it.each([false, true])("runs bounded source retries independently of computation enabled=%s", async (compute) => {
    vi.stubEnv("STARTER_BOARD_CAPTURE_ENABLED", "true");
    vi.stubEnv("STARTER_BOARD_COMPUTE_ENABLED", String(compute));
    vi.stubEnv("STARTER_BOARD_SCHEDULER_ENABLED", "true");
    vi.stubEnv("STARTER_BOARD_WORKER_ORIGIN", "https://trusted.example");
    vi.stubEnv("CRON_SECRET", "scheduler-test");
    const releases: Array<() => void> = [];
    const request = vi.fn(() => new Promise<Response>((resolve) => releases.push(() => resolve(new Response("{}", { status: 200 })))));
    vi.stubGlobal("fetch", request);
    const res = createMockRes();
    const pending = scheduler(createMockReq({ method: "GET", headers: { authorization: "Bearer scheduler-test" } }), res);
    await vi.waitFor(() => {
      expect(request).toHaveBeenCalledTimes(3);
      if (compute) expect(dispatchMock).toHaveBeenCalledOnce();
    });
    // Accepted work dispatches while all three source calls are still pending.
    if (!compute) { expect(dispatchMock).not.toHaveBeenCalled(); expect(rpcMock).not.toHaveBeenCalled(); }
    for (const [url] of request.mock.calls as unknown as Array<[URL]>) {
      expect(url.searchParams.get("currentDayOnly")).toBe("true");
      expect(url.searchParams.get("limit")).toBe("5");
      expect(url.searchParams.has("reprocess")).toBe(false);
    }
    releases.forEach((release) => release());
    await pending;
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ dispatched: compute ? 16 : 0, capture: { attempted: 3, failed: 0 } });
  });

  it("routes a GameDayGoalies event into the generic queue with source metadata", async () => {
    const handler = createLineSourceIftttReceiver({
      sourceGroup: "gdl_suite",
      sourceKey: "gamedaygoalies",
      sourceAccount: "GameDayGoalies",
      secretEnvVar: "IFTTT_GAMEDAYGOALIES_WEBHOOK_SECRET",
    });

    const res = createMockRes();
    await handler(createMockReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      sourceKey: "gamedaygoalies",
      tweetId: "2049999999999999999",
      processingStatus: "pending",
    });
    expect(fromMock).toHaveBeenCalledWith("line_source_ifttt_events");
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "ifttt",
        source_group: "gdl_suite",
        source_key: "gamedaygoalies",
        source_account: "GameDayGoalies",
        username: "GameDayGoalies",
        text: "Confirmed Wild Starting Goalie: Filip Gustavsson",
        tweet_id: "2049999999999999999",
        tweet_created_at: "2026-04-30T22:05:00.000Z",
        processing_status: "pending",
        raw_payload: expect.objectContaining({
          source_account: "GameDayGoalies",
        }),
      }),
      {
        onConflict: "source_key,tweet_id",
      },
    );
  });

  it("dedupes by source key and tweet id so separate sources can store the same tweet id", async () => {
    const goaliesHandler = createLineSourceIftttReceiver({
      sourceGroup: "gdl_suite",
      sourceKey: "gamedaygoalies",
      sourceAccount: "GameDayGoalies",
      secretEnvVar: "IFTTT_GAMEDAYGOALIES_WEBHOOK_SECRET",
    });
    const linesHandler = createLineSourceIftttReceiver({
      sourceGroup: "gdl_suite",
      sourceKey: "gamedaylines",
      sourceAccount: "GameDayLines",
      secretEnvVar: "IFTTT_GAMEDAYLINES_WEBHOOK_SECRET",
    });

    await goaliesHandler(createMockReq(), createMockRes());
    await linesHandler(
      createMockReq({
        body: {
          source: "ifttt",
          source_account: "GameDayLines",
          text: "Wild lines",
          username: "GameDayLines",
          link_to_tweet:
            "https://twitter.com/GameDayLines/status/2049999999999999999",
          created_at: "April 30, 2026 at 06:05PM",
        },
      }),
      createMockRes(),
    );

    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(upsertMock.mock.calls[0][0]).toMatchObject({
      source_key: "gamedaygoalies",
      tweet_id: "2049999999999999999",
    });
    expect(upsertMock.mock.calls[1][0]).toMatchObject({
      source_key: "gamedaylines",
      tweet_id: "2049999999999999999",
    });
    expect(upsertMock.mock.calls[0][1]).toEqual({
      onConflict: "source_key,tweet_id",
    });
    expect(upsertMock.mock.calls[1][1]).toEqual({
      onConflict: "source_key,tweet_id",
    });
  });

  it("keeps the raw event stored and retryable when process=true follow-up fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("processor unavailable", {
          status: 503,
        }),
      ),
    );
    const handler = createLineSourceIftttReceiver({
      sourceGroup: "gdl_suite",
      sourceKey: "gamedaygoalies",
      sourceAccount: "GameDayGoalies",
      secretEnvVar: "IFTTT_GAMEDAYGOALIES_WEBHOOK_SECRET",
      processorPath: "/api/v1/db/update-line-sources",
    });
    const res = createMockRes();

    await handler(
      createMockReq({
        query: { process: "true" },
      }),
      res,
    );

    expect(upsertMock).toHaveBeenCalledOnce();
    expect(upsertMock.mock.calls[0]?.[0]).toMatchObject({
      processing_status: "pending",
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      processingStatus: "processed_attempted",
      processor: {
        success: false,
        status: 503,
        error: "Processor request failed",
      },
    });
    expect(JSON.stringify(res.body)).not.toContain("processor unavailable");
  });
});
