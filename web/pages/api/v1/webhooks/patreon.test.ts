import crypto from "crypto";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ process: vi.fn() }));
vi.mock("lib/integrations/patreon/sync", () => ({ processPatreonWebhook: mocks.process }));
vi.mock("lib/integrations/patreon/config", () => ({ getPatreonWebhookSecret: () => "test-webhook-secret" }));

import handler from "./patreon";

const body = new TextEncoder().encode('{"data":{"id":"member-1","type":"member"}}');
const signature = crypto.createHmac("md5", "test-webhook-secret").update(body).digest("hex");

function request(raw = body, signed = true) {
  return {
    method: "POST",
    headers: {
      "x-patreon-signature": signed ? signature : "invalid",
      "x-patreon-event": "members:pledge:create",
      "x-patreon-event-id": "evt-1",
    },
    async *[Symbol.asyncIterator]() { yield raw; },
  } as any;
}

function response() {
  return {
    statusCode: 200,
    body: null as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; return this; },
    setHeader() {},
  } as any;
}

describe("Patreon webhook route", () => {
  it("rejects invalid signatures before invoking provider processing", async () => {
    const res = response();
    await handler(request(body, false), res);
    expect(res.statusCode).toBe(401);
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it("returns retryable status for pending unlinked events and acknowledges completed duplicates", async () => {
    mocks.process.mockReset();
    mocks.process.mockResolvedValueOnce({ duplicate: false, userId: null, pending: true });
    const pending = response();
    await handler(request(), pending);
    expect(pending.statusCode).toBe(503);

    mocks.process.mockResolvedValueOnce({ duplicate: true, userId: "user-1" });
    const duplicate = response();
    await handler(request(), duplicate);
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.body).toMatchObject({ received: true, duplicate: true });
  });

  it("propagates failed provider processing as retryable non-2xx", async () => {
    mocks.process.mockRejectedValueOnce(new Error("sync cooling down"));
    const res = response();
    await handler(request(), res);
    expect(res.statusCode).toBe(500);
  });
});
