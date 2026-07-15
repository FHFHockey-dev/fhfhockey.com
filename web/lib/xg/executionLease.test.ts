import { describe, expect, it, vi } from "vitest";
import { XgExecutionLeaseConflictError, runWithXgExecutionLease } from "./executionLease";

describe("xG execution leases", () => {
  it("acquires and owner-safely finishes a successful run", async () => {
    const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => ({ data: name === "acquire_xg_execution_lease" ? [{ acquired: true, lease_expires_at: "2026-07-12T22:00:00Z" }] : true, error: null }));
    await expect(runWithXgExecutionLease({ client: { rpc } as any, leaseKey: "xg:test", run: async () => 42 })).resolves.toBe(42);
    expect(rpc.mock.calls.map((call) => call[0])).toEqual(["acquire_xg_execution_lease", "finish_xg_execution_lease"]);
    expect(rpc.mock.calls[1]?.[1]).toMatchObject({ p_succeeded: true });
  });

  it("rejects overlap without running work", async () => {
    const run = vi.fn();
    const rpc = vi.fn().mockResolvedValue({ data: [{ acquired: false, lease_expires_at: "2026-07-12T22:00:00Z" }], error: null });
    await expect(runWithXgExecutionLease({ client: { rpc } as any, leaseKey: "xg:test", run })).rejects.toBeInstanceOf(XgExecutionLeaseConflictError);
    expect(run).not.toHaveBeenCalled();
  });

  it("records failure and preserves the original error", async () => {
    const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => ({ data: name === "acquire_xg_execution_lease" ? [{ acquired: true, lease_expires_at: null }] : true, error: null }));
    await expect(runWithXgExecutionLease({ client: { rpc } as any, leaseKey: "xg:test", run: async () => { throw new Error("boom"); } })).rejects.toThrow("boom");
    expect(rpc.mock.calls[1]?.[1]).toMatchObject({ p_succeeded: false, p_error: "boom" });
  });
});
