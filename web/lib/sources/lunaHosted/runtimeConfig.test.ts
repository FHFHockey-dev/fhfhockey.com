// @vitest-environment node
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { createLunaEvaluationBatch } from "../fixtures/tweetLunaEvaluation";
import { LUNA_MODEL, LUNA_RESERVATION_NANO_USD } from "../tweetLunaTransport";
import type { IftttRpcClient } from "../iftttRpcDeadline";
import { HOSTED_LUNA_VERSION } from "./contract";
import { prepareArchivedLunaDraft } from "./archiveBridge";
import type { ArchiveRecord } from "./archiveReceipt";
import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bindWorkerRuntimeStore, captureRuntimeStillEnabled, readCaptureRuntimeConfig,
  readWorkerRuntimeConfig, workerRuntimeStillEnabled, type WorkerRuntimeConfig } from "./runtimeConfig";
import type { HostedLunaStore } from "./store";
import { createHostedLunaStore } from "./store";
import { createLunaArchiveStore } from "./archiveStore";
import captureRoute from "../../../pages/api/v1/sources/ifttt/luna-capture";
import workerRoute from "../../../pages/api/internal/luna-review";

vi.mock("lib/supabase/server", () => ({ default: {} }));
vi.mock("./archiveStore", () => ({ createLunaArchiveStore: vi.fn() }));
vi.mock("./store", () => ({ createHostedLunaStore: vi.fn() }));
const NOW = Date.parse("2026-11-05T03:01:00Z");
const ID = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
const SECRET = "synthetic-runtime-only-key-00000000000";
const capture = { version: "luna-pilot-runtime-v1" as const, startsAt: "2026-11-05T03:00:00Z",
  expiresAt: "2026-11-05T04:00:00Z", scope: { policyId: ID, appletId: "synthetic-applet", sourceAccount: "TestReporter" } };
const worker: WorkerRuntimeConfig = { ...capture, job: { id: ID, inputHash: "a".repeat(64), receiptHash: "b".repeat(64),
  referenceHash: "c".repeat(64), provenanceRef: "synthetic-owner-review" } };
function env() { return { IFTTT_LUNA_CAPTURE_ENABLED: "true", IFTTT_LUNA_CAPTURE_CONFIG: JSON.stringify(capture),
  IFTTT_LUNA_REVIEW_ENABLED: "true", IFTTT_LUNA_REVIEW_CONFIG: JSON.stringify(worker) }; }
