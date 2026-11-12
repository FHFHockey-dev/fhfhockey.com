// web/utils/fetchWigoPlayerStats.ts

import { TableAggregateData, PlayerRawStats } from "components/WiGO/types";
import {
  WIGO_STAT_ORDER,
  getWigoStatMetadata,
  normalizeWigoAggregateValue,
  shouldAttachGpMetadata
} from "components/WiGO/statMetadata";
import supabase from "lib/supabase";
import { Database } from "lib/supabase/database-generated.types";
import { fetchAllSupabasePages } from "lib/supabase/pagination";

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
  game_id: number;
  date: string;
  points: number | null;
  shots: number | null;
  hits: number | null;
  blocked_shots: number | null;
  // Seconds; PP share as a 0-1 fraction. One game-log read serves every chart
  // and the dashboard's latest-team check (S5).
  toi_per_game: number | null;
  pp_toi_per_game: number | null;
  pp_toi_pct_per_game: number | null;
  team_abbrev: string | null;
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
  | {
      // PP count per 60 PP minutes from the per-game WGO row, matching the aggregate writer's
      // calculatePer60FromSeconds(wgo_pp*, wgo_pp_toi).
      calculation: "PP_PER_60";
      table: "wgo_skater_stats";
      countColumn: "pp_goals" | "pp_assists" | "pp_points";
    }
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
  // nst_gamelog_as_rates has no PP columns; these per-PP-minute rates come from the WGO game row.
  "PPG/60": { calculation: "PP_PER_60", table: "wgo_skater_stats", countColumn: "pp_goals" },
  "PPA/60": { calculation: "PP_PER_60", table: "wgo_skater_stats", countColumn: "pp_assists" },
  "PPP/60": { calculation: "PP_PER_60", table: "wgo_skater_stats", countColumn: "pp_points" },
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
  // The dashboard season. The totals fallback may only fill STD from this same season.
  stdSeasonId?: number | null;
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
  totalsData,
  stdSeasonId = null
}: BuildPlayerAggregatedStatsInput): TableAggregateData[] {
  // Without a season match the latest totals row may be last season's, which must never pose as STD.
  const seasonTotals =
    totalsData && stdSeasonId != null && String(totalsData.season) === String(stdSeasonId)
      ? totalsData
      : null;
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
    const l5Value = getAggregateValue(recentData, `l5_${baseColName}`);
    const l10Value = getAggregateValue(recentData, `l10_${baseColName}`);
    const l20Value = getAggregateValue(recentData, `l20_${baseColName}`);

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

      if (rStd !== undefined) stdValue = rStd;
      if (rLy !== undefined) lyValue = rLy;
      if (rCa !== undefined) caValue = rCa;
      if (r3ya !== undefined) ya3Value = r3ya;
      // Recent rates and their coverage come from the same wigo_recent snapshot.
    }

    // A published per-60 rate is authoritative: a null stays null. The reader never
    // rebuilds it from counts and another source's minutes (A2, rule 23).

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
      seasonTotals
    ) {
      const totalsMap: Record<string, number | null | undefined> = {
        Goals: seasonTotals.goals,
        Assists: seasonTotals.assists,
        Points: seasonTotals.points,
        SOG: seasonTotals.shots,
        HIT: seasonTotals.hits,
        BLK: seasonTotals.blocked_shots,
        PIM: seasonTotals.penalty_minutes,
        PPP: seasonTotals.pp_points
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

    if (metadata.isPerSixty) {
      const denominator = /^pp[gap]_per_60$/.test(baseColName ?? "") ? "pptoi" : "atoi";
      for (const [column, prefix] of [["L5", "l5"], ["L10", "l10"], ["L20", "l20"]] as const) {
        const toi = getAggregateValue(recentData, `${prefix}_${denominator}`);
        const gp = getAggregateValue(recentData, `${prefix}_gp`);
        const sourceRate = getAggregateValue(recentData, `${prefix}_${baseColName}`);
        if (sourceRate == null || !Number.isFinite(sourceRate) || toi == null || !Number.isFinite(toi) || toi <= 0 || gp == null || !Number.isFinite(gp) || gp <= 0) {
          normalizedValues[column] = null;
        }
      }
    }

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

export interface WigoAggregateFreshness {
  careerUpdatedAt: string | null;
  recentUpdatedAt: string | null;
  stdGp: number | null;
  totalsGp: number | null;
  /**
   * STD GP disagrees with this season's totals GP: the writer has not reached
   * the player since recent games, or the row is still last season's (B-01:
   * Bedard STD GP 69 against 8 played).
   */
  stdStale: boolean;
}

export interface WigoAggregatedStatsResult {
  rows: TableAggregateData[];
  freshness: WigoAggregateFreshness;
}

export function getWigoAggregateFreshness({
  careerData,
  recentData,
  totalsData,
  stdSeasonId = null
}: Pick<BuildPlayerAggregatedStatsInput, "careerData" | "recentData" | "stdSeasonId"> & {
  totalsData: { season?: string | null; games_played?: number | null } | null;
}): WigoAggregateFreshness {
  const stdGp = getAggregateValue(careerData, "std_gp");
  const totalsGp =
    totalsData &&
    stdSeasonId != null &&
    String(totalsData.season) === String(stdSeasonId) &&
    typeof totalsData.games_played === "number"
      ? totalsData.games_played
      : null;
  return {
    careerUpdatedAt: careerData?.last_updated ?? null,
    recentUpdatedAt: recentData?.last_updated ?? null,
    stdGp,
    totalsGp,
    stdStale: totalsGp != null && totalsGp > 0 && stdGp !== totalsGp
  };
}

/**
 * True when an NHL game id (YYYYTTNNNN) is a regular-season game (type 02) of the
 * season (YYYYYYYY). The one game predicate every WiGO game-log reader uses (D5).
 */
export const isRegularSeasonGameOf = (gameId: unknown, seasonId: number): boolean =>
  typeof gameId === "number" &&
  Number.isSafeInteger(gameId) &&
  Math.floor(gameId / 10000) === Math.floor(seasonId / 10000) * 100 + 2;

/**
 * Reconciles a stat's rows to the player's regular-season game ledger: one point per
 * ledger game, in date order. WGO rows match by game id, NST rows (no game id) by
 * date. A ledger game with no row, or with conflicting rows, is a gap (null), so an
 * absent NST row still holds its game's slot; rows outside the ledger are dropped.
 */
function reconcileToLedger(
  ledger: SkaterGameLogConsistencyData[],
  rows: GameLogDataPoint[],
  keyOf: (row: GameLogDataPoint & { game_id?: number | null }) => string | number | null | undefined,
  ledgerKey: (game: SkaterGameLogConsistencyData) => string | number
): GameLogDataPoint[] {
  const byKey = new Map<string | number, number | null>();
  const conflicted = new Set<string | number>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key == null) continue;
    if (byKey.has(key) && byKey.get(key) !== row.value) conflicted.add(key);
    byKey.set(key, row.value);
  }
  return [...ledger]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.game_id - b.game_id))
    .map((game) => {
      const key = ledgerKey(game);
      return { date: game.date, value: conflicted.has(key) ? null : byKey.get(key) ?? null };
    });
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

  // The regular-season ledger, read alongside the stat rows (D5).
  const ledgerPromise = fetchPlayerGameLogConsistencyData(playerId, String(seasonId));
  const toLedger = async (rows: Array<GameLogDataPoint & { game_id?: number | null }>, byGameId: boolean) =>
    byGameId
      ? reconcileToLedger(await ledgerPromise, rows, (row) => row.game_id, (game) => game.game_id)
      : reconcileToLedger(await ledgerPromise, rows, (row) => row.date, (game) => game.date);
  // Without a handler a ledger failure surfacing before the stat read would be unhandled.
  ledgerPromise.catch(() => undefined);

  try {
    // **** Handle Special Calculation for PTS1% ****
    if ("calculation" in mapping && mapping.calculation === "PTS1%") {
      const { table, requiredColumns } = mapping;
      // **** Determine correct date column for the calculation source table ****
      const dateColumn = table === "wgo_skater_stats" ? "date" : "date_scraped"; // Use date_scraped for nst_*


      const selectString = `game_id, ${dateColumn}, ${requiredColumns.join(", ")}`;
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

          // A pointless game has no share, as in the aggregates, so it is a
          // gap rather than 0 and the game mean stays comparable (A-06).
          if (
            typeof goals === "number" &&
            typeof primaryAssists === "number" &&
            typeof points === "number" &&
            points > 0
          ) {
            // Aggregates show PTS1% on a 0–100 scale; the chart's reference lines use the same scale.
            value = ((goals + primaryAssists) / points) * 100;
          }

          return {
            game_id: item.game_id,
            date: item[dateColumn], // Use the fetched date column
            value: value
          };
        }) || [];
      return toLedger(calculatedData, true);
    } else if ("calculation" in mapping && mapping.calculation === "PTS1/60") {
      const { table, requiredColumns } = mapping; // table is nst_gamelog_as_rates
      const dateColumn = "date_scraped"; // nst tables use date_scraped
      const seasonColumn = "season"; // nst tables use season

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
      return toLedger(calculatedData, false);
    } else if ("calculation" in mapping && mapping.calculation === "PP_PER_60") {
      const { countColumn } = mapping;
      const { data, error } = await supabase
        .from("wgo_skater_stats")
        .select(`game_id, date, ${countColumn}, pp_toi_per_game`)
        .eq("player_id", playerId)
        .eq("season_id", seasonId)
        .order("date", { ascending: true });
      if (error) throw error;

      return toLedger((data ?? []).map((item: any) => {
        const count = item[countColumn];
        const ppSeconds = item.pp_toi_per_game;
        return {
          game_id: item.game_id,
          date: item.date,
          // No PP time means no PP rate for that game, not a zero rate.
          value:
            typeof count === "number" && typeof ppSeconds === "number" && ppSeconds > 0
              ? (count * 3600) / ppSeconds
              : null
        };
      }), true);
    } else if ("column" in mapping) {
      // **** Handle Standard Column Fetching ****
      const { table, column: statColumn, unit } = mapping;
      // **** Determine correct date AND season column based on table ****
      const dateColumn = table === "wgo_skater_stats" ? "date" : "date_scraped";
      const seasonColumn =
        table === "wgo_skater_stats" ? "season_id" : "season";


      const { data, error } =
        table === "wgo_skater_stats"
          ? await supabase
              .from("wgo_skater_stats")
              .select(`game_id, date, ${statColumn}`)
              .eq("player_id", playerId)
              .eq("season_id", seasonId)
              .order("date", { ascending: true })
          : await supabase
              .from(table)
              .select(`date_scraped, ${statColumn}`)
              .eq("player_id", playerId)
              .eq("season", seasonId)
              .order("date_scraped", { ascending: true });

      if (error) throw error;

      const gameLogData =
        data?.map((item: any) => {
          let value = item[statColumn];

          // WGO stores S% and PP% as 0–1 fractions while the matrix and reference lines use 0–100.
          // NST percentage columns are left as stored (their scale is unverified).
          if (table === "wgo_skater_stats" && unit === "percent_decimal") {
            value = normalizeWigoAggregateValue(statLabel, value);
          }

          return {
            game_id: item.game_id,
            date: item[dateColumn], // Use the fetched date column
            value: typeof value === "number" ? value : null
          };
        }) || [];
      return toLedger(gameLogData, table === "wgo_skater_stats");
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
    throw err;
  }
}

