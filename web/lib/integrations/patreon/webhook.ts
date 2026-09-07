import crypto from "crypto";

import { getPatreonWebhookSecret } from "./config";

export function verifyPatreonWebhookSignature(rawBody: Buffer, signature: string | undefined) {
  if (!signature) return false;
  const expected = crypto.createHmac("md5", getPatreonWebhookSecret()).update(rawBody).digest("hex");
  const received = Buffer.from(signature, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return received.length === expectedBytes.length && crypto.timingSafeEqual(received, expectedBytes);
}

export function patreonWebhookEventId(rawBody: Buffer, eventType: string, headerEventId?: string) {
  if (headerEventId && /^[A-Za-z0-9_:-]{1,200}$/.test(headerEventId)) return headerEventId;
  return crypto.createHash("sha256").update(eventType).update("\n").update(rawBody).digest("hex");
}
