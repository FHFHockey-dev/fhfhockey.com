import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";
import { withForgeEnv, forgeEnv } from "lib/projections/forgeEnvScope";
import { runPregameCapture } from "lib/projections/pregameCapture/custody";
import { runHostedPregameGame } from "lib/projections/pregameCapture/hostedGame";
import { decodePacket } from "lib/projections/pregameCapture/packet";
import { DEFAULT_CAPTURE_BUDGET, PILOT_TRANSPORT_LIMITS } from "lib/projections/pregameCapture/policy";
import { HOSTED_RSO_CONTEXT, readHostedRsoConsumers } from "lib/projections/pregameCapture/hostedReaders";
import { PublicationError, publishQualifiedPregameCapture } from "lib/projections/pregameCapture/publication";
import { captureDeps, httpTsaClient } from "lib/projections/pregameCapture/runner";
import { supabaseCaptureRpc } from "lib/projections/pregameCapture/rpc";
import { scheduleReader } from "lib/projections/pregameCapture/scheduleReader";
import { invokedByCron } from "utils/adminOnlyMiddleware";

// Production sandbox run, called once by Supabase Cron like the WGO jobs. In this one invocation it runs the existing
// FORGE v1 pregame capture for the fixed synthetic fixture, publishes exactly once from that qualified claim with the
// real FORGE publisher, and reads the committed revision back through both real RSO readers. Every database call goes
// through the Data API as the role forge_sandbox_api, whose only grants are the views and wrappers in the exposed schema
// forge_sandbox_api. The fixture's three flags apply only inside this request's own async scope (withForgeEnv);
// the deployment's environment is never modified.
export const config = { maxDuration: 240 };

const GAME_ID = 2099020991;
const PLAYER_NHL_ID = 8471001;
const API_SCHEMA = "forge_sandbox_api";
// Offsets from entry. Capture ≤150 s, publication ≤205 s, readers ≤222 s, receipt RPC ≤230 s: inside the 240 s limit.
const CAPTURE_END_MS = 150_000, SUMMARY_END_MS = 155_000, PUBLISH_END_MS = 205_000, READERS_END_MS = 222_000, FINISH_END_MS = 230_000;
const RPC_MS = 6_000;
/** The fixture's flags, layered over the deployment's for this request only. Production keeps compute and serving off. */
const FIXTURE_FLAGS = { STARTER_BOARD_COMPUTE_ENABLED: "true", STARTER_BOARD_SERVING_ENABLED: "true",
  STARTER_BOARD_CANARY_GAME_IDS: String(GAME_ID) } as const;

type Begin = { status: "started"; gameId: number; slateDate: string; scheduledStart: string; seasonId: number }
  | { status: "duplicate"; receipt: unknown };
type Api = { url: string; key: string; token: string };

/** The pre-minted sandbox token must claim exactly role forge_sandbox_api and be unexpired, with at most 12 h left.
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
    if (claims.role !== API_SCHEMA || typeof claims.exp !== "number" || claims.exp <= now + 300 || claims.exp > now + 43_200) return null;
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
  return withForgeEnv(FIXTURE_FLAGS, () => run(res, api, sha, enteredAt));
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
  let revisionId: string | null = null, readers: Awaited<ReturnType<typeof readHostedRsoConsumers>> | null = null;
  const stages: Record<string, number> = {};
  const mark = (name: string, from: number) => { stages[name] = Date.now() - from; };
  try {
    const captureStarted = Date.now();
    const captureEnd = enteredAt + CAPTURE_END_MS;
    const capture = await runHostedPregameGame({
      gameId: GAME_ID, slateDate: begin.slateDate, scheduledStart: begin.scheduledStart, safeStart: begin.scheduledStart, codeVersion: sha,
    }, {
      // The deployment's flags as they are. Only the Supabase connection settings are replaced by inert labels, because
      // every connection below is the sandbox API client instead; no service-role credential is ever read.
      env: { ...forgeEnv(), NEXT_PUBLIC_SUPABASE_URL: "sandbox-api", SUPABASE_SERVICE_ROLE_KEY: "unused-forge-sandbox" },
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
    mark("captureMs", captureStarted);
    claimId = capture.claimId;
    if (capture.outcome !== "qualified" || !claimId) reason = capture.reason ?? capture.outcome ?? "capture_unconfirmed";
    if (claimId) {
      const summaryStarted = Date.now();
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
      mark("summaryMs", summaryStarted);
    }
    let observedAt = "";
    if (!reason) {
      const publishStarted = Date.now();
      try {
        // The real FORGE publisher: verifies custody and the RFC 3161 witness, recomputes from the frozen packet without
        // database I/O, and commits through the sandbox's forge_pregame_publish_v1. A committed revision is returned as is.
        const published = await publishQualifiedPregameCapture({ claimId: claimId!, gameId: GAME_ID, codeVersion: sha },
          { db: apiClient(api, enteredAt + PUBLISH_END_MS) });
        revisionId = published.revisionId;
        observedAt = published.observedAt;
      } catch (error) {
        reason = error instanceof PublicationError && error.status < 500 ? error.message : "publication_unconfirmed";
      }
      mark("publishMs", publishStarted);
    }
    if (!reason) {
      // Readers refuse a publication the host clock has not passed (DB time has microseconds). Absorb up to 5 s of offset.
      const lead = Date.parse(observedAt) + 2 - Date.now();
      if (lead > 0 && lead <= 5_002) await new Promise(resolve => setTimeout(resolve, lead));
      const readersStarted = Date.now();
      readers = await readHostedRsoConsumers(apiClient(api, enteredAt + READERS_END_MS), {
        contextId: HOSTED_RSO_CONTEXT, playerNhlId: PLAYER_NHL_ID, seasonId: Number(begin.seasonId), gameId: GAME_ID,
        slateDate: begin.slateDate, scheduledStart: begin.scheduledStart, claimId: claimId!, revisionId: revisionId!, codeVersion: sha, observedAt,
      });
      mark("readersMs", readersStarted);
    }
  } catch {
    reason ??= "run_deadline";
  }

  const elapsedMs = Date.now() - enteredAt;
  const finishMs = Math.min(RPC_MS, enteredAt + FINISH_END_MS - Date.now());
  if (summary) summary.stages = stages;
  const body = { sha, gameId: GAME_ID, claimId, revisionId, readers, summary, stages, elapsedMs };
  if (finishMs <= 0) return res.status(503).json({ status: "finish_unconfirmed", reason, ...body });
  try {
    const finish = await db.rpc("forge_sandbox_run_finish_v1", {
      p_game_id: GAME_ID, p_code_version: sha, p_reason: reason, p_claim_id: claimId, p_revision_id: revisionId, p_readers: readers,
      p_summary: summary, p_elapsed_ms: elapsedMs,
    }).abortSignal(AbortSignal.timeout(finishMs));
    const receipt = finish.data as { outcome?: string; reason?: string } | null;
    if (finish.error || !receipt?.outcome) return res.status(503).json({ status: "finish_unconfirmed", reason, ...body });
    return res.status(receipt.outcome === "succeeded" ? 200 : 503).json({ status: receipt.outcome, reason: receipt.reason, ...body, receipt });
  } catch {
    return res.status(503).json({ status: "finish_unconfirmed", reason, ...body });
  }
}
