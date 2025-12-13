// pages/api/v1/db/update-nst-player-reports.ts

// TO DO:
// CREATE A VIEW FOR ACTIVE GOALIE IDS
// CREATE SPECIAL GOALIE HEADER MAPPINGS
// FIGURE OUT HOW I CAN GET ONLY THE MOST RECENT OR CURRENT SEASON STD TOTALS FROM NST
// Create a table that fetches each season, then the total from wgo_skater_stats_totals??

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import * as cheerio from "cheerio";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import type { Element } from "domhandler";
import { format as tzFormat, toZonedTime } from "date-fns-tz";

dotenv.config({ path: "./../../../.env.local" });

// --- Supabase Setup ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Service Role Key is missing.");
  process.exit(1);
}
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// --- Constants ---
const REQUEST_INTERVAL_MS = 5000; // Delay between processing each player (5 seconds)
const PLAYER_FETCH_BATCH_SIZE = 1000; // Supabase fetch limit
const BASE_URL = "https://www.naturalstattrick.com/playerreport.php";

// Define target table names
const TABLE_INDIVIDUAL_COUNTS = "nst_seasonal_individual_counts";
const TABLE_INDIVIDUAL_RATES = "nst_seasonal_individual_rates";
const TABLE_ON_ICE_COUNTS = "nst_seasonal_on_ice_counts";
const TABLE_ON_ICE_RATES = "nst_seasonal_on_ice_rates";

// --- Helper Functions ---

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Maps headers from the "Individual" table to database columns.
 * Handles BOTH Counts (rate=n) and Rates (rate=y) headers.
 */
function mapIndividualHeaderToColumn(header: string): string | null {
  const headerMap: Record<string, string> = {
    // --- Counts Headers (rate=n) ---
    GP: "gp",
    TOI: "toi",
    Goals: "goals",
    "Total Assists": "total_assists",
    "First Assists": "first_assists",
    "Second Assists": "second_assists",
    "Total Points": "total_points",
    IPP: "ipp",
    Shots: "shots",
    "S%": "sh_percentage",
    ixG: "ixg",
    iCF: "icf",
    iFF: "iff",
    iSCF: "iscfs",
    iHDCF: "ihdcf",
    "Rebounds Created": "rebounds_created",
    PIM: "pim",
    "Total Penalties": "total_penalties",
    Minor: "minor_penalties",
    Major: "major_penalties",
    Misconduct: "misconduct_penalties",
    "Penalties Drawn": "penalties_drawn",
    Giveaways: "giveaways",
    Takeaways: "takeaways",
    Hits: "hits",
    "Hits Taken": "hits_taken",
    "Shots Blocked": "shots_blocked",
    "Faceoffs Won": "faceoffs_won",
    "Faceoffs Lost": "faceoffs_lost",
    "Faceoffs %": "faceoffs_percentage",

    // --- Rate Headers (rate=y) ---
    "TOI/GP": "toi_per_gp",
    "Goals/60": "goals_per_60",
    "Total Assists/60": "total_assists_per_60",
    "First Assists/60": "first_assists_per_60",
    "Second Assists/60": "second_assists_per_60",
    "Total Points/60": "total_points_per_60",
    // IPP is the same for counts and rates
    "Shots/60": "shots_per_60",
    "ixG/60": "ixg_per_60",
    "iCF/60": "icf_per_60",
    "iFF/60": "iff_per_60",
    "iSCF/60": "iscfs_per_60",
    "iHDCF/60": "ihdcf_per_60",
    "Rebounds Created/60": "rebounds_created_per_60",
    "PIM/60": "pim_per_60",
    "Total Penalties/60": "total_penalties_per_60",
    "Minor/60": "minor_penalties_per_60",
    "Major/60": "major_penalties_per_60",
    "Misconduct/60": "misconduct_penalties_per_60",
    "Penalties Drawn/60": "penalties_drawn_per_60",
    "Giveaways/60": "giveaways_per_60",
    "Takeaways/60": "takeaways_per_60",
    "Hits/60": "hits_per_60",
    "Hits Taken/60": "hits_taken_per_60",
    "Shots Blocked/60": "shots_blocked_per_60",
    "Faceoffs Won/60": "faceoffs_won_per_60",
    "Faceoffs Lost/60": "faceoffs_lost_per_60",
    "On The Fly Starts/60": "on_the_fly_starts_per_60"
  };
  // Ignore these headers explicitly as they are handled separately
  if (["Season", "Team"].includes(header)) return null;

  const mapped = headerMap[header];
  if (!mapped && !["Season", "Team"].includes(header)) {
    // Avoid warning for Season/Team
    console.warn(`Unmapped Individual header: "${header}"`);
  }
  return mapped || null;
}

