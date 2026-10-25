import { createHash, timingSafeEqual } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { assertInSeasonSandboxConfiguration, getInSeasonSandboxStripe, IN_SEASON_SANDBOX_CATALOG } from "lib/in-season/billingConfig";
import { monthlyBillingStore } from "lib/in-season/monthlyStore";
import { runMonthlyBillingJobs } from "lib/in-season/monthlyExecutor";

// Inactive manual invocation only. No cron registration. A platform timeout must
// leave the existing durable leases/receipts to recover; never acknowledge early.
export const config = { maxDuration: 300 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  if (process.env.IN_SEASON_SANDBOX_WORKER_ENABLED !== "true") return res.status(503).json({ error: "Billing worker is disabled." });
  const secret = process.env.IN_SEASON_SANDBOX_WORKER_TOKEN;
  if (!secret || secret.length < 32) return res.status(503).json({ error: "Billing worker is unavailable." });
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  const received = createHash("sha256").update(req.headers.authorization ?? "").digest();
  if (!timingSafeEqual(new Uint8Array(expected), new Uint8Array(received))) return res.status(401).json({ error: "Unauthorized billing worker request." });
  if (Object.keys(req.query ?? {}).length || (req.body !== undefined && (req.body === null || typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length))) {
    return res.status(400).json({ error: "Billing worker accepts no overrides." });
  }
  try {
    assertInSeasonSandboxConfiguration();
    const reference = process.env.IN_SEASON_SANDBOX_RETRY_VERIFICATION_REFERENCE?.trim();
    if (process.env.IN_SEASON_SANDBOX_AUTOMATIC_RETRIES_DISABLED !== "true" || !reference) throw new Error("Retry configuration unverified");
    const result = await runMonthlyBillingJobs({ stripe: getInSeasonSandboxStripe(), store: monthlyBillingStore(), limit: 1,
      retries: { accountId: IN_SEASON_SANDBOX_CATALOG.accountId, automaticRetriesDisabled: true, verificationReference: reference } });
    // Do not expose provider error strings, which can contain payment details.
    return res.status(result.failed.length ? 503 : 200).json({ data: {
      outcome: result.failed.length ? "needs_attention" : result.completed.length ? "completed" : "no_jobs_completed",
      completed: result.completed, failed: result.failed.map(({ id }) => ({ id, reason: "reconciliation_required" })),
    } });
  } catch { return res.status(503).json({ error: "Billing worker could not finish. Inspect durable job state before retrying." }); }
}
