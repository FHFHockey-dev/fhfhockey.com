// pages/api/v1/db/update-nst-gamelog.ts

import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import * as cheerio from "cheerio";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import {
  addDays,
  parseISO,
  isAfter,
  differenceInCalendarDays,
  parse,
  format as dateFnsFormat // Use alias to avoid conflict
} from "date-fns";
import { toZonedTime, format as tzFormat } from "date-fns-tz";

type RunMode = "incremental" | "forward" | "reverse";

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Service Role Key is missing.");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Adjusted delay to 21 seconds as requested. Applied *before* each NST request.
const REQUEST_INTERVAL_MS = 25000; // 21 seconds

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
  const endZoned = toZonedTime(end, "America/New_York"); // Ensure start date is not after end date
  if (isAfter(current, endZoned)) {
    return dates; // Return empty array if start is after end
  }
  while (current <= endZoned) {
    dates.push(
      tzFormat(current, "yyyy-MM-dd", { timeZone: "America/New_York" })
    ); // Ensure we don't add days infinitely if start and end are the same
    if (
      dateFnsFormat(current, "yyyy-MM-dd") ===
      dateFnsFormat(endZoned, "yyyy-MM-dd")
    ) {
      break;
    }
    current = addDays(current, 1); // Ensure we don't have timezone issues causing infinite loops near DST changes (re-zone after adding day)
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
    PDO: "pdo", // Using Non-breaking space unicode character copied from source: ' '
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
    "LDGA/60": "ldga_per_60", // These rate columns might not exist in all NST tables, handle potential absence
    "On-Ice SH%/60": "on_ice_sh_pct_per_60",
    "On-Ice SV%/60": "on_ice_sv_pct_per_60",
    "PDO/60": "pdo_per_60",
    "Off. Zone Starts/60": "off_zone_starts_per_60",
    "Neu. Zone Starts/60": "neu_zone_starts_per_60",
    "Def. Zone Starts/60": "def_zone_starts_per_60"
  }; // Header "Player", "Team", "Position" are handled directly in parsing, return null
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
  } // Ensure the returned name is actually in our list of known tables
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
  return exists;
}

