import { describe, expect, it } from "vitest";

import handler from "../../../../../pages/api/v1/db/update-power-rankings";

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
    }
  };
  return res;
}

describe("/api/v1/db/update-power-rankings", () => {
  it("returns 410 and marks the loader as a quarantined legacy surface", async () => {
    const req: any = {
      method: "GET",
      query: {}
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(410);
    expect(res.body).toMatchObject({
      success: false,
      route: "/api/v1/db/update-power-rankings",
      disposition: "DO NOT RUN",
      retentionReason:
        "Retained as a 410 quarantine stub until cron-source, failed-job inventories, and benchmark artifacts stop referencing this legacy route.",
      canonicalStatus: "no supported operator route",
      canonicalDataset: "power_rankings"
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
