import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceRoleClient } from "lib/supabase/server";
import { starterBoardCanaryGameIds, starterBoardFlags } from "lib/projections/starterBoardFlags";
import { publishHostedClaim } from "lib/projections/pregameCapture/hostedPublication";
import { PublicationError } from "lib/projections/pregameCapture/publication";
import { readHostedRsoConsumers, type HostedRsoTarget } from "lib/projections/pregameCapture/hostedReaders";

export const config = { maxDuration: 240, api: { bodyParser: { sizeLimit: "1kb" } } };

function scopeProblem(gameId: number) {
  const flags = starterBoardFlags();
  if (!flags.compute) return "compute_off";
  if (!flags.capture) return "capture_disabled";
  try {
    const ids = starterBoardCanaryGameIds();
    return ids?.length === 1 && ids[0] === gameId ? null : "wrong_game_scope";
  } catch {
    return "wrong_game_scope";
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const enteredAt = Date.now();
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  const id = req.body?.dispatchId;
  if (typeof id !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)
      || Object.keys(req.body).length !== 1 || Object.keys(req.query).length) return res.status(400).end();
  const key = process.env.FORGE_PREGAME_DISPATCH_SECRET;
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (!key || !/^[!-~]{32,}$/.test(key) || !sha || !/^[a-f0-9]{40}$/.test(sha) ||
      process.env.VERCEL_ENV !== "production" || process.env.FORGE_PREGAME_CAPTURE_ENABLED !== "true") return res.status(503).end();
  const signature = req.headers["x-forge-dispatch-signature"];
  if (typeof signature !== "string" || !/^[a-f0-9]{64}$/.test(signature) ||
      !timingSafeEqual(Uint8Array.from(Buffer.from(signature,"hex")), Uint8Array.from(createHmac("sha256",key).update("stage:"+id).digest()))) {
    return res.status(401).end();
  }
  try {
    const db: SupabaseClient = getServiceRoleClient();
    const fence = { p_dispatch_id: id, p_code_version: sha };
    const begin = await db.rpc("forge_hosted_stage_begin_v2",fence).abortSignal(AbortSignal.timeout(5000));
    if (begin.error) return res.status(503).json({ status: "begin_unconfirmed" });
    if (!begin.data) return res.status(409).json({ status: "fenced" });
    const target = begin.data as HostedRsoTarget & { stage: string; queuedAt: string };
    if (target.codeVersion !== sha || !Number.isSafeInteger(target.gameId)) return res.status(409).end();
    const finish = async (reason: string | null, readers: Awaited<ReturnType<typeof readHostedRsoConsumers>> | null = null) => {
      const end = await db.rpc("forge_hosted_stage_finish_v2",{ ...fence, p_reason: reason, p_readers: readers })
        .abortSignal(AbortSignal.timeout(5000));
      if (end.error || !end.data) return res.status(503).json({ status: "finish_unconfirmed" });
      return res.status(200).json({ status: end.data });
    };
    if (target.stage === "preflight") return await finish(scopeProblem(target.gameId));
    if (target.stage === "publish") {
      const refusal = scopeProblem(target.gameId);
      if (refusal) return await finish(refusal);
      try {
        // The publication owner retains all calculation, observation and release checks.
        const endAt = Math.min(enteredAt + 216_000, Date.parse(target.queuedAt) + 216_000, Date.parse(target.scheduledStart));
        if (!Number.isFinite(endAt) || Date.now() + 175_000 >= endAt) return await finish("publication_refused");
        const deadline = AbortSignal.timeout(Math.max(1,endAt - Date.now()));
        const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{
          auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
          global: { fetch: (input,init) => {
            if (Date.now() >= endAt) throw new Error("publication_deadline");
            return fetch(input,{ ...init, signal: init?.signal ? AbortSignal.any([deadline,init.signal]) : deadline });
          } },
        });
        await publishHostedClaim(client,id,target);
      } catch (error) {
        return await finish(error instanceof PublicationError && error.status < 500 ? "publication_refused" : "publication_unconfirmed");
      }
      return await finish(null);
    }
    if (target.stage === "readers") {
      let readers: Awaited<ReturnType<typeof readHostedRsoConsumers>>;
      try { readers = await readHostedRsoConsumers(db,target); }
      catch { return await finish("reader_unavailable"); }
      return await finish(null,readers);
    }
    return res.status(409).end();
  } catch {
    return res.status(503).json({ status: "stage_unconfirmed" });
  }
}
