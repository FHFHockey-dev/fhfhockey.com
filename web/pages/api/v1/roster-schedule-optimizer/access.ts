import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "lib/api/requireApiUser";
import { loadInSeasonAccess } from "lib/in-season/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: { code: "method_not_allowed", message: "GET is required." } }); }
  const user = await requireApiUser(req, res, { onUnauthorized: (message) => res.status(401).json({ error: { code: "authentication_required", message } }) });
  if (!user) return;
  try {
    return res.status(200).json({ data: await loadInSeasonAccess(user.id) });
  } catch {
    return res.status(503).json({ error: { code: "access_unavailable", message: "In-season access is temporarily unavailable." } });
  }
}
