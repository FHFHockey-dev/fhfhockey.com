// pages/api/v1/db/update-nst-gamelog.ts

/**
 * This API route is responsible for scraping and updating hockey player game log data from Natural Stat Trick (NST).
 * It supports several modes of operation, controlled by query parameters.
 *
 * --- Query Parameters ---
 *
 * 1. `runMode` (optional): Specifies the operation mode for the data fetch.
 *    - `incremental` (default): Fetches data from the last successfully scraped date up to the current date.
 *      This is the most common mode for daily updates.
 *      Example: /api/v1/db/update-nst-gamelog
 *      Example: /api/v1/db/update-nst-gamelog?runMode=incremental
 *
 *    - `forward`: Performs a full refresh of the current season's data from its start date to the current date.
 *      Useful for correcting widespread data issues within the current season.
 *      Example: /api/v1/db/update-nst-gamelog?runMode=forward
 *
 *    - `reverse`: Fetches all historical data for all past seasons, starting from the most recent season and going
 *      backward in time. This is a heavy operation intended for initial data backfills or major historical updates.
 *      It can be combined with the `startDate` parameter to begin the process from a specific point in the past.
 *      Example: /api/v1/db/update-nst-gamelog?runMode=reverse
 *
 * 2. `startDate` (optional): Used exclusively with `runMode=reverse`. This parameter defines the starting date for the
 *    historical data fetch. The script will identify the season corresponding to this date and begin its reverse
 *    chronological fetch from there. If omitted in `reverse` mode, it starts from the current season.
 *    The format must be YYYY-MM-DD.
 *    Example: /api/v1/db/update-nst-gamelog?runMode=reverse&startDate=2025-03-30
 *
 *                                                         Bookmark:  2025-03-30
 *
 * 3. `overwrite` (optional): Controls whether to re-fetch and overwrite existing dates.
 *    - Accepted: `yes` | `no` (also `true` | `false`, `1` | `0`)
 *    - Defaults preserve current behavior:
 *      - reverse/forward: overwrite defaults to yes (full-refresh)
 *      - incremental: overwrite defaults to no (skip complete dates)
 *    Example: /api/v1/db/update-nst-gamelog?runMode=reverse&overwrite=no
 *
 * --- How It Works ---
 *
 * - The script initiates a connection to a Supabase database to store the scraped data.
 * - It constructs URLs for the Natural Stat Trick website based on the date range and game situations (e.g., even strength, power play).
 * - A rate limiter is used to avoid sending too many requests to the NST server in a short period.
 * - It uses `axios` to fetch the HTML content and `cheerio` to parse the data tables.
 * - Player names are normalized and mapped to corresponding player IDs in the database.
 * - The parsed and cleaned data is then "upserted" into the appropriate Supabase tables.
 * - For full refreshes (`forward` mode), it includes a cross-referencing step against the official NHL API to identify and
 *   fill in any missing game logs.
 * - The entire process is logged in a `cron_job_audit` table for monitoring and debugging.
 *
 * --- Quick recipe: Forward daily loop from a specific date ---
 *
 * To iterate forward day-by-day starting at a specific date (up to today), use
 * runMode=incremental with a startDate. Despite the name, this is the intended
 * way to perform a "forward-from date" loop. Note: runMode=forward ignores startDate
 * and refreshes the entire current season.
 *
 * Example (GET):
 *   /api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2022-03-25
 *
 * Example (POST body):
 *   { "runMode": "incremental", "startDate": "2024-10-01" }
 *
 */

//  https://www.naturalstattrick.com/playerteams.php?fromseason=20252026&thruseason=20252026&stype=2&sit=pk&score=all&stdoi=oi&  rate=y&team=ALL&pos=S&loc=B&toi=0&gpfilt=gpdate&fd=2025-10-23&td=2025-10-23&tgp=410&lines=single&draftteam=ALL
// `https://www.naturalstattrick.com/playerteams.php?fromseason=20252026&thruseason=20252026&stype=2&sit=all&score=all&stdoi=std&rate=n&team=ALL&pos=S&loc=B&toi=0&gpfilt=gpdate&fd=2026-04-17&td=2026-04-17&lines=single&draftteam=ALL&tgp=410
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

