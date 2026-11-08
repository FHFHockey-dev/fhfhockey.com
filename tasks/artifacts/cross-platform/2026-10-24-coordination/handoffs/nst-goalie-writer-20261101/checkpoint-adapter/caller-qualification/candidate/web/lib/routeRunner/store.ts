/**
 * Route runner persistence (public.route_runner_jobs / route_runner_events,
 * draft SQL in tasks/artifacts/route-runner/route_runner_tables.sql).
 * Service-role client only; every lease-sensitive write is a single
 * conditional UPDATE, so two ticks cannot both own a job.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ROUTE_RUNNER_ACTIVE_STATUSES,
  type RouteQuery,
  type RouteRunnerStatus
} from "./core";
import { storedContract, type RouteRunnerContract } from "./registry";

export type RouteRunnerJobRow = {
  id: string;
  route_path: string;
  initial_query: RouteQuery;
  next_query: RouteQuery;
  contract: RouteRunnerContract | null;
  status: RouteRunnerStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  not_before: string | null;
  lease_until: string | null;
  expires_at: string;
  steps: number;
  kills: number;
  rows_total: number;
  progress: unknown;
  last_status_code: number | null;
  last_operation_status: string | null;
  last_error: string | null;
  finished_at: string | null;
};

export type RouteRunnerEventLevel = "info" | "success" | "warn" | "error";

export type RouteRunnerEventInsert = {
  job_id: string;
  level: RouteRunnerEventLevel;
  message: string;
  step?: number | null;
  status_code?: number | null;
  rows?: number | null;
  progress?: unknown;
  duration_ms?: number | null;
};

export type RouteRunnerEventRow = Required<RouteRunnerEventInsert> & {
  id: number;
  at: string;
};

export type RouteRunnerJobPatch = Partial<
  Pick<
    RouteRunnerJobRow,
    | "status"
    | "next_query"
    | "not_before"
    | "lease_until"
    | "steps"
    | "kills"
    | "rows_total"
    | "progress"
    | "last_status_code"
    | "last_operation_status"
    | "last_error"
    | "finished_at"
  >
>;

export type NewRouteRunnerJob = {
  route_path: string;
  initial_query: RouteQuery;
  next_query: RouteQuery;
  contract: RouteRunnerContract;
  created_by: string | null;
  /** Initial progress, e.g. an approved freshness bypass carried for the job's life. */
  progress?: unknown;
};

export interface RouteRunnerStore {
  /** Fails active jobs past expires_at that no live step holds. */
  expireJobs(nowIso: string): Promise<RouteRunnerJobRow[]>;
  /** Id of a job holding an unexpired lease (other than `excludeId`). */
  findLeaseHolder(nowIso: string, excludeId?: string): Promise<string | null>;
  /** Runnable jobs, oldest first. */
  listRunnable(nowIso: string, limit: number): Promise<RouteRunnerJobRow[]>;
  /** Leases `job` if it is unchanged and unleased; null when another tick won. */
  claimJob(
    job: RouteRunnerJobRow,
    leaseUntilIso: string,
    nowIso: string
  ): Promise<RouteRunnerJobRow | null>;
  /** Patches a job only while this tick's lease is on it. */
  updateLeasedJob(
    id: string,
    leaseUntilIso: string,
    patch: RouteRunnerJobPatch,
    options?: { unlessCancelled?: boolean }
  ): Promise<boolean>;
  insertEvents(events: RouteRunnerEventInsert[]): Promise<void>;
  listJobs(limit: number): Promise<RouteRunnerJobRow[]>;
  createJob(job: NewRouteRunnerJob): Promise<RouteRunnerJobRow>;
  getJob(id: string): Promise<RouteRunnerJobRow | null>;
  listEvents(jobId: string, afterId: number, limit: number): Promise<RouteRunnerEventRow[]>;
  /** Patches a job only while its status is one of `statuses`. */
  updateJobIfStatus(
    id: string,
    statuses: readonly RouteRunnerStatus[],
    patch: RouteRunnerJobPatch
  ): Promise<RouteRunnerJobRow | null>;
}

const JOBS = "route_runner_jobs";
const EVENTS = "route_runner_events";

function fail(action: string, error: { message?: string } | null): never {
  throw new Error(`route runner ${action} failed: ${error?.message ?? "unknown error"}`);
}

function unleasedFilter(nowIso: string) {
  return `lease_until.is.null,lease_until.lt.${nowIso}`;
}

function sameInstant(left: string | null, right: string | null) {
  if (left == null || right == null) return left === right;
  return Date.parse(left) === Date.parse(right);
}

/*
 * PostgREST filters the rows a write returns by the request's own filters,
 * so a write that changes a filtered column (status, lease_until) returns no
 * rows even when it applied (production, 2026-10-22: every claim read back
 * empty). Writes here check the affected-row count instead, and a claim is
 * confirmed by reading the job back.
 */