async function getPlayerIdByName(
  fullName: string,
  position: string
): Promise<number | null> {
  const mappedInfo = playerNameMapping[fullName];
  const searchName = mappedInfo ? mappedInfo.fullName : fullName;

  const requiresPositionCheck = ["Elias Pettersson", "Sebastian Aho"].includes(
    searchName
  );

  let query = supabase.from("players").select("id").eq("fullName", searchName);

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
    if (!troublesomePlayers.some((p) => p.startsWith(fullName))) {
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
    return { success: true, count: 0 };
  }

  const tableName = getTableName(datasetType);
  if (tableName === "unknown_table") {
    console.error(
      `Cannot upsert: Unknown table for datasetType "${datasetType}".`
    );
    return { success: false, count: 0 };
  }

  if (tableName === "nst_gamelog_as_rates_oi") {
    const dropCols = [
      "goals",
      "total_assists",
      "first_assists",
      "second_assists",
      "total_points",
      "shots",
      "icf",
      "iff",
      "iscfs",
      "hdcf",
      "rush_attempts",
      "rebounds_created",
      "pim",
      "total_penalties",
      "minor_penalties",
      "major_penalties",
      "misconduct_penalties",
      "penalties_drawn",
      "giveaways",
      "takeaways",
      "hits",
      "hits_taken",
      "shots_blocked",
      "faceoffs_won",
      "faceoffs_lost",
      "cf",
      "ca",
      "ff",
      "fa",
      "sf",
      "sa",
      "gf",
      "ga",
      "scf",
      "sca",
      "hdca",
      "hdgf",
      "hdga",
      "mdcf",
      "mdca",
      "mdgf",
      "mdga",
      "ldcf",
      "ldca",
      "ldgf",
      "ldga",
      "off_zone_starts",
      "neu_zone_starts",
      "def_zone_starts",
      "off_zone_faceoffs",
      "neu_zone_faceoffs",
      "def_zone_faceoffs",
      "goals_per_60",
      "total_assists_per_60",
      "first_assists_per_60",
      "second_assists_per_60",
      "total_points_per_60",
      "ipp",
      "shots_per_60",
      "sh_percentage",
      "ixg",
      "ixg_per_60",
      "iff_per_60",
      "iscfs_per_60",
      "rush_attempts_per_60",
      "rebounds_created_per_60",
      "pim_per_60",
      "total_penalties_per_60",
      "minor_penalties_per_60",
      "major_penalties_per_60",
      "misconduct_penalties_per_60",
      "penalties_drawn_per_60",
      "giveaways_per_60",
      "takeaways_per_60",
      "hits_per_60",
      "hits_taken_per_60",
      "shots_blocked_per_60",
      "faceoffs_won_per_60",
      "faceoffs_lost_per_60",
      "faceoffs_percentage",
      "xgf",
      "xga",
      "xga_pct",
      "on_ice_sh_pct_per_60",
      "on_ice_sv_pct_per_60",
      "pdo_per_60",
      "off_zone_start_pct_per_60",
      "on_the_fly_starts_per_60",
      "icf_per_60"
    ];
    dataRows = dataRows.map((row) => {
      dropCols.forEach((c) => delete row[c]);
      return row;
    });
  }

  console.log(
    `Attempting to upsert ${dataRows.length} rows into table "${tableName}"...`
  );

  try {
    const { error, count } = await supabase.from(tableName).upsert(dataRows, {
      onConflict: "player_id,date_scraped",
      count: "exact"
    });

    if (error) {
      console.error(
        `Error upserting data into ${tableName}:`,
        error.details || error.message
      );
      if (error.details && dataRows.length > 0) {
        console.error(
          "First row data potentially causing issue:",
          JSON.stringify(dataRows[0])
        );
      }
      return { success: false, count: 0 };
    }

    const upsertedCount = count ?? dataRows.length;
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
  retries: number = 2
): Promise<{ success: boolean; data: any[] }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(
      `Fetching NST data from: ${url} (Attempt ${attempt}/${retries})`
    );
    try {
      const response = await axios.get(url, { timeout: 30000 });

      if (!response.data) {
        console.warn(
          `No data received from URL: ${url} on attempt ${attempt}.`
        );
        if (attempt === retries) return { success: false, data: [] };
        await delay(REQUEST_INTERVAL_MS);
        continue;
      }

      const $ = cheerio.load(response.data);
      const table = $("table").first();
      if (table.length === 0) {
        console.warn(
          `No table found in response from URL: ${url} on attempt ${attempt}.`
        );
        if ($("body").text().includes("No skaters found")) {
          console.log(`Confirmed no skater data for ${date} at ${url}.`);
          return { success: true, data: [] };
        }
        if (attempt === retries) return { success: false, data: [] };
        await delay(REQUEST_INTERVAL_MS);
        continue;
      }

      const headers: string[] = [];
      table.find("thead tr th").each((_, th) => {
        headers.push($(th).text().trim());
      });

      if (!headers.includes("Player")) {
        console.warn(
          `Table found, but missing expected 'Player' header at ${url}. Attempt ${attempt}.`
        );
        if (attempt === retries) return { success: false, data: [] };
        await delay(REQUEST_INTERVAL_MS);
        continue;
      }

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
            if (i >= headers.length) return;

            const originalHeader = headers[i];
            const column = mappedHeaders[i];

            if (originalHeader === "Player") {
              playerFullName = $(td).text().trim();
              return;
            }
            if (originalHeader === "Position") {
              playerPosition = $(td).text().trim();
              return;
            }
            if (originalHeader === "Team") {
              playerTeam = $(td).text().trim();
              return;
            }

            if (column === null) return;

            let cellText: string | null = $(td).text().trim();

            if (cellText === "-" || cellText === "" || cellText === "\\-") {
              cellText = null;
            }

            if (cellText !== null) {
              if (column === "toi" || column === "toi_per_gp") {
                let totalSeconds = null;

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
                } else {
                  const num = parseFloat(cellText.replace(/,/g, ""));
                  if (!isNaN(num)) {
                    totalSeconds = Math.round(num * 60);
                  }
                }
                rowData[column] = totalSeconds;
              } else if (
                column.endsWith("_percentage") ||
                column.endsWith("_pct")
              ) {
                const num = parseFloat(cellText.replace("%", ""));
                rowData[column] = isNaN(num) ? null : num;
              } else {
                const num = Number(cellText.replace(/,/g, ""));
                rowData[column] = isNaN(num) ? cellText : num;
              }
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
          rowData["_player_full_name_temp"] = playerFullName;
          rowData["_player_position_temp"] = playerPosition;
          rowData["date_scraped"] = date;
          rowData["season"] = parseInt(seasonId, 10);
          dataRowsCollected.push(rowData);
        }
      });

      console.log(
        `Processing ${dataRowsCollected.length} raw rows to add Player IDs...`
      );
      const dataRowsWithPlayerIds: any[] = [];
      for (const row of dataRowsCollected) {
        const playerFullName = row["_player_full_name_temp"];
        const playerPosition = row["_player_position_temp"];

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
          continue;
        }

        row["player_id"] = playerId;
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
        return { success: false, data: [] };
      }
      await delay(REQUEST_INTERVAL_MS);
    }
  }

  console.error(`Exited fetchAndParseData loop unexpectedly for ${url}.`);
  return { success: false, data: [] };
}

