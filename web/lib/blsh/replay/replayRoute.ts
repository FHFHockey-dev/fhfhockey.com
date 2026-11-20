/** The BLSH hosted fixture-replay routes (test mode, default off). Each stage is its own cron GET with the production
 * limits of the stage it replays; both are wrapped by the production operational-route auth (adminOnly outermost) with the
 * audit write off, so nothing reaches public.cron_job_audit. Without BLSH_REPLAY_API_TOKEN they refuse before any I/O. */
import type { NextApiRequest, NextApiResponse } from "next";
import { invokedByCron } from "utils/adminOnlyMiddleware";
import { REPLAY_API_SCHEMA, runReplayContext, runReplayNative, type ReplayApi } from "./hostedReplay";

/** The pre-minted sandbox token must claim exactly role blsh_replay_api, be unexpired, and expire within 24 h. */
export function replayApi(): ReplayApi | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(), anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY?.trim();
  const token = process.env.BLSH_REPLAY_API_TOKEN?.trim();
  if (!url || !anonKey || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: unknown; exp?: unknown };
    const now = Date.now() / 1000;
    if (claims.role !== REPLAY_API_SCHEMA || typeof claims.exp !== "number" || claims.exp <= now + 300 || claims.exp > now + 86_400) return null;
  } catch {
    return null;
  }
  return { url, anonKey, token };
}

export function createReplayRoute(stage: "native" | "context") {
  return async function blshReplayRoute(req: NextApiRequest, res: NextApiResponse) {
    const enteredAt = Date.now();
    res.setHeader("Cache-Control", "no-store, max-age=0");
    if (Object.keys(req.query ?? {}).length) return res.status(400).json({ status: "unexpected_parameters" });
    // adminOnly (outer) also admits an admin JWT; the replay itself runs only for the cron bearer, like the native handler's gate 0.
    const authorization = req.headers.authorization ?? "";
    if (!invokedByCron(authorization)) return res.status(403).json({ status: "cron_bearer_required" });
    const sha = process.env.VERCEL_GIT_COMMIT_SHA, deploymentId = process.env.VERCEL_DEPLOYMENT_ID;
    if (process.env.VERCEL_ENV !== "production" || !sha || !/^[a-f0-9]{40}$/.test(sha) || !deploymentId) return res.status(503).json({ status: "release_unpinned" });
    const api = replayApi();
    if (!api) return res.status(503).json({ status: "sandbox_api_unavailable" });
    try {
      const ctx = { api, cronAuthorization: authorization, deploymentId, gitCommitSha: sha, enteredAt };
      const receipt = stage === "native" ? await runReplayNative(ctx) : await runReplayContext(ctx);
      return res.status(200).json({ status: `replay_${stage}_finished`, sha, deploymentId, elapsedMs: Date.now() - enteredAt, receipt });
    } catch (error) {
      const code = error instanceof Error && /^[a-z][a-z0-9_]{2,80}$/.test(error.message) ? error.message : "replay_failed";
      return res.status(503).json({ status: code, sha, deploymentId, elapsedMs: Date.now() - enteredAt });
    }
  };
}
