import supabase from "lib/supabase/client";
import type { PostedUnavailable, PostedWeek } from "./landingCatalog";

/**
 * This week's posted status. Otherwise the page falls back to hand marking: null with no session, an unavailable answer when
 * the source has no dated post yet, "failed" when it should have answered and could not, which the page says out loud.
 */
export async function fetchPostedWeek(fetcher: typeof fetch = fetch): Promise<PostedWeek | PostedUnavailable | "failed" | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) return null;
    const response = await fetcher("/api/v1/social-share/posted-week", { cache: "no-store", credentials: "omit", headers: { Authorization: `Bearer ${data.session.access_token}` }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) return "failed";
    const body = await response.json();
    if (body?.available === false) return { available: false, undated: Number(body.undated) || 0 };
    return body?.available === true && Array.isArray(body.days) && Array.isArray(body.cards) ? body : "failed";
  } catch { return "failed"; }
}
