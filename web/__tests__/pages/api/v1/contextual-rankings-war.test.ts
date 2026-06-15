import { describe, expect, it } from "vitest";

import handler from "../../../../pages/api/v1/contextual-rankings/war";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as unknown,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
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

describe("/api/v1/contextual-rankings/war", () => {
  it("returns 405 for unsupported methods", () => {
    const req: any = { method: "POST", query: {} };
    const res = createMockRes();

    handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET");
  });

  it("publishes a source-pending WAR contract without fake rows", () => {
    const req: any = {
      method: "GET",
      query: {
        entity: "goalies",
        season: "20252026",
        window: "last10",
        strength: "5v5",
      },
    };
    const res = createMockRes();

    handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      request: {
        entity: "goalies",
        season: 20252026,
        window: "last10",
        strength: "5v5",
      },
      status: "source_pending",
      methodology: {
        key: "wins_above_replacement",
        sourceStatus: "source_pending",
        formula: null,
        replacementBaseline: null,
      },
      rows: [],
      meta: {
        sourceStatus: "source_pending",
        rowCount: 0,
      },
    });
    expect(res.body.prerequisites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "replacement_baseline", status: "missing" }),
        expect.objectContaining({ key: "win_value_conversion", status: "needs_validation" }),
      ]),
    );
    expect(res.body.caveats).toContain("No WAR values are exposed in API or UI.");
  });
});