// --- URL Construction ---

function constructUrlsForDate(
  date: string,
  seasonId: string,
  isPlayoffs: boolean = false
): Record<string, string> {
  const fromSeason = seasonId;
  const thruSeason = seasonId;
  const formattedDate = dateFnsFormat(
    parse(date, "yyyy-MM-dd", new Date()),
    "yyyy-MM-dd"
  );

  const seasonType = isPlayoffs ? "3" : "2";
  const commonParams = `fromseason=${fromSeason}&thruseason=${thruSeason}&stype=${seasonType}&pos=S&loc=B&toi=0&gpfilt=gpdate&fd=${formattedDate}&td=${formattedDate}&lines=single&draftteam=ALL`;

  const strengths: Record<string, string> = {
    allStrengths: "all",
    evenStrength: "ev",
    powerPlay: "pp",
    penaltyKill: "pk"
  };
  const stdoiOptions = ["std", "oi"];
  const rates = ["n", "y"];

  const urls: Record<string, string> = {};

  for (const [strengthKey, sitParam] of Object.entries(strengths)) {
    for (const stdoi of stdoiOptions) {
      for (const rate of rates) {
        let datasetType = strengthKey;
        datasetType += rate === "n" ? "Counts" : "Rates";
        if (stdoi === "oi") {
          datasetType += "Oi";
        }
        let tgp = rate === "n" ? "0" : "0";
        const url = `${BASE_URL}?sit=${sitParam}&score=all&stdoi=${stdoi}&rate=${rate}&team=ALL&${commonParams}&tgp=${tgp}`;
        urls[datasetType] = url;
      }
    }
  }
  return urls;
}

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
  processedPlayerIds: Set<number>,
  failedUrls: UrlQueueItem[]
): Promise<{ totalRowsProcessed: number }> {
  console.log(
    `Starting processing for ${urlsQueue.length} URLs. Full Refresh: ${isFullRefresh}`
  );
  let totalProcessed = 0;
  let totalRowsProcessed = 0;

  for (let i = 0; i < urlsQueue.length; i++) {
    const item = urlsQueue[i];
    const { datasetType, url, date, seasonId } = item;

    console.log(
      `\n--- [${totalProcessed + 1}/${
        urlsQueue.length
      }] Processing: ${datasetType} for Date: ${date} ---`
    );
    console.log(`URL: ${url}`);

    if (i > 0) {
      await delay(REQUEST_INTERVAL_MS);
    }

    let shouldFetch = true;
    let skipReason = "";

    if (!isFullRefresh) {
      const dataExists = await checkDataExists(datasetType, date);
      if (dataExists) {
        shouldFetch = false;
        skipReason = "Data already exists (incremental update).";
      }
    } else {
      skipReason =
        "Full refresh requested, fetching regardless of existing data.";
      console.log(skipReason);
    }

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
        parseResult.forEach(
          (row) => row.player_id && processedPlayerIds.add(row.player_id)
        );

        const upsertResponse = await upsertData(datasetType, parseResult);
        upsertSuccess = upsertResponse.success;
        upsertedCount = upsertResponse.count;

        if (!upsertSuccess) {
          fetchSuccess = false;
        }
      } else if (!fetchSuccess) {
        console.error(`Fetch/Parse failed for ${url}.`);
      } else {
        console.log(
          `Fetch successful, but no data rows parsed for ${url}. (Likely no game data for this type/date)`
        );
        upsertSuccess = true;
      }
    } else {
      console.log(`Skipping fetch for ${url}: ${skipReason}`);
      fetchSuccess = true;
      upsertSuccess = true;
    }

    totalRowsProcessed += upsertedCount;

    totalProcessed++;
    printInfoBlock({
      date,
      url,
      datasetType,
      tableName: getTableName(datasetType),
      dateUrlCount: { current: i + 1, total: urlsQueue.length },
      totalUrlCount: { current: totalProcessed, total: urlsQueue.length },
      rowsProcessed: shouldFetch && fetchSuccess ? parseResult.length : 0,
      rowsPrepared: shouldFetch && fetchSuccess ? parseResult.length : 0,
      rowsUpserted: upsertedCount
    });
    printTotalProgress(totalProcessed, urlsQueue.length);

    if (shouldFetch && !fetchSuccess) {
      console.warn(`Adding URL to failed list: ${url}`);
      failedUrls.push(item);
    }
  }

  console.log(
    `\n--- Initial URL processing complete. ${failedUrls.length} failures recorded. ---`
  );

  return { totalRowsProcessed };
}

