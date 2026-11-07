// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";
import { identityDigest } from "../playerIdentitySnapshot";
import { createLunaEvaluationBatch } from "../fixtures/tweetLunaEvaluation";
import { getLunaReferencePackage } from "../tweetLunaReference";
import { LUNA_MODEL, LUNA_RESERVATION_NANO_USD } from "../tweetLunaTransport";
import type { HostedLunaResult, HostedLunaStore } from "./store";
import { createHostedLunaHandler } from "./handler";
import { validateHostedLunaJob } from "./contract";
import route from "../../../pages/api/internal/luna-review";

const ID = "f40f38e5-03dd-4f70-a0a2-7934a49fc5c6";
const SECRET = "synthetic-worker-secret-not-a-credential";
const NOW = "2026-11-04T00:00:00Z";
function fixture() {
  const entry = createLunaEvaluationBatch().content.entries[0]!;
  const input = structuredClone(entry.input); input.decisions = false;
  return { entry, input, job: { id: ID, inputJson: JSON.stringify(input), inputHash: identityDigest(input),
    referenceHash: getLunaReferencePackage("rules-and-synthetic-only").hash,
    receiptJson: JSON.stringify(input.packet.receiptSnapshot), receiptHash: identityDigest(input.packet.receiptSnapshot),
    provenanceRef: "synthetic-retention-fixture; not a real report" } };
}
function response() {
  const result = { code: 0, body: undefined as any, headers: {} as Record<string, string> };
  const res = { setHeader(k: string, v: string) { result.headers[k] = v; },
    status(n: number) { result.code = n; return res; }, json(body: unknown) { result.body = body; return res; } };
  return { res: res as unknown as NextApiResponse, result };
}
function request(body: unknown = { jobId: ID }, authorization: unknown = `Bearer ${SECRET}`, method = "POST") {
  return { body, method, headers: { authorization } } as NextApiRequest;
}
function harness(options: { offsetFailure?: boolean; providerFailure?: boolean; finishFailure?: boolean } = {}) {
  const f = fixture();
  const admission = { reserve: vi.fn(async () => ({ status: "reserved" as const })),
    settle: vi.fn(async () => undefined), uncertain: vi.fn(async () => undefined) };
  const saved: HostedLunaResult[] = [];
  const store: HostedLunaStore = { claim: vi.fn(async () => ({ status: "claimed" as const, job: f.job })),
    admission: vi.fn(() => admission), finish: vi.fn(async (_id, result) => {
      if (options.finishFailure) throw new Error("private storage detail");
      saved.push(result);
    }), hold: vi.fn(async () => undefined) };
  const fetcher = vi.fn(async (_url: any, init: any) => {
    if (options.providerFailure) throw new Error("private provider detail");
    const wire = JSON.parse(init.body), envelope = JSON.parse(wire.input);
    const content = envelope.identityRequest;
    const output = { identity: { version: content.version, requestHash: envelope.identityRequestHash,
      directoryHash: content.directory.hash, occurrences: f.entry.expected.identity.map(o => ({ ...o, identityConfidence: "strong" })) },
      goalieStatuses: structuredClone(f.entry.expected.goalie) };
    if (options.offsetFailure) output.goalieStatuses[0]!.evidence.end--;
    return new Response(JSON.stringify({ id: "synthetic-response", status: "completed", model: LUNA_MODEL,
      usage: { input_tokens: 100, output_tokens: 50 }, output: [{ type: "message", role: "assistant",
        content: [{ type: "output_text", text: JSON.stringify(output) }] }] }), { status: 200, headers: { "x-request-id": "synthetic-receipt" } });
  });
  const deps = { enabled: vi.fn(() => true), workerSecret: vi.fn(() => SECRET),
    store: vi.fn(() => store), apiKey: vi.fn(() => "synthetic-unused-key"), fetch: fetcher, now: () => NOW };
  return { ...f, admission, store, saved, fetcher, deps, handler: createHostedLunaHandler(deps) };
}

