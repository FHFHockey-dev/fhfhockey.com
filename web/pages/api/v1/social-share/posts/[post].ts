import type { NextApiRequest, NextApiResponse } from "next";
import { requireSocialShareAccess, SOCIAL_SHARE_CACHE_CONTROL } from "lib/socialShare/access";
import { SharePostRequestError } from "lib/socialShare/modules/contract";

/** One post edition, behind the same editor check and private cache rule as the format route. Reads only. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", SOCIAL_SHARE_CACHE_CONTROL);
  res.setHeader("Vary", "Authorization");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Use GET." }); }
  const { post, ...rest } = req.query;
  if (typeof post !== "string" || Object.values(rest).some(value => typeof value !== "string")) return res.status(400).json({ error: "Invalid query parameters." });
  if (!await requireSocialShareAccess(req, res)) return;
  try {
    const [{ loadPostSnapshot }, { default: publicSupabase }] = await Promise.all([import("lib/socialShare/modules/server"), import("lib/supabase/public-client")]);
    return res.status(200).json(await loadPostSnapshot(post, rest as Record<string, string>, publicSupabase));
  } catch (error) {
    return res.status(error instanceof SharePostRequestError ? error.status : 503).json({ error: error instanceof SharePostRequestError ? error.message : "Post unavailable." });
  }
}
