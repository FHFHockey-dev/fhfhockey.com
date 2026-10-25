import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  // Keep this unconditional: stale clients and old rollout configuration cannot sell a pass.
  return res.status(403).json({ error: "New Draft Pro purchases are closed. Existing access and purchase recovery remain available.", code: "draft_pro_sales_closed" });
}
