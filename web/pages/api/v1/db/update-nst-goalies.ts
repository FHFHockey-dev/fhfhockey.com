import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import * as cheerio from "cheerio";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey: string | undefined = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Service Role Key is missing.");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Delay interval between requests in milliseconds
const REQUEST_INTERVAL_MS = 22000; // 30 seconds

const BASE_URL = "https://www.naturalstattrick.com/playerteams.php";

// --- Header Mappings for Goalie Data ---
const goalieCountsHeaderMap: Record<string, string> = {
  GP: "gp",
  TOI: "toi",
  "Shots Against": "shots_against",
  Saves: "saves",
  "Goals Against": "goals_against",
  "SV%": "sv_percentage",
  GAA: "gaa",
  GSAA: "gsaa",
  "xG Against": "xg_against",
  "HD Shots Against": "hd_shots_against",
  "HD Saves": "hd_saves",
  "HDSV%": "hd_sv_percentage",
  HDGAA: "hd_gaa",
  HDGSAA: "hd_gsaa",
  "MD Shots Against": "md_shots_against",
  "MD Saves": "md_saves",
  "MD Goals Against": "md_goals_against",
  "MDSV%": "md_sv_percentage",
  MDGAA: "md_gaa",
  MDGSAA: "md_gsaa",
  "LD Shots Against": "ld_shots_against",
  "LDSV%": "ld_sv_percentage",
  LDGAA: "ld_gaa",
  LDGSAA: "ld_gsaa",
  "Rush Attempts Against": "rush_attempts_against",
  "Rebound Attempts Against": "rebound_attempts_against",
  "Avg. Shot Distance": "avg_shot_distance",
  "Avg. Goal Distance": "avg_goal_distance"
};

const goalieRatesHeaderMap: Record<string, string> = {
  GP: "gp",
  TOI: "toi",
  "TOI/GP": "toi_per_gp",
  "Shots Against/60": "shots_against_per_60",
  "Saves/60": "saves_per_60",
  "SV%": "sv_percentage",
  GAA: "gaa",
  "GSAA/60": "gsaa_per_60",
  "xG Against/60": "xg_against_per_60",
  "HD Shots Against/60": "hd_shots_against_per_60",
  "HD Saves/60": "hd_saves_per_60",
  "HDSV%": "hd_sv_percentage",
  HDGAA: "hd_gaa",
  "HDGSAA/60": "hd_gsaa_per_60",
  "MD Shots Against/60": "md_shots_against_per_60",
  "MD Saves/60": "md_saves_per_60",
  "MDSV%": "md_sv_percentage",
  MDGAA: "md_gaa",
  "MDGSAA/60": "md_gsaa_per_60",
  "LD Shots Against/60": "ld_shots_against_per_60",
  "LD Saves/60": "ld_saves_per_60",
  "LDSV%": "ld_sv_percentage",
  LDGAA: "ld_gaa",
  "LDGSAA/60": "ld_gsaa_per_60",
  "Rush Attempts Against/60": "rush_attempts_against_per_60",
  "Rebound Attempts Against/60": "rebound_attempts_against_per_60",
  "Avg. Shot Distance": "avg_shot_distance",
  "Avg. Goal Distance": "avg_goal_distance"
};

function mapGoalieHeaderToColumn(
  header: string,
  datasetType: string
): string | null {
  // 'Player' and 'Team' are handled separately.
  if (header === "Player" || header === "Team") return null;
  if (datasetType.endsWith("Counts")) {
    return goalieCountsHeaderMap[header] || null;
  } else if (datasetType.endsWith("Rates")) {
    return goalieRatesHeaderMap[header] || null;
  }
  return null;
}

// --- Table Name Mapping ---
const goalieTableMapping: Record<string, string> = {
  "5v5Counts": "nst_gamelog_goalie_5v5_counts",
  "5v5Rates": "nst_gamelog_goalie_5v5_rates",
  evCounts: "nst_gamelog_goalie_ev_counts",
  evRates: "nst_gamelog_goalie_ev_rates",
  allCounts: "nst_gamelog_goalie_all_counts",
  allRates: "nst_gamelog_goalie_all_rates",
  ppCounts: "nst_gamelog_goalie_pp_counts",
  ppRates: "nst_gamelog_goalie_pp_rates",
  pkCounts: "nst_gamelog_goalie_pk_counts",
  pkRates: "nst_gamelog_goalie_pk_rates"
};

function getGoalieTableName(datasetType: string): string {
  const tableName = goalieTableMapping[datasetType] || "unknown_goalie_table";
  if (tableName === "unknown_goalie_table") {
    console.warn(
      `Warning: datasetType "${datasetType}" is not mapped to a valid goalie table.`
    );
  }
  return tableName;
}

