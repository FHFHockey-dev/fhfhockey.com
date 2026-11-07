import { timingSafeEqual } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { createLunaTransport } from "../tweetLunaTransport";
import { runRetainedTweetLunaReviewWithBinding } from "../tweetLunaBindingWorkflow";
import { LUNA_EVIDENCE_BINDING_POLICY } from "../tweetLunaEvidenceBinding";
import { requestSchema, validateHostedLunaJob } from "./contract";
import type { HostedLunaStore } from "./store";

type Dependencies = {
  enabled: () => boolean;
  workerSecret: () => string | undefined;
  store: () => HostedLunaStore;
  apiKey: () => string | undefined;
  fetch?: typeof fetch;
  now?: () => string;
};
function authorized(header: unknown, secret: string | undefined) {
  if (!secret || secret.length < 32 || typeof header !== "string" || header.length > 4096) return false;
  const expected = new TextEncoder().encode(`Bearer ${secret}`), received = new TextEncoder().encode(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function createHostedLunaHandler(deps: Dependencies) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ status: "method_not_allowed" }); }
    // Next.js parses/limits the body before this handler. This gate precedes
    // application body validation, credentials, database construction and provider work.
    if (!deps.enabled()) return res.status(503).json({ status: "disabled" });
    if (!authorized(req.headers.authorization, deps.workerSecret())) return res.status(401).json({ status: "unauthorized" });
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ status: "invalid_request" });
    const { jobId } = parsed.data;
    let store: HostedLunaStore | undefined;
    let claimed = false;
    try {
      store = deps.store();
      const job = await store.claim(jobId);
      if (job.status !== "claimed") return res.status(200).json({ jobId, status: job.status, replay: true });
      claimed = true;
      const input = validateHostedLunaJob(job.job, jobId);
      const transport = createLunaTransport({ enabled: true, stopped: () => !deps.enabled(),
        apiKey: deps.apiKey, admission: store.admission(jobId), fetch: deps.fetch });
      const result = await runRetainedTweetLunaReviewWithBinding({ enabled: true, input, transport,
        now: deps.now, bindingPolicy: LUNA_EVIDENCE_BINDING_POLICY });
      await store.finish(jobId, result);
      return res.status(200).json({ jobId, status: result.review.status === "held" ? "held" : "completed",
        canPublish: false, canChangeStatus: false });
    } catch {
      // A claim with unknown outcome stays locked. Never steal/retry its work.
      if (claimed && store) await store.hold(jobId).catch(() => undefined);
      return res.status(503).json({ jobId, status: "held", reconciliationRequired: true });
    }
  };
}