/**
 * Maps headers from the "On-Ice" table to database columns.
 * Handles BOTH Counts (rate=n) and Rates (rate=y) headers.
 */
function mapOnIceHeaderToColumn(header: string): string | null {
  const headerMap: Record<string, string> = {
    // --- Counts Headers (rate=n) ---
    GP: "gp",
    TOI: "toi",
    CF: "cf",
    CA: "ca",
    "CF%": "cf_pct",
    FF: "ff",
    FA: "fa",
    "FF%": "ff_pct",
    SF: "sf",
    SA: "sa",
    "SF%": "sf_pct",
    GF: "gf",
    GA: "ga",
    "GF%": "gf_pct",
    xGF: "xgf",
    xGA: "xga",
    "xG%": "xgf_pct",
    SCF: "scf",
    SCA: "sca",
    "SCF%": "scf_pct",
    HDCF: "hdcf",
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
    // These might be the hidden ones causing shifts
    "On-Ice SH%": "on_ice_sh_pct", // Check exact spelling/spacing on site
    "On-Ice SV%": "on_ice_sv_pct", // Check exact spelling/spacing on site
    PDO: "pdo", // Check exact spelling/spacing on site
    "Off. Zone Starts": "off_zone_starts", // Original mapping
    "Neu. Zone Starts": "neu_zone_starts", // Original mapping
    "Def. Zone Starts": "def_zone_starts", // Original mapping
    "On The Fly Starts": "on_the_fly_starts", // Original mapping
    "Off. Zone Start %": "off_zone_start_pct", // Original mapping
    "Off. Zone Faceoffs": "off_zone_faceoffs", // Original mapping
    "Neu. Zone Faceoffs": "neu_zone_faceoffs", // Original mapping
    "Def. Zone Faceoffs": "def_zone_faceoffs", // Original mapping
    "Off. Zone Faceoff %": "off_zone_faceoff_pct", // Original mapping
    "On The Fly Starts": "on_the_fly_starts",
    "Off. Zone Starts": "off_zone_starts",
    "Neu. Zone Starts": "neu_zone_starts",
    "Def. Zone Starts": "def_zone_starts",
    "Off. Zone Start %": "off_zone_start_pct",
    "Off. Zone Faceoffs": "off_zone_faceoffs",
    "Neu. Zone Faceoffs": "neu_zone_faceoffs",
    "Def. Zone Faceoffs": "def_zone_faceoffs",
    "Off. Zone Faceoff %": "off_zone_faceoff_pct",

    // --- Rate Headers (rate=y) ---
    "TOI/GP": "toi_per_gp",
    "CF/60": "cf_per_60",
    "CA/60": "ca_per_60",
    // CF% is often the same
    "FF/60": "ff_per_60",
    "FA/60": "fa_per_60",
    // FF% is often the same
    "SF/60": "sf_per_60",
    "SA/60": "sa_per_60",
    // SF% is often the same
    "GF/60": "gf_per_60",
    "GA/60": "ga_per_60",
    // GF% is often the same
    "xGF/60": "xgf_per_60",
    "xGA/60": "xga_per_60",
    // xG% is often the same
    "SCF/60": "scf_per_60",
    "SCA/60": "sca_per_60",
    // SCF% is often the same
    "HDCF/60": "hdcf_per_60",
    "HDCA/60": "hdca_per_60",
    // HDCF% is often the same
    "HDGF/60": "hdgf_per_60",
    "HDGA/60": "hdga_per_60",
    // HDGF% is often the same
    "MDCF/60": "mdcf_per_60",
    "MDCA/60": "mdca_per_60",
    // MDCF% is often the same
    "MDGF/60": "mdgf_per_60",
    "MDGA/60": "mdga_per_60",
    // MDGF% is often the same
    "LDCF/60": "ldcf_per_60",
    "LDCA/60": "ldca_per_60",
    // LDCF% is often the same
    "LDGF/60": "ldgf_per_60",
    "LDGA/60": "ldga_per_60",

    // Off. Zone Faceoff % is often the same
    "Off. Zone Starts/60": "off_zone_starts_per_60", // Original
    "Neu. Zone Starts/60": "neu_zone_starts_per_60", // Original
    "Def. Zone Starts/60": "def_zone_starts_per_60", // Original
    "On The Fly Starts/60": "on_the_fly_starts_per_60", // Original
    "Off. Zone Faceoffs/60": "off_zone_faceoffs_per_60", // Original
    "Neu. Zone Faceoffs/60": "neu_zone_faceoffs_per_60", // Original
    "Def. Zone Faceoffs/60": "def_zone_faceoffs_per_60", // Original

    "Off. Zone Starts/60": "off_zone_starts_per_60",
    "Neu. Zone Starts/60": "neu_zone_starts_per_60",
    "Def. Zone Starts/60": "def_zone_starts_per_60",
    // // Off. Zone Start % is often the same
    "On The Fly Starts/60": "on_the_fly_starts_per_60", //
    "Off. Zone Faceoffs/60": "off_zone_faceoffs_per_60",
    "Neu. Zone Faceoffs/60": "neu_zone_faceoffs_per_60",
    "Def. Zone Faceoffs/60": "def_zone_faceoffs_per_60"
    // Off. Zone Faceoff % is often the same
  };

  // Ignore these headers explicitly as they are handled separately by name
  if (["Season", "Team"].includes(header)) return null;

  const mapped = headerMap[header];
  if (!mapped && !["Season", "Team"].includes(header)) {
    // Avoid warning for Season/Team, but warn for others
    console.warn(`Unmapped On-Ice header encountered: "${header}"`); // Keep this warning
  }
  return mapped || null;
}

