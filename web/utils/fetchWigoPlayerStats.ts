// web/utils/fetchWigoPlayerStats.ts

import {
  TableAggregateData,
  CombinedPlayerStats,
  PlayerRawStats,
  PercentileStrength
} from "components/WiGO/types";
import supabase from "lib/supabase";
import { Database } from "lib/supabase/database-generated.types";
import {
  OFFENSE_RATING_STATS,
  DEFENSE_RATING_STATS
} from "components/WiGO/ratingsConstants";

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
  shooting_percentage: number | null;
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

export interface GameLogDataPoint {
  date: string; // 'YYYY-MM-DD'
  value: number | null;
}

type GameLogTableName = Extract<
  keyof Database["public"]["Tables"],
  | "wgo_skater_stats"
  | "nst_gamelog_as_counts"
  | "nst_gamelog_as_rates"
  | "nst_gamelog_as_counts_oi"
  | "nst_gamelog_as_rates_oi"
>;

const statToGameLogColumnMap: Record<
  string,
  | { table: GameLogTableName; column: string; unit?: string }
  | {
      calculation: "PTS1%";
      table: "wgo_skater_stats";
      requiredColumns: string[];
    } // Special calculation mapping
  | {
      calculation: "PTS1/60";
      table: "nst_gamelog_as_rates";
      requiredColumns: string[];
    } // **** ADDED PTS1/60 Calculation Type ****
