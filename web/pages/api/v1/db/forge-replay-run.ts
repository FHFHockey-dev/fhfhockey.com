import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, generateKeyPairSync } from "node:crypto";
import { replayProjectionInputs, type ProjectionInputRead } from "lib/projections/inputCapture";
import type { NextApiRequest, NextApiResponse } from "next";
import { withForgeEnv, forgeEnv } from "lib/projections/forgeEnvScope";
import { runPregameCapture, type CaptureDeps, type Collected, type PinnedGame } from "lib/projections/pregameCapture/custody";
import { runHostedPregameGame } from "lib/projections/pregameCapture/hostedGame";
import { DEFAULT_CAPTURE_BUDGET, PILOT_TRANSPORT_LIMITS } from "lib/projections/pregameCapture/policy";
import { HOSTED_RSO_CONTEXT, readHostedRsoConsumers } from "lib/projections/pregameCapture/hostedReaders";
import { PublicationError, publishQualifiedPregameCapture } from "lib/projections/pregameCapture/publication";
import { replayTestTsa, replayTestTsaTrust } from "lib/projections/pregameCapture/replayTestTsa";
import { calendarRevisionOf, captureDeps, type RunnerConfig } from "lib/projections/pregameCapture/runner";
import { supabaseCaptureRpc } from "lib/projections/pregameCapture/rpc";
import { scheduleReader } from "lib/projections/pregameCapture/scheduleReader";
import { assertSignedVerdict, witnessKeyId, type SignedVerdictRow } from "lib/projections/pregameCapture/signedVerdict";
import { checkSignedVerdict, type SignedVerdictVerify } from "lib/projections/pregameCapture/signedVerdictGate";
import { parseInstantMicros } from "lib/projections/pregameCapture/time";
import { handleWitnessEdgeRequest } from "lib/projections/pregameCapture/witnessEdgeCore";
import { invokedByCron } from "utils/adminOnlyMiddleware";

// Hosted FORGE replay of the long-absence failure (TJ, 2026-11-20). Default off: without FORGE_SANDBOX_API_TOKEN it refuses.
// Supabase Cron sends one GET per step; the sandbox ledger (forge_sandbox_api.forge_replay_step_begin_v1) decides which
// step is due by the database clock and writes nothing when none is (wait, busy, halted, complete = duplicate):
//   fail_capture → reset_repair → pass_capture → verify → publish.
// Real time throughout (no clock patch): the fixture world was generated for a test puck drop a whole number of days after
// the frozen world's. Every database call goes through the Data API as forge_sandbox_api (views and wrappers in the exposed
// schema forge_sandbox_api only); no service-role credential is read. TEST stand-ins, all confined to this request:
//   * an in-process RFC 3161 TSA (replayTestTsa) and its trust root, passed explicitly to capture, witness and publisher;
//   * the committed witness code (witnessEdgeCore, the source of the deployed Edge bundle) run here, not the deployed
//     Edge Function, with an Ed25519 key generated in memory for this request and dropped after it;
//   * the publish gate's real check (checkSignedVerdict) against that one test key, read back from the sandbox ledger;
//   * the synthetic game's NHL landing built from its own sandbox schedule.
// The fixture's four flags apply only inside this request's async scope (withForgeEnv); the deployment's env is unchanged.
// The game and the reader's player come from the sandbox ledger (replay_meta), so any frozen fixture the bootstrap
// installs (the synthetic control, or a reconstructed historical game) runs on the same deployment.
// SEALED REPLAY (default off; only when the ledger's begin answer says mode "sealed", TJ 2026-11-20): pass_capture
// replays the envelope's recorded reads instead of reading the sandbox (sealedCollector): both recorded hashes are
// verified first, the first unrecorded request stops the capture, and every recorded read must be consumed. Any failure
// to obtain or verify the envelope stops before a claim: there is no live fallback. Every step's report on a sealed
// ledger is labelled replay only; like every step here it writes only through the sandbox API.
export const config = { maxDuration: 240 };

const API_SCHEMA = "forge_sandbox_api";
const RUN_END_MS = 225_000, FINISH_END_MS = 232_000, RPC_MS = 6_000;
// Capture is enabled here too, so the sandbox replay does not depend on (or change) production's capture flag.
const fixtureFlags = (gameId: number) => ({ FORGE_PREGAME_CAPTURE_ENABLED: "true", STARTER_BOARD_COMPUTE_ENABLED: "true",
  STARTER_BOARD_SERVING_ENABLED: "true", STARTER_BOARD_CANARY_GAME_IDS: String(gameId) });

