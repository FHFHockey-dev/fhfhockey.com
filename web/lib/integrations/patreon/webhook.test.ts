import crypto from "crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("./config", () => ({
  getPatreonWebhookSecret: () => "test-webhook-secret",
}));

import { patreonWebhookEventId, verifyPatreonWebhookSignature } from "./webhook";

describe("Patreon webhook authentication", () => {
  it("uses the exact raw body for a constant-time signed request", () => {
    const body = Buffer.from('{"data":{"id":"member-1","type":"member"}}');
    const signature = crypto.createHmac("md5", "test-webhook-secret").update(body).digest("hex");
    expect(verifyPatreonWebhookSignature(body, signature)).toBe(true);
    expect(verifyPatreonWebhookSignature(Buffer.from("{}"), signature)).toBe(false);
  });

  it("uses the provider event id when present and a stable content id otherwise", () => {
    const body = Buffer.from("{}");
    expect(patreonWebhookEventId(body, "members:pledge:create", "evt-1")).toBe("evt-1");
    expect(patreonWebhookEventId(body, "members:pledge:create")).toBe(
      patreonWebhookEventId(body, "members:pledge:create"),
    );
  });
});
