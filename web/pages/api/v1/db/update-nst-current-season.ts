// pages/api/v1/db/update-nst-current-season.ts

import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import * as cheerio from "cheerio";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
// Assuming utils/fetchCurrentSeason is directly under 'pages' or project root
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import type { Element } from "domhandler";

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
// NST Rate Limits: 40/min, 80/5min, 100/15min, 180/hr
const PLAYER_MAP_VIEW = "view_active_player_ids_max_season";
const BASE_URL_ALL_PLAYERS = "https://www.naturalstattrick.com/playerteams.php";

// Define target table names
const TABLE_INDIVIDUAL_COUNTS = "nst_seasonal_individual_counts";
const TABLE_INDIVIDUAL_RATES = "nst_seasonal_individual_rates";
const TABLE_ON_ICE_COUNTS = "nst_seasonal_on_ice_counts";
const TABLE_ON_ICE_RATES = "nst_seasonal_on_ice_rates";

// Enum for report types
enum ReportType {
  IndividualCounts,
  IndividualRates,
  OnIceCounts,
  OnIceRates
}

// --- Helper Functions ---

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Header Mappers (assuming unchanged from previous version) ---
function mapAllPlayersIndividualHeader(header: string): string | null {
  const headerMap: Record<string, string> = {
    GP: "gp",
    TOI: "toi",
    Goals: "goals",
    "Total Assists": "total_assists",
    "First Assists": "first_assists",
    "Second Assists": "second_assists",
    "Total Points": "total_points",
    IPP: "ipp",
    Shots: "shots",
    "SH%": "sh_percentage",
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
    "TOI/GP": "toi_per_gp",
    "Goals/60": "goals_per_60",
    "Total Assists/60": "total_assists_per_60",
    "First Assists/60": "first_assists_per_60",
    "Second Assists/60": "second_assists_per_60",
    "Total Points/60": "total_points_per_60",
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
    "Faceoffs Lost/60": "faceoffs_lost_per_60"
  };
  if (["Player", "Team", "Position"].includes(header)) return null;
  const mapped = headerMap[header];
  return mapped || null;
}
function mapAllPlayersOnIceHeader(header: string): string | null {
  const headerMap: Record<string, string> = {
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
    "xGF%": "xgf_pct",
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
    "On-Ice SH%": "on_ice_sh_pct",
    "On-Ice SV%": "on_ice_sv_pct",
    PDO: "pdo",
    "Off. Zone Starts": "off_zone_starts",
    "Neu. Zone Starts": "neu_zone_starts",
    "Def. Zone Starts": "def_zone_starts",
    "On The Fly Starts": "on_the_fly_starts",
    "Off. Zone Start %": "off_zone_start_pct",
    "Off. Zone Faceoffs": "off_zone_faceoffs",
    "Neu. Zone Faceoffs": "neu_zone_faceoffs",
    "Def. Zone Faceoffs": "def_zone_faceoffs",
    "Off. Zone Faceoff %": "off_zone_faceoff_pct",
    "TOI/GP": "toi_per_gp",
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
    "HDCF/60": "hdcf_per_60",
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
    "Off. Zone Starts/60": "off_zone_starts_per_60",
    "Neu. Zone Starts/60": "neu_zone_starts_per_60",
    "Def. Zone Starts/60": "def_zone_starts_per_60",
    "On The Fly Starts/60": "on_the_fly_starts_per_60",
    "Off. Zone Faceoffs/60": "off_zone_faceoffs_per_60",
    "Neu. Zone Faceoffs/60": "neu_zone_faceoffs_per_60",
    "Def. Zone Faceoffs/60": "def_zone_faceoffs_per_60",
    "Off. Zone Starts": "off_zone_starts",
    "Neu. Zone Starts": "neu_zone_starts",
    "Def. Zone Starts": "def_zone_starts",
    "On The Fly Starts": "on_the_fly_starts",
    "Off. Zone Start %": "off_zone_start_pct",
    "Off. Zone Faceoffs": "off_zone_faceoffs",
    "Neu. Zone Faceoffs": "neu_zone_faceoffs",
    "Def. Zone Faceoffs": "def_zone_faceoffs",
    "Off. Zone Faceoff %": "off_zone_faceoff_pct",
    "Off. Zone Starts/60": "off_zone_starts_per_60",
    "Neu. Zone Starts/60": "neu_zone_starts_per_60",
    "Def. Zone Starts/60": "def_zone_starts_per_60",
    "On The Fly Starts/60": "on_the_fly_starts_per_60",
    "Off. Zone Faceoffs/60": "off_zone_faceoffs_per_60",
    "Neu. Zone Faceoffs/60": "neu_zone_faceoffs_per_60",
    "Def. Zone Faceoffs/60": "def_zone_faceoffs_per_60"
  };
  if (["Player", "Team", "Position"].includes(header)) return null;
  const mapped = headerMap[header];
  return mapped || null;
}
function getTableNameFromReportType(reportType: ReportType): string {
  switch (reportType) {
    case ReportType.IndividualCounts:
      return TABLE_INDIVIDUAL_COUNTS;
    case ReportType.IndividualRates:
      return TABLE_INDIVIDUAL_RATES;
    case ReportType.OnIceCounts:
      return TABLE_ON_ICE_COUNTS;
    case ReportType.OnIceRates:
      return TABLE_ON_ICE_RATES;
    default:
      throw new Error("Invalid ReportType specified");
  }
}
function getHeaderMapper(
  reportType: ReportType
): (header: string) => string | null {
  switch (reportType) {
    case ReportType.IndividualCounts:
    case ReportType.IndividualRates:
      return mapAllPlayersIndividualHeader;
    case ReportType.OnIceCounts:
    case ReportType.OnIceRates:
      return mapAllPlayersOnIceHeader;
    default:
      throw new Error("Invalid ReportType specified for header mapping");
  }
}

