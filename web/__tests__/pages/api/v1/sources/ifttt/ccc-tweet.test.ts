import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, insertMock, upsertMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  insertMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: fromMock,
  },
}));

import handler from "pages/api/v1/sources/ifttt/ccc-tweet";

function createMockReq() {
  return {
    method: "POST",
    headers: {
      "x-fhfh-ifttt-secret": "test-secret",
      host: "example.test",
      "x-forwarded-proto": "https",
    },
    query: { process: "true" },
    body: {
      source: "ifttt",
      source_account: "CcCMiddleton",
      text: "Lines update",
      username: "CcCMiddleton",
      link_to_tweet:
        "https://twitter.com/CcCMiddleton/status/2049999999999999999",
      created_at: "April 30, 2026 at 06:05PM",
    },
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

describe("CCC IFTTT receiver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.IFTTT_CCC_WEBHOOK_SECRET = "test-secret";
    insertMock.mockResolvedValue({ error: null });
    upsertMock.mockResolvedValue({ error: null });
    fromMock.mockReturnValue({
      insert: insertMock,
      upsert: upsertMock,
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("keeps the raw event retryable without returning a downstream response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("sensitive downstream response", {
          status: 503,
        }),
      ),
    );
    const res = createMockRes();

    await handler(createMockReq(), res);

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
    expect(JSON.stringify(res.body)).not.toContain(
      "sensitive downstream response",
    );
  });

  it("does not return a caught processor exception message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("sensitive transport detail")),
    );
    const res = createMockRes();

    await handler(createMockReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      processingStatus: "processed_attempted",
      processor: {
        success: false,
        status: null,
        error: "Processor request failed",
      },
    });
    expect(JSON.stringify(res.body)).not.toContain(
      "sensitive transport detail",
    );
  });
});
