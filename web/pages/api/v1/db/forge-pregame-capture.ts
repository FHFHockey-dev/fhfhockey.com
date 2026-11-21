import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";
import { runHostedPregameGame, type HostedPregameResult } from "lib/projections/pregameCapture/hostedGame";
import { POLICY_ID } from "lib/projections/pregameCapture/policy";
import type { TerminalOutcome } from "lib/projections/pregameCapture/rpc";
import { getServiceRoleClient } from "lib/supabase/server";

export const config = { maxDuration: 420, api: { bodyParser: { sizeLimit: "1kb" } } };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type DispatchReceipt = { status: string; outcome: TerminalOutcome | "unresolved" | null };
type BeginReceipt = DispatchReceipt & {
  game_id: number; policy_id: string; slate_date: string; scheduled_start: string; current_scheduled_start: string;
};

function validSignature(dispatchId: string, signature: string | string[] | undefined, secret: string): boolean {
  if (typeof signature !== "string" || signature.length !== 64 || !/^[0-9a-f]+$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(dispatchId).digest();
  return timingSafeEqual(Uint8Array.from(expected), Uint8Array.from(Buffer.from(signature, "hex")));
}

function outcomeStatus(outcome: string | null): number {
  if (outcome === "qualified") return 200;
  if (outcome === "never_dispatched") return 409;
  return outcome === null ? 202 : 503;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
  if (!validSignature(dispatchId, req.headers["x-forge-dispatch-signature"], secret)) {
    return res.status(401).json({ status: "invalid_signature" });
  }
  const codeVersion = process.env.VERCEL_GIT_COMMIT_SHA;
  if (process.env.FORGE_PREGAME_CAPTURE_ENABLED !== "true" || process.env.VERCEL_ENV !== "production" ||
      !codeVersion || !/^[a-f0-9]{40}$/.test(codeVersion)) {
    return res.status(503).json({ status: "capture_disabled" });
  }

  const fence = { p_dispatch_id: dispatchId, p_code_version: codeVersion };
  try {
    const db: SupabaseClient = getServiceRoleClient();
    const begin = await db.rpc("forge_pregame_hosted_begin_v1", fence).abortSignal(AbortSignal.timeout(10_000)).single<BeginReceipt>();
    if (begin.error || !begin.data) return res.status(503).json({ status: "begin_unconfirmed" });
    const job = begin.data;
    if (job.status === "duplicate") {
      return res.status(outcomeStatus(job.outcome)).json({ status: "duplicate", outcome: job.outcome });
    }
    if (job.status !== "started") {
      const refused = ["not_found", "pin_mismatch", "disabled", "schedule_changed", "window_missed", "load_gate_closed", "custody_exists"];
      if (!refused.includes(job.status)) return res.status(503).json({ status: "begin_unconfirmed" });
      if (job.outcome) return res.status(outcomeStatus(job.outcome)).json({ status: job.status, outcome: job.outcome });
      return res.status(job.status === "not_found" ? 404 : 409).json({ status: job.status });
    }

    // A lost response may conceal a committed claim or save. Only a confirmed finish may return a terminal result.
    let result: HostedPregameResult = { claimId: null, outcome: null, reason: "capture_unconfirmed", stopTrigger: "ambiguous_game" };
    if (job.policy_id === POLICY_ID && Number.isSafeInteger(job.game_id) && job.game_id > 0 &&
        typeof job.slate_date === "string" && typeof job.scheduled_start === "string" && typeof job.current_scheduled_start === "string") {
      try {
        result = await runHostedPregameGame({
          gameId: job.game_id, slateDate: job.slate_date, scheduledStart: job.scheduled_start,
          safeStart: job.current_scheduled_start, codeVersion,
        });
      } catch {
        // The durable dispatch stays fenced. Its finish records the unresolved outcome.
      }
    }
    const outcome = result.outcome ?? "unresolved";
    const finish = await db.rpc("forge_pregame_hosted_finish_v1", {
      ...fence, p_outcome: outcome, p_reason: result.reason, p_stop_trigger: result.stopTrigger,
    }).abortSignal(AbortSignal.timeout(10_000)).single<DispatchReceipt>();
    if (finish.error || finish.data?.outcome !== outcome || !["finished", "duplicate"].includes(finish.data.status)) {
      return res.status(503).json({ status: "finish_unconfirmed" });
    }
    return res.status(outcomeStatus(outcome)).json({ status: "finished", outcome, reason: result.reason });
  } catch {
    return res.status(503).json({ status: "dispatch_unconfirmed" });
  }
}
