/**
 * One route runner tick: claim at most one runnable job under a lease, run
 * one step of its route in-process, record the result, release the lease.
 * Global concurrency is 1: nothing runs while any job holds a live lease.
 */
import {
  ROUTE_RUNNER_LEASE_MS,
  ROUTE_RUNNER_MAX_KILLS,
  ROUTE_RUNNER_STEP_DEADLINE_MS,
  ROUTE_RUNNER_STEP_TIMEOUT_MS,
  applyStallGuard,
  buildStepQuery,
  classifyStepResult,
  extractStepProgress,
  formatFreshnessBypass,
  mergeJobProgress,
  readJobProgress,
  type RouteQuery,
  type StepDecision
} from "./core";
import { getRouteRunnerSpec } from "./registry";
import type {
  RouteRunnerEventInsert,
  RouteRunnerJobPatch,
  RouteRunnerJobRow,
  RouteRunnerStore
} from "./store";

export type RouteHandler = (req: any, res: any) => unknown;

export type TickSummary = {
  success: boolean;
  action:
    | "idle"
    | "busy"
    | "lost_race"
    | "stepped"
    | "killed_out"
    | "timed_out"
    | "rejected";
  jobId?: string;
  step?: number;
  statusCode?: number;
  outcome?: StepDecision["kind"];
  reason?: string;
  expired: number;
};

type InvokeResult = {
  statusCode: number;
  body: unknown;
  timedOut: boolean;
  durationMs: number;
};

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, unknown>,
    body: undefined as unknown,
    headersSent: false,
    finished: false,
    setHeader(key: string, value: unknown) {
      this.headers[key.toLowerCase()] = value;
      return this;
    },
    getHeader(key: string) {
      return this.headers[key.toLowerCase()];
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      this.headersSent = true;
      this.finished = true;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      this.headersSent = true;
      this.finished = true;
      return this;
    },
    end(payload?: unknown) {
      if (payload !== undefined) this.body = payload;
      this.headersSent = true;
      this.finished = true;
      return this;
    }
  };
  return res;
}

function queryString(query: RouteQuery) {
  const rendered = new URLSearchParams(query).toString();
  return rendered ? `?${rendered}` : "";
}

/**
 * Calls a route handler in-process with the cron bearer, the same way
 * run-rolling-forge-pipeline does. A handler still running at `timeoutAtMs`
 * is abandoned (reported as timedOut) so the tick can record it.
 */
async function invokeRoute(args: {
  handler: RouteHandler;
  routePath: string;
  query: RouteQuery;
  cronSecret: string;
  timeoutAtMs: number;
  now: () => number;
}): Promise<InvokeResult> {
  const startedAt = args.now();
  const res = createMockRes();
  const req: any = {
    method: "GET",
    query: { ...args.query },
    headers: { authorization: `Bearer ${args.cronSecret}` },
    url: `${args.routePath}${queryString(args.query)}`
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ kind: "timeout" }>((resolve) => {
    timer = setTimeout(
      () => resolve({ kind: "timeout" }),
      Math.max(0, args.timeoutAtMs - startedAt)
    );
  });
  const run = Promise.resolve()
    .then(() => args.handler(req, res))
    .then(
      () => ({ kind: "done" as const }),
      (error: unknown) => ({ kind: "error" as const, error })
    );
  const outcome = await Promise.race([run, timeout]);
  clearTimeout(timer);
  const durationMs = args.now() - startedAt;
  if (outcome.kind === "timeout") {
    return { statusCode: 0, body: null, timedOut: true, durationMs };
  }
  if (outcome.kind === "error") {
    const message =
      outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
    return {
      statusCode: 500,
      body: { success: false, error: `The route threw: ${message}` },
      timedOut: false,
      durationMs
    };
  }
  if (!res.finished) {
    return {
      statusCode: 500,
      body: { success: false, error: "The route returned without sending a response." },
      timedOut: false,
      durationMs
    };
  }
  return { statusCode: res.statusCode, body: res.body, timedOut: false, durationMs };
}

function asQuery(value: unknown): RouteQuery {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const query: RouteQuery = {};
  for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
    if (typeof field === "string") query[key] = field;
  }
  return query;
}

const LEVEL_BY_DECISION: Record<StepDecision["kind"], RouteRunnerEventInsert["level"]> = {
  continue: "info",
  complete: "success",
  wait: "warn",
  fail: "error"
};

