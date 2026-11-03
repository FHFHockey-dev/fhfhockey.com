import { withNstJobLifecycle } from "lib/nst/jobLifecycle.server";
import { createHash } from "node:crypto";
import { NstExecutionLimitError, type NstRequestControl } from "lib/nst/requestBudget";
import { completedGoalieDate } from "lib/nst/goalieCatchup";
import { runGoalieCatchupStep, type GoalieSourceResult } from "lib/nst/goalieCatchup.server";
import { prepareGoalieCatchup } from "lib/nst/goaliePreparation.server";
// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/api/v1/db/update-nst-goalies.ts

/**
 * This API route is responsible for scraping and updating goalie game log data from Natural Stat Trick (NST).
 * It supports several modes of operation, controlled by query parameters.
 *
 * --- Query Parameters ---
 *
 * 1. `runMode` (optional): Specifies the operation mode for the data fetch.
 *    - `incremental` (default): Fetches data from the last successfully scraped date up to the current date.
 *      This is the most common mode for daily updates.
 *      Example: /api/v1/db/update-nst-goalies
 *      Example: /api/v1/db/update-nst-goalies?runMode=incremental
 *
 *    - `forward`: Performs a full refresh of the current season's data from its start date to the current date.
 *      Useful for correcting widespread data issues within the current season.
 *      Example: /api/v1/db/update-nst-goalies?runMode=forward
 *
 *    - `reverse`: Fetches all historical data for all past seasons, starting from the most recent season and going
 *      backward in time. This is a heavy operation intended for initial data backfills or major historical updates.
 *      It can be combined with the `startDate` parameter to begin the process from a specific point in the past.
 *      Example: /api/v1/db/update-nst-goalies?runMode=reverse
 *
 * 2. `startDate` (optional): Used exclusively with `runMode=reverse` or `runMode=incremental`.
 *    - In `reverse` mode: Defines the starting date for the historical data fetch. The script will identify the season
 *      corresponding to this date and begin its reverse chronological fetch from there.
 *    - In `incremental` mode: Defines the starting date for the forward fetch. The script will fetch data from this date
 *      up to the current date.
 *    The format must be YYYY-MM-DD.
 *
 *    Example: /api/v1/db/update-nst-goalies?runMode=reverse&startDate=2024-02-05
 *    Example: /api/v1/db/update-nst-goalies?runMode=incremental&startDate=2025-10-01
 *
 * 3. `overwrite` (optional): Controls whether to re-fetch and overwrite existing dates.
 *    - Accepted: `yes` | `no` (also `true` | `false`, `1` | `0`)
 *    - Defaults preserve current behavior:
 *      - reverse/forward: overwrite defaults to yes (full-refresh)
 *      - incremental: overwrite defaults to no (skip complete dates)
 *    Example: /api/v1/db/update-nst-goalies?runMode=reverse&overwrite=no
 *
 *    /api/v1/db/update-nst-goalies?runMode=incremental&overwrite=yes&startDate=2026-03-01
 *
 * 4. `datasetType` (optional): Filters the operation to a specific dataset type.
 *    Useful for debugging or targeting a specific table.
 *    Example: /api/v1/db/update-nst-goalies?runMode=forward&datasetType=ppRates
 *
 * 5. `catchupScope`: Runs one bounded step of a previously persisted checkpoint
 *    cohort. May only be combined with the runner's `deadlineAt`. Requires the
 *    checkpoint SQL, final-day evidence and exclusive NST clearance; disabled
 *    control or missing prerequisites never fall back to legacy provider work.
 *
 * --- How It Works ---
 *
 * - The script initiates a connection to a Supabase database to store the scraped data.
 * - It constructs URLs for the Natural Stat Trick website based on the date range and game situations (e.g., even strength, power play).
 * - A rate limiter is used to avoid sending too many requests to the NST server in a short period.
 * - It uses `axios` to fetch the HTML content and `cheerio` to parse the data tables.
 * - Goalie names are normalized and mapped to corresponding player IDs in the database.
 * - The parsed and cleaned data is then "upserted" into the appropriate Supabase tables.
 * - The entire process is logged in a `cron_job_audit` table for monitoring and debugging.
 */

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { withNhlOffSeasonSkip } from "lib/cron/nhlOffSeason";
import adminOnly from "utils/adminOnlyMiddleware";
import {
  DEFAULT_MAX_PENDING_URLS_PER_RUN,
  NST_GOALIES_REQUEST_INTERVAL_MS,
  NST_STRICT_MAX_URLS_PER_RUN,
  resolveGoalieNstRequestPlan
} from "lib/cron/nstBurstPlans";
import type { NextApiRequest, NextApiResponse } from "next";
import * as cheerio from "cheerio";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import {
  fetchNstTextByUrl,
  isNstAuthError,
  isNstConfigError,
  isNstRateLimitError
} from "lib/nst/client";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import { parseISO } from "date-fns";

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey: string | undefined = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Service Role Key is missing.");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Delay interval between requests in milliseconds
const BASE_URL = "https://data.naturalstattrick.com/playerteams.php";

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

