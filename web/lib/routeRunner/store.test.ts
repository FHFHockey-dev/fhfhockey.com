import { describe, expect, it } from "vitest";

import { makeJob } from "./memoryStore.testHelper";
import { createSupabaseRouteRunnerStore } from "./store";

/** Records a supabase-js query chain and resolves it to `result`. */
function recordingClient(result: { data: unknown; error: unknown }) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "then") {
          return (resolve: (value: unknown) => void) => resolve(result);
        }
        return (...args: unknown[]) => {
          calls.push([prop, ...args]);
          return builder;
        };
      }
    }
  );
  return { client: { from: (table: string) => (calls.push(["from", table]), builder) } as any, calls };
}

const NOW = "2026-10-22T10:00:00.000Z";
const LEASE = "2026-10-22T10:04:20.000Z";

describe("createSupabaseRouteRunnerStore", () => {
  it("claims with one conditional update on id, unchanged status, expiry and a lapsed lease", async () => {
    const job = makeJob({ status: "running", lease_until: "2026-10-22T09:59:00.000Z" });
    const { client, calls } = recordingClient({ data: [{ ...job, lease_until: LEASE }], error: null });
    const claimed = await createSupabaseRouteRunnerStore(client).claimJob(job, LEASE, NOW);
    expect(claimed?.lease_until).toBe(LEASE);
    expect(calls).toEqual([
      ["from", "route_runner_jobs"],
      ["update", { status: "running", lease_until: LEASE }],
      ["eq", "id", job.id],
      ["eq", "status", "running"],
      ["gt", "expires_at", NOW],
      ["or", `lease_until.is.null,lease_until.lt.${NOW}`],
      ["select", "*"]
    ]);
  });

  it("returns null when another tick won the claim", async () => {
    const { client } = recordingClient({ data: [], error: null });
    await expect(createSupabaseRouteRunnerStore(client).claimJob(makeJob(), LEASE, NOW)).resolves.toBeNull();
  });

  it("lists runnable jobs oldest first", async () => {
    const { client, calls } = recordingClient({ data: [], error: null });
    await createSupabaseRouteRunnerStore(client).listRunnable(NOW, 1);
    expect(calls).toEqual([
      ["from", "route_runner_jobs"],
      ["select", "*"],
      ["in", "status", ["queued", "running", "waiting"]],
      ["gt", "expires_at", NOW],
      ["or", `not_before.is.null,not_before.lte.${NOW}`],
      ["or", `lease_until.is.null,lease_until.lt.${NOW}`],
      ["order", "created_at", { ascending: true }],
      ["limit", 1]
    ]);
  });

  it("guards step writes by this tick's lease and, when asked, by not-cancelled", async () => {
    const { client, calls } = recordingClient({ data: [], error: null });
    const updated = await createSupabaseRouteRunnerStore(client).updateLeasedJob("job-1", LEASE, { steps: 1 }, { unlessCancelled: true });
    expect(updated).toBe(false);
    expect(calls).toEqual([
      ["from", "route_runner_jobs"],
      ["update", { steps: 1 }],
      ["eq", "id", "job-1"],
      ["eq", "lease_until", LEASE],
      ["neq", "status", "cancelled"],
      ["select", "id"]
    ]);
  });

  it("throws on a database error", async () => {
    const { client } = recordingClient({ data: null, error: { message: "permission denied" } });
    await expect(createSupabaseRouteRunnerStore(client).findLeaseHolder(NOW)).rejects.toThrow(
      "route runner lease check failed: permission denied"
    );
  });
});