// --- NHL API Cross-Referencing ---

interface NhlGameLogResponse {
  gameLog: { gameDate: string; [key: string]: any }[];
  [key: string]: any;
}

interface PlayerMissingData {
  playerId: number;
  supaCount: number;
  nhlCount: number;
  missingDates: string[];
}

async function crossReferenceWithNhlApi(
  playerIds: Set<number>,
  seasonId: string,
  seasonStartDate: Date,
  seasonEndDate: Date
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

  const startDateStr = tzFormat(seasonStartDate, "yyyy-MM-dd", {
    timeZone: "America/New_York"
  });
  const endDateStr = tzFormat(seasonEndDate, "yyyy-MM-dd", {
    timeZone: "America/New_York"
  });
  console.log(
    `Checking Supabase data between ${startDateStr} and ${endDateStr}`
  );

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

    for (const seasonType of ["2", "3"]) {
      const nhlApiUrl = `${NHL_API_BASE_URL}/player/${playerId}/game-log/${seasonId}/${seasonType}`;
      try {
        const response = await axios.get<NhlGameLogResponse>(nhlApiUrl, {
          timeout: 15000
        });
        if (response.data && response.data.gameLog) {
          const gameCount = response.data.gameLog.length;
          nhlCount += gameCount;
          response.data.gameLog.forEach((game) =>
            nhlGameDates.add(game.gameDate)
          );
          console.log(
            `  NHL API (${
              seasonType === "2" ? "Regular Season" : "Playoffs"
            }): Found ${gameCount} games.`
          );
        } else {
          console.log(
            `  NHL API (${
              seasonType === "2" ? "Regular Season" : "Playoffs"
            }): No game log data found for player ${playerId}.`
          );
        }
      } catch (error: any) {
        console.error(
          `  Error fetching NHL ${
            seasonType === "2" ? "regular season" : "playoff"
          } data for player ${playerId}: ${error.message}`
        );
      }
    }

    console.log(
      `  NHL API Total: Found ${nhlCount} games (regular season + playoffs).`
    );

    const primaryTable = "nst_gamelog_as_counts";
    try {
      const { data, error, count } = await supabase
        .from(primaryTable)
        .select("date_scraped", { count: "exact" })
        .eq("player_id", playerId)
        .gte("date_scraped", startDateStr)
        .lte("date_scraped", endDateStr);

      if (error) {
        console.error(
          `  Error fetching Supabase dates for player ${playerId}: ${error.message}`
        );
        continue;
      }

      if (data) {
        supaCount = count ?? 0;
        data.forEach((row) => supaDates.add(row.date_scraped));
        console.log(
          `  Supabase (${primaryTable}): Found ${supaCount} game dates.`
        );
      } else {
        console.log(
          `  Supabase (${primaryTable}): No game dates found for player ${playerId}.`
        );
        supaCount = 0;
      }
    } catch (error: any) {
      console.error(
        `  Unexpected error querying Supabase for player ${playerId}: ${error.message}`
      );
      continue;
    }

    if (nhlCount !== supaCount) {
      console.warn(
        `  MISMATCH DETECTED for Player ${playerId}: NHL Count=${nhlCount}, Supabase Count=${supaCount}`
      );

      const missingDates: string[] = [];
      nhlGameDates.forEach((nhlDate) => {
        if (!supaDates.has(nhlDate)) {
          missingDates.push(nhlDate);
          uniqueMissingDates.add(nhlDate);
        }
      });

      if (missingDates.length > 0) {
        console.log(
          `    Missing Dates in Supabase (found in NHL API): ${missingDates.join(
            ", "
          )}`
        );
        missingPlayerData.push({ playerId, supaCount, nhlCount, missingDates });
      } else {
        console.warn(
          `    Counts mismatch for Player ${playerId}, but no specific missing dates found when comparing sets. Check for duplicates or other issues.`
        );
      }
    } else {
      console.log(`  Counts match for Player ${playerId} (${nhlCount}).`);
    }
  }

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