/**
 * Gets the target table name based on dataset type (individual/on-ice) and rate (counts/rates).
 */
function getTableName(isIndividual: boolean, isRate: boolean): string {
  if (isIndividual) {
    return isRate ? TABLE_INDIVIDUAL_RATES : TABLE_INDIVIDUAL_COUNTS;
  } else {
    return isRate ? TABLE_ON_ICE_RATES : TABLE_ON_ICE_COUNTS;
  }
}

function printInfoBlock(params: {
  playerId: number;
  url: string;
  targetTable: string;
  strength: string;
  playerCount: { current: number; total: number };
  rowsProcessed: number;
  rowsUpserted: number;
}) {
  const {
    playerId,
    url,
    targetTable,
    strength,
    playerCount,
    rowsProcessed,
    rowsUpserted
  } = params;
  console.log(`
|--------------------------|
Player ID: ${playerId}
Player Progress: ${playerCount.current} / ${playerCount.total}
URL: ${url}
Strength: ${strength.toUpperCase()}
Target Table: ${targetTable}
Rows Parsed: ${rowsProcessed}
Rows Upserted: ${rowsUpserted}
|--------------------------|
`);
}

function printTotalProgress(current: number, total: number) {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  const filled = Math.floor((percentage / 100) * 20);
  const bar = "|" + "=".repeat(filled) + "-".repeat(20 - filled) + "|";
  console.log(
    `Total Player Processing Progress: ${percentage.toFixed(2)}% Complete`
  );
  console.log(`${bar}  (${current}/${total} Players)`);
}
// --- REVISED FUNCTION: Fetch Active Player IDs from VIEW ---

/**
 * Fetches unique player IDs from the 'view_active_player_ids' database view
 * using pagination.
 */