/**
 * Fetches player names and IDs from the specified view.
 */
async function fetchPlayerNameIdMap(): Promise<Map<string, number>> {
  const playerMap = new Map<string, number>();
  let offset = 0;
  const BATCH_SIZE = 1000;
  let hasMore = true;
  console.log(
    `Workspaceing player name-ID map from view '${PLAYER_MAP_VIEW}'...`
  );
  while (hasMore) {
    const { data, error, count } = await supabase
      .from(PLAYER_MAP_VIEW)
      .select("player_name, player_id", { count: "exact" })
      .range(offset, offset + BATCH_SIZE - 1);
    if (error) {
      console.error(
        `Error fetching from view ${PLAYER_MAP_VIEW}:`,
        error.message
      );
      throw error;
    }
    if (data && data.length > 0) {
      data.forEach((row) => {
        if (row.player_name && row.player_id != null) {
          playerMap.set(String(row.player_name).trim(), Number(row.player_id));
        } else {
          /* console.warn("Skipping row with missing name or ID:", row); */
        }
      });
      offset += data.length;
    } else {
      hasMore = false;
    }
    if (count !== null && offset >= count) {
      hasMore = false;
    }
    if (hasMore) await delay(200);
  }
  console.log(
    `Finished fetching. Player Name -> ID Map contains ${playerMap.size} entries.`
  );
  return playerMap;
}

/**
 * Constructs the URL for the "All Players" report.
 */
function constructAllPlayersUrl(
  reportType: ReportType,
  seasonId: string,
  strengthSit: string
): string {
  const isRate =
    reportType === ReportType.IndividualRates ||
    reportType === ReportType.OnIceRates;
  const isIndividual =
    reportType === ReportType.IndividualCounts ||
    reportType === ReportType.IndividualRates;
  const rateParam = isRate ? "y" : "n";
  const stdoiParam = isIndividual ? "std" : "oi";
  const params = new URLSearchParams({
    fromseason: seasonId,
    thruseason: seasonId,
    stype: "2",
    sit: strengthSit,
    score: "all",
    stdoi: stdoiParam,
    rate: rateParam,
    team: "ALL",
    pos: "S",
    loc: "B",
    toi: "0",
    gpfilt: "none",
    fd: "",
    td: "",
    tgp: "410",
    lines: "single",
    draftteam: "ALL"
  });
  return `${BASE_URL_ALL_PLAYERS}?${params.toString()}`;
}

/**
 * Fetches and parses data from an "All Players" report URL.
 */
