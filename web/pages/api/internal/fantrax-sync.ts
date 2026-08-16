import { timingSafeEqual } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";

import { runFantraxScheduledSync } from "lib/integrations/fantrax/server";

function bearerToken(req: NextApiRequest) {
  const authorization = req.headers.authorization;
  return typeof authorization === "string" && authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function secretsMatch(received: string, expected: string) {
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(
      Uint8Array.from(receivedBytes),
      Uint8Array.from(expectedBytes),
    )
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return res.status(503).json({ error: "CRON_SECRET is not configured" });
  }
  if (!secretsMatch(bearerToken(req), secret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    return res.status(200).json(await runFantraxScheduledSync({}));
  } catch {
    return res.status(500).json({ error: "Fantrax sync failed." });
  }
}
