import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";
import { runPregameCapture } from "lib/projections/pregameCapture/custody";
import { runHostedPregameGame } from "lib/projections/pregameCapture/hostedGame";
import { decodePacket } from "lib/projections/pregameCapture/packet";
import { DEFAULT_CAPTURE_BUDGET, PILOT_TRANSPORT_LIMITS } from "lib/projections/pregameCapture/policy";
import { captureDeps, httpTsaClient } from "lib/projections/pregameCapture/runner";
import { supabaseCaptureRpc } from "lib/projections/pregameCapture/rpc";
import { scheduleReader } from "lib/projections/pregameCapture/scheduleReader";
import { invokedByCron } from "utils/adminOnlyMiddleware";

// Production sandbox smoke test, called once by Supabase Cron like the WGO jobs. It runs the existing FORGE v1 pregame
// capture (pin, collect, save, RFC 3161 witness, custody outcome) for the fixed synthetic fixture in this invocation.
// Every database call goes through the Data API as the role forge_sandbox_api, whose only grants are the views and
// wrappers in the exposed schema forge_sandbox_api. The deployment's own FORGE flags apply unchanged.
export const config = { maxDuration: 240 };

const GAME_ID = 2099020991;
const PLAYER_NHL_ID = 8471001;
const API_SCHEMA = "forge_sandbox_api";
// Capture I/O stops by 200 s from entry; the summary read and receipt RPC end by 230 s, inside the 240 s limit.
const CAPTURE_END_MS = 200_000, SUMMARY_END_MS = 215_000, FINISH_END_MS = 230_000, RPC_MS = 6_000;

type Begin = { status: "started"; gameId: number; slateDate: string; scheduledStart: string; seasonId: number }
  | { status: "duplicate"; receipt: unknown };
type Api = { url: string; key: string; token: string };

/** The pre-minted sandbox token must claim exactly role forge_sandbox_api and be unexpired, with at most 24 h left.
 * The Data API verifies its signature; this check only stops a wrong or stale credential from being used at all. */
function sandboxApi(): Api | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(), key = process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY?.trim();
  const token = process.env.FORGE_SANDBOX_API_TOKEN?.trim();
  if (!url || !key || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: unknown; exp?: unknown };
    const now = Date.now() / 1000;
    if (claims.role !== API_SCHEMA || typeof claims.exp !== "number" || claims.exp <= now + 300 || claims.exp > now + 86_400) return null;
  } catch {
    return null;
  }
  return { url, key, token };
}

/** supabase-js on the sandbox schema only, with the sandbox token as Bearer and every request inside the deadline.
 * For the capture's strict reads (`guarded` = the transport's fetch), the profile header is withheld from the transport,
 * whose existing guard admits only the default profile, and is set again by `pinSandboxProfile` below it. */
function apiClient(api: Api, endAt: number, guarded?: typeof fetch): SupabaseClient {
  const deadline = AbortSignal.timeout(Math.max(1, endAt - Date.now()));
  const base: typeof fetch = guarded ? (input, init) => {
    const headers = new Headers(init?.headers);
    headers.delete("accept-profile");
    headers.delete("content-profile");
    return guarded(input, { ...init, headers });
  } : fetch;
  return createClient(api.url, api.key, {
    db: { schema: API_SCHEMA },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: {
      headers: { Authorization: `Bearer ${api.token}` },
      fetch: (input, init) => {
        if (Date.now() >= endAt) throw new Error("run_deadline");
        return base(input, { ...init, signal: init?.signal ? AbortSignal.any([deadline, init.signal]) : deadline });
      },
    },
  }) as unknown as SupabaseClient;
}

/** The transport's own HTTP call (CaptureWiring.fetchImpl): every strict read is pinned to the sandbox API schema,
 * whatever the request says, so no capture read can resolve in any other schema. */
const pinSandboxProfile: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  headers.delete("content-profile");
  headers.set("accept-profile", API_SCHEMA);
  return fetch(input, { ...init, headers });
};

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
  const api = sandboxApi();
  if (!api) return res.status(503).json({ status: "sandbox_api_unavailable" });
  return run(res, api, sha, enteredAt);
}

