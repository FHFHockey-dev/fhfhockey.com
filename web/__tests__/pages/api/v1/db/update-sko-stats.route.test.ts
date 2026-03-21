import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentSeasonMock } = vi.hoisted(() => ({
  getCurrentSeasonMock: vi.fn()
}));

vi.mock("../../../../../lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler
}));

vi.mock("../../../../../lib/NHL/server", () => ({
  getCurrentSeason: getCurrentSeasonMock
}));

import handler from "../../../../../pages/api/v1/db/update-sko-stats";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  } as any;
}

describe("/api/v1/db/update-sko-stats route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a structured dependency error instead of leaking html", async () => {
    getCurrentSeasonMock.mockRejectedValue(
      new Error("<!DOCTYPE html><html><body>Error code 520 from supabase.co</body></html>")
    );

    const req: any = { method: "GET", query: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain(
      "Failed to process request. Reason: Upstream dependency returned an HTML error page"
    );
    expect(res.body.dependencyError).toMatchObject({
      kind: "dependency_error",
      classification: "html_upstream_response",
      source: "supabase_or_proxy",
      htmlLike: true
    });
  });
});
