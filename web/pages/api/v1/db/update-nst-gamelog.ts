// pages/api/v1/db/update-nst-gamelog.ts

import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import * as cheerio from "cheerio";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason"; // Assuming this util exists and works
import {
  addDays,
  parseISO,
  isAfter,
  differenceInCalendarDays,
  parse,
  format as dateFnsFormat // Use alias to avoid conflict
} from "date-fns";
import { toZonedTime, format as tzFormat } from "date-fns-tz";

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Service Role Key is missing.");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Adjusted delay to 21 seconds as requested. Applied *before* each NST request.
const REQUEST_INTERVAL_MS = 21000; // 21 seconds

const BASE_URL = "https://www.naturalstattrick.com/playerteams.php";
const NHL_API_BASE_URL = "https://api-web.nhle.com/v1";

// Keep existing player name mapping
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
  "Alex Petrovic": { fullName: "Alexander Petrovic" },
  "Martin Fehervary": { fullName: "Martin Fehérváry" },
  "Jonathan Lekkerimaki": { fullName: "Jonathan Lekkerimäki" }
};

// Global list for players whose IDs couldn't be found during the process
const troublesomePlayers: string[] = [];

// --- Helper Functions (Normalize Name, Delay, Dates Between, Map Header, Get Table Name) ---
// These functions remain largely the same as before.

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\-']/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function delay(ms: number) {
  console.log(`Waiting ${ms / 1000} seconds...`);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDatesBetween(start: Date, end: Date): string[] {
  const dates: string[] = [];
  let current = toZonedTime(start, "America/New_York");
  const endZoned = toZonedTime(end, "America/New_York");
  // Ensure start date is not after end date
  if (isAfter(current, endZoned)) {
    return dates; // Return empty array if start is after end
  }
  while (current <= endZoned) {
    dates.push(
      tzFormat(current, "yyyy-MM-dd", { timeZone: "America/New_York" })
    );
    // Ensure we don't add days infinitely if start and end are the same
    if (
      dateFnsFormat(current, "yyyy-MM-dd") ===
      dateFnsFormat(endZoned, "yyyy-MM-dd")
    ) {
      break;
    }
    current = addDays(current, 1);
    // Ensure we don't have timezone issues causing infinite loops near DST changes (re-zone after adding day)
    current = toZonedTime(current, "America/New_York");
  }
  return dates;
}

function mapHeaderToColumn(header: string): string | null {
  const headerMap: Record<string, string> = {
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
    "xGA%": "xga_pct", // Note: NST sometimes shows xGA%, sometimes not. Ensure column exists in DB or handle potential absence.
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
    // Using Non-breaking space unicode character copied from source: ' '
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
    // These rate columns might not exist in all NST tables, handle potential absence
    "On-Ice SH%/60": "on_ice_sh_pct_per_60",
    "On-Ice SV%/60": "on_ice_sv_pct_per_60",
    "PDO/60": "pdo_per_60",
    "Off. Zone Starts/60": "off_zone_starts_per_60",
    "Neu. Zone Starts/60": "neu_zone_starts_per_60",
    "Def. Zone Starts/60": "def_zone_starts_per_60"
  };
  // Header "Player", "Team", "Position" are handled directly in parsing, return null
  if (["Player", "Team", "Position"].includes(header)) return null;

  const mapped = headerMap[header];
  if (!mapped) {
    // console.warn(`Warning: Unmapped header "${header}"`); // Optional: Log unmapped headers
  }
  return mapped || null; // Return null if not found
}

const NST_TABLE_NAMES = [
  "nst_gamelog_as_counts",
  "nst_gamelog_as_rates",
  "nst_gamelog_pp_counts",
  "nst_gamelog_pp_rates",
  "nst_gamelog_as_counts_oi",
  "nst_gamelog_as_rates_oi",
  "nst_gamelog_pp_counts_oi",
  "nst_gamelog_pp_rates_oi",
  "nst_gamelog_es_counts",
  "nst_gamelog_es_rates",
  "nst_gamelog_pk_counts",
  "nst_gamelog_pk_rates",
  "nst_gamelog_es_counts_oi",
  "nst_gamelog_es_rates_oi",
  "nst_gamelog_pk_counts_oi",
  "nst_gamelog_pk_rates_oi"
];

function getTableName(datasetType: string): string {
  // Mapping should be comprehensive based on constructUrlsForDate logic
  const mapping: Record<string, string> = {
    allStrengthsCounts: "nst_gamelog_as_counts",
    allStrengthsRates: "nst_gamelog_as_rates",
    powerPlayCounts: "nst_gamelog_pp_counts",
    powerPlayRates: "nst_gamelog_pp_rates",
    allStrengthsCountsOi: "nst_gamelog_as_counts_oi",
    allStrengthsRatesOi: "nst_gamelog_as_rates_oi",
    powerPlayCountsOi: "nst_gamelog_pp_counts_oi",
    powerPlayRatesOi: "nst_gamelog_pp_rates_oi",
    evenStrengthCounts: "nst_gamelog_es_counts",
    evenStrengthRates: "nst_gamelog_es_rates",
    penaltyKillCounts: "nst_gamelog_pk_counts",
    penaltyKillRates: "nst_gamelog_pk_rates",
    evenStrengthCountsOi: "nst_gamelog_es_counts_oi",
    evenStrengthRatesOi: "nst_gamelog_es_rates_oi",
    penaltyKillCountsOi: "nst_gamelog_pk_counts_oi",
    penaltyKillRatesOi: "nst_gamelog_pk_rates_oi"
  };
  const tableName = mapping[datasetType];
  if (!tableName) {
    // This should ideally not happen if constructUrlsForDate keys match mapping keys
    console.error(
      `FATAL: datasetType "${datasetType}" is not mapped to a valid table name.`
    );
    return "unknown_table"; // Fallback, but indicates a code logic error
  }
  // Ensure the returned name is actually in our list of known tables
  if (!NST_TABLE_NAMES.includes(tableName)) {
    console.error(
      `FATAL: Mapped table name "${tableName}" for datasetType "${datasetType}" is not in the known NST_TABLE_NAMES list.`
    );
    return "unknown_table";
  }
  return tableName;
}

