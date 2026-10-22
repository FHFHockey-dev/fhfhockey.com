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
import type { RouteRunnerContract } from "./registry";

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

export function createSupabaseRouteRunnerStore(
  client: SupabaseClient<any>
): RouteRunnerStore {
  return {
    async expireJobs(nowIso) {
      const { data, error } = await client
        .from(JOBS)
        .update({
          status: "failed",
          finished_at: nowIso,
          lease_until: null,
          last_error: "Expired: the job passed its expires_at before finishing."
        })
        .in("status", [...ROUTE_RUNNER_ACTIVE_STATUSES])
        .lte("expires_at", nowIso)
        .or(unleasedFilter(nowIso))
        .select("*");
      if (error) fail("expire", error);
      return (data ?? []) as RouteRunnerJobRow[];
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
      const { data, error } = await client
        .from(JOBS)
        .update({ status: "running", lease_until: leaseUntilIso })
        .eq("id", job.id)
        .eq("status", job.status)
        .gt("expires_at", nowIso)
        .or(unleasedFilter(nowIso))
        .select("*");
      if (error) fail("claim", error);
      return ((data ?? [])[0] as RouteRunnerJobRow | undefined) ?? null;
    },

    async updateLeasedJob(id, leaseUntilIso, patch, options) {
      let query = client
        .from(JOBS)
        .update(patch)
        .eq("id", id)
        .eq("lease_until", leaseUntilIso);
      if (options?.unlessCancelled) query = query.neq("status", "cancelled");
      const { data, error } = await query.select("id");
      if (error) fail("leased update", error);
      return (data ?? []).length > 0;
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
        .insert({ ...job, status: "queued" })
        .select("*")
        .single();
      if (error || !data) fail("job insert", error);
      return data as RouteRunnerJobRow;
    },

    async getJob(id) {
      const { data, error } = await client
        .from(JOBS)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) fail("job read", error);
      return (data as RouteRunnerJobRow | null) ?? null;
    },

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
      const { data, error } = await client
        .from(JOBS)
        .update(patch)
        .eq("id", id)
        .in("status", [...statuses])
        .select("*");
      if (error) fail("job update", error);
      return ((data ?? [])[0] as RouteRunnerJobRow | undefined) ?? null;
    }
  };
}
