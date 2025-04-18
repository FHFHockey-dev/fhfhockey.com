// web/utils/fetchWigoPlayerStats.ts

import { TableAggregateData, CombinedPlayerStats } from "components/WiGO/types";
import supabase from "lib/supabase";
import { Database } from "lib/supabase/database-generated.types";

// Import the types for the tables
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
  pp_toi_pct_per_game: number | null;
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

export interface SkaterGameLogStatsData {
  date: string;
  toi_per_game: number | null;
  pp_toi_per_game: number | null; // <<< ADDED
  pp_toi_pct_per_game: number | null; // <<< ADDED
}

const countStatsMap: Record<string, string> = {
  GP: "gp",
  ATOI: "atoi",
  Goals: "g",
  Assists: "a",
  Points: "pts",
  SOG: "sog",
  "S%": "s_pct",
  ixG: "ixg",
  PPG: "ppg",
  PPA: "ppa",
  PPP: "ppp",
  PPTOI: "pptoi",
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
  "iSCF/60": "iscf_per_60",
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

  const careerData = careerRes.data as WigoCareerRow | null;
  const recentData = recentRes.data as WigoRecentRow | null;

  if (!careerData && !recentData) {
    console.warn(
      `No aggregated data found for player ${playerId} in wigo_career or wigo_recent.`
    );
    return { counts: [], rates: [] };
  }

  const countsData: TableAggregateData[] = [];
  const ratesData: TableAggregateData[] = [];

  // Updated getValue to explicitly return null if value is null/undefined or NaN
  const getValue = (
    row: WigoCareerRow | WigoRecentRow | null,
    key: string | undefined
  ): number | null => {
    if (row && key && (row as any)[key] != null) {
      const num = Number((row as any)[key]);
      // Return the number if it's valid, otherwise null
      return isNaN(num) ? null : num;
    }
    // Return null if row, key, or the value itself is null/undefined
    return null;
  };

  // --- Process Count Stats ---
  const gpBaseColName = "gp"; // The base column name for Games Played

  for (const [label, baseColName] of Object.entries(countStatsMap)) {
    // **** ADD THE GP OBJECT HERE ****
    const rowData: TableAggregateData = {
      label: label,
      // Populate the GP object using the correct column names
      GP: {
        STD: getValue(careerData, `std_${gpBaseColName}`),
        LY: getValue(careerData, `ly_${gpBaseColName}`),
        // The script stores these as integers/doubles representing actual GP totals/averages
        "3YA": getValue(careerData, `ya3_${gpBaseColName}`),
        CA: getValue(careerData, `ca_${gpBaseColName}`),
        L5: getValue(recentData, `l5_${gpBaseColName}`),
        L10: getValue(recentData, `l10_${gpBaseColName}`),
        L20: getValue(recentData, `l20_${gpBaseColName}`)
      },
      // Populate the stat values
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

  // --- Process Rate Stats ---
  // Rate stats typically don't need the GP object for formatting,
  // unless you were calculating something complex.
  for (const [label, baseColName] of Object.entries(rateStatsMap)) {
    const rowData: TableAggregateData = {
      // Create rowData *without* GP for rates table
      label: label,
      // Note: getValue now returns null properly if data is missing
      STD: getValue(careerData, `std_${baseColName}`),
      LY: getValue(careerData, `ly_${baseColName}`),
      "3YA": getValue(careerData, `ya3_${baseColName}`),
      CA: getValue(careerData, `ca_${baseColName}`),
      L5: getValue(recentData, `l5_${baseColName}`),
      L10: getValue(recentData, `l10_${baseColName}`),
      L20: getValue(recentData, `l20_${baseColName}`)
    };
    // Handle PP% transformation (check for null or undefined)
    if (label === "PP%") {
      const transform = (val: number | null | undefined) =>
        val != null ? val * 100 : null;
      rowData.STD = transform(rowData.STD);
      rowData.LY = transform(rowData.LY);
      rowData["3YA"] = transform(rowData["3YA"]);
      rowData.CA = transform(rowData.CA);
      rowData.L5 = transform(rowData.L5);
      rowData.L10 = transform(rowData.L10);
      rowData.L20 = transform(rowData.L20);
    }

    ratesData.push(rowData);
  }

  // Return the structured data
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
        points_per_game,
        pp_toi_pct_per_game
      `
      )
      .eq("player_id", playerId)
      .order("season", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        `Error fetching player totals for player ${playerId}:`,
        error
      );
      throw error;
    }

    // --- Convert average pp_toi_pct_per_game from decimal to percentage ---
    let processedData = data;
    if (processedData && processedData.pp_toi_pct_per_game !== null) {
      // comes from totals as a decimal (e.g., 0.35)
      processedData.pp_toi_pct_per_game *= 100;
    }

    // console.log(`Workspaceed Per Game Totals Data for player ${playerId} (Latest Season):`, processedData);
    return processedData as SkaterTotalsData | null; // Cast to updated interface
  } catch (err) {
    console.error(
      `Unexpected error in fetchPlayerPerGameTotals for player ${playerId}:`,
      err
    );
    throw err;
  }
};

// --- Function to fetch game-by-game Points ---
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

export const fetchPlayerGameLogStats = async (
  playerId: number,
  season: string // Keep accepting the string identifier from the totals data
): Promise<SkaterGameLogStatsData[]> => {
  // <<< UPDATE Return Type
  if (!playerId || !season) return []; // Return empty array if no player or season

  const seasonIdNumber = parseInt(season, 10);
  if (isNaN(seasonIdNumber)) {
    console.error(`Failed to parse season string "${season}" into a number.`);
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("wgo_skater_stats") // Query the game log table
      .select(
        `
        date,
        toi_per_game,
        pp_toi_per_game,
        pp_toi_pct_per_game
      `
      )
      .eq("player_id", playerId)
      .eq("season_id", seasonIdNumber)
      .order("date", { ascending: true }); // Order chronologically

    if (error) {
      console.error(
        `Error fetching game log stats for player ${playerId}, season ID ${seasonIdNumber}:`,
        error
      );
      throw error;
    }

    // --- Convert pp_toi_pct_per_game from decimal to percentage ---
    const processedData =
      data?.map((item) => ({
        ...item,
        // Assuming pp_toi_pct_per_game is stored as a decimal (e.g., 0.25 for 25%)
        // Multiply by 100 if it's not null, otherwise keep it null
        pp_toi_pct_per_game:
          item.pp_toi_pct_per_game !== null
            ? item.pp_toi_pct_per_game * 100
            : null
      })) || [];

    // console.log(`Workspaceed Game Log Stats for player ${playerId}, season ${seasonIdNumber}:`, processedData); // Optional Debug Log

    return (processedData as SkaterGameLogStatsData[]) || []; // Ensure result is an array
  } catch (err) {
    console.error(
      `Unexpected error in fetchPlayerGameLogStats for player ${playerId}, season ID ${seasonIdNumber}:`,
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