function parsePositiveIntParam(
  value: string | string[] | undefined
): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

type RunMode = "incremental" | "forward" | "reverse";

function parseRunMode(value: string | string[] | undefined): RunMode {
  const raw = (Array.isArray(value) ? value[0] : value)?.toLowerCase();
  if (raw === "forward" || raw === "reverse" || raw === "incremental") {
    return raw;
  }
  return "incremental";
}

function parseBooleanParam(
  value: string | string[] | undefined
): boolean | undefined {
  const raw = (Array.isArray(value) ? value[0] : value)?.toLowerCase();
  if (!raw) return undefined;
  if (["yes", "true", "1"].includes(raw)) return true;
  if (["no", "false", "0"].includes(raw)) return false;
  return undefined;
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
const goalieNameMapping: Record<string, { fullName: string }> = {
  "Jacob Markstrom": { fullName: "Jacob Markstrom" },
  "Sam Montembeault": { fullName: "Samuel Montembeault" }
  // Add additional goalie mappings here if needed.
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\-']/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const troublesomePlayers: string[] = [];

async function boundedGoalieQuery<T>(query: PromiseLike<T>, deadlineAt: number, timeoutMs = 5_000): Promise<T> {
  const controller = new AbortController();
  const remaining = Math.min(timeoutMs, deadlineAt - Date.now());
  if (remaining <= 0) throw new Error("Goalie database deadline exhausted.");
  const abortable = query as PromiseLike<T> & { abortSignal?: (signal: AbortSignal) => PromiseLike<T> };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      abortable.abortSignal ? abortable.abortSignal(controller.signal) : query,
      new Promise<never>((_, reject) => { timer = setTimeout(() => {
        controller.abort();
        reject(new Error("Goalie database acknowledgement timed out."));
      }, remaining); }),
    ]);
  } finally { clearTimeout(timer); }
}

async function getGoalieIdByName(
  fullName: string,
  position: string,
  deadlineAt: number,
  exactIdentity = false
): Promise<number | null> {
  const mappedName = goalieNameMapping[fullName]
    ? goalieNameMapping[fullName].fullName
    : fullName;
  const normalizedFullName = normalizeName(mappedName);
  const goaliePosition = "G"; // Force goalie position

  const identityQuery = supabase
    .from("players")
    .select("id");
  const { data, error } = await boundedGoalieQuery((exactIdentity
    ? identityQuery.eq("fullName", mappedName)
    : identityQuery.ilike("fullName", `%${mappedName}%`))
    .eq("position", goaliePosition)
    .limit(exactIdentity ? 2 : 1)
    .maybeSingle(), deadlineAt);

  if (error) return null;
  if (!data) {
    troublesomePlayers.push(`${fullName} (${position})`);
    return null;
  }
  return data.id;
}

