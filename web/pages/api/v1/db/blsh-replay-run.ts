// BLSH v6 hosted fixture replay (test mode), called once by Supabase Cron like the FORGE sandbox GET.
// In one invocation: the real v6 native handler/core/sink/store over the hash-pinned frozen 2026-11-19 slate (fixture
// transport, gate clock 2026-11-20T12:05:03Z), the real request-context handler/store with an in-memory test key, and the
// held readers. Every database call goes through the Data API as the role blsh_replay_api, whose only grants are the
// wrappers in the exposed schema blsh_replay_api. It never reads SUPABASE_SERVICE_ROLE_KEY and never contacts NHL or NST.
// See tasks/artifacts/blsh-replay-2026-11-20/hosted/.
import type { NextApiRequest, NextApiResponse } from "next";
import { invokedByCron } from "utils/adminOnlyMiddleware";
import { REPLAY_API_SCHEMA, runHostedReplay, type ReplayApi } from "lib/blsh/replay/hostedReplay";

// 300, distinct from every other route, so Vercel bundles this route as its own function.
export const config = { maxDuration: 300 };
/** The request-context stage starts only if the native stage finished by then: 60 s + its own 225 s budget < 300 s. */
const CONTEXT_CUTOFF_MS = 60_000;

/** The pre-minted sandbox token must claim exactly role blsh_replay_api, be unexpired, and expire within 24 h. */
function replayApi(): ReplayApi | null {
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const enteredAt = Date.now();
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ status: "method_not_allowed" });
  }
  if (Object.keys(req.query ?? {}).length) return res.status(400).json({ status: "unexpected_parameters" });
  const authorization = req.headers.authorization ?? "";
  if (!invokedByCron(authorization)) return res.status(401).json({ status: "unauthorized" });
  const sha = process.env.VERCEL_GIT_COMMIT_SHA, deploymentId = process.env.VERCEL_DEPLOYMENT_ID;
  if (process.env.VERCEL_ENV !== "production" || !sha || !/^[a-f0-9]{40}$/.test(sha) || !deploymentId) return res.status(503).json({ status: "release_unpinned" });
  const api = replayApi();
  if (!api) return res.status(503).json({ status: "sandbox_api_unavailable" });
  try {
    const receipt = await runHostedReplay({ api, cronAuthorization: authorization, deploymentId, gitCommitSha: sha, enteredAt, contextCutoffMs: CONTEXT_CUTOFF_MS });
    return res.status(200).json({ status: "replay_finished", sha, receipt });
  } catch (error) {
    const code = error instanceof Error && /^[a-z][a-z0-9_]{2,80}$/.test(error.message) ? error.message : "replay_failed";
    return res.status(503).json({ status: code, sha, elapsedMs: Date.now() - enteredAt });
  }
}
