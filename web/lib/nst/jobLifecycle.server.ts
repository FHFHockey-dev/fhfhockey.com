import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { nstAdmissionOrigin } from "./admissionOrigin";

export class NstJobLifecycleError extends Error {}
export type NstJobToken = { kind: "direct" | "goalie"; token: string };
type JobContext = NstJobToken & { deadlineAt: number; active: number; closed: boolean;
  uncertain?: boolean; begun?: boolean; beginPending?: Promise<void>; begin?: () => Promise<void> };
const jobs = new AsyncLocalStorage<JobContext>();
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type NstLifecycleRpc = (name: string, args: Record<string, unknown>, deadlineAt: number) => Promise<any>;

/** Bounded control-plane I/O only; never retries an uncertain mutation. */
export const nstLifecycleRpc: NstLifecycleRpc = async (name, args, deadlineAt) => {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!origin || !key) throw new NstJobLifecycleError("NST job lifecycle is not configured.");
  const pinned = nstAdmissionOrigin(origin);
  if (!pinned) throw new NstJobLifecycleError("Invalid NST lifecycle origin: only the pinned production project is allowed.");
  const url = new URL(`/rest/v1/rpc/${name}`, pinned);
  const controller = new AbortController();
  const remaining = Math.min(5_000, deadlineAt - Date.now());
  if (remaining <= 0) throw new NstJobLifecycleError("NST lifecycle deadline exhausted.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([(async () => {
      const response = await fetch(url, { method: "POST", redirect: "error", signal: controller.signal,
        headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify(args) });
      if (!response.ok) throw new Error("Lifecycle unavailable");
      return response.json();
    })(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new NstJobLifecycleError("NST lifecycle acknowledgement timed out.")); }, remaining);
    })]);
  } finally { clearTimeout(timer); }
};

export function currentNstJob(): NstJobToken | undefined {
  const job = jobs.getStore();
  if (job && (job.closed || job.uncertain || Date.now() >= job.deadlineAt)) throw new NstJobLifecycleError("NST job is closed, uncertain or expired.");
  return job && { kind: job.kind, token: job.token };
}

export function markNstJobUncertain() {
  const job = jobs.getStore();
  if (job) job.uncertain = true;
}

/** Check before persistence/loop work as well as before provider dispatch. */
export function assertNstJobActive() { requireNstJob(); }

export function requireNstJob() {
  const job = currentNstJob();
  if (process.env.NST_JOB_LIFECYCLE_ENABLED === "true" && !job) {
    throw new NstJobLifecycleError("This NST helper requires an enclosing job.");
  }
}

/** Keep the enclosing lease open through provider body consumption. */
export async function withNstJobDispatch<T>(dispatch: () => Promise<T>): Promise<T> {
  const job = jobs.getStore();
  requireNstJob();
  if (!job) return dispatch();
  job.active++;
  try {
    await job.begin?.();
    currentNstJob();
    return await dispatch();
  } finally { job.active--; }
}

/** Callers must await all provider and persistence work and explicitly classify
 * its final outcome. Disabled by default until every caller is qualified. */
export async function runNstJob<T>(input: {
  owner: string; deadlineAt: number; settled: (result: T) => boolean; rpc?: NstLifecycleRpc; lazy?: boolean;
}, work: () => Promise<T>): Promise<T> {
  if (process.env.NST_JOB_LIFECYCLE_ENABLED !== "true") return work();
  if (jobs.getStore()) throw new NstJobLifecycleError("Nested NST jobs require the existing parent lease.");
  const rpc = input.rpc ?? nstLifecycleRpc;
  const token = randomUUID();
  if (!input.owner.trim() || input.owner.length > 128 || !Number.isFinite(input.deadlineAt) ||
      input.deadlineAt <= Date.now() || input.deadlineAt > Date.now() + 3_600_000) throw new NstJobLifecycleError("Invalid NST job bounds.");
  const context: JobContext = { kind: "direct", token, deadlineAt: input.deadlineAt, active: 0, closed: false };
  context.begin = () => context.beginPending ??= (async () => {
    const receipt = await rpc("nst_job_begin_v1", { p_token: token, p_owner: input.owner, p_deadline_at: new Date(input.deadlineAt).toISOString() }, input.deadlineAt);
    if (receipt?.status !== "started" || receipt.token !== token) throw new NstJobLifecycleError("NST job begin is unacknowledged; no work started.");
    context.begun = true;
  })();
  if (!input.lazy) await context.begin();
  try {
    const result = await jobs.run(context, work);
    context.closed = true;
    if (!context.beginPending) return result; // Cache-only read: no NST occupancy was acquired.
    if (!context.begun || context.uncertain || context.active || Date.now() >= input.deadlineAt || !input.settled(result)) throw new NstJobLifecycleError("NST job outcome requires reconciliation.");
    const finished = await rpc("nst_job_finish_v1", { p_token: token }, input.deadlineAt);
    if (finished?.status !== "finished" || finished.token !== token) throw new NstJobLifecycleError("NST job finish is unacknowledged.");
    return result;
  } catch (error) {
    context.closed = true;
    if (context.beginPending) {
      try { await rpc("nst_job_hold_v1", { p_token: token, p_reason: "Unacknowledged enclosing job outcome" }, Date.now() + 5_000); } catch { /* The active/expired row already prevents clearance. */ }
    }
    throw error;
  }
}

