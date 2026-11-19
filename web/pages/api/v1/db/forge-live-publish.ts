import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";
import { withForgeEnv } from "lib/projections/forgeEnvScope";
import { HOSTED_RSO_CONTEXT, readHostedRsoConsumers } from "lib/projections/pregameCapture/hostedReaders";
import { PublicationError, publishQualifiedPregameCapture } from "lib/projections/pregameCapture/publication";
import { getServiceRoleClient } from "lib/supabase/server";
import { invokedByCron } from "utils/adminOnlyMiddleware";

// Live, game-scoped FORGE publication, fired once by its own Supabase Cron job after the independent verdict deadline.
// It publishes exactly once from the armed run's qualified claim (same release as the capture), then reads that committed
// revision through both RSO readers for the approved player. The database refuses publication without an accepted
// verdict by T−60 (require_live_verdict_v1), after puck drop, after a stop, or for any other claim.
export const config = { maxDuration: 240 };
const PUBLISH_END_MS = 200_000, READERS_END_MS = 222_000, RPC_MS = 6_000;

type Begin = { status: string; gameId?: number; claimId?: string; slateDate?: string; scheduledStart?: string; seasonId?: number; playerNhlId?: number };
type Readers = Awaited<ReturnType<typeof readHostedRsoConsumers>>;

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
    const result = await db.rpc("forge_live_publish_begin_v1", { p_code_version: sha }).abortSignal(AbortSignal.timeout(RPC_MS));
    if (result.error || !result.data) return res.status(503).json({ status: "begin_unconfirmed", sha });
    begin = result.data as Begin;
  } catch {
    return res.status(503).json({ status: "begin_unconfirmed", sha });
  }
  if (begin.status !== "started" || !Number.isSafeInteger(begin.gameId) || !begin.claimId || !begin.slateDate || !begin.scheduledStart
      || !Number.isSafeInteger(begin.playerNhlId)) return res.status(409).json({ status: begin.status, sha });
  const gameId = begin.gameId!, claimId = begin.claimId!;
  const scope = { STARTER_BOARD_COMPUTE_ENABLED: "true", STARTER_BOARD_SERVING_ENABLED: "true", STARTER_BOARD_CANARY_GAME_IDS: String(gameId) };
  const stages: Record<string, number> = {};
  const { reason, revisionId, readers } = await withForgeEnv(scope, async () => {
    let revision: string | null = null, observedAt = "", read: Readers | null = null, why: string | null = null;
    const started = Date.now();
    try {
      const published = await publishQualifiedPregameCapture({ claimId, gameId, codeVersion: sha });
      revision = published.revisionId;
      observedAt = published.observedAt;
    } catch (error) {
      why = error instanceof PublicationError && error.status < 500 ? error.message : "publication_unconfirmed";
    }
    stages.publishMs = Date.now() - started;
    if (!why && Date.now() < enteredAt + PUBLISH_END_MS) {
      const lead = Date.parse(observedAt) + 2 - Date.now();
      if (lead > 0 && lead <= 5_002) await new Promise(resolve => setTimeout(resolve, lead));
      const readersStarted = Date.now();
      read = await readHostedRsoConsumers(db, {
        contextId: HOSTED_RSO_CONTEXT, playerNhlId: begin.playerNhlId!, seasonId: Number(begin.seasonId), gameId,
        slateDate: begin.slateDate!, scheduledStart: begin.scheduledStart!, claimId, revisionId: revision!, codeVersion: sha, observedAt,
      });
      stages.readersMs = Date.now() - readersStarted;
    } else if (!why) why = "run_deadline";
    return { reason: why, revisionId: revision, readers: read };
  });
  const elapsedMs = Date.now() - enteredAt;
  const finishMs = Math.min(RPC_MS, enteredAt + READERS_END_MS + 8_000 - Date.now());
  const body = { sha, gameId, claimId, revisionId, readers, stages, elapsedMs };
  if (finishMs <= 0) return res.status(503).json({ status: "finish_unconfirmed", reason, ...body });
  try {
    const finish = await db.rpc("forge_live_publish_finish_v1", {
      p_game: gameId, p_code_version: sha, p_revision_id: revisionId, p_readers: readers, p_reason: reason,
    }).abortSignal(AbortSignal.timeout(finishMs));
    const receipt = finish.data as { outcome?: string; reason?: string } | null;
    if (finish.error || !receipt?.outcome) return res.status(503).json({ status: "finish_unconfirmed", reason, ...body });
    return res.status(receipt.outcome === "succeeded" ? 200 : 503).json({ status: receipt.outcome, reason: receipt.reason, ...body, receipt });
  } catch {
    return res.status(503).json({ status: "finish_unconfirmed", reason, ...body });
  }
}