async function fetchActivePlayerIds(): Promise<number[]> {
  // Note: No longer needs currentSeasonId as input
  const playerIds: number[] = [];
  let offset = 0;
  let hasMore = true;
  const VIEW_NAME = "view_active_player_ids_max_season";

  console.log(
    `Fetching active player IDs from database view '${VIEW_NAME}'...`
  );

  while (hasMore) {
    // Query the VIEW directly
    const { data, error, count } = await supabase
      .from(VIEW_NAME)
      .select("player_id", { count: "exact" }) // Select the player_id column, get total count
      .range(offset, offset + PLAYER_FETCH_BATCH_SIZE - 1);

    if (error) {
      console.error(`Error fetching from view ${VIEW_NAME}:`, error.message);
      throw error; // Stop execution on error
    }

    if (data && data.length > 0) {
      // Add player_ids from this batch
      playerIds.push(...data.map((row) => row.player_id));
      offset += data.length;
      console.log(
        `Fetched batch of ${data.length} player IDs from view. Total fetched: ${playerIds.length}`
      );
    } else {
      // No more data
      hasMore = false;
    }

    // Stop if we've fetched all rows indicated by the count
    if (count !== null && offset >= count) {
      hasMore = false;
    }

    // Small delay between batches if necessary
    if (hasMore) await delay(200);
  }

  // No need for Set deduplication here, the VIEW handles DISTINCT
  console.log(
    `Finished fetching. Total unique Player IDs from view: ${playerIds.length}`
  );
  return playerIds;
}

/**
 * Constructs the URL for a specific player, season, strength, and rate.
 */
function constructUrlForPlayer(
  playerId: number,
  seasonId: string,
  strengthSit: string,
  isRate: boolean
): string {
  const rateParam = isRate ? "y" : "n";
  // stdoi=std seems constant based on example
  // v=p means player view
  return `${BASE_URL}?fromseason=${seasonId}&thruseason=${seasonId}&stype=2&sit=${strengthSit}&stdoi=std&rate=${rateParam}&v=p&playerid=${playerId}`;
}

/**
 * Fetches and parses data from the player report URL.
 * Extracts data from BOTH "Individual" and "On-Ice" tables found on the page.
 */
async function fetchAndParsePlayerData(
  url: string,
  playerId: number,
  seasonId: string,
  strength: string, // e.g., '5v5', 'pp', 'as', 'pk', 'es'
  isRate: boolean,
  retries: number = 3
): Promise<{ individualData: any[]; onIceData: any[] }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // console.log(`Fetching data for Player ${playerId}, Strength ${strength}, Rate ${isRate ? 'Y':'N'} (Attempt ${attempt})`);
      const response = await axios.get(url, { timeout: 30000 }); // Increased timeout
      if (!response.data) {
        console.warn(`No data received from URL: ${url}`);
        return { individualData: [], onIceData: [] };
      }

      const $ = cheerio.load(response.data);
      const tables = $("table"); // Expecting two tables

      if (tables.length < 2) {
        // It's possible a player has *zero* data for a specific strength/rate combo
        // console.warn(`Expected 2 tables, found ${tables.length} for URL: ${url}. Player might have no data for this scenario.`);
        return { individualData: [], onIceData: [] };
      }

      const individualTable = tables.eq(0); // first table is Individual
      const onIceTable = tables.eq(1); // second is On-Ice

      const individualData = parseTableData(
        $,
        individualTable,
        mapIndividualHeaderToColumn,
        playerId,
        strength,
        isRate // Pass isRate to determine target table later
      );
      const onIceData = parseTableData(
        $,
        onIceTable,
        mapOnIceHeaderToColumn,
        playerId,
        strength,
        isRate // Pass isRate to determine target table later
      );

      // console.log(`Parsed ${individualData.length} Individual rows, ${onIceData.length} On-Ice rows.`);
      return { individualData, onIceData };
    } catch (error: any) {
      console.error(
        `Attempt ${attempt} - Error fetching/parsing data for Player ${playerId} from ${url}:`,
        error.message
      );
      if (attempt === retries) {
        console.error(
          `Failed to process Player ${playerId} from ${url} after ${retries} attempts.`
        );
        return { individualData: [], onIceData: [] }; // Return empty on final failure
      }
      await delay(7000); // Longer delay on error
    }
  }
  return { individualData: [], onIceData: [] }; // Should not be reached, but satisfies TS
}