function constructGoalieUrlsForDate(
  date: string,
  seasonId: string
): Record<string, string> {
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

async function fetchAndParseData(
  url: string,
  datasetType: string,
  date: string,
  seasonId: string,
  retries: number = 1,
  requestControl?: NstRequestControl,
  proof?: { sourceFingerprint?: string }
): Promise<any[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Fetching data from URL: ${url} (Attempt ${attempt})`);
      const { text } = await fetchNstTextByUrl(url, { timeoutMs: 30000, requestControl });
      if (!text) {
        throw new Error("NST returned no response body.");
      }
      const $ = cheerio.load(text);
      const table = $("table").first();
      if (table.length === 0) {
        throw new Error("NST response did not contain a goalie table.");
      }
      const headers: string[] = [];
      table.find("thead tr th").each((_, th) => {
        headers.push($(th).text().trim());
      });

      if (!headers.includes("Player") || !headers.includes("Team")) throw new Error("NST goalie table headers are invalid.");
      const mappedHeaders = headers.map((header) =>
        mapGoalieHeaderToColumn(header, datasetType)
      );
      if (proof) {
        const required = datasetType.endsWith("Counts")
          ? ["gp", "toi", "shots_against", "saves", "goals_against", "xg_against", "hd_shots_against", "hd_saves"]
          : ["gp", "toi", "toi_per_gp", "shots_against_per_60", "saves_per_60", "gaa", "xg_against_per_60", "hd_shots_against_per_60", "hd_saves_per_60"];
        if (required.some(field => !mappedHeaders.includes(field)) || new Set(headers).size !== headers.length) {
          throw new Error("NST checkpoint headers are incomplete or ambiguous.");
        }
        proof.sourceFingerprint = createHash("sha256").update(text).digest("hex");
      }

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
            if (proof && cellText === "") cellText = null;
            if (cellText === "-" || cellText === "\\-") {
              cellText = null;
            }
            if (cellText !== null) {
              if (proof && !/^-?[\d,]+(?:\.\d+)?%?$/.test(cellText)) throw new Error("NST checkpoint numeric cell is invalid.");
              const num = Number(cellText.replace(/[^0-9.-]+/g, ""));
              rowData[column] = isNaN(num) ? cellText : num;
            } else {
              rowData[column] = null;
            }
          });

        if (playerName && team && Object.keys(rowData).length > 0) {
          rowData["player_name"] = playerName;
          rowData["team"] = team;
          rowData["date_scraped"] = date;
          rowData["season"] = parseInt(seasonId, 10);
          dataRowsCollected.push(rowData);
        } else {
          console.warn(`Incomplete data row skipped for URL: ${url}`);
        }
      });

      if (dataRowsCollected.length !== table.find("tbody tr").length) throw new Error("NST goalie rows could not be completely parsed.");
      console.log(
        `Parsed ${dataRowsCollected.length} rows for datasetType "${datasetType}".`
      );
      return dataRowsCollected;
    } catch (error: any) {
      if (
        error instanceof NstExecutionLimitError ||
        isNstAuthError(error) ||
        isNstConfigError(error) ||
        isNstRateLimitError(error)
      ) {
        throw error;
      }
      console.error(
        `Attempt ${attempt} - Error fetching ${url}:`,
        error.message
      );
      if (attempt === retries) {
        console.error(
          `Failed to fetch data from ${url} after ${retries} attempts.`
        );
        throw error;
      }
      await delay(5000);
    }
  }
  return [];
}

async function upsertData(datasetType: string, dataRows: any[], deadlineAt = Date.now() + 20_000) {
  if (dataRows.length === 0) {
    console.warn(`No data rows to upsert for datasetType "${datasetType}".`);
    return;
  }
  const tableName = getGoalieTableName(datasetType);
  if (tableName === "unknown_goalie_table") {
    throw new Error("Unknown goalie output table.");
  }

  const dataRowsWithPlayerIds: any[] = [];
  for (const row of dataRows) {
    const goalieId = await getGoalieIdByName(row["player_name"], row["team"], deadlineAt);
    if (!goalieId) {
      console.warn(
        `Player ID not found for ${row["player_name"]} (${row["team"]})`
      );
      continue;
    }
    row["player_id"] = goalieId;
    dataRowsWithPlayerIds.push(row);
  }

  if (dataRowsWithPlayerIds.length !== dataRows.length) throw new Error("Goalie identities are unresolved; no output write started.");
  console.log(
    `Upserting ${dataRowsWithPlayerIds.length} rows into table "${tableName}".`
  );
  const receipt = await boundedGoalieQuery(supabase
    .from(tableName)
    .upsert(dataRowsWithPlayerIds, { onConflict: "player_id,date_scraped" }), deadlineAt, 15_000);
  if (!receipt || receipt.error !== null) throw new Error("Goalie output persistence was not acknowledged; inspect before replaying.");
  console.log(`Successfully acknowledged goalie upsert into "${tableName}".`);
}

async function checkDataExists(
  datasetType: string,
  date: string,
  deadlineAt = Date.now() + 5_000
): Promise<boolean> {
  const tableName = getGoalieTableName(datasetType);
  if (tableName === "unknown_goalie_table") {
    console.warn(
      `Skipping data existence check for unknown table for datasetType "${datasetType}".`
    );
    return false;
  }
  const { data, error } = await boundedGoalieQuery(supabase
    .from(tableName)
    .select("player_id")
    .eq("date_scraped", date)
    .limit(1), deadlineAt);
  if (error) {
    throw new Error(`Goalie coverage read failed for ${tableName}; no missing-work assumption is safe.`);
  }
  const exists = data && data.length > 0;
  console.log(`Data existence check for "${tableName}" on ${date}: ${exists}`);
  return exists;
}

// New helper to process a single URL (used for concurrent fetching)
async function processSingleUrl({
  datasetType,
  url,
  date,
  seasonId
}: {
  datasetType: string;
  url: string;
  date: string;
  seasonId: string;
}) {
  console.log(`Processing URL for ${datasetType} on ${date}`);
  const dataExists = await checkDataExists(datasetType, date);
  if (!dataExists) {
    const dataRows = await fetchAndParseData(url, datasetType, date, seasonId);
    if (dataRows.length > 0) {
      await upsertData(datasetType, dataRows);
    }
  } else {
    console.log(`Data already exists for ${datasetType} on ${date}. Skipping.`);
  }
}

// Existing sequential processing function (kept for cases with more than 2 days of data)
async function processUrlsSequentially(
  urlsQueue: { datasetType: string; url: string; date: string; seasonId: string }[],
  options: { requestIntervalMs: number; maxPendingUrls?: number; overwrite: boolean;
    requestControl: NstRequestControl; startIndex: number; existing: readonly boolean[] }
) {
  let pendingProcessedCount = 0;
  let nextCursor = options.startIndex;
  let acknowledgedWriteUrls = 0;
  let emptyValidUrls = 0;
  let failed = false;
  let requiresReview = false;
  const urlProgress: Array<{ datasetType: string; date: string;
    status: "processed" | "skipped" | "empty_valid" | "deferred" | "failed";
    startedAt: string; finishedAt: string; durationMs: number; rowCount: number; reason?: string }> = [];
  for (let i = options.startIndex; i < urlsQueue.length; i++) {
    const { datasetType, url, date, seasonId } = urlsQueue[i];
    const startedAt = Date.now();
    let writeStarted = false;
    try {
      const exists = options.existing[i];
      let rows: any[] = [];
      if (!exists) {
        if (Date.now() + options.requestIntervalMs + 35_000 >= options.requestControl.deadlineAt) {
          throw new NstExecutionLimitError("NST goalie admission cannot fit provider and persistence headroom.");
        }
        if (options.requestIntervalMs > 0) await delay(options.requestIntervalMs);
        rows = await fetchAndParseData(url, datasetType, date, seasonId, 1, options.requestControl);
        if (rows.length) { writeStarted = true; await upsertData(datasetType, rows, options.requestControl.deadlineAt); acknowledgedWriteUrls++; }
        else emptyValidUrls++;
        pendingProcessedCount++;
      }
      urlProgress.push({ datasetType, date, status: exists ? "skipped" : rows.length ? "processed" : "empty_valid",
        startedAt: new Date(startedAt).toISOString(), finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt, rowCount: rows.length });
      nextCursor = i + 1;
    } catch (error) {
      const deferred = !writeStarted && error instanceof NstExecutionLimitError && !error.dispatchStarted;
      failed = !deferred;
      requiresReview = writeStarted || (error instanceof NstExecutionLimitError && error.dispatchStarted);
      urlProgress.push({ datasetType, date, status: deferred ? "deferred" : "failed",
        startedAt: new Date(startedAt).toISOString(), finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt, rowCount: 0,
        reason: error instanceof Error ? error.message : "Unresolved goalie source or output." });
      break;
    }
    if (options.maxPendingUrls !== undefined && pendingProcessedCount >= options.maxPendingUrls) break;
  }
  return { pendingProcessedCount, nextCursor, acknowledgedWriteUrls, emptyValidUrls, failed, requiresReview,
    stoppedEarly: nextCursor < urlsQueue.length, unattemptedUrls: urlsQueue.length - nextCursor - (failed ? 1 : 0), urlProgress };
}

async function main(
  options: {
    maxPendingUrls?: number;
    requestIntervalMs?: number;
    startDate?: string;
    maxDays?: number;
    runMode?: RunMode;
    overwrite?: boolean;
    datasetType?: string;
    cursor?: number;
    resumeScope?: string;
    plannedUrls?: number;
    deadlineAt?: number;
  } = {}
) {
  const startedAt = Date.now();
  const deadlineAt = Math.min(startedAt + 220_000, options.deadlineAt ?? Infinity);
  try {
    const runMode = options.runMode ?? "incremental";
    const overwrite =
      options.overwrite ?? (runMode === "incremental" ? false : true);

    const seasonInfo = await boundedGoalieQuery(fetchCurrentSeason(), deadlineAt);
    const seasonId = seasonInfo.id.toString();
    const seasonStartDate = parseISO(seasonInfo.startDate);
    const regularSeasonEndDateIso =
      seasonInfo.regularSeasonEndDate ?? seasonInfo.endDate;
    if (!regularSeasonEndDateIso) {
      throw new Error("Current season is missing a regular-season end date.");
    }
    const regularSeasonEndDate = parseISO(regularSeasonEndDateIso);
    const lastCompletedDate = parseISO(completedGoalieDate(new Date()));
    const scrapingEndDate =
      lastCompletedDate < regularSeasonEndDate ? lastCompletedDate : regularSeasonEndDate;

    let startDate = seasonStartDate;
    if (options.startDate) {
      startDate = parseISO(options.startDate);
      console.log(`Using explicit startDate ${options.startDate}.`);
    } else if (runMode === "incremental") {
      const latestDateStr = await getLatestDateSupabase(deadlineAt);
      if (latestDateStr) {
        startDate = parseISO(latestDateStr);
        console.log(
          `Latest date in Supabase is ${latestDateStr}. Resuming from that date to catch partial/incomplete datasets.`
        );
      } else {
        console.log(
          `No existing data in Supabase. Starting from season start date ${
            startDate.toISOString().split("T")[0]
          }.`
        );
      }
    }

    if (startDate < seasonStartDate) {
      startDate = seasonStartDate;
    }

    if (startDate > regularSeasonEndDate) {
      console.log(
        `Start date ${startDate.toISOString().split("T")[0]} is after regular season end ${regularSeasonEndDateIso}. No regular-season NST goalie dates to scrape.`
      );
      return {
        success: true, complete: true, operationStatus: "complete", requiresReview: false,
        message: "No regular-season NST goalie dates to scrape.",
        pendingUrlsProcessed: 0,
        totalQueuedUrls: 0,
        stoppedEarly: false,
        datesQueued: 0,
        requestIntervalMs:
          options.requestIntervalMs ?? NST_GOALIES_REQUEST_INTERVAL_MS,
        maxPendingUrls: options.maxPendingUrls ?? null,
        runMode,
        overwrite,
        datasetType: options.datasetType ?? null,
        nextStartDate: null,
        nstRequestPlan: resolveGoalieNstRequestPlan({
          queuedDates: 0,
          totalQueuedUrls: 0,
          maxPendingUrls:
            options.maxPendingUrls ?? DEFAULT_MAX_PENDING_URLS_PER_RUN,
          explicitRequestIntervalMs: options.requestIntervalMs
        })
      };
    }

    if (runMode === "reverse") {
      console.warn(
        "runMode=reverse currently runs as full forward season sweep in this endpoint."
      );
    }

    let datesToScrape = getDatesBetween(startDate, scrapingEndDate);
    datesToScrape = datesToScrape.filter((date) => {
      const current = parseISO(date);
      return current >= seasonStartDate && current <= regularSeasonEndDate;
    });
    if (options.maxDays && options.maxDays > 0) {
      datesToScrape = datesToScrape.slice(0, options.maxDays);
    }
    if (datesToScrape.length === 0) {
      console.log("No new dates to scrape.");
      return {
        success: true, complete: true, operationStatus: "complete", requiresReview: false,
        message: "No new dates to scrape.",
        pendingUrlsProcessed: 0,
        totalQueuedUrls: 0,
        stoppedEarly: false
      };
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
        if (options.datasetType && datasetType !== options.datasetType) {
          continue;
        }
        urlsQueue.push({ datasetType, url, date, seasonId });
      }
    });

    const startIndex = options.cursor ?? 0;
    if (!Number.isSafeInteger(startIndex) || startIndex < 0 || startIndex > urlsQueue.length ||
        (startIndex > 0 && !options.resumeScope) ||
        (options.resumeScope !== undefined && options.plannedUrls === undefined) ||
        (options.resumeScope === undefined && options.plannedUrls !== undefined)) {
      throw new Error("Goalie continuation needs its acknowledged whole-job request plan; reconcile legacy progress before resuming.");
    }
    const existing: boolean[] = Array(urlsQueue.length).fill(false);
    for (let index = startIndex; index < urlsQueue.length; index++) {
      if (Date.now() + 35_000 >= deadlineAt) throw new Error("Goalie coverage preflight exceeded its read budget; no provider request started.");
      existing[index] = !overwrite && await checkDataExists(urlsQueue[index].datasetType, urlsQueue[index].date, deadlineAt);
    }
    const pendingUrlsAtStart = existing.slice(startIndex).filter(value => !value).length;
    const plannedUrls = options.plannedUrls ?? pendingUrlsAtStart;
    if (!Number.isSafeInteger(plannedUrls) || plannedUrls < pendingUrlsAtStart || plannedUrls > urlsQueue.length) {
      throw new Error("Goalie pending work no longer fits its acknowledged whole-job plan.");
    }
    const scope = createHash("sha256").update(JSON.stringify({ runMode, overwrite, plannedUrls,
      queue: urlsQueue.map(({date,datasetType})=>[date,datasetType]) })).digest("hex");
    if (options.resumeScope !== undefined && options.resumeScope !== scope) {
      throw new Error("Goalie resume cursor/scope does not match the complete queue and request plan.");
    }
    const requestedMaxPendingUrls =
      options.maxPendingUrls ??
      (runMode === "forward" ? undefined : DEFAULT_MAX_PENDING_URLS_PER_RUN);
    const preliminaryNstRequestPlan = resolveGoalieNstRequestPlan({
      queuedDates: datesToScrape.length,
      totalQueuedUrls: urlsQueue.length,
      plannedRequestCount: plannedUrls,
      maxPendingUrls: requestedMaxPendingUrls ?? urlsQueue.length,
      explicitRequestIntervalMs: options.requestIntervalMs
    });
    const maxPendingUrls = preliminaryNstRequestPlan.burstAllowed
      ? requestedMaxPendingUrls
      : Math.min(
          requestedMaxPendingUrls ?? urlsQueue.length,
          NST_STRICT_MAX_URLS_PER_RUN
        );
    const nstRequestPlan = resolveGoalieNstRequestPlan({
      queuedDates: datesToScrape.length,
      totalQueuedUrls: urlsQueue.length,
      plannedRequestCount: plannedUrls,
      maxPendingUrls: maxPendingUrls ?? urlsQueue.length,
      explicitRequestIntervalMs: options.requestIntervalMs
    });
    const requestIntervalMs = nstRequestPlan.requestIntervalMs;

    const result = await processUrlsSequentially(urlsQueue, {
      requestIntervalMs,
      maxPendingUrls,
      overwrite,
      startIndex,
      existing,
      requestControl: { deadlineAt, maxAttempts: Math.max(1, plannedUrls * 3),
        attemptsStarted: 0, minIntervalMs: requestIntervalMs, plannedRequestCount: plannedUrls }
    });

    if (troublesomePlayers.length > 0) {
      const uniqueTroublesomePlayers = [...new Set(troublesomePlayers)];
      console.log(
        "Troublesome Players (require manual mapping):",
        uniqueTroublesomePlayers
      );
    }

    const canResume = result.stoppedEarly && !result.failed;
    const resumeQuery: Record<string,string> = { runMode, overwrite: String(overwrite),
      startDate: datesToScrape[0], maxDays: String(datesToScrape.length), cursor: String(result.nextCursor), resumeScope: scope,
      plannedUrls: String(plannedUrls),
      ...(options.datasetType ? {datasetType:options.datasetType}:{}),
      ...(options.maxPendingUrls !== undefined ? {maxUrls:String(options.maxPendingUrls)}:{}),
      ...(options.requestIntervalMs !== undefined ? {requestIntervalMs:String(options.requestIntervalMs)}:{}) };

    return {
      success: !result.stoppedEarly && !result.failed,
      complete: !result.stoppedEarly && !result.failed,
      operationStatus: result.failed ? "failed" : canResume ? "partial" : "complete",
      message: result.failed ? "Goalie work failed or remains uncertain; inspect source and output evidence."
        : canResume ? "Goalie work is incomplete; resume the first unacknowledged URL with the bounded query."
        : "Goalie queued execution completed; source coverage remains unverified.",
      nextCursor: result.nextCursor,
      acknowledgedWriteUrls: result.acknowledgedWriteUrls,
      emptyValidUrls: result.emptyValidUrls,
      unattemptedUrls: result.unattemptedUrls,
      rowsUpserted: null,
      sourceCoverage: "not_verified",
      requiresReview: result.requiresReview,
      retrySafe: canResume,
      ...(canResume ? { resume: { required: true, request: { query: resumeQuery } } } : {}),
      pendingUrlsProcessed: result.pendingProcessedCount,
      totalQueuedUrls: urlsQueue.length,
      plannedUrls,
      pendingUrlsAtStart,
      stoppedEarly: result.stoppedEarly,
      datesQueued: datesToScrape.length,
      requestIntervalMs,
      maxPendingUrls: maxPendingUrls ?? null,
      runMode,
      seasonStartDate: seasonInfo.startDate,
      regularSeasonEndDate: regularSeasonEndDateIso,
      overwrite,
      datasetType: options.datasetType ?? null,
      nextStartDate: result.stoppedEarly
        ? (urlsQueue[result.nextCursor]?.date ?? null)
        : null,
      urlProgress: result.urlProgress,
      nstRequestPlan
    };
  } catch (error: any) {
    console.error("An error occurred:", error.message);
    throw error;
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }
  try {
    if (req.query.prepareCatchup !== undefined) {
      if (req.query.prepareCatchup !== "true" || Object.keys(req.query).some(key => !["prepareCatchup", "deadlineAt"].includes(key))) {
        res.status(400).json({ error: "Invalid preparation request or mixed writer query." });
        return;
      }
      const result = await prepareGoalieCatchup({ client: supabase,
        deadlineAt: Math.min(Date.now() + 180_000, typeof req.query.deadlineAt === "string" && Number.isFinite(Number(req.query.deadlineAt))
          ? Number(req.query.deadlineAt) : Infinity) });
      const success = ["prepared", "existing", "not_due", "disabled"].includes(result.status);
      res.status(result.requiresReview ? 409 : success ? 200 : 503).json({ ...result, success,
        operationStatus: result.status === "disabled" || result.status === "not_due" ? "skipped" : success ? "success" : "failed" });
      return;
    }
    if (req.query.catchupScope !== undefined) {
      const scope = req.query.catchupScope;
      if (typeof scope !== "string" || !/^[a-f0-9]{64}$/.test(scope) ||
          Object.keys(req.query).some(key => !["catchupScope", "deadlineAt"].includes(key))) {
        res.status(400).json({ error: "Invalid checkpoint scope or mixed legacy query." });
        return;
      }
      const deadlineAt = Math.min(Date.now() + 220_000,
        typeof req.query.deadlineAt === "string" && Number.isFinite(Number(req.query.deadlineAt))
          ? Number(req.query.deadlineAt) : Infinity);
      const result = await runGoalieCatchupStep({ client: supabase, scope, deadlineAt,
        source: async (unit, control, signal): Promise<GoalieSourceResult> => {
          if (signal.aborted) throw new NstExecutionLimitError("Checkpoint source deadline elapsed.");
          const season = unit.key.split("/")[0];
          const proof: { sourceFingerprint?: string } = {};
          const rows = await fetchAndParseData(constructGoalieUrlsForDate(unit.date, season)[unit.dataset],
            unit.dataset, unit.date, season, 1, control, proof);
          for (const row of rows) {
            if (signal.aborted) throw new Error("Checkpoint source deadline elapsed after dispatch.");
            const id = await getGoalieIdByName(row.player_name, "G", control.deadlineAt - 20_000, true);
            if (!id) throw new Error("Goalie identity is missing or ambiguous; review required.");
            row.player_id = id;
          }
          return { rows, parsedRows: rows.length, mappedRows: rows.length, validatedEmpty: rows.length === 0,
            sourceFingerprint: proof.sourceFingerprint ?? "" };
        } });
      const complete = result.status === "complete";
      res.status(result.requiresReview ? 409 : complete ? 200 : 207).json({ ...result,
        checkpointVersion: 1, success: complete, complete, operationStatus: result.requiresReview ? "failed" : complete ? "success" : "partial",
        stoppedEarly: !complete, retrySafe: !result.requiresReview,
        resume: { required: !complete && !result.requiresReview, request: { query: { catchupScope: scope } } } });
      return;
    }
    const runMode = parseRunMode(req.query.runMode);
    const overwriteParam = parseBooleanParam(req.query.overwrite);
    const overwrite =
      overwriteParam ?? (runMode === "incremental" ? false : true);

    const result = await main({
      runMode,
      overwrite,
      maxPendingUrls: parsePositiveIntParam(req.query.maxUrls),
      requestIntervalMs: parsePositiveIntParam(req.query.requestIntervalMs),
      maxDays: parsePositiveIntParam(req.query.maxDays),
      datasetType: Array.isArray(req.query.datasetType)
        ? req.query.datasetType[0]
        : req.query.datasetType,
      cursor: req.query.cursor === undefined ? undefined : Number(req.query.cursor),
      resumeScope: typeof req.query.resumeScope === "string" ? req.query.resumeScope : undefined,
      plannedUrls: req.query.plannedUrls === undefined ? undefined : Number(req.query.plannedUrls),
      deadlineAt: typeof req.query.deadlineAt === "string" && Number.isFinite(Number(req.query.deadlineAt))
        ? Number(req.query.deadlineAt) : undefined,
      startDate: Array.isArray(req.query.startDate)
        ? req.query.startDate[0]
        : req.query.startDate
    });
    res.status("operationStatus" in result && result.operationStatus === "failed" ? 500
      : result.stoppedEarly ? 207 : 200).json(result);
  } catch (error: any) {
    console.error("Error in API handler:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function getLatestDateSupabase(deadlineAt: number): Promise<string | null> {
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
    const { data, error } = await boundedGoalieQuery(supabase
      .from(table)
      .select("date_scraped")
      .order("date_scraped", { ascending: false })
      .limit(1)
      .maybeSingle(), deadlineAt);
    if (error) throw new Error("Goalie high-water read failed; no provider request started.");
    if (data && data.date_scraped) {
      if (!latestDate || parseISO(data.date_scraped) > parseISO(latestDate)) {
        latestDate = data.date_scraped;
      }
    }
  }
  return latestDate;
}

export default adminOnly(withNstJobLifecycle(
  withCronJobAudit(withNhlOffSeasonSkip(handler as any), { includeFinalAuditReceipt: true }),
  "update-nst-goalies",
  req => req.method !== "GET" || req.query.prepareCatchup === "true" || typeof req.query.catchupScope === "string",
  { settled: (body, status) => {
    if (body?.finalAudit?.owner !== "withCronJobAudit" || body.finalAudit.status !== "persisted") return false;
    if (body.success === true && body.skipped === true && body.reason === "nhl_off_season") return true;
    if (body.requiresReview !== false) return false;
    if (status === 200 && body.success === true && body.complete === true && body.operationStatus === "complete") return true;
    return status === 207 && body.success === false && body.complete === false && body.operationStatus === "partial" &&
      body.retrySafe === true && body.resume?.required === true && body.stoppedEarly === true &&
      Array.isArray(body.urlProgress) && body.urlProgress.every((url: { status: string }) =>
        ["processed", "skipped", "empty_valid", "deferred"].includes(url.status));
  } },
));