> = {
  // --- From wgo_skater_stats (Likely best source for direct game stats) ---
  GP: { table: "wgo_skater_stats", column: "games_played" }, // Value is usually 1 per game row
  ATOI: { table: "wgo_skater_stats", column: "toi_per_game", unit: "seconds" }, // NHL API gives seconds
  Goals: { table: "wgo_skater_stats", column: "goals" },
  Assists: { table: "wgo_skater_stats", column: "assists" },
  Points: { table: "wgo_skater_stats", column: "points" },
  SOG: { table: "wgo_skater_stats", column: "shots" },
  "S%": {
    table: "wgo_skater_stats",
    column: "shooting_percentage",
    unit: "percent_decimal"
  }, // Often stored 0-100 or 0-1? CHECK DB
  ixG: { table: "nst_gamelog_as_counts", column: "ixg" },
  PPG: { table: "wgo_skater_stats", column: "pp_goals" },
  PPA: { table: "wgo_skater_stats", column: "pp_assists" },
  PPP: { table: "wgo_skater_stats", column: "pp_points" },
  PPTOI: {
    table: "wgo_skater_stats",
    column: "pp_toi_per_game",
    unit: "seconds"
  }, // NHL API gives seconds
  "PP%": {
    table: "wgo_skater_stats",
    column: "pp_toi_pct_per_game",
    unit: "percent_decimal"
  }, // CHECK DB format (likely 0-1 decimal)
  HIT: { table: "wgo_skater_stats", column: "hits" },
  BLK: { table: "wgo_skater_stats", column: "blocked_shots" },
  PIM: { table: "wgo_skater_stats", column: "penalty_minutes" },
  // --- From nst_gamelog_as_counts (Individual counts) ---
  iCF: { table: "nst_gamelog_as_counts", column: "icf" },
  IPP: { table: "nst_gamelog_as_counts", column: "ipp" },
  "oiSH%": {
    table: "nst_gamelog_as_counts_oi",
    column: "on_ice_sh_pct",
    unit: "percent_decimal"
  },
  "OZS%": {
    table: "nst_gamelog_as_counts_oi",
    column: "off_zone_start_pct",
    unit: "percent_decimal"
  }, // Check DB format

  // --- From nst_gamelog_as_rates (Individual rates) ---
  "G/60": { table: "nst_gamelog_as_rates", column: "goals_per_60" },
  "A/60": { table: "nst_gamelog_as_rates", column: "total_assists_per_60" },
  "PTS/60": { table: "nst_gamelog_as_rates", column: "total_points_per_60" },
  "SOG/60": { table: "nst_gamelog_as_rates", column: "shots_per_60" },
  "ixG/60": { table: "nst_gamelog_as_rates", column: "ixg_per_60" },
  "iCF/60": { table: "nst_gamelog_as_rates", column: "icf_per_60" },
  "iHDCF/60": { table: "nst_gamelog_as_rates", column: "hdcf_per_60" }, // NST uses hdcf_per_60
  "iSCF/60": { table: "nst_gamelog_as_rates", column: "iscfs_per_60" }, // NST uses iscfs_per_60
  "PPG/60": { table: "nst_gamelog_as_rates", column: "ppg_per_60" }, // Need powerplay specific table/columns
  "PPA/60": { table: "nst_gamelog_as_rates", column: "ppa_per_60" }, // Need powerplay specific table/columns
  "PPP/60": { table: "nst_gamelog_as_rates", column: "ppp_per_60" }, // Need powerplay specific table/columns
  "HIT/60": { table: "nst_gamelog_as_rates", column: "hits_per_60" },
  "BLK/60": { table: "nst_gamelog_as_rates", column: "shots_blocked_per_60" }, // NST uses shots_blocked_per_60
  "PIM/60": { table: "nst_gamelog_as_rates", column: "pim_per_60" },

  // **** Special Calculation for PTS1% ****
  "PTS1%": {
    calculation: "PTS1%",
    table: "wgo_skater_stats",
    requiredColumns: ["goals", "total_primary_assists", "points"] // Map to ACTUAL column names in wgo_skater_stats
  },
  "PTS1/60": {
    calculation: "PTS1/60",
    table: "nst_gamelog_as_rates",
    requiredColumns: ["goals_per_60", "first_assists_per_60"] // Columns needed for calculation
  },
  // --- From nst_gamelog_as_rates_oi (On-Ice Rates/Percentages) ---
  // Need to decide if you want individual rates (above) or on-ice rates for chart
  "CF%": {
    table: "nst_gamelog_as_rates_oi",
    column: "cf_pct",
    unit: "percent_decimal"
  }, // Check DB format
  "FF%": {
    table: "nst_gamelog_as_rates_oi",
    column: "ff_pct",
    unit: "percent_decimal"
  }, // Check DB format
  "SF%": {
    table: "nst_gamelog_as_rates_oi",
    column: "sf_pct",
    unit: "percent_decimal"
  }, // Check DB format
  "GF%": {
    table: "nst_gamelog_as_rates_oi",
    column: "gf_pct",
    unit: "percent_decimal"
  }, // Check DB format
  "xGF%": {
    table: "nst_gamelog_as_rates_oi",
    column: "xgf_pct",
    unit: "percent_decimal"
  }, // Check DB format
  "SCF%": {
    table: "nst_gamelog_as_rates_oi",
    column: "scf_pct",
    unit: "percent_decimal"
  }, // Check DB format
  "HDCF%": {
    table: "nst_gamelog_as_rates_oi",
    column: "hdcf_pct",
    unit: "percent_decimal"
  } // Check DB format
};

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

