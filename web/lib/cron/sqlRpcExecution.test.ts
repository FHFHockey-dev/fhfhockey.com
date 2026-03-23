import { describe, expect, it, vi } from "vitest";

import {
  executeSqlRpcWithRetry,
  normalizeSqlRpcFailure
} from "lib/cron/sqlRpcExecution";

describe("sqlRpcExecution", () => {
  it("classifies Cloudflare HTML failures as retryable SQL transport failures", () => {
    const failure = normalizeSqlRpcFailure(
      new Error("<!DOCTYPE html><html><body>Error code 522 from supabase.co</body></html>"),
      2
    );

    expect(failure).toMatchObject({
      kind: "sql_rpc_transport_failure",
      classification: "transport_timeout",
      statusCode: 522,
      retryable: true,
      attempts: 2
    });
  });

  it("retries transient SQL RPC failures and succeeds on a later attempt", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "<!DOCTYPE html><html>Error code 520</html>" }
      })
      .mockResolvedValueOnce({
        data: { ok: true },
        error: null
      });

    const sleep = vi.fn(async () => {});

    const result = await executeSqlRpcWithRetry({
      client: { rpc },
      sqlText: "REFRESH MATERIALIZED VIEW test_view;",
      maxAttempts: 3,
      sleep
    });

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: true,
      attempts: 2,
      data: { ok: true },
      notes: expect.arrayContaining([
        "Executed through Supabase execute_sql RPC after 2 attempts."
      ])
    });
  });

  it("returns structured failure details after exhausting retries", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "<!DOCTYPE html><html>Error code 522</html>" }
    });

    const result = await executeSqlRpcWithRetry({
      client: { rpc },
      sqlText: "REFRESH MATERIALIZED VIEW test_view;",
      maxAttempts: 2,
      sleep: async () => {}
    });

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      ok: false,
      failure: {
        kind: "sql_rpc_transport_failure",
        classification: "transport_timeout",
        statusCode: 522,
        attempts: 2
      },
      notes: expect.arrayContaining([
        "Supabase execute_sql RPC failed.",
        "Classification: transport_timeout.",
        "Status code: 522.",
        "Attempts: 2."
      ])
    });
  });
});
