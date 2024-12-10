// pages/api/v1/db/update-nst-gamelog.ts

import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import * as cheerio from "cheerio";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey: string | undefined =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Public Key is missing.");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Strict rate limit: Only 1 URL every 21 seconds
const REQUEST_INTERVAL_MS = 21000; // 21 seconds

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

  // Alex Petrovic, Nathan Légaré
};

const troublesomePlayers: string[] = [];

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

interface SeasonInfo {
  id: number;
  startDate: string;
  regularSeasonEndDate: string;
  endDate: string;
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

async function getLatestDateSupabase(): Promise<string | null> {
  const tableNames = [
    "nst_gamelog_as_counts",
    "nst_gamelog_as_rates",
    "nst_gamelog_pp_counts",
    "nst_gamelog_pp_rates",
    "nst_gamelog_as_counts_oi",
    "nst_gamelog_as_rates_oi",
    "nst_gamelog_pp_counts_oi",
    "nst_gamelog_pp_rates_oi"
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
  const total = 21;
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
function getTableName(datasetType: string): string {
  switch (datasetType) {
    case "allStrengthsCounts":
      return "nst_gamelog_as_counts";
    case "allStrengthsRates":
      return "nst_gamelog_as_rates";
    case "powerPlayCounts":
      return "nst_gamelog_pp_counts";
    case "powerPlayRates":
      return "nst_gamelog_pp_rates";
    case "allStrengthsCountsOi":
      return "nst_gamelog_as_counts_oi";
    case "allStrengthsRatesOi":
      return "nst_gamelog_as_rates_oi";
    case "powerPlayCountsOi":
      return "nst_gamelog_pp_counts_oi";
    case "powerPlayRatesOi":
      return "nst_gamelog_pp_rates_oi";
    default:
      return "unknown_table";
  }
}

async function fetchAndParseData(
  url: string,
  datasetType: string,
  date: string,
  seasonId: string
) {
  try {
    const response = await axios.get(url);
    if (!response.data) return [];

    const $ = cheerio.load(response.data);
    const table = $("table").first();

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
        rowData["season"] = seasonId;
        dataRowsCollected.push(rowData);
      }
    });

    // Assign player_id
    const dataRowsWithPlayerIds: any[] = [];
    for (const row of dataRowsCollected) {
      const playerFullName = row["player_full_name"];
      const playerPosition = row["player_position"];
      const playerId = await getPlayerIdByName(playerFullName, playerPosition);
      if (!playerId) continue;

      row["player_id"] = playerId;
      delete row["player_full_name"];
      delete row["player_position"];
      delete row["player_team"];
      dataRowsWithPlayerIds.push(row);
    }

    return dataRowsWithPlayerIds;
  } catch {
    return [];
  }
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
  if (dataRows.length === 0) return;

  const tableName = getTableName(datasetType);

  const { error } = await supabase
    .from(tableName)
    .upsert(dataRows, { onConflict: "player_id,date_scraped" });

  if (error) {
    console.error(
      `Error upserting data into ${tableName}:`,
      error.details || error.message
    );
  }
}

async function checkDataExists(
  datasetType: string,
  date: string
): Promise<boolean> {
  const tableName = getTableName(datasetType);
  if (tableName === "unknown_table") return false;

  const { data, error } = await supabase
    .from(tableName)
    .select("player_id")
    .eq("date_scraped", date)
    .limit(1);

  if (error) return false;
  return data && data.length > 0;
}

function constructUrlsForDate(
  date: string,
  seasonId: string
): Record<string, string> {
  const fromSeason = seasonId;
  const thruSeason = seasonId;
  const commonParams = `fromseason=${fromSeason}&thruseason=${thruSeason}&stype=2&pos=S&loc=B&toi=0&gpfilt=gpdate&fd=${date}&td=${date}&lines=single&draftteam=ALL`;

  const stdUrls = {
    allStrengthsCounts: `${BASE_URL}?sit=all&score=all&stdoi=std&rate=n&team=ALL&${commonParams}&tgp=10`,
    allStrengthsRates: `${BASE_URL}?sit=all&score=all&stdoi=std&rate=y&team=ALL&${commonParams}&tgp=410`,
    powerPlayCounts: `${BASE_URL}?sit=pp&score=all&stdoi=std&rate=n&team=ALL&${commonParams}&tgp=410`,
    powerPlayRates: `${BASE_URL}?sit=pp&score=all&stdoi=std&rate=y&team=ALL&${commonParams}&tgp=410`
  };

  const oiUrls = {
    allStrengthsCountsOi: `${BASE_URL}?sit=all&score=all&stdoi=oi&rate=n&team=ALL&${commonParams}&tgp=10`,
    allStrengthsRatesOi: `${BASE_URL}?sit=all&score=all&stdoi=oi&rate=y&team=ALL&${commonParams}&tgp=410`,
    powerPlayCountsOi: `${BASE_URL}?sit=pp&score=all&stdoi=oi&rate=n&team=ALL&${commonParams}&tgp=410`,
    powerPlayRatesOi: `${BASE_URL}?sit=pp&score=all&stdoi=oi&rate=y&team=ALL&${commonParams}&tgp=410`
  };

  return { ...stdUrls, ...oiUrls };
}

async function processUrlsSequentially(
  urlsQueue: {
    datasetType: string;
    url: string;
    date: string;
    seasonId: string;
  }[]
) {
  let firstRequest = true;

  // Group by date to determine how many URLs per date
  const dateGroups: Record<string, number> = {};
  for (const u of urlsQueue) {
    if (!dateGroups[u.date]) dateGroups[u.date] = 0;
    dateGroups[u.date]++;
  }

  let totalProcessed = 0; // total URLs processed
  const totalUrls = urlsQueue.length;

  const dateProcessedCount: Record<string, number> = {};

  for (let i = 0; i < urlsQueue.length; i++) {
    const { datasetType, url, date, seasonId } = urlsQueue[i];

    // Wait 21 seconds before each request, except the first
    if (!firstRequest) {
      // Print delay countdown
      await printDelayCountdown();
    } else {
      firstRequest = false;
    }

    const dataExists = await checkDataExists(datasetType, date);
    let dataRows: any[] = [];
    if (!dataExists) {
      dataRows = await fetchAndParseData(url, datasetType, date, seasonId);
      await upsertData(datasetType, dataRows);
    }

    totalProcessed++;
    if (!dateProcessedCount[date]) dateProcessedCount[date] = 0;
    dateProcessedCount[date]++;

    // Determine rows processed/prepared/upserted = length of dataRows
    const rowsCount = dataExists ? 0 : dataRows.length;
    const tableName = getTableName(datasetType);

    // Print info block
    printInfoBlock({
      date,
      url,
      datasetType,
      tableName,
      dateUrlCount: {
        current: dateProcessedCount[date],
        total: dateGroups[date]
      },
      totalUrlCount: {
        current: totalProcessed,
        total: totalUrls
      },
      rowsProcessed: rowsCount,
      rowsPrepared: rowsCount,
      rowsUpserted: rowsCount
    });

    // Print total progress bar
    printTotalProgress(totalProcessed, totalUrls);
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
