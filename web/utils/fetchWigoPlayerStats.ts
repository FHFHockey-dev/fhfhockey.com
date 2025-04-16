// web/utils/fetchWigoPlayerStats.ts

import { TableAggregateData, CombinedPlayerStats } from "components/WiGO/types"; // Ensure path is correct
import supabase from "lib/supabase";
import { Database } from "lib/supabase/database-generated.types"; // Import your generated types

// FIX: Use generated types directly for the fetched rows
type WigoCareerRow = Database["public"]["Tables"]["wigo_career"]["Row"];
type WigoRecentRow = Database["public"]["Tables"]["wigo_recent"]["Row"];

export interface SkaterTotalsData {
  player_id: number;
  games_played: number | null;
  goals: number | null;
  assists: number | null;
  points: number | null;
  shots: number | null;
  pp_points: number | null;
  hits: number | null;
  blocked_shots: number | null;
  penalty_minutes: number | null;
  season: string | null;
  toi_per_game: number | null;
  points_per_game: number | null;
}

export interface SkaterGameLogConsistencyData {
  date: string;
  points: number | null;
  shots: number | null;
  hits: number | null;
  blocked_shots: number | null;
}

// Interface for the raw points game log data
export interface SkaterGameLogPointsData {
  date: string; // 'YYYY-MM-DD'
  points: number | null;
}

// Keep existing SkaterGameLogData for TOI if needed elsewhere
export interface SkaterGameLogToiData {
  date: string;
  toi_per_game: number | null;
}

// Define the stats we want to display and map them to DB columns
// Keys are the display labels, values are the base column names (without prefixes)
const countStatsMap: Record<string, string> = {
  GP: "gp",
  ATOI: "atoi",
  Goals: "g",
  Assists: "a",
  Points: "pts",
  // A1: 'a1', // Uncomment if a1 columns exist
  SOG: "sog",
  "S%": "s_pct",
  ixG: "ixg",
  PPG: "ppg",
  PPA: "ppa",
  PPP: "ppp",

  PPTOI: "pptoi", // Stored as number (seconds avg?) in DB, formatted later
  "PP%": "pp_pct",
  HIT: "hit",
  BLK: "blk",
  PIM: "pim",
  iCF: "icf",
  IPP: "ipp",
  "oiSH%": "oi_sh_pct",
  "OZS%": "ozs_pct",
  "PTS1%": "pts1_pct"
};

const rateStatsMap: Record<string, string> = {
  "G/60": "g_per_60",
  "A/60": "a_per_60",
  "PTS/60": "pts_per_60",
  "PTS1/60": "pts1_per_60",
  "SOG/60": "sog_per_60",
  "ixG/60": "ixg_per_60",
  "iCF/60": "icf_per_60",
  "iHDCF/60": "ihdcf_per_60",
  "iSCF/60": "iscf_per_60", // Renamed from iscfs
  "PPG/60": "ppg_per_60",
  "PPA/60": "ppa_per_60",
  "PPP/60": "ppp_per_60",
  "HIT/60": "hit_per_60",
  "BLK/60": "blk_per_60",
  "PIM/60": "pim_per_60"
};

/**
 * Fetches pre-aggregated player stats from wigo_career and wigo_recent
 * and transforms them into the TableAggregateData format for display.
 */