/**
 * Generic function to parse a Cheerio table element.
 */
// --- REVISED parseTableData function with corrected header selector ---
function parseTableData(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio<Element>,
  headerMapper: (header: string) => string | null,
  playerId: number,
  strength: string,
  isRate: boolean
): any[] {
  const headers: string[] = [];

  // *** THE FIX IS HERE: Select BOTH <th> and <td> within <thead> ***
  table.find("thead th, thead td").each((_, headerElement) => {
    const headerText = $(headerElement).text().trim();
    if (headerText) {
      headers.push(headerText);
    }
  });
  // *** END FIX ***

  // Get the number of cells in the first data row for comparison
  const firstDataRow = table.find("tbody tr:first-child");
  const cellCount = firstDataRow.find("td").length;

  // *** START DEBUG LOGGING - Specifically for On-Ice Tables ***
  const isDebuggingOnIce = headerMapper === mapOnIceHeaderToColumn;

  if (isDebuggingOnIce) {
    console.log(`\n--- Debug: Parsing On-Ice Table ---`);
    console.log(
      `Player ID: ${playerId}, Strength: ${strength}, Rate: ${
        isRate ? "Y" : "N"
      }`
    );
    // Use the corrected selector for logging now too
    console.log("Headers Found by Cheerio (`thead th, thead td`):");
    console.log(JSON.stringify(headers, null, 2));
    console.log(`Total Headers Found: ${headers.length}`);
    console.log(`Data Cells (<td>) Found in First Row: ${cellCount}`);

    if (headers.length !== cellCount && cellCount > 0) {
      console.warn(
        `*** MISMATCH DETECTED: Header count (${headers.length}) does not match cell count (${cellCount}) ***`
      );
      console.log("This likely causes the column shift issue.");
      const firstCellsText = firstDataRow
        .find("td")
        .slice(0, 10)
        .map((_, td) => `"${$(td).text().trim()}"`)
        .get();
      console.log(`First ~10 Cell Texts: [${firstCellsText.join(", ")}]`);
    } else if (cellCount === 0) {
      console.log("No data rows found in the table body.");
    } else {
      // SUCCESS CASE!
      console.log(
        "Header count matches cell count. Alignment should now be correct."
      );
    }
    console.log(`-------------------------------------\n`);
  }
  // *** END DEBUG LOGGING ***

  const mappedHeaders = headers.map(headerMapper);
  const dataRowsCollected: any[] = [];

  table.find("tbody tr").each((rowIndex, tr) => {
    const rowData: any = {};
    let season: number | null = null;
    let team: string | null = null;
    let isValidRow = true;
    const currentRowCells = $(tr).find("td");

    currentRowCells.each((i, td) => {
      // Cell index check - This should no longer trigger warnings if the header count is now 52
      if (i >= headers.length) {
        if (isDebuggingOnIce) {
          const cellText = $(td).text().trim();
          // You shouldn't see this warning anymore if the header count is fixed
          console.warn(
            `Row ${rowIndex}, Cell Index ${i}: Found data cell ("${cellText}") but no corresponding header was detected (max header index ${
              headers.length - 1
            }). Skipping this cell.`
          );
        }
        return;
      }

      const cellText = $(td).text().trim();
      const originalHeader = headers[i]; // Now includes headers from <td> elements like "On-Ice SH%"

      if (originalHeader === "Season") {
        const seasonNum = parseInt(cellText, 10);
        if (!isNaN(seasonNum)) {
          season = seasonNum;
        } else {
          isValidRow = false;
          return false;
        }
        return;
      }
      if (originalHeader === "Team") {
        if (cellText && cellText !== "-") {
          team = cellText;
        } else {
          isValidRow = false;
          return false;
        }
        return;
      }

      // --- REGULAR HANDLING ---
      // The existing mapOnIceHeaderToColumn should correctly map "On-Ice SH%", "On-Ice SV%", "PDO" now
      const column = mappedHeaders[i];
      if (column) {
        if (cellText === "-" || cellText === "" || cellText === "\\-") {
          rowData[column] = null;
        } else {
          const cleanedText = cellText.replace(/\s+/g, " ").trim();
          const numText = cleanedText.replace(/,/g, "");
          const num = Number(numText);
          rowData[column] = isNaN(num) ? cleanedText : num;
        }
      }
    }); // End loop through cells (<td>)

    if (isValidRow && season !== null && team !== null) {
      rowData["player_id"] = playerId;
      rowData["season"] = season;
      rowData["team"] = team;
      rowData["strength"] = strength;
      dataRowsCollected.push(rowData);
    } else if (isValidRow && (season === null || team === null)) {
      // console.warn(`Row ${rowIndex} skipped for Player ${playerId}: Valid row but missing season or team after processing cells.`);
    } else if (!isValidRow) {
      // console.warn(`Row ${rowIndex} skipped for Player ${playerId}: Marked invalid during cell processing (likely bad Season/Team).`);
    }
  }); // End loop through rows (<tr>)

  return dataRowsCollected;
}

