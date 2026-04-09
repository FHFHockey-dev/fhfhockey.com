// web/utils/fetchWigoPlayerStats.ts

import {
  TableAggregateData,
  PlayerRawStats
} from "components/WiGO/types";
import {
  WIGO_STAT_ORDER,
  getWigoStatMetadata,
  normalizeWigoAggregateValue,
  shouldAttachGpMetadata
} from "components/WiGO/statMetadata";
import supabase from "lib/supabase";
import { Database } from "lib/supabase/database-generated.types";

// Import the types for the tables
export type WigoCareerRow = Database["public"]["Tables"]["wigo_career"]["Row"];
export type WigoRecentRow = Database["public"]["Tables"]["wigo_recent"]["Row"];

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

type WigoTotalsFallbackData =
  | (Partial<{
      goals: number | null;
      assists: number | null;
      points: number | null;
      shots: number | null;
      hits: number | null;
      blocked_shots: number | null;
      penalty_minutes: number | null;
      pp_points: number | null;
    }> & { season?: string | null })
  | null;

interface BuildPlayerAggregatedStatsInput {
  careerData: WigoCareerRow | null;
  recentData: WigoRecentRow | null;
  ratesData: Record<string, number | null> | null;
  totalsData: WigoTotalsFallbackData;
}

const getAggregateValue = (
  row: WigoCareerRow | WigoRecentRow | null,
  key: string | undefined
): number | null => {
  if (row && key && (row as Record<string, unknown>)[key] != null) {
    const num = Number((row as Record<string, unknown>)[key]);
    return Number.isNaN(num) ? null : num;
  }
  return null;
};

