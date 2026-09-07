import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { loadDraftProAccount } from "lib/draft-pro/account";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { code: "method_not_allowed" } });
  }
  const user = await requireApiUser(req, res, {
    onUnauthorized: (message) => res.status(401).json({ error: { code: "authentication_required", message } }),
  });
  if (!user) return;
  try {
    return res.status(200).json({ data: await loadDraftProAccount({ userId: user.id }) });
  } catch {
    return res.status(500).json({ error: { code: "account_unavailable", message: "Draft Pro account details are unavailable." } });
  }
}
