import type { NextApiRequest, NextApiResponse } from "next";
import { requireSocialShareAccess, SOCIAL_SHARE_CACHE_CONTROL } from "lib/socialShare/access";

/** This season's matchup weeks for the studio's period control, behind the same editor check and private cache rule as a post. Reads only. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", SOCIAL_SHARE_CACHE_CONTROL);
  res.setHeader("Vary", "Authorization");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Use GET." }); }
  if (!await requireSocialShareAccess(req, res)) return;
  try {
    const [{ loadMatchupWeeks }, { default: publicSupabase }] = await Promise.all([import("lib/socialShare/modules/shared/periodWindow.sources"), import("lib/supabase/public-client")]);
    return res.status(200).json(await loadMatchupWeeks(publicSupabase, new Date().toISOString()));
  } catch {
    return res.status(503).json({ error: "Matchup weeks unavailable." });
  }
}