// --- Database Interaction Functions ---

async function getLatestDateSupabase(): Promise<string | null> {
  let latestDate: string | null = null;
  console.log("Querying Supabase for the latest scraped date...");
  for (const table of NST_TABLE_NAMES) {
    const { data, error } = await supabase
      .from(table)
      .select("date_scraped")
      .order("date_scraped", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn(
        `Error querying latest date from ${table}: ${error.message}. Skipping table.`
      );
      continue; // Skip this table if error occurs
    }
    if (data && data.date_scraped) {
      // Use date-fns for reliable comparison
      const currentDate = parse(data.date_scraped, "yyyy-MM-dd", new Date());
      if (
        !latestDate ||
        isAfter(currentDate, parse(latestDate, "yyyy-MM-dd", new Date()))
      ) {
        latestDate = data.date_scraped;
      }
    }
  }
  if (latestDate) {
    console.log(`Latest date found in Supabase: ${latestDate}`);
  } else {
    console.log("No existing date found in any Supabase table.");
  }
  return latestDate;
}

async function checkDataExists(
  datasetType: string,
  date: string
): Promise<boolean> {
  const tableName = getTableName(datasetType);
  if (tableName === "unknown_table") return false; // Already warned in getTableName

  // console.log(`Checking data existence for ${tableName} on ${date}...`); // Verbose logging
  const { count, error } = await supabase
    .from(tableName)
    .select("player_id", { count: "exact", head: true }) // More efficient count query
    .eq("date_scraped", date);

  if (error) {
    console.error(
      `Error checking data existence in ${tableName} for date ${date}:`,
      error.message
    );
    return false; // Assume not exists on error to allow processing attempt
  }

  const exists = count !== null && count > 0;
  // console.log(`Data existence check for table "${tableName}" on date "${date}": ${exists}`); // Verbose logging
  return exists;
}

async function getPlayerIdByName(
  fullName: string,
  position: string
): Promise<number | null> {
  // Use cached mapping first
  const mappedInfo = playerNameMapping[fullName];
  const searchName = mappedInfo ? mappedInfo.fullName : fullName;

  // Normalize the name for broader matching if needed, but prefer exact match first
  // For ILIKE, Supabase handles case-insensitivity. Accents might still be an issue.
  // Consider adding normalization if ILIKE proves insufficient for some names.

  // Special handling for players with the same name but different positions
  const requiresPositionCheck = ["Elias Pettersson", "Sebastian Aho"].includes(
    searchName
  );

  let query = supabase.from("players").select("id").eq("fullName", searchName); // Prioritize exact match (case-insensitive handled by Supabase potentially)

  // If exact match might fail due to accents or slight variations, use ILIKE as fallback
  // query = supabase.from("players").select("id").ilike("fullName", `%${searchName}%`);

  if (requiresPositionCheck) {
    query = query.eq("position", position.toUpperCase());
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    console.error(
      `Error fetching player ID for ${searchName} (${position}): ${error.message}`
    );
    return null;
  }

  if (!data) {
    // Optional: Try a broader search if exact match failed? Be careful with false positives.
    // console.warn(`Player ID not found for ${searchName} (${position}). Adding to troublesome list.`);
    if (!troublesomePlayers.some((p) => p.startsWith(fullName))) {
      // Avoid duplicates
      troublesomePlayers.push(
        `${fullName} (${position}) [Mapped: ${searchName}]`
      );
    }
    return null;
  }

  return data.id;
}

async function upsertData(
  datasetType: string,
  dataRows: any[]
): Promise<{ success: boolean; count: number }> {
  if (!dataRows || dataRows.length === 0) {
    console.warn(`No data rows to upsert for datasetType "${datasetType}".`);
    return { success: true, count: 0 }; // No data is not an error in this context
  }

  const tableName = getTableName(datasetType);
  if (tableName === "unknown_table") {
    console.error(
      `Cannot upsert: Unknown table for datasetType "${datasetType}".`
    );
    return { success: false, count: 0 };
  }

  console.log(
    `Attempting to upsert ${dataRows.length} rows into table "${tableName}"...`
  );

  try {
    const { error, count } = await supabase.from(tableName).upsert(dataRows, {
      onConflict: "player_id,date_scraped", // Assumes this composite key exists and is unique
      // ignoreDuplicates: false, // Default is false, ensures update on conflict
      count: "exact" // Request the count of affected rows
    });

    if (error) {
      console.error(
        `Error upserting data into ${tableName}:`,
        error.details || error.message
      );
      // Log details of the first failed row if possible (error might not provide this)
      if (error.details && dataRows.length > 0) {
        console.error(
          "First row data potentially causing issue:",
          JSON.stringify(dataRows[0])
        );
      }
      return { success: false, count: 0 };
    }

    const upsertedCount = count ?? dataRows.length; // Use returned count if available, else assume all input rows were intended
    console.log(
      `Successfully upserted ${upsertedCount} rows into "${tableName}".`
    );
    return { success: true, count: upsertedCount };
  } catch (e: any) {
    console.error(
      `Unexpected error during upsert operation for ${tableName}:`,
      e.message
    );
    return { success: false, count: 0 };
  }
}

