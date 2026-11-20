/** One approved, immutable native date. The native source is checked before a claim;
 * after claiming D, the database read, each object and the terminal write are attempted once. */
import { createHash, createPublicKey, timingSafeEqual, verify, type KeyObject } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { decodeReviewedEvidenceJSON, reviewedEvidenceTime } from "../../buyLowSellHigh/reviewedFiveGameWindow.server";
import { NST_ADMISSION_PROJECT_HOST } from "../../nst/admissionOrigin";
import { prepareNativeProcessCapture } from "../../../scripts/blsh/nativeProcessCapturePreparation";
import { buildRequestFromContextV1, REQUEST_CONTEXT_CAPTURE, type RequestContextResult } from "./requestContext";
import type { NativeContextTarget, RequestContextStore } from "./requestContextStore";
import { PILOT_FENCE_FIRST_CAPTURE_DATE, SEASON_FIRST_DATE, SEASON_LAST_DATE } from "./sourceDate";

const GROUPS = ["individual", "onIce"] as const;
const FEEDS = ["wgo", ...GROUPS, "calendar"] as const;
const DAY_MS = 86400000, TWELVE_HOURS_US = 12 * 3600000000, MIB = 1024 * 1024;
// Reserve 15s of the route's 240s for startup, failure close and response delivery.
const WORK_MS = 225000, SOURCE_MS = 20000, CLAIM_MS = 5000, READ_MS = 15000, PUT_MS = 20000, CLOSE_MS = 5000;
const COMPLETE = "packet_complete_pending_review";
const id = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const digest = (bytes: Buffer) => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
const json = (value: unknown) => Buffer.from(JSON.stringify(value) + "\n");
const iso = (ms: number) => new Date(ms).toISOString();
type Approval = NativeContextTarget & { deploymentId: string; gitCommitSha: string };
type RequestDeployment = Pick<Approval, "deploymentId" | "gitCommitSha">;
type FileRecord = { file: string; bytes: number; sha256: string };
type NativeSource = Awaited<ReturnType<RequestContextStore["source"]>>;
function need(condition: unknown): asserts condition { if (!condition) throw new Error("invalid_context_evidence"); }

/** Independent signers sign exactly this UTF-8 JSON array, with no trailing newline. */
export function requestContextApprovalBytes(a: Approval): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(["fhfh.blsh.request-context-approval.v1",
    a.sourceDate, a.nativeRunId, a.nativeManifestSHA256, a.deploymentId, a.gitCommitSha]));
}

function approvalPublicKey(pem: string) {
  need(pem.length <= 512 && /^-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END PUBLIC KEY-----$/.test(pem.trim()));
  const key = createPublicKey(pem);
  need(key.type === "public" && key.asymmetricKeyType === "ed25519");
  return key;
}

// Next body parsing is disabled on this route. Keep raw bytes to reject duplicate keys and invalid UTF-8.
function approvalBody(req: NextApiRequest): Promise<Uint8Array> {
  const max = 1024, contentType = req.headers["content-type"], length = req.headers["content-length"];
  need(req.body === undefined && typeof contentType === "string" && /^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)
    && [undefined, "identity"].includes(req.headers["content-encoding"] as string | undefined)
    && (length === undefined || (typeof length === "string" && /^[1-9]\d{0,3}$/.test(length) && Number(length) <= max)));
  return new Promise((resolve, reject) => {
    const bytes = new Uint8Array(max);
    let size = 0;
    function cleanup() {
      clearTimeout(timer);
      req.off("data", data).off("end", end).off("aborted", fail).off("error", fail).off("close", fail);
    }
    function fail() {
      cleanup(); req.pause();
      // IncomingMessage can emit ECONNRESET after it has already signaled "aborted".
      req.once("error", () => {});
      reject(new Error("invalid_approval_body"));
    }
    function data(chunk: unknown) {
      if (!(chunk instanceof Uint8Array) || chunk.length > max - size) { fail(); return; }
      bytes.set(chunk, size); size += chunk.length;
    }
    function end() {
      if (!size || req.aborted || req.complete === false || (length !== undefined && Number(length) !== size)) { fail(); return; }
      cleanup(); resolve(bytes.subarray(0, size));
    }
    const timer = setTimeout(fail, 5000);
    req.once("end", end).once("aborted", fail).once("error", fail).once("close", fail).on("data", data);
    if (req.aborted || req.destroyed) fail();
  });
}

