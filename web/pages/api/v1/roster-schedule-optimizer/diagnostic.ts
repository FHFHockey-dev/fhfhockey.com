import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { diagnosticHtml, diagnosticLocalOnly } from "lib/rosterScheduleOptimizer/diagnostic";

/** Raw HTML deliberately bypasses _app, AuthProvider, analytics and optimizer effects. */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (!diagnosticLocalOnly(process.env.NODE_ENV, req.headers.host, req.socket.remoteAddress)) return res.status(404).end();
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fyhftlxokyjtpndbkfse.supabase.co";
  const storageKey = `sb-${new URL(projectUrl).hostname.split(".")[0]}-auth-token`;
  const nonce = randomBytes(18).toString("base64");
  res.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(diagnosticHtml(storageKey, nonce));
}