// --- Data Fetching and Parsing (NST) ---

async function fetchAndParseData(
  url: string,
  datasetType: string,
  date: string,
  seasonId: string,
  retries: number = 2 // Reduced internal retries, main loop handles one level
): Promise<{ success: boolean; data: any[] }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(
      `Workspaceing NST data from: ${url} (Attempt ${attempt}/${retries})`
    );
    try {
      const response = await axios.get(url, { timeout: 30000 }); // Increased timeout slightly

      if (!response.data) {
        console.warn(
          `No data received from URL: ${url} on attempt ${attempt}.`
        );
        if (attempt === retries) return { success: false, data: [] }; // Final attempt failed
        await delay(5000); // Wait before retrying
        continue;
      }

      const $ = cheerio.load(response.data);
      const table = $("table").first();
      if (table.length === 0) {
        console.warn(
          `No table found in response from URL: ${url} on attempt ${attempt}.`
        );
        // Check if it's a "no data" page vs an error page
        if ($("body").text().includes("No skaters found")) {
          console.log(`Confirmed no skater data for ${date} at ${url}.`);
          return { success: true, data: [] }; // Legitimate empty result
        }
        if (attempt === retries) return { success: false, data: [] }; // Final attempt failed
        await delay(5000);
        continue;
      }

      const headers: string[] = [];
      table.find("thead tr th").each((_, th) => {
        headers.push($(th).text().trim());
      });

      // Validate headers slightly - expect at least 'Player'
      if (!headers.includes("Player")) {
        console.warn(
          `Table found, but missing expected 'Player' header at ${url}. Attempt ${attempt}.`
        );
        if (attempt === retries) return { success: false, data: [] };
        await delay(5000);
        continue;
      }

      const mappedHeaders = headers.map(mapHeaderToColumn);
      const dataRowsCollected: any[] = []; // Raw data before adding player_id

      table.find("tbody tr").each((_, tr) => {
        const rowData: any = {};
        let playerFullName: string | null = null;
        let playerPosition: string | null = null;
        let playerTeam: string | null = null; // Extract team for potential future use/debugging

        $(tr)
          .find("td")
          .each((i, td) => {
            if (i >= headers.length) return; // Avoid index out of bounds if row has extra tds

            const originalHeader = headers[i];
            const column = mappedHeaders[i]; // Mapped DB column name

            if (originalHeader === "Player") {
              playerFullName = $(td).text().trim();
              return; // Don't store player name directly in rowData yet
            }
            if (originalHeader === "Position") {
              playerPosition = $(td).text().trim();
              return;
            }
            if (originalHeader === "Team") {
              playerTeam = $(td).text().trim();
              return;
            }

            // If column is null, it's unmapped or one of the above handled headers
            if (column === null) return;

            let cellText: string | null = $(td).text().trim();

            if (cellText === "-" || cellText === "" || cellText === "\\-") {
              cellText = null; // Treat empty/placeholder cells as null
            }

            if (cellText !== null) {
              // Improved number conversion: handles percentages, keeps structure
              if (column === "toi" || column === "toi_per_gp") {
                let totalSeconds = null; // Default to null if parsing fails

                // 1. Try parsing as MM:SS format
                if (/^\d{1,2}:\d{2}$/.test(cellText)) {
                  try {
                    const parts = cellText.split(":");
                    const minutes = parseInt(parts[0], 10);
                    const seconds = parseInt(parts[1], 10);
                    if (!isNaN(minutes) && !isNaN(seconds)) {
                      totalSeconds = minutes * 60 + seconds;
                    }
                  } catch (e) {
                    console.warn(
                      `Error parsing MM:SS format '${cellText}' for column ${column}:`,
                      e
                    );
                  }
                }
                // 2. If not MM:SS, try parsing as a float (assuming total minutes)
                else {
                  // Remove potential commas before parsing
                  const num = parseFloat(cellText.replace(/,/g, ""));
                  if (!isNaN(num)) {
                    // Assume the float represents total minutes, convert to seconds and round
                    totalSeconds = Math.round(num * 60);
                  } else {
                    // Optional: Warn if format is neither MM:SS nor a valid number
                    // console.warn(`Unexpected TOI format encountered: '${cellText}' for column ${column}. Storing as null.`);
                  }
                }
                // Store the result (total seconds as integer, or null)
                rowData[column] = totalSeconds;
              }
              // *** END MODIFICATION FOR TOI ***

              // Handle other column types (percentages, numbers, text)
              else if (
                column.endsWith("_percentage") ||
                column.endsWith("_pct") // Combined percentage check
              ) {
                const num = parseFloat(cellText.replace("%", ""));
                rowData[column] = isNaN(num) ? null : num; // Store as number 0-100
              } else {
                // General number/text handling
                const num = Number(cellText.replace(/,/g, "")); // Remove commas for thousands
                // Store as number if possible, otherwise keep as text (unless it was null already)
                rowData[column] = isNaN(num) ? cellText : num;
              }
            } else {
              // If cellText was null from the start (empty/placeholder cell)
              rowData[column] = null;
            }
          });

        // Validate essential parts before adding
        if (
          playerFullName &&
          playerPosition &&
          playerTeam &&
          Object.keys(rowData).length > 0
        ) {
          // Temporarily store original name/pos for player ID lookup
          rowData["_player_full_name_temp"] = playerFullName;
          rowData["_player_position_temp"] = playerPosition;
          // Add other fixed data
          rowData["date_scraped"] = date; // The date the game was played
          rowData["season"] = parseInt(seasonId, 10);
          dataRowsCollected.push(rowData);
        } else {
          // Optional: Log which part was missing if debugging needed
          // console.warn(`Skipping incomplete row: Name=${playerFullName}, Pos=${playerPosition}, Team=${playerTeam}, Data keys=${Object.keys(rowData).length} at ${url}`);
        }
      }); // End table row processing

      // --- Add Player IDs ---
      console.log(
        `Processing ${dataRowsCollected.length} raw rows to add Player IDs...`
      );
      const dataRowsWithPlayerIds: any[] = [];
      for (const row of dataRowsCollected) {
        const playerFullName = row["_player_full_name_temp"];
        const playerPosition = row["_player_position_temp"];

        // Ensure these temp fields exist before trying to get ID
        if (!playerFullName || !playerPosition) {
          console.warn(
            "Skipping row missing temporary name/position fields during ID lookup."
          );
          continue;
        }

        const playerId = await getPlayerIdByName(
          playerFullName,
          playerPosition
        );

        if (!playerId) {
          // getPlayerIdByName already logs to console and adds to troublesomePlayers
          continue; // Skip row if player ID not found
        }

        row["player_id"] = playerId;
        // Clean up temporary fields
        delete row["_player_full_name_temp"];
        delete row["_player_position_temp"];

        dataRowsWithPlayerIds.push(row);
      }

      console.log(
        `Successfully parsed and found IDs for ${dataRowsWithPlayerIds.length} rows for datasetType "${datasetType}" date ${date}.`
      );
      return { success: true, data: dataRowsWithPlayerIds };
    } catch (error: any) {
      console.error(
        `Attempt ${attempt}/${retries} - Error fetching/parsing ${url}:`,
        error.message
      );
      if (axios.isAxiosError(error) && error.response) {
        console.error(
          `Status: ${error.response.status}, Data: ${JSON.stringify(
            error.response.data
          )}`
        );
      }
      if (attempt === retries) {
        console.error(
          `Failed to fetch/parse data from ${url} after ${retries} attempts.`
        );
        return { success: false, data: [] }; // Final attempt failed
      }
      await delay(7000); // Longer delay after error
    }
  } // End retry loop

  // Should not be reached if logic is correct, but acts as a fallback
  console.error(`Exited fetchAndParseData loop unexpectedly for ${url}.`);
  return { success: false, data: [] };
}