/**
 * Upserts parsed data into the appropriate Supabase table.
 */
async function upsertData(tableName: string, dataRows: any[]): Promise<number> {
  if (!dataRows || dataRows.length === 0) {
    return 0;
  }

  const { error, count } = await supabase.from(tableName).upsert(dataRows, {
    onConflict: "player_id, season, team, strength",
    count: "exact"
  });

  if (error) {
    console.error(
      `Error upserting data into ${tableName}:`,
      error.details || error.message // Keep original error
    );
    // Log the first row that might have caused the issue
    if (dataRows.length > 0) {
      console.error(
        "First potentially offending row:",
        JSON.stringify(dataRows[0], null, 2)
      );
    }
    // console.error("First few rows causing error:", JSON.stringify(dataRows.slice(0, 2), null, 2));
    return 0; // Indicate failure or no rows affected
  } else {
    // console.log(`Successfully upserted/updated data in "${tableName}". Count: ${count}`);
    return count ?? dataRows.length; // Return count if available, otherwise assume all were upserted
  }
}

/**
 * Processes all URLs for a single player, adding delays between requests.
 */
async function processPlayer(
  playerId: number,
  seasonId: string,
  playerCount: { current: number; total: number }
) {
  //   const strengths = ["5v5", "all", "ev", "pp", "pk"]; // Use 'ev' for even strength
  const strengths = ["all"]; // Use 'all' for all strengths
  const rates = [false, true]; // false = counts (rate=n), true = rates (rate=y)

  let totalRowsUpsertedForPlayer = 0;
  const PER_REQUEST_DELAY_MS = 21000; // 21 seconds to stay under 180 req/hr

  console.log(
    `--- Processing Player ID: ${playerId} (${playerCount.current}/${playerCount.total}) ---`
  );

  for (const strength of strengths) {
    for (const isRate of rates) {
      // *** ADD DELAY BEFORE EACH REQUEST ***
      console.log(
        `Waiting ${
          PER_REQUEST_DELAY_MS / 1000
        }s before next request (Player ${playerId}, Strength ${strength}, Rate ${
          isRate ? "Y" : "N"
        })...`
      );
      await delay(PER_REQUEST_DELAY_MS);

      const url = constructUrlForPlayer(playerId, seasonId, strength, isRate);
      const { individualData, onIceData } = await fetchAndParsePlayerData(
        url,
        playerId,
        seasonId,
        strength,
        isRate
      );

      // Upsert Individual Data
      const individualTable = getTableName(true, isRate);
      const individualUpsertedCount = await upsertData(
        individualTable,
        individualData
      );

      printInfoBlock({
        playerId,
        url,
        targetTable: individualTable,
        strength,
        playerCount,
        rowsProcessed: individualData.length,
        rowsUpserted: individualUpsertedCount
      });
      totalRowsUpsertedForPlayer += individualUpsertedCount;

      // Upsert On-Ice Data
      const onIceTable = getTableName(false, isRate);
      const onIceUpsertedCount = await upsertData(onIceTable, onIceData);
      printInfoBlock({
        playerId,
        url,
        targetTable: onIceTable,
        strength,
        playerCount,
        rowsProcessed: onIceData.length,
        rowsUpserted: onIceUpsertedCount
      });
      totalRowsUpsertedForPlayer += onIceUpsertedCount;

      // Optional: Small delay between strength/rate combos for the same player?
      // await delay(500);
    }
  }
  console.log(
    `--- Finished Player ID: ${playerId}. Total rows upserted for player: ${totalRowsUpsertedForPlayer} ---`
  );
}

