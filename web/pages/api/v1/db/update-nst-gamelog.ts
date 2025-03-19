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
  parse
} from "date-fns";
import { toZonedTime, format as tzFormat } from "date-fns-tz";

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Service Role Key is missing.");
  process.exit(1);
}

//

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// When more than 2 unique dates are being processed, we want a delay (30 seconds) between each URL.
const REQUEST_INTERVAL_MS = 30000; // 30 seconds

const BASE_URL = "https://www.naturalstattrick.com/playerteams.php";

// Player name mapping
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
 * Normalize a name by lowercasing, removing spaces, hyphens, apostrophes, and diacritics.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\-']/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Simple delay helper.
 */
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns an array of dates (formatted as "yyyy-MM-dd") between start and end (inclusive),
 * using the America/New_York timezone.
 */
function getDatesBetween(start: Date, end: Date): string[] {
  const dates: string[] = [];
  let current = toZonedTime(start, "America/New_York");
  const endZoned = toZonedTime(end, "America/New_York");
  while (current <= endZoned) {
    dates.push(
      tzFormat(current, "yyyy-MM-dd", { timeZone: "America/New_York" })
    );
    current = addDays(current, 1);
    current = toZonedTime(current, "America/New_York");
  }
  return dates;
}

/**
 * Maps a header string to its corresponding column name in the database.
 */
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
    "Def. Zone Starts/60": "def_zone_starts_per_60"
  };
  if (header === "Player") return null;
  return headerMap[header] || null;
}

/**
 * Retrieves the latest date from multiple tables in Supabase.
 */
async function getLatestDateSupabase(): Promise<string | null> {
  const tableNames = [
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
  let latestDate: string | null = null;
  for (const table of tableNames) {
    const { data, error } = await supabase
      .from(table)
      .select("date_scraped")
      .order("date_scraped", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) continue;
    if (data && data.date_scraped) {
      if (!latestDate || new Date(data.date_scraped) > new Date(latestDate)) {
        latestDate = data.date_scraped;
      }
    }
  }
  return latestDate;
}

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

function printTotalProgress(current: number, total: number) {
  const percentage = (current / total) * 100;
  const filled = Math.floor((percentage / 100) * 20);
  const bar = "|" + "=".repeat(filled) + "-".repeat(20 - filled) + "|";
  console.log(`Total Progress: ${percentage.toFixed(2)}% Complete`);
  console.log(`${bar}  (${current}/${total} URLs)`);
}

function getTableName(datasetType: string): string {
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
  const tableName = mapping[datasetType] || "unknown_table";
  if (tableName === "unknown_table") {
    console.warn(
      `Warning: datasetType "${datasetType}" is not mapped to a valid table.`
    );
  }
  return tableName;
}

/**
 * Fetches and parses data from the provided URL.
 * An axios timeout of 20 seconds is applied to each request.
 */
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
      const response = await axios.get(url, { timeout: 20000 });
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
          rowData["season"] = parseInt(seasonId, 10);
          dataRowsCollected.push(rowData);
        } else {
          console.warn(`Incomplete data row skipped for URL: ${url}`);
        }
      });
      console.log(
        `Parsed ${dataRowsCollected.length} raw data rows for datasetType "${datasetType}".`
      );
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
      await delay(5000);
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

/**
 * Constructs URLs for a given date and seasonId.
 */
function constructUrlsForDate(
  date: string,
  seasonId: string
): Record<string, string> {
  const fromSeason = seasonId;
  const thruSeason = seasonId;
  const commonParams = `fromseason=${fromSeason}&thruseason=${thruSeason}&stype=2&pos=S&loc=B&toi=0&gpfilt=gpdate&fd=${date}&td=${date}&lines=single&draftteam=ALL`;
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
        let tgp = rate === "n" ? "10" : "410";
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
            datasetType += "Oi";
          }
        }
        const url = `${BASE_URL}?sit=${getSitParam(
          strength
        )}&score=all&stdoi=${stdoi}&rate=${rate}&team=ALL&${commonParams}&tgp=${tgp}`;
        urls[datasetType] = url;
      }
    }
  }
  return urls;
}

/**
 * Helper function to map strength to the "sit" parameter.
 */
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

/**
 * Processes URLs grouped by date.
 *
 * - If there are 1 or 2 unique dates, then for each date group we run all URLs concurrently (via Promise.all) with no delay between dates.
 * - If there are 3 or more dates, then we process each URL sequentially (with a delay between each URL and between date groups).
 */