// --- Utility Functions ---
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

// --- Name Mapping for Goalies ---
// The key is the NaturalStatTrick (NST) name as scraped,
// and the value is the official NHL API name.
const goalieNameMapping: Record<string, { fullName: string }> = {
  "Jacob Markstrom": { fullName: "Jacob Markstrom" }
  // Add additional goalie mappings here if needed.
};

// Normalizes a given name: lowercases, removes spaces/hyphens/apostrophes, and strips diacritics.
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\-']/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Array to track problematic players for manual mapping.
const troublesomePlayers: string[] = [];

// --- Get Goalie ID by Name ---
// This function looks up the player's ID in your Supabase "players" table.
// It uses the goalieNameMapping to convert the scraped (NST) name to the official NHL API name.
async function getGoalieIdByName(
  fullName: string,
  position: string
): Promise<number | null> {
  const mappedName = goalieNameMapping[fullName]
    ? goalieNameMapping[fullName].fullName
    : fullName;
  const normalizedFullName = normalizeName(mappedName);
  const goaliePosition = "G"; // Force goalie position

  const { data, error } = await supabase
    .from("players")
    .select("id")
    .ilike("fullName", `%${mappedName}%`)
    .eq("position", goaliePosition)
    .limit(1)
    .maybeSingle();

  if (error) return null;
  if (!data) {
    troublesomePlayers.push(`${fullName} (${position})`);
    return null;
  }
  return data.id;
}

// --- Construct Goalie URLs for a Given Date ---
function constructGoalieUrlsForDate(
  date: string,
  seasonId: string
): Record<string, string> {
  // Parameters: stdoi is fixed as "g" for goalies.
  const fromSeason = seasonId;
  const thruSeason = seasonId;
  const commonParams = `fromseason=${fromSeason}&thruseason=${thruSeason}&stype=2&score=all&stdoi=g&team=ALL&pos=S&loc=B&toi=0&gpfilt=gpdate&fd=${date}&td=${date}&tgp=410&lines=single&draftteam=ALL`;

  const situations = [
    { sit: "5v5", label: "5v5" },
    { sit: "ev", label: "ev" },
    { sit: "all", label: "all" },
    { sit: "pp", label: "pp" },
    { sit: "pk", label: "pk" }
  ];

  const urls: Record<string, string> = {};

  situations.forEach(({ sit, label }) => {
    // Counts
    const datasetTypeCounts = `${label}Counts`;
    const urlCounts = `${BASE_URL}?${commonParams}&sit=${sit}&rate=n`;
    urls[datasetTypeCounts] = urlCounts;
    // Rates
    const datasetTypeRates = `${label}Rates`;
    const urlRates = `${BASE_URL}?${commonParams}&sit=${sit}&rate=y`;
    urls[datasetTypeRates] = urlRates;
  });

  return urls;
}