async function run(res: NextApiResponse, api: Api, sha: string, enteredAt: number) {
  const db = apiClient(api, enteredAt + FINISH_END_MS);
  let begin: Begin;
  try {
    const result = await db.rpc("forge_sandbox_run_begin_v1", { p_game_id: GAME_ID, p_code_version: sha }).abortSignal(AbortSignal.timeout(RPC_MS));
    if (result.error || !result.data) return res.status(503).json({ status: "begin_unconfirmed", sha });
    begin = result.data as Begin;
  } catch {
    return res.status(503).json({ status: "begin_unconfirmed", sha });
  }
  if (begin.status === "duplicate") return res.status(409).json({ status: "duplicate", sha, receipt: begin.receipt });
  if (begin.status !== "started" || begin.gameId !== GAME_ID) return res.status(503).json({ status: "begin_unconfirmed", sha });

  let reason: string | null = null, claimId: string | null = null, summary: Record<string, unknown> | null = null;
  try {
    const captureEnd = enteredAt + CAPTURE_END_MS;
    const capture = await runHostedPregameGame({
      gameId: GAME_ID, slateDate: begin.slateDate, scheduledStart: begin.scheduledStart, safeStart: begin.scheduledStart, codeVersion: sha,
    }, {
      // The deployment's flags as they are. Only the Supabase connection settings are replaced by inert labels, because
      // every connection below is the sandbox API client instead; no service-role credential is ever read.
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "sandbox-api", SUPABASE_SERVICE_ROLE_KEY: "unused-forge-sandbox" },
      signal: AbortSignal.timeout(Math.max(1, captureEnd - Date.now())),
      readSchedule: async (_url, _key, target, signal) => scheduleReader(apiClient(api, captureEnd), [target.gameId], target.slateDate, signal)(),
      runCapture: (config, target) => runPregameCapture(captureDeps({
        writer: supabaseCaptureRpc(apiClient(api, captureEnd), DEFAULT_CAPTURE_BUDGET.rpcMs),
        verifier: supabaseCaptureRpc(apiClient(api, captureEnd), DEFAULT_CAPTURE_BUDGET.rpcMs),
        tsa: httpTsaClient(config.tsaUrl), trust: config.tsaTrust,
        // Strict input reads keep the transport's guarded fetch: GET/HEAD only, allowlisted relations and RPCs.
        createReadClient: guarded => apiClient(api, captureEnd, guarded) as never,
        restBaseUrl: `${api.url.replace(/\/+$/, "")}/rest/v1`, collectNative: config.collectNative, seasonBootstrap: config.seasonBootstrap,
        modelEnvironment: config.modelEnvironment, budget: { ...DEFAULT_CAPTURE_BUDGET, ...config.budget },
        transportLimits: { ...PILOT_TRANSPORT_LIMITS, ...config.transportLimits }, now: Date.now, fetchImpl: pinSandboxProfile,
      }), target),
    });
    claimId = capture.claimId;
    if (capture.outcome !== "qualified" || !claimId) reason = capture.reason ?? capture.outcome ?? "capture_unconfirmed";
    if (claimId) {
      // What the qualified packet froze for this fixture: the FORGE candidate set and model environment, not just hashes.
      const row = await supabaseCaptureRpc(apiClient(api, enteredAt + SUMMARY_END_MS), RPC_MS).read(claimId).catch(() => null);
      if (row?.packetBase64) {
        const { packet } = decodePacket(Uint8Array.from(Buffer.from(row.packetBase64, "base64")));
        summary = {
          candidates: { skaters: packet.candidates.skaters.length, goalies: packet.candidates.goalies.length, reserves: packet.candidates.reserves.length },
          includesPlayer: { [PLAYER_NHL_ID]: packet.candidates.skaters.includes(PLAYER_NHL_ID) },
          reads: packet.reads.length, transport: packet.transport, readWindow: packet.readWindow, statedCutoff: packet.statedCutoff,
          seasonBootstrapApplied: packet.seasonBootstrapApplied, modelEnvironment: packet.modelEnvironment,
        };
      }
    }
  } catch {
    reason ??= "run_deadline";
  }

  const elapsedMs = Date.now() - enteredAt;
  const finishMs = Math.min(RPC_MS, enteredAt + FINISH_END_MS - Date.now());
  const body = { sha, gameId: GAME_ID, claimId, summary, elapsedMs };
  if (finishMs <= 0) return res.status(503).json({ status: "finish_unconfirmed", reason, ...body });
  try {
    const finish = await db.rpc("forge_sandbox_run_finish_v1", {
      p_game_id: GAME_ID, p_code_version: sha, p_reason: reason, p_claim_id: claimId, p_summary: summary, p_elapsed_ms: elapsedMs,
    }).abortSignal(AbortSignal.timeout(finishMs));
    const receipt = finish.data as { outcome?: string; reason?: string } | null;
    if (finish.error || !receipt?.outcome) return res.status(503).json({ status: "finish_unconfirmed", reason, ...body });
    return res.status(receipt.outcome === "succeeded" ? 200 : 503).json({ status: receipt.outcome, reason: receipt.reason, ...body, receipt });
  } catch {
    return res.status(503).json({ status: "finish_unconfirmed", reason, ...body });
  }
}