/**
 * Fetches pre-aggregated player stats from wigo_career and wigo_recent
 * and transforms them into the TableAggregateData format for display.
 */
type WigoAggregateTotals =
  | (Partial<{
      goals: number | null;
      assists: number | null;
      points: number | null;
      shots: number | null;
      hits: number | null;
      blocked_shots: number | null;
      penalty_minutes: number | null;
      pp_points: number | null;
      games_played: number | null;
    }> & { season?: string | null })
  | null;

// Exactly the columns the table reads: each stat's base key per period, plus
// the as-of date (S9). Only wigo_career's two seasons_used counts are left out:
// the table uses almost every column, so this is about tightness, not bytes.
const aggregateColumns = (prefixes: readonly string[]) =>
  [
    "player_id",
    "last_updated",
    ...prefixes.flatMap((prefix) =>
      WIGO_STAT_ORDER.map(
        (label) => `${prefix}_${getWigoStatMetadata(label)!.baseKey}`
      )
    )
  ].join(",");
const CAREER_COLUMNS = aggregateColumns(["std", "ly", "ya3", "ca"]);
const RECENT_COLUMNS = aggregateColumns(["l5", "l10", "l20"]);

export interface WigoAggregateSources {
  careerData: WigoCareerRow | null;
  recentData: WigoRecentRow | null;
}