function storeFixture() {
  const job = { ...worker.job, inputJson: "{}", receiptJson: JSON.stringify({ kind: "luna-isolated-review-receipt-v1",
    eventTable: "luna_capture.receipts", archive: { envelope: { scope: capture.scope } } }) };
  const store: HostedLunaStore = { claim: vi.fn(async () => ({ status: "claimed" as const, job })),
    admission: vi.fn(), finish: vi.fn(), hold: vi.fn(async () => undefined) };
  return { store, job };
}
function response() {
  const res = { statusCode: 0, body: {} as any, setHeader: vi.fn(),
    status(n: number) { this.statusCode = n; return this; }, json(body: unknown) { this.body = body; return this; } };
  return res as typeof res & NextApiResponse;
}
function activate(kind: "capture" | "worker") {
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  vi.stubEnv("IFTTT_LUNA_CAPTURE_ENABLED", kind === "capture" ? "true" : "false");
  vi.stubEnv("IFTTT_LUNA_REVIEW_ENABLED", kind === "worker" ? "true" : "false");
  vi.stubEnv("IFTTT_LUNA_CAPTURE_CONFIG", JSON.stringify(capture));
  vi.stubEnv("IFTTT_LUNA_REVIEW_CONFIG", JSON.stringify(worker));
  vi.stubEnv("IFTTT_LUNA_CAPTURE_SECRET", SECRET);
  vi.stubEnv("IFTTT_LUNA_WORKER_SECRET", SECRET);
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("default-off bounded runtime configuration", () => {
  it.each([undefined, "", "false", "TRUE", "1", " true"])("refuses nonexact enabling flag %s", flag => {
    const e = env(); e.IFTTT_LUNA_CAPTURE_ENABLED = flag as string; e.IFTTT_LUNA_REVIEW_ENABLED = flag as string;
    expect(readCaptureRuntimeConfig(e, NOW)).toBeNull(); expect(readWorkerRuntimeConfig(e, NOW)).toBeNull();
  });
  it.each([undefined, "", "{}", "null", "not-json", "x".repeat(4097)])("refuses missing/malformed configuration %#", raw => {
    const e = env(); e.IFTTT_LUNA_CAPTURE_CONFIG = raw as string; e.IFTTT_LUNA_REVIEW_CONFIG = raw as string;
    expect(readCaptureRuntimeConfig(e, NOW)).toBeNull(); expect(readWorkerRuntimeConfig(e, NOW)).toBeNull();
  });
  it.each([
    { startsAt: "now" }, { expiresAt: "2026-11-05T04:00:00.001Z" }, { expiresAt: capture.startsAt },
    { scope: { ...capture.scope, policyId: "wrong" } }, { scope: { ...capture.scope, appletId: "" } },
    { scope: { ...capture.scope, sourceAccount: "@someone" } }, { extra: true },
  ])("refuses invalid window or binding %#", change => {
    const e = env(); e.IFTTT_LUNA_CAPTURE_CONFIG = JSON.stringify({ ...capture, ...change });
    expect(readCaptureRuntimeConfig(e, NOW)).toBeNull();
  });
  it("requires an active window, including stopping exactly at expiry", () => {
    for (const time of [Date.parse(capture.startsAt) - 1, Date.parse(capture.expiresAt), NaN]) {
      expect(readCaptureRuntimeConfig(env(), time)).toBeNull(); expect(readWorkerRuntimeConfig(env(), time)).toBeNull();
    }
    expect(readCaptureRuntimeConfig(env(), Date.parse(capture.startsAt))).toEqual(capture);
    expect(readWorkerRuntimeConfig(env(), NOW)).toEqual(worker);
  });
  it("requires the separately approved worker job and all digests", () => {
    for (const job of [undefined, { ...worker.job, inputHash: "wrong" }, { ...worker.job, id: "wrong" }]) {
      expect(readWorkerRuntimeConfig({ ...env(), IFTTT_LUNA_REVIEW_CONFIG: JSON.stringify({ ...worker, job }) }, NOW)).toBeNull();
    }
  });
  it("stops when time, scope, approved job or enabling flag changes", () => {
    expect(captureRuntimeStillEnabled(env(), capture, NOW)).toBe(true);
    expect(workerRuntimeStillEnabled(env(), worker, NOW)).toBe(true);
    expect(captureRuntimeStillEnabled(env(), capture, Date.parse(capture.expiresAt))).toBe(false);
    expect(workerRuntimeStillEnabled({ ...env(), IFTTT_LUNA_REVIEW_ENABLED: "false" }, worker, NOW)).toBe(false);
    expect(captureRuntimeStillEnabled(env(), { ...capture, scope: { ...capture.scope, policyId: OTHER } }, NOW)).toBe(false);
    expect(workerRuntimeStillEnabled(env(), { ...worker, job: { ...worker.job, receiptHash: "d".repeat(64) } }, NOW)).toBe(false);
    expect(workerRuntimeStillEnabled(env(), null, NOW)).toBe(false);
  });
});

describe("approved worker binding before provider admission", () => {
  it("refuses a different job before claiming", async () => {
    const { store } = storeFixture();
    await expect(bindWorkerRuntimeStore(store, worker).claim(OTHER)).rejects.toThrow("unapproved_runtime_job");
    expect(store.claim).not.toHaveBeenCalled(); expect(store.hold).not.toHaveBeenCalled();
  });
  it.each(["id", "inputHash", "receiptHash", "referenceHash", "provenanceRef"])("holds mismatched %s", async field => {
    const { store, job } = storeFixture(); (job as Record<string, unknown>)[field] = "wrong";
    await expect(bindWorkerRuntimeStore(store, worker).claim(ID)).rejects.toThrow("runtime_job_held");
    expect(store.hold).toHaveBeenCalledWith(ID); expect(store.admission).not.toHaveBeenCalled();
  });
  it.each(["policyId", "appletId", "sourceAccount"])("holds mismatched archive scope %s", async field => {
    const { store, job } = storeFixture(), receipt = JSON.parse(job.receiptJson);
    receipt.archive.envelope.scope[field] = "different"; job.receiptJson = JSON.stringify(receipt);
    await expect(bindWorkerRuntimeStore(store, worker).claim(ID)).rejects.toThrow("runtime_job_held");
    expect(store.hold).toHaveBeenCalledWith(ID);
  });
  it("passes exact metadata on to the existing strict byte validation", async () => {
    const { store, job } = storeFixture(); expect(await bindWorkerRuntimeStore(store, worker).claim(ID)).toEqual({ status: "claimed", job });
    expect(store.hold).not.toHaveBeenCalled();
  });
  it("never retries an ambiguous claim or fabricates its hold", async () => {
    const { store } = storeFixture(); vi.mocked(store.claim).mockRejectedValue(new Error("unknown"));
    await expect(bindWorkerRuntimeStore(store, worker).claim(ID)).rejects.toThrow("unknown");
    expect(store.claim).toHaveBeenCalledOnce(); expect(store.hold).not.toHaveBeenCalled();
  });
});

describe("actual routes with synthetic configuration and mocked persistence", () => {

  it("completes actual capture and bound worker routes with real adapters and mocked RPC/provider", async () => {
    // Real route modules, configuration/binding, byte/hash/source validation,
    // draft preparation, adapters and transport. Only RPC responses/owner staging
    // and provider fetch are simulated; this is not database or deployed proof.
    const actualArchive = await vi.importActual<typeof import("./archiveStore")>("./archiveStore");
    const actualWorker = await vi.importActual<typeof import("./store")>("./store");
    const entry = createLunaEvaluationBatch().content.entries[3]!, source = entry.input.packet.source;
    const configuredCapture = { ...capture, scope: { ...capture.scope, sourceAccount: source.author! } };
    let archive: ArchiveRecord | undefined;
    let stagedJob: Record<string, unknown> | undefined;
    let completed = false;
    let settled: Record<string, unknown> | undefined;
    let saved: any;
    const actions: string[] = [];
    const rpc = vi.fn((name: string, args: Record<string, any>) => ({ abortSignal: async (signal: AbortSignal) => {
      expect(signal.aborted).toBe(false);
      actions.push(`${name}:${args.p_action}`);
      if (name === "luna_capture_archive_rpc") {
        expect(args.p_action).toBe("retain"); expect(args.p_policy_id).toBe(ID);
        const envelope = JSON.parse(args.p_payload.envelopeJson);
        const receipt = { id: OTHER, kind: "luna-isolated-archive-v1" as const, policyId: ID,
          appletId: envelope.scope.appletId, deliveryKey: envelope.deliveryKey, payloadSha256: envelope.payloadSha256,
          byteLength: envelope.byteLength, firstReceivedAt: envelope.receivedAt, classification: "baseline" as const };
        archive = { envelope, receipt };
        return { data: { status: "retained", receipt }, error: null };
      }
      expect(name).toBe("luna_hosted_review_rpc"); expect(args.p_job_id).toBe(ID);
      const base = { version: HOSTED_LUNA_VERSION, jobId: ID };
      if (args.p_action === "claim") return { data: { ...base, status: completed ? "completed" : "claimed", job: stagedJob }, error: null };
      if (args.p_action === "reserve") {
        expect(args.p_payload.amountNanoUsd).toBe(LUNA_RESERVATION_NANO_USD);
        return { data: { ...base, status: "reserved" }, error: null };
      }
      if (args.p_action === "settle") {
        settled = JSON.parse(args.p_payload.receiptJson);
        return { data: { ...base, status: "settled" }, error: null };
      }
      if (args.p_action === "finish") {
        saved = JSON.parse(args.p_payload.resultJson); completed = true;
        return { data: { ...base, status: "completed" }, error: null };
      }
      throw new Error("unexpected synthetic RPC action");
    } }));
    const db = { rpc } as unknown as IftttRpcClient;
    vi.mocked(createLunaArchiveStore).mockImplementation(() => actualArchive.createLunaArchiveStore(db));
    vi.mocked(createHostedLunaStore).mockImplementation(() => actualWorker.createHostedLunaStore(db));
    activate("capture"); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW);
    vi.stubEnv("IFTTT_LUNA_CAPTURE_CONFIG", JSON.stringify(configuredCapture));
    const raw = JSON.stringify({ text: source.text, username: source.author, link_to_tweet: source.url, created_at: "unverified label" });
    const captureRequest = Object.assign(Readable.from([Buffer.from(raw)]), { method: "POST", headers: {
      "content-type": "application/json", "x-fhfh-luna-capture-secret": SECRET } });
    const retained = response(); await captureRoute(captureRequest as unknown as NextApiRequest, retained);
    expect(retained.statusCode).toBe(200); expect(retained.body).toMatchObject({ status: "retained", receiptId: OTHER, canEnqueue: false });
    expect(createHostedLunaStore).not.toHaveBeenCalled(); expect(archive!.envelope.rawBody).toBe(raw);
    const clock = new Date(NOW).toISOString();
    const draft = prepareArchivedLunaDraft({ enabled: true, archive, sourceReview: {
      basis: "owner-reviewed-direct-source", receiptId: OTHER, payloadSha256: archive!.receipt.payloadSha256,
      textSha256: createHash("sha256").update(source.text).digest("hex"), postId: source.originalPostId!, author: source.author!,
      url: `https://x.com/${source.author!.toLowerCase()}/status/${source.originalPostId}`, publishedAt: source.publishedAt!,
      reviewedAt: clock, reviewerRef: "synthetic-owner", evidenceRef: "synthetic-original-snapshot", permissionRef: "synthetic-only",
    }, context: { jobId: ID, provenanceRef: "synthetic-runtime-reviewed-archive", preparedAt: clock,
      extractionVersion: entry.input.extractionVersion, claims: [], statements: [], identity: entry.input.identity! } });
    expect(draft.status).toBe("prepared_for_owner_review"); if (draft.status !== "prepared_for_owner_review") throw new Error("fixture not prepared");
    stagedJob = draft.draft.envelope; // Simulates separately reviewed owner-only SQL staging.
    const job = draft.draft.envelope;
    const approvedConfig = { ...configuredCapture, job: { id: job.id, inputHash: job.inputHash, receiptHash: job.receiptHash,
      referenceHash: job.referenceHash, provenanceRef: job.provenanceRef } };
    vi.stubEnv("IFTTT_LUNA_CAPTURE_ENABLED", "false"); vi.stubEnv("IFTTT_LUNA_REVIEW_ENABLED", "true");
    vi.stubEnv("IFTTT_LUNA_REVIEW_CONFIG", JSON.stringify(approvedConfig)); vi.stubEnv("OPENAI_API_KEY", "synthetic-never-transmitted-key");
    const fetcher = vi.fn(async (_url: unknown, init: any) => {
      const envelope = JSON.parse(JSON.parse(init.body).input), identity = envelope.identityRequest;
      const output = { identity: { version: identity.version, requestHash: envelope.identityRequestHash,
        directoryHash: identity.directory.hash, occurrences: entry.expected.identity.map(o => ({ ...o, identityConfidence: "strong" })) },
      goalieStatuses: entry.expected.goalie };
      return new Response(JSON.stringify({ id: "synthetic-runtime-response", status: "completed", model: LUNA_MODEL,
        usage: { input_tokens: 100, output_tokens: 50 }, output: [{ type: "message", role: "assistant",
          content: [{ type: "output_text", text: JSON.stringify(output) }] }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetcher);
    const request = { method: "POST", headers: { authorization: `Bearer ${SECRET}` }, body: { jobId: ID } } as NextApiRequest;
    const result = response(); await workerRoute(request, result);
    expect(result.statusCode).toBe(200); expect(result.body).toMatchObject({ status: "completed", canPublish: false, canChangeStatus: false });
    expect(fetcher).toHaveBeenCalledOnce(); expect(settled).toMatchObject({ endpoint: "responses" });
    expect(saved.review).toMatchObject({ canPublish: false, canChangeStatus: false, canWriteAliases: false });
    const replay = response(); await workerRoute(request, replay);
    expect(replay.body).toMatchObject({ status: "completed", replay: true }); expect(fetcher).toHaveBeenCalledOnce();
    expect(actions).toEqual(["luna_capture_archive_rpc:retain", "luna_hosted_review_rpc:claim", "luna_hosted_review_rpc:reserve",
      "luna_hosted_review_rpc:settle", "luna_hosted_review_rpc:finish", "luna_hosted_review_rpc:claim"]);
  });
  it("captures once with exact scope without dispatching a worker", async () => {
    activate("capture");
    const retain = vi.fn(async input => ({ status: "retained" as const, receipt: { id: OTHER, kind: "luna-isolated-archive-v1" as const,
      policyId: input.scope.policyId, appletId: input.scope.appletId, deliveryKey: input.deliveryKey, payloadSha256: input.payloadSha256,
      byteLength: input.byteLength, firstReceivedAt: input.receivedAt, classification: "baseline" as const } }));
    vi.mocked(createLunaArchiveStore).mockReturnValue({ retain, lookupExact: vi.fn() });
    const req = Object.assign(Readable.from([Buffer.from(JSON.stringify({ text: "Synthetic original report", username: "TestReporter",
      link_to_tweet: "https://x.com/TestReporter/status/1234", created_at: "synthetic submitted date" }))]),
    { method: "POST", headers: { "content-type": "application/json", "x-fhfh-luna-capture-secret": SECRET } });
    const res = response(); await captureRoute(req as unknown as NextApiRequest, res);
    expect(res.statusCode).toBe(200); expect(retain).toHaveBeenCalledOnce();
    expect(retain.mock.calls[0]![0].scope).toEqual(capture.scope); expect(createHostedLunaStore).not.toHaveBeenCalled();
    const workerRes = response(); await workerRoute({ method: "POST" } as NextApiRequest, workerRes);
    expect(workerRes.body.status).toBe("disabled");
  });
  it("holds a conflicting approved job through the actual worker route without admission", async () => {
    activate("worker"); const { store, job } = storeFixture(); job.referenceHash = "d".repeat(64);
    vi.mocked(createHostedLunaStore).mockReturnValue(store);
    const res = response(); await workerRoute({ method: "POST", headers: { authorization: `Bearer ${SECRET}` }, body: { jobId: ID } } as NextApiRequest, res);
    expect(res.statusCode).toBe(503); expect(res.body.reconciliationRequired).toBe(true);
    expect(store.hold).toHaveBeenCalledOnce(); expect(store.admission).not.toHaveBeenCalled();
    expect(createLunaArchiveStore).not.toHaveBeenCalled();
  });
  it("keeps both routes closed when only enabling flags are set", async () => {
    activate("worker"); vi.stubEnv("IFTTT_LUNA_CAPTURE_ENABLED", "true");
    vi.stubEnv("IFTTT_LUNA_CAPTURE_CONFIG", "{}"); vi.stubEnv("IFTTT_LUNA_REVIEW_CONFIG", "{}");
    for (const route of [captureRoute, workerRoute]) {
      const res = response(); await route({ method: "POST" } as NextApiRequest, res);
      expect(res.body.status).toBe("disabled");
    }
    expect(createLunaArchiveStore).not.toHaveBeenCalled(); expect(createHostedLunaStore).not.toHaveBeenCalled();
  });
});
