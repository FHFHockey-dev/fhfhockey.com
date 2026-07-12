import { timingSafeEqual } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

type ResponseBody =
  | { ok: true }
  | { ok: false; error: "Unauthorized" | "CRON_SECRET is not configured" };

function readBearerToken(req: NextApiRequest): string {
  const authorization = req.headers.authorization;
  if (typeof authorization !== "string") return "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function secretsMatch(received: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const receivedBuffer = encoder.encode(received);
  const expectedBuffer = encoder.encode(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseBody>,
) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return res
      .status(503)
      .json({ ok: false, error: "CRON_SECRET is not configured" });
  }

  if (!secretsMatch(readBearerToken(req), expectedSecret)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  return res.status(200).json({ ok: true });
}