/** Checkpoint claims are themselves durable enclosing leases. No new direct job
 * is opened around a goalie claim; its commit/finish RPCs own settlement. */
export function withGoalieJob<T>(token: string, deadlineAt: number, work: () => Promise<T>): Promise<T> {
  if (!UUID.test(token) || jobs.getStore()) throw new NstJobLifecycleError("Invalid goalie job context.");
  const context: JobContext = { kind: "goalie", token, deadlineAt, active: 0, closed: false };
  return jobs.run(context, async () => {
    try {
      const result = await work();
      if (context.active) throw new NstJobLifecycleError("Goalie provider work is still active.");
      return result;
    } finally { context.closed = true; }
  });
}

type ApiHandler = (req: import("next").NextApiRequest, res: import("next").NextApiResponse) => Promise<unknown>;

/** Enclose authenticated JSON routes outside their audit wrapper. Delay the
 * response until the lifecycle receipt is acknowledged, preserving audit data.
 * `auditUnadmitted` wraps the 503 sent when admission fails before the handler
 * (and so its inner audit wrapper) ran, so that refusal is still audited. */
export function withNstJobLifecycle(
  handler: ApiHandler,
  owner: string,
  skip?: (req: import("next").NextApiRequest) => boolean,
  options?: { lazy?: boolean; settled?: (body: any, statusCode: number) => boolean;
    auditUnadmitted?: (respond: ApiHandler) => ApiHandler },
) {
  return async (req: import("next").NextApiRequest, res: import("next").NextApiResponse) => {
    if (process.env.NST_JOB_LIFECYCLE_ENABLED !== "true" || skip?.(req)) return handler(req, res);
    const originalJson = res.json;
    let captured = false;
    let invoked = false;
    let body: any;
    res.json = ((value: unknown) => { captured = true; body = value; return res; }) as typeof res.json;
    try {
      await runNstJob({ owner, deadlineAt: Date.now() + 240_000, lazy: options?.lazy, settled: () => captured && !res.headersSent &&
        res.statusCode >= 200 && res.statusCode < 300 && body?.requiresReview !== true &&
        body?.operationStatus !== "failed" && body?.auditPersisted !== false &&
        // Some routes report queue completion/replay safety separately from
        // this invocation's acknowledged I/O. Only their explicit classifier
        // may accept those outcomes; all other callers keep the strict default.
        (options?.settled ? options.settled(body, res.statusCode)
          : body?.success !== false && body?.retrySafe !== false) }, async () => { invoked = true; await handler(req, res); });
      res.json = originalJson;
      return res.json(body);
    } catch {
      res.json = originalJson;
      if (res.headersSent) return;
      const failure = { success: false, operationStatus: "failed", retrySafe: false,
        lifecycle: { status: "unacknowledged", requiresReview: true },
        error: "NST job lifecycle requires reconciliation before retrying.",
        ...(captured ? { operationResponse: body } : {}) };
      const respond: ApiHandler = async (_req, response) => response.status(503).json(failure);
      return (!invoked && options?.auditUnadmitted ? options.auditUnadmitted(respond) : respond)(req, res);
    } finally { res.json = originalJson; }
  };
}