export async function fetchPlayerAggregatedStats(
  playerId: number
): Promise<CombinedPlayerStats> {
  // Return type matches the *modified* interface
  console.log(`Workspaceing pre-aggregated stats for Player ID: ${playerId}`);

  const [careerRes, recentRes] = await Promise.all([
    supabase
      .from("wigo_career")
      .select("*")
      .eq("player_id", playerId)
      .maybeSingle(),
    supabase
      .from("wigo_recent")
      .select("*")
      .eq("player_id", playerId)
      .maybeSingle()
  ]);

  if (careerRes.error) {
    console.error("Error fetching wigo_career data:", careerRes.error);
    throw new Error(`Failed to fetch career stats: ${careerRes.error.message}`);
  }
  if (recentRes.error) {
    console.error("Error fetching wigo_recent data:", recentRes.error);
    throw new Error(`Failed to fetch recent stats: ${recentRes.error.message}`);
  }

  // Use the correct imported types
  const careerData = careerRes.data as WigoCareerRow | null;
  const recentData = recentRes.data as WigoRecentRow | null;

  if (!careerData && !recentData) {
    console.warn(
      `No aggregated data found for player ${playerId} in wigo_career or wigo_recent.`
    );
    return { counts: [], rates: [] }; // Return type matches modified CombinedPlayerStats
  }

  const countsData: TableAggregateData[] = [];
  const ratesData: TableAggregateData[] = [];

  // Helper to safely get value and default to 0
  const getValue = (
    row: WigoCareerRow | WigoRecentRow | null,
    key: string | undefined
  ): number => {
    // Default to 0 if row is null or key is undefined/null or value is null/undefined
    // Use 'any' for dynamic access, assuming key structure matches DB columns
    return row && key && (row as any)[key] != null
      ? Number((row as any)[key])
      : 0;
  };

  // Process Count Stats
  for (const [label, baseColName] of Object.entries(countStatsMap)) {
    const rowData: TableAggregateData = {
      label: label,
      STD: getValue(careerData, `std_${baseColName}`),
      LY: getValue(careerData, `ly_${baseColName}`),
      "3YA": getValue(careerData, `ya3_${baseColName}`),
      CA: getValue(careerData, `ca_${baseColName}`),
      L5: getValue(recentData, `l5_${baseColName}`),
      L10: getValue(recentData, `l10_${baseColName}`),
      L20: getValue(recentData, `l20_${baseColName}`)
    };
    countsData.push(rowData);
  }

  // Process Rate Stats
  for (const [label, baseColName] of Object.entries(rateStatsMap)) {
    // Handle special case for PP% where DB stores fraction, display needs percentage
    const isPPPercent = label === "PP%";
    const transform = (val: number) => (isPPPercent ? val * 100 : val); // Multiply by 100 only for PP%

    const rowData: TableAggregateData = {
      label: label,
      STD: transform(getValue(careerData, `std_${baseColName}`)),
      LY: transform(getValue(careerData, `ly_${baseColName}`)),
      "3YA": transform(getValue(careerData, `ya3_${baseColName}`)),
      CA: transform(getValue(careerData, `ca_${baseColName}`)),
      L5: transform(getValue(recentData, `l5_${baseColName}`)),
      L10: transform(getValue(recentData, `l10_${baseColName}`)),
      L20: transform(getValue(recentData, `l20_${baseColName}`))
    };
    ratesData.push(rowData);
  }

  // Return the simplified structure matching the modified CombinedPlayerStats
  return {
    counts: countsData,
    rates: ratesData
  };
}

// New function to fetch per-game relevant totals
export const fetchPlayerPerGameTotals = async (
  playerId: number
): Promise<SkaterTotalsData | null> => {
  if (!playerId) return null;

  try {
    // Fetch the latest season's stats for the player
    const { data, error } = await supabase
      .from("wgo_skater_stats_totals")
      .select(
        `
        player_id,
        games_played,
        goals,
        assists,
        points,
        shots,
        pp_points,
        hits,
        blocked_shots,
        penalty_minutes,
        season,
        toi_per_game,
        points_per_game
      `
      )
      .eq("player_id", playerId)
      .order("season", { ascending: false }) // <<< ORDER BY LATEST SEASON
      .limit(1) // <<< GET ONLY ONE ROW (THE LATEST)
      .maybeSingle(); // <<< STILL USE maybeSingle() - handles the case where player has NO rows at all

    if (error) {
      // This specific PGRST116 error for multiple rows should be gone now,
      // but other errors could still occur.
      console.error(
        `Error fetching player totals for player ${playerId}:`,
        error
      );
      throw error; // Re-throw the error to be caught by the component
    }

    // console.log(`Workspaceed Per Game Totals Data for player ${playerId} (Latest Season):`, data); // Debug log
    return data as SkaterTotalsData | null;
  } catch (err) {
    // Catch unexpected errors during the fetch process
    console.error(
      `Unexpected error in fetchPlayerPerGameTotals for player ${playerId}:`,
      err
    );
    throw err; // Re-throw
  }
};

