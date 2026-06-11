import { describe, expect, it } from "vitest";

import handler from "../../../../pages/api/v1/rankings";

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
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("/api/v1/rankings legacy scaffold", () => {
  it("keeps the Start Chart scaffold contract but marks the route as legacy", async () => {
    const req: any = {
      method: "GET",
      query: {
        date: "2026-03-14",
        mode: "points",
        position: "C",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers.Deprecation).toBe("true");
    expect(res.headers.Link).toContain("/api/v1/contextual-rankings");
    expect(res.headers["X-FHFH-Legacy-Route"]).toContain(
      "Start Chart rankings scaffold",
    );
    expect(res.body).toMatchObject({
      date: "2026-03-14",
      mode: "points",
      position: "C",
      rankings: [],
      meta: {
        modelVersion: "start-chart-internal-dev",
        routeStatus: "legacy_start_chart_scaffold",
        replacementEndpoints: {
          contextualLeaderboard: "/api/v1/contextual-rankings",
          playerMatrix: "/api/v1/contextual-rankings/matrix",
        },
      },
    });
  });

  it("continues to reject requests that do not match the legacy date contract", async () => {
    const req: any = {
      method: "GET",
      query: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.headers.Deprecation).toBe("true");
    expect(res.body.error).toBe("Invalid query parameters");
    expect(res.body.details.date).toEqual(["date is required"]);
  });

  it("returns 405 for unsupported methods", async () => {
    const req: any = {
      method: "POST",
      query: {
        date: "2026-03-14",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET");
    expect(res.headers.Deprecation).toBe("true");
    expect(res.body).toEqual({ error: "Method not allowed" });
  });
});