describe("disabled hosted Luna boundary", () => {
  it("the actual route defaults off without approved runtime configuration", async () => {
    const { res, result } = response(); await route(request(), res);
    expect(result.code).toBe(503); expect(result.body).toEqual({ status: "disabled" });
  });
  it("gates method/disabled before secret, store and provider access", async () => {
    const h = harness(); h.deps.enabled.mockReturnValue(false);
    for (const method of ["GET", "POST"]) {
      const { res, result } = response(); await h.handler(request(undefined, undefined, method), res);
      expect(result.code).toBe(method === "GET" ? 405 : 503);
      expect(result.headers["Cache-Control"]).toBe("no-store");
    }
    expect(h.deps.workerSecret).not.toHaveBeenCalled(); expect(h.deps.store).not.toHaveBeenCalled();
    expect(h.fetcher).not.toHaveBeenCalled(); expect(h.deps.apiKey).not.toHaveBeenCalled();
  });
  it.each([undefined, "Bearer wrong", [`Bearer ${SECRET}`], "x".repeat(5000)])("rejects invalid authentication %#", async header => {
    const h = harness(), { res, result } = response();
    const req = request(); req.headers.authorization = header as string;
    await h.handler(req, res); expect(result.code).toBe(401); expect(h.deps.store).not.toHaveBeenCalled();
  });
  it.each([{ jobId: ID, input: {} }, { jobId: "not-a-uuid" }, null, { jobId: ID, decisions: true }])("accepts only a job ID %#", async body => {
    const h = harness(), { res, result } = response(); await h.handler(request(body), res);
    expect(result.code).toBe(400); expect(h.store.claim).not.toHaveBeenCalled();
  });
  it("normalizes an uppercase HTTP job ID before claiming and completing", async () => {
    const h = harness(), { res, result } = response();
    await h.handler(request({ jobId: ID.toUpperCase() }), res);
    expect(result.code).toBe(200); expect(result.body).toMatchObject({ jobId: ID, status: "completed" });
    expect(h.store.claim).toHaveBeenCalledWith(ID);
    expect(h.store.finish).toHaveBeenCalledWith(ID, expect.any(Object));
    expect(h.store.hold).not.toHaveBeenCalled(); expect(h.fetcher).toHaveBeenCalledOnce();
  });
  it("persists an original review without returning source text or model content", async () => {
    const h = harness(), { res, result } = response(); await h.handler(request(), res);
    expect(result.code).toBe(200); expect(result.body.status).toBe("completed");
    expect(h.fetcher).toHaveBeenCalledTimes(1); expect(h.admission.reserve).toHaveBeenCalledWith(expect.any(String), LUNA_RESERVATION_NANO_USD);
    expect(h.saved[0]!.review.status).toBe("review_only"); expect(h.saved[0]!.review.goalieStatuses[0]!.verified).toBe(false);
    expect(h.saved[0]!.review.canPublish).toBe(false); expect(h.saved[0]!.review.decisionReview).toBeNull();
    expect(JSON.stringify(result.body)).not.toContain("Avery"); expect(h.store.hold).not.toHaveBeenCalled();
  });
  it("keeps the failed original and separate unapplied span candidate", async () => {
    const h = harness({ offsetFailure: true }), { res, result } = response(); await h.handler(request(), res);
    expect(result.body.status).toBe("held"); expect(h.saved[0]!.review.holds).toContain("goalie_subject_binding_invalid");
    expect(h.saved[0]!.candidate?.content.canApply).toBe(false); expect(h.fetcher).toHaveBeenCalledTimes(1);
  });
  it("retains uncertainty without a provider retry", async () => {
    const h = harness({ providerFailure: true }), { res, result } = response(); await h.handler(request(), res);
    expect(h.admission.uncertain).toHaveBeenCalledTimes(1); expect(h.fetcher).toHaveBeenCalledTimes(1);
    expect(result.body.status).toBe("held"); expect(JSON.stringify(result.body)).not.toContain("private");
  });
  it("holds a lost finish acknowledgment without rerunning the model", async () => {
    const h = harness({ finishFailure: true }), { res, result } = response(); await h.handler(request(), res);
    expect(result.code).toBe(503); expect(result.body.reconciliationRequired).toBe(true);
    expect(h.store.hold).toHaveBeenCalledWith(ID); expect(h.fetcher).toHaveBeenCalledTimes(1);
  });
  it("a completed duplicate returns only status without provider or key access", async () => {
    const h = harness(), { res, result } = response(); vi.mocked(h.store.claim).mockResolvedValue({ status: "completed" });
    await h.handler(request(), res); expect(result.body.replay).toBe(true);
    expect(h.fetcher).not.toHaveBeenCalled(); expect(h.deps.apiKey).not.toHaveBeenCalled();
  });
  it("a refused/unknown claim cannot trigger admission or a second mutation", async () => {
    const h = harness(), { res, result } = response(); vi.mocked(h.store.claim).mockRejectedValue(new Error("unknown"));
    await h.handler(request(), res); expect(result.code).toBe(503); expect(h.store.hold).not.toHaveBeenCalled();
    expect(h.store.admission).not.toHaveBeenCalled(); expect(h.fetcher).not.toHaveBeenCalled();
  });
  it("budget refusal never reads the provider key or fetches", async () => {
    const h = harness(), { res, result } = response(); h.admission.reserve.mockRejectedValue(new Error("luna_budget_stopped"));
    await h.handler(request(), res); expect(result.body.status).toBe("held");
    expect(h.deps.apiKey).not.toHaveBeenCalled(); expect(h.fetcher).not.toHaveBeenCalled();
  });
  it("a stop after durable reservation preserves uncertainty and never fetches", async () => {
    const h = harness(), { res, result } = response();
    h.admission.reserve.mockImplementation(async () => { h.deps.enabled.mockReturnValue(false); return { status: "reserved" }; });
    await h.handler(request(), res); expect(result.body.status).toBe("held");
    expect(h.admission.uncertain).toHaveBeenCalled(); expect(h.fetcher).not.toHaveBeenCalled();
  });
});