// --- URL Construction ---

function constructUrlsForDate(
  date: string,
  seasonId: string
): Record<string, string> {
  const fromSeason = seasonId;
  const thruSeason = seasonId;
  // Ensure date format is YYYY-MM-DD
  const formattedDate = dateFnsFormat(
    parse(date, "yyyy-MM-dd", new Date()),
    "yyyy-MM-dd"
  );

  // Define parameters - using 'S' for Skaters. NST also supports 'G' for Goalies, 'F'/'D' for positions.
  const commonParams = `fromseason=${fromSeason}&thruseason=${thruSeason}&stype=2&pos=S&loc=B&toi=0&gpfilt=gpdate&fd=${formattedDate}&td=${formattedDate}&lines=single&draftteam=ALL`;

  // Define the matrix of options
  const strengths: Record<string, string> = {
    allStrengths: "all",
    evenStrength: "ev",
    powerPlay: "pp",
    penaltyKill: "pk"
  };
  const stdoiOptions = ["std", "oi"]; // Standard vs On-Ice
  const rates = ["n", "y"]; // Counts vs Rates

  const urls: Record<string, string> = {};

  for (const [strengthKey, sitParam] of Object.entries(strengths)) {
    for (const stdoi of stdoiOptions) {
      for (const rate of rates) {
        // Determine datasetType key (matches getTableName mapping)
        let datasetType = strengthKey; // e.g., "allStrengths"
        datasetType += rate === "n" ? "Counts" : "Rates"; // e.g., "allStrengthsCounts"
        if (stdoi === "oi") {
          datasetType += "Oi"; // e.g., "allStrengthsCountsOi"
        }

        // Determine TGP (Time/Games Played filter value) - NST uses different values for counts vs rates sometimes
        // These seem specific to the examples, might need adjustment based on actual NST behavior/needs
        let tgp = rate === "n" ? "0" : "0"; // Using '0' for game logs seems most common, avoids minimum TOI filters

        // Construct the final URL
        const url = `${BASE_URL}?sit=${sitParam}&score=all&stdoi=${stdoi}&rate=${rate}&team=ALL&${commonParams}&tgp=${tgp}`;
        urls[datasetType] = url;
      }
    }
  }
  return urls;
}

