import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, getCurrentSeasonMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getCurrentSeasonMock: vi.fn()
}));

vi.mock("../../../../../lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock
}));

vi.mock("../../../../../lib/NHL/server", () => ({
  getCurrentSeason: getCurrentSeasonMock
}));

import handler from "../../../../../pages/api/v1/db/update-season-stats";

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

describe("/api/v1/db/update-season-stats route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentSeasonMock.mockResolvedValue({ seasonId: 20252026 });
    const builder = {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      lte() {
        return this;
      },
      order() {
        return this;
      },
      limit() {
        return Promise.resolve({
          data: null,
          error: {
            message:
              "<!DOCTYPE html><html><body>Error code 522 from supabase.co</body></html>"
          }
        });
      }
    };
    createClientMock.mockReturnValue({
      from: vi.fn(() => builder)
    });
  });

  it("returns a structured dependency error instead of leaking html", async () => {
    const req: any = { method: "GET", query: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain(
      "Upstream dependency returned an HTML error page"
    );
    expect(res.body.dependencyError).toMatchObject({
      kind: "dependency_error",
      classification: "html_upstream_response",
      source: "supabase_or_proxy",
      htmlLike: true
    });
  });
});