export function buildPlayerAggregatedStats({
  careerData,
  recentData,
  ratesData,
  totalsData
}: BuildPlayerAggregatedStatsInput): TableAggregateData[] {
  if (!careerData && !recentData) {
    return [];
  }

  const gpBaseColName = "gp";
  const combinedStatsData: TableAggregateData[] = [];

  for (const label of WIGO_STAT_ORDER) {
    const metadata = getWigoStatMetadata(label);
    if (!metadata) {
      console.warn(`Missing WiGO stat metadata for "${label}". Skipping.`);
      continue;
    }

    const baseColName = metadata.baseKey;

    let stdValue = getAggregateValue(careerData, `std_${baseColName}`);
    let lyValue = getAggregateValue(careerData, `ly_${baseColName}`);
    let ya3Value = getAggregateValue(careerData, `ya3_${baseColName}`);
    let caValue = getAggregateValue(careerData, `ca_${baseColName}`);
    let l5Value = getAggregateValue(recentData, `l5_${baseColName}`);
    let l10Value = getAggregateValue(recentData, `l10_${baseColName}`);
    let l20Value = getAggregateValue(recentData, `l20_${baseColName}`);

    if (metadata.isPerSixty && ratesData) {
      const pickRate = (suffix: string) => {
        const key = `${baseColName}_${suffix}`;
        if (Object.prototype.hasOwnProperty.call(ratesData, key)) {
          const rawValue = ratesData[key];
          const num = rawValue != null ? Number(rawValue) : null;
          return Number.isNaN(num as number) ? null : (num as number);
        }
        return undefined;
      };

      const rStd = pickRate("std");
      const rLy = pickRate("ly");
      const rCa = pickRate("ca");
      const r3ya = pickRate("3ya") ?? pickRate("ya3");
      const rL5 = pickRate("l5");
      const rL10 = pickRate("l10");
      const rL20 = pickRate("l20");

      if (rStd !== undefined) stdValue = rStd;
      if (rLy !== undefined) lyValue = rLy;
      if (rCa !== undefined) caValue = rCa;
      if (r3ya !== undefined) ya3Value = r3ya;
      if (rL5 !== undefined) l5Value = rL5;
      if (rL10 !== undefined) l10Value = rL10;
      if (rL20 !== undefined) l20Value = rL20;
    }

    if (metadata.isPerSixty) {
      const per60ToCountMap: Record<string, string> = {
        g_per_60: "g",
        a_per_60: "a",
        pts_per_60: "pts",
        sog_per_60: "sog",
        ixg_per_60: "ixg",
        icf_per_60: "icf",
        hit_per_60: "hit",
        blk_per_60: "blk",
        pim_per_60: "pim"
      };
      const countBase = per60ToCountMap[baseColName];
      const derivePer60 = (
        prefix: "std" | "ly" | "ya3" | "ca"
      ): number | undefined => {
        if (!careerData || !countBase) return undefined;
        const count = getAggregateValue(careerData, `${prefix}_${countBase}`);
        const gp = getAggregateValue(careerData, `${prefix}_gp`);
        const atoiMin = getAggregateValue(careerData, `${prefix}_atoi`);
        if (
          typeof count === "number" &&
          typeof gp === "number" &&
          gp > 0 &&
          typeof atoiMin === "number" &&
          atoiMin > 0
        ) {
          const totalMinutes = atoiMin * gp;
          if (totalMinutes > 0) {
            return (count * 60) / totalMinutes;
          }
        }
        return undefined;
      };
      if (stdValue == null || Number.isNaN(stdValue)) {
        const derived = derivePer60("std");
        if (derived !== undefined) stdValue = derived;
      }
      if (lyValue == null || Number.isNaN(lyValue)) {
        const derived = derivePer60("ly");
        if (derived !== undefined) lyValue = derived;
      }
      if (ya3Value == null || Number.isNaN(ya3Value)) {
        const derived = derivePer60("ya3");
        if (derived !== undefined) ya3Value = derived;
      }
      if (caValue == null || Number.isNaN(caValue)) {
        const derived = derivePer60("ca");
        if (derived !== undefined) caValue = derived;
      }
    }

    if (
      (label === "Goals" ||
        label === "Assists" ||
        label === "Points" ||
        label === "SOG" ||
        label === "HIT" ||
        label === "BLK" ||
        label === "PIM" ||
        label === "PPP") &&
      (stdValue == null || Number.isNaN(stdValue)) &&
      totalsData
    ) {
      const totalsMap: Record<string, number | null | undefined> = {
        Goals: totalsData.goals,
        Assists: totalsData.assists,
        Points: totalsData.points,
        SOG: totalsData.shots,
        HIT: totalsData.hits,
        BLK: totalsData.blocked_shots,
        PIM: totalsData.penalty_minutes,
        PPP: totalsData.pp_points
      };
      const fallback = totalsMap[label];
      if (typeof fallback === "number" && !Number.isNaN(fallback)) {
        stdValue = fallback;
      }
    }

    const normalizedValues = {
      STD: normalizeWigoAggregateValue(label, stdValue),
      LY: normalizeWigoAggregateValue(label, lyValue),
      "3YA": normalizeWigoAggregateValue(label, ya3Value),
      CA: normalizeWigoAggregateValue(label, caValue),
      L5: normalizeWigoAggregateValue(label, l5Value),
      L10: normalizeWigoAggregateValue(label, l10Value),
      L20: normalizeWigoAggregateValue(label, l20Value)
    };

    const rowData: TableAggregateData = {
      label,
      GP: shouldAttachGpMetadata(label)
        ? {
            STD: getAggregateValue(careerData, `std_${gpBaseColName}`),
            LY: getAggregateValue(careerData, `ly_${gpBaseColName}`),
            "3YA": getAggregateValue(careerData, `ya3_${gpBaseColName}`),
            CA: getAggregateValue(careerData, `ca_${gpBaseColName}`),
            L5: getAggregateValue(recentData, `l5_${gpBaseColName}`),
            L10: getAggregateValue(recentData, `l10_${gpBaseColName}`),
            L20: getAggregateValue(recentData, `l20_${gpBaseColName}`)
          }
        : undefined,
      ...normalizedValues
    };

    combinedStatsData.push(rowData);
  }

  return combinedStatsData;
}

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
        .eq(seasonColumn, seasonId)
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
): Promise<TableAggregateData[]> {
  console.log(`Workspaceing pre-aggregated stats for Player ID: ${playerId}`);

  // Fetch base aggregates plus rates table (authoritative for per-60 by timeframe)
  const [careerRes, recentRes, ratesRes, totalsRes] = await Promise.all([
    supabase
      .from("wigo_career")
      .select("*")
      .eq("player_id", playerId)
      .maybeSingle(),
    supabase
      .from("wigo_recent")
      .select("*")
      .eq("player_id", playerId)
      .maybeSingle(),
    supabase
      .from("wigo_rates")
      .select("*")
      .eq("player_id", playerId)
      .maybeSingle(),
    supabase
      .from("wgo_skater_stats_totals")
      .select(
        `goals,assists,points,shots,hits,blocked_shots,penalty_minutes,pp_points,season,toi_per_game,pp_toi_pct_per_game`
      )
      .eq("player_id", playerId)
      .order("season", { ascending: false })
      .limit(1)
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
  if (ratesRes.error) {
    console.error("Error fetching wigo_rates data:", ratesRes.error);
    // Don't throw—some older players may not have rates populated; we'll fallback to career
  }
  if (totalsRes.error) {
    // Non-fatal: totals are only used as an optional fallback for some STD counts
    console.warn("Totals fallback unavailable:", totalsRes.error.message);
  }

  const careerData = careerRes.data as WigoCareerRow | null;
  const recentData = recentRes.data as WigoRecentRow | null;
  const ratesData = (
    ratesRes && !ratesRes.error ? (ratesRes.data as any | null) : null
  ) as any | null;
  const totalsData = (
    totalsRes && !totalsRes.error ? (totalsRes.data as any | null) : null
  ) as
    | (Partial<{
        goals: number | null;
        assists: number | null;
        points: number | null;
        shots: number | null;
        hits: number | null;
        blocked_shots: number | null;
        penalty_minutes: number | null;
        pp_points: number | null;
      }> & { season?: string | null })
    | null;

  if (!careerData && !recentData) {
    console.warn(
      `No aggregated data found for player ${playerId} in wigo_career or wigo_recent.`
    );
    return []; // Return empty array
  }

  return buildPlayerAggregatedStats({
    careerData,
    recentData,
    ratesData,
    totalsData
  });
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
  const MAX_RETRIES = 3;

  while (fetchMore) {
    const startIndex = page * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE - 1;

    let retries = 0;
    let success = false;
    let lastError = null;

    while (retries < MAX_RETRIES && !success) {
      try {
        let query = supabase
          .from(tableName)
          .select(selectColumns)
          .range(startIndex, endIndex);

        // Add season filter if provided
        if (seasonFilter) {
          query = query.eq(seasonFilter.column, seasonFilter.value);
        }

        const { data, error, count } = await query;

        if (error) {
          lastError = error;
          retries++;
          if (retries < MAX_RETRIES) {
            // Wait before retrying (exponential backoff)
            await new Promise((resolve) =>
              setTimeout(resolve, Math.pow(2, retries) * 1000)
            );
            continue;
          }
          throw error;
        }

        if (data) {
          console.log(
            `[fetchPaginatedData] Fetched ${data.length} rows on page ${page} for ${tableName}.`
          );
          allData = allData.concat(data as T[]);
          success = true;

          // Check if the number of rows returned is less than the page size
          if (data.length < PAGE_SIZE) {
            fetchMore = false; // Reached the end
          } else {
            page++; // Prepare for the next page
          }
        } else {
          fetchMore = false; // No data returned, stop.
          success = true;
        }
      } catch (error) {
        lastError = error;
        retries++;
        if (retries < MAX_RETRIES) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, retries) * 1000)
          );
          continue;
        }
        throw error;
      }
    }

    if (!success && lastError) {
      throw lastError;
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

// Helper function (keep as is)
const addStrength = <T>(
  arr: T[],
  strength: string
): (T & { strength: string })[] =>
  arr.map((row: T) => ({
    ...row,
    strength: strength
  }));

// Updated Return Type Signature
export async function fetchPercentilePlayerData(seasonId: number): Promise<{
  offense: (PlayerRawStats & { strength: string })[];
  defense: (PlayerRawStats & { strength: string })[];
}> {
  console.log(
    `[fetchPercentilePlayerData] Starting fetch for season: ${seasonId}`
  );

  const offenseSelect = `
    player_id,
    season,
    gp,
    toi_seconds,
    goals_per_60,
    total_assists_per_60,
    first_assists_per_60,
    second_assists_per_60,
    total_points_per_60,
    shots_per_60,
    ixg_per_60,
    icf_per_60,
    iff_per_60,
    iscfs_per_60,
    i_hdcf_per_60,
    rush_attempts_per_60,
    rebounds_created_per_60,
    cf_per_60,
    ff_per_60,
    sf_per_60,
    gf_per_60,
    xgf_per_60,
    scf_per_60,
    oi_hdcf_per_60,
    hdgf_per_60,
    mdgf_per_60,
    ldgf_per_60,
    cf_pct,
    ff_pct,
    sf_pct,
    gf_pct,
    xgf_pct,
    scf_pct,
    hdcf_pct,
    hdgf_pct,
    mdgf_pct,
    ldgf_pct,
    ipp,
    sh_percentage,
    on_ice_sh_pct,
    penalties_drawn_per_60
  `;

  // Define the columns needed for defense ratings calculation
  // Ensure ALL columns listed in DEFENSE_RATING_STATS are included here
  const defenseSelect = `
    player_id,
    season,
    gp,
    toi_seconds,
    ca_per_60,
    fa_per_60,
    sa_per_60,
    ga_per_60,
    xga_per_60,
    sca_per_60,
    hdca_per_60,
    hdga_per_60,
    mdga_per_60,
    ldga_per_60,
    shots_blocked_per_60,
    takeaways_per_60,
    hits_per_60,
    pim_per_60,
    total_penalties_per_60,
    minor_penalties_per_60,
    major_penalties_per_60,
    misconduct_penalties_per_60,
    giveaways_per_60,
    on_ice_sv_pct
  `;

  try {
    // Fetch data specifying PlayerRawStats as the expected type
    const [
      asOffenseRaw,
      asDefenseRaw,
      esOffenseRaw,
      esDefenseRaw,
      ppOffenseRaw,
      pkDefenseRaw
    ] = await Promise.all([
      fetchPaginatedData<PlayerRawStats>( // Specify type
        "nst_percentile_as_offense" as keyof Database["public"]["Tables"],
        offenseSelect,
        { column: "season", value: seasonId }
      ),
      fetchPaginatedData<PlayerRawStats>( // Specify type
        "nst_percentile_as_defense" as keyof Database["public"]["Tables"],
        defenseSelect,
        { column: "season", value: seasonId }
      ),
      fetchPaginatedData<PlayerRawStats>( // Specify type
        "nst_percentile_es_offense" as keyof Database["public"]["Tables"],
        offenseSelect,
        { column: "season", value: seasonId }
      ),
      fetchPaginatedData<PlayerRawStats>( // Specify type
        "nst_percentile_es_defense" as keyof Database["public"]["Tables"],
        defenseSelect,
        { column: "season", value: seasonId }
      ),
      fetchPaginatedData<PlayerRawStats>( // Specify type
        "nst_percentile_pp_offense" as keyof Database["public"]["Tables"],
        offenseSelect,
        { column: "season", value: seasonId }
      ),
      fetchPaginatedData<PlayerRawStats>( // Specify type
        "nst_percentile_pk_defense" as keyof Database["public"]["Tables"],
        defenseSelect,
        { column: "season", value: seasonId }
      )
    ]);

    // Add strength property using the generic helper
    // The result type is (PlayerRawStats & { strength: string })[]
    const asOffense = addStrength(asOffenseRaw, "as");
    const asDefense = addStrength(asDefenseRaw, "as");
    const esOffense = addStrength(esOffenseRaw, "es");
    const esDefense = addStrength(esDefenseRaw, "es");
    const ppOffense = addStrength(ppOffenseRaw, "pp");
    const pkDefense = addStrength(pkDefenseRaw, "pk");

    // Concatenate the arrays
    const allOffense = [...asOffense, ...esOffense, ...ppOffense];
    const allDefense = [...asDefense, ...esDefense, ...pkDefense];

    console.log(
      `[fetchPercentilePlayerData] Concatenated ${allOffense.length} relevant offense rows and ${allDefense.length} relevant defense rows for season ${seasonId}`
    );

    // Return matches the updated function signature - no casting needed
    return {
      offense: allOffense,
      defense: allDefense
    };
  } catch (error) {
    console.error(
      `[fetchPercentilePlayerData] Error fetching percentile data for season ${seasonId}:`,
      error
    );
    throw error;
  }
}