// getSitParam is effectively integrated into constructUrlsForDate now

// --- Main Processing Logic ---

interface UrlQueueItem {
  datasetType: string;
  url: string;
  date: string;
  seasonId: string;
}

async function processUrls(
  urlsQueue: UrlQueueItem[],
  isFullRefresh: boolean,
  processedPlayerIds: Set<number>, // Collect player IDs processed in this run
  failedUrls: UrlQueueItem[] // Collect URLs that failed processing
): Promise<void> {
  // No return value needed, modifies sets/arrays directly

  console.log(
    `Starting processing for ${urlsQueue.length} URLs. Full Refresh: ${isFullRefresh}`
  );
  let totalProcessed = 0;

  for (let i = 0; i < urlsQueue.length; i++) {
    const item = urlsQueue[i];
    const { datasetType, url, date, seasonId } = item;

    console.log(
      `\n--- [${totalProcessed + 1}/${
        urlsQueue.length
      }] Processing: ${datasetType} for Date: ${date} ---`
    );
    console.log(`URL: ${url}`);

    // Apply delay BEFORE making the request (except for the very first one)
    if (i > 0) {
      await delay(REQUEST_INTERVAL_MS);
    }

    let shouldFetch = true;
    let skipReason = "";

    // --- Conditional Fetching Logic ---
    if (!isFullRefresh) {
      const dataExists = await checkDataExists(datasetType, date);
      if (dataExists) {
        shouldFetch = false;
        skipReason = "Data already exists (incremental update).";
      }
    } else {
      // Full refresh - always fetch, checkDataExists is skipped
      skipReason =
        "Full refresh requested, fetching regardless of existing data.";
      console.log(skipReason);
    }

    // --- Fetch, Parse, Upsert ---
    let fetchSuccess = false;
    let parseResult: any[] = [];
    let upsertSuccess = false;
    let upsertedCount = 0;

    if (shouldFetch) {
      const fetchParseResponse = await fetchAndParseData(
        url,
        datasetType,
        date,
        seasonId
      );
      fetchSuccess = fetchParseResponse.success;
      parseResult = fetchParseResponse.data;

      if (fetchSuccess && parseResult.length > 0) {
        // Collect Player IDs from successfully parsed data
        parseResult.forEach(
          (row) => row.player_id && processedPlayerIds.add(row.player_id)
        );

        // Upsert the data
        const upsertResponse = await upsertData(datasetType, parseResult);
        upsertSuccess = upsertResponse.success;
        upsertedCount = upsertResponse.count;

        if (!upsertSuccess) {
          // If upsert fails after successful fetch/parse, still log as failure for the URL
          fetchSuccess = false; // Mark overall success as false if upsert fails
        }
      } else if (!fetchSuccess) {
        console.error(`Workspace/Parse failed for ${url}.`);
        // Error already logged in fetchAndParseData
      } else {
        // fetchSuccess is true, but parseResult is empty
        console.log(
          `Workspace successful, but no data rows parsed for ${url}. (Likely no game data for this type/date)`
        );
        upsertSuccess = true; // Consider this scenario successful (nothing to upsert)
      }
    } else {
      // Skipped fetching
      console.log(`Skipping fetch for ${url}: ${skipReason}`);
      fetchSuccess = true; // Mark as success because skipping was intended
      upsertSuccess = true;
    }

    // ──────────────────── AUDIT ROW  ────────────────────────
    await supabase.from("cron_job_audit").insert([
      {
        job_name: "update-nst-gamelog",
        status: upsertSuccess ? "success" : "error",
        rows_affected: upsertedCount,
        details: { datasetType, date }
      }
    ]);
    // ────────────────────────────────────────────────────────

    // --- Logging and Failure Tracking ---
    totalProcessed++;
    printInfoBlock({
      // Assuming printInfoBlock exists and works
      date,
      url,
      datasetType,
      tableName: getTableName(datasetType),
      // dateUrlCount might be less relevant now with sequential processing
      dateUrlCount: { current: i + 1, total: urlsQueue.length }, // Use overall progress
      totalUrlCount: { current: totalProcessed, total: urlsQueue.length },
      rowsProcessed: shouldFetch && fetchSuccess ? parseResult.length : 0,
      rowsPrepared: shouldFetch && fetchSuccess ? parseResult.length : 0,
      rowsUpserted: upsertedCount
    });
    printTotalProgress(totalProcessed, urlsQueue.length); // Assuming printTotalProgress exists

    // Add to failed list if any step failed (and we were supposed to fetch)
    if (shouldFetch && !fetchSuccess) {
      console.warn(`Adding URL to failed list: ${url}`);
      failedUrls.push(item);
    }
  } // End URL loop

  console.log(
    `\n--- Initial URL processing complete. ${failedUrls.length} failures recorded. ---`
  );
}

// --- NHL API Cross-Referencing ---

interface NhlGameLogResponse {
  gameLog: { gameDate: string; [key: string]: any }[];
  [key: string]: any; // Allow other properties
}

interface PlayerMissingData {
  playerId: number;
  supaCount: number;
  nhlCount: number;
  missingDates: string[]; // Dates present in NHL API but not Supabase
}

