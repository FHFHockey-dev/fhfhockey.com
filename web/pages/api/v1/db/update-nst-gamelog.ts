// pages/api/v1/db/update-nst-gamelog.ts

import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import * as cheerio from "cheerio";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";

// Load environment variables from .env.local
dotenv.config({ path: "./../../../.env.local" });

// Initialize Supabase client
const supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey: string | undefined =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Public Key is missing.");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Delay between requests to maintain one request every 21 seconds
const REQUEST_INTERVAL_MS = 21000; // 21 seconds

// Base URL for Natural Stat Trick
const BASE_URL = "https://www.naturalstattrick.com/playerteams.php";

// Define a mapping for players with name discrepancies
const playerNameMapping: Record<string, { fullName: string }> = {
  "Matthew Benning": { fullName: "Matt Benning" },
  "Alex Kerfoot": { fullName: "Alexander Kerfoot" },
  "Zach Aston-Reese": { fullName: "Zachary Aston-Reese" },
  "Oskar Back": { fullName: "Oskar Bäck" }, // Handles special characters
  "Cameron Atkinson": { fullName: "Cam Atkinson" },
  "Nicholas Paul": { fullName: "Nick Paul" },
  "Janis Moser": { fullName: "J.J. Moser" }
  // Players with identical names but different positions will be handled using both name and position
};

// Initialize an array to collect troublesome player names
const troublesomePlayers: string[] = [];

// Helper function to normalize names
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\-']/g, "") // Remove spaces, hyphens, apostrophes
    .normalize("NFD") // Normalize Unicode characters
    .replace(/[\u0300-\u036f]/g, ""); // Remove diacritics
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SeasonInfo {
  id: number;
  startDate: string;
  regularSeasonEndDate: string;
  endDate: string;
  playoffsStartDate: number; // Timestamp
  playoffsEndDate: number; // Timestamp
  previousSeason?: SeasonInfo;
  nextSeason?: SeasonInfo;
  idPrev?: number;
  idTwo?: number;
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
    iSCF: "iscfs", // Correct mapping for 'iSCF'
    "iSCF/60": "iscfs_per_60",
    iHDCF: "hdcf", // Correct mapping for 'iHDCF'
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
    "Faceoffs %": "faceoffs_percentage"
  };

  if (header === "Player") {
    return null; // Handle 'Player' separately
  }

  return headerMap[header] || null; // Map to column or null
}

let lastRequestTime = 0; // Keep track of last request time