export async function fetchPlayerGameLogForStat(
  playerId: number,
  seasonId: number,
  statLabel: string
): Promise<GameLogDataPoint[]> {
  const mapping = statToGameLogColumnMap[statLabel];

  if (!mapping) {
    console.warn(`No game log mapping found for stat label: "${statLabel}"`);
    return [];
  }

  try {
    // **** Handle Special Calculation for PTS1% ****
    if ("calculation" in mapping && mapping.calculation === "PTS1%") {
      const { table, requiredColumns } = mapping;
      // **** Determine correct date column for the calculation source table ****
      const dateColumn = table === "wgo_skater_stats" ? "date" : "date_scraped"; // Use date_scraped for nst_*

      console.log(
        `Workspaceing game log for ${statLabel} calculation (Player ${playerId}, Season ${seasonId}) from ${table}, requires: ${requiredColumns.join(
          ", "
        )}`
      );

      const selectString = `${dateColumn}, ${requiredColumns.join(", ")}`;
      const seasonColumn = "season_id"; // PTS1% uses wgo_skater_stats which has season_id

      const { data, error } = await supabase
        .from(table)
        .select(selectString)
        .eq("player_id", playerId)
        .eq(seasonColumn, seasonId) // Use season_id here
        .order(dateColumn, { ascending: true });

      if (error) throw error;

      const calculatedData =
        data?.map((item: any) => {
          const goals = item.goals;
          const primaryAssists = item.total_primary_assists;
          const points = item.points;
          let value: number | null = null;

          if (
            typeof goals === "number" &&
            typeof primaryAssists === "number" &&
            typeof points === "number" &&
            points > 0
          ) {
            value = (goals + primaryAssists) / points;
          } else if (points === 0 && (goals > 0 || primaryAssists > 0)) {
            value = null;
          } else if (points === 0 && goals === 0 && primaryAssists === 0) {
            value = 0;
          }

          return {
            date: item[dateColumn], // Use the fetched date column
            value: value
          };
        }) || [];
      console.log(
        `Workspaceed and calculated data for ${statLabel}:`,
        calculatedData.length,
        "rows"
      ); // Log success/count
      return calculatedData;
    } else if ("calculation" in mapping && mapping.calculation === "PTS1/60") {
      const { table, requiredColumns } = mapping; // table is nst_gamelog_as_rates
      const dateColumn = "date_scraped"; // nst tables use date_scraped
      const seasonColumn = "season"; // nst tables use season

      console.log(
        `Workspaceing game log for ${statLabel} calculation (Player ${playerId}, Season ${seasonId}) from ${table}, requires: ${requiredColumns.join(
          ", "
        )}`
      );
      const selectString = `${dateColumn}, ${requiredColumns.join(", ")}`; // Selects date, goals_per_60, first_assists_per_60

      const { data, error } = await supabase
        .from(table)
        .select(selectString)
        .eq("player_id", playerId)
        .eq(seasonColumn, seasonId.toString()) // Convert number to string for 'season' column
        .order(dateColumn, { ascending: true });
      if (error) throw error;

      const calculatedData =
        data?.map((item: any) => {
          const g60 = item.goals_per_60;
          const a1_60 = item.first_assists_per_60;
          let value: number | null = null;

          // Sum the rates if both are valid numbers
          if (typeof g60 === "number" && typeof a1_60 === "number") {
            value = g60 + a1_60;
          }
          // If only one exists, maybe return that one? Or null? Let's return null if either is missing.
          // else if (typeof g60 === 'number') value = g60;
          // else if (typeof a1_60 === 'number') value = a1_60;

          return { date: item[dateColumn], value: value };
        }) || [];
      console.log(
        `Workspaceed and calculated data for ${statLabel}:`,
        calculatedData.length,
        "rows"
      );
      return calculatedData;
    } else if ("column" in mapping) {
      // **** Handle Standard Column Fetching ****
      const { table, column: statColumn, unit } = mapping;
      // **** Determine correct date AND season column based on table ****
      const dateColumn = table === "wgo_skater_stats" ? "date" : "date_scraped";
      const seasonColumn =
        table === "wgo_skater_stats" ? "season_id" : "season";

      console.log(
        `Workspaceing game log for ${statLabel} (Player ${playerId}, Season ${seasonId}) from ${table}.${statColumn} using date='${dateColumn}' and season='${seasonColumn}'` // Log which columns are used
      );

      const { data, error } = await supabase
        .from(table)
        .select(`${dateColumn}, ${statColumn}`)
        .eq("player_id", playerId)
        .eq(seasonColumn, seasonId) // Use correct season column
        .order(dateColumn, { ascending: true });

      if (error) throw error;

      const gameLogData =
        data?.map((item: any) => {
          let value = item[statColumn];

          // Unit handling remains the same (commented out unless needed)
          // if (unit === "percent_decimal" && typeof value === 'number' && value > 1) {
          //    value = value / 100;
          // }

          return {
            date: item[dateColumn], // Use the fetched date column
            value: typeof value === "number" ? value : null
          };
        }) || [];
      console.log(
        `Workspaceed data for ${statLabel}:`,
        gameLogData.length,
        "rows"
      ); // Log success/count
      return gameLogData;
    } else {
      console.warn(
        `Invalid mapping configuration for stat label: "${statLabel}"`
      );
      return [];
    }
  } catch (err: any) {
    console.error(
      `Supabase error fetching game log for ${statLabel} (Player ${playerId}, Season ${seasonId}):`, // Be more specific about Supabase errors
      err.message || err
    );
    return [];
  }
}

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

