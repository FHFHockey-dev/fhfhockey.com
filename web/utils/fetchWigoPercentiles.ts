// /utils/fetchWigoPercentiles.ts (or add to fetchWigoPlayerStats.ts)
import supabase from "lib/supabase";
import { Database } from "lib/supabase/database-generated.types";
import {
  PercentileStrength,
  OffensePercentileTable,
  DefensePercentileTable,
  PlayerRawStats
} from "components/WiGO/types";

// Define the columns needed from each table for ranking + TOI/GP calculation
// Crucially includes player_id, gp, toi, and all stats being ranked
const ALL_OFFENSE_COLUMNS_TO_SELECT = `
    player_id, season, gp, toi_seconds,
    goals_per_60, total_assists_per_60, total_points_per_60, shots_per_60,
    iscfs_per_60, i_hdcf_per_60, ixg_per_60, icf_per_60,
    cf_per_60, scf_per_60, oi_hdcf_per_60,
    cf_pct, ff_pct, sf_pct, gf_pct, xgf_pct, scf_pct, hdcf_pct
`; // Add more if needed

const ALL_DEFENSE_COLUMNS_TO_SELECT = `
    player_id, season, gp, toi_seconds
`; // Only fetch overlap/required defense stats to merge

/**
 * Fetches raw stats for ALL players for the latest season for a given strength.
 */
export async function fetchAllPlayerStatsForStrength(
  strength: PercentileStrength
): Promise<PlayerRawStats[]> {
  console.log(`Workspaceing ALL player stats for Strength: ${strength}`);

  const offenseTable =
    `nst_percentile_${strength}_offense` as OffensePercentileTable;
  const defenseTable =
    `nst_percentile_${strength}_defense` as DefensePercentileTable;

  // TODO: Determine the latest season dynamically if necessary
  // For now, assuming we fetch all rows and filter later, or that tables only contain latest
  // Example: const { data: seasonData } = await supabase.from(offenseTable).select('season').order('season', {ascending: false}).limit(1).single();
  // const latestSeason = seasonData?.season;
  // if (!latestSeason) return []; ... then add .eq('season', latestSeason) to queries below

  try {
    // Fetch data from both tables - potentially large datasets!
    const [offenseRes, defenseRes] = await Promise.all([
      supabase.from(offenseTable).select(ALL_OFFENSE_COLUMNS_TO_SELECT),
      // .eq('season', latestSeason) // Add if latestSeason is determined
      supabase.from(defenseTable).select(ALL_DEFENSE_COLUMNS_TO_SELECT)
      // .eq('season', latestSeason) // Add if latestSeason is determined
    ]);

    if (offenseRes.error) throw offenseRes.error;
    // Defense error might be less critical if offense has gp/toi, handle as needed
    if (defenseRes.error)
      console.warn(`Error fetching ${defenseTable}:`, defenseRes.error);

    const offenseData = offenseRes.data || [];
    const defenseDataById = new Map(
      (defenseRes.data || []).map((d) => [d.player_id, d])
    );

    // Combine data: Use offense data as primary, supplement gp/toi from defense if missing
    const combinedData: PlayerRawStats[] = offenseData.map((offensePlayer) => {
      const defensePlayer = defenseDataById.get(offensePlayer.player_id);
      return {
        ...offensePlayer,
        // Ensure gp/toi are present, prioritizing offense, fallback to defense
        gp: offensePlayer.gp ?? defensePlayer?.gp ?? null,
        toi: offensePlayer.toi_seconds ?? defensePlayer?.toi_seconds ?? null
      } as PlayerRawStats; // Assert type based on selection
    });

    console.log(
      `Workspaceed ${combinedData.length} players for strength ${strength}`
    );
    return combinedData;
  } catch (err) {
    console.error(
      `Error fetching all player stats for strength ${strength}:`,
      err
    );
    return []; // Return empty array on error
  }
}