describe("owner-staged retained packet checks", () => {
  it.each(["inputHash", "referenceHash", "receiptHash"] as const)("rejects changed %s before transport", async key => {
    const h = harness(); h.job[key] = "0".repeat(64);
    const { res, result } = response(); await h.handler(request(), res);
    expect(result.code).toBe(503); expect(h.store.hold).toHaveBeenCalledWith(ID); expect(h.fetcher).not.toHaveBeenCalled();
  });
  it("normalizes both the retained job ID and expected ID", () => {
    const f = fixture(); f.job.id = ID.toUpperCase();
    expect(validateHostedLunaJob(f.job, ID)).toEqual(f.input);
    f.job.id = ID;
    expect(validateHostedLunaJob(f.job, ID.toUpperCase())).toEqual(f.input);
  });
  it("rejects a separately changed receipt even with its hash updated", () => {
    const f = fixture(); const receipt = JSON.parse(f.job.receiptJson); receipt.inputRow.text = "changed";
    f.job.receiptJson = JSON.stringify(receipt); f.job.receiptHash = identityDigest(receipt);
    expect(() => validateHostedLunaJob(f.job, ID)).toThrow();
  });
  it.each(["decisions", "development", "retrospective", "source-clock"])("rejects disallowed input %s", value => {
    const f = fixture();
    if (value === "decisions") f.input.decisions = true;
    if (value === "development") f.input.referenceMode = "development";
    if (value === "retrospective") (f.input.identity!.evaluation as any).mode = "retrospective";
    if (value === "source-clock") f.input.packet.source.publishedAt = "2099-01-01T00:00:00Z";
    f.job.inputJson = JSON.stringify(f.input); f.job.inputHash = identityDigest(f.input);
    expect(() => validateHostedLunaJob(f.job, ID)).toThrow();
  });
});
