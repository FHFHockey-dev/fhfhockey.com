import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";
import { hostedComputeGameId, runHostedPregameGame, type HostedPregameResult } from "lib/projections/pregameCapture/hostedGame";
import { HOSTED_V2_TIMING, POLICY_ID } from "lib/projections/pregameCapture/policy";
import { parseInstantMicros } from "lib/projections/pregameCapture/time";
import type { TerminalOutcome } from "lib/projections/pregameCapture/rpc";
import { getServiceRoleClient } from "lib/supabase/server";

export const config = { maxDuration: 420, api: { bodyParser: { sizeLimit: "1kb" } } };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type DispatchReceipt = { status: string; outcome: TerminalOutcome | "unresolved" | null };
type BeginReceipt = DispatchReceipt & {
  queued_at?: string; db_now?: string;
  game_id: number; policy_id: string; slate_date: string; scheduled_start: string; current_scheduled_start: string;
};

function validSignature(message: string, signature: string | string[] | undefined, secret: string): boolean {
  if (typeof signature !== "string" || signature.length !== 64 || !/^[0-9a-f]+$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(message).digest();
  return timingSafeEqual(Uint8Array.from(expected), Uint8Array.from(Buffer.from(signature, "hex")));
}

function outcomeStatus(outcome: string | null): number {
  if (outcome === "qualified") return 200;
  if (outcome === "never_dispatched") return 409;
  return outcome === null ? 202 : 503;
}

export async function handleHostedCapture(req: NextApiRequest, res: NextApiResponse, version: 1 | 2) {
  const enteredAt = Date.now();
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ status: "method_not_allowed" });
  }

  const dispatchId = req.body?.dispatchId;
  if (typeof dispatchId !== "string" || !uuid.test(dispatchId) || Object.keys(req.body).length !== 1) {
    return res.status(400).json({ status: "invalid_dispatch" });
  }
  const secret = process.env.FORGE_PREGAME_DISPATCH_SECRET;
  if (!secret || !/^[!-~]{32,}$/.test(secret)) return res.status(503).json({ status: "dispatch_key_unavailable" });
  if (!validSignature(version === 2 ? `capture-v2:${dispatchId}` : dispatchId, req.headers["x-forge-dispatch-signature"], secret)) {
    return res.status(401).json({ status: "invalid_signature" });
  }
  const codeVersion = process.env.VERCEL_GIT_COMMIT_SHA;
  if (process.env.FORGE_PREGAME_CAPTURE_ENABLED !== "true" || process.env.VERCEL_ENV !== "production" ||
      !codeVersion || !/^[a-f0-9]{40}$/.test(codeVersion)) {
    return res.status(503).json({ status: "capture_disabled" });
  }

  const computeGameId = version === 2 ? hostedComputeGameId(process.env) : null;
  if (version === 2 && computeGameId === null) return res.status(503).json({ status: "compute_scope_disabled" });
  const fence = { p_dispatch_id: dispatchId, p_code_version: codeVersion };
  try {
    const db: SupabaseClient = getServiceRoleClient();
    const begin = await (version === 2
      ? db.rpc("forge_pregame_hosted_begin_v2", { ...fence, p_compute_enabled: true, p_compute_game_id: computeGameId })
      : db.rpc("forge_pregame_hosted_begin_v1", fence)
    ).abortSignal(AbortSignal.timeout(version === 2 ? HOSTED_V2_TIMING.dispatchRpcMs : 10_000)).single<BeginReceipt>();
    if (begin.error || !begin.data) return res.status(503).json({ status: "begin_unconfirmed" });
    const job = begin.data;
    if (job.status === "duplicate") {
      return res.status(outcomeStatus(job.outcome)).json({ status: "duplicate", outcome: job.outcome });
    }
    if (job.status !== "started") {
      const refused = ["not_found", "pin_mismatch", "disabled", "schedule_changed", "window_missed", "load_gate_closed", "custody_exists", "compute_scope_disabled", "compute_off", "wrong_game_scope"];
      if (!refused.includes(job.status)) return res.status(503).json({ status: "begin_unconfirmed" });
      if (job.outcome) return res.status(outcomeStatus(job.outcome)).json({ status: job.status, outcome: job.outcome });
      return res.status(job.status === "not_found" ? 404 : 409).json({ status: job.status });
    }

    // A lost response may conceal a committed claim or save. Only a confirmed finish may return a terminal result.
    let result: HostedPregameResult = { claimId: null, outcome: null, reason: "capture_unconfirmed", stopTrigger: "ambiguous_game" };
    let queueAnchor = enteredAt;
    if (version === 2) {
      if (!job.queued_at || !job.db_now) throw new Error("capture_clock_missing");
      const queued = Number(parseInstantMicros(job.queued_at) / BigInt(1000));
      const observed = Number((parseInstantMicros(job.db_now, "ceil") + BigInt(999)) / BigInt(1000));
      if (observed < queued) throw new Error("capture_clock_invalid");
      // Account for both startup and database queue time, even with an offset between the two hosts' clocks.
      queueAnchor = Math.min(queued, enteredAt - (observed - queued));
    }
    const controller = new AbortController();
    if ((version === 1 || job.game_id === computeGameId) && job.policy_id === POLICY_ID && Number.isSafeInteger(job.game_id) && job.game_id > 0 &&
        typeof job.slate_date === "string" && typeof job.scheduled_start === "string" && typeof job.current_scheduled_start === "string") {
      try {
        result = await runHostedPregameGame({
          gameId: job.game_id, slateDate: job.slate_date, scheduledStart: job.scheduled_start,
          safeStart: job.current_scheduled_start, codeVersion,
          ...(version === 2 ? { hostedV2: { dispatchId, workDeadlineMs: queueAnchor + HOSTED_V2_TIMING.workMs } } : {}),
        }, version === 2 ? { signal: controller.signal } : undefined);
      } catch {
        // The durable dispatch stays fenced. Its finish records the unresolved outcome.
      } finally {
        controller.abort();
      }
    }
    const outcome = result.outcome ?? "unresolved";
    const finishMs = version === 2
      ? Math.min(HOSTED_V2_TIMING.dispatchRpcMs, queueAnchor + HOSTED_V2_TIMING.finishMs - Date.now())
      : 10_000;
    if (finishMs <= 0) return res.status(503).json({ status: "finish_unconfirmed" });
    const finish = await db.rpc("forge_pregame_hosted_finish_v1", {
      ...fence, p_outcome: outcome, p_reason: result.reason, p_stop_trigger: result.stopTrigger,
    }).abortSignal(AbortSignal.timeout(finishMs)).single<DispatchReceipt>();
    if (finish.error || finish.data?.outcome !== outcome || !["finished", "duplicate"].includes(finish.data.status)) {
      return res.status(503).json({ status: "finish_unconfirmed" });
    }
    return res.status(outcomeStatus(outcome)).json({ status: "finished", outcome, reason: result.reason });
  } catch {
    return res.status(503).json({ status: "dispatch_unconfirmed" });
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handleHostedCapture(req, res, 1);
}