// Global NST rate limit: at least 21 seconds between requests (set to 25s for safety)
const REQUEST_INTERVAL_MS = 25000; // 25 seconds

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

// --- Console formatting helpers ---
const SEP =
  "//////////////////////////////////////////////////////////////////////////";

function banner(title: string) {
  console.log("\n" + SEP);
  console.log(`|======= ${title} =======|`);
  console.log("\n" + SEP + "\n");
}

function section(title: string) {
  console.log(`\n|======== ${title} ========|\n`);
}

function keyValuesBlock(
  lines: Array<[string, string | number | null | undefined]>
) {
  console.log("|======= Details =======|");
  console.log("|");
  for (const [k, v] of lines) {
    const val = v === undefined ? "" : String(v);
    console.log(`| ${k}: ${val}`);
  }
  console.log("|");
  console.log("|======================|");
}

function logRateLimitWait(
  waitMs: number,
  intervalMs: number,
  elapsedMs: number
) {
  section("Rate limit");
  const secs = (waitMs / 1000).toFixed(1);
  const intervalSecs = (intervalMs / 1000).toFixed(1);
  const elapsedSecs = (elapsedMs / 1000).toFixed(1);
  const eta = new Date(Date.now() + waitMs).toLocaleTimeString();
  keyValuesBlock([
    ["Waiting", `${secs}s`],
    ["Interval", `${intervalSecs}s`],
    ["Elapsed", `${elapsedSecs}s`],
    ["ETA", eta]
  ]);
}

// --- Global NST rate limiter ---
let lastNstRequestAt = 0;
async function nstGet(url: string, timeoutMs = 30000) {
  const now = Date.now();
  const elapsed = now - lastNstRequestAt;
  if (elapsed < REQUEST_INTERVAL_MS) {
    const waitMs = REQUEST_INTERVAL_MS - elapsed;
    logRateLimitWait(waitMs, REQUEST_INTERVAL_MS, elapsed);
    await delay(waitMs);
  }
  lastNstRequestAt = Date.now();
  // Many sites (including NST) return generic 404s for non-browser requests.
  // Send realistic browser headers to avoid being blocked by WAF/CDN.
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://www.naturalstattrick.com/",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    // Some CDNs treat these as hints; harmless if ignored server-side
    "Upgrade-Insecure-Requests": "1"
  } as Record<string, string>;

  return axios.get(url, {
    timeout: timeoutMs,
    headers,
    maxRedirects: 3,
    responseType: "text"
    // Do not decompress on our side explicitly; axios/node handles gzip automatically
  });
}

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
  // Silent sleep; specific wait messaging is logged by callers (e.g., rate limiter).
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

async function dateIsComplete(table: string, date: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(table)
    .select("player_id, goals_per_60")
    .eq("date_scraped", date)
    .limit(10);
  if (error) return false;
  if (!data || data.length < 5) return false;
  // If all 10 are null in a key column, treat as incomplete
  return data.some((r) => r.goals_per_60 !== null);
}

