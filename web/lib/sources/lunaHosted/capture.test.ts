// @vitest-environment node
import { createHash } from "node:crypto";
import { Readable, PassThrough } from "node:stream";
import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";
import route, { config } from "../../../pages/api/v1/sources/ifttt/luna-capture";
import { CAPTURE_MAX_BYTES, createIsolatedLunaCaptureHandler, prepareCaptureEnvelope,
  type CaptureEnvelope, type CaptureResult, type CaptureStore } from "./capture";

const secret = "synthetic-dedicated-capture-key-0000";
const scope = { policyId: "ABCDEF00-0000-4000-8000-000000000001", appletId: "synthetic-only", sourceAccount: "TestReporter" };
const now = "2026-11-05T00:00:00.000Z";
const body = { Text: "Synthetic goalie starts tonight.", UserName: "TestReporter",
  LinkToTweet: "https://x.com/TestReporter/status/123456", CreatedAt: "November 4, 2026 at 07:00PM" };
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
function outcome(input: CaptureEnvelope, status: "retained" | "duplicate" | "variant" = "retained"): CaptureResult {
  return { status, receipt: { id: "00000000-0000-4000-8000-000000000002", kind: "luna-isolated-archive-v1",
    policyId: input.scope.policyId, appletId: input.scope.appletId, deliveryKey: input.deliveryKey,
    payloadSha256: input.payloadSha256, byteLength: input.byteLength, firstReceivedAt: input.receivedAt,
    classification: status === "variant" ? "variant" : "baseline" } };
}
function request(raw: string | Buffer = JSON.stringify(body), headers: Record<string, unknown> = {}) {
  return Object.assign(Readable.from([Buffer.isBuffer(raw) ? raw : Buffer.from(raw)]), {
    method: "POST", headers: { "content-type": "application/json", "x-fhfh-luna-capture-secret": secret, ...headers }, query: {},
  }) as unknown as NextApiRequest;
}
function response() {
  const res = { statusCode: 0, body: {} as any, setHeader: vi.fn(),
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; return this; } };
  return res as typeof res & NextApiResponse;
}
function setup(overrides: Partial<Parameters<typeof createIsolatedLunaCaptureHandler>[0]> = {}) {
  const retain = vi.fn(async (input: CaptureEnvelope) => outcome(input));
  const lookupExact = vi.fn<CaptureStore["lookupExact"]>(async () => null);
  const store = vi.fn(() => ({ retain, lookupExact }));
  const deps = { enabled: vi.fn(() => true), secret: vi.fn(() => secret), scope: vi.fn(() => scope),
    store, now: () => now, ...overrides };
  return { deps, retain, lookupExact, store, handler: createIsolatedLunaCaptureHandler(deps) };
}
afterEach(() => { vi.useRealTimers(); });
describe("isolated capture boundary (mock persistence only)", () => {
  it("defaults the actual route off with Next body parsing off", async () => {
    expect(config.api.bodyParser).toBe(false);
    const req = request(); const read = vi.spyOn(req, "on"), res = response();
    await route(req, res);
    expect(res.statusCode).toBe(503); expect(res.body.status).toBe("disabled"); expect(read).not.toHaveBeenCalled();
  });
  it("gates before credentials, scope, store or stream access", async () => {
    const s = setup({ enabled: () => false }); const req = request(), read = vi.spyOn(req, "on"), res = response();
    await s.handler(req, res);
    expect(s.deps.secret).not.toHaveBeenCalled(); expect(s.deps.scope).not.toHaveBeenCalled();
    expect(s.store).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled();
  });
  it("rejects methods before all dependencies", async () => {
    const s = setup(), req = request(), res = response(); req.method = "GET";
    await s.handler(req, res); expect(res.statusCode).toBe(405); expect(s.deps.enabled).not.toHaveBeenCalled();
  });
  it.each([undefined, "incorrect", secret.slice(0, -1) + "1", [secret]])("refuses missing/wrong/ambiguous dedicated header %#", async header => {
    const s = setup(), req = request(undefined, { "x-fhfh-luna-capture-secret": header,
      "x-fhfh-ifttt-secret": secret, authorization: `Bearer ${secret}` }), res = response();
    req.query.secret = secret;
    await s.handler(req, res); expect(res.statusCode).toBe(401); expect(s.store).not.toHaveBeenCalled();
  });
  it.each([undefined, "short"])("refuses unconfigured credentials %#", async value => {
    const s = setup({ secret: () => value }), res = response(); await s.handler(request(), res);
    expect(res.statusCode).toBe(401); expect(s.store).not.toHaveBeenCalled();
  });
  it("requires a configured scope and a store before reading", async () => {
    for (const override of [{ scope: () => undefined }, { store: () => undefined }]) {
      const s = setup(override), req = request(), on = vi.spyOn(req, "on"), res = response();
      await s.handler(req, res); expect(res.statusCode).toBe(503); expect(on).not.toHaveBeenCalled();
    }
  });
  it.each(["now", "2026-11-05T00:00:00+00:00", "2026-11-05T24:00:00Z"])("rejects non-contract receipt clock %s", clock => {
    expect(() => prepareCaptureEnvelope(Buffer.from(JSON.stringify(body)), scope, clock)).toThrow();
  });
  it("hashes and joins only subarray bytes across a split UTF-8 character", async () => {
    const raw = JSON.stringify({ ...body, Text: "Synthetic résumé 🏒 starts tonight." });
    const prefix = "excluded-prefix", suffix = "excluded-suffix";
    const backing = Buffer.from(prefix + raw + suffix);
    const bytes = backing.subarray(Buffer.byteLength(prefix), Buffer.byteLength(prefix + raw));
    const direct = prepareCaptureEnvelope(bytes, scope, now);
    expect(direct.rawBody).toBe(raw); expect(direct.payloadSha256).toBe(sha(raw));
    const split = bytes.indexOf("🏒") + 1;
    const req = Object.assign(Readable.from([bytes.subarray(0, split), bytes.subarray(split)]), {
      method: "POST", headers: { "content-type": "application/json", "x-fhfh-luna-capture-secret": secret }, query: {},
    }) as unknown as NextApiRequest;
    const s = setup(), res = response(); await s.handler(req, res);
    expect(res.statusCode).toBe(200);
    const retained = s.retain.mock.calls[0]![0];
    expect(retained.rawBody).toBe(raw); expect(retained.payloadSha256).toBe(sha(raw));
    expect(retained.byteLength).toBe(Buffer.byteLength(raw));
  });
  it("retains exact UTF-8 content without headers and preserves submitted publication labels", async () => {
    const raw = JSON.stringify({ ...body, Text: "  Synthetic résumé 🏒\n" }, null, 2);
    const s = setup(), res = response(); await s.handler(request(raw), res);
    const input = s.retain.mock.calls[0]![0];
    expect(input.rawBody).toBe(raw); expect(input.payloadSha256).toBe(sha(raw));
    expect(input.byteLength).toBe(Buffer.byteLength(raw)); expect(input.submitted.createdAtLabel).toBe(body.CreatedAt);
    expect(input.sourceAuthenticated).toBe(false); expect(input.scope.policyId).toBe(scope.policyId.toLowerCase());
    expect(JSON.stringify(input)).not.toContain(secret); expect(Object.isFrozen(input)).toBe(true);
    expect(res.body).toMatchObject({ status: "retained", heldForReview: true, canEnqueue: false, canPublish: false, sourceAuthenticated: false });
    expect(JSON.stringify(res.body)).not.toContain("résumé"); expect(s.lookupExact).not.toHaveBeenCalled();
  });
  it("accepts existing lower-case aliases but holds all acknowledgments for review", async () => {
    const s = setup(), res = response(); await s.handler(request(JSON.stringify({ text: body.Text,
      username: body.UserName, link_to_tweet: body.LinkToTweet, created_at: body.CreatedAt,
      source_account: "testreporter", tweet_embed_code: "<p>untrusted</p>" })), res);
    expect(res.statusCode).toBe(200); expect(s.retain.mock.calls[0]![0].submitted.embed).toBe("<p>untrusted</p>");
  });
  it.each([
    { ...body, UserName: "OtherReporter" }, { ...body, source_account: "OtherReporter" },
    { ...body, LinkToTweet: "https://x.com/OtherReporter/status/123456" },
    { ...body, LinkToTweet: "https://evil.example/TestReporter/status/123456" },
    { ...body, LinkToTweet: "https://x.com@TestReporter.example/TestReporter/status/123456" },
    { ...body, LinkToTweet: "http://x.com/TestReporter/status/123456" },
    { ...body, LinkToTweet: "https://x.com/TestReporter/STATUS/123456" },
    { ...body, text: "ambiguous alias" }, { ...body, secret: "must-never-archive" },
    { ...body, Text: " " }, { ...body, CreatedAt: undefined },
  ])("rejects unsupported or conflicting submitted metadata %#", async data => {
    const s = setup(), res = response(); await s.handler(request(JSON.stringify(data)), res);
    expect(res.statusCode).toBe(400); expect(s.retain).not.toHaveBeenCalled();
  });
  it.each([
    '"Text":"conflicting earlier content",',
    '"Text":' + JSON.stringify(body.Text) + ',',
    String.raw`"\u0054ext":"escaped earlier content",`,
    String.raw`"Te\u0078t":"another escaped spelling",`,
  ])("rejects repeated decoded JSON names before retention %#", async prefix => {
    const s = setup(), res = response();
    await s.handler(request("{" + prefix + JSON.stringify(body).slice(1)), res);
    expect(res.statusCode).toBe(400); expect(s.retain).not.toHaveBeenCalled();
    expect(s.lookupExact).not.toHaveBeenCalled();
  });
  it("accepts a unique escaped name and JSON punctuation within string values without changing raw bytes", async () => {
    const raw = JSON.stringify({ ...body, Text: 'Synthetic "Text":"repeated", {value} \\ end\n' })
      .replace('"Text":', String.raw`"\u0054ext":`);
    const s = setup(), res = response(); await s.handler(request(raw), res);
    expect(res.statusCode).toBe(200); expect(s.retain.mock.calls[0]![0].rawBody).toBe(raw);
    expect(s.retain.mock.calls[0]![0].payloadSha256).toBe(sha(raw));
  });
  it.each(["null", "123", "{}", "[]"])("rejects non-string field value %s", async value => {
    const raw = JSON.stringify(body).replace(JSON.stringify(body.Text), value);
    const s = setup(), res = response(); await s.handler(request(raw), res);
    expect(res.statusCode).toBe(400); expect(s.retain).not.toHaveBeenCalled();
  });
  it.each(["[]", "null", "{", Buffer.from([0xff])])("rejects malformed JSON/UTF8 %#", async raw => {
    const s = setup(), res = response(); await s.handler(request(raw), res);
    expect(res.statusCode).toBe(400); expect(s.retain).not.toHaveBeenCalled();
  });
  it.each([{ "content-type": "text/plain" }, { "content-encoding": "gzip" },
    { "content-length": "no" }, { "content-length": String(CAPTURE_MAX_BYTES + 1) }])("rejects headers before reading %#", async headers => {
    const s = setup(), req = request(undefined, headers), on = vi.spyOn(req, "on"), res = response();
    await s.handler(req, res); expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(on).not.toHaveBeenCalled(); expect(s.retain).not.toHaveBeenCalled();
  });
  it("counts actual streamed bytes, including undeclared and dishonest lengths", async () => {
    for (const headers of [{}, { "content-length": "1" }]) {
      const s = setup(), res = response(); await s.handler(request(Buffer.alloc(CAPTURE_MAX_BYTES + 1), headers), res);
      expect(res.statusCode).toBe(413); expect(s.retain).not.toHaveBeenCalled();
    }
  });
  it("refuses truncated declared content", async () => {
    const s = setup(), res = response(); await s.handler(request(undefined, { "content-length": "60000" }), res);
    expect(res.statusCode).toBe(400); expect(s.retain).not.toHaveBeenCalled();
  });
  it("bounds stalled bodies and removes stream listeners", async () => {
    vi.useFakeTimers(); const s = setup(), stream = new PassThrough();
    const req = Object.assign(stream, { method: "POST", headers: request().headers }) as unknown as NextApiRequest;
    const res = response(), pending = s.handler(req, res); await vi.advanceTimersByTimeAsync(5001); await pending;
    expect(res.statusCode).toBe(408); expect(stream.listenerCount("data")).toBe(0); expect(s.retain).not.toHaveBeenCalled(); stream.destroy();
  });
  it("holds aborted bodies and handles a subsequent stream error", async () => {
    const s = setup(), stream = new PassThrough();
    const req = Object.assign(stream, { method: "POST", headers: request().headers }) as unknown as NextApiRequest;
    const res = response(), pending = s.handler(req, res);
    stream.emit("aborted");
    expect(() => stream.emit("error", new Error("connection reset"))).not.toThrow();
    await pending; expect(res.statusCode).toBe(400); expect(s.retain).not.toHaveBeenCalled();
    stream.destroy();
  });
  it("stops before mutation if code gate changes while reading", async () => {
    const s = setup({ enabled: vi.fn().mockReturnValueOnce(true).mockReturnValue(false) }), res = response();
    await s.handler(request(), res); expect(res.statusCode).toBe(503); expect(s.retain).not.toHaveBeenCalled();
  });
  it.each(["stopped", "window_closed", "attempt_cap", "receipt_cap", "byte_cap"] as const)("preserves durable-store refusal %s", async reason => {
    const s = setup(), res = response(); s.retain.mockResolvedValue({ status: "refused", reason });
    await s.handler(request(), res); expect(res.statusCode).toBe(429); expect(res.body.reason).toBe(reason);
    expect(s.lookupExact).not.toHaveBeenCalled();
  });
  it.each(["duplicate", "variant"] as const)("acknowledges matching %s evidence without clearing holds", async status => {
    const s = setup(), res = response(); s.retain.mockImplementation(async input => outcome(input, status));
    await s.handler(request(), res); expect(res.body).toMatchObject({ status, heldForReview: true, canEnqueue: false });
  });
  it.each([false, true])("acknowledges an earlier-started slower duplicate (lost acknowledgment: %s)", async lostAck => {
    let currentTime = now;
    const s = setup({ now: () => currentTime });
    let winner: Exclude<CaptureResult, { status: "refused" }> | undefined;
    s.retain.mockImplementation(async input => {
      if (!winner) {
        const created = outcome(input); if (created.status === "refused") throw new Error();
        winner = created; return created;
      }
      if (lostAck) throw new Error("lost duplicate acknowledgment");
      return { status: "duplicate", receipt: winner.receipt };
    });
    s.lookupExact.mockImplementation(async () => winner ? { status: "duplicate", receipt: winner.receipt } : null);
    const slow = new PassThrough();
    const slowReq = Object.assign(slow, { method: "POST", headers: request().headers }) as unknown as NextApiRequest;
    const slowRes = response(), fastRes = response(), pendingSlow = s.handler(slowReq, slowRes);
    // First request is still receiving when the later arrival reaches retention.
    currentTime = "2026-11-05T00:00:01.000Z";
    await s.handler(request(), fastRes);
    expect(fastRes.body.status).toBe("retained");
    slow.end(Buffer.from(JSON.stringify(body))); await pendingSlow;
    expect(s.retain.mock.calls.map(([input]) => input.receivedAt)).toEqual([currentTime, now]);
    expect(winner!.receipt.firstReceivedAt).toBe(currentTime);
    expect(slowRes.statusCode).toBe(200); expect(slowRes.body.status).toBe("duplicate");
    expect(slowRes.body.receiptId).toBe(fastRes.body.receiptId);
    expect(s.retain).toHaveBeenCalledTimes(2);
    expect(s.lookupExact).toHaveBeenCalledTimes(lostAck ? 1 : 0);
  });
  it("reconciles one unknown write by exact lookup without retrying mutation", async () => {
    const s = setup(), res = response(); let committed: CaptureResult;
    s.retain.mockImplementation(async input => { committed = outcome(input); throw new Error("lost acknowledgment"); });
    s.lookupExact.mockImplementation(async () => committed);
    await s.handler(request(), res);
    expect(res.body.status).toBe("retained"); expect(s.retain).toHaveBeenCalledTimes(1); expect(s.lookupExact).toHaveBeenCalledTimes(1);
    expect(s.lookupExact.mock.calls[0]![0]).toMatchObject({ payloadSha256: sha(JSON.stringify(body)) });
  });
  it.each(["missing", "mismatched", "throws"])("leaves %s uncertain outcome held without retry", async mode => {
    const s = setup(), res = response(); s.retain.mockImplementation(async input => {
      if (mode === "mismatched") {
        const wrong = outcome(input); if (wrong.status !== "refused") wrong.receipt.payloadSha256 = "wrong";
        s.lookupExact.mockResolvedValue(wrong); return wrong;
      }
      throw new Error("private source details must not leak");
    });
    if (mode === "throws") s.lookupExact.mockRejectedValue(new Error("private details"));
    await s.handler(request(), res); expect(res.body.status).toBe("outcome_unknown"); expect(res.statusCode).toBe(503);
    expect(s.retain).toHaveBeenCalledTimes(1); expect(s.lookupExact).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(res.body)).not.toContain("private");
  });
  it("bounds write and reconciliation deadlines without a second write", async () => {
    vi.useFakeTimers(); const s = setup(), res = response();
    const signals: AbortSignal[] = [];
    const store: CaptureStore = { retain: vi.fn((_input, signal) => { signals.push(signal); return new Promise<never>(() => undefined); }),
      lookupExact: vi.fn((_input, signal) => { signals.push(signal); return new Promise<never>(() => undefined); }) };
    const handler = createIsolatedLunaCaptureHandler({ ...s.deps, store: () => store });
    const pending = handler(request(), res);
    await vi.advanceTimersByTimeAsync(6001); await pending;
    expect(res.body.status).toBe("outcome_unknown"); expect(signals).toHaveLength(2);
    expect(signals.every(signal => signal.aborted)).toBe(true); expect(store.retain).toHaveBeenCalledTimes(1);
  });
  it("keys variants by delivered post but hashes exact body differences", async () => {
    const s = setup(); await s.handler(request(), response());
    await s.handler(request(JSON.stringify({ ...body, Text: "Changed synthetic report." })), response());
    const [a, b] = s.retain.mock.calls.map(call => call[0]);
    expect(a!.deliveryKey).toBe(b!.deliveryKey); expect(a!.payloadSha256).not.toBe(b!.payloadSha256);
  });
});
