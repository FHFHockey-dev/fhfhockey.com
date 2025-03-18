// pages/api/v1/db/update-nst-gamelog.ts

import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import * as cheerio from "cheerio";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey: string | undefined = process.env.SUPABASE_SERVICE_ROLE_KEY;
// CHANGED SUPABASE THING

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Public Key is missing.");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Delay interval between requests in milliseconds
const REQUEST_INTERVAL_MS = 30000; // 30 seconds

const BASE_URL = "https://www.naturalstattrick.com/playerteams.php";

// Player name mapping
/**
 * A mapping of player names to their full names.
 *
 * This record is used to map abbreviated or alternative player names
 * to their official full names as recognized in the system.
 *
 * @type {Record<string, { fullName: string }>}
 *
 * @example
 * // Accessing the full name of a player
 * const fullName = playerNameMapping["Matthew Benning"].fullName;
 * console.log(fullName); // Output: "Matt Benning"
 * // Format:
 * // { Natural Stat Trick Name: { fullName: NHL API Full Name } }
 *
 * @property {string} key - The abbreviated or alternative name of the player.
 * @property {Object} value - An object containing the full name of the player.
 * @property {string} value.fullName - The full name of the player.
 */
const playerNameMapping: Record<string, { fullName: string }> = {
  "Matthew Benning": { fullName: "Matt Benning" },
  "Alex Kerfoot": { fullName: "Alexander Kerfoot" },
  "Zach Aston-Reese": { fullName: "Zachary Aston-Reese" },
  "Oskar Back": { fullName: "Oskar Bäck" },
  "Cameron Atkinson": { fullName: "Cam Atkinson" },
  "Nicholas Paul": { fullName: "Nick Paul" },
  "Janis Moser": { fullName: "J.J. Moser" },
  "Nathan Légaré": { fullName: "Nathan Legare" },
  "Mat?j Blümel": { fullName: "Matěj Blümel" },
  "Alex Petrovic": { fullName: "Alexander Petrovic" }
};

const troublesomePlayers: string[] = [];

/**
 * Normalizes a given name string by performing the following transformations:
 * 1. Converts the string to lowercase.
 * 2. Removes spaces, hyphens, and apostrophes.
 * 3. Normalizes the string to Unicode Normalization Form D (NFD).
 * 4. Removes diacritical marks (accents).
 *
 * @param name - The name string to be normalized.
 * @returns The normalized name string.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\-']/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates an array of date strings in the format 'YYYY-MM-DD' for each date between the given start and end dates, inclusive.
 *
 * @param start - The start date.
 * @param end - The end date.
 * @returns An array of date strings in the format 'YYYY-MM-DD'.
 */
