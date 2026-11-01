import type { NextApiRequest, NextApiResponse } from "next";
import { requireSocialShareAccess, SOCIAL_SHARE_CACHE_CONTROL } from "lib/socialShare/access";
import { landingWeekStart } from "lib/socialShare/landingCatalog";

/**
 * This week's Mon to Sun posted status, behind the same editor check and private cache rule as the other Social Share
 * routes. Reads only. A table with no posts yet answers `available: false`: no source has spoken, so no day is "missed".
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", SOCIAL_SHARE_CACHE_CONTROL);
  res.setHeader("Vary", "Authorization");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Use GET." }); }
  if (!await requireSocialShareAccess(req, res)) return;
  try {
    const [{ buildPostedWeek, postedWeekRange }, { default: supabase }] = await Promise.all([import("lib/socialShare/postedWeek"), import("lib/supabase/server")]);
    const now = new Date(), { from, to } = postedWeekRange(landingWeekStart(now));
    const table = () => supabase.from("social_share_x_posts" as any) as any;
    const [week, earliest, latest] = await Promise.all([
      table().select("posted_at, matched_card").gte("posted_at", from).lt("posted_at", to).order("posted_at").limit(500),
      table().select("posted_at").order("posted_at").limit(1),
      table().select("posted_at").order("posted_at", { ascending: false }).limit(1),
    ]);
    const failure = week.error ?? earliest.error ?? latest.error;
    if (failure) throw failure;
    if (!earliest.data?.length || !latest.data?.length) return res.status(200).json({ available: false });
    return res.status(200).json(buildPostedWeek(week.data ?? [], now, earliest.data[0].posted_at, latest.data[0].posted_at));
  } catch {
    return res.status(503).json({ error: "Posted status unavailable." });
  }
}