async function fetchAndParseAllPlayersData(
  url: string,
  reportType: ReportType,
  seasonId: string,
  strength: string,
  playerMap: Map<string, number>,
  retries: number = 3
): Promise<any[]> {
  const headerMapper = getHeaderMapper(reportType);
  const tableName = getTableNameFromReportType(reportType);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(
        `fetching data for ${ReportType[reportType]} (Strength: ${strength}, Season: ${seasonId}) - Attempt ${attempt}`
      );
      const response = await axios.get(url, { timeout: 60000 });
      if (!response.data) {
        console.warn(`Attempt ${attempt}: No data received from URL: ${url}`);
        if (attempt === retries) return [];
        await delay(2000 * (attempt + 1));
        continue;
      }
      const $ = cheerio.load(response.data);
      const table = $("div#allplayers_length ~ table");
      let dataTable: cheerio.Cheerio<Element>;
      if (table.length > 0) {
        dataTable =
          table.first(); /* console.log("Found table using selector 'div#allplayers_length ~ table'."); */
      } else {
        console.warn(
          "Selector 'div#allplayers_length ~ table' failed. Falling back to 'table:has(tbody)'."
        );
        const fallbackTable = $("table:has(tbody)");
        if (fallbackTable.length === 0) {
          console.error(
            `Attempt ${attempt}: Could not find any data table with tbody at URL: ${url}`
          );
          if (attempt === retries) return [];
          await delay(2000 * (attempt + 1));
          continue;
        }
        if (fallbackTable.length > 1) {
          console.warn(
            `Fallback selector found ${fallbackTable.length} tables. Using the first.`
          );
        }
        dataTable = fallbackTable.first();
      }
      const headers: string[] = [];
      dataTable.find("thead tr th").each((_, th) => {
        const headerText = $(th)
          .text()
          .replace(/\u00a0/g, " ")
          .trim();
        headers.push(headerText);
      });
      const mappedHeaders = headers.map(headerMapper);
      const dataRowsCollected: any[] = [];
      dataTable.find("tbody tr").each((_, tr) => {
        const $row = $(tr);
        if ($row.find("th").length > 0) {
          /* console.log("Skipping potential header row within tbody."); */ return;
        }
        if (
          $row.hasClass("total") ||
          $row.hasClass("average") ||
          $row.find("td").length === 0
        ) {
          return;
        }
        const rowData: any = {};
        let playerName: string | null = null;
        let team: string | null = null;
        let position: string | null = null;
        $row.find("td").each((i, td) => {
          const cellText = $(td)
            .text()
            .replace(/\u00a0/g, " ")
            .trim();
          const originalHeader = headers[i];
          if (originalHeader === undefined) {
            return;
          }
          if (originalHeader === "Player") {
            playerName = cellText;
            return;
          }
          if (originalHeader === "Team") {
            team = cellText || "N/A";
            return;
          }
          if (originalHeader === "Position") {
            position = cellText || "N/A";
            return;
          }
          const column = mappedHeaders[i];
          if (column) {
            if (cellText === "-" || cellText === "" || cellText === "\\-") {
              rowData[column] = null;
            } else {
              let cleanedText = cellText.replace(/,/g, "");
              if (
                column.endsWith("_pct") ||
                column.endsWith("_percentage") ||
                column === "pdo" ||
                column === "sh_percentage"
              ) {
                cleanedText = cleanedText.replace(/%/, "");
              }
              const num = Number(cleanedText);
              rowData[column] = isNaN(num)
                ? null
                : num; /* if (isNaN(num)) { console.log(`Warning: Failed to convert "${cellText}" to number for column "${column}". Storing null.`); } */
            }
          }
        });
        if (playerName && team && position) {
          const trimmedPlayerName = (playerName as string).trim();
          const playerId = playerMap.get(trimmedPlayerName);
          if (playerId !== undefined) {
            rowData["player_id"] = playerId;
            rowData["season"] = parseInt(seasonId, 10);
            rowData["team"] = team;
            rowData["strength"] = strength;
            if (
              rowData["player_id"] != null &&
              rowData["season"] != null &&
              rowData["team"] != null &&
              rowData["strength"] != null
            ) {
              dataRowsCollected.push(rowData);
            } else {
              console.warn(
                `Skipping row due to null key field after processing: Player "${trimmedPlayerName}", Team "${team}", Pos "${position}"`
              );
            }
          }
        }
      });
      console.log(
        `Parsed ${dataRowsCollected.length} valid player rows from ${ReportType[reportType]} (Strength: ${strength}, Season: ${seasonId}).`
      );
      return dataRowsCollected;
    } catch (error: any) {
      console.error(
        `Attempt ${attempt} - Error fetching/parsing ${ReportType[reportType]} from ${url}:`,
        error.message
      );
      if (attempt === retries) {
        console.error(
          `Failed to process ${ReportType[reportType]} from ${url} after ${retries} attempts.`
        );
        return [];
      }
      await delay(2000 * (attempt + 1));
    }
  }
  return [];
}

/**
 * Upserts parsed data into the appropriate Supabase table.
 */