type Step = "fail_capture" | "reset_repair" | "pass_capture" | "verify" | "publish";
type Begin = { status: "due"; step: Step; gameId: number; playerNhlId: number; slateDate: string; scheduledStart: string; seasonId: number;
  /** The ledger's fixture kind (sealed ledgers only; absent on the synthetic control's ledger). */
  mode?: string;
  claimId: string | null; witnessKey: { keyId: string; x: string } | null; landing: Record<string, unknown> | null;
  hashes: { claimId: string; gameId: number; scheduledStart: string; raw: string; canonical: string; tsaTokenSha256: string } | null }
  | { status: string; due?: unknown; receipt?: unknown };
type Api = { url: string; key: string; token: string };

/** The pre-minted sandbox token must claim exactly role forge_sandbox_api and be unexpired, with at most 12 h left. */
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

/** supabase-js on the sandbox schema only, sandbox token as Bearer, every request inside the deadline. For the capture's
 * strict reads (`guarded`), the profile header is withheld from the transport and re-pinned by pinSandboxProfile. */
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
  if (!api) return res.status(503).json({ status: "replay_disabled" });
  return run(res, api, sha, enteredAt);
}

async function run(res: NextApiResponse, api: Api, sha: string, enteredAt: number) {
  const db = apiClient(api, enteredAt + FINISH_END_MS);
  let begin: Begin;
  try {
    const result = await db.rpc("forge_replay_step_begin_v1", { p_code_version: sha }).abortSignal(AbortSignal.timeout(RPC_MS));
    if (result.error || !result.data) return res.status(503).json({ status: "begin_unconfirmed", sha });
    begin = result.data as Begin;
  } catch {
    return res.status(503).json({ status: "begin_unconfirmed", sha });
  }
  // Nothing due: no write. After publish every request lands here as a duplicate.
  if (begin.status !== "due") return res.status(begin.status === "complete" ? 409 : 202).json({ ...begin, sha });
  const due = begin as Extract<Begin, { status: "due" }>;
  if (!Number.isSafeInteger(due.gameId) || due.gameId <= 0 || !Number.isSafeInteger(due.playerNhlId) || due.playerNhlId <= 0) {
    return res.status(503).json({ status: "begin_unconfirmed", sha });
  }
  return withForgeEnv(fixtureFlags(due.gameId), () => runStep(res, api, sha, enteredAt, db, due));
}

async function runStep(res: NextApiResponse, api: Api, sha: string, enteredAt: number, db: SupabaseClient,
  due: Extract<Begin, { status: "due" }>) {
  if (due.step === "reset_repair") {
    try {
      const reset = await db.rpc("forge_replay_reset_repair_v1", { p_code_version: sha }).abortSignal(AbortSignal.timeout(20_000));
      if (reset.error || !reset.data) return res.status(503).json({ status: "reset_unconfirmed", sha, error: reset.error?.message ?? null });
      return res.status(200).json({ status: "reset_repaired", step: due.step, sha, receipt: reset.data, elapsedMs: Date.now() - enteredAt });
    } catch {
      return res.status(503).json({ status: "reset_unconfirmed", sha });
    }
  }

  const runEnd = enteredAt + RUN_END_MS;
  const trust = replayTestTsaTrust();
  let report: Record<string, unknown> = {};
  try {
    if (due.step === "fail_capture" || due.step === "pass_capture") report = await capture(api, due, sha, runEnd, trust);
    else if (due.step === "verify") report = await verify(api, due, sha, runEnd, trust);
    else report = await publish(api, due, sha, runEnd, trust);
  } catch (error) {
    report = { ...report, reason: "run_deadline", error: error instanceof Error ? error.message.slice(0, 200) : "unknown" };
  }
  report.elapsedMs = Date.now() - enteredAt;
  if (due.mode === "sealed") report = { ...report, mode: "sealed_replay", replayOnly: true, fixtureLabel: SEALED_LABEL };
  const finishMs = Math.min(RPC_MS, enteredAt + FINISH_END_MS - Date.now());
  if (finishMs <= 0) return res.status(503).json({ status: "finish_unconfirmed", step: due.step, sha, report });
  try {
    const finish = await db.rpc("forge_replay_step_finish_v1", { p_step: due.step, p_code_version: sha, p_report: report })
      .abortSignal(AbortSignal.timeout(finishMs));
    if (finish.error || !finish.data) return res.status(503).json({ status: "finish_unconfirmed", step: due.step, sha, report });
    const receipt = finish.data as { steps?: Array<{ step: string; outcome: string }> };
    const outcome = receipt.steps?.find(s => s.step === due.step)?.outcome ?? "unknown";
    return res.status(outcome === "passed" || outcome === "expected_failure" ? 200 : 503)
      .json({ status: outcome, step: due.step, sha, report, receipt });
  } catch {
    return res.status(503).json({ status: "finish_unconfirmed", step: due.step, sha, report });
  }
}

