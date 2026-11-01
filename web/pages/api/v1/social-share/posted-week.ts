import type { NextApiRequest, NextApiResponse } from "next";
import { requireSocialShareAccess, SOCIAL_SHARE_CACHE_CONTROL } from "lib/socialShare/access";
import { landingWeekStart } from "lib/socialShare/landingCatalog";

const WEEK_CEILING = 500;

/**
 * This week's Mon to Sun posted status, behind the same editor check and private cache rule as the other Social Share
 * routes. Reads only. A table with no dated posts yet answers `available: false`: no source has spoken, so no day is
 * "missed". More posts than the ceiling is an error rather than a partial week, which would turn later days into misses.
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
    const [week, earliest, latest, undated] = await Promise.all([
      table().select("posted_at, matched_card").gte("posted_at", from).lt("posted_at", to).order("posted_at").limit(WEEK_CEILING + 1),
      table().select("posted_at").not("posted_at", "is", null).order("posted_at").limit(1),
      table().select("received_at").order("received_at", { ascending: false }).limit(1),
      table().select("tweet_id", { count: "exact", head: true }).is("posted_at", null).gte("received_at", from),
    ]);
    const failure = week.error ?? earliest.error ?? latest.error ?? undated.error;
    if (failure) throw failure;
    if ((week.data?.length ?? 0) > WEEK_CEILING) {
      console.error(`Posted week has more than ${WEEK_CEILING} posts; not answering with a partial week.`);
      return res.status(503).json({ error: "Too many posts this week to show." });
    }
    if (!earliest.data?.length || !latest.data?.length) return res.status(200).json({ available: false });
    return res.status(200).json(buildPostedWeek(week.data ?? [], now, earliest.data[0].posted_at, latest.data[0].received_at, undated.count ?? 0));
  } catch {
    return res.status(503).json({ error: "Posted status unavailable." });
  }
}
