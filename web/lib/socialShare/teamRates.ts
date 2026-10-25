import publicSupabase from "lib/supabase/public-client";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import type { ShareTeamRateRow } from "./matchups";

/** One season and one situation is about 32 rows; anything past this is refused, never paged on. */
export const TEAM_RATE_ROW_LIMIT = 64;
const TEAM_RATE_COLUMNS = "team_abbreviation,gp,xgf,xga,gf,ga,sf,sa,season,situation,updated_at";
type TeamRateSourceRow = ShareTeamRateRow & { team_abbreviation: string | null };

/**
 * Social-share copy of Game Grid's loadCurrentSeasonStats rules (exact count, one season,
 * situation "all", unique abbreviations), reading only the rate columns with an explicit row limit.
 */
export async function loadShareTeamRates(season: number): Promise<Record<string, ShareTeamRateRow>> {
  let expected: number | null = null;
  const rows = await fetchAllSupabasePages<TeamRateSourceRow>(async ({ from, to }) => {
    const { data, error, count } = await publicSupabase.from("nst_team_stats")
      .select(TEAM_RATE_COLUMNS, { count: "exact" })
      .eq("season", season).eq("situation", "all")
      .order("team_abbreviation", { ascending: true }).range(from, to);
    if (!error) {
      if (count == null || !Number.isFinite(count) || count < 0 || (expected != null && count !== expected)) throw new Error("Team rate completeness changed or is unavailable.");
      expected = count;
    }
    return { data: data as unknown as TeamRateSourceRow[] | null, error };
  }, { pageSize: TEAM_RATE_ROW_LIMIT, limit: TEAM_RATE_ROW_LIMIT });
  // A count above the limit leaves rows short of it, so an oversized source fails closed.
  if (expected === null || rows.length !== expected) throw new Error("Team rate response was incomplete or over the row limit.");
  const rates: Record<string, ShareTeamRateRow> = {};
  for (const row of rows) {
    const abbreviation = row.team_abbreviation?.trim().toUpperCase();
    if (!abbreviation || row.season !== season || row.situation !== "all" || rates[abbreviation]) throw new Error("Team rate row identity was invalid or ambiguous.");
    rates[abbreviation] = { gp: row.gp, xgf: row.xgf, xga: row.xga, gf: row.gf, ga: row.ga, sf: row.sf, sa: row.sa, season: row.season, situation: row.situation, updated_at: row.updated_at };
  }
  return rates;
}