export type SealedEnvelope = {
  gameId: number; inputCutoff: string; pinned: PinnedGame; reads: ProjectionInputRead[]; transport: Collected["transport"];
};
type Sealed = { mode: "sealed"; fixtureLabel: string; gameId: number; playerNhlId: number; inputCutoff: string;
  envelopeSha256: string; readerInputsSha256: string; envelope: string; readerInputs: string };
export const SEALED_LABEL = "sealed real envelope (replay only)";
const sha256Hex = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/** The sandbox's sealed envelope for this step, both recorded hashes verified; null for a synthetic fixture. */
export function verifySealedEnvelope(sealed: unknown, due: { gameId: number; playerNhlId: number }):
  { ok: true; envelope: SealedEnvelope | null; hashes: Record<string, string> | null } | { ok: false; reason: string } {
  const value = sealed as Partial<Sealed> | null;
  if ((sealed as { mode?: unknown } | null)?.mode === "synthetic_control") return { ok: true, envelope: null, hashes: null };
  if (value?.mode !== "sealed" || value.fixtureLabel !== SEALED_LABEL || typeof value.envelope !== "string"
    || typeof value.readerInputs !== "string") return { ok: false, reason: "sealed_envelope_unavailable" };
  if (sha256Hex(value.envelope) !== value.envelopeSha256 || sha256Hex(value.readerInputs) !== value.readerInputsSha256) {
    return { ok: false, reason: "sealed_hash_mismatch" };
  }
  let envelope: SealedEnvelope;
  try { envelope = JSON.parse(value.envelope) as SealedEnvelope; } catch { return { ok: false, reason: "sealed_envelope_invalid" }; }
  if (envelope.gameId !== due.gameId || value.gameId !== due.gameId || value.playerNhlId !== due.playerNhlId
    || !Array.isArray(envelope.reads) || !envelope.reads.length || !envelope.pinned || envelope.pinned.gameId !== due.gameId
    || typeof value.inputCutoff !== "string" || parseInstantMicros(envelope.inputCutoff) !== parseInstantMicros(value.inputCutoff)) {
    return { ok: false, reason: "sealed_envelope_mismatch" };
  }
  return { ok: true, envelope, hashes: { envelopeSha256: value.envelopeSha256!, readerInputsSha256: value.readerInputsSha256! } };
}

/** The sandbox claim of a sealed fixture returns the envelope's recorded cutoff (its stand-in clock); the binding carries
 * the envelope's own text of that instant, as the local harness's frozen claim does, so the recorded reads' filters match. */
export function sealedClaim<W extends Pick<CaptureDeps["writer"], "claim">>(writer: W, envelope: SealedEnvelope): W {
  return { ...writer, async claim(args: Parameters<W["claim"]>[0]) {
    const row = await writer.claim(args);
    if (row.outcome !== "claimed") return row;
    if (parseInstantMicros(row.inputCutoff ?? "") !== parseInstantMicros(envelope.inputCutoff)) throw new Error("sealed_cutoff_mismatch");
    return { ...row, inputCutoff: envelope.inputCutoff };
  } } as W;
}

/** The local harness's sealed collect: the released collector against the recorded reads only (an unrecorded request
 * throws, an unconsumed recorded read throws), bound to the envelope's own recorded input cutoff. */
export function sealedCollector(envelope: SealedEnvelope, config: Pick<RunnerConfig, "collectNative" | "seasonBootstrap">):
  Pick<CaptureDeps, "pin" | "collect"> {
  return {
    pin: async () => envelope.pinned,
    collect: async (binding, deadlineMs) => {
      if (parseInstantMicros(binding.inputCutoff) !== parseInstantMicros(envelope.inputCutoff)) throw new Error("sealed_cutoff_mismatch");
      const seasonBootstrap = config.seasonBootstrap({ slateDate: binding.slateDate, gameId: binding.gameId, inputCutoff: binding.inputCutoff });
      const run = await replayProjectionInputs(envelope.reads, () => config.collectNative({ slateDate: binding.slateDate,
        gameId: binding.gameId, inputCutoff: binding.inputCutoff, deadlineMs, seasonBootstrap }), { rejectUnrecordedReads: true });
      if (run.writes.length) throw new Error("sealed_collect_wrote");
      return { reads: envelope.reads, candidates: run.result.candidates, seasonBootstrapApplied: seasonBootstrap,
        transport: envelope.transport, calendarRevision: calendarRevisionOf(run.result.issuedContextAfter.schedule) };
    },
  };
}

