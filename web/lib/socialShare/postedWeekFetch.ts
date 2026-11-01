import supabase from "lib/supabase/client";
import type { PostedWeek } from "./landingCatalog";

/** This week's posted status, or null whenever the source cannot answer, so the page falls back to hand marking. */
export async function fetchPostedWeek(fetcher: typeof fetch = fetch): Promise<PostedWeek | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) return null;
    const response = await fetcher("/api/v1/social-share/posted-week", { cache: "no-store", credentials: "omit", headers: { Authorization: `Bearer ${data.session.access_token}` }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;
    const body = await response.json();
    return body?.available === true && Array.isArray(body.days) && Array.isArray(body.cards) ? body : null;
  } catch { return null; }
}
