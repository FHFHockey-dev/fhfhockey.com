import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn()
}));

vi.mock("../../../../../lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler
}));

vi.mock("../../../../../lib/supabase", () => ({
  default: {
    from: fromMock
  }
}));

import handler from "../../../../../pages/api/v1/db/update-wgo-averages";

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
