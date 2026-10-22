/**
 * In-memory RouteRunnerStore for tests. Mirrors the conditional-update
 * semantics of the Supabase store (lease and status guards).
 */
import { isActiveStatus, type RouteQuery } from "./core";
import { storedContract } from "./registry";
import type {
  RouteRunnerEventRow,
  RouteRunnerJobRow,
  RouteRunnerStore
} from "./store";

export function makeJob(overrides: Partial<RouteRunnerJobRow> = {}): RouteRunnerJobRow {
  const query: RouteQuery = { runMode: "incremental", startDate: "2026-03-01", endDate: "2026-03-07" };
  return {
    id: "00000000-0000-4000-8000-000000000001",
    route_path: "/api/v1/db/update-nst-gamelog",
    initial_query: query,
    next_query: query,
    contract: "nst_resume",
    status: "queued",
    created_by: null,
    created_at: "2026-10-22T09:00:00.000Z",
    updated_at: "2026-10-22T09:00:00.000Z",
    not_before: null,
    lease_until: null,
    expires_at: "2026-10-25T09:00:00.000Z",
    steps: 0,
    kills: 0,
    rows_total: 0,
    progress: null,
    last_status_code: null,
    last_operation_status: null,
    last_error: null,
    finished_at: null,
    ...overrides
  };
}

const ms = (iso: string | null) => (iso == null ? null : Date.parse(iso));

export function createMemoryRouteRunnerStore(initial: RouteRunnerJobRow[] = []) {
  const jobs = new Map(initial.map((job) => [job.id, { ...job }]));
  const events: RouteRunnerEventRow[] = [];
  let nextJobNumber = initial.length + 1;

  const unleased = (job: RouteRunnerJobRow, nowIso: string) =>
    job.lease_until == null || (ms(job.lease_until) as number) < Date.parse(nowIso);

  const store: RouteRunnerStore = {
    async expireJobs(nowIso) {
      const expired: RouteRunnerJobRow[] = [];
      for (const job of jobs.values()) {
        if (isActiveStatus(job.status) && Date.parse(job.expires_at) <= Date.parse(nowIso) && unleased(job, nowIso)) {
          Object.assign(job, { status: "failed", finished_at: nowIso, lease_until: null, last_error: "Expired" });
          expired.push({ ...job });
        }
      }
      return expired;
    },
    async findLeaseHolder(nowIso, excludeId) {
      for (const job of jobs.values()) {
        if (job.id !== excludeId && job.lease_until && (ms(job.lease_until) as number) > Date.parse(nowIso)) {
          return job.id;
        }
      }
      return null;
    },
    async listRunnable(nowIso, limit) {
      return [...jobs.values()]
        .filter(
          (job) =>
            isActiveStatus(job.status) &&
            Date.parse(job.expires_at) > Date.parse(nowIso) &&
            (job.not_before == null || (ms(job.not_before) as number) <= Date.parse(nowIso)) &&
            unleased(job, nowIso)
        )
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .slice(0, limit)
        .map((job) => ({ ...job }));
    },
    async claimJob(candidate, leaseUntilIso, nowIso) {
      const job = jobs.get(candidate.id);
      if (!job || job.status !== candidate.status || Date.parse(job.expires_at) <= Date.parse(nowIso) || !unleased(job, nowIso)) {
        return null;
      }
      Object.assign(job, { status: "running", lease_until: leaseUntilIso });
      return { ...job };
    },
    async updateLeasedJob(id, leaseUntilIso, patch, options) {
      const job = jobs.get(id);
      if (!job || job.lease_until !== leaseUntilIso) return false;
      if (options?.unlessCancelled && job.status === "cancelled") return false;
      Object.assign(job, patch);
      return true;
    },
    async insertEvents(rows) {
      for (const row of rows) {
        events.push({
          step: null,
          status_code: null,
          rows: null,
          progress: null,
          duration_ms: null,
          ...row,
          id: events.length + 1,
          at: new Date(0).toISOString()
        } as RouteRunnerEventRow);
      }
    },
    async listJobs(limit) {
      return [...jobs.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
    },
    async createJob(input) {
      const id = `00000000-0000-4000-8000-${String(nextJobNumber++).padStart(12, "0")}`;
      const job = makeJob({ ...input, contract: storedContract(input.contract), id, status: "queued" });
      jobs.set(id, job);
      return { ...job };
    },
    async getJob(id) {
      const job = jobs.get(id);
      return job ? { ...job } : null;
    },
    async listEvents(jobId, afterId, limit) {
      return events.filter((event) => event.job_id === jobId && event.id > afterId).slice(0, limit);
    },
    async updateJobIfStatus(id, statuses, patch) {
      const job = jobs.get(id);
      if (!job || !statuses.includes(job.status)) return null;
      Object.assign(job, patch);
      return { ...job };
    }
  };

  return { store, jobs, events };
}
