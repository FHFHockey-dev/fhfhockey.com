import supabase from "lib/supabase/client";
import { bounded } from "./export";
import type { MatchupRow } from "./modules/shared/periodWindow";

/** The studio's matchup calendar. Null when it could not be read: the control says so and offers a retry, and the edition still loads. */
export async function fetchMatchupWeeks(fetcher: typeof fetch = fetch): Promise<{ rows: MatchupRow[]; cutoff: string } | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) return null;
    const response = await bounded(fetcher("/api/v1/social-share/matchup-weeks", { cache: "no-store", credentials: "omit", headers: { Authorization: `Bearer ${data.session.access_token}` } }), "Matchup weeks timed out.", 10000);
    if (!response.ok) return null;
    const body = await response.json();
    return Array.isArray(body?.rows) && typeof body.cutoff === "string" ? body : null;
  } catch { return null; }
}
