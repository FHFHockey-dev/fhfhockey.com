import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchCurrentSeasonMock } = vi.hoisted(() => ({
  fetchCurrentSeasonMock: vi.fn(),
}));

vi.mock("../../../../../utils/fetchCurrentSeason", () => ({
  fetchCurrentSeason: fetchCurrentSeasonMock,
}));

vi.mock("../../../../../lib/supabase/server", () => ({
  default: {
    from() {
      const query = {
        select() {
          return this;
        },
        gte() {
          return this;
        },
        eq() {
          return this;
        },
        in() {
          return this;
        },
        order() {
          return this;
        },
        range() {
          return this;
        },
        returns() {
          return Promise.resolve({ data: [], error: null });
        },
        then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
          return Promise.resolve(resolve({ data: [], error: null }));
        },
      };
      return query;
    },
  },
}));

import handler, {
  parsePlayerIds,
} from "../../../../../pages/api/v1/trends/player-trends";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string | string[]>,
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
    },
  } as any;
}

describe("player trend rebuild batching", () => {
  it("normalizes an explicit player-id chunk without invalid or duplicate ids", () => {
    expect(parsePlayerIds("12, 16,12,bad,-1,0")).toEqual([12, 16]);
  });

  it("leaves an empty chunk unspecified so the route retains full-scope semantics", () => {
    expect(parsePlayerIds([])).toBeUndefined();
  });
});

describe("/api/v1/trends/player-trends rebuild authorization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));
    process.env.CRON_SECRET = "current-secret";
    fetchCurrentSeasonMock.mockResolvedValue({
      id: 20252026,
      startDate: "2025-10-07T00:00:00.000Z",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  it("fails closed when rebuild authorization is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = createMockRes();

    await handler({ method: "POST", headers: {}, body: {} } as any, res);

    expect(res.statusCode).toBe(503);
    expect(fetchCurrentSeasonMock).not.toHaveBeenCalled();
  });

  it("rejects a missing or retired bearer value before reading season state", async () => {
    const res = createMockRes();

    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer retired-secret" },
        body: {},
      } as any,
      res,
    );

    expect(res.statusCode).toBe(401);
    expect(fetchCurrentSeasonMock).not.toHaveBeenCalled();
  });

  it.each([
    [{ seasonId: 20242025 }, "current season"],
    [{ startDate: "2023-01-01" }, "current season start"],
    [{ writeFromDate: "2026-03-07" }, "current repair window"],
    [{ playerIds: [] }, "1-250 valid IDs"],
  ])("rejects out-of-scope rebuild input %#", async (body, message) => {
    const res = createMockRes();

    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer current-secret" },
        body,
      } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain(message);
  });

  it("accepts a bounded current-season server-to-server repair", async () => {
    const res = createMockRes();

    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer current-secret" },
        body: { playerIds: [8478402] },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      seasonId: 20252026,
      startDate: "2025-10-07",
      writeFromDate: "2026-03-08",
      playersProcessed: 0,
      gamesProcessed: 0,
      metricsUpserted: 0,
    });
  });
});
