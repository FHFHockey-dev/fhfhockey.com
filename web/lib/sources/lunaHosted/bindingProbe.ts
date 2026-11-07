import { randomUUID, timingSafeEqual } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { boundedIftttRpc, IFTTT_RPC_DEADLINES, type IftttRpcClient, type IftttRpcQuery } from "../iftttRpcDeadline";

export const BINDING_TARGET = "https://fyhftlxokyjtpndbkfse.supabase.co";
const VERSION = "luna-binding-check-v1";
const timestamp = z.string().datetime().refine(s => Number.isFinite(Date.parse(s)));
const configSchema = z.object({ version: z.literal(VERSION), startsAt: timestamp, expiresAt: timestamp }).strict();
type Env = Record<string, string | undefined>;
type Dependencies = { env: () => Env; client: () => IftttRpcClient; now?: () => number; nonce?: () => string };
type GetRpcQuery = IftttRpcQuery & { method?: unknown; url?: unknown; body?: unknown };
type GetRpcClient = { rpc(name: string, args: Record<string, unknown>, options: { get: true }): GetRpcQuery };
function windowOpen(env: Env, now: number) {
  const raw = env.IFTTT_LUNA_BINDING_CHECK_CONFIG;
  if (env.VERCEL_ENV !== "production" || !raw || raw.length > 1024 || !Number.isFinite(now)
    || env.IFTTT_LUNA_CAPTURE_ENABLED === "true" || env.IFTTT_LUNA_REVIEW_ENABLED === "true") return false;
  try {
    const config = configSchema.parse(JSON.parse(raw));
    const start = Date.parse(config.startsAt), end = Date.parse(config.expiresAt);
    return end > start && end - start <= 3600000 && now >= start && now < end;
  } catch { return false; }
}
function authorized(header: unknown, secret: string | undefined) {
  if (!secret || secret.length < 32 || secret.length > 1024 || typeof header !== "string" || header.length > 4096) return false;
  const expected = new TextEncoder().encode(`Bearer ${secret}`), received = new TextEncoder().encode(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function isPinnedReadOnlyQuery(query: GetRpcQuery, challenge: string) {
  if (query.method !== "GET" || query.body != null || !(query.url instanceof URL)) return false;
  const url = query.url;
  const expected = new Map([
    ["p_action", "luna_binding_probe_v1"],
    ["p_job_id", challenge],
    ["p_payload", "{}"],
  ]);
  if (url.origin !== BINDING_TARGET || url.pathname !== "/rest/v1/rpc/luna_hosted_review_rpc"
    || url.username || url.password || url.hash || url.searchParams.size !== expected.size) return false;
  for (const [key, value] of expected) {
    if (url.searchParams.getAll(key).length !== 1 || url.searchParams.get(key) !== value) return false;
  }
  return true;
}

/** Uses only the pinned SQL's unsupported-action early return. Never route a
 * diagnostic through claim/reserve or add request-controlled database arguments.
 * This is behavioral reachability evidence, not credential metadata inspection.
 */
export function createLunaBindingProbe(deps: Dependencies) {
  const now = deps.now ?? Date.now;
  return async (req: NextApiRequest, res: NextApiResponse) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ status: "method_not_allowed" }); }
    try {
      const env = deps.env(), initialConfig = env.IFTTT_LUNA_BINDING_CHECK_CONFIG;
      if (!windowOpen(env, now())) return res.status(503).json({ status: "disabled" });
      if (!authorized(req.headers.authorization, env.IFTTT_LUNA_WORKER_SECRET)) return res.status(401).json({ status: "unauthorized" });
      if (Object.keys(req.query ?? {}).length || req.body != null || req.headers["transfer-encoding"] !== undefined
        || (req.headers["content-length"] !== undefined && req.headers["content-length"] !== "0")) {
        return res.status(400).json({ status: "invalid_request" });
      }
      if (env.NEXT_PUBLIC_SUPABASE_URL?.trim() !== BINDING_TARGET) return res.status(503).json({ status: "unverified" });
      const challenge = (deps.nonce ?? randomUUID)();
      if (!z.string().uuid().safeParse(challenge).success) throw new Error("invalid_challenge");
      const stillOpen = () => {
        const current = deps.env();
        return current.IFTTT_LUNA_BINDING_CHECK_CONFIG === initialConfig && windowOpen(current, now())
          && current.NEXT_PUBLIC_SUPABASE_URL?.trim() === BINDING_TARGET
          && authorized(req.headers.authorization, current.IFTTT_LUNA_WORKER_SECRET);
      };
      const client = deps.client();
      if (!stillOpen()) return res.status(503).json({ status: "unverified" });
      // Build a GET RPC and inspect its exact transport target before awaiting it.
      // PostgREST executes GET/HEAD requests in read-only mode; never fall back to POST.
      const args = { p_action: "luna_binding_probe_v1", p_job_id: challenge, p_payload: "{}" };
      const query = (client as unknown as GetRpcClient).rpc("luna_hosted_review_rpc", args, { get: true });
      if (!isPinnedReadOnlyQuery(query, challenge)) return res.status(503).json({ status: "unverified" });
      const result = await boundedIftttRpc({ rpc: () => query }, "luna_hosted_review_rpc", args, IFTTT_RPC_DEADLINES.readMs);
      if (!stillOpen() || result.error || !isDeepStrictEqual(result.data, {
        version: "luna-hosted-review-v1", jobId: challenge, status: "refused",
      })) return res.status(503).json({ status: "unverified" });
      return res.status(200).json({ status: "verified", version: VERSION, challenge, checkedAt: new Date(now()).toISOString() });
    } catch {
      // Never serialize exceptions, upstream errors, headers or credentials.
      return res.status(503).json({ status: "unverified" });
    }
  };
}