/** The existing FORGE v1 capture for the fixture, on the sandbox API, with the in-process test TSA. */
async function capture(api: Api, due: Extract<Begin, { status: "due" }>, sha: string, runEnd: number, trust: ReturnType<typeof replayTestTsaTrust>) {
  const tsa = replayTestTsa();
  const started = Date.now();
  // A sealed ledger's envelope; the synthetic control's ledger never says "sealed" and never calls this.
  let sealed: ReturnType<typeof verifySealedEnvelope> = { ok: true, envelope: null, hashes: null };
  if (due.mode === "sealed") {
    if (due.step !== "pass_capture") sealed = { ok: false, reason: "sealed_step_unexpected" };
    else {
      const result = await apiClient(api, runEnd).rpc("forge_replay_sealed_v1").abortSignal(AbortSignal.timeout(20_000));
      sealed = result.error ? { ok: false, reason: "sealed_envelope_unavailable" } : verifySealedEnvelope(result.data, due);
      if (sealed.ok && !sealed.envelope) sealed = { ok: false, reason: "sealed_envelope_unavailable" };
    }
  }
  if (!sealed.ok) return { outcome: "not_started", reason: sealed.reason, replayOnly: true, fixtureLabel: SEALED_LABEL, captureMs: Date.now() - started };
  const envelope = sealed.envelope;
  const result = await runHostedPregameGame({
    gameId: due.gameId, slateDate: due.slateDate, scheduledStart: due.scheduledStart, safeStart: due.scheduledStart, codeVersion: sha,
  }, {
    env: { ...forgeEnv(), NEXT_PUBLIC_SUPABASE_URL: "sandbox-api", SUPABASE_SERVICE_ROLE_KEY: "unused-forge-sandbox" },
    signal: AbortSignal.timeout(Math.max(1, runEnd - Date.now())),
    readSchedule: async (_url, _key, target, signal) => scheduleReader(apiClient(api, runEnd), [target.gameId], target.slateDate, signal)(),
    runCapture: (config, target) => runPregameCapture(((deps: CaptureDeps) => envelope ? { ...deps, ...sealedCollector(envelope, config) } : deps)(captureDeps({
      writer: ((writer) => envelope ? sealedClaim(writer, envelope) : writer)(supabaseCaptureRpc(apiClient(api, runEnd), DEFAULT_CAPTURE_BUDGET.rpcMs)),
      verifier: supabaseCaptureRpc(apiClient(api, runEnd), DEFAULT_CAPTURE_BUDGET.rpcMs),
      tsa, trust,
      createReadClient: guarded => apiClient(api, runEnd, guarded) as never,
      restBaseUrl: `${api.url.replace(/\/+$/, "")}/rest/v1`, collectNative: config.collectNative, seasonBootstrap: config.seasonBootstrap,
      modelEnvironment: config.modelEnvironment, budget: { ...DEFAULT_CAPTURE_BUDGET, ...config.budget },
      transportLimits: { ...PILOT_TRANSPORT_LIMITS, ...config.transportLimits }, now: Date.now, fetchImpl: pinSandboxProfile,
    })), target),
  });
  return { claimId: result.claimId, outcome: result.outcome, reason: result.reason, stopTrigger: result.stopTrigger,
    tsaCalls: tsa.calls(), captureMs: Date.now() - started,
    ...(envelope ? { mode: "sealed_replay", replayOnly: true, fixtureLabel: SEALED_LABEL, ...sealed.hashes, sealedReads: envelope.reads.length } : {}) };
}

