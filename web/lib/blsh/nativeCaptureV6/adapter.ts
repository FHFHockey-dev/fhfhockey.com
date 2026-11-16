/** BLSH native capture v6 adapter: derived from the reviewed v5 adapter
 * (web/scripts/blsh/nativeProcessCaptureAdapter.ts @ 348a122d6). Deviations
 * (CORE-DEVIATIONS.md): the schedule URL takes the source date; there is no withJob,
 * because v6 runs in disabled lifecycle mode only and requires NST_JOB_LIFECYCLE_ENABLED
 * to be ABSENT; the TLS observer is v6's ./tlsObservation (M1 fix): v5's socket-fact block
 * verbatim, with requests attributed by async context so other invocations sharing a Fluid
 * instance cannot break or join an observation. */
import { fetchNstTextByUrl, type NstOperationHook } from "../../nst/client";
import { NST_ADMISSION_PROJECT_HOST, nstAdmissionOrigin } from "../../nst/admissionOrigin";
import { withTlsObservation, type TlsObservation } from "./tlsObservation";
import type { Captured, CaptureDispatchSpec, CaptureResponse, NativeCaptureAdapterV6 } from "./core";

const ORIGIN = `https://${NST_ADMISSION_PROJECT_HOST}`;
const need = (ok: unknown, code: string): void => { if (!ok) throw new Error(code); };
type TransportFacts = Omit<CaptureResponse, "bytes"> & { decodedBytes: number; tls: TlsObservation };

/** Bounded schedule transport (unchanged from v5). The NST body path stays in its client. */
async function boundedFetch(spec: CaptureDispatchSpec, init: Pick<RequestInit, "headers" | "body"> = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (spec.signal.aborted) abort(); else spec.signal.addEventListener("abort", abort, { once: true });
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const cancel = () => { void reader?.cancel().catch(() => {}); };
  controller.signal.addEventListener("abort", cancel, { once: true });
  try {
    need(!controller.signal.aborted, "capture_transport_aborted");
    const response = await fetch(spec.url, { ...init, method: spec.method, redirect: spec.redirect, cache: "no-store", signal: controller.signal });
    need(response.status === 200 && response.url === spec.url && !response.redirected, "capture_transport_response_invalid");
    need(response.body, "capture_transport_body_missing");
    reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      need(!controller.signal.aborted, "capture_transport_aborted");
      const { done, value } = await reader.read();
      need(!controller.signal.aborted, "capture_transport_aborted");
      if (done) break;
      need(value.byteLength <= spec.maxResponseBytes - size, "capture_transport_body_limit");
      size += value.byteLength; chunks.push(value.slice());
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { bytes, status: response.status, finalUrl: response.url, redirected: response.redirected };
  } catch {
    controller.abort(); cancel();
    throw new Error("capture_transport_failed");
  } finally {
    spec.signal.removeEventListener("abort", abort);
    controller.signal.removeEventListener("abort", cancel);
    reader?.releaseLock();
  }
}

/** Value-free environment check shared with the route's gate 5. */
export function nativeCaptureEnvironmentProblemV6(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (nstAdmissionOrigin(raw)?.origin !== ORIGIN || raw?.trim() !== ORIGIN) return "capture_adapter_project_changed";
  if (Object.prototype.hasOwnProperty.call(process.env, "NST_JOB_LIFECYCLE_ENABLED")) return "capture_adapter_lifecycle_key_present";
  if (!process.env.NST_KEY?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return "capture_adapter_credentials_missing";
  return null;
}

export function createNativeCaptureAdapterV6(expected: { supabaseOrigin: string; sourceDate: string }): NativeCaptureAdapterV6 {
  need(expected.supabaseOrigin === ORIGIN && /^\d{4}-\d{2}-\d{2}$/.test(expected.sourceDate), "capture_adapter_target_invalid");
  const scheduleUrl = `https://api-web.nhle.com/v1/schedule/${expected.sourceDate}`;
  const assertEnvironment = () => { const problem = nativeCaptureEnvironmentProblemV6(); if (problem) throw new Error(problem); };
  assertEnvironment();
  return {
    sourceDate: expected.sourceDate,
    get supabaseOrigin() { assertEnvironment(); return ORIGIN; },
    schedule(dispatch) {
      assertEnvironment();
      return dispatch("schedule", spec => {
        assertEnvironment();
        need(spec.method === "GET" && spec.url === scheduleUrl, "capture_schedule_scope_invalid");
        return withTlsObservation(spec.url, spec.method, () => boundedFetch(spec, { headers: { Accept: "application/json" } }));
      });
    },
    async nst(group, url, options) {
      assertEnvironment();
      let provider: Captured<TransportFacts> | undefined;
      const operationHook: NstOperationHook = async (operation, perform) => {
        assertEnvironment();
        need(operation.attempt === 1, "capture_nst_repeat_forbidden");
        if (operation.kind === "admission") {
          await options.dispatch(`admission:${group}`, async spec => {
            assertEnvironment();
            need(operation.method === spec.method && operation.redactedUrl === spec.url, "capture_admission_scope_invalid");
            const settlement = await withTlsObservation(spec.url, spec.method, () => perform({ signal: spec.signal }));
            need(settlement.kind === "admission", "capture_admission_settlement_invalid");
            return settlement;
          });
        } else {
          provider = await options.dispatch(`nst:${group}`, async spec => {
            assertEnvironment();
            need(operation.method === spec.method && operation.redactedUrl === spec.url && spec.url === url, "capture_provider_scope_invalid");
            const settlement = await withTlsObservation(spec.url, spec.method, () => perform({ signal: spec.signal }));
            if (settlement.kind !== "provider") throw new Error("capture_provider_settlement_invalid");
            need(settlement.decodedBytes > 0 && settlement.decodedBytes <= spec.maxResponseBytes, "capture_provider_byte_limit");
            return { status: settlement.httpStatus, finalUrl: settlement.finalUrl, redirected: settlement.redirected, decodedBytes: settlement.decodedBytes, tls: settlement.tls };
          });
        }
      };
      const result = await fetchNstTextByUrl(url, { requestControl: options.requestControl, retries: options.retries,
        allowQueryKeyFallback: options.allowQueryKeyFallback, timeoutMs: options.timeoutMs,
        maxResponseBytes: options.maxResponseBytes, maxAdmissionCalls: options.maxAdmissionCalls, operationHook });
      assertEnvironment();
      need(provider && result.redactedUrl === url, "capture_provider_witness_missing");
      for (const value of [process.env.NST_KEY!, process.env.SUPABASE_SERVICE_ROLE_KEY!]) {
        const secret = value.trim();
        need(!result.text.includes(secret) && !result.text.includes(encodeURIComponent(secret)), "capture_credential_echo");
      }
      return { ...provider!, value: { status: result.response.status, finalUrl: result.response.url,
        redirected: result.response.redirected, bytes: Buffer.from(result.text, "utf8") } };
    },
  };
}