function approvedTarget(body: Uint8Array, key: KeyObject) {
  const envelope = decodeReviewedEvidenceJSON<{approval: Approval; signature: string}>(body);
  need(envelope && Object.keys(envelope).sort().join(",") === "approval,signature");
  const a = envelope.approval;
  need(Object.keys(a).sort().join(",") === "deploymentId,gitCommitSha,nativeManifestSHA256,nativeRunId,sourceDate");
  need(typeof a.sourceDate === "string" && /^\d{4}-\d\d-\d\d$/.test(a.sourceDate) && iso(Date.parse(a.sourceDate)).startsWith(a.sourceDate)
    && typeof a.nativeRunId === "string" && id.test(a.nativeRunId) && typeof a.nativeManifestSHA256 === "string" && /^[0-9a-f]{64}$/.test(a.nativeManifestSHA256));
  need(typeof a.deploymentId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(a.deploymentId) && a.deploymentId === process.env.VERCEL_DEPLOYMENT_ID
    && typeof a.gitCommitSha === "string" && /^[a-f0-9]{40}$/.test(a.gitCommitSha) && a.gitCommitSha === process.env.VERCEL_GIT_COMMIT_SHA);
  need(typeof envelope.signature === "string" && /^[A-Za-z0-9+/]{86}==$/.test(envelope.signature));
  const signature = Buffer.from(envelope.signature, "base64");
  need(signature.length === 64 && signature.toString("base64") === envelope.signature
    && verify(null, requestContextApprovalBytes(a), key, new Uint8Array(signature)));
  return { target: { sourceDate: a.sourceDate, nativeRunId: a.nativeRunId, nativeManifestSHA256: a.nativeManifestSHA256 },
    requestDeployment: { deploymentId: a.deploymentId, gitCommitSha: a.gitCommitSha } };
}

function nativeObservations(source: NativeSource, target: NativeContextTarget, now: number) {
  const claimed = reviewedEvidenceTime(source.claimedAtUTC), closed = reviewedEvidenceTime(source.closedAtUTC);
  need(claimed <= closed && closed <= now * 1000 && iso(Math.floor(claimed / 1000)).slice(0, 10) === iso(now).slice(0, 10));
  const plan = prepareNativeProcessCapture({ seasonId: 20262027, date: target.sourceDate, plannedAtUTC: iso(now), groups: GROUPS });
  need(source.manifest.length > 0 && source.manifest.length <= 65536 && digest(source.manifest) === target.nativeManifestSHA256);
  const manifest = decodeReviewedEvidenceJSON<{ state: string; runId: string; sourceDate: string; files: FileRecord[]; completedAtUTC: string }>(new Uint8Array(source.manifest));
  const completed = reviewedEvidenceTime(manifest.completedAtUTC);
  need(manifest.state === COMPLETE && manifest.runId === target.nativeRunId && manifest.sourceDate === target.sourceDate && completed <= closed);
  const observations: string[] = [];
  let last = claimed;
  let firstBinding: Record<string, unknown> | undefined;
  for (const [index, group] of GROUPS.entries()) {
    const bytes = source[group], descriptor = manifest.files[index === 0 ? 12 : 18], body = manifest.files[index === 0 ? 11 : 17];
    need(bytes.length > 0 && bytes.length <= 65536 && descriptor.file === group + ".TRANSPORT-OBSERVATION.json"
      && descriptor.bytes === bytes.length && descriptor.sha256 === digest(bytes));
    const obs = decodeReviewedEvidenceJSON<Record<string, unknown>>(new Uint8Array(bytes));
    need(obs.status === "candidate_requires_adapter_and_source_review" && obs.operation === "nst:" + group
      && body.file === group + ".parser-input.html" && obs.file === body.file && obs.bytes === body.bytes && obs.sha256 === body.sha256
      && obs.httpStatus === 200 && obs.redirected === false && obs.finalUrl === plan.pages[index].url && obs.representation === "client_redacted_parser_input"
      && obs.tlsEvidence === "pending_runtime_review" && obs.TLSVerified === null && obs.originalPublicationUTC === null && obs.modelDefinition === "unknown"
      && obs.completedGameIds === null && Number.isSafeInteger(obs.parsedRows) && Number(obs.parsedRows) > 0 && Number(obs.parsedRows) <= 5000
      && obs.independentlyAccepted === false && obs.advancedAdmission === false && obs.score === null);
    const binding = obs.deploymentBinding as Record<string, unknown>;
    need(binding && typeof binding.deploymentId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(binding.deploymentId)
      && (binding.gitCommitSha === null || (typeof binding.gitCommitSha === "string" && /^[a-f0-9]{40}$/.test(binding.gitCommitSha)))
      && (binding.routeBundleSHA256 === null || (typeof binding.routeBundleSHA256 === "string" && /^[a-f0-9]{64}$/.test(binding.routeBundleSHA256))));
    if (firstBinding) need(binding.deploymentId === firstBinding.deploymentId && binding.gitCommitSha === firstBinding.gitCommitSha && binding.routeBundleSHA256 === firstBinding.routeBundleSHA256);
    firstBinding = binding;
    need(typeof obs.retrievedAtUTC === "string" && typeof obs.retainedAtUTC === "string");
    const retrieved = reviewedEvidenceTime(obs.retrievedAtUTC), retained = reviewedEvidenceTime(obs.retainedAtUTC);
    need(last <= retrieved && retrieved <= retained && retained <= completed);
    observations.push(obs.retrievedAtUTC);
    last = retained;
  }
  return { individual: observations[0], onIce: observations[1] };
}

