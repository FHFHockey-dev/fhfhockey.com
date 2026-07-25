import { beforeEach, describe, expect, it, vi } from "vitest";

const { processQueueMock } = vi.hoisted(() => ({
  processQueueMock: vi.fn(),
}));

vi.mock("../../../../../lib/supabase/server", () => ({ default: {} }));
vi.mock("../../../../../lib/sustainability/recomputeQueue", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../../lib/sustainability/recomputeQueue")
  >("../../../../../lib/sustainability/recomputeQueue");
  return {
    ...actual,
    processSustainabilityRecomputeQueue: processQueueMock,
  };
});

import { processRecomputeQueueHandler } from "../../../../../pages/api/v1/sustainability/process-recompute-queue";

function createMockRes() {
  return {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(value: any) {
      this.body = value;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
  };
}

describe("/api/v1/sustainability/process-recompute-queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processQueueMock.mockResolvedValue({
      claimed: true,
      completed: false,
      status: "queued",
      jobId: 7,
      stage: "window_z",
      processed: 250,
    });
  });

  it("processes exactly one bounded queue stage", async () => {
    const res = createMockRes();
    await processRecomputeQueueHandler({ method: "POST" } as any, res as any);

    expect(processQueueMock).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      claimed: true,
      completed: false,
      status: "queued",
      stage: "window_z",
      processed: 250,
    });
  });

  it("rejects unsupported methods before claiming work", async () => {
    const res = createMockRes();
    await processRecomputeQueueHandler({ method: "GET" } as any, res as any);

    expect(processQueueMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("POST");
  });
});
