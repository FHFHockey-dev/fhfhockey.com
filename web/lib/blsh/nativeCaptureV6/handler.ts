/** BLSH native capture v6: the route handler (DESIGN.md §1.1, as implemented).
 * Gate order. Every gate before the claim is free: it never burns the date.
 *   0. cron bearer only (403): an admin JWT never reaches the store or the capture;
 *   1. clock: pilot fence and season (200 skip), window (409) - no I/O;
 *   2. environment: pinned project, credentials, NST_JOB_LIFECYCLE_ENABLED absent,
 *      VERCEL_DEPLOYMENT_ID present and VERCEL_ENV=production (503) - no I/O;
 *   3. runtime precheck: CA store hashable, global dispatcher = core-load Agent (503) - no I/O;
 *   4. kill switch: blsh_capture_enabled_v1() through the isolated writer (200 skip when off);
 *   5. plan (prepareNativeProcessCapture, unchanged) and adapter construction (503);
 *   5.5 observer self-test (M1 fix): a loopback-only check that this runtime attributes undici
 *      requests to their async context, so a broken observer refuses here (503) instead of burning D;
 *   6. claim: unique (pipeline, source_date); a second trigger gets a 200 skip.
 * After the claim everything is final for D: no retry and no re-run. */
import type { NextApiRequest, NextApiResponse } from "next";
import { invokedByCron } from "utils/adminOnlyMiddleware";
import { prepareNativeProcessCapture } from "../../../scripts/blsh/nativeProcessCapturePreparation";
import { createNativeCaptureAdapterV6, nativeCaptureEnvironmentProblemV6 } from "./adapter";
import { CaptureRunError, PINNED_SUPABASE_ORIGIN, runNativeCaptureV6, runtimePrecheckV6, type NativeCaptureAdapterV6 } from "./core";
import { createPacketSink, type PacketSink } from "./sink";
import { selectSourceDate } from "./sourceDate";
import { observerSelfTest } from "./tlsObservation";
import { createCaptureStore, type CaptureStore } from "./writer";

export interface BlshNativeCaptureDeps {
  now(): number;
  precheck(): string | null;
  createStore(): CaptureStore;
  createAdapter(sourceDate: string): NativeCaptureAdapterV6;
  createSink(store: CaptureStore, runId: string, sourceDate: string): PacketSink;
  run: typeof runNativeCaptureV6;
  /** Gate 5.5: null when the observer self-test passes, otherwise a refusal code. */
  selfTest(): Promise<string | null>;
  routeBundlePath: string | null;
}

let invocationOrdinal = 0;

function deploymentProblem(): string | null {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(process.env.VERCEL_DEPLOYMENT_ID ?? "")) return "deployment_id_missing";
  if (process.env.VERCEL_ENV !== "production") return "deployment_not_production";
  return null;
}

export function createBlshNativeCaptureHandler(deps: BlshNativeCaptureDeps) {
  return async function blshNativeCaptureHandler(req: NextApiRequest, res: NextApiResponse) {
    const ordinal = ++invocationOrdinal;
    if (!invokedByCron(req.headers.authorization ?? "")) return res.status(403).json({ success: false, error: "cron_bearer_required" });
    const decision = selectSourceDate(deps.now());
    if (!decision.ok) {
      const skip = decision.reason === "pilot_fence" || decision.reason === "outside_season";
      return res.status(skip ? 200 : 409).json({ success: skip, skipped: skip ? decision.reason : undefined, error: skip ? undefined : decision.reason });
    }
    const D = decision.sourceDate;
    const environment = nativeCaptureEnvironmentProblemV6() ?? deploymentProblem();
    if (environment) return res.status(503).json({ success: false, error: environment, sourceDate: D });
    const precheck = deps.precheck();
    if (precheck) return res.status(503).json({ success: false, error: precheck, sourceDate: D });
    const store = deps.createStore();
    let enabled: boolean;
    try { enabled = await store.enabled(); } catch { return res.status(503).json({ success: false, error: "kill_switch_unreadable", sourceDate: D }); }
    if (!enabled) return res.status(200).json({ success: true, skipped: "disabled", sourceDate: D });
    let plan: ReturnType<typeof prepareNativeProcessCapture>, adapter: NativeCaptureAdapterV6;
    try {
      plan = prepareNativeProcessCapture({ seasonId: 20262027, date: D, plannedAtUTC: new Date(deps.now()).toISOString(), groups: ["individual", "onIce"] });
      adapter = deps.createAdapter(D);
    } catch { return res.status(503).json({ success: false, error: "plan_or_adapter_refused", sourceDate: D }); }
    let selfTest: string | null;
    try { selfTest = await deps.selfTest(); } catch { selfTest = "observer_selftest_failed"; }
    if (selfTest) return res.status(503).json({ success: false, error: selfTest, sourceDate: D });
    let claim: Awaited<ReturnType<CaptureStore["claim"]>>;
    try {
      claim = await store.claim({ sourceDate: D, deployment: { deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
        gitCommitSha: /^[0-9a-f]{40}$/.test(process.env.VERCEL_GIT_COMMIT_SHA ?? "") ? process.env.VERCEL_GIT_COMMIT_SHA : null,
        region: /^[a-z0-9-]{1,32}$/.test(process.env.VERCEL_REGION ?? "") ? process.env.VERCEL_REGION : null, invocationOrdinal: ordinal } });
    } catch {
      // The claim outcome is unknown: the backup trigger will see the row if it exists.
      return res.status(503).json({ success: false, error: "claim_unacknowledged", sourceDate: D });
    }
    if (!claim.claimed) return res.status(200).json({ success: true, skipped: "already_claimed", sourceDate: D });
    const runId = claim.runId;
    let sink: PacketSink | undefined;
    try {
      sink = deps.createSink(store, runId, D);
      const result = await deps.run({ plan, sourceDate: D, supabaseOrigin: PINNED_SUPABASE_ORIGIN, runId, routeBundlePath: deps.routeBundlePath, invocationOrdinal: ordinal }, adapter, sink);
      return res.status(200).json({ success: true, state: result.state, sourceDate: D, runId, operationCount: result.operationCount, retained: result.retained });
    } catch (error) {
      if (error instanceof CaptureRunError) {
        return res.status(error.state === "refused_schedule" ? 422 : 500).json({ success: false, state: error.state, reason: error.reason, runClosed: error.closed, sourceDate: D, runId });
      }
      // Sink creation or an unexpected throw: the run row stays claimed; the watchdog reconciles it.
      return res.status(500).json({ success: false, state: "failed", reason: "capture_setup_failed", runClosed: false, sourceDate: D, runId });
    } finally { sink?.dispose(); }
  };
}

export function createDefaultBlshNativeCaptureHandler(routeBundlePath: string | null) {
  return createBlshNativeCaptureHandler({
    now: () => Date.now(),
    precheck: runtimePrecheckV6,
    createStore: () => createCaptureStore({ origin: PINNED_SUPABASE_ORIGIN, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!.trim() }),
    createAdapter: sourceDate => createNativeCaptureAdapterV6({ supabaseOrigin: PINNED_SUPABASE_ORIGIN, sourceDate }),
    createSink: (store, runId, sourceDate) => createPacketSink({ store, runId, sourceDate }),
    run: runNativeCaptureV6,
    selfTest: observerSelfTest,
    routeBundlePath,
  });
}