async function fetchAndParseData(
  url: string,
  datasetType: string,
  date: string,
  seasonId: string
) {
  try {
    // Enforce delay between requests
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < REQUEST_INTERVAL_MS) {
      const waitTime = REQUEST_INTERVAL_MS - timeSinceLastRequest;
      console.log(`Waiting for ${waitTime}ms before making the next request`);
      await delay(waitTime);
    }
    lastRequestTime = Date.now();

    console.log(`[${new Date().toISOString()}] Fetching data from ${url}`);
    const response = await axios.get(url);

    if (!response.data) {
      console.error(`No data received from ${url}`);
      return [];
    }

    const $ = cheerio.load(response.data);
    const table = $("table").first();

    // Extract headers
    const headers: string[] = [];
    table.find("thead tr th").each((_, th) => {
      headers.push($(th).text().trim());
    });
    console.log("Extracted headers:", headers);

    const mappedHeaders = headers.map(mapHeaderToColumn);
    console.log("Mapped headers:", mappedHeaders);

    // Log any unmapped headers except for empty headers
    headers.forEach((header, index) => {
      if (mappedHeaders[index] === null && header !== "") {
        console.warn(`Unmapped header: '${header}'`);
      }
    });

    // Extract data rows
    const dataRowsCollected: any[] = [];

    table.find("tbody tr").each((_, tr) => {
      const rowData: any = {};
      let playerFullName: string | null = null;
      let playerPosition: string | null = null; // To store the player's position

      $(tr)
        .find("td")
        .each((i, td) => {
          const column = mappedHeaders[i];
          if (column === null) {
            // Handle 'Player' and 'Position' columns
            const originalHeader = headers[i];
            if (originalHeader === "Player") {
              playerFullName = $(td).text().trim();
            } else if (originalHeader === "Position") {
              playerPosition = $(td).text().trim();
            }
            return; // Skip unmapped columns
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

      if (playerFullName && playerPosition && Object.keys(rowData).length > 0) {
        rowData["player_full_name"] = playerFullName;
        rowData["player_position"] = playerPosition;
        rowData["date_scraped"] = date;
        rowData["season"] = seasonId;
        dataRowsCollected.push(rowData);
      }
    });

    // Now, process dataRowsCollected asynchronously
    const dataRowsWithPlayerIds: any[] = [];

    for (const row of dataRowsCollected) {
      const playerFullName = row["player_full_name"];
      const playerPosition = row["player_position"];
      const playerId = await getPlayerIdByName(playerFullName, playerPosition);

      if (!playerId) {
        console.warn(
          `Player ID not found for ${playerFullName} (${playerPosition}). Skipping.`
        );
        continue;
      }

      row["player_id"] = playerId;
      delete row["player_full_name"];
      delete row["player_position"];
      dataRowsWithPlayerIds.push(row);
    }

    return dataRowsWithPlayerIds;
  } catch (error: any) {
    console.error(`Error fetching URL: ${url}`, error.message);
    return [];
  }
}

async function getPlayerIdByName(
  fullName: string,
  position: string
): Promise<number | null> {
  // Check if the player needs name mapping
  const mappedName = playerNameMapping[fullName]
    ? playerNameMapping[fullName].fullName
    : fullName;

  // Normalize name and position for consistency
  const normalizedFullName = normalizeName(mappedName);
  const normalizedPosition = position.toUpperCase(); // Ensure position is uppercase (G, D, L, R, C)

  // Query Supabase for the player's ID using both name and position
  const { data, error } = await supabase
    .from("players")
    .select("id")
    .ilike("fullName", `%${mappedName}%`) // Case-insensitive partial match
    .eq("position", normalizedPosition) // Exact position match
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching player ID for ${fullName}:`, error.message);
    return null;
  }

  if (!data) {
    console.warn(`Player ID not found for ${fullName} (${position}).`);
    // Add the full name and position to the troublesome players list
    troublesomePlayers.push(`${fullName} (${position})`);
    return null;
  }

  return data.id;
}

async function upsertData(datasetType: string, dataRows: any[]) {
  if (dataRows.length === 0) {
    console.log(`No data to upsert for ${datasetType}`);
    return;
  }

  let tableName = "";
  switch (datasetType) {
    case "allStrengthsCounts":
      tableName = "nst_gamelog_as_counts";
      break;
    case "allStrengthsRates":
      tableName = "nst_gamelog_as_rates";
      break;
    case "powerPlayCounts":
      tableName = "nst_gamelog_pp_counts";
      break;
    case "powerPlayRates":
      tableName = "nst_gamelog_pp_rates";
      break;
    default:
      console.error(`Unknown dataset type: ${datasetType}`);
      return;
  }

  // Upsert data into Supabase
  const { error } = await supabase
    .from(tableName)
    .upsert(dataRows, { onConflict: "player_id,date_scraped" });

  if (error) {
    console.error(
      `Error upserting data into ${tableName}:`,
      error.details || error.message
    );
  } else {
    console.log(
      `Successfully upserted ${dataRows.length} records into ${tableName}`
    );
  }
}

async function checkDataExists(
  datasetType: string,
  date: string
): Promise<boolean> {
  let tableName = "";
  switch (datasetType) {
    case "allStrengthsCounts":
      tableName = "nst_gamelog_as_counts";
      break;
    case "allStrengthsRates":
      tableName = "nst_gamelog_as_rates";
      break;
    case "powerPlayCounts":
      tableName = "nst_gamelog_pp_counts";
      break;
    case "powerPlayRates":
      tableName = "nst_gamelog_pp_rates";
      break;
    default:
      console.error(`Unknown dataset type: ${datasetType}`);
      return false;
  }

  const { data, error } = await supabase
    .from(tableName)
    .select("id")
    .eq("date_scraped", date)
    .limit(1);

  if (error) {
    console.error(
      `Error checking data existence in ${tableName}:`,
      error.message
    );
    return false;
  }

  return data && data.length > 0;
}

function constructUrlsForDate(
  date: string,
  seasonId: string
): Record<string, string> {
  const fromSeason = seasonId;
  const thruSeason = seasonId;
  const commonParams = `fromseason=${fromSeason}&thruseason=${thruSeason}&stype=2&pos=S&loc=B&toi=0&gpfilt=gpdate&fd=${date}&td=${date}&lines=single&draftteam=ALL`;

  return {
    allStrengthsCounts: `${BASE_URL}?sit=all&score=all&stdoi=std&rate=n&team=ALL&${commonParams}&tgp=10`,
    allStrengthsRates: `${BASE_URL}?sit=all&score=all&stdoi=std&rate=y&team=ALL&${commonParams}&tgp=410`,
    powerPlayCounts: `${BASE_URL}?sit=pp&score=all&stdoi=std&rate=n&team=ALL&${commonParams}&tgp=410`,
    powerPlayRates: `${BASE_URL}?sit=pp&score=all&stdoi=std&rate=y&team=ALL&${commonParams}&tgp=410`
  };
}

async function main() {
  try {
    const seasonInfo = await fetchCurrentSeason();
    const seasonId = seasonInfo.id.toString(); // Convert to string
    const seasonStartDate = new Date(seasonInfo.startDate);
    const today = new Date();
    const scrapingEndDate =
      today < new Date(seasonInfo.endDate)
        ? today
        : new Date(seasonInfo.endDate);

    const datesToScrape = getDatesBetween(seasonStartDate, scrapingEndDate);

    // Loop through dates
    for (const date of datesToScrape) {
      console.log(`Processing date: ${date}`);

      const urls = constructUrlsForDate(date, seasonId);

      for (const [datasetType, url] of Object.entries(urls)) {
        // Check if data exists
        const dataExists = await checkDataExists(datasetType, date);
        if (dataExists) {
          console.log(
            `Data for ${datasetType} on ${date} already exists. Skipping.`
          );
          continue;
        }

        // Fetch and parse data
        const dataRows = await fetchAndParseData(
          url,
          datasetType,
          date,
          seasonId
        );

        // Upsert data
        await upsertData(datasetType, dataRows);
      }
    }

    console.log("Data fetching and upsertion completed.");

    if (troublesomePlayers.length > 0) {
      const uniqueTroublesomePlayers = [...new Set(troublesomePlayers)];
      console.log(
        "Troublesome Players (require manual mapping):",
        uniqueTroublesomePlayers
      );
      // Optionally, you can handle this list as needed, such as sending it to a monitoring service or saving it to a file/database
    }
  } catch (error: any) {
    console.error("An error occurred:", error.message);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Optionally, you can add authentication here

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
