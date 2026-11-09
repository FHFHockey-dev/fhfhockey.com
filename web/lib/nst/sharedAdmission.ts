import { currentNstJob, withNstJobDispatch } from "./jobLifecycle.server";
import { performance } from "node:perf_hooks";
import { canUseNstSemiBurst } from "lib/cron/nstRateLimitPolicy";
import { NstExecutionLimitError, type NstRequestControl } from "./requestBudget";
export class NstSharedAdmissionError extends Error {}
/** An operation hook refused (or did not perform) an operation; nothing was sent. */
export class NstOperationRefusedError extends NstExecutionLimitError {}

/** One HTTP operation the NST client is about to dispatch. `attempt` is counted
 * (1-based, per kind, per page across retries) before the hook is called. */
export interface NstOperation {
  kind: "admission" | "provider";
  method: "GET" | "POST";
  /** Credential-free URL: the RPC endpoint, or the NST URL with any query key redacted. */
  redactedUrl: string;
  attempt: number;
}
/** Sanitized outcome of a completed operation: no body, headers or credentials. */
export type NstOperationSettlement =
  | { kind: "admission"; httpStatus: number; valid: boolean; allowed: boolean | null; waitMs: number | null }
  | { kind: "provider"; httpStatus: number; redirected: boolean; finalUrl: string; decodedBytes: number };
/** Optional pre-dispatch wrapper. The network request (including body consumption)
 * happens only inside `perform`, at most once. Throwing, or returning without
 * calling `perform`, refuses the operation: nothing is sent and the client does
 * not retry. A `signal` passed to `perform` also aborts the request. */
export type NstOperationHook = (
  operation: NstOperation,
  perform: (context?: { signal?: AbortSignal }) => Promise<NstOperationSettlement>,
) => Promise<unknown>;
export type NstOperationCounters = { admission: number; provider: number };

export async function runNstOperation<T>(
  hook: NstOperationHook | undefined,
  operation: Omit<NstOperation, "attempt">,
  counters: NstOperationCounters,
  perform: (signal?: AbortSignal) => Promise<T>,
  settle: (value: T) => NstOperationSettlement,
): Promise<T> {
  // Count before dispatch, whether or not a hook is present.
  const attempt = ++counters[operation.kind];
  if (!hook) return perform(undefined);
  let pending: Promise<T> | undefined;
  try {
    await hook({ ...operation, attempt }, async (context) => {
      if (pending) throw new NstExecutionLimitError("NST operation hook may dispatch an operation only once.");
      pending = perform(context?.signal);
      return settle(await pending);
    });
  } catch (error) {
    if (!pending) throw new NstOperationRefusedError("NST operation hook refused dispatch; no request started.");
    await pending; // Surface the operation's own failure first.
    throw new NstExecutionLimitError("NST operation hook rejected a settled operation.", operation.kind === "provider");
  }
  if (!pending) throw new NstOperationRefusedError("NST operation hook did not dispatch; no request started.");
  return pending; // A hook that did not await perform still waits for the real outcome.
}

export type NstAdmissionOptions = {
  /** Opt-in cap on admission POSTs for one page (counted across retries). */
  maxCalls?: number;
  hook?: NstOperationHook;
  counters?: NstOperationCounters;
};

// Requires the reviewed nst_admit_attempt_v1 RPC. Missing/failed coordination
// never falls back to instance-local /tmp, an alternate key, or a burst.
export async function admitSharedNstAttempt<T>(deadlineAt: number, dispatch: () => Promise<T>, control?: Pick<NstRequestControl, "minIntervalMs" | "plannedRequestCount">, admission?: NstAdmissionOptions): Promise<T> {
  return withNstJobDispatch(async () => {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!origin || !key) throw new NstSharedAdmissionError("NST shared admission is not configured; no provider request started.");
  const job = currentNstJob();
  const endpoint = new URL(`/rest/v1/rpc/${job ? "nst_admit_job_attempt_v1" : "nst_admit_attempt_v1"}`, origin);
  if (endpoint.protocol !== "https:") throw new NstSharedAdmissionError("NST shared admission requires HTTPS.");
  const burst = control?.minIntervalMs === 0 && canUseNstSemiBurst(control.plannedRequestCount ?? NaN);
  const body = JSON.stringify({ p_burst: burst, p_planned_requests: burst ? control!.plannedRequestCount : null,
    ...(job ? { p_kind: job.kind, p_token: job.token } : {}) });
  const counters = admission?.counters ?? { admission: 0, provider: 0 };
  const isValidReceipt = (receipt: any) => receipt?.version === 1 && receipt.scope === "global-nst" && receipt.permitTtlMs === 1000 &&
    typeof receipt.allowed === "boolean" && Number.isSafeInteger(receipt.waitMs) && receipt.waitMs >= 0;
  while (Date.now() < deadlineAt) {
    currentNstJob();
    if (admission?.maxCalls !== undefined && counters.admission >= admission.maxCalls) {
      throw new NstExecutionLimitError("NST admission-call limit reached; no provider request started.");
    }
    const started = performance.now();
    let receipt: any;
    let httpStatus = 0;
    try {
      receipt = await runNstOperation(admission?.hook, { kind: "admission", method: "POST", redactedUrl: endpoint.toString() }, counters, async (signal) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), Math.min(5000, deadlineAt - Date.now()));
        if (signal?.aborted) controller.abort(); else signal?.addEventListener("abort", () => controller.abort(), { once: true });
        try {
          const response = await fetch(endpoint, { method: "POST", redirect: "error", signal: controller.signal,
            headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` }, body });
          httpStatus = response.status;
          if (!response.ok) throw new Error("Shared admission unavailable");
          return await response.json();
        } finally { clearTimeout(timeout); }
      }, (value) => ({ kind: "admission", httpStatus, valid: isValidReceipt(value),
        allowed: isValidReceipt(value) ? value.allowed : null, waitMs: isValidReceipt(value) ? value.waitMs : null }));
    } catch (error) {
      if (error instanceof NstOperationRefusedError) throw error;
      throw new NstSharedAdmissionError("NST shared admission unavailable; no provider request started (permit outcome may be unknown).");
    }
    if (!isValidReceipt(receipt)) {
      throw new NstSharedAdmissionError("NST shared admission returned an invalid receipt; no provider request started.");
    }
    if (receipt.allowed) {
      // Measure from BEFORE sending admission. This is conservative across clock
      // skew and transport delay; expired/uncertain permits remain consumed.
      if (performance.now() - started >= receipt.permitTtlMs || Date.now() >= deadlineAt) {
        throw new NstSharedAdmissionError("NST shared permit expired before dispatch; no provider request started.");
      }
      currentNstJob();
      return dispatch();
    }
    if (admission?.maxCalls !== undefined && counters.admission >= admission.maxCalls) {
      throw new NstExecutionLimitError("NST shared admission denied at the admission-call limit; no provider request started.");
    }
    const waitMs = Math.max(25, receipt.waitMs);
    if (Date.now() + waitMs >= deadlineAt) throw new NstExecutionLimitError("NST shared budget cannot fit inside the run deadline.");
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }
  throw new NstExecutionLimitError("NST run deadline reached before shared admission.");
  });
}
