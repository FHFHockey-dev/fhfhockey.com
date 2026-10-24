import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "lib/api/requireApiUser";
import { loadProviderSyncAccess } from "lib/integrations/providerSyncAccessServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization, Cookie");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  const user = await requireApiUser(req, res);
  if (!user) return;
  const access = await loadProviderSyncAccess(user.id);
  if (access.reason === "verification_unavailable") return res.status(503).json({ error: { code: access.reason, message: "Premium access could not be verified. Please try again." } });
  return res.status(200).json({ data: { access } });
}