function mapHeaderToColumn(headerRaw: string): string | null {
  const h = cleanHeader(headerRaw).toLowerCase();
  if (h === "" || h === "player" || h === "team" || h === "position")
    return null;

  // light aliasing for common variants
  const alias: Record<string, string> = {
    "faceoffs%": "faceoffs %",
    "goals /60": "goals/60",
    "total assists /60": "total assists/60"
  };
  const key = alias[h] ?? h;

  const map: Record<string, string> = {
    // basics
    gp: "gp",
    toi: "toi",
    "toi/gp": "toi_per_gp",

    // counts (AS/ES/PP/PK counts tables)
    goals: "goals",
    "total assists": "total_assists",
    "first assists": "first_assists",
    "second assists": "second_assists",
    "total points": "total_points",
    shots: "shots",
    ixg: "ixg",
    icf: "icf",
    iff: "iff",
    iscf: "iscfs",
    ihdcf: "hdcf",
    "rush attempts": "rush_attempts",
    "rebounds created": "rebounds_created",
    pim: "pim",
    "total penalties": "total_penalties",
    minor: "minor_penalties",
    major: "major_penalties",
    misconduct: "misconduct_penalties",
    "penalties drawn": "penalties_drawn",
    giveaways: "giveaways",
    takeaways: "takeaways",
    hits: "hits",
    "hits taken": "hits_taken",
    "shots blocked": "shots_blocked",
    "faceoffs won": "faceoffs_won",
    "faceoffs lost": "faceoffs_lost",

    // individual (“i…”) rates
    "goals/60": "goals_per_60",
    "total assists/60": "total_assists_per_60",
    "first assists/60": "first_assists_per_60",
    "second assists/60": "second_assists_per_60",
    "total points/60": "total_points_per_60",
    ipp: "ipp",
    "shots/60": "shots_per_60",
    "sh%": "sh_percentage",
    "ixg/60": "ixg_per_60",
    "icf/60": "icf_per_60",
    "iff/60": "iff_per_60",
    "iscf/60": "iscfs_per_60",
    "ihdcf/60": "hdcf_per_60",

    // additional AS rates columns often present on NST
    "rush attempts/60": "rush_attempts_per_60",
    "rebounds created/60": "rebounds_created_per_60",
    "pim/60": "pim_per_60",
    "total penalties/60": "total_penalties_per_60",
    "minor/60": "minor_penalties_per_60",
    "major/60": "major_penalties_per_60",
    "misconduct/60": "misconduct_penalties_per_60",
    "penalties drawn/60": "penalties_drawn_per_60",
    "giveaways/60": "giveaways_per_60",
    "takeaways/60": "takeaways_per_60",
    "hits/60": "hits_per_60",
    "hits taken/60": "hits_taken_per_60",
    "shots blocked/60": "shots_blocked_per_60",
    "faceoffs won/60": "faceoffs_won_per_60",
    "faceoffs lost/60": "faceoffs_lost_per_60",

    // faceoffs% (present on the page, but NOT in as_rates schema)
    "faceoffs %": "faceoffs_percentage"
  };

  // On-ice (OI) counts and percentages
  const oiCounts: Record<string, string> = {
    cf: "cf",
    ca: "ca",
    "cf%": "cf_pct",
    ff: "ff",
    fa: "fa",
    "ff%": "ff_pct",
    sf: "sf",
    sa: "sa",
    "sf%": "sf_pct",
    gf: "gf",
    ga: "ga",
    "gf%": "gf_pct",
    xgf: "xgf",
    xga: "xga",
    "xgf%": "xgf_pct",
    scf: "scf",
    sca: "sca",
    "scf%": "scf_pct",
    hdcf: "hdcf",
    hdca: "hdca",
    "hdcf%": "hdcf_pct",
    hdgf: "hdgf",
    hdga: "hdga",
    "hdgf%": "hdgf_pct",
    mdcf: "mdcf",
    mdca: "mdca",
    "mdcf%": "mdcf_pct",
    mdgf: "mdgf",
    mdga: "mdga",
    "mdgf%": "mdgf_pct",
    ldcf: "ldcf",
    ldca: "ldca",
    "ldcf%": "ldcf_pct",
    ldgf: "ldgf",
    ldga: "ldga",
    "ldgf%": "ldgf_pct",
    "on-ice sh%": "on_ice_sh_pct",
    "on-ice sv%": "on_ice_sv_pct",
    pdo: "pdo",
    "off. zone starts": "off_zone_starts",
    "neu. zone starts": "neu_zone_starts",
    "def. zone starts": "def_zone_starts",
    "on the fly starts": "on_the_fly_starts",
    "off. zone start %": "off_zone_start_pct",
    "off. zone faceoffs": "off_zone_faceoffs",
    "neu. zone faceoffs": "neu_zone_faceoffs",
    "def. zone faceoffs": "def_zone_faceoffs",
    "off. zone faceoff %": "off_zone_faceoff_pct"
  };

  if (oiCounts[key] !== undefined) return oiCounts[key];

  // On-ice (OI) rates per-60 variants
  const oiRates: Record<string, string> = {
    "cf/60": "cf_per_60",
    "ca/60": "ca_per_60",
    "ff/60": "ff_per_60",
    "fa/60": "fa_per_60",
    "sf/60": "sf_per_60",
    "sa/60": "sa_per_60",
    "gf/60": "gf_per_60",
    "ga/60": "ga_per_60",
    "xgf/60": "xgf_per_60",
    "xga/60": "xga_per_60",
    "scf/60": "scf_per_60",
    "sca/60": "sca_per_60",
    "hdcf/60": "hdcf_per_60",
    "hdca/60": "hdca_per_60",
    "hdgf/60": "hdgf_per_60",
    "hdga/60": "hdga_per_60",
    "mdcf/60": "mdcf_per_60",
    "mdca/60": "mdca_per_60",
    "mdgf/60": "mdgf_per_60",
    "mdga/60": "mdga_per_60",
    "ldcf/60": "ldcf_per_60",
    "ldca/60": "ldca_per_60",
    "ldgf/60": "ldgf_per_60",
    "ldga/60": "ldga_per_60",
    "off. zone starts/60": "off_zone_starts_per_60",
    "neu. zone starts/60": "neu_zone_starts_per_60",
    "def. zone starts/60": "def_zone_starts_per_60",
    "on the fly starts/60": "on_the_fly_starts_per_60",
    "off. zone faceoffs/60": "off_zone_faceoffs_per_60",
    "neu. zone faceoffs/60": "neu_zone_faceoffs_per_60",
    "def. zone faceoffs/60": "def_zone_faceoffs_per_60"
  };

  if (oiRates[key] !== undefined) return oiRates[key];

  return map[key] ?? null;
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

function cleanHeader(h: string): string {
  return h
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // remove zero-width chars (ZWSP, ZWNJ, ZWJ, BOM)
    .replace(/[\u00A0\u202F]+/g, " ") // NBSP, narrow NBSP → normal space
    .replace(/\s*\/\s*/g, "/") // normalize spaces around '/'
    .replace(/\s+/g, " ")
    .trim();
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
      const response = await nstGet(url, 30000);

      if (!response.data) {
        console.warn(
          `No data received from URL: ${url} on attempt ${attempt}.`
        );
        if (attempt === retries) return { success: false, data: [] };
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
        continue;
      }

      // Build headers: pick the thead row whose TH count matches first row TD count
      const headers: string[] = [];
      const theadRows = table.find("thead tr");
      const firstBodyRow = table.find("tbody tr").first();
      const tdCount = firstBodyRow.find("td").length;
      let chosenIndex = -1;
      theadRows.each((idx, trEl) => {
        const ths = $(trEl).find("th");
        if (ths.length === tdCount && chosenIndex === -1) {
          chosenIndex = idx;
        }
      });
      const chosenRow =
        chosenIndex >= 0 ? theadRows.eq(chosenIndex) : theadRows.last();
      const chosenThCount = chosenRow.find("th").length;
      console.log(
        `Header selection: tdCount=${tdCount}, chosenTheadIndex=${chosenIndex}, chosenThCount=${chosenThCount}`
      );
      chosenRow.find("th").each((_, th) => {
        const text = cleanHeader($(th).text());
        // Keep empty header cells (e.g., rank column) to maintain index alignment
        headers.push(text);
      });
      if (headers.length !== tdCount) {
        console.warn(
          `Header/TD mismatch after selection: headers=${headers.length} tds=${tdCount}`
        );
      }

      if (!headers.includes("Player")) {
        console.warn(
          `Table found, but missing expected 'Player' header at ${url}. Attempt ${attempt}.`
        );
        if (attempt === retries) return { success: false, data: [] };
        continue;
      }

      const mappedHeaders = headers.map(mapHeaderToColumn);
      const mappedCount = mappedHeaders.filter(Boolean).length;
      if (mappedCount < headers.length * 0.7) {
        console.warn(
          `Low mapped header ratio: ${mappedCount}/${headers.length} for ${url}`
        );
        console.warn("HEADERS:", headers);
        console.warn(
          "HEADERS→COLUMNS:",
          headers.map((h) => [h, mapHeaderToColumn(h)])
        );
      }
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
                const num = parseFloat(cellText.replace(/,/g, ""));
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
      // rely on global NST limiter for spacing between attempts
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
        // NST uses tgp=410 for rate pages in some views; counts can remain 0
        let tgp = rate === "n" ? "0" : "410";
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
  banner(
    `Starting processing | URLs: ${urlsQueue.length} | Full Refresh: ${isFullRefresh}`
  );
  let totalProcessed = 0;
  let totalRowsProcessed = 0;

  for (let i = 0; i < urlsQueue.length; i++) {
    const item = urlsQueue[i];
    const { datasetType, url, date, seasonId } = item;

    section(`Processing: ${datasetType} for Date: ${date}`);
    console.log(
      `Progress: [${totalProcessed + 1}/${urlsQueue.length}] /// ${(
        ((totalProcessed + 1) / urlsQueue.length) *
        100
      ).toFixed(1)}%\n`
    );
    console.log(`URL: ${url}`);

    // rely on global NST limiter; do not add extra spacing here

    let shouldFetch = true;
    let skipReason = "";

    if (!isFullRefresh) {
      const dataExists = await checkDataExists(datasetType, date);
      if (dataExists) {
        const tableName = getTableName(datasetType);
        const complete = await dateIsComplete(tableName, date);
        if (complete) {
          shouldFetch = false;
          skipReason =
            "Data already exists and appears complete (incremental update).";
        } else {
          console.log(
            `Existing data for ${date} in ${tableName} appears incomplete; refetching.`
          );
        }
      }
    } else {
      skipReason =
        "Full refresh requested, fetching regardless of existing data.";
      console.log(
        `\nFull refresh\nOverwrite = ${isFullRefresh},\nMode = ${
          isFullRefresh ? "Full" : "Incremental"
        }\n`
      );
    }

    let fetchSuccess = false;
    let parseResult: any[] = [];
    let upsertSuccess = false;
    let upsertedCount = 0;

    if (shouldFetch) {
      console.log("\nFetching NST data from URL\n");
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

        console.log(`\nTarget Table: "${getTableName(datasetType)}"`);
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

  console.log(SEP);
  console.log(
    `|======= INFO [${totalUrlCount.current}/${totalUrlCount.total}] =======|`
  );
  console.log("|");
  console.log(`| Date: ${date}`);
  console.log(`| Type: ${datasetType}`);
  console.log(`| Table: ${tableName}`);
  console.log("|");
  console.log(`| Processed: ${rowsProcessed}`);
  console.log(`| Prepared: ${rowsPrepared}`);
  console.log(`| Upserted: ${rowsUpserted}`);
  console.log(`| Errors: 0`);
  console.log("|");
  console.log(`|==============================|`);
  console.log(SEP);
}

function printTotalProgress(current: number, total: number) {
  if (total === 0) return;
  const percentage = (current / total) * 100;
  const filled = Math.floor((percentage / 100) * 20);
  const bar =
    "Progress: [" + "#".repeat(filled) + ".".repeat(20 - filled) + "]";
  console.log(`${bar} ${percentage.toFixed(1)}% (${current}/${total})`);
  console.log(
    "\n|==============================|\n|==============================|\n"
  );
}

// --- Main Orchestration Function ---
async function main(
  runMode: RunMode,
  options?: { startDate?: string; overwrite?: boolean }
) {
  const isForwardFull = runMode === "forward";
  const isReverseFull = runMode === "reverse";
  const overwriteRequested = options?.overwrite;
  // Preserve legacy behavior by default: forward/reverse overwrite=true, incremental overwrite=false
  const fullRefreshFlag = (mode: RunMode) =>
    mode === "forward" || mode === "reverse"
      ? (overwriteRequested ?? true)
      : (overwriteRequested ?? false);
  banner(
    `Script execution started. Mode: ${runMode}. Full Refresh: ${
      isForwardFull || isReverseFull
    }`
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
      // NOTE: Reverse mode logic is preserved as-is, per user request.
      // This logic path is separate from the incremental/forward fixes.
      const requestedStartDateStr = options?.startDate;
      const currentSeasonInfo = await fetchCurrentSeason();
      if (!currentSeasonInfo?.id) {
        throw new Error(
          "Could not determine the current season to start the reverse process."
        );
      }
      if (requestedStartDateStr) {
        console.log(
          `Reverse mode requested startDate=${requestedStartDateStr}`
        );
      }
      console.log(`Reverse mode start: ${currentSeasonInfo.id}`);

      const { data: allSeasons, error: seasonsError } = await supabase
        .from("seasons")
        .select("id, startDate, regularSeasonEndDate, endDate")
        .order("startDate", { ascending: false });

      if (seasonsError) throw seasonsError;
      if (!allSeasons || allSeasons.length === 0) {
        console.log("No seasons found in the database to process.");
        return;
      }

      // Print current season details if available
      const currentSeason = allSeasons.find(
        (s) => s.id === currentSeasonInfo.id
      );
      if (currentSeason) {
        section("Season Data");
        keyValuesBlock([
          ["Season ID", currentSeason.id],
          ["Start Date", (currentSeason as any).startDate],
          [
            "Regular Season End Date",
            (currentSeason as any).regularSeasonEndDate
          ],
          ["Playoffs End Date", (currentSeason as any).endDate]
        ]);
      }

      let startingIndex = -1;
      let clampFirstSeasonEndDate: string | null = null;
      if (requestedStartDateStr) {
        try {
          const reqDate = parse(
            requestedStartDateStr,
            "yyyy-MM-dd",
            new Date()
          );
          startingIndex = allSeasons.findIndex((s) => {
            const sStart = parseISO((s as any).startDate);
            const sEnd = parseISO(
              (s as any).regularSeasonEndDate || (s as any).endDate
            );
            return reqDate >= sStart && reqDate <= sEnd;
          });
          if (startingIndex !== -1) {
            clampFirstSeasonEndDate = requestedStartDateStr;
          }
        } catch (e) {
          console.warn(
            `Invalid startDate provided ("${requestedStartDateStr}"). Falling back to current season.`
          );
        }
      }
      if (startingIndex === -1) {
        startingIndex = allSeasons.findIndex(
          (s) => s.id === currentSeasonInfo.id
        );
      }

      let seasonsToProcess = [];
      if (startingIndex !== -1) {
        seasonsToProcess = allSeasons.slice(startingIndex);
        console.log(
          `Found ${seasonsToProcess.length} seasons to process in reverse.`
        );
      } else {
        console.warn(
          `Current season ${currentSeasonInfo.id} not found in the Supabase 'seasons' table. Aborting reverse run.`
        );
        return;
      }

      const reverseQueue: UrlQueueItem[] = [];
      // Clamp reverse enumeration to 'today' to avoid requesting future dates that NST may
      // silently coerce to season-to-date cumulative results.
      const nowEST = toZonedTime(new Date(), "America/New_York");
      const todayStr = tzFormat(nowEST, "yyyy-MM-dd");
      for (let idx = 0; idx < seasonsToProcess.length; idx++) {
        const s = seasonsToProcess[idx];
        const seasonStartStr = (s as any).startDate;
        const seasonEndStr =
          (s as any).regularSeasonEndDate || (s as any).endDate;
        const effectiveEndStr =
          idx === 0 && clampFirstSeasonEndDate
            ? clampFirstSeasonEndDate
            : seasonEndStr;
        // Final end bound is the earlier of the season end and 'today'
        const finalEndStr =
          effectiveEndStr < todayStr ? effectiveEndStr : todayStr;
        if (seasonStartStr > finalEndStr) {
          console.log(
            `Skipping season ${String(
              s.id
            )}: start ${seasonStartStr} > endBound ${finalEndStr} (future-only)`
          );
          continue;
        }
        const dates = getDatesBetween(
          parseISO(seasonStartStr),
          parseISO(finalEndStr)
        ).reverse();
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
      }

      const processedPlayerIds = new Set<number>();
      const failedUrls: UrlQueueItem[] = [];
      console.log(
        `Starting for ${reverseQueue.length} URLs. \nFull Refresh: ${fullRefreshFlag(
          "reverse"
        )}`
      );
      const initialResult = await processUrls(
        reverseQueue,
        fullRefreshFlag("reverse"),
        processedPlayerIds,
        failedUrls
      );
      totalRowsAffected += initialResult.totalRowsProcessed || 0;

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
            isReverseFull: fullRefreshFlag("reverse"),
            endTime: new Date().toISOString()
          }
        }
      ]);
      console.log(
        `Reverse full-refresh complete: ${totalRowsAffected} rows affected.`
      );
      return;
    }

    // --- Refactored Logic for Incremental and Forward Modes ---
    const timeZone = "America/New_York";

    const { data: allSeasons, error: seasonsError } = await supabase
      .from("seasons")
      .select("id, startDate, regularSeasonEndDate, endDate")
      .order("startDate", { ascending: true });

    if (seasonsError) {
      throw new Error(`Failed to fetch seasons: ${seasonsError.message}`);
    }
    if (!allSeasons || allSeasons.length === 0) {
      throw new Error("No seasons found in the database.");
    }

    const getSeasonInfoForDate = (dateStr: string) => {
      const date = toZonedTime(parseISO(dateStr), timeZone);
      const season = allSeasons.find((s) => {
        const start = toZonedTime(parseISO(s.startDate), timeZone);
        const end = toZonedTime(parseISO(s.endDate), timeZone);
        return date >= start && date <= end;
      });

      if (season) {
        const regEnd = toZonedTime(
          parseISO(season.regularSeasonEndDate),
          timeZone
        );
        return {
          seasonId: season.id.toString(),
          isPlayoffs: isAfter(date, regEnd)
        };
      }
      return null; // Off-season
    };

    const todayEST = toZonedTime(new Date(), timeZone);
    let startDate: Date;

    if (isForwardFull) {
      const currentSeasonInfo = getSeasonInfoForDate(
        tzFormat(todayEST, "yyyy-MM-dd")
      );
      let seasonToRefresh;
      if (currentSeasonInfo) {
        seasonToRefresh = allSeasons.find(
          (s) => s.id.toString() === currentSeasonInfo.seasonId
        );
      } else {
        seasonToRefresh = allSeasons[allSeasons.length - 1];
      }
      startDate = toZonedTime(parseISO(seasonToRefresh!.startDate), timeZone);
      console.log(
        `Full Refresh: Starting from season start date: ${tzFormat(
          startDate,
          "yyyy-MM-dd"
        )}`
      );
    } else {
      // Incremental mode
      const requestedStartDateStr = options?.startDate;
      if (requestedStartDateStr) {
        try {
          startDate = toZonedTime(parseISO(requestedStartDateStr), timeZone);
          console.log(
            `Incremental Update: User specified start date. Starting from ${tzFormat(
              startDate,
              "yyyy-MM-dd"
            )}.`
          );
        } catch (e) {
          throw new Error(
            `Invalid startDate parameter: "${requestedStartDateStr}". Please use YYYY-MM-DD format.`
          );
        }
      } else {
        // If no start date is provided, fall back to default incremental logic
        const latestDateStr = await getLatestDateSupabase();
        if (latestDateStr) {
          const latestDateLocal = parse(
            latestDateStr,
            "yyyy-MM-dd",
            new Date()
          );
          startDate = addDays(latestDateLocal, 1);
          startDate = toZonedTime(startDate, timeZone);
          console.log(
            `Incremental Update: Latest date is ${latestDateStr}. Starting from ${tzFormat(
              startDate,
              "yyyy-MM-dd"
            )}.`
          );
        } else {
          startDate = toZonedTime(parseISO(allSeasons[0].startDate), timeZone);
          console.log(
            `Incremental Update: No existing data. Starting from first season start date ${tzFormat(
              startDate,
              "yyyy-MM-dd"
            )}.`
          );
        }
      }
    }

    const scrapingEndDate = todayEST;
    console.log(
      `Effective scraping end date: ${tzFormat(scrapingEndDate, "yyyy-MM-dd")}`
    );

    const allDatesToScrape = getDatesBetween(startDate, scrapingEndDate);

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

    console.log(
      `Planning to scrape ${allDatesToScrape.length} dates from ${
        allDatesToScrape[0]
      } to ${allDatesToScrape[allDatesToScrape.length - 1]}`
    );

    const initialUrlsQueue: UrlQueueItem[] = [];
    for (const date of allDatesToScrape) {
      const seasonInfoForDate = getSeasonInfoForDate(date);

      if (!seasonInfoForDate) {
        console.log(`Date ${date} is in the off-season. Skipping.`);
        continue;
      }

      const { seasonId, isPlayoffs } = seasonInfoForDate;
      const urls = constructUrlsForDate(date, seasonId, isPlayoffs);
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
      fullRefreshFlag(isForwardFull ? "forward" : "incremental"),
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

    if (isForwardFull) {
      console.log(
        "Skipping NHL API cross-reference in this refactored version as it would require significant changes to support multi-season refreshes."
      );
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

// http://localhost:3000/api/v1/db/update-nst-gamelog?runMode=incremental
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
  let startDate: string | undefined;
  let overwrite: boolean | undefined;

  if (req.method === "POST") {
    const mode = req.body?.runMode;
    if (mode && ["incremental", "forward", "reverse"].includes(mode)) {
      runMode = mode;
    }
    if (typeof req.body?.startDate === "string") {
      startDate = req.body.startDate;
    }
    if (typeof req.body?.overwrite !== "undefined") {
      const v = req.body.overwrite;
      if (typeof v === "string") {
        overwrite = ["yes", "true", "1"].includes(v.toLowerCase());
      } else if (typeof v === "number") {
        overwrite = v === 1;
      } else if (typeof v === "boolean") {
        overwrite = v;
      }
    }
  } else {
    // GET
    const modeQuery = req.query.runMode;
    if (
      typeof modeQuery === "string" &&
      ["incremental", "forward", "reverse"].includes(modeQuery)
    ) {
      runMode = modeQuery as RunMode;
    }
    if (typeof req.query.startDate === "string") {
      startDate = req.query.startDate as string;
    }
    const ow = req.query.overwrite;
    if (typeof ow === "string") {
      overwrite = ["yes", "true", "1"].includes(ow.toLowerCase());
    }
  }

  console.log(
    `API request received. runMode=${runMode}, startDate=${startDate || "none"}, overwrite=${
      overwrite === undefined ? "default" : overwrite
    }`
  );
  banner(
    `API request: mode=${runMode} | startDate=${startDate || "none"} | overwrite=${
      overwrite === undefined ? "default" : overwrite
    }`
  );
  try {
    await main(runMode, { startDate, overwrite });
    return res
      .status(200)
      .json({ message: "Done", runMode, startDate, overwrite });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