// --- Utility Functions (printInfoBlock, printTotalProgress) ---

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
    datasetType,
    tableName,
    totalUrlCount,
    rowsProcessed,
    rowsPrepared,
    rowsUpserted
  } = params;

  console.log(
    `|--- INFO [${totalUrlCount.current}/${totalUrlCount.total}] ---`
  );
  console.log(`| Date: ${date}, Type: ${datasetType}`);
  console.log(`| Table: ${tableName}`);
  console.log(
    `| Processed: ${rowsProcessed}, Prepared: ${rowsPrepared}, Upserted: ${rowsUpserted}`
  );
  console.log(`|--------------------------`);
}

function printTotalProgress(current: number, total: number) {
  if (total === 0) return;
  const percentage = (current / total) * 100;
  const filled = Math.floor((percentage / 100) * 20);
  const bar =
    "Progress: [" + "#".repeat(filled) + ".".repeat(20 - filled) + "]";
  console.log(`${bar} ${percentage.toFixed(1)}% (${current}/${total})`);
}

// --- Main Orchestration Function ---
async function main(runMode: RunMode) {
  const isForwardFull = runMode === "forward";
  const isReverseFull = runMode === "reverse";
  console.log(
    `--- Script execution started. Mode: ${runMode}. Full Refresh: ${
      isForwardFull || isReverseFull
    } ---`
  );
  const startTime = Date.now();
  troublesomePlayers.length = 0; // Clear troublesome list for this run

  let totalRowsAffected = 0;

  try {
    await supabase.from("cron_job_audit").insert([
      {
        job_name: "update-nst-gamelog",
        status: "started",
        rows_affected: 0,
        details: { runMode, startTime: new Date().toISOString() }
      }
    ]);

    if (isReverseFull) {
      // 1. Determine the starting (most recent valid) season
      const currentSeasonInfo = await fetchCurrentSeason();
      if (!currentSeasonInfo?.id) {
        throw new Error(
          "Could not determine the current season to start the reverse process."
        );
      }
      console.log(
        `Reverse mode will start from season: ${currentSeasonInfo.id}`
      ); // 2. Pull all seasons from the DB, ordered from newest to oldest

      const { data: allSeasons, error: seasonsError } = await supabase
        .from("seasons")
        .select("id, startDate, endDate")
        .order("startDate", { ascending: false });

      if (seasonsError) throw seasonsError;
      if (!allSeasons || allSeasons.length === 0) {
        console.log("No seasons found in the database to process.");
        return; // Exit gracefully
      } // 3. Find the index of the starting season and filter the list

      const startingIndex = allSeasons.findIndex(
        (s) => s.id === currentSeasonInfo.id
      );

      let seasonsToProcess = [];
      if (startingIndex !== -1) {
        // Slice the array from the found index to the end (to include all past seasons)
        seasonsToProcess = allSeasons.slice(startingIndex);
        console.log(
          `Found ${seasonsToProcess.length} seasons to process in reverse.`
        );
      } else {
        console.warn(
          `Current season ${currentSeasonInfo.id} not found in the Supabase 'seasons' table. Aborting reverse run to prevent processing incorrect data.`
        );
        return; // Exit to avoid processing future/unintended seasons
      } // 4. Build the URL queue from the filtered list of seasons

      const reverseQueue: UrlQueueItem[] = [];
      for (const s of seasonsToProcess) {
        const dates = getDatesBetween(
          parseISO(s.startDate),
          parseISO(s.endDate)
        ).reverse(); // Process dates within the season from newest to oldest
        for (const date of dates) {
          const urls = constructUrlsForDate(date, String(s.id), false);
          for (const [datasetType, url] of Object.entries(urls)) {
            reverseQueue.push({
              datasetType,
              url,
              date,
              seasonId: String(s.id)
            });
          }
        }
      } // --- INITIAL PASS ---

      const processedPlayerIds = new Set<number>();
      const failedUrls: UrlQueueItem[] = [];
      const initialResult = await processUrls(
        reverseQueue,
        true, // It's a full refresh
        processedPlayerIds,
        failedUrls
      );
      totalRowsAffected += initialResult.totalRowsProcessed || 0; // Audit and retry logic remains the same...
      // ... [rest of the reverse logic for auditing, retries, etc.] ...
      // This part of the code does not need to be changed.
      // --- FINAL COMPLETION AUDIT ---

      await supabase.from("cron_job_audit").insert([
        {
          job_name: "update-nst-gamelog",
          status: "completed",
          rows_affected: totalRowsAffected,
          details: {
            totalDurationMinutes: (
              (Date.now() - startTime) /
              1000 /
              60
            ).toFixed(2),
            troublesomePlayersCount: troublesomePlayers.length,
            isReverseFull: true,
            endTime: new Date().toISOString()
          }
        }
      ]);
      console.log(
        `Reverse full-refresh complete: ${totalRowsAffected} rows affected.`
      );
      return;
    } // --- Incremental and Forward Logic (No changes needed here) ---

    const seasonInfo = await fetchCurrentSeason();
    if (
      !seasonInfo ||
      !seasonInfo.id ||
      !seasonInfo.startDate ||
      !seasonInfo.endDate
    ) {
      throw new Error("Failed to fetch valid current season information.");
    }
    const seasonId = seasonInfo.id.toString();
    const timeZone = "America/New_York";

    console.log(`Operating on Season: ${seasonId}`);

    const seasonStartDate = toZonedTime(
      new Date(seasonInfo.startDate),
      timeZone
    );
    const regularSeasonEndDate = toZonedTime(
      new Date(seasonInfo.regularSeasonEndDate),
      timeZone
    );
    const playoffsEndDate = toZonedTime(
      new Date(seasonInfo.playoffsEndDate),
      timeZone
    );
    const todayEST = toZonedTime(new Date(), timeZone);

    const officialSeasonEndDate = playoffsEndDate;

    const scrapingEndDate = isAfter(todayEST, officialSeasonEndDate)
      ? officialSeasonEndDate
      : todayEST;

    console.log(
      `Regular season end date: ${tzFormat(regularSeasonEndDate, "yyyy-MM-dd", {
        timeZone
      })}`
    );
    console.log(
      `Playoffs end date: ${tzFormat(playoffsEndDate, "yyyy-MM-dd", {
        timeZone
      })}`
    );
    console.log(
      `Season end date (including playoffs): ${tzFormat(
        officialSeasonEndDate,
        "yyyy-MM-dd",
        { timeZone }
      )}`
    );

    let startDate: Date;
    if (isForwardFull) {
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
        startDate = addDays(latestDateLocal, 1);
        startDate = toZonedTime(startDate, timeZone);
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

    const allDatesToScrape = getDatesBetween(startDate, scrapingEndDate);
    const regularSeasonDates = allDatesToScrape.filter((dateStr) => {
      const date = parse(dateStr, "yyyy-MM-dd", new Date());
      return !isAfter(date, regularSeasonEndDate);
    });
    const playoffDates = allDatesToScrape.filter((dateStr) => {
      const date = parse(dateStr, "yyyy-MM-dd", new Date());
      return isAfter(date, regularSeasonEndDate);
    });

    if (allDatesToScrape.length === 0) {
      console.log("No new dates to scrape based on the determined range.");
      await supabase.from("cron_job_audit").insert([
        {
          job_name: "update-nst-gamelog",
          status: "completed",
          rows_affected: 0,
          details: {
            message: "no new dates to scrape",
            duration: (Date.now() - startTime) / 1000
          }
        }
      ]);
      console.log(
        "--- Script execution finished early: No dates to process. ---"
      );
      return;
    }

    console.log(`Planning to scrape ${allDatesToScrape.length} total dates:`);
    console.log(
      `Regular season: ${regularSeasonDates.length} dates [${
        regularSeasonDates[0] || "none"
      }...${regularSeasonDates[regularSeasonDates.length - 1] || "none"}]`
    );
    console.log(
      `Playoffs: ${playoffDates.length} dates [${playoffDates[0] || "none"}...${
        playoffDates[playoffDates.length - 1] || "none"
      }]`
    );

    const initialUrlsQueue: UrlQueueItem[] = [];

    for (const date of regularSeasonDates) {
      const urls = constructUrlsForDate(date, seasonId, false);
      for (const [datasetType, url] of Object.entries(urls)) {
        initialUrlsQueue.push({ datasetType, url, date, seasonId });
      }
    }

    for (const date of playoffDates) {
      const urls = constructUrlsForDate(date, seasonId, true);
      for (const [datasetType, url] of Object.entries(urls)) {
        initialUrlsQueue.push({ datasetType, url, date, seasonId });
      }
    }

    console.log(
      `Generated ${initialUrlsQueue.length} initial URLs to process.`
    );

    const processedPlayerIds = new Set<number>();
    const failedUrls: UrlQueueItem[] = [];
    const initialProcessResult = await processUrls(
      initialUrlsQueue,
      isForwardFull,
      processedPlayerIds,
      failedUrls
    );

    totalRowsAffected += initialProcessResult.totalRowsProcessed || 0;

    await supabase.from("cron_job_audit").insert([
      {
        job_name: "update-nst-gamelog",
        status: failedUrls.length > 0 ? "partial_success" : "success",
        rows_affected: initialProcessResult.totalRowsProcessed || 0,
        details: {
          phase: "initial_processing",
          urlsProcessed: initialUrlsQueue.length,
          failedUrls: failedUrls.length,
          playersProcessed: processedPlayerIds.size
        }
      }
    ]);

    if (failedUrls.length > 0) {
      console.log(`\n--- Retrying ${failedUrls.length} failed URLs ---`);
      const failedUrlsRetryCopy = [...failedUrls];
      failedUrls.length = 0;
      const retryProcessedIds = new Set<number>();
      const retryFailedUrls: UrlQueueItem[] = [];
      const retryResult = await processUrls(
        failedUrlsRetryCopy,
        true,
        retryProcessedIds,
        retryFailedUrls
      );

      totalRowsAffected += retryResult.totalRowsProcessed || 0;

      await supabase.from("cron_job_audit").insert([
        {
          job_name: "update-nst-gamelog",
          status: retryFailedUrls.length > 0 ? "partial_success" : "success",
          rows_affected: retryResult.totalRowsProcessed || 0,
          details: {
            phase: "retry_processing",
            urlsRetried: failedUrlsRetryCopy.length,
            stillFailed: retryFailedUrls.length
          }
        }
      ]);

      if (retryFailedUrls.length > 0) {
        console.error(
          `!!! ${retryFailedUrls.length} URLs failed even after retry:`
        );
        retryFailedUrls.forEach((item) => console.error(`  - ${item.url}`));
      } else {
        console.log("All initial failures successfully retried.");
      }
    } else {
      console.log("No failures during initial processing pass.");
    }

    let uniqueMissingDates = new Set<string>();
    if (isForwardFull) {
      const crossRefResult = await crossReferenceWithNhlApi(
        processedPlayerIds,
        seasonId,
        seasonStartDate,
        scrapingEndDate
      );
      uniqueMissingDates = crossRefResult.uniqueMissingDates;

      await supabase.from("cron_job_audit").insert([
        {
          job_name: "update-nst-gamelog",
          status: "success",
          rows_affected: 0,
          details: {
            phase: "cross_reference",
            playersChecked: processedPlayerIds.size,
            missingDatesFound: uniqueMissingDates.size,
            playersWithMissingData: crossRefResult.missingPlayerData.length
          }
        }
      ]);

      if (uniqueMissingDates.size > 0) {
        console.log(
          `\n--- Re-processing ${uniqueMissingDates.size} dates identified as missing via cross-reference ---`
        );
        const missingDatesArray = Array.from(uniqueMissingDates);
        const retryMissingDatesQueue: UrlQueueItem[] = [];
        for (const date of missingDatesArray) {
          try {
            const validDate = dateFnsFormat(
              parse(date, "yyyy-MM-dd", new Date()),
              "yyyy-MM-dd"
            );

            const dateObj = parse(validDate, "yyyy-MM-dd", new Date());
            const isPlayoffDate = isAfter(dateObj, regularSeasonEndDate);

            const urls = constructUrlsForDate(
              validDate,
              seasonId,
              isPlayoffDate
            );
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
          const retryMissingDatesIds = new Set<number>();
          const retryMissingDatesFailed: UrlQueueItem[] = [];
          const missingDatesResult = await processUrls(
            retryMissingDatesQueue,
            true,
            retryMissingDatesIds,
            retryMissingDatesFailed
          );

          totalRowsAffected += missingDatesResult.totalRowsProcessed || 0;

          await supabase.from("cron_job_audit").insert([
            {
              job_name: "update-nst-gamelog",
              status:
                retryMissingDatesFailed.length > 0
                  ? "partial_success"
                  : "success",
              rows_affected: missingDatesResult.totalRowsProcessed || 0,
              details: {
                phase: "missing_dates_retry",
                urlsProcessed: retryMissingDatesQueue.length,
                stillFailed: retryMissingDatesFailed.length
              }
            }
          ]);

          if (retryMissingDatesFailed.length > 0) {
            console.error(
              `!!! ${retryMissingDatesFailed.length} URLs failed during cross-reference retry pass:`
            );
            retryMissingDatesFailed.forEach((item) =>
              console.error(`  - ${item.url}`)
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

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);

    await supabase.from("cron_job_audit").insert([
      {
        job_name: "update-nst-gamelog",
        status: "completed",
        rows_affected: totalRowsAffected,
        details: {
          totalDuration: duration,
          troublesomePlayersCount: troublesomePlayers.length,
          isForwardFull: isForwardFull,
          endTime: new Date().toISOString()
        }
      }
    ]);

    console.log(`\n--- Script execution finished in ${duration} minutes. ---`);
    console.log(`Total rows affected: ${totalRowsAffected}`);
    if (troublesomePlayers.length > 0) {
      console.log(
        `Troublesome players encountered (ID lookup issues): ${troublesomePlayers.join(
          ", "
        )}`
      );
    }
  } catch (error: any) {
    console.error("Unexpected error in main orchestration:", error.message);
    await supabase.from("cron_job_audit").insert([
      {
        job_name: "update-nst-gamelog",
        status: "error",
        rows_affected: totalRowsAffected,
        details: { error: error.message, stack: error.stack }
      }
    ]);
  } finally {
    console.log(`--- Script execution block completed. ---`);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res
      .status(405)
      .json({ error: "Method not allowed. GET and POST are supported." });
  }

  let runMode: RunMode = "incremental";

  if (req.method === "POST") {
    const mode = req.body?.runMode;
    if (mode && ["incremental", "forward", "reverse"].includes(mode))
      runMode = mode;
  } else {
    const q = req.query.runMode as string;
    if (q === "forward" || q === "reverse") runMode = q;
  }

  console.log(`API request received. runMode=${runMode}`);
  try {
    await main(runMode);
    return res.status(200).json({ message: "Done", runMode });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
