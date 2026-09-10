import type { NextApiRequest, NextApiResponse } from "next";

import { reconcilePatreonAccounts } from "lib/integrations/patreon/sync";
import adminOnly from "utils/adminOnlyMiddleware";

export default adminOnly(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    return res.status(200).json(await reconcilePatreonAccounts({}));
  } catch {
    return res.status(500).json({ error: "Patreon reconciliation failed." });
  }
});