function buildPacket(db: Buffer, target: NativeContextTarget, requestDeployment: RequestDeployment, runId: string, dateFrom: string, observed: ReturnType<typeof nativeObservations>, started: number, captured: number) {
  need(db.length > 0 && db.length <= 8 * MIB);
  const context = decodeReviewedEvidenceJSON<RequestContextResult>(new Uint8Array(db));
  const snapshot = reviewedEvidenceTime(context.snapshotUTC), statement = reviewedEvidenceTime(context.statementUTC);
  need(context.dateFrom === dateFrom && context.eventThroughDate === target.sourceDate && reviewedEvidenceTime(observed.onIce) <= snapshot
    && started * 1000 <= snapshot && snapshot <= statement && statement <= captured * 1000 && captured * 1000 <= reviewedEvidenceTime(observed.individual) + TWELVE_HOURS_US);
  const asOfUTC = iso(captured);
  const { rawFiles, request, rows } = buildRequestFromContextV1(context, { capturedAtUTC: asOfUTC });
  const packet: { bytes: Buffer; record: FileRecord }[] = [];
  let total = 0;
  function add(file: string, bytes: Buffer, max: number) {
    total += bytes.length;
    need(bytes.length > 0 && bytes.length <= max && total <= 64 * MIB);
    packet.push({ bytes, record: { file, bytes: bytes.length, sha256: digest(bytes) } });
  }
  add("DB-CONTEXT.json", db, 8 * MIB);
  for (const feed of FEEDS) {
    const file = "RAW-" + feed + ".json";
    add(file, rawFiles[file], 16 * MIB);
  }
  add("CURRENT-REQUEST.json", json(request), 32 * MIB);
  add("RESULT.json", json({ version: "fhfh.blsh.request-context-result.v1", state: "CAPTURED_READ_ONLY_UNQUALIFIED",
    executionMode: REQUEST_CONTEXT_CAPTURE, captureContext: REQUEST_CONTEXT_CAPTURE, atomicDatabaseSnapshot: true, sessionClosed: true,
    ...target, requestDeployment, runId, dateFrom, eventThroughDate: target.sourceDate, snapshotUTC: context.snapshotUTC, statementUTC: context.statementUTC,
    nativeRetrievedAtUTC: observed, asOfUTC, rows, artifacts: Object.fromEntries(packet.map(({ record }) => [record.file, record.sha256])),
    independentlyAccepted: false, advancedAdmission: false, score: null }), 65536);
  add("MANIFEST.json", json({ version: "fhfh.blsh.request-context-manifest.v1", runId, ...target, files: packet.map(item => item.record) }), 65536);
  return packet;
}