async function crossReferenceWithNhlApi(
  playerIds: Set<number>,
  seasonId: string, // e.g., "20232024"
  seasonStartDate: Date,
  seasonEndDate: Date // Use the actual end date used for scraping
): Promise<{
  missingPlayerData: PlayerMissingData[];
  uniqueMissingDates: Set<string>;
}> {
  console.log(
    `\n--- Starting NHL API Cross-Reference for ${playerIds.size} players ---`
  );
  const missingPlayerData: PlayerMissingData[] = [];
  const uniqueMissingDates = new Set<string>();

  if (playerIds.size === 0) {
    console.log(
      "No player IDs were processed in this run, skipping cross-reference."
    );
    return { missingPlayerData, uniqueMissingDates };
  }

  // Format dates for Supabase query
  const startDateStr = tzFormat(seasonStartDate, "yyyy-MM-dd", {
    timeZone: "America/New_York"
  });
  const endDateStr = tzFormat(seasonEndDate, "yyyy-MM-dd", {
    timeZone: "America/New_York"
  });
  console.log(
    `Checking Supabase data between ${startDateStr} and ${endDateStr}`
  );

  // Convert Set to Array for easier iteration with index/logging
  const playerIdsArray = Array.from(playerIds);

  for (let i = 0; i < playerIdsArray.length; i++) {
    const playerId = playerIdsArray[i];
    console.log(
      `Checking player ${i + 1}/${playerIdsArray.length}: ID ${playerId}`
    );

    let nhlGameDates = new Set<string>();
    let nhlCount = 0;
    let supaDates = new Set<string>();
    let supaCount = 0;

    // 1. Fetch NHL Game Log
    const nhlApiUrl = `${NHL_API_BASE_URL}/player/${playerId}/game-log/${seasonId}/2`; // 2 = Regular Season
    try {
      const response = await axios.get<NhlGameLogResponse>(nhlApiUrl, {
        timeout: 15000
      });
      if (response.data && response.data.gameLog) {
        nhlCount = response.data.gameLog.length;
        response.data.gameLog.forEach((game) =>
          nhlGameDates.add(game.gameDate)
        ); // gameDate is YYYY-MM-DD
        console.log(`  NHL API: Found ${nhlCount} games.`);
      } else {
        console.log(
          `  NHL API: No game log data found for player ${playerId}.`
        );
        nhlCount = 0;
      }
    } catch (error: any) {
      console.error(
        `  Error fetching NHL data for player ${playerId}: ${error.message}`
      );
      // Optionally decide if this constitutes a failure preventing comparison
      continue; // Skip this player if NHL data fails
    }

    // Add small delay between NHL API calls if hitting rate limits
    // await delay(200);

    // 2. Fetch Supabase Game Dates (Check primary 'counts' table for presence)
    const primaryTable = "nst_gamelog_as_counts"; // Assume if they played, they are in this table
    try {
      const { data, error, count } = await supabase
        .from(primaryTable)
        .select("date_scraped", { count: "exact" })
        .eq("player_id", playerId)
        .gte("date_scraped", startDateStr)
        .lte("date_scraped", endDateStr);

      if (error) {
        console.error(
          `  Error fetching Supabase dates for player ${playerId}: ${error.message}`
        );
        continue; // Skip if Supabase query fails
      }

      if (data) {
        supaCount = count ?? 0; // Use exact count if available
        data.forEach((row) => supaDates.add(row.date_scraped));
        console.log(
          `  Supabase (${primaryTable}): Found ${supaCount} game dates.`
        );
      } else {
        console.log(
          `  Supabase (${primaryTable}): No game dates found for player ${playerId}.`
        );
        supaCount = 0;
      }
    } catch (error: any) {
      console.error(
        `  Unexpected error querying Supabase for player ${playerId}: ${error.message}`
      );
      continue;
    }

    // 3. Compare Counts and Dates
    if (nhlCount !== supaCount) {
      console.warn(
        `  MISMATCH DETECTED for Player ${playerId}: NHL Count=${nhlCount}, Supabase Count=${supaCount}`
      );

      const missingDates: string[] = [];
      nhlGameDates.forEach((nhlDate) => {
        if (!supaDates.has(nhlDate)) {
          missingDates.push(nhlDate);
          uniqueMissingDates.add(nhlDate); // Add to overall set for retry
        }
      });

      if (missingDates.length > 0) {
        console.log(
          `    Missing Dates in Supabase (found in NHL API): ${missingDates.join(
            ", "
          )}`
        );
        missingPlayerData.push({ playerId, supaCount, nhlCount, missingDates });
      } else {
        // Counts mismatch, but date sets are the same? Could indicate duplicates in one source or error.
        console.warn(
          `    Counts mismatch for Player ${playerId}, but no specific missing dates found when comparing sets. Check for duplicates or other issues.`
        );
      }
    } else {
      console.log(`  Counts match for Player ${playerId} (${nhlCount}).`);
    }
  } // End player loop

  console.log(`--- NHL API Cross-Reference Complete ---`);
  if (missingPlayerData.length > 0) {
    console.warn(
      `Found potential missing data for ${missingPlayerData.length} players.`
    );
    console.log(
      `Unique dates identified as missing across all players: ${Array.from(
        uniqueMissingDates
      ).join(", ")}`
    );
  } else {
    console.log("No mismatches found during cross-reference.");
  }

  return { missingPlayerData, uniqueMissingDates };
}