/** The committed witness code judges the claim here and signs with a key that exists only in this request. */
async function verify(api: Api, due: Extract<Begin, { status: "due" }>, sha: string, runEnd: number, trust: ReturnType<typeof replayTestTsaTrust>) {
  const pair = generateKeyPairSync("ed25519");
  const x = pair.publicKey.export({ format: "jwk" }).x!;
  const key = { keyId: witnessKeyId(x), x };
  const base = api.url.replace(/\/+$/, "");
  // The witness calls <url>/rest/v1/rpc/<name> on forge_witness_api with its service key; here every call goes to the
  // sandbox's forge_sandbox_api.witness_<name> with the sandbox token, and the NHL landing is the TEST landing.
  const witnessFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (Date.now() >= runEnd) throw new Error("run_deadline");
    const url = new URL(String(input));
    if (url.origin === "https://api-web.nhle.com" && url.pathname === `/v1/gamecenter/${due.gameId}/landing`) return Response.json(due.landing);
    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(signed_pending_v1|signed_evidence_v1|record_signed_v1)$/);
    if (url.origin !== new URL(base).origin || !rpc) throw new Error(`replay_witness_request_refused:${url.origin}${url.pathname}`);
    const headers = new Headers(init?.headers);
    headers.set("apikey", api.key);
    headers.set("authorization", `Bearer ${api.token}`);
    headers.set("content-profile", API_SCHEMA);
    headers.set("accept-profile", API_SCHEMA);
    return fetch(`${base}/rest/v1/rpc/witness_${rpc[1]}`, { ...init, headers });
  }) as typeof fetch;
  const env: Record<string, string> = { SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: "replaced-by-sandbox-token",
    FORGE_WITNESS_SIGNING_KEY: pair.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64") };
  const release = createHash("sha256").update(`forge-replay-in-process-witness:${sha}`).digest("hex");
  const started = Date.now();
  const response = await handleWitnessEdgeRequest(new Request("https://replay.local/forge-witness-verify", { method: "POST" }),
    name => env[name], { fetch: witnessFetch, trust, release });
  const body = await response.json().catch(() => null);
  return { key, release, witness: { status: response.status, body }, verifyMs: Date.now() - started,
    witnessRuns: "in-process committed witnessEdgeCore (TEST key), not the deployed Edge Function" };
}

/** Signed gate against the test key, the real FORGE publisher, then both real RSO readers. */
async function publish(api: Api, due: Extract<Begin, { status: "due" }>, sha: string, runEnd: number, trust: ReturnType<typeof replayTestTsaTrust>) {
  const report: Record<string, unknown> = {};
  if (!due.hashes || !due.witnessKey || !due.claimId || due.hashes.claimId !== due.claimId) return { reason: "publish_binding_missing" };
  const keys = { [due.witnessKey.keyId]: due.witnessKey.x };
  const testKeyVerify: SignedVerdictVerify = (signedVerdict, expected) => {
    try {
      const payload = assertSignedVerdict(signedVerdict as SignedVerdictRow | null, { claimId: expected.claimId, gameId: expected.gameId,
        rawSha256: expected.raw, canonicalSha256: expected.canonical, tsaTokenSha256: expected.tsaTokenSha256 }, keys);
      return { ok: true, officialStart: payload.officialStart, deadline: payload.deadline, verifiedAt: payload.verifiedAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      return { ok: false, reason: message.startsWith("witness_verdict_required:") ? message.slice("witness_verdict_required:".length) : "signed_verdict_unverifiable" };
    }
  };
  const signed = await apiClient(api, runEnd).rpc("witness_signed_verdict_v1", { p_claim_id: due.claimId }).abortSignal(AbortSignal.timeout(RPC_MS));
  const decision = signed.error ? { ok: false, reason: "signed_verdict_unreadable" }
    : checkSignedVerdict(signed.data ?? null, { claimId: due.claimId, gameId: due.gameId, raw: due.hashes.raw, canonical: due.hashes.canonical,
      tsaTokenSha256: due.hashes.tsaTokenSha256 }, due.hashes.scheduledStart, testKeyVerify);
  report.gate = { status: decision.ok ? "accepted" : "refused", ...decision, keyId: due.witnessKey.keyId };
  if (!decision.ok) return { ...report, reason: `signed_gate:${decision.reason}` };

  const publishStarted = Date.now();
  let observedAt = "";
  try {
    const published = await publishQualifiedPregameCapture({ claimId: due.claimId, gameId: due.gameId, codeVersion: sha },
      { db: apiClient(api, runEnd), trust });
    report.revisionId = published.revisionId;
    observedAt = published.observedAt;
  } catch (error) {
    return { ...report, reason: error instanceof PublicationError && error.status < 500 ? error.message : "publication_unconfirmed" };
  }
  report.publishMs = Date.now() - publishStarted;
  // Readers refuse a publication the host clock has not passed (DB time has microseconds). Absorb up to 5 s of offset.
  const lead = Date.parse(observedAt) + 2 - Date.now();
  if (lead > 0 && lead <= 5_002) await new Promise(resolve => setTimeout(resolve, lead));
  const readersStarted = Date.now();
  report.readers = await readHostedRsoConsumers(apiClient(api, runEnd), {
    contextId: HOSTED_RSO_CONTEXT, playerNhlId: due.playerNhlId, seasonId: Number(due.seasonId), gameId: due.gameId,
    slateDate: due.slateDate, scheduledStart: due.scheduledStart, claimId: due.claimId, revisionId: String(report.revisionId), codeVersion: sha, observedAt,
  });
  report.readersMs = Date.now() - readersStarted;
  return report;
}
