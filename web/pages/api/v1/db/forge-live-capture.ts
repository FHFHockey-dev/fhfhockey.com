import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";
import { withForgeEnv } from "lib/projections/forgeEnvScope";
import { runHostedPregameGame } from "lib/projections/pregameCapture/hostedGame";
import { getServiceRoleClient } from "lib/supabase/server";
import { invokedByCron } from "utils/adminOnlyMiddleware";

// Live, game-scoped FORGE pregame capture, fired once by its own Supabase Cron job. The game, player and release come
// only from the operator's armed approval row (forge_pregame_capture.live_runs); nothing is read from the URL. The
// capture's flags apply only to that game and only inside this request (withForgeEnv); the deployment's flags, the
// daily FORGE run and public serving are unchanged.
export const config = { maxDuration: 240 };
const CAPTURE_END_MS = 215_000, RPC_MS = 6_000;

type Begin = { status: string; gameId?: number; slateDate?: string; scheduledStart?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const enteredAt = Date.now();
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ status: "method_not_allowed" });
  }
  if (Object.keys(req.query ?? {}).length) return res.status(400).json({ status: "unexpected_parameters" });
  if (!invokedByCron(req.headers.authorization ?? "")) return res.status(401).json({ status: "unauthorized" });
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (process.env.VERCEL_ENV !== "production" || !sha || !/^[a-f0-9]{40}$/.test(sha)) return res.status(503).json({ status: "release_unpinned" });

  const db: SupabaseClient = getServiceRoleClient();
  let begin: Begin;
  try {
    const result = await db.rpc("forge_live_capture_begin_v1", { p_code_version: sha }).abortSignal(AbortSignal.timeout(RPC_MS));
    if (result.error || !result.data) return res.status(503).json({ status: "begin_unconfirmed", sha });
    begin = result.data as Begin;
  } catch {
    return res.status(503).json({ status: "begin_unconfirmed", sha });
  }
  if (begin.status !== "started" || !Number.isSafeInteger(begin.gameId) || !begin.slateDate || !begin.scheduledStart) {
    return res.status(409).json({ status: begin.status, sha });
  }
  const gameId = begin.gameId!;
  const scope = { STARTER_BOARD_COMPUTE_ENABLED: "true", STARTER_BOARD_SERVING_ENABLED: "true", STARTER_BOARD_CANARY_GAME_IDS: String(gameId) };
  const capture = await withForgeEnv(scope, () => runHostedPregameGame({
    gameId, slateDate: begin.slateDate!, scheduledStart: begin.scheduledStart!, safeStart: begin.scheduledStart!, codeVersion: sha,
  }, { signal: AbortSignal.timeout(Math.max(1, enteredAt + CAPTURE_END_MS - Date.now())) }))
    .catch(() => ({ claimId: null, outcome: null, reason: "capture_unconfirmed" as const, stopTrigger: null }));
  const elapsedMs = Date.now() - enteredAt;
  try {
    // With no claim the database records the run as unresolved or failed; it never retries.
    const finish = await db.rpc("forge_live_capture_finish_v1", {
      p_game: gameId, p_code_version: sha, p_claim_id: capture.claimId, p_reason: capture.outcome === "qualified" ? null : capture.reason ?? capture.outcome,
    }).abortSignal(AbortSignal.timeout(RPC_MS));
    const receipt = finish.data as { custody?: string | null } | null;
    if (finish.error || !receipt) return res.status(503).json({ status: "finish_unconfirmed", sha, gameId, claimId: capture.claimId, elapsedMs });
    return res.status(receipt.custody === "qualified" ? 200 : 503)
      .json({ status: receipt.custody === "qualified" ? "captured" : "not_qualified", sha, gameId, claimId: capture.claimId, elapsedMs, receipt });
  } catch {
    return res.status(503).json({ status: "finish_unconfirmed", sha, gameId, claimId: capture.claimId, elapsedMs });
  }
}