export async function fetchPaginatedData<T>(
  tableName: keyof Database["public"]["Tables"],
  selectColumns: string,
  seasonFilter?: { column: string; value: number | string }
): Promise<T[]> {
  const PAGE_SIZE = 500; // Reduced from 1000 to 500
  let allData: T[] = [];
  let page = 0;
  let fetchMore = true;

  console.log(`[fetchPaginatedData] Starting fetch for ${tableName}`);

  while (fetchMore) {
    const startIndex = page * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE - 1;

    let query = supabase
      .from(tableName)
      .select(selectColumns)
      .range(startIndex, endIndex);

    // Add season filter if provided
    // if (seasonFilter) {
    //     query = query.eq(seasonFilter.column, seasonFilter.value);
    // }

    const { data, error, count } = await query; // 'count' might be null depending on settings

    if (error) {
      console.error(
        `[fetchPaginatedData] Error fetching page ${page} for ${tableName}:`,
        error
      );
      throw error; // Re-throw error to be caught by calling function
    }

    if (data) {
      console.log(
        `[fetchPaginatedData] Fetched ${data.length} rows on page ${page} for ${tableName}.`
      );
      allData = allData.concat(data as T[]);
      // Check if the number of rows returned is less than the page size
      if (data.length < PAGE_SIZE) {
        fetchMore = false; // Reached the end
      } else {
        page++; // Prepare for the next page
      }
    } else {
      fetchMore = false; // No data returned, stop.
    }
  }
  console.log(
    `[fetchPaginatedData] Finished fetch for ${tableName}. Total rows: ${allData.length}`
  );
  return allData;
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
        shooting_percentage,
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

const getPercentileOffenseTable = (strength: PercentileStrength) =>
  `nst_percentile_${strength}_offense` as keyof Database["public"]["Tables"];
const getPercentileDefenseTable = (strength: PercentileStrength) =>
  `nst_percentile_${strength}_defense` as keyof Database["public"]["Tables"];

// Helper function to merge player data from multiple strength situations
function mergePlayerData(
  dataArrays: Record<string, any>[][]
): Record<string, any>[] {
  const playerMap = new Map<number, Record<string, any>>();

  // Process each array of player data
  dataArrays.forEach((data) => {
    data.forEach((player) => {
      if (!player.player_id) return;

      const existingPlayer = playerMap.get(player.player_id);
      if (existingPlayer) {
        // Merge the data, preferring non-null values
        Object.entries(player).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            existingPlayer[key] = value;
          }
        });
      } else {
        playerMap.set(player.player_id, { ...player });
      }
    });
  });

  return Array.from(playerMap.values());
}

