import { describe, it, expect } from "vitest";
import handler from "pages/api/v1/db/sustainability/rebuild-baselines";

// Integration test: only run when SUPABASE_SERVICE_ROLE_KEY is set in env
const RUN_INTEGRATION = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

describe("rebuild-baselines integration", () => {
  it("queries real views and returns sample records in dry-run", async () => {
    if (!RUN_INTEGRATION) {
      console.log(
        "Skipping integration test: SUPABASE_SERVICE_ROLE_KEY not set"
      );
      return;
    }

    const req: any = { method: "POST", query: { dry: "1" } };
    const res: any = {
      status: (code: number) => {
        res._status = code;
        return res;
      },
      json: (body: any) => {
        res._body = body;
        return res;
      },
      setHeader: () => {}
    };

    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._body).toBeTruthy();
    expect(res._body.dry_run).toBe(true);
    // sample_records may be empty if no players in the last year; that's acceptable
    expect(Array.isArray(res._body.sample_records)).toBe(true);
  });
});