function getDatesBetween(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, "0");
    const dd = String(current.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Maps a given header string to its corresponding column name in the database.
 *
 * @param header - The header string to be mapped.
 * @returns The corresponding column name as a string, or null if the header is "Player" or not found in the mapping.
 */
function mapHeaderToColumn(header: string): string | null {
  const headerMap: Record<string, string> = {
    // All your mappings here...
    GP: "gp",
    TOI: "toi",
    "TOI/GP": "toi_per_gp",
    Goals: "goals",
    "Goals/60": "goals_per_60",
    "Total Assists": "total_assists",
    "Total Assists/60": "total_assists_per_60",
    "First Assists": "first_assists",
    "First Assists/60": "first_assists_per_60",
    "Second Assists": "second_assists",
    "Second Assists/60": "second_assists_per_60",
    "Total Points": "total_points",
    "Total Points/60": "total_points_per_60",
    IPP: "ipp",
    Shots: "shots",
    "Shots/60": "shots_per_60",
    "SH%": "sh_percentage",
    ixG: "ixg",
    "ixG/60": "ixg_per_60",
    iCF: "icf",
    "iCF/60": "icf_per_60",
    iFF: "iff",
    "iFF/60": "iff_per_60",
    iSCF: "iscfs",
    "iSCF/60": "iscfs_per_60",
    iHDCF: "hdcf",
    "iHDCF/60": "hdcf_per_60",
    HDCF: "hdcf",
    "HDCF/60": "hdcf_per_60",
    "Rush Attempts": "rush_attempts",
    "Rush Attempts/60": "rush_attempts_per_60",
    "Rebounds Created": "rebounds_created",
    "Rebounds Created/60": "rebounds_created_per_60",
    PIM: "pim",
    "PIM/60": "pim_per_60",
    "Total Penalties": "total_penalties",
    "Total Penalties/60": "total_penalties_per_60",
    Minor: "minor_penalties",
    "Minor/60": "minor_penalties_per_60",
    Major: "major_penalties",
    "Major/60": "major_penalties_per_60",
    Misconduct: "misconduct_penalties",
    "Misconduct/60": "misconduct_penalties_per_60",
    "Penalties Drawn": "penalties_drawn",
    "Penalties Drawn/60": "penalties_drawn_per_60",
    Giveaways: "giveaways",
    "Giveaways/60": "giveaways_per_60",
    Takeaways: "takeaways",
    "Takeaways/60": "takeaways_per_60",
    Hits: "hits",
    "Hits/60": "hits_per_60",
    "Hits Taken": "hits_taken",
    "Hits Taken/60": "hits_taken_per_60",
    "Shots Blocked": "shots_blocked",
    "Shots Blocked/60": "shots_blocked_per_60",
    "Faceoffs Won": "faceoffs_won",
    "Faceoffs Won/60": "faceoffs_won_per_60",
    "Faceoffs Lost": "faceoffs_lost",
    "Faceoffs Lost/60": "faceoffs_lost_per_60",
    "Faceoffs %": "faceoffs_percentage",
    CF: "cf",
    "CF%": "cf_pct",
    CA: "ca",
    FF: "ff",
    "FF%": "ff_pct",
    FA: "fa",
    SF: "sf",
    "SF%": "sf_pct",
    SA: "sa",
    GF: "gf",
    "GF%": "gf_pct",
    GA: "ga",
    xGF: "xgf",
    "xGF%": "xgf_pct",
    xGA: "xga",
    "xGA%": "xga_pct",
    SCF: "scf",
    SCA: "sca",
    "SCF%": "scf_pct",
    HDCA: "hdca",
    "HDCF%": "hdcf_pct",
    HDGF: "hdgf",
    HDGA: "hdga",
    "HDGF%": "hdgf_pct",
    MDCF: "mdcf",
    MDCA: "mdca",
    "MDCF%": "mdcf_pct",
    MDGF: "mdgf",
    MDGA: "mdga",
    "MDGF%": "mdgf_pct",
    LDCF: "ldcf",
    LDCA: "ldca",
    "LDCF%": "ldcf_pct",
    LDGF: "ldgf",
    LDGA: "ldga",
    "LDGF%": "ldgf_pct",
    "On-Ice SH%": "on_ice_sh_pct",
    "On-Ice SV%": "on_ice_sv_pct",
    PDO: "pdo",
    "Off. Zone Starts": "off_zone_starts",
    "Neu. Zone Starts": "neu_zone_starts",
    "Def. Zone Starts": "def_zone_starts",
    "Off. Zone Start %": "off_zone_start_pct",
    "Off. Zone Faceoffs": "off_zone_faceoffs",
    "Neu. Zone Faceoffs": "neu_zone_faceoffs",
    "Def. Zone Faceoffs": "def_zone_faceoffs",
    "Off. Zone Faceoff %": "off_zone_faceoff_pct",
    "CF/60": "cf_per_60",
    "CA/60": "ca_per_60",
    "FF/60": "ff_per_60",
    "FA/60": "fa_per_60",
    "SF/60": "sf_per_60",
    "SA/60": "sa_per_60",
    "GF/60": "gf_per_60",
    "GA/60": "ga_per_60",
    "xGF/60": "xgf_per_60",
    "xGA/60": "xga_per_60",
    "SCF/60": "scf_per_60",
    "SCA/60": "sca_per_60",
    "HDCA/60": "hdca_per_60",
    "HDGF/60": "hdgf_per_60",
    "HDGA/60": "hdga_per_60",
    "MDCF/60": "mdcf_per_60",
    "MDCA/60": "mdca_per_60",
    "MDGF/60": "mdgf_per_60",
    "MDGA/60": "mdga_per_60",
    "LDCF/60": "ldcf_per_60",
    "LDCA/60": "ldca_per_60",
    "LDGF/60": "ldgf_per_60",
    "LDGA/60": "ldga_per_60",
    "On-Ice SH%/60": "on_ice_sh_pct_per_60",
    "On-Ice SV%/60": "on_ice_sv_pct_per_60",
    "PDO/60": "pdo_per_60",
    "Off. Zone Starts/60": "off_zone_starts_per_60",
    "Neu. Zone Starts/60": "neu_zone_starts_per_60",
    "Def. Zone Starts/60": "def_zone_starts_per_60",
    "Off. Zone Start %/60": "off_zone_start_pct_per_60",
    "Off. Zone Faceoffs/60": "off_zone_faceoffs_per_60",
    "Neu. Zone Faceoffs/60": "neu_zone_faceoffs_per_60",
    "Def. Zone Faceoffs/60": "def_zone_faceoffs_per_60"
  };

  if (header === "Player") return null;

  return headerMap[header] || null;
}

/**
 * Retrieves the latest date from multiple tables in Supabase.
 *
 * This function queries a list of predefined table names to find the most recent
 * `date_scraped` value across all tables. It returns the latest date found or `null`
 * if no dates are found or if there are errors in all queries.
 *
 * @returns {Promise<string | null>} A promise that resolves to the latest date as a string,
 * or `null` if no dates are found.
 */
async function getLatestDateSupabase(): Promise<string | null> {
  const tableNames = [
    "nst_10gp_gamelog_as_counts",
    "nst_10gp_gamelog_as_rates",
    "nst_10gp_gamelog_pp_counts",
    "nst_10gp_gamelog_pp_rates",
    "nst_10gp_gamelog_as_counts_oi",
    "nst_10gp_gamelog_as_rates_oi",
    "nst_10gp_gamelog_pp_counts_oi",
    "nst_10gp_gamelog_pp_rates_oi",
    "nst_10gp_gamelog_es_counts",
    "nst_10gp_gamelog_es_rates",
    "nst_10gp_gamelog_pk_counts",
    "nst_10gp_gamelog_pk_rates",
    "nst_10gp_gamelog_es_counts_oi",
    "nst_10gp_gamelog_es_rates_oi",
    "nst_10gp_gamelog_pk_counts_oi",
    "nst_10gp_gamelog_pk_rates_oi"
  ];
  let latestDate: string | null = null;

  for (const table of tableNames) {
    const { data, error } = await supabase
      .from(table)
      .select("date_scraped")
      .order("date_scraped", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      continue;
    }

    if (data && data.date_scraped) {
      if (!latestDate || new Date(data.date_scraped) > new Date(latestDate)) {
        latestDate = data.date_scraped;
      }
    }
  }

  return latestDate;
}

// Print main info block after each URL processed
function printInfoBlock(params: {
  date: string;
  url: string;
  datasetType: string;
  tableName: string;
  dateUrlCount: { current: number; total: number };
  totalUrlCount: { current: number; total: number };
  rowsProcessed: number;
  rowsPrepared: number;
  rowsUpserted: number;
}) {
  const {
    date,
    url,
    datasetType,
    tableName,
    dateUrlCount,
    totalUrlCount,
    rowsProcessed,
    rowsPrepared,
    rowsUpserted
  } = params;

  console.log(`
|==========================|
Date: ${date}

URL: ${url}

Iteration: ${datasetType}
Destination: ${tableName}

Date URL Count: ${dateUrlCount.current}/${dateUrlCount.total}
Total URL Count: ${totalUrlCount.current}/${totalUrlCount.total}

Rows Processed: ${rowsProcessed}
Rows Prepared: ${rowsPrepared}
Rows Upserted: ${rowsUpserted}

|==========================|
`);
}

// Print delay countdown bar (21s)
async function printDelayCountdown() {
  const total = 30;
  const interval = 1; // 1 second interval
  for (let elapsed = 0; elapsed < total; elapsed++) {
    const progress = (elapsed / total) * 100;
    const filled = Math.floor((elapsed / total) * 20);
    const bar = "|" + "=".repeat(filled) + "-".repeat(20 - filled) + "|";

    process.stdout.write(`\r${bar}  (${elapsed + 1}s/${total}s) `);
    await delay(interval * 1000);
  }
  process.stdout.write("\n");
}

// Print total progress bar
function printTotalProgress(current: number, total: number) {
  const percentage = (current / total) * 100;
  const filled = Math.floor((percentage / 100) * 20);
  const bar = "|" + "=".repeat(filled) + "-".repeat(20 - filled) + "|";
  console.log(`Total Progress: ${percentage.toFixed(2)}% Complete`);
  console.log(`${bar}  (${current}/${total} URLs)`);
}

// Determine table name from datasetType
/**
 * Retrieves the corresponding table name for a given dataset type.
 *
 * The function uses a predefined mapping to return the appropriate table name
 * based on the provided dataset type. If the dataset type does not match any
 * of the predefined keys, the function returns "unknown_table".
 *
 * @param datasetType - The type of dataset for which the table name is required.
 * @returns The corresponding table name as a string.
 *
 * @example
 * ```typescript
 * const tableName = getTableName("evenStrengthCounts");
 * console.log(tableName); // Outputs: "nst_gamelog_es_counts"
 * ```
 */
function getTableName(datasetType: string): string {
  const mapping: Record<string, string> = {
    allStrengthsCounts: "nst_10gp_gamelog_as_counts",
    allStrengthsRates: "nst_10gp_gamelog_as_rates",
    powerPlayCounts: "nst_10gp_gamelog_pp_counts",
    powerPlayRates: "nst_10gp_gamelog_pp_rates",
    allStrengthsCountsOi: "nst_10gp_gamelog_as_counts_oi",
    allStrengthsRatesOi: "nst_10gp_gamelog_as_rates_oi",
    powerPlayCountsOi: "nst_10gp_gamelog_pp_counts_oi",
    powerPlayRatesOi: "nst_10gp_gamelog_pp_rates_oi",
    evenStrengthCounts: "nst_10gp_gamelog_es_counts",
    evenStrengthRates: "nst_10gp_gamelog_es_rates",
    penaltyKillCounts: "nst_10gp_gamelog_pk_counts",
    penaltyKillRates: "nst_10gp_gamelog_pk_rates",
    evenStrengthCountsOi: "nst_10gp_gamelog_es_counts_oi",
    evenStrengthRatesOi: "nst_10gp_gamelog_es_rates_oi",
    penaltyKillCountsOi: "nst_10gp_gamelog_pk_counts_oi",
    penaltyKillRatesOi: "nst_10gp_gamelog_pk_rates_oi"
  };

  const tableName = mapping[datasetType] || "unknown_table";

  if (tableName === "unknown_table") {
    console.warn(
      `Warning: datasetType "${datasetType}" is not mapped to a valid table.`
    );
  }

  return tableName;
}

async function fetchAndParseData(
  url: string,
  datasetType: string,
  date: string,
  seasonId: string,
  retries: number = 3
): Promise<any[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Fetching data from URL: ${url} (Attempt ${attempt})`);
      const response = await axios.get(url);

      if (!response.data) {
        console.warn(`No data received from URL: ${url}`);
        return [];
      }

      const $ = cheerio.load(response.data);
      const table = $("table").first();

      if (table.length === 0) {
        console.warn(`No table found in the response from URL: ${url}`);
        return [];
      }

      const headers: string[] = [];
      table.find("thead tr th").each((_, th) => {
        headers.push($(th).text().trim());
      });

      const mappedHeaders = headers.map(mapHeaderToColumn);

      const dataRowsCollected: any[] = [];
      table.find("tbody tr").each((_, tr) => {
        const rowData: any = {};
        let playerFullName: string | null = null;
        let playerPosition: string | null = null;
        let playerTeam: string | null = null;

        $(tr)
          .find("td")
          .each((i, td) => {
            const column = mappedHeaders[i];
            if (column === null) {
              const originalHeader = headers[i];
              if (originalHeader === "Player") {
                playerFullName = $(td).text().trim();
              } else if (originalHeader === "Position") {
                playerPosition = $(td).text().trim();
              } else if (originalHeader === "Team") {
                playerTeam = $(td).text().trim();
              }
              return;
            }

            let cellText: string | null = $(td).text().trim();
            if (cellText === "-" || cellText === "\\-") {
              cellText = null;
            }

            if (cellText !== null) {
              const num = Number(cellText.replace(/[^0-9.-]+/g, ""));
              rowData[column] = isNaN(num) ? cellText : num;
            } else {
              rowData[column] = null;
            }
          });

        if (
          playerFullName &&
          playerPosition &&
          playerTeam &&
          Object.keys(rowData).length > 0
        ) {
          rowData["player_full_name"] = playerFullName;
          rowData["player_position"] = playerPosition;
          rowData["player_team"] = playerTeam;
          rowData["date_scraped"] = date;
          rowData["season"] = parseInt(seasonId, 10); // Ensure season is an integer
          dataRowsCollected.push(rowData);
        } else {
          console.warn(`Incomplete data row skipped for URL: ${url}`);
        }
      });

      console.log(
        `Parsed ${dataRowsCollected.length} raw data rows for datasetType "${datasetType}".`
      );

      // Assign player_id
      const dataRowsWithPlayerIds: any[] = [];
      for (const row of dataRowsCollected) {
        const playerFullName = row["player_full_name"];
        const playerPosition = row["player_position"];
        const playerId = await getPlayerIdByName(
          playerFullName,
          playerPosition
        );
        if (!playerId) {
          console.warn(
            `Player ID not found for ${playerFullName} (${playerPosition})`
          );
          continue;
        }

        row["player_id"] = playerId;
        delete row["player_full_name"];
        delete row["player_position"];
        delete row["player_team"];
        dataRowsWithPlayerIds.push(row);
      }

      console.log(
        `Final data rows with player IDs: ${dataRowsWithPlayerIds.length} for datasetType "${datasetType}".`
      );

      if (dataRowsWithPlayerIds.length === 0) {
        console.warn(`No valid data rows found for URL: ${url}`);
      }

      return dataRowsWithPlayerIds;
    } catch (error: any) {
      console.error(
        `Attempt ${attempt} - Error fetching data from ${url}:`,
        error.message
      );
      if (attempt === retries) {
        console.error(
          `Failed to fetch data from ${url} after ${retries} attempts.`
        );
        return [];
      }
      // Wait before retrying
      await delay(5000); // Wait 5 seconds before next attempt
    }
  }
  return [];
}

async function getPlayerIdByName(
  fullName: string,
  position: string
): Promise<number | null> {
  const mappedName = playerNameMapping[fullName]
    ? playerNameMapping[fullName].fullName
    : fullName;

  const normalizedFullName = normalizeName(mappedName);
  const normalizedPosition = position.toUpperCase();

  const requiresPositionCheck = ["Elias Pettersson", "Sebastian Aho"].includes(
    mappedName
  );

  let query = supabase
    .from("players")
    .select("id")
    .ilike("fullName", `%${mappedName}%`);

  if (requiresPositionCheck) {
    query = query.eq("position", normalizedPosition);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) return null;
  if (!data) {
    troublesomePlayers.push(`${fullName} (${position})`);
    return null;
  }

  return data.id;
}

async function upsertData(datasetType: string, dataRows: any[]) {
  if (dataRows.length === 0) {
    console.warn(`No data rows to upsert for datasetType "${datasetType}".`);
    return;
  }

  const tableName = getTableName(datasetType);

  if (tableName === "unknown_table") {
    console.warn(
      `Skipping upsert for unknown table with datasetType "${datasetType}".`
    );
    return;
  }

  console.log(`Upserting ${dataRows.length} rows into table "${tableName}".`);

  const { error } = await supabase
    .from(tableName)
    .upsert(dataRows, { onConflict: "player_id,date_scraped" });

  if (error) {
    console.error(
      `Error upserting data into ${tableName}:`,
      error.details || error.message
    );
  } else {
    console.log(`Successfully upserted data into "${tableName}".`);
  }
}

async function checkDataExists(
  datasetType: string,
  date: string
): Promise<boolean> {
  const tableName = getTableName(datasetType);
  if (tableName === "unknown_table") {
    console.warn(
      `Skipping check for unknown table for datasetType "${datasetType}".`
    );
    return false;
  }

  const { data, error } = await supabase
    .from(tableName)
    .select("player_id")
    .eq("date_scraped", date)
    .limit(1);

  if (error) {
    console.error(
      `Error checking data existence in ${tableName}:`,
      error.message
    );
    return false;
  }

  const exists = data && data.length > 0;
  console.log(
    `Data existence check for table "${tableName}" on date "${date}": ${exists}`
  );
  return exists;
}

function constructUrlsForDate(
  date: string,
  seasonId: string
): Record<string, string> {
  const fromSeason = seasonId;
  const thruSeason = seasonId;
  const commonParams = `fromseason=${fromSeason}&thruseason=${thruSeason}&stype=2&pos=S&loc=B&toi=0&gpfilt=gpteam&fd=${date}&td=${date}&lines=single&draftteam=ALL`;

  // Define the strengths, stdoi, and rates
  const strengths = [
    "allStrengths",
    "evenStrength",
    "powerPlay",
    "penaltyKill"
  ];
  const stdoiOptions = ["std", "oi"];
  const rates = ["n", "y"];

  const urls: Record<string, string> = {};

  for (const strength of strengths) {
    for (const stdoi of stdoiOptions) {
      for (const rate of rates) {
        let datasetType: string;
        let tgp = "10";

        // Determine datasetType based on strength and stdoi
        if (stdoi === "std") {
          datasetType =
            strength === "allStrengths"
              ? "allStrengthsCounts"
              : strength === "evenStrength"
              ? "evenStrengthCounts"
              : strength === "powerPlay"
              ? "powerPlayCounts"
              : "penaltyKillCounts";
        } else {
          datasetType =
            strength === "allStrengths"
              ? "allStrengthsCountsOi"
              : strength === "evenStrength"
              ? "evenStrengthCountsOi"
              : strength === "powerPlay"
              ? "powerPlayCountsOi"
              : "penaltyKillCountsOi";
        }

        // Append rate information to datasetType only for rate 'y'
        if (rate === "y") {
          datasetType =
            strength === "allStrengths"
              ? "allStrengthsRates"
              : strength === "evenStrength"
              ? "evenStrengthRates"
              : strength === "powerPlay"
              ? "powerPlayRates"
              : "penaltyKillRates";

          if (stdoi === "oi") {
            datasetType += "Oi"; // e.g., "allStrengthsRatesOi"
          }
        }

        // Construct the URL
        const url = `${BASE_URL}?sit=${getSitParam(
          strength
        )}&score=all&stdoi=${stdoi}&rate=${rate}&team=ALL&${commonParams}&tgp=${tgp}`;

        urls[datasetType] = url;
      }
    }
  }

  return urls;
}

// Helper function to map strength to 'sit' parameter in URL
function getSitParam(strength: string): string {
  switch (strength) {
    case "allStrengths":
      return "all";
    case "evenStrength":
      return "ev";
    case "powerPlay":
      return "pp";
    case "penaltyKill":
      return "pk";
    default:
      return "all";
  }
}

async function processUrlsSequentially(
  urlsQueue: {
    datasetType: string;
    url: string;
    date: string;
    seasonId: string;
  }[]
) {
  const totalUrls = urlsQueue.length;
  let processedCount = 0;
  const dateProcessedCount: Record<string, number> = {};
  const dateGroups: Record<string, number> = {};

  // Count URLs per date
  for (const u of urlsQueue) {
    if (!dateGroups[u.date]) dateGroups[u.date] = 0;
    dateGroups[u.date]++;
  }

  const uniqueDates = Object.keys(dateGroups);
  const singleDayScrape = uniqueDates.length === 1; // Check if only one day's worth of data

  console.log(
    `Processing ${totalUrls} URLs across ${uniqueDates.length} date(s).`
  );
  if (singleDayScrape) {
    console.log(
      "Skipping 30-second delay since there is only one day's worth of data."
    );
  }

  for (let i = 0; i < urlsQueue.length; i++) {
    const { datasetType, url, date, seasonId } = urlsQueue[i];
    console.log(
      `\nProcessing URL ${i + 1}/${totalUrls}: ${datasetType} for date ${date}`
    );

    // Apply delay only if processing multiple days
    if (i > 0 && !singleDayScrape) {
      console.log(
        `Waiting ${REQUEST_INTERVAL_MS / 1000} seconds before next request...`
      );
      await new Promise((resolve) => setTimeout(resolve, REQUEST_INTERVAL_MS));
    }

    // Initialize counter for this date if it does not exist
    if (!dateProcessedCount[date]) dateProcessedCount[date] = 0;

    // Check if data already exists
    const dataExists = await checkDataExists(datasetType, date);
    let dataRows: any[] = [];
    let rowsUpserted = 0;

    if (!dataExists) {
      try {
        // Fetch and parse the data
        dataRows = await fetchAndParseData(url, datasetType, date, seasonId);
        if (dataRows.length > 0) {
          await upsertData(datasetType, dataRows);
          rowsUpserted = dataRows.length;
        }
      } catch (error) {
        console.error(`Error processing URL ${url}:`, error);
      }
    } else {
      console.log(
        `Data already exists for ${datasetType} on date ${date}. Skipping.`
      );
    }

    // Update counters
    processedCount++;
    dateProcessedCount[date]++;

    // Print info block
    printInfoBlock({
      date,
      url,
      datasetType,
      tableName: getTableName(datasetType),
      dateUrlCount: {
        current: dateProcessedCount[date],
        total: dateGroups[date]
      },
      totalUrlCount: {
        current: processedCount,
        total: totalUrls
      },
      rowsProcessed: dataExists ? 0 : dataRows.length,
      rowsPrepared: dataExists ? 0 : dataRows.length,
      rowsUpserted: dataExists ? 0 : rowsUpserted
    });

    // Print total progress
    printTotalProgress(processedCount, totalUrls);
  }
}

async function main() {
  try {
    const seasonInfo = await fetchCurrentSeason();
    const seasonId = seasonInfo.id.toString();
    const seasonStartDate = new Date(seasonInfo.startDate);
    const today = new Date();
    const scrapingEndDate =
      today < new Date(seasonInfo.endDate)
        ? today
        : new Date(seasonInfo.endDate);

    const latestDate = await getLatestDateSupabase();
    let startDate: Date;

    if (latestDate) {
      startDate = new Date(latestDate);
      startDate.setDate(startDate.getDate() + 1);
      console.log(
        `Latest date in Supabase is ${latestDate}. Starting from ${
          startDate.toISOString().split("T")[0]
        }.`
      );
    } else {
      startDate = seasonStartDate;
      console.log(
        `No existing data in Supabase. Starting from season start date ${
          startDate.toISOString().split("T")[0]
        }.`
      );
    }

    const datesToScrape = getDatesBetween(startDate, scrapingEndDate);

    if (datesToScrape.length === 0) {
      console.log("No new dates to scrape.");
      return;
    }

    const urlsQueue: {
      datasetType: string;
      url: string;
      date: string;
      seasonId: string;
    }[] = [];

    for (const date of datesToScrape) {
      const urls = constructUrlsForDate(date, seasonId);
      for (const [datasetType, url] of Object.entries(urls)) {
        urlsQueue.push({ datasetType, url, date, seasonId });
      }
    }

    // Deduplicate
    const uniqueUrls = new Set<string>();
    const uniqueUrlsQueue = urlsQueue.filter(
      ({ datasetType, url, date, seasonId }) => {
        const key = `${datasetType}-${url}-${date}-${seasonId}`;
        if (uniqueUrls.has(key)) {
          return false;
        } else {
          uniqueUrls.add(key);
          return true;
        }
      }
    );

    await processUrlsSequentially(uniqueUrlsQueue);

    if (troublesomePlayers.length > 0) {
      const uniqueTroublesomePlayers = [...new Set(troublesomePlayers)];
      console.log(
        "Troublesome Players (require manual mapping):",
        uniqueTroublesomePlayers
      );
    }
  } catch (error: any) {
    console.error("An error occurred:", error.message);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  try {
    await main();
    res.status(200).json({ message: "Data fetching and upsertion initiated." });
  } catch (error: any) {
    console.error("Error in API handler:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