// --- Main Orchestration Function ---
async function main(isFullRefresh: boolean) {
  console.log(
    `--- Script execution started. Full Refresh: ${isFullRefresh} ---`
  );
  const startTime = Date.now();
  troublesomePlayers.length = 0; // Clear troublesome list for this run

  try {
    const seasonInfo = await fetchCurrentSeason();
    if (
      !seasonInfo ||
      !seasonInfo.id ||
      !seasonInfo.startDate ||
      !seasonInfo.endDate
    ) {
      throw new Error("Failed to fetch valid current season information.");
    }
    const seasonId = seasonInfo.id.toString(); // e.g., 20232024
    const timeZone = "America/New_York";

    console.log(`Operating on Season: ${seasonId}`);

    // --- Determine Date Range ---
    const seasonStartDate = toZonedTime(
      new Date(seasonInfo.startDate),
      timeZone
    );
    const todayEST = toZonedTime(new Date(), timeZone); // Use current execution time
    const officialSeasonEndDate = toZonedTime(
      new Date(seasonInfo.endDate),
      timeZone
    );
    // Scrape up to 'today' or the official end date, whichever is earlier
    const scrapingEndDate = isAfter(todayEST, officialSeasonEndDate)
      ? officialSeasonEndDate
      : todayEST;

    let startDate: Date;
    if (isFullRefresh) {
      startDate = seasonStartDate;
      console.log(
        `Full Refresh: Starting from season start date: ${tzFormat(
          startDate,
          "yyyy-MM-dd",
          { timeZone }
        )}`
      );
    } else {
      const latestDateStr = await getLatestDateSupabase();
      if (latestDateStr) {
        const latestDateLocal = parse(latestDateStr, "yyyy-MM-dd", new Date());
        startDate = addDays(latestDateLocal, 1); // Start from the day AFTER the latest date
        startDate = toZonedTime(startDate, timeZone); // Ensure timezone consistency
        console.log(
          `Incremental Update: Latest date is ${latestDateStr}. Starting from ${tzFormat(
            startDate,
            "yyyy-MM-dd",
            { timeZone }
          )}.`
        );
      } else {
        startDate = seasonStartDate;
        console.log(
          `Incremental Update: No existing data. Starting from season start date ${tzFormat(
            startDate,
            "yyyy-MM-dd",
            { timeZone }
          )}.`
        );
      }
    }

    console.log(
      `Effective scraping end date: ${tzFormat(scrapingEndDate, "yyyy-MM-dd", {
        timeZone
      })}`
    );

    const datesToScrape = getDatesBetween(startDate, scrapingEndDate);

    if (datesToScrape.length === 0) {
      console.log("No new dates to scrape based on the determined range.");
      // If full refresh, maybe still proceed to cross-reference? No, because no players were processed.
      console.log(
        "--- Script execution finished early: No dates to process. ---"
      );
      return; // Exit if no dates
    }

    console.log(
      `Planning to scrape ${datesToScrape.length} dates: [${
        datesToScrape[0]
      }...${datesToScrape[datesToScrape.length - 1]}]`
    );

    // --- Generate Initial URL Queue ---
    const initialUrlsQueue: UrlQueueItem[] = [];
    for (const date of datesToScrape) {
      const urls = constructUrlsForDate(date, seasonId);
      for (const [datasetType, url] of Object.entries(urls)) {
        initialUrlsQueue.push({ datasetType, url, date, seasonId });
      }
    }
    console.log(
      `Generated ${initialUrlsQueue.length} initial URLs to process.`
    );

    // --- Process URLs (Initial Pass) ---
    const processedPlayerIds = new Set<number>();
    const failedUrls: UrlQueueItem[] = [];
    await processUrls(
      initialUrlsQueue,
      isFullRefresh,
      processedPlayerIds,
      failedUrls
    );

    // --- Retry Failed URLs ---
    if (failedUrls.length > 0) {
      console.log(`\n--- Retrying ${failedUrls.length} failed URLs ---`);
      const failedUrlsRetryCopy = [...failedUrls]; // Work on a copy
      failedUrls.length = 0; // Clear original array to track retry failures
      // Note: Retries DON'T collect player IDs or add to failedUrls again to avoid loops
      // We could enhance this if needed, but simple retry is often sufficient.
      const retryProcessedIds = new Set<number>(); // Discard after retry
      const retryFailedUrls: UrlQueueItem[] = []; // Capture failures during retry
      await processUrls(
        failedUrlsRetryCopy,
        true,
        retryProcessedIds,
        retryFailedUrls
      ); // Force fetch on retry
      if (retryFailedUrls.length > 0) {
        console.error(
          `!!! ${retryFailedUrls.length} URLs failed even after retry:`
        );
        retryFailedUrls.forEach((item) => console.error(`  - ${item.url}`));
      } else {
        console.log("All initial failures successfully retried.");
      }
    } else {
      console.log("No failures during initial processing pass.");
    }

    // --- Cross-Reference (Full Refresh Only) ---
    let uniqueMissingDates = new Set<string>();
    if (isFullRefresh) {
      const crossRefResult = await crossReferenceWithNhlApi(
        processedPlayerIds,
        seasonId,
        seasonStartDate, // Use the absolute season start for checking
        scrapingEndDate // Check up to the date we scraped
      );
      uniqueMissingDates = crossRefResult.uniqueMissingDates;
      // missingPlayerData contains detailed info if needed for logging/reporting

      // --- Retry Missing Dates Found Via Cross-Reference ---
      if (uniqueMissingDates.size > 0) {
        console.log(
          `\n--- Re-processing ${uniqueMissingDates.size} dates identified as missing via cross-reference ---`
        );
        const missingDatesArray = Array.from(uniqueMissingDates);
        const retryMissingDatesQueue: UrlQueueItem[] = [];
        for (const date of missingDatesArray) {
          // Re-validate date format just in case
          try {
            const validDate = dateFnsFormat(
              parse(date, "yyyy-MM-dd", new Date()),
              "yyyy-MM-dd"
            );
            const urls = constructUrlsForDate(validDate, seasonId);
            for (const [datasetType, url] of Object.entries(urls)) {
              retryMissingDatesQueue.push({
                datasetType,
                url,
                date: validDate,
                seasonId
              });
            }
          } catch (e) {
            console.error(
              `Invalid date format "${date}" encountered during cross-reference retry. Skipping.`
            );
          }
        }

        if (retryMissingDatesQueue.length > 0) {
          console.log(
            `Generated ${retryMissingDatesQueue.length} URLs for missing dates retry.`
          );
          const retryMissingDatesIds = new Set<number>(); // Discard
          const retryMissingDatesFailed: UrlQueueItem[] = []; // Track final failures
          await processUrls(
            retryMissingDatesQueue,
            true,
            retryMissingDatesIds,
            retryMissingDatesFailed
          ); // Force fetch
          if (retryMissingDatesFailed.length > 0) {
            console.error(
              `!!! ${retryMissingDatesFailed.length} URLs failed during cross-reference retry pass:`
            );
            retryMissingDatesFailed.forEach((item) =>
              console.error(`  - ${item.url}`)
            );
          } else {
            console.log("Cross-reference retry pass completed successfully.");
          }
        } else {
          console.log("No valid URLs generated for missing dates retry queue.");
        }
      }
    } else {
      console.log("Skipping NHL API cross-reference (not a full refresh).");
    }

    // --- Final Summary ---
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000 / 60).toFixed(2); // Duration in minutes
    console.log(`\n--- Script execution finished in ${duration} minutes. ---`);
    if (troublesomePlayers.length > 0) {
      console.warn(
        "--- Troublesome Players (Manual Mapping Might Be Required) ---"
      );
      // Log unique troublesome players
      [...new Set(troublesomePlayers)].forEach((p) => console.warn(`  - ${p}`));
    } else {
      console.log("No troublesome players encountered needing ID mapping.");
    }
  } catch (error: any) {
    console.error("\n--- FATAL ERROR in main execution ---");
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    // Rethrow or handle as needed for the API response
    throw error; // Make sure handler catches this
  }
}

