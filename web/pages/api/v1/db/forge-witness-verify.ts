import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";
import { reviewWitnessEvidence, type ReadyEvidence } from "lib/projections/pregameCapture/independentVerdict";
import type { TsaTrust } from "lib/projections/pregameCapture/rfc3161";
import { tsaProfile, trustFromProfile } from "lib/projections/pregameCapture/tsaProfiles";
import { invokedByCron } from "utils/adminOnlyMiddleware";

// Independent FORGE verifier, called by its own one-shot Supabase Cron job. It is not part of the FORGE writer: it reads
// each armed game's committed claim back through the exposed schema forge_witness_api as the NOLOGIN role
// forge_witness_api, re-verifies the bytes, bindings, cutoff and the retained RFC 3161 token against the released
// DigiCert pin, and records its own verdict, which the database re-checks and timestamps. Only an accepted verdict at or
// before T−60 lets publication proceed.
//
// Credentials: the cron secret (Authorization) AND the verifier's own short-lived token in x-forge-witness-token. The
// token lives only in forge_witness.credentials, which nothing but the verifier's cron fire function (running as the
// installer) can read; it is never in Vercel env or Vault, both of which the writer can reach. The token is used only
// as this request's Data API bearer and is never echoed, logged or returned.
export const config = { maxDuration: 60 };

const API_SCHEMA = "forge_witness_api";
const RUN_MS = 50_000, RPC_MS = 15_000;
/** The released trust profile. Pinned here on purpose: no environment variable can select another. */
const TSA_PROFILE_ID = "digicert-g4-v1";

type Api = { url: string; key: string; token: string };
type GameResult = { gameId: number; status: string; claimId?: string; verdict?: string; reason?: string | null;
  independent?: { verdict: string; reason: string | null }; verifiedAt?: string; deadlineAt?: string };

const TOKEN_HEADER = "x-forge-witness-token";

/** The x-forge-witness-token header must hold exactly one JWT claiming role forge_witness_api, unexpired, with at most
 * 12 h left. The Data API verifies its signature; this check only stops a wrong or stale credential from being used. */
function witnessApi(header: string | string[] | undefined): Api | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(), key = process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY?.trim();
  if (!url || !key || typeof header !== "string" || header.length > 4096) return null;
  const token = header.trim();
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: unknown; exp?: unknown };
    const now = Date.now() / 1000;
    if (claims.role !== API_SCHEMA || typeof claims.exp !== "number" || claims.exp <= now + 60 || claims.exp > now + 43_200) return null;
  } catch {
    return null;
  }
  return { url, key, token };
}

function apiClient(api: Api, endAt: number): SupabaseClient {
  return createClient(api.url, api.key, {
    db: { schema: API_SCHEMA },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: {
      headers: { Authorization: `Bearer ${api.token}` },
      fetch: (input, init) => {
        if (Date.now() >= endAt) throw new Error("run_deadline");
        const signal = AbortSignal.timeout(Math.max(1, Math.min(RPC_MS, endAt - Date.now())));
        return fetch(input, { ...init, redirect: "error", signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal });
      },
    },
  }) as unknown as SupabaseClient;
}

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
  // Both credentials, always: a cron-secret-only caller (e.g. anything holding the project's env) is refused here.
  const api = witnessApi(req.headers[TOKEN_HEADER]);
  if (!api) return res.status(401).json({ status: "witness_credential_required" });
  let trust: TsaTrust;
  try {
    trust = trustFromProfile(tsaProfile(TSA_PROFILE_ID), "capture");
  } catch {
    return res.status(503).json({ status: "trust_unavailable" });
  }

  const db = apiClient(api, enteredAt + RUN_MS);
  let pending: number[];
  try {
    const result = await db.rpc("pending_v1");
    if (result.error || !Array.isArray(result.data)) return res.status(503).json({ status: "pending_unconfirmed", sha });
    pending = (result.data as unknown[]).filter((id): id is number => Number.isSafeInteger(id) && (id as number) > 0);
  } catch {
    return res.status(503).json({ status: "pending_unconfirmed", sha });
  }
  if (!pending.length) return res.status(200).json({ status: "idle", sha, results: [] });

  const results: GameResult[] = [];
  for (const gameId of pending) results.push(await verifyGame(db, gameId, trust, sha));
  const unconfirmed = results.some(r => r.status.endsWith("_unconfirmed"));
  return res.status(unconfirmed ? 503 : 200).json({ status: unconfirmed ? "partially_unconfirmed" : "ok", sha, results,
    elapsedMs: Date.now() - enteredAt });
}

async function verifyGame(db: SupabaseClient, gameId: number, trust: TsaTrust, sha: string): Promise<GameResult> {
  let evidence: { status: string; claimId?: string; verdict?: { verdict: string; reason: string | null }; claim?: { id: string } };
  try {
    const result = await db.rpc("evidence_v1", { p_game_id: gameId });
    if (result.error || !result.data || typeof result.data.status !== "string") return { gameId, status: "evidence_unconfirmed" };
    evidence = result.data;
  } catch {
    return { gameId, status: "evidence_unconfirmed" };
  }
  // claim_missing / not_terminal decide nothing: the claim may still arrive, so the target stays pending.
  if (evidence.status === "decided") return { gameId, status: "duplicate", verdict: evidence.verdict?.verdict, reason: evidence.verdict?.reason };
  if (evidence.status !== "ready") return { gameId, status: evidence.status, claimId: evidence.claimId };

  let review: ReturnType<typeof reviewWitnessEvidence>;
  try {
    review = reviewWitnessEvidence(evidence as unknown as ReadyEvidence, gameId, trust);
  } catch {
    return { gameId, status: "schedule_unavailable", claimId: evidence.claim?.id };
  }
  try {
    const result = await db.rpc("record_v1", {
      p_game_id: gameId, p_claim_id: review.claimId, p_verdict: review.verdict, p_reason: review.reason, p_raw_sha256: review.rawSha256,
      p_canonical_sha256: review.canonicalSha256, p_tsa_token_sha256: review.tsaTokenSha256, p_statement_sha256: review.statementSha256,
      p_input_cutoff: review.inputCutoff, p_release: sha,
    });
    const row = result.data?.verdict;
    if (result.error || !row || typeof row.verdict !== "string") {
      return { gameId, status: "record_unconfirmed", claimId: review.claimId, independent: { verdict: review.verdict, reason: review.reason } };
    }
    return { gameId, status: result.data.created ? "recorded" : "duplicate", claimId: row.claim_id, verdict: row.verdict, reason: row.reason,
      independent: { verdict: review.verdict, reason: review.reason }, verifiedAt: row.verified_at, deadlineAt: row.deadline_at };
  } catch {
    return { gameId, status: "record_unconfirmed", claimId: review.claimId, independent: { verdict: review.verdict, reason: review.reason } };
  }
}