// --- Data Fetching and Parsing ---
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
        console.warn(`No table found in response from URL: ${url}`);
        return [];
      }
      // Extract headers
      const headers: string[] = [];
      table.find("thead tr th").each((_, th) => {
        headers.push($(th).text().trim());
      });

      // Map headers using goalie mapping
      const mappedHeaders = headers.map((header) =>
        mapGoalieHeaderToColumn(header, datasetType)
      );

      // Parse rows into an array called dataRowsCollected
      const dataRowsCollected: any[] = [];
      table.find("tbody tr").each((_, tr) => {
        const rowData: any = {};
        let playerName: string | null = null;
        let team: string | null = null;
        $(tr)
          .find("td")
          .each((i, td) => {
            const column = mappedHeaders[i];
            if (column === null) {
              const originalHeader = headers[i];
              if (originalHeader === "Player") {
                playerName = $(td).text().trim();
              } else if (originalHeader === "Team") {
                team = $(td).text().trim();
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

        if (playerName && team && Object.keys(rowData).length > 0) {
          // Store temporary fields to later lookup player ID
          rowData["player_name"] = playerName;
          rowData["team"] = team;
          rowData["date_scraped"] = date;
          rowData["season"] = parseInt(seasonId, 10);
          dataRowsCollected.push(rowData);
        } else {
          console.warn(`Incomplete data row skipped for URL: ${url}`);
        }
      });

      console.log(
        `Parsed ${dataRowsCollected.length} rows for datasetType "${datasetType}".`
      );
      return dataRowsCollected;
    } catch (error: any) {
      console.error(
        `Attempt ${attempt} - Error fetching ${url}:`,
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

async function upsertData(datasetType: string, dataRows: any[]) {
  if (dataRows.length === 0) {
    console.warn(`No data rows to upsert for datasetType "${datasetType}".`);
    return;
  }
  const tableName = getGoalieTableName(datasetType);
  if (tableName === "unknown_goalie_table") {
    console.warn(
      `Skipping upsert for unknown table with datasetType "${datasetType}".`
    );
    return;
  }

  // Process each row to assign player_id from the players table
  const dataRowsWithPlayerIds: any[] = [];
  for (const row of dataRows) {
    const goalieId = await getGoalieIdByName(row["player_name"], row["team"]);
    if (!goalieId) {
      console.warn(
        `Player ID not found for ${row["player_name"]} (${row["team"]})`
      );
      continue;
    }
    row["player_id"] = goalieId;
    // Now the row includes player_id, date_scraped, season, and all numeric columns.
    dataRowsWithPlayerIds.push(row);
  }

  console.log(
    `Upserting ${dataRowsWithPlayerIds.length} rows into table "${tableName}".`
  );
  const { error } = await supabase
    .from(tableName)
    .upsert(dataRowsWithPlayerIds, { onConflict: "player_id,date_scraped" });
  if (error) {
    console.error(
      `Error upserting into ${tableName}:`,
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
  const tableName = getGoalieTableName(datasetType);
  if (tableName === "unknown_goalie_table") {
    console.warn(
      `Skipping data existence check for unknown table for datasetType "${datasetType}".`
    );
    return false;
  }
  const { data, error } = await supabase
    .from(tableName)
    .select("player_id")
    .eq("date_scraped", date)
    .limit(1);
  if (error) {
    console.error(`Error checking data in ${tableName}:`, error.message);
    return false;
  }
  const exists = data && data.length > 0;
  console.log(`Data existence check for "${tableName}" on ${date}: ${exists}`);
  return exists;
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
  const dateCounts: Record<string, number> = {};

  for (let i = 0; i < urlsQueue.length; i++) {
    const { datasetType, url, date, seasonId } = urlsQueue[i];
    console.log(
      `\nProcessing URL ${i + 1}/${totalUrls}: ${datasetType} for ${date}`
    );
    if (i > 0) {
      console.log(
        `Waiting ${REQUEST_INTERVAL_MS / 1000} seconds before next request...`
      );
      await delay(REQUEST_INTERVAL_MS);
    }
    if (!dateCounts[date]) dateCounts[date] = 0;
    const dataExists = await checkDataExists(datasetType, date);
    let dataRows: any[] = [];
    if (!dataExists) {
      dataRows = await fetchAndParseData(url, datasetType, date, seasonId);
      if (dataRows.length > 0) {
        await upsertData(datasetType, dataRows);
      }
    } else {
      console.log(
        `Data already exists for ${datasetType} on ${date}. Skipping.`
      );
    }
    processedCount++;
    console.log(`Processed ${processedCount} out of ${totalUrls} URLs.`);
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

    // Determine start date based on existing data in Supabase.
    let startDate = seasonStartDate;
    const latestDateStr = await getLatestDateSupabase();
    if (latestDateStr) {
      startDate = new Date(latestDateStr);
      startDate.setDate(startDate.getDate() + 1);
      console.log(
        `Latest date in Supabase is ${latestDateStr}. Starting from ${
          startDate.toISOString().split("T")[0]
        }.`
      );
    } else {
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
    datesToScrape.forEach((date) => {
      const urls = constructGoalieUrlsForDate(date, seasonId);
      for (const [datasetType, url] of Object.entries(urls)) {
        urlsQueue.push({ datasetType, url, date, seasonId });
      }
    });

    await processUrlsSequentially(urlsQueue);

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
    res
      .status(200)
      .json({ message: "Goalie data fetching and upsertion initiated." });
  } catch (error: any) {
    console.error("Error in API handler:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Helper: Get the latest date from multiple tables (optional, similar to skaters script)
async function getLatestDateSupabase(): Promise<string | null> {
  const tableNames = [
    "nst_gamelog_goalie_5v5_counts",
    "nst_gamelog_goalie_5v5_rates",
    "nst_gamelog_goalie_ev_counts",
    "nst_gamelog_goalie_ev_rates",
    "nst_gamelog_goalie_all_counts",
    "nst_gamelog_goalie_all_rates",
    "nst_gamelog_goalie_pp_counts",
    "nst_gamelog_goalie_pp_rates",
    "nst_gamelog_goalie_pk_counts",
    "nst_gamelog_goalie_pk_rates"
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
