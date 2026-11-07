// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import type { NextApiRequest, NextApiResponse } from "next";
import type { IftttRpcClient } from "../iftttRpcDeadline";
import { LUNA_MODEL } from "../tweetLunaTransport";
import { createLunaArchiveStore } from "./archiveStore";
import { createHostedLunaStore } from "./store";
import { createHostedLunaHandler } from "./handler";
import { createLunaEvaluationBatch } from "../fixtures/tweetLunaEvaluation";
import { mapTweetDecisionReview } from "../tweetDecisionReviewMapping";
import { prepareTweetReviewPacket } from "../tweetReviewSidecar";
import { prepareCaptureEnvelope, createIsolatedLunaCaptureHandler } from "./capture";
import { makeArchiveReviewReceipt, reviewReceiptLineage, type ArchiveRecord, type ArchiveSourceReview } from "./archiveReceipt";
import { prepareArchivedLunaDraft } from "./archiveBridge";
import { validateHostedLunaJob } from "./contract";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
function fixture() {
  const input = structuredClone(createLunaEvaluationBatch().content.entries[3]!.input), s = input.packet.source;
  const envelope = prepareCaptureEnvelope(Buffer.from(JSON.stringify({ Text: s.text, UserName: s.author,
    LinkToTweet: s.url, CreatedAt: "supplied label is not a verified clock" })), {
    policyId: "00000000-0000-4000-8000-000000000001", appletId: "synthetic", sourceAccount: s.author!,
  }, s.ingestedAt);
  const receipt = { id: "00000000-0000-4000-8000-000000000002", kind: "luna-isolated-archive-v1" as const,
    policyId: envelope.scope.policyId, appletId: envelope.scope.appletId, deliveryKey: envelope.deliveryKey,
    payloadSha256: envelope.payloadSha256, byteLength: envelope.byteLength, firstReceivedAt: envelope.receivedAt,
    classification: "baseline" as const };
  const archive: ArchiveRecord = { envelope, receipt };
  const sourceReview: ArchiveSourceReview = { basis: "owner-reviewed-direct-source", receiptId: receipt.id,
    payloadSha256: receipt.payloadSha256, textSha256: sha(s.text), postId: s.originalPostId!, author: s.author!,
    url: `https://x.com/${s.author!.toLowerCase()}/status/${s.originalPostId}`, publishedAt: s.publishedAt!,
    reviewedAt: "2026-11-05T00:00:00Z", reviewerRef: "synthetic-owner", evidenceRef: "synthetic-original-snapshot",
    permissionRef: "synthetic-test-only" };
  const context = { jobId: "00000000-0000-4000-8000-000000000003", provenanceRef: "synthetic-reviewed-archive",
    preparedAt: "2026-11-05T00:00:00Z", extractionVersion: input.extractionVersion,
    claims: [], statements: [], identity: input.identity! };
  return { archive, sourceReview, context };
}
function packet(f: ReturnType<typeof fixture>, review: ArchiveSourceReview | null = f.sourceReview) {
  const receipt = makeArchiveReviewReceipt(f.archive, review);
  const source = { tweetId: receipt.inputRow.tweet_id, rawText: receipt.inputRow.text,
    rawPayload: receipt.inputRow.raw_payload, sourceUrl: receipt.inputRow.link_to_tweet,
    tweetPostedAt: receipt.inputRow.tweet_created_at, observedAt: receipt.receivedAt } as any;
  return prepareTweetReviewPacket({ receipt, source, claims: [] });
}
// This single opt-in integration case is invoked only by our disposable-cluster
// runner. It verifies the private target before SQL; normal offline runs skip it.
const localTargetFile = process.env.LUNA_ARCHIVE_TEST_TARGET;
function localResponse() {
  const res = { code: 0, body: {} as any, setHeader: vi.fn(), status(code: number) { this.code = code; return this; },
    json(body: unknown) { this.body = body; return this; } };
  return res as typeof res & NextApiResponse;
}
describe("truthful private archive bridge", () => {
  it.skipIf(!localTargetFile)("complete private archive to draft to SQL stage to worker round trip with mocked provider", async () => {
    const target = JSON.parse(readFileSync(localTargetFile!, "utf8"));
    expect(target.root).toMatch(/^\/private\/tmp\/fhfh-luna-archive-pg-[A-Za-z0-9_-]+$/);
    expect(target.data).toBe(join(target.root, "data")); expect(target.socket).toBe(join(target.root, "sock"));
    expect(target.user).toBe("luna_archive_fixture"); expect(target.database).toBe("postgres");
    expect(target.ownerToken).toMatch(/^[a-f0-9]{64}$/);
    expect(readFileSync(join(target.root, "owner-token"), "utf8")).toBe(target.ownerToken);
    const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'";
    const query = (sql: string) => execFileSync("/opt/homebrew/opt/postgresql@17/bin/psql", ["-X", "-w", "-h", target.socket,
      "-p", "5432", "-U", target.user, "-d", target.database, "-At", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { encoding: "utf8", timeout: 10_000, env: { NODE_ENV: "test", PATH: "/usr/bin:/bin", PGPASSFILE: "/dev/null", PGSERVICEFILE: "/dev/null", LC_ALL: "C", LANG: "C" }, stdio: ["ignore", "pipe", "pipe"] }).trim();
    const verified = JSON.parse(query("select json_build_object('data',current_setting('data_directory'),'socket',current_setting('unix_socket_directories'),'listen',current_setting('listen_addresses'),'user',current_user,'database',current_database(),'address',inet_server_addr())"));
    expect(verified).toEqual({ data: target.data, socket: target.socket, listen: "", user: target.user, database: target.database, address: null });
    // Only this new test cluster is mutated. No deployed/ambient DB is accepted.
    query("truncate luna_capture.enrollments,luna_capture.approvals,luna_capture.receipts,luna_capture.policy,luna_hosted.attempts,luna_hosted.jobs,luna_hosted.sources,luna_hosted.policy");
    const f = fixture(), scope = f.archive.envelope.scope;
    query(`insert into luna_capture.policy(id,applet_id,source_account,enabled,starts_at,expires_at,max_attempts,max_receipts,max_bytes) values (${literal(scope.policyId)},${literal(scope.appletId)},${literal(scope.sourceAccount)},true,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',5,1,10000)`);
    const db = { rpc(name: string, args: Record<string, unknown>) { return { abortSignal(signal: AbortSignal) {
      if (signal.aborted) throw new Error("aborted local fixture");
      if (name !== "luna_capture_archive_rpc" && name !== "luna_hosted_review_rpc") throw new Error("unexpected fixture RPC");
      const id = name === "luna_capture_archive_rpc" ? args.p_policy_id : args.p_job_id;
      const data = JSON.parse(query(`set role service_role; select public.${name}(${literal(String(args.p_action))},${literal(String(id))},${literal(JSON.stringify(args.p_payload))}::jsonb)`).split("\n").at(-1)!);
      return Promise.resolve({ data, error: null });
    } }; } } as unknown as IftttRpcClient;
    const capture = createIsolatedLunaCaptureHandler({ enabled: () => true, secret: () => "synthetic-capture-key-000000000000", scope: () => scope,
      store: () => createLunaArchiveStore(db), now: () => f.archive.envelope.receivedAt });
    const request = Object.assign(Readable.from([Buffer.from(f.archive.envelope.rawBody)]), { method: "POST", headers: {
      "content-type": "application/json", "x-fhfh-luna-capture-secret": "synthetic-capture-key-000000000000" } }) as unknown as NextApiRequest;
    const captured = localResponse(); await capture(request, captured); expect(captured.body.status).toBe("retained");
    const archive = JSON.parse(query(`select luna_capture.load_for_owner(${literal(captured.body.receiptId)})`));
    f.sourceReview.receiptId = archive.receipt.id;
    const draft = prepareArchivedLunaDraft({ enabled: true, ...f, archive });
    expect(draft.status).toBe("prepared_for_owner_review"); if (draft.status !== "prepared_for_owner_review") throw new Error();
    const job = draft.draft.envelope;
    query("insert into luna_hosted.policy values(true,'synthetic-roundtrip',false,false,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',1,233000000,0)");
    const approvalId = "00000000-0000-4000-8000-000000000004";
    query("insert into luna_capture.approvals(id,receipt_id,job_id,worker_approval_id,input_json,input_hash,receipt_json,receipt_hash,reference_hash,provenance_ref) values (" +
      [approvalId, archive.receipt.id, job.id, "synthetic-roundtrip", job.inputJson, job.inputHash, job.receiptJson, job.receiptHash, job.referenceHash, job.provenanceRef].map(literal).join(",") + ")");
    expect(query(`select luna_capture.stage_for_owner(${literal(approvalId)})`)).toBe(job.id);
    expect(query("select enabled from luna_hosted.policy")).toBe("f");
    // Local mock dispatch only, separately enabled in this owned synthetic DB.
    query("update luna_hosted.policy set enabled=true");
    const expected = createLunaEvaluationBatch().content.entries[3]!.expected;
    const fetcher = vi.fn(async (_url: any, init: any) => {
      const envelope = JSON.parse(JSON.parse(init.body).input), identity = envelope.identityRequest;
      const output = { identity: { version: identity.version, requestHash: envelope.identityRequestHash,
        directoryHash: identity.directory.hash, occurrences: expected.identity.map(o => ({ ...o, identityConfidence: "strong" })) }, goalieStatuses: expected.goalie };
      return new Response(JSON.stringify({ id: "synthetic-roundtrip-response", status: "completed", model: LUNA_MODEL,
        usage: { input_tokens: 100, output_tokens: 50 }, output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(output) }] }] }), { status: 200 });
    });
    const worker = createHostedLunaHandler({ enabled: () => true, workerSecret: () => "synthetic-worker-key-0000000000000",
      store: () => createHostedLunaStore(db), apiKey: () => "synthetic-unused-key", fetch: fetcher, now: () => f.context.preparedAt });
    const workerRequest = { method: "POST", body: { jobId: job.id }, headers: { authorization: "Bearer synthetic-worker-key-0000000000000" } } as NextApiRequest;
    const completed = localResponse(); await worker(workerRequest, completed);
    expect(completed.body.status).toBe("completed"); expect(fetcher).toHaveBeenCalledTimes(1);
    const replay = localResponse(); await worker(workerRequest, replay);
    expect(replay.body).toMatchObject({ status: "completed", replay: true }); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(query("select count(*) from luna_capture.enrollments")).toBe("1");
    expect(query("select state from luna_hosted.attempts")).toBe("settled");
    const saved = JSON.parse(query("select result_json from luna_hosted.jobs"));
    expect(saved.review).toMatchObject({ canPublish: false, canChangeStatus: false, canWriteAliases: false });
    expect(query("select (select count(*) from public.line_source_ifttt_events)+(select count(*) from public.lines_ccc_ifttt_events)")).toBe("0");
    writeFileSync(join(dirname(localTargetFile!), "roundtrip-result.json"), JSON.stringify({ status: "passed", archiveReceiptId: archive.receipt.id,
      jobId: job.id, mockedProviderCalls: fetcher.mock.calls.length, realProviderCalls: 0, stagedJobs: 1, replayWithoutDispatch: true }) + "\n");
  }, 30_000);

  it("defaults disabled before reading archive material", () => {
    expect(prepareArchivedLunaDraft({ get archive(): never { throw new Error(); } }).status).toBe("disabled");
  });
  it("prepares an archive-bound owner draft accepted by the existing worker contract", () => {
    const f = fixture(), result = prepareArchivedLunaDraft({ enabled: true, ...f });
    expect(result.status).toBe("prepared_for_owner_review");
    if (result.status !== "prepared_for_owner_review") throw new Error();
    const input = validateHostedLunaJob(result.draft.envelope, f.context.jobId);
    expect(input.packet.source.retainedSourceId).toBe(`luna_capture.receipts:${f.archive.receipt.id}`);
    expect(input.packet.receiptSnapshot).toMatchObject({ kind: "luna-isolated-review-receipt-v1",
      eventTable: "luna_capture.receipts", id: f.archive.receipt.id, eventId: f.archive.receipt.id });
    expect(result).toMatchObject({ sourceAuthenticated: false, canEnqueue: false, providerDispatchEnabled: false });
    expect(input.packet.source.publishedAt).toBe(f.sourceReview.publishedAt);
  });
  it("retains missing-source review holds even if packet holds are stripped", () => {
    const f = fixture(), p = packet(f, null);
    expect(p.holds).toContain("archive_original_source_review_required");
    p.holds = []; p.wholePost.holds = [];
    const mapped = mapTweetDecisionReview({ enabled: true, packet: p, extractionVersion: f.context.extractionVersion });
    expect(mapped.status).toBe("held");
    if (mapped.status === "held") expect(mapped.reasons).toContain("archive_original_source_review_required");
    expect(prepareArchivedLunaDraft({ enabled: true, ...f, sourceReview: null }).status).toBe("held");
  });
  it("retains variant holds even with valid owner source metadata and stripped packet holds", () => {
    const f = fixture(); f.archive.receipt.classification = "variant";
    const p = packet(f); p.holds = []; p.wholePost.holds = [];
    const mapped = mapTweetDecisionReview({ enabled: true, packet: p, extractionVersion: f.context.extractionVersion });
    expect(mapped.status).toBe("held");
    if (mapped.status === "held") expect(mapped.reasons).toContain("archive_variant_requires_review");
  });
  it.each(["bytes", "hash", "id", "projection", "kind"])("rejects altered %s without inventing legacy lineage", kind => {
    const f = fixture(), r = structuredClone(makeArchiveReviewReceipt(f.archive, f.sourceReview));
    if (kind === "bytes") (r.archive.envelope as any).rawBody += " ";
    if (kind === "hash") r.archive.receipt.payloadSha256 = "a".repeat(64);
    if (kind === "id") r.eventId = f.context.jobId;
    if (kind === "projection") r.inputRow.text = "changed";
    if (kind === "kind") (r as any).eventTable = "line_source_ifttt_events";
    expect(() => reviewReceiptLineage(r)).toThrow();
  });
  it.each(["receiptId", "payloadSha256", "textSha256", "postId", "author", "url", "permissionRef"])("requires bound owner evidence %s", field => {
    const f = fixture(); (f.sourceReview as any)[field] = "";
    expect(prepareArchivedLunaDraft({ enabled: true, ...f }).status).toBe("held");
  });
  it("does not turn relay access into original-source review", () => {
    const f = fixture(), e = f.archive.envelope;
    const raw = JSON.parse(e.rawBody); raw.UserName = "GameDayGoalies"; raw.LinkToTweet = `https://x.com/GameDayGoalies/status/${e.submitted.postId}`;
    f.archive.envelope = prepareCaptureEnvelope(Buffer.from(JSON.stringify(raw)), { ...e.scope, sourceAccount: "GameDayGoalies" }, e.receivedAt);
    Object.assign(f.archive.receipt, { payloadSha256: f.archive.envelope.payloadSha256,
      byteLength: f.archive.envelope.byteLength, deliveryKey: f.archive.envelope.deliveryKey });
    Object.assign(f.sourceReview, { payloadSha256: f.archive.receipt.payloadSha256, author: "GameDayGoalies",
      url: `https://x.com/gamedaygoalies/status/${e.submitted.postId}` });
    expect(prepareArchivedLunaDraft({ enabled: true, ...f }).status).toBe("held");
  });
  it("holds mismatched publication and review clocks", () => {
    for (const change of [{ publishedAt: "2030-01-01T00:00:00Z" }, { reviewedAt: "2000-01-01T00:00:00Z" }, { reviewedAt: "2030-01-01T00:00:00Z" }]) {
      const f = fixture(); Object.assign(f.sourceReview, change);
      expect(prepareArchivedLunaDraft({ enabled: true, ...f }).status).toBe("held");
    }
  });
});