/**
 * The player's aggregate rows. They do not depend on the season, so the read
 * starts without waiting for /api/v1/season; the season check happens when
 * the rows are built (S4). This season's totals row comes from the shared
 * per-game totals query instead of a second totals read (S5).
 */
export async function fetchPlayerAggregateSources(
  playerId: number
): Promise<WigoAggregateSources> {

  // wigo_career and wigo_recent are the aggregate sources. The legacy wigo_rates table has no writer
  // (0 rows) and is not read: if anything refilled it, it would silently override these per-60 values.
  const [careerRes, recentRes] = await Promise.all([
    supabase
      .from("wigo_career")
      .select(CAREER_COLUMNS)
      .eq("player_id", playerId)
      .maybeSingle(),
    supabase
      .from("wigo_recent")
      .select(RECENT_COLUMNS)
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
  return {
    careerData: careerRes.data as WigoCareerRow | null,
    recentData: recentRes.data as WigoRecentRow | null
  };
}

/**
 * Table rows and freshness for one season, from the season-free sources and
 * that season's totals row (null when absent or unavailable: totals only feed
 * the STD count fallback and the stale check).
 */
export function buildWigoAggregatedStatsResult(
  { careerData, recentData }: WigoAggregateSources,
  totalsData: WigoAggregateTotals,
  stdSeasonId: number | null
): WigoAggregatedStatsResult {
  const freshness = getWigoAggregateFreshness({
    careerData,
    recentData,
    totalsData,
    stdSeasonId
  });

  if (!careerData && !recentData) {
    return { rows: [], freshness };
  }

  return {
    rows: buildPlayerAggregatedStats({
      careerData,
      recentData,
      ratesData: null,
      // A stale STD row is another sample; filling its blanks from this
      // season's totals would mix the two (U9: GP 69 beside 8-game counts).
      totalsData: freshness.stdStale ? null : totalsData,
      stdSeasonId
    }),
    freshness
  };
}

export async function fetchPlayerAggregatedStats(
  playerId: number,
  stdSeasonId: number | null = null
): Promise<WigoAggregatedStatsResult> {
  const [sources, totalsData] = await Promise.all([
    fetchPlayerAggregateSources(playerId),
    fetchPlayerPerGameTotals(playerId, stdSeasonId).catch(() => null)
  ]);
  return buildWigoAggregatedStatsResult(sources, totalsData, stdSeasonId);
}

// A statement timeout (57014) is the slow view itself, not a blip: retrying it
// only repeats the same 3 s wait (D-01: 48 failed reads per page view).
export const isStatementTimeout = (error: unknown): boolean =>
  !!error &&
  typeof error === "object" &&
  (error as { code?: unknown }).code === "57014";

export async function fetchPaginatedData<T>(
  tableName: keyof Database["public"]["Tables"],
  selectColumns: string,
  seasonFilter?: { column: string; value: number | string }
): Promise<T[]> {
  return fetchAllSupabasePages<T>(
    ({ from, to }) => {
      let query = supabase.from(tableName).select(selectColumns);

      if (seasonFilter) {
        query = query.eq(seasonFilter.column, seasonFilter.value);
      }

      return query
        .order("player_id", { ascending: true })
        .range(from, to) as any;
    },
    {
      pageSize: 500,
      retry: {
        attempts: 3,
        delayMs: (attempt) => Math.pow(2, attempt) * 1000,
        shouldRetry: (error) => !isStatementTimeout(error)
      }
    }
  );
}

// New function to fetch per-game relevant totals
export const fetchPlayerPerGameTotals = async (
  playerId: number,
  seasonId?: number | null
): Promise<SkaterTotalsData | null> => {
  if (!playerId) return null;

  try {
    let query = supabase
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
      .limit(1);

    if (typeof seasonId === "number") {
      query = query.eq("season", String(seasonId));
    }

    const { data, error } = await query.maybeSingle();

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
    // NHL totals store shooting percentage as a fraction, including 0 and 1.
    if (processedData && processedData.shooting_percentage !== null) {
      processedData.shooting_percentage *= 100;
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
        game_id,
        date,
        points,
        shots,
        hits,
        blocked_shots,
        toi_per_game,
        pp_toi_per_game,
        pp_toi_pct_per_game,
        team_abbrev
      ` // Select fields needed for calculation
      )
      .eq("player_id", playerId)
      .eq("season_id", seasonIdNumber) // Filter by the specific season ID (numeric)
      .eq("games_played", 1)
      .order("date", { ascending: true }); // Order chronologically (optional for this calc)

    if (error) {
      console.error(
        `Error fetching game log Consistency Data for player ${playerId}, season ${season}:`,
        error
      );
      throw error;
    }
    const games = new Map<number, SkaterGameLogConsistencyData>();
    for (const game of (data ?? []) as SkaterGameLogConsistencyData[]) {
      if (!Number.isSafeInteger(game.game_id) || game.game_id <= 0) {
        throw new Error("Game log contains a missing or invalid game identity.");
      }
      const prior = games.get(game.game_id);
      if (prior && (["date", "points", "shots", "hits", "blocked_shots"] as const)
        .some(field => prior[field] !== game[field])) {
        throw new Error("Game log contains conflicting rows for the same game.");
      }
      games.set(game.game_id, game);
    }
    // One game predicate (D5): the game id's season and type, not the row's season
    // label, decide membership, so a playoff or mislabelled-season row never joins
    // the regular-season calendar.
    return [...games.values()].filter((game) =>
      isRegularSeasonGameOf(game.game_id, seasonIdNumber)
    );
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
