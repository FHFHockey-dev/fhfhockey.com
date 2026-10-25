import type { NextApiRequest, NextApiResponse } from "next";

import { reconcilePatreonAccounts } from "lib/integrations/patreon/sync";
import adminOnly from "utils/adminOnlyMiddleware";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";

const auditedReconcile = withCronJobAudit(async (_req: NextApiRequest, res: NextApiResponse) => {
  try {
    const result = await reconcilePatreonAccounts({});
    return res.status(200).json({ ...result, success: Number.isFinite(result.failed) && result.failed === 0 });
  } catch {
    return res.status(500).json({ error: "Patreon reconciliation failed." });
  }
}, { jobName: "/api/internal/patreon-reconcile", recordRowMetrics: false,
  responsePreviewKeys: ["success", "attempted", "synced", "failed"] });

export default adminOnly(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  return auditedReconcile(req, res);
});