export async function runRouteRunnerTick(args: {
  store: RouteRunnerStore;
  handlers: Readonly<Record<string, RouteHandler | undefined>>;
  cronSecret: string;
  now?: () => number;
  /** Test hook; defaults to ROUTE_RUNNER_STEP_TIMEOUT_MS. */
  stepTimeoutMs?: number;
}): Promise<TickSummary> {
  const { store } = args;
  const now = args.now ?? Date.now;
  const tickStartedAt = now();
  const nowIso = new Date(tickStartedAt).toISOString();

  const expiredJobs = await store.expireJobs(nowIso);
  if (expiredJobs.length > 0) {
    await store.insertEvents(
      expiredJobs.map((job) => ({
        job_id: job.id,
        level: "error" as const,
        message: "Expired: the job passed its expires_at (72 h) before finishing."
      }))
    );
  }
  const expired = expiredJobs.length;

  if (await store.findLeaseHolder(nowIso)) {
    return { success: true, action: "busy", expired };
  }
  const [candidate] = await store.listRunnable(nowIso, 1);
  if (!candidate) return { success: true, action: "idle", expired };

  const leaseUntil = new Date(tickStartedAt + ROUTE_RUNNER_LEASE_MS).toISOString();
  const claimed = await store.claimJob(candidate, leaseUntil, nowIso);
  if (!claimed) return { success: true, action: "lost_race", jobId: candidate.id, expired };

  // A tick that claimed another job between our lease check and our claim
  // would run concurrently. Whoever sees the other's lease backs off.
  if (await store.findLeaseHolder(nowIso, claimed.id)) {
    await store.updateLeasedJob(claimed.id, leaseUntil, {
      status: candidate.status,
      lease_until: candidate.lease_until
    });
    return { success: true, action: "busy", jobId: claimed.id, expired };
  }

  const job: RouteRunnerJobRow = claimed;
  const step = job.steps + 1;
  const events: RouteRunnerEventInsert[] = [];
  let kills = job.kills;

  // `running` with a lapsed lease: the tick that held it died mid-step.
  if (candidate.status === "running") {
    kills += 1;
    const killedOut = kills >= ROUTE_RUNNER_MAX_KILLS;
    const message = `Step ${step} was killed before it answered (kill ${kills}/${ROUTE_RUNNER_MAX_KILLS}).${killedOut ? " Giving up." : " Retrying the same query."}`;
    await store.insertEvents([
      { job_id: job.id, level: killedOut ? "error" : "warn", message, step }
    ]);
    if (killedOut) {
      await store.updateLeasedJob(job.id, leaseUntil, {
        kills,
        status: "failed",
        lease_until: null,
        finished_at: nowIso,
        last_error: message
      });
      return { success: true, action: "killed_out", jobId: job.id, step, reason: message, expired };
    }
    await store.updateLeasedJob(job.id, leaseUntil, { kills });
  }

  const spec = getRouteRunnerSpec(job.route_path);
  const handler = args.handlers[job.route_path];
  if (!spec || !handler) {
    const reason = `${job.route_path} is not on the route runner allowlist; the job cannot run.`;
    await store.insertEvents([{ job_id: job.id, level: "error", message: reason, step }]);
    await store.updateLeasedJob(job.id, leaseUntil, {
      status: "failed",
      lease_until: null,
      finished_at: nowIso,
      last_error: reason
    });
    return { success: true, action: "rejected", jobId: job.id, reason, expired };
  }

  const sentQuery = asQuery(job.next_query);
  const stepQuery = buildStepQuery(spec, sentQuery, tickStartedAt, now());
  await store.insertEvents([
    {
      job_id: job.id,
      level: "info",
      step,
      message: `start GET ${job.route_path}${queryString(sentQuery)} (answer due in ${Math.round(
        (tickStartedAt + ROUTE_RUNNER_STEP_DEADLINE_MS - now()) / 1000
      )} s)`
    }
  ]);

  const result = await invokeRoute({
    handler,
    routePath: job.route_path,
    query: stepQuery,
    cronSecret: args.cronSecret,
    timeoutAtMs: tickStartedAt + (args.stepTimeoutMs ?? ROUTE_RUNNER_STEP_TIMEOUT_MS),
    now
  });
  const finishedIso = new Date(now()).toISOString();

  if (result.timedOut) {
    // Counted as a kill. The lease stays until it lapses, after this
    // function is gone, so the abandoned call cannot overlap a retry.
    kills += 1;
    const killedOut = kills >= ROUTE_RUNNER_MAX_KILLS;
    const reason = `Step ${step} was still running after ${Math.round(result.durationMs / 1000)} s and was stopped (kill ${kills}/${ROUTE_RUNNER_MAX_KILLS}).${killedOut ? " Giving up." : " Retrying the same query."}`;
    events.push({
      job_id: job.id,
      level: killedOut ? "error" : "warn",
      message: reason,
      step,
      duration_ms: result.durationMs
    });
    await store.updateLeasedJob(
      job.id,
      leaseUntil,
      {
        kills,
        status: killedOut ? "failed" : "queued",
        last_error: reason,
        ...(killedOut ? { finished_at: finishedIso } : {})
      },
      { unlessCancelled: true }
    );
    await store.insertEvents(events);
    return {
      success: true,
      action: "timed_out",
      jobId: job.id,
      step,
      reason,
      expired
    };
  }

  const classified = classifyStepResult(
    spec.contract,
    { statusCode: result.statusCode, body: result.body },
    sentQuery,
    spec.runnerParams ?? []
  );
  const previous = readJobProgress(job.progress);
  const guarded = applyStallGuard(
    classified,
    sentQuery,
    previous?.stalls ?? 0,
    previous?.done ?? null
  );
  const decision = guarded.decision;
  const stepProgress = extractStepProgress(result.body);
  const rowsTotal = Number(job.rows_total ?? 0) + (stepProgress.rows ?? 0);
  const progress = {
    ...mergeJobProgress(previous, stepProgress, guarded.stalls),
    ...(decision.kind === "fail" && decision.blockedBy
      ? { blockedBy: decision.blockedBy, blockerCount: decision.blockerCount ?? null }
      : {}),
    rowsTotal,
    lastStepMs: result.durationMs
  };

  const bookkeeping: RouteRunnerJobPatch = {
    steps: step,
    rows_total: rowsTotal,
    progress,
    last_status_code: result.statusCode,
    last_operation_status: stepProgress.operationStatus,
    lease_until: null
  };
  const transition: RouteRunnerJobPatch =
    decision.kind === "continue"
      ? { status: "queued", next_query: decision.nextQuery, not_before: null, last_error: null }
      : decision.kind === "wait"
        ? {
            status: "waiting",
            not_before: new Date(now() + decision.delayMs).toISOString(),
            last_error: decision.reason
          }
        : decision.kind === "complete"
          ? { status: "completed", finished_at: finishedIso, not_before: null, last_error: null }
          : {
              status: "failed",
              finished_at: finishedIso,
              last_error: decision.reason,
              // Kept so the page can re-queue it (freshness block).
              ...(decision.nextQuery ? { next_query: decision.nextQuery } : {})
            };

  // A bypassed job's results stay marked as built past its freshness blockers.
  const bypass = previous?.freshnessBypass ?? null;
  events.push({
    job_id: job.id,
    level: bypass && decision.kind === "complete" ? "warn" : LEVEL_BY_DECISION[decision.kind],
    message: bypass ? `${decision.reason} ${formatFreshnessBypass(bypass)}` : decision.reason,
    step,
    status_code: result.statusCode,
    rows: stepProgress.rows,
    progress: { ...progress, operationStatus: stepProgress.operationStatus },
    duration_ms: result.durationMs
  });

  const updated = await store.updateLeasedJob(
    job.id,
    leaseUntil,
    { ...bookkeeping, ...transition },
    { unlessCancelled: true }
  );
  if (!updated) {
    // Cancelled while the step ran: keep the result, run nothing further.
    const recorded = await store.updateLeasedJob(job.id, leaseUntil, bookkeeping);
    events.push({
      job_id: job.id,
      level: "warn",
      step,
      message: recorded
        ? "The job was cancelled while this step ran; its result is recorded and nothing further runs."
        : "This tick no longer held the job's lease; the step result was not recorded on the job."
    });
  }
  await store.insertEvents(events);

  return {
    success: true,
    action: "stepped",
    jobId: job.id,
    step,
    statusCode: result.statusCode,
    outcome: decision.kind,
    reason: decision.reason.slice(0, 300),
    expired
  };
}
