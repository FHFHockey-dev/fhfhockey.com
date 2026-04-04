import { describe, expect, it } from "vitest";

import handler from "../../../../../pages/api/v1/db/update-team-power-ratings-new";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as any,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

describe("/api/v1/db/update-team-power-ratings-new", () => {
  it("returns 410 and points callers to the canonical writer", async () => {
    const req: any = {
      method: "GET",
      query: {
        date: "2026-02-07"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(410);
    expect(res.body).toMatchObject({
      success: false,
      route: "/api/v1/db/update-team-power-ratings-new",
      targetTable: "team_power_ratings_daily__new",
      disposition: "DO NOT RUN",
      retentionReason:
        "Retained as a 410 quarantine stub until cron-source, inventory, and operator docs stop referencing this legacy route.",
      replacementRoute: "/api/v1/db/update-team-power-ratings",
      canonicalTable: "team_power_ratings_daily"
    });
  });

  it("still returns 405 for unsupported methods", async () => {
    const req: any = {
      method: "DELETE",
      query: {}
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toEqual(["POST", "GET"]);
  });
});