// --- NEW Function to fetch game-by-game Points ---
export const fetchPlayerGameLogPoints = async (
  playerId: number,
  season: string // Season identifier (e.g., "20232024")
): Promise<SkaterGameLogPointsData[]> => {
  if (!playerId || !season) return [];

  const seasonIdNumber = parseInt(season, 10);
  if (isNaN(seasonIdNumber)) {
    console.error(
      `Invalid season format received: "${season}". Cannot convert to number.`
    );
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("wgo_skater_stats") // Query the game log table
      .select(
        `
        date,
        points
      ` // Select points for this game
      )
      .eq("player_id", playerId)
      .eq("season_id", seasonIdNumber) // Filter by the specific season ID (numeric)
      .order("date", { ascending: true }); // Order chronologically

    if (error) {
      console.error(
        `Error fetching game log Points for player ${playerId}, season ${season}:`,
        error
      );
      throw error;
    }
    return (data as SkaterGameLogPointsData[]) || []; // Ensure result is an array
  } catch (err) {
    console.error(
      `Unexpected error in fetchPlayerGameLogPoints for player ${playerId}, season ${season}:`,
      err
    );
    throw err;
  }
};

export const fetchPlayerGameLogToi = async (
  playerId: number,
  season: string // Keep accepting the string identifier from the totals data
): Promise<SkaterGameLogToiData[]> => {
  if (!playerId || !season) return []; // Return empty array if no player or season

  // --- Convert the string season to a number ---
  const seasonIdNumber = parseInt(season, 10);

  // Optional: Add a check if the conversion failed (e.g., season was not a valid number string)
  if (isNaN(seasonIdNumber)) {
    console.error(`Failed to parse season string "${season}" into a number.`);
    return [];
  }
  // ---------------------------------------------

  try {
    const { data, error } = await supabase
      .from("wgo_skater_stats") // Query the game log table
      .select(
        `
        date,
        toi_per_game
      `
      )
      .eq("player_id", playerId)
      .eq("season_id", seasonIdNumber)
      // -------------------------------------------------------
      .order("date", { ascending: true }); // Order chronologically

    if (error) {
      console.error(
        `Error fetching game log TOI for player ${playerId}, season ID ${seasonIdNumber}:`, // Log the numeric ID used
        error
      );
      throw error;
    }

    return (data as SkaterGameLogToiData[]) || []; // Ensure result is an array
  } catch (err) {
    console.error(
      `Unexpected error in fetchPlayerGameLogToi for player ${playerId}, season ID ${seasonIdNumber}:`, // Log the numeric ID used
      err
    );
    throw err; // Re-throw
  }
};

// --- NEW Function to fetch game-by-game data for Consistency ---
export const fetchPlayerGameLogConsistencyData = async (
  playerId: number,
  season: string // Season identifier (e.g., "20232024")
): Promise<SkaterGameLogConsistencyData[]> => {
  if (!playerId || !season) return [];

  const seasonIdNumber = parseInt(season, 10);
  if (isNaN(seasonIdNumber)) {
    console.error(
      `Invalid season format received: "${season}". Cannot convert to number.`
    );
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("wgo_skater_stats") // Query the game log table
      .select(
        `
        date,
        points,
        shots,
        hits,
        blocked_shots
      ` // Select fields needed for calculation
      )
      .eq("player_id", playerId)
      .eq("season_id", seasonIdNumber) // Filter by the specific season ID (numeric)
      .order("date", { ascending: true }); // Order chronologically (optional for this calc)

    if (error) {
      console.error(
        `Error fetching game log Consistency Data for player ${playerId}, season ${season}:`,
        error
      );
      throw error;
    }
    return (data as SkaterGameLogConsistencyData[]) || []; // Ensure result is an array
  } catch (err) {
    console.error(
      `Unexpected error in fetchPlayerGameLogConsistencyData for player ${playerId}, season ${season}:`,
      err
    );
    throw err;
  }
};