async function processUrls(
  urlsQueue: {
    datasetType: string;
    url: string;
    date: string;
    seasonId: string;
  }[]
) {
  // Group URLs by date.
  const urlsByDate: Record<
    string,
    { datasetType: string; url: string; seasonId: string }[]
  > = {};
  for (const item of urlsQueue) {
    if (!urlsByDate[item.date]) {
      urlsByDate[item.date] = [];
    }
    urlsByDate[item.date].push({
      datasetType: item.datasetType,
      url: item.url,
      seasonId: item.seasonId
    });
  }
  const uniqueDates = Object.keys(urlsByDate);

  // If there are 1 or 2 dates, process each date concurrently using Promise.all.
  if (uniqueDates.length <= 2) {
    console.log(`Processing concurrently for ${uniqueDates.length} date(s).`);
    await Promise.all(
      uniqueDates.map(async (date) => {
        console.log(`\n--- Processing URLs for date: ${date} ---`);
        await Promise.all(
          urlsByDate[date].map(async (item, index) => {
            console.log(`Processing [${date}] URL: ${item.datasetType}`);
            const dataExists = await checkDataExists(item.datasetType, date);
            let dataRows: any[] = [];
            let rowsUpserted = 0;
            if (!dataExists) {
              try {
                dataRows = await fetchAndParseData(
                  item.url,
                  item.datasetType,
                  date,
                  item.seasonId
                );
                if (dataRows.length > 0) {
                  await upsertData(item.datasetType, dataRows);
                  rowsUpserted = dataRows.length;
                }
              } catch (error) {
                console.error(`Error processing URL ${item.url}:`, error);
              }
            } else {
              console.log(
                `Data already exists for ${item.datasetType} on date ${date}. Skipping.`
              );
            }
            printInfoBlock({
              date,
              url: item.url,
              datasetType: item.datasetType,
              tableName: getTableName(item.datasetType),
              dateUrlCount: {
                current: index + 1,
                total: urlsByDate[date].length
              },
              totalUrlCount: { current: 0, total: urlsQueue.length },
              rowsProcessed: dataExists ? 0 : dataRows.length,
              rowsPrepared: dataExists ? 0 : dataRows.length,
              rowsUpserted: dataExists ? 0 : rowsUpserted
            });
          })
        );
      })
    );
  } else {
    // Otherwise, process each URL sequentially with delay.
    console.log(
      `Processing sequentially with delay for ${uniqueDates.length} unique dates.`
    );
    let totalProcessed = 0;
    for (const date of uniqueDates) {
      console.log(`\n--- Processing URLs for date: ${date} ---`);
      const urlsForDate = urlsByDate[date];
      for (let i = 0; i < urlsForDate.length; i++) {
        const { datasetType, url, seasonId } = urlsForDate[i];
        console.log(
          `Processing URL ${
            totalProcessed + 1
          }: ${datasetType} for date ${date}`
        );
        if (i > 0) {
          console.log(
            `Waiting ${
              REQUEST_INTERVAL_MS / 1000
            } seconds before next request...`
          );
          await delay(REQUEST_INTERVAL_MS);
        }
        const dataExists = await checkDataExists(datasetType, date);
        let dataRows: any[] = [];
        let rowsUpserted = 0;
        if (!dataExists) {
          try {
            dataRows = await fetchAndParseData(
              url,
              datasetType,
              date,
              seasonId
            );
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
        totalProcessed++;
        printInfoBlock({
          date,
          url,
          datasetType,
          tableName: getTableName(datasetType),
          dateUrlCount: { current: i + 1, total: urlsForDate.length },
          totalUrlCount: { current: totalProcessed, total: urlsQueue.length },
          rowsProcessed: dataExists ? 0 : dataRows.length,
          rowsPrepared: dataExists ? 0 : dataRows.length,
          rowsUpserted: dataExists ? 0 : rowsUpserted
        });
        printTotalProgress(totalProcessed, urlsQueue.length);
      }
      if (date !== uniqueDates[uniqueDates.length - 1]) {
        console.log(
          `Waiting ${
            REQUEST_INTERVAL_MS / 1000
          } seconds before processing next date group...`
        );
        await delay(REQUEST_INTERVAL_MS);
      }
    }
  }
}

// --- Main function ---
async function main() {
  try {
    const seasonInfo = await fetchCurrentSeason();
    const seasonId = seasonInfo.id.toString();
    const timeZone = "America/New_York";

    // Convert season start to EST.
    const seasonStartDate = toZonedTime(
      new Date(seasonInfo.startDate),
      timeZone
    );

    // Get "today" in EST.
    const todayEST = toZonedTime(new Date(), timeZone);
    const seasonEnd = new Date(seasonInfo.endDate);
    const scrapingEndDate = isAfter(todayEST, seasonEnd) ? seasonEnd : todayEST;

    // --- Determine the start date ---
    const latestDate = await getLatestDateSupabase();
    let startDate: Date;
    if (latestDate) {
      // Parse the latest date string as a local date (assumed "yyyy-MM-dd") and convert to EST.
      const latestDateLocal = parse(latestDate, "yyyy-MM-dd", new Date());
      startDate = addDays(latestDateLocal, 1);
      console.log(
        `Latest date in Supabase is ${latestDate}. Starting from ${tzFormat(
          startDate,
          "yyyy-MM-dd",
          { timeZone }
        )}.`
      );
    } else {
      startDate = seasonStartDate;
      console.log(
        `No existing data in Supabase. Starting from season start date ${tzFormat(
          startDate,
          "yyyy-MM-dd",
          { timeZone }
        )}.`
      );
    }

    // --- Get the list of dates to scrape (in EST) ---
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

    // Deduplicate URLs.
    const uniqueUrls = new Set<string>();
    const uniqueUrlsQueue = urlsQueue.filter(
      ({ datasetType, url, date, seasonId }) => {
        const key = `${datasetType}-${url}-${date}-${seasonId}`;
        if (uniqueUrls.has(key)) return false;
        uniqueUrls.add(key);
        return true;
      }
    );

    await processUrls(uniqueUrlsQueue);

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
//test