/** Independent cron authentication avoids constructing the shared admin/Supabase client. */
function cronAuthorized(header: string | undefined) {
  const secret = process.env.CRON_SECRET;
  if (!secret?.trim() || typeof header !== "string") return false;
  const received = new Uint8Array(Buffer.from(header)), expected = new Uint8Array(Buffer.from("Bearer " + secret));
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** The two values the route takes from its deployment. The default reads the live environment; the BLSH replay route
 * (lib/blsh/replay) injects an in-memory test key and a store bound to its private sandbox schema. Every check below is
 * the same for both. */
export interface RequestContextHandlerDeps {
  approvalPublicKeyPem(): string | undefined;
  createStore(serviceKey: string): Promise<RequestContextStore>;
}
const LIVE_DEPS: RequestContextHandlerDeps = {
  approvalPublicKeyPem: () => process.env.BLSH_REQUEST_CONTEXT_APPROVAL_PUBLIC_KEY,
  createStore: async serviceKey => (await import("./requestContextStore")).createRequestContextStore({ serviceKey }),
};
export function createRequestContextHandler(deps: RequestContextHandlerDeps) {
  return async function requestContextHandler(req: NextApiRequest, res: NextApiResponse) {
  const stopAt = performance.now() + WORK_MS;
  const timeFor = (milliseconds: number) => performance.now() + milliseconds <= stopAt;
  res.setHeader("Cache-Control", "no-store");
  if (!cronAuthorized(req.headers.authorization)) return res.status(403).json({ state: "refused", reason: "cron_bearer_required" });
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ state: "refused", reason: "method_not_allowed" }); }
  if (Object.keys(req.query ?? {}).length) return res.status(400).json({ state: "refused", reason: "unexpected_parameters" });
  const publicKey = deps.approvalPublicKeyPem();
  if (!publicKey) return res.status(200).json({ state: "skipped", reason: "disabled" });
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (process.env.VERCEL_ENV !== "production" || process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://" + NST_ADMISSION_PROJECT_HOST || !serviceKey) {
    return res.status(503).json({ state: "refused", reason: "environment_mismatch" });
  }
  let target: NativeContextTarget, requestDeployment: RequestDeployment;
  let key: KeyObject;
  try { key = approvalPublicKey(publicKey); } catch { return res.status(503).json({ state: "refused", reason: "approval_public_key_invalid" }); }
  try { ({ target, requestDeployment } = approvedTarget(await approvalBody(req), key)); } catch {
    res.setHeader("Connection", "close");
    return res.status(403).json({ state: "refused", reason: "approval_invalid" });
  }
  const ingress = Date.now(), day = iso(ingress).slice(0, 10), D = target.sourceDate;
  if (day < PILOT_FENCE_FIRST_CAPTURE_DATE || day > SEASON_LAST_DATE || D < SEASON_FIRST_DATE || D !== iso(ingress - DAY_MS).slice(0, 10)) {
    return res.status(200).json({ state: "skipped", reason: "outside_approved_date" });
  }
  const dateFrom = iso(Date.parse(D) - 28 * DAY_MS).slice(0, 10);
  let store: RequestContextStore, observed: ReturnType<typeof nativeObservations>;
  try {
    store = await deps.createStore(serviceKey);
    if (!timeFor(SOURCE_MS)) return res.status(503).json({ state: "refused", reason: "context_budget_exhausted" });
    const source = await store.source(target);
    observed = nativeObservations(source, target, Date.now());
  } catch { return res.status(503).json({ state: "refused", reason: "native_source_unverified" }); }
  const deadline = reviewedEvidenceTime(observed.individual) + TWELVE_HOURS_US;
  if (Date.now() * 1000 > deadline) return res.status(200).json({ state: "skipped", reason: "native_window_expired" });
  if (!timeFor(CLAIM_MS + READ_MS + 8 * PUT_MS + CLOSE_MS)) return res.status(503).json({ state: "refused", reason: "context_budget_exhausted" });
  let claim: Awaited<ReturnType<RequestContextStore["claim"]>>;
  try { claim = await store.claim(target); } catch { return res.status(503).json({ state: "uncertain", reason: "claim_unacknowledged", ...target }); }
  if (!claim.claimed) return res.status(200).json({ state: "skipped", reason: "already_claimed", ...target });
  const runId = claim.runId;
  let reason = "context_evidence_invalid", manifest: { bytes: Buffer; record: FileRecord };
  try {
    const started = Date.now();
    need(started >= ingress && started * 1000 <= deadline && iso(started).slice(0, 10) === day);
    reason = "context_budget_exhausted";
    need(timeFor(READ_MS + CLOSE_MS));
    reason = "context_read_failed";
    const db = await store.readContext(dateFrom, D);
    reason = "context_evidence_invalid";
    const packet = buildPacket(db, target, requestDeployment, runId, dateFrom, observed, started, Date.now());
    for (const [i, { bytes, record }] of packet.entries()) {
      reason = "context_budget_exhausted";
      need(timeFor(PUT_MS + CLOSE_MS));
      reason = "context_write_unacknowledged";
      await store.putObject(runId, D, i + 1, record.file, bytes, record.sha256);
    }
    reason = "context_budget_exhausted";
    need(timeFor(CLOSE_MS));
    manifest = packet[packet.length - 1];
  } catch {
    try { await store.close(runId, "failed", reason, null, null); }
    catch { return res.status(503).json({ state: "uncertain", reason: "failure_close_unacknowledged", sourceDate: D, runId }); }
    return res.status(502).json({ state: "failed", reason, sourceDate: D, runId });
  }
  try { await store.close(runId, COMPLETE, null, manifest.record.sha256, manifest.bytes); }
  catch { return res.status(503).json({ state: "uncertain", reason: "completion_close_unacknowledged", sourceDate: D, runId }); }
  return res.status(200).json({ state: COMPLETE, sourceDate: D, runId, manifestSHA256: manifest.record.sha256 });
  };
}
export default createRequestContextHandler(LIVE_DEPS);