async function upsertData(tableName: string, dataRows: any[]): Promise<number> {
  if (!dataRows || dataRows.length === 0) {
    return 0;
  }
  const validRows = dataRows.filter(
    (row) =>
      row.player_id != null &&
      row.season != null &&
      row.team != null &&
      row.strength != null
  );
  if (validRows.length !== dataRows.length) {
    console.warn(
      `Filtered out ${
        dataRows.length - validRows.length
      } rows with null key identifiers just before upserting to ${tableName}.`
    );
  }
  if (validRows.length === 0) {
    console.log(`No valid rows remaining to upsert into ${tableName}.`);
    return 0;
  }
  const BATCH_SIZE = 500;
  let totalUpsertedCount = 0;
  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const batch = validRows.slice(i, i + BATCH_SIZE);
    console.log(
      `Upserting batch of ${batch.length} rows to ${tableName} (starting index ${i})...`
    );
    const { error, count } = await supabase.from(tableName).upsert(batch, {
      onConflict: "player_id, season, team, strength",
      count: "exact"
    });
    if (error) {
      console.error(
        `Error upserting batch to ${tableName} (starting index ${i}):`,
        error.details || error.message
      );
      if (batch.length > 0) {
        console.error(
          "First row of failing batch:",
          JSON.stringify(batch[0], null, 2)
        );
      }
      throw new Error(
        `Failed to upsert batch to ${tableName}. See logs for details.`
      );
    } else {
      const currentBatchCount = count ?? batch.length;
      totalUpsertedCount += currentBatchCount;
      console.log(
        `Successfully upserted batch to ${tableName}. Batch count: ${currentBatchCount}. Total so far: ${totalUpsertedCount}.`
      );
    }
  }
  console.log(
    `Finished upserting ${totalUpsertedCount} total rows to "${tableName}".`
  );
  return totalUpsertedCount;
}

// --- Main Execution Function ---
async function main() {
  console.log("Starting NST All Players Seasonal Update Script...");
  const startTime = Date.now(); // Timer start
  let grandTotalRowsUpserted = 0;
  try {
    // 1. Get Current Season ID (Unchanged)
    let currentSeasonId: string;
    try {
      const seasonInfo = await fetchCurrentSeason();
      let seasonIdAsString: string | null = null;
      if (seasonInfo && seasonInfo.id != null) {
        seasonIdAsString = String(seasonInfo.id);
      }
      if (!seasonIdAsString || !/^\d{8}$/.test(seasonIdAsString)) {
        throw new Error(
          `Invalid season ID format after fetch: ${seasonIdAsString}`
        );
      }
      currentSeasonId = seasonIdAsString;
    } catch (seasonError: any) {
      const year = new Date().getFullYear();
      const currentMonth = new Date().getMonth();
      const startYear = currentMonth < 7 ? year - 1 : year;
      const endYear = startYear + 1;
      currentSeasonId = `${startYear}${endYear}`;
      console.warn(
        `Could not fetch current season dynamically: ${seasonError.message}. Falling back to season ${currentSeasonId}.`
      );
    }
    console.log(`Targeting current season: ${currentSeasonId}`);

    // 2. Fetch Player Name -> ID Map (Unchanged)
    const playerMap = await fetchPlayerNameIdMap();
    if (playerMap.size === 0) {
      console.error("Player Name -> ID map is empty. Cannot proceed.");
      return;
    }

    // 3. Define Reports and Strengths to Process
    const reportsToProcess = [
      ReportType.IndividualCounts,
      ReportType.IndividualRates,
      ReportType.OnIceCounts,
      ReportType.OnIceRates
    ];
    const strengthsToProcess = ["all"]; // Now only contains "all"

    // 4. Loop through reports and strengths (Outer loop now runs only once)
    for (const strength of strengthsToProcess) {
      // Loop executes 1 time (strength = "all")
      for (const reportType of reportsToProcess) {
        // Loop executes 4 times
        const targetTable = getTableNameFromReportType(reportType);
        console.log(
          `\n--- Processing: ${ReportType[reportType]} | Strength: ${strength} | Season: ${currentSeasonId} ---`
        );

        // Construct URL using the updated function
        const url = constructAllPlayersUrl(
          reportType,
          currentSeasonId,
          strength
        );

        // Fetch and Parse Data
        const parsedData = await fetchAndParseAllPlayersData(
          url,
          reportType,
          currentSeasonId,
          strength,
          playerMap
        );

        // Upsert Data
        if (parsedData.length > 0) {
          const upsertedCount = await upsertData(targetTable, parsedData);
          grandTotalRowsUpserted += upsertedCount;
          console.log(`Finished Upsert for ${ReportType[reportType]}.`);
        } else {
          console.log(
            `No valid data parsed for ${ReportType[reportType]} / ${strength}. Skipping upsert.`
          );
        }

        // *** REMOVED DELAY ***
        // console.log(`Waiting ${REQUEST_INTERVAL_MS / 1000}s before next request...`);
        // await delay(REQUEST_INTERVAL_MS);
      } // End report type loop (4 iterations)
    } // End strength loop (1 iteration)

    const endTime = Date.now(); // Timer end
    const durationSeconds = (endTime - startTime) / 1000;
    console.log("\n--- SCRIPT FINISHED ---");
    console.log(`Total execution time: ${durationSeconds.toFixed(2)} seconds`);
    console.log(
      `Grand total rows successfully upserted (all strengths): ${grandTotalRowsUpserted}`
    );
  } catch (error: any) {
    console.error("\n--- SCRIPT FAILED ---");
    console.error("Error in main execution:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
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
