import { afterEach, beforeEach, describe, expect, it } from "vitest";

import handler from "../../../../../pages/api/v1/db/update-rolling-games";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("/api/v1/db/update-rolling-games", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("fails closed without admin or cron authorization", async () => {
    const req: any = {
      method: "GET",
      query: { date: "recent" },
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      message: "Unauthorized.",
      success: false,
    });
  });

  it("returns 410 and points callers to the canonical rolling route", async () => {
    const req: any = {
      method: "GET",
      query: { date: "recent" },
      headers: { authorization: "Bearer test-cron-secret" },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(410);
    expect(res.body).toMatchObject({
      success: false,
      route: "/api/v1/db/update-rolling-games",
      requestedMode: "recent",
      disposition: "DO NOT RUN",
      retentionReason:
        "Retained as a 410 quarantine stub until cron-source, failed-job inventories, and benchmark artifacts stop referencing this legacy route.",
      replacementRoute: "/api/v1/db/update-rolling-player-averages",
      canonicalOutput: "rolling_player_game_metrics",
    });
  });

  it("still returns 405 for unsupported methods", async () => {
    const req: any = {
      method: "DELETE",
      query: {},
      headers: { authorization: "Bearer test-cron-secret" },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toEqual(["POST", "GET"]);
  });
});
