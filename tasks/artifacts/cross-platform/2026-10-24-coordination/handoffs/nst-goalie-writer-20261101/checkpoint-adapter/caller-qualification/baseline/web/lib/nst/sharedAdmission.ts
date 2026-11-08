import { currentNstJob, withNstJobDispatch } from "./jobLifecycle.server";
import { performance } from "node:perf_hooks";
import { canUseNstSemiBurst } from "lib/cron/nstRateLimitPolicy";
import { NstExecutionLimitError, type NstRequestControl } from "./requestBudget";
export class NstSharedAdmissionError extends Error {}

// Requires the reviewed nst_admit_attempt_v1 RPC. Missing/failed coordination
// never falls back to instance-local /tmp, an alternate key, or a burst.
export async function admitSharedNstAttempt<T>(deadlineAt: number, dispatch: () => Promise<T>, control?: Pick<NstRequestControl, "minIntervalMs" | "plannedRequestCount">): Promise<T> {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!origin || !key) throw new NstSharedAdmissionError("NST shared admission is not configured; no provider request started.");
  const job = currentNstJob();
  const endpoint = new URL(`/rest/v1/rpc/${job ? "nst_admit_job_attempt_v1" : "nst_admit_attempt_v1"}`, origin);
  if (endpoint.protocol !== "https:") throw new NstSharedAdmissionError("NST shared admission requires HTTPS.");
  const burst = control?.minIntervalMs === 0 && canUseNstSemiBurst(control.plannedRequestCount ?? NaN);
  const body = JSON.stringify({ p_burst: burst, p_planned_requests: burst ? control!.plannedRequestCount : null,
    ...(job ? { p_kind: job.kind, p_token: job.token } : {}) });
  while (Date.now() < deadlineAt) {
    const started = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(5000, deadlineAt - Date.now()));
    let receipt: any;
    try {
      const response = await fetch(endpoint, { method: "POST", redirect: "error", signal: controller.signal,
        headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` }, body });
      if (!response.ok) throw new Error("Shared admission unavailable");
      receipt = await response.json();
    } catch {
      throw new NstSharedAdmissionError("NST shared admission unavailable; no provider request started (permit outcome may be unknown).");
    } finally { clearTimeout(timeout); }
    if (receipt?.version !== 1 || receipt.scope !== "global-nst" || receipt.permitTtlMs !== 1000 ||
        typeof receipt.allowed !== "boolean" || !Number.isSafeInteger(receipt.waitMs) || receipt.waitMs < 0) {
      throw new NstSharedAdmissionError("NST shared admission returned an invalid receipt; no provider request started.");
    }
    if (receipt.allowed) {
      // Measure from BEFORE sending admission. This is conservative across clock
      // skew and transport delay; expired/uncertain permits remain consumed.
      if (performance.now() - started >= receipt.permitTtlMs || Date.now() >= deadlineAt) {
        throw new NstSharedAdmissionError("NST shared permit expired before dispatch; no provider request started.");
      }
      return withNstJobDispatch(dispatch);
    }
    const waitMs = Math.max(25, receipt.waitMs);
    if (Date.now() + waitMs >= deadlineAt) throw new NstExecutionLimitError("NST shared budget cannot fit inside the run deadline.");
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }
  throw new NstExecutionLimitError("NST run deadline reached before shared admission.");
}