// --- Corrected fetchPercentilePlayerData Function ---
export async function fetchPercentilePlayerData(seasonId: number): Promise<{
  offense: Record<string, any>[];
  defense: Record<string, any>[];
}> {
  console.log(
    "[fetchPercentilePlayerData] Starting fetch for season:",
    seasonId
  );

  // Prepare select strings for both offense and defense tables
  const offenseSelect = `
    player_id,
    player_name,
    team_abbr,
    position,
    games_played,
    toi,
    goals,
    assists,
    points,
    primary_assists,
    secondary_assists,
    shots,
    shot_attempts,
    individual_xg,
    individual_cf,
    individual_ff,
    individual_sf,
    individual_scf,
    individual_hdcf,
    individual_hdsf,
    individual_hdgf,
    individual_mdcf,
    individual_mdsf,
    individual_mdgf,
    individual_ldcf,
    individual_ldsf,
    individual_ldgf,
    individual_rush_attempts,
    individual_rebounds_created,
    individual_pim,
    individual_takeaways,
    individual_giveaways,
    individual_hits,
    individual_blocks,
    individual_faceoffs_won,
    individual_faceoffs_lost,
    individual_faceoffs_win_pct,
    individual_penalties_drawn,
    individual_penalties_taken,
    individual_penalties_net,
    individual_penalties_net_per_60,
    individual_penalties_net_per_game,
    individual_penalties_net_per_60_rank,
    individual_penalties_net_per_game_rank,
    individual_penalties_net_per_60_percentile,
    individual_penalties_net_per_game_percentile
  `;

  const defenseSelect = `
    player_id,
    player_name,
    team_abbr,
    position,
    games_played,
    toi,
    goals_against,
    shots_against,
    shot_attempts_against,
    xg_against,
    cf_against,
    ff_against,
    sf_against,
    scf_against,
    hdcf_against,
    hdsf_against,
    hdgf_against,
    mdcf_against,
    mdsf_against,
    mdgf_against,
    ldcf_against,
    ldsf_against,
    ldgf_against,
    rush_attempts_against,
    rebounds_created_against,
    pim_against,
    takeaways_against,
    giveaways_against,
    hits_against,
    blocks_against,
    faceoffs_won_against,
    faceoffs_lost_against,
    faceoffs_win_pct_against,
    penalties_drawn_against,
    penalties_taken_against,
    penalties_net_against,
    penalties_net_per_60_against,
    penalties_net_per_game_against,
    penalties_net_per_60_rank_against,
    penalties_net_per_game_rank_against,
    penalties_net_per_60_percentile_against,
    penalties_net_per_game_percentile_against
  `;

  try {
    // Fetch data for each strength situation with season filter
    const [esOffense, ppOffense, pkOffense, esDefense, ppDefense, pkDefense] =
      await Promise.all([
        fetchPaginatedData<Record<string, any>>(
          "nst_percentile_es_offense" as keyof Database["public"]["Tables"],
          offenseSelect,
          { column: "season_id", value: seasonId }
        ),
        fetchPaginatedData<Record<string, any>>(
          "nst_percentile_pp_offense" as keyof Database["public"]["Tables"],
          offenseSelect,
          { column: "season_id", value: seasonId }
        ),
        fetchPaginatedData<Record<string, any>>(
          "nst_percentile_pk_offense" as keyof Database["public"]["Tables"],
          offenseSelect,
          { column: "season_id", value: seasonId }
        ),
        fetchPaginatedData<Record<string, any>>(
          "nst_percentile_es_defense" as keyof Database["public"]["Tables"],
          defenseSelect,
          { column: "season_id", value: seasonId }
        ),
        fetchPaginatedData<Record<string, any>>(
          "nst_percentile_pp_defense" as keyof Database["public"]["Tables"],
          defenseSelect,
          { column: "season_id", value: seasonId }
        ),
        fetchPaginatedData<Record<string, any>>(
          "nst_percentile_pk_defense" as keyof Database["public"]["Tables"],
          defenseSelect,
          { column: "season_id", value: seasonId }
        )
      ]);

    // Merge the data for offense and defense
    const mergedOffense = mergePlayerData([esOffense, ppOffense, pkOffense]);
    const mergedDefense = mergePlayerData([esDefense, ppDefense, pkDefense]);

    console.log(
      `[fetchPercentilePlayerData] Merged ${mergedOffense.length} offense players and ${mergedDefense.length} defense players for season ${seasonId}`
    );

    return {
      offense: mergedOffense,
      defense: mergedDefense
    };
  } catch (error) {
    console.error(
      "[fetchPercentilePlayerData] Error fetching percentile data:",
      error
    );
    throw error;
  }
}