export function createSupabaseRouteRunnerStore(
  client: SupabaseClient<any>
): RouteRunnerStore {
  async function readJob(id: string) {
    const { data, error } = await client
      .from(JOBS)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) fail("job read", error);
    return (data as RouteRunnerJobRow | null) ?? null;
  }

  /** Applies `patch` only while the job keeps the status and lease it was read with. */
  async function updateIfUnchanged(
    action: string,
    job: RouteRunnerJobRow,
    patch: RouteRunnerJobPatch,
    expiry: { op: "gt" | "lte"; at: string }
  ) {
    let query = client
      .from(JOBS)
      .update(patch, { count: "exact" })
      .eq("id", job.id)
      .eq("status", job.status);
    query = expiry.op === "gt" ? query.gt("expires_at", expiry.at) : query.lte("expires_at", expiry.at);
    query = job.lease_until == null ? query.is("lease_until", null) : query.eq("lease_until", job.lease_until);
    const { count, error } = await query;
    if (error) fail(action, error);
    return (count ?? 0) > 0;
  }

  return {
    async expireJobs(nowIso) {
      const { data, error } = await client
        .from(JOBS)
        .select("*")
        .in("status", [...ROUTE_RUNNER_ACTIVE_STATUSES])
        .lte("expires_at", nowIso)
        .or(unleasedFilter(nowIso));
      if (error) fail("expire list", error);
      const patch = {
        status: "failed",
        finished_at: nowIso,
        lease_until: null,
        last_error: "Expired: the job passed its expires_at before finishing."
      } satisfies RouteRunnerJobPatch;
      const expired: RouteRunnerJobRow[] = [];
      for (const job of (data ?? []) as RouteRunnerJobRow[]) {
        if (await updateIfUnchanged("expire", job, patch, { op: "lte", at: nowIso })) {
          expired.push({ ...job, ...patch });
        }
      }
      return expired;
    },

    async findLeaseHolder(nowIso, excludeId) {
      let query = client.from(JOBS).select("id").gt("lease_until", nowIso);
      if (excludeId) query = query.neq("id", excludeId);
      const { data, error } = await query.limit(1);
      if (error) fail("lease check", error);
      return (data?.[0] as { id?: string } | undefined)?.id ?? null;
    },

    async listRunnable(nowIso, limit) {
      const { data, error } = await client
        .from(JOBS)
        .select("*")
        .in("status", [...ROUTE_RUNNER_ACTIVE_STATUSES])
        .gt("expires_at", nowIso)
        .or(`not_before.is.null,not_before.lte.${nowIso}`)
        .or(unleasedFilter(nowIso))
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) fail("runnable list", error);
      return (data ?? []) as RouteRunnerJobRow[];
    },

    async claimJob(job, leaseUntilIso, nowIso) {
      if (job.lease_until != null && Date.parse(job.lease_until) >= Date.parse(nowIso)) return null;
      const applied = await updateIfUnchanged(
        "claim",
        job,
        { status: "running", lease_until: leaseUntilIso },
        { op: "gt", at: nowIso }
      );
      if (!applied) return null;
      const claimed = await readJob(job.id);
      return claimed && sameInstant(claimed.lease_until, leaseUntilIso) ? claimed : null;
    },

    async updateLeasedJob(id, leaseUntilIso, patch, options) {
      let query = client
        .from(JOBS)
        .update(patch, { count: "exact" })
        .eq("id", id)
        .eq("lease_until", leaseUntilIso);
      if (options?.unlessCancelled) query = query.neq("status", "cancelled");
      const { count, error } = await query;
      if (error) fail("leased update", error);
      return (count ?? 0) > 0;
    },

    async insertEvents(events) {
      if (events.length === 0) return;
      const { error } = await client.from(EVENTS).insert(events);
      if (error) fail("event insert", error);
    },

    async listJobs(limit) {
      const { data, error } = await client
        .from(JOBS)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) fail("job list", error);
      return (data ?? []) as RouteRunnerJobRow[];
    },

    async createJob(job) {
      const { data, error } = await client
        .from(JOBS)
        .insert({ ...job, contract: storedContract(job.contract), status: "queued" })
        .select("*")
        .single();
      if (error || !data) fail("job insert", error);
      return data as RouteRunnerJobRow;
    },

    getJob: readJob,

    async listEvents(jobId, afterId, limit) {
      const { data, error } = await client
        .from(EVENTS)
        .select("*")
        .eq("job_id", jobId)
        .gt("id", afterId)
        .order("id", { ascending: true })
        .limit(limit);
      if (error) fail("event list", error);
      return (data ?? []) as RouteRunnerEventRow[];
    },

    async updateJobIfStatus(id, statuses, patch) {
      const { count, error } = await client
        .from(JOBS)
        .update(patch, { count: "exact" })
        .eq("id", id)
        .in("status", [...statuses]);
      if (error) fail("job update", error);
      return (count ?? 0) > 0 ? readJob(id) : null;
    }
  };
}
