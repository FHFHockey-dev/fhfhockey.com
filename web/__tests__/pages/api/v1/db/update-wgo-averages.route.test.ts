import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn()
}));

vi.mock("../../../../../lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler
}));

vi.mock("../../../../../lib/supabase/server", () => ({
  default: {
    from: fromMock
  }
}));

import handler, {
  selectCompletedWgoAverageSeasons,
} from "../../../../../pages/api/v1/db/update-wgo-averages";

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

describe("/api/v1/db/update-wgo-averages route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const error = new Error(
      "<!DOCTYPE html><html><body>Error code 522 from supabase.co</body></html>"
    );
    const builder = {
      select() {
        return this;
      },
      order() {
        return this;
      },
      limit() {
        return this;
      },
      maybeSingle() {
        return Promise.reject(error);
      },
      range() {
        return Promise.reject(error);
      },
      then(resolve: (value: any) => any, reject?: (reason: any) => any) {
        return Promise.reject(error).then(resolve, reject);
      }
    };
    fromMock.mockReturnValue(builder);
  });

  it("returns a structured dependency error instead of leaking html", async () => {
    const req: any = {
      method: "GET",
      query: {},
      headers: { host: "localhost" }
    };
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

  it("includes the latest completed season and excludes an active season", () => {
    expect(
      selectCompletedWgoAverageSeasons(
        [20232024, 20242025, 20252026, 20262027],
        [
          { id: 20232024, regularSeasonEndDate: "2024-04-18" },
          { id: 20242025, regularSeasonEndDate: "2025-04-17" },
          { id: 20252026, regularSeasonEndDate: "2026-04-16" },
          { id: 20262027, regularSeasonEndDate: "2027-04-18" },
        ],
        "2026-08-13",
      ),
    ).toEqual([20252026, 20242025, 20232024]);
  });
});