// --- Main Execution Function ---
async function main() {
  console.log("Starting NST Player Report Update Script...");
  const startTime = Date.now();

  try {
    // 1. Get the current season ID (STILL needed for URL construction)
    let currentSeasonId: string; // Ensure this will be a string
    try {
      const seasonInfo = await fetchCurrentSeason();

      let seasonIdAsString: string | null = null;
      // Check if seasonInfo and seasonInfo.id exist and are string or number
      if (seasonInfo && seasonInfo.id !== null && seasonInfo.id !== undefined) {
        // Convert to string regardless of original type (string or number)
        seasonIdAsString = String(seasonInfo.id);
      }

      // Now validate the STRING version
      if (!seasonIdAsString || !/^\d{8}$/.test(seasonIdAsString)) {
        // If still invalid after conversion, throw error
        throw new Error(
          `Invalid or missing season ID format received from fetchCurrentSeason after conversion: ${JSON.stringify(
            seasonInfo
          )}`
        );
      }

      // Assign the validated string ID
      currentSeasonId = seasonIdAsString;
      console.log(
        `Targeting current season: ${currentSeasonId} (for URL construction)`
      );
    } catch (seasonError: any) {
      // Use today's date to determine the likely season as fallback
      currentSeasonId = "20242025";
      console.warn(
        `Could not fetch current season dynamically: ${seasonError.message}. Falling back to ${currentSeasonId}.`
      );
    }

    // 2. Fetch active player IDs using the VIEW
    const playerIds = await fetchActivePlayerIds(); // No args needed
    const totalPlayers = playerIds.length;

    if (totalPlayers === 0) {
      console.log(`No active players found via the database view. Exiting.`);
      return;
    }

    console.log(
      `Processing data for ${totalPlayers} active players found via view.`
    );

    // 3. Process each active player sequentially
    for (let i = 0; i < totalPlayers; i++) {
      const playerId = playerIds[i];
      const playerCount = { current: i + 1, total: totalPlayers };

      // Pass currentSeasonId to processPlayer (it uses it for URL construction)
      await processPlayer(playerId, currentSeasonId, playerCount);

      printTotalProgress(playerCount.current, totalPlayers);

      // Small delay between players
      const delayBetweenPlayers = 1000;
      if (i < totalPlayers - 1) {
        await delay(delayBetweenPlayers);
      }
    } // End player loop
  } catch (error: any) {
    console.error("\n--- SCRIPT FAILED ---");
  }
}

// --- API Route Handler ---
async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST" && req.method !== "GET") {
    // Allow GET for easy testing? Or POST only.
    res.setHeader("Allow", ["POST", "GET"]);
    return res
      .status(405)
      .json({ message: `Method ${req.method} Not Allowed` });
  }

  console.log(
    `API endpoint /api/v1/db/update-nst-player-reports triggered via ${req.method}.`
  );

  // Run main function asynchronously - DO NOT await here for long-running tasks in serverless env
  main().catch((err) => {
    console.error("Error running main function triggered by API:", err);
    // Log the error but don't crash the API response mechanism
  });

  // Immediately respond to the client
  res.status(202).json({
    message:
      "Player report update process initiated. Check server logs for progress."
  });
}

export default withCronJobAudit(handler);
