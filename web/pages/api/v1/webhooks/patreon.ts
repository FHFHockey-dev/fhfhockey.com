import type { NextApiRequest, NextApiResponse } from "next";

import { processPatreonWebhook } from "lib/integrations/patreon/sync";
import { patreonWebhookEventId, verifyPatreonWebhookSignature } from "lib/integrations/patreon/webhook";

export const config = { api: { bodyParser: false } };

async function readRawBody(req: NextApiRequest) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 256 * 1024) throw new Error("Patreon webhook payload is too large.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

const header = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    const rawBody = await readRawBody(req);
    if (!verifyPatreonWebhookSignature(rawBody, header(req.headers["x-patreon-signature"]))) {
      return res.status(401).json({ error: "Invalid Patreon webhook signature." });
    }
    const payload = JSON.parse(rawBody.toString("utf8")) as { data?: { id?: unknown; type?: unknown } };
    const eventType = header(req.headers["x-patreon-event"]) || "unknown";
    const result = await processPatreonWebhook({
      eventId: patreonWebhookEventId(rawBody, eventType, header(req.headers["x-patreon-event-id"])),
      eventType: eventType.slice(0, 160),
      payload,
    });
    return res.status(200).json({ received: true, duplicate: result.duplicate });
  } catch (error) {
    return res.status(500).json({ error: "Patreon webhook could not be processed." });
  }
}
