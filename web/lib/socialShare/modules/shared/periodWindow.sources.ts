import { bounded } from "lib/socialShare/trendSources";
import type { SharePostReadClient } from "../contract";
import { seasonScope } from "../creaseShift";
import type { MatchupRow } from "./periodWindow";

/** 27 weeks this season. Above this a read fails closed. */
const WEEK_LIMIT = 40;
/** One matchup season's rows. The table stores the season as text, "2026". */
export const readMatchupRows = (client: SharePostReadClient, matchupSeason: string) => bounded<MatchupRow>("Matchup weeks", WEEK_LIMIT, (start, end) => client.from("yahoo_matchup_weeks").select("week,start_date,end_date", { count: "exact" }).eq("season", matchupSeason).order("week").range(start, end));

export type MatchupWeeksResponse = { rows: MatchupRow[]; cutoff: string };
/** This season's calendar and the same cutoff the post loaders use, so the pager and the server agree on what has started. */
export async function loadMatchupWeeks(client: SharePostReadClient, generatedAt: string): Promise<MatchupWeeksResponse> {
  const { through, season } = seasonScope(generatedAt);
  return { rows: await readMatchupRows(client, String(season).slice(0, 4)), cutoff: through };
}
