import { describe, expect, it } from "vitest";

import { makeJob } from "./memoryStore.testHelper";
import { createSupabaseRouteRunnerStore } from "./store";

/** Records a supabase-js query chain and resolves it to `result`. */
function recordingClient(result: { data: unknown; error: unknown; count?: number | null }) {
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
  it("claims a lapsed job with one conditional update, then confirms its lease by reading it back", async () => {
    const job = makeJob({ status: "running", lease_until: "2026-10-22T09:59:00.000Z" });
    // PostgREST returns no rows from a write that changes a filtered column,
    // so the store relies on the count and the read-back.
    const { client, calls } = recordingClient({ data: { ...job, status: "running", lease_until: LEASE }, count: 1, error: null });
    const claimed = await createSupabaseRouteRunnerStore(client).claimJob(job, LEASE, NOW);
    expect(claimed?.lease_until).toBe(LEASE);
    expect(calls).toEqual([
      ["from", "route_runner_jobs"],
      ["update", { status: "running", lease_until: LEASE }, { count: "exact" }],
      ["eq", "id", job.id],
      ["eq", "status", "running"],
      ["gt", "expires_at", NOW],
      ["eq", "lease_until", "2026-10-22T09:59:00.000Z"],
      ["from", "route_runner_jobs"],
      ["select", "*"],
      ["eq", "id", job.id],
      ["maybeSingle"]
    ]);
  });

  it("returns null when another tick won the claim", async () => {
    const { client } = recordingClient({ data: [], count: 0, error: null });
    await expect(createSupabaseRouteRunnerStore(client).claimJob(makeJob(), LEASE, NOW)).resolves.toBeNull();
    const job = makeJob();
    const raced = recordingClient({ data: { ...job, lease_until: "2026-10-22T10:04:21.000Z" }, count: 1, error: null });
    await expect(createSupabaseRouteRunnerStore(raced.client).claimJob(job, LEASE, NOW)).resolves.toBeNull();
  });

  it("never claims a job whose lease is still live", async () => {
    const { client, calls } = recordingClient({ data: null, count: 1, error: null });
    const job = makeJob({ status: "running", lease_until: "2026-10-22T10:01:00.000Z" });
    await expect(createSupabaseRouteRunnerStore(client).claimJob(job, LEASE, NOW)).resolves.toBeNull();
    expect(calls).toEqual([]);
  });

  it("expires only jobs still unchanged since they were listed", async () => {
    const job = makeJob({ status: "waiting" });
    const { client, calls } = recordingClient({ data: [job], count: 1, error: null });
    const expired = await createSupabaseRouteRunnerStore(client).expireJobs(NOW);
    expect(expired).toMatchObject([{ id: job.id, status: "failed", lease_until: null, finished_at: NOW }]);
    expect(calls.slice(0, 5)).toEqual([
      ["from", "route_runner_jobs"],
      ["select", "*"],
      ["in", "status", ["queued", "running", "waiting"]],
      ["lte", "expires_at", NOW],
      ["or", `lease_until.is.null,lease_until.lt.${NOW}`]
    ]);
    expect(calls.slice(6)).toEqual([
      ["update", expect.objectContaining({ status: "failed", lease_until: null }), { count: "exact" }],
      ["eq", "id", job.id],
      ["eq", "status", "waiting"],
      ["lte", "expires_at", NOW],
      ["is", "lease_until", null]
    ]);
  });

  it("reads a cancel or run-now back after a counted status update", async () => {
    const job = makeJob({ status: "cancelled" });
    const { client, calls } = recordingClient({ data: job, count: 1, error: null });
    await expect(
      createSupabaseRouteRunnerStore(client).updateJobIfStatus(job.id, ["queued", "running", "waiting"], { status: "cancelled" })
    ).resolves.toMatchObject({ id: job.id, status: "cancelled" });
    expect(calls.slice(0, 4)).toEqual([
      ["from", "route_runner_jobs"],
      ["update", { status: "cancelled" }, { count: "exact" }],
      ["eq", "id", job.id],
      ["in", "status", ["queued", "running", "waiting"]]
    ]);
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

  it("guards step writes by this tick's lease and, when asked, by not-cancelled, using the affected count", async () => {
    const { client, calls } = recordingClient({ data: null, count: 1, error: null });
    const store = createSupabaseRouteRunnerStore(client);
    await expect(store.updateLeasedJob("job-1", LEASE, { lease_until: null }, { unlessCancelled: true })).resolves.toBe(true);
    expect(calls).toEqual([
      ["from", "route_runner_jobs"],
      ["update", { lease_until: null }, { count: "exact" }],
      ["eq", "id", "job-1"],
      ["eq", "lease_until", LEASE],
      ["neq", "status", "cancelled"]
    ]);
    const lost = recordingClient({ data: null, count: 0, error: null });
    await expect(createSupabaseRouteRunnerStore(lost.client).updateLeasedJob("job-1", LEASE, { steps: 1 })).resolves.toBe(false);
  });

  it("throws on a database error", async () => {
    const { client } = recordingClient({ data: null, error: { message: "permission denied" } });
    await expect(createSupabaseRouteRunnerStore(client).findLeaseHolder(NOW)).rejects.toThrow(
      "route runner lease check failed: permission denied"
    );
  });
});