// --- API Route Handler ---
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    console.log(`Method ${req.method} not allowed.`);
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // Check for query parameter
  const fullRefreshParam = req.query.fullRefresh;
  const isFullRefresh = fullRefreshParam === "true"; // Strict check for 'true' string

  console.log(
    `API Request received: ${req.url}. Full Refresh Parameter: ${fullRefreshParam} -> ${isFullRefresh}`
  );

  try {
    // Intentionally DO NOT await main() here if it's a long process.
    // Start the process but return response immediately.
    main(isFullRefresh).catch((error) => {
      // Log errors that occur *after* the response has been sent
      console.error("Unhandled error during background main execution:", error);
      // Potentially add more robust background error tracking (e.g., logging service)
    });

    // Return a response quickly to avoid timeout
    res.status(202).json({
      message: `Data processing ${
        isFullRefresh ? "(Full Refresh) " : ""
      }initiated in background. Check server logs for progress.`
    });
  } catch (error: any) {
    // Catch errors during the *initiation* of main() or if main() throws synchronously
    // (although the async nature means most errors are caught by the .catch above)
    console.error("Error initiating API handler:", error.message);
    res
      .status(500)
      .json({ message: "Internal Server Error during initiation." });
  }
}

// --- Utility Functions (printInfoBlock, printTotalProgress) ---
// Make sure these are defined somewhere or add them here if needed

function printInfoBlock(params: {
  date: string;
  url: string;
  datasetType: string;
  tableName: string;
  dateUrlCount: { current: number; total: number }; // Less relevant now
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
    totalUrlCount,
    rowsProcessed,
    rowsPrepared,
    rowsUpserted
  } = params;
  // Simplified log block
  console.log(
    `|--- INFO [${totalUrlCount.current}/${totalUrlCount.total}] ---`
  );
  console.log(`| Date: ${date}, Type: ${datasetType}`);
  // console.log(`| URL: ${url}`); // Can be verbose
  console.log(`| Table: ${tableName}`);
  console.log(
    `| Processed: ${rowsProcessed}, Prepared: ${rowsPrepared}, Upserted: ${rowsUpserted}`
  );
  console.log(`|--------------------------`);
}

function printTotalProgress(current: number, total: number) {
  if (total === 0) return; // Avoid division by zero
  const percentage = (current / total) * 100;
  const filled = Math.floor((percentage / 100) * 20); // 20-char bar
  const bar =
    "Progress: [" + "#".repeat(filled) + ".".repeat(20 - filled) + "]";
  console.log(`${bar} ${percentage.toFixed(1)}% (${current}/${total})`);
}
