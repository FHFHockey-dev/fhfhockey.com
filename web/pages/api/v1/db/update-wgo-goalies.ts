// C:\Users\timbr\Desktop\FHFH\fhfhockey.com-3\web\pages\api\v1\db\update-wgo-goalies.ts

/**
 * API: /api/v1/db/update-wgo-goalies
 *
 * Supported query parameters
 *
 * `runMode`
 * - Type: `"incremental" | "forward" | "reverse" | "single"`
 * - Description: Runs a date-range sweep without using the legacy `action`
 *   parameter.
 * - Example:
 *   `/api/v1/db/update-wgo-goalies?runMode=forward&startDate=2026-01-15&overwrite=true`
 * - Notes:
 *   - `incremental` behaves like a resumable forward run. If `startDate` is
 *     omitted, the handler starts from the day after the latest
 *     `wgo_goalie_stats` date, or the current season start when the table is
 *     empty.
 *   - `forward` walks forward from `startDate` through today.
 *   - `reverse` walks backward from `startDate` to the earliest season start in
 *     the `seasons` table.
 *   - `single` processes only `startDate` and then stops.
 *
 * `startDate`
 * - Type: `YYYY-MM-DD`
 * - Description: Defines the starting point for `runMode`-based sweeps.
 * - Example:
 *   `/api/v1/db/update-wgo-goalies?runMode=reverse&startDate=2026-01-15`
 * - Notes:
 *   - Required for `forward`, `reverse`, and `single`.
 *   - Optional for `incremental`.
 *
 * `overwrite`
 * - Type: boolean-like string: `true | false | yes | no | 1 | 0`
 * - Description: Controls whether dates in a `runMode` sweep are reloaded even
 *   when rows already exist.
 * - Example:
 *   `/api/v1/db/update-wgo-goalies?runMode=forward&overwrite=false&startDate=2026-01-15`
 * - Notes:
 *   - `overwrite=true` acquires and persists the complete replacement first,
 *     then prunes only stale goalie IDs; acquisition or write failure retains
 *     the prior rows, and prune failure retains a safe superset.
 *   - `overwrite=false` skips dates that already exist in `wgo_goalie_stats`.
 *   - Default behavior matches the NST endpoints: `incremental` defaults to
 *     `false`; `forward` and `reverse` default to `true`.
 *
 * `action`
 * - Type: `"all" | "fullRefresh"`
 * - Description: Selects a bulk update mode.
 * - Example: `/api/v1/db/update-wgo-goalies?action=all`
 * - Notes:
 *   - `action=all` performs an incremental refresh from the day after the most
 *     recent `wgo_goalie_stats` record up to yesterday.
 *   - `action=fullRefresh` performs a historical rebuild. When paired with
 *     `season`, it refreshes only that season. Without `season`, it refreshes
 *     every season in the `seasons` table.
 *
 * `season`
 * - Type: numeric season ID string, such as `20232024`
 * - Description: Restricts `action=fullRefresh` to one specific season.
 * - Example: `/api/v1/db/update-wgo-goalies?action=fullRefresh&season=20232024`
 * - Notes: Ignored unless `action=fullRefresh` is provided.
 *
 * `date`
 * - Type: `YYYY-MM-DD`
 * - Description: Targets a single game date, or supplies the date context for a
 *   single-player fetch.
 * - Example: `/api/v1/db/update-wgo-goalies?date=2026-01-15`
 * - Notes:
 *   - When sent by itself, the handler fetches and upserts all goalie stats for
 *     that one date.
 *   - When paired with `playerId`, it fetches aggregate stats for one goalie up
 *     to that date within the resolved season.
 *
 * `playerId`
 * - Type: NHL player ID string or number-like string
 * - Description: Fetches data for a single goalie when paired with `date`.
 * - Example:
 *   `/api/v1/db/update-wgo-goalies?playerId=8475883&date=2026-01-15`
 * - Notes: This path fetches data only; it does not upsert into
 *   `wgo_goalie_stats`.
 *
 * `goalieFullName`
 * - Type: string
 * - Description: Optional display name used only for logging and response
 *   messaging in the single-player fetch path.
 * - Example:
 *   `/api/v1/db/update-wgo-goalies?playerId=8475883&date=2026-01-15&goalieFullName=Connor%20Hellebuyck`
 * - Notes: Defaults to `Unknown Goalie` when omitted.
 *
 * Valid request patterns
 * - Single-date run with overwrite enabled:
 *   `/api/v1/db/update-wgo-goalies?runMode=single&overwrite=true&startDate=2026-01-15`
 * - Forward sweep from a specific date through today:
 *   `/api/v1/db/update-wgo-goalies?runMode=forward&overwrite=true&startDate=2026-01-15`
 * - Reverse sweep from a specific date back to the earliest known season:
 *   `/api/v1/db/update-wgo-goalies?runMode=reverse&overwrite=false&startDate=2026-01-15`
 * - Incremental sweep with an explicit starting date:
 *   `/api/v1/db/update-wgo-goalies?runMode=incremental&overwrite=true&startDate=2026-01-15`
 * - Incremental refresh:
 *   `/api/v1/db/update-wgo-goalies?action=all`
 * - Full refresh for all historical seasons:
 *   `/api/v1/db/update-wgo-goalies?action=fullRefresh`
 * - Full refresh for one season:
 *   `/api/v1/db/update-wgo-goalies?action=fullRefresh&season=20232024`
 * - Upsert all goalie stats for one date:
 *   `/api/v1/db/update-wgo-goalies?date=2026-01-15`
 * - Fetch one goalie's aggregate stats up to a date:
 *   `/api/v1/db/update-wgo-goalies?playerId=8475883&date=2026-01-15&goalieFullName=Connor%20Hellebuyck`
 *
 * Invalid combinations
 * - `runMode=forward`, `runMode=reverse`, or `runMode=single` without
 *   `startDate`
 * - `runMode`/`startDate`/`overwrite` combined with `action`, `date`, or
 *   `playerId`
 * - `season` without `action=fullRefresh`
 * - `playerId` without `date`
 * - `action` combined with the single-date or single-player request modes
 */

// Import necessary modules from Next.js, Supabase, and other utilities
import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import Fetch from "lib/cors-fetch";
import {
  format,
  parseISO,
  addDays,
  isBefore,
  isAfter,
  subDays,
  isValid,
} from "date-fns";
import { getCurrentSeason } from "lib/NHL/server";
import {
  WGOGoalieStat,
  WGOAdvancedGoalieStat,
  WGODaysLeftStat,
} from "lib/NHL/types";
import { updateAllGoaliesStats } from "lib/supabase/utils/updateAllGoalies";
import adminOnly from "utils/adminOnlyMiddleware";
import {
  classifyWgoGoalieFetchFailure,
  classifyWgoGoaliePruneFailure,
  classifyWgoGoalieWriteFailure,
  fetchRequiredWgoGoaliePage,
  getWgoGoalieFetchFailureDetails,
  getWgoGoaliePruneFailureDetails,
  getWgoGoalieWriteFailureDetails,
  persistWgoGoalieStatsRecords,
  sanitizeWgoGoalieDiagnostic,
  WgoGoalieFetchError,
  WgoGoaliePruneError,
  WgoGoalieWriteError,
} from "lib/cron/wgoGoaliePersistence";

// TO DO - Got more stats from NHL API including the days rest statistics.

interface SeasonInfo {
  id: number; // Assuming 'id' in your 'seasons' table is the numeric season ID like 20232024
  startDate: string; // 'YYYY-MM-DD'
  regularSeasonEndDate: string; // 'YYYY-MM-DD'
}

type RunMode = "incremental" | "forward" | "reverse" | "single";
const WGO_PAGE_LIMIT = 100;
const WGO_MAX_PAGES = 25;
type WgoGoalieDateSource = "summary" | "advanced" | "days_rest";
type WgoGoaliePaginationScope = "date" | "player";
type WgoGoalieSourcePage = {
  source: WgoGoalieDateSource;
  rows: unknown[];
};

function createWgoGoaliePageHistory(): Record<
  WgoGoalieDateSource,
  Set<string>
> {
  return {
    summary: new Set<string>(),
    advanced: new Set<string>(),
    days_rest: new Set<string>(),
  };
}

function validateWgoGoaliePaginationPage(options: {
  date: string;
  pageStart: number;
  pageLimit: number;
  pagesRead: number;
  scope: WgoGoaliePaginationScope;
  seenPages: Record<WgoGoalieDateSource, Set<string>>;
  pages: WgoGoalieSourcePage[];
}): WgoGoalieSourcePage[] {
  const fullPages = options.pages.filter(
    (page) => page.rows.length === options.pageLimit,
  );

  for (const page of options.pages.filter(
    (candidate) => candidate.rows.length > 0,
  )) {
    const fingerprint = JSON.stringify(page.rows);
    if (options.seenPages[page.source].has(fingerprint)) {
      const pageKind =
        page.rows.length === options.pageLimit ? "full" : "non-empty";
      throw new WgoGoalieFetchError({
        code: "WGO_GOALIE_FETCH_FAILED",
        date: options.date,
        source: page.source,
        pageStart: options.pageStart,
        pageLimit: options.pageLimit,
        upstreamError: new Error(
          `Refusing repeated ${pageKind} ${page.source} page during WGO ${options.scope} pagination.`,
        ),
      });
    }
    options.seenPages[page.source].add(fingerprint);
  }

  if (fullPages.length > 0 && options.pagesRead >= WGO_MAX_PAGES) {
    throw new WgoGoalieFetchError({
      code: "WGO_GOALIE_FETCH_FAILED",
      date: options.date,
      source: fullPages[0].source,
      pageStart: options.pageStart,
      pageLimit: options.pageLimit,
      upstreamError: new Error(
        `Refusing WGO ${options.scope} pagination beyond ${WGO_MAX_PAGES} pages while a required source still returns full pages.`,
      ),
    });
  }

  return fullPages;
}

function parseRunMode(
  value: string | string[] | undefined,
): RunMode | undefined {
  const raw = (Array.isArray(value) ? value[0] : value)?.toLowerCase();
  if (
    raw === "incremental" ||
    raw === "forward" ||
    raw === "reverse" ||
    raw === "single"
  ) {
    return raw;
  }
  return undefined;
}

function parseBooleanParam(
  value: string | string[] | undefined,
): boolean | undefined {
  const raw = (Array.isArray(value) ? value[0] : value)?.toLowerCase();
  if (!raw) return undefined;
  if (["yes", "true", "1"].includes(raw)) return true;
  if (["no", "false", "0"].includes(raw)) return false;
  return undefined;
}

function parseDateParam(
  value: string | string[] | undefined,
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return undefined;
  }
  const parsed = parseISO(raw);
  return isValid(parsed) ? raw : undefined;
}

function normalizePositivePlayerId(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > String(Number.MAX_SAFE_INTEGER).length ||
    !/^\d+$/.test(value)
  ) {
    return null;
  }

  const playerId = Number(value);
  return Number.isSafeInteger(playerId) && playerId > 0
    ? String(playerId)
    : null;
}

function filterRowsForRequestedPlayer<T>(
  rows: T[],
  requestedPlayerId: string,
): T[] {
  return rows.filter((row) => {
    if (typeof row !== "object" || row === null) return false;
    const rowPlayerId = (row as { playerId?: unknown }).playerId;
    const normalizedRowPlayerId =
      typeof rowPlayerId === "number" && Number.isSafeInteger(rowPlayerId)
        ? String(rowPlayerId)
        : normalizePositivePlayerId(rowPlayerId);
    return normalizedRowPlayerId === requestedPlayerId;
  });
}

/**
 * Fetches season details from Supabase based on a specific date.
 * Enhanced to handle offseason periods by using NHL API logic.
 * @param dateString - The date string in 'YYYY-MM-DD' format.
 * @returns A Promise resolving to the SeasonInfo object or null when no season applies.
 * @throws WgoGoalieFetchError when required season metadata cannot be queried.
 */
async function getSeasonFromDate(
  dateString: string,
): Promise<SeasonInfo | null> {
  try {
    // First, try the direct approach - look for a season that contains this date
    const { data: directMatch, error: directError } = await supabase
      .from("seasons")
      .select("id, startDate, regularSeasonEndDate") // Select needed columns
      .lte("startDate", dateString) // Date is on or after season start
      .gte("regularSeasonEndDate", dateString) // Date is on or before regular season end
      .maybeSingle(); // Zero rows is expected for offseason dates; multiple rows is an error.

    if (directError) {
      throw new WgoGoalieFetchError({
        code: "WGO_GOALIE_FETCH_FAILED",
        date: dateString,
        source: "season",
        pageStart: 0,
        pageLimit: 1,
        upstreamError: directError,
      });
    }

    if (directMatch) {
      // Found a direct match - date falls within a regular season
      return {
        ...directMatch,
        id: Number(directMatch.id),
      };
    }

    // If no direct match (likely offseason), use smart logic similar to fetchCurrentSeason
    console.log(
      `Date ${dateString} falls outside regular season periods. Using smart season detection...`,
    );

    // Fetch all seasons to determine which one this date most likely belongs to
    const { data: allSeasons, error: seasonsError } = await supabase
      .from("seasons")
      .select("id, startDate, regularSeasonEndDate")
      .order("id", { ascending: false }); // Most recent first

    if (seasonsError) {
      throw new WgoGoalieFetchError({
        code: "WGO_GOALIE_FETCH_FAILED",
        date: dateString,
        source: "season",
        pageStart: 0,
        pageLimit: 1,
        upstreamError: seasonsError,
      });
    }

    if (!allSeasons || allSeasons.length === 0) {
      return null;
    }

    const targetDate = new Date(dateString);

    // Check each season to find the most appropriate one
    for (let i = 0; i < allSeasons.length; i++) {
      const currentSeason = allSeasons[i];
      const nextSeason = allSeasons[i - 1]; // Next season (more recent)

      const seasonStart = new Date(currentSeason.startDate);
      const seasonEnd = new Date(currentSeason.regularSeasonEndDate);

      // If date is before this season starts, continue to older seasons
      if (targetDate < seasonStart) {
        continue;
      }

      // If date is during regular season, return this season
      if (targetDate >= seasonStart && targetDate <= seasonEnd) {
        return {
          ...currentSeason,
          id: Number(currentSeason.id),
        };
      }

      // If date is after this season ends, check if it's in the offseason
      if (targetDate > seasonEnd) {
        // If there's a next season, check if date is before next season starts
        if (nextSeason) {
          const nextSeasonStart = new Date(nextSeason.startDate);
          if (targetDate < nextSeasonStart) {
            // Date is in offseason between this season and next season
            // Use the more recent season (next season) for context
            console.log(
              `Date ${dateString} is in offseason. Using upcoming season ${nextSeason.id} for context.`,
            );
            return {
              ...nextSeason,
              id: Number(nextSeason.id),
            };
          }
        } else {
          // No next season defined, this might be the current/future season
          // Check if we're in a reasonable offseason period (within ~6 months after season end)
          const monthsAfterSeason =
            (targetDate.getTime() - seasonEnd.getTime()) /
            (1000 * 60 * 60 * 24 * 30.44);
          if (monthsAfterSeason <= 6) {
            console.log(
              `Date ${dateString} is in recent offseason. Using completed season ${currentSeason.id} for context.`,
            );
            return {
              ...currentSeason,
              id: Number(currentSeason.id),
            };
          }
        }
      }
    }

    // If we get here, we couldn't determine an appropriate season
    console.warn(
      `Could not determine appropriate season for date: ${dateString}`,
    );
    return null;
  } catch (error: unknown) {
    if (error instanceof WgoGoalieFetchError) {
      throw error;
    }

    throw new WgoGoalieFetchError({
      code: "WGO_GOALIE_FETCH_FAILED",
      date: dateString,
      source: "season",
      pageStart: 0,
      pageLimit: 1,
      upstreamError: error,
    });
  }
}

/**
 * Fetches season details from Supabase based on a season ID.
 * @param seasonId - The numeric season ID (e.g., 20232024).
 * @returns A Promise resolving to the SeasonInfo object or null if not found/error.
 */
async function getSeasonDetailsById(
  seasonId: number,
): Promise<SeasonInfo | null> {
  try {
    const { data, error } = await supabase
      .from("seasons")
      .select("id, startDate, regularSeasonEndDate") // Select needed columns
      .eq("id", seasonId)
      .single(); // Expect only one season for a given ID

    if (error) {
      console.error(
        `Error fetching season details for ID ${seasonId}:`,
        error.message,
      );
      return null;
    }
    if (data) {
      // Ensure the id is treated as a number
      return {
        ...data,
        id: Number(data.id),
      };
    }
    return null;
  } catch (err: any) {
    console.error(
      `Unexpected error in getSeasonDetailsById for ${seasonId}:`,
      err.message,
    );
    return null;
  }
}

async function getEarliestSeasonStartDate(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("seasons")
      .select("startDate")
      .order("startDate", { ascending: true })
      .limit(1)
      .single();

    if (error || !data?.startDate) {
      console.error(
        "Error fetching earliest season start date:",
        error?.message,
      );
      return null;
    }

    return data.startDate;
  } catch (err: any) {
    console.error(
      "Unexpected error in getEarliestSeasonStartDate:",
      err.message,
    );
    return null;
  }
}

async function hasExistingGoalieStatsForDate(date: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("wgo_goalie_stats")
    .select("goalie_id")
    .eq("date", date)
    .limit(1);

  if (error) {
    throw new Error(
      `Failed checking existing goalie stats for ${date}: ${error.message}`,
    );
  }

  return (data?.length ?? 0) > 0;
}

async function pruneStaleGoalieStatsForDate(
  date: string,
  goalieIds: number[],
  replacementRowsPersisted: number,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("wgo_goalie_stats")
      .delete()
      .eq("date", date)
      .not("goalie_id", "in", `(${goalieIds.join(",")})`);
    if (error) {
      throw error;
    }
  } catch (error: unknown) {
    throw new WgoGoaliePruneError({
      code: "WGO_GOALIE_PRUNE_FAILED",
      date,
      replacementRowsPersisted,
      upstreamError: error,
    });
  }
}

function mapByPlayerId<T extends { playerId: number }>(
  rows: T[],
): Map<number, T> {
  return new Map(rows.map((row) => [row.playerId, row]));
}

async function upsertGoalieStatsRecords(records: any[]): Promise<number> {
  return persistWgoGoalieStatsRecords(
    records,
    async (rows) => {
      const { error } = await supabase.from("wgo_goalie_stats").upsert(rows);
      return error ? { code: error.code, message: error.message } : null;
    },
    {
      onBulkFallbackRecovered: (recovery) => {
        console.warn(
          "Bulk goalie stats upsert failed, but bounded row retries recovered every requested row:",
          recovery,
        );
      },
    },
  );
}

/**
 * Fetch aggregate statistics for a specific goalie up to a given date *within its season*.
 * @param playerId - The ID of the goalie.
 * @param playerName - The full name of the goalie.
 * @param date - The target date up to which to fetch statistics.
 * @returns An object containing goalieStats and advancedGoalieStats arrays.
 */
export async function fetchDataForPlayer(
  playerId: string,
  playerName: string,
  date: string, // Expects 'YYYY-MM-DD'
): Promise<{
  goalieStats: WGOGoalieStat[];
  advancedGoalieStats: WGOAdvancedGoalieStat[];
  daysLeftStats: WGODaysLeftStat[];
} | null> {
  const normalizedPlayerId = normalizePositivePlayerId(playerId);
  if (!normalizedPlayerId) {
    throw new Error("Invalid playerId. Expected a positive safe integer.");
  }

  // Return null if season context is missing
  let start = 0;
  let moreDataAvailable = true;
  let goalieStats: WGOGoalieStat[] = [];
  let advancedGoalieStats: WGOAdvancedGoalieStat[] = [];
  let daysLeftStats: WGODaysLeftStat[] = [];

  const limit = WGO_PAGE_LIMIT;
  const formattedEndDate = date; // Already should be 'YYYY-MM-DD'
  let pagesRead = 0;
  const seenPages = createWgoGoaliePageHistory();

  // *** Determine the season based on the end date ***
  const season = await getSeasonFromDate(formattedEndDate);
  if (!season) {
    console.error(
      `Could not determine season for date ${formattedEndDate} in fetchDataForPlayer.`,
    );
    return null; // Indicate failure due to missing season context
  }
  const formattedSeasonStartDate = season.startDate; // Use start date from Supabase
  void playerName;

  while (moreDataAvailable) {
    // Update the URL to fetch aggregate data up to the specified date within the determined season
    // Include both regular season (gameTypeId=2) and playoff games (gameTypeId=3)
    const goalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=true&isGame=false&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedEndDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedSeasonStartDate}%22%20and%20(gameTypeId%3D2%20or%20gameTypeId%3D3)%20and%20playerId=%22${normalizedPlayerId}%22`;
    const advancedGoalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/advanced?isAggregate=true&isGame=false&sort=%5B%7B%22property%22:%22qualityStart%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsAgainstAverage%22,%22direction%22:%22ASC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedEndDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedSeasonStartDate}%22%20and%20(gameTypeId%3D2%20or%20gameTypeId%3D3)%20and%20playerId=%22${normalizedPlayerId}%22`;
    const daysRestUrl = `https://api.nhle.com/stats/rest/en/goalie/daysrest?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&cayenneExp=gameDate%3C=%22${formattedEndDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedEndDate}%22%20and%20(gameTypeId%3D2%20or%20gameTypeId%3D3)%20and%20playerId=%22${normalizedPlayerId}%22`;

    const [goalieStatsPage, advancedGoalieStatsPage, daysRestStatsPage] =
      await Promise.all([
        fetchRequiredWgoGoaliePage<WGOGoalieStat>({
          date: formattedEndDate,
          source: "summary",
          pageStart: start,
          pageLimit: limit,
          request: () => Fetch(goalieStatsUrl),
        }),
        fetchRequiredWgoGoaliePage<WGOAdvancedGoalieStat>({
          date: formattedEndDate,
          source: "advanced",
          pageStart: start,
          pageLimit: limit,
          request: () => Fetch(advancedGoalieStatsUrl),
        }),
        fetchRequiredWgoGoaliePage<WGODaysLeftStat>({
          date: formattedEndDate,
          source: "days_rest",
          pageStart: start,
          pageLimit: limit,
          request: () => Fetch(daysRestUrl),
        }),
      ]);

    pagesRead++;
    const fullPages = validateWgoGoaliePaginationPage({
      date: formattedEndDate,
      pageStart: start,
      pageLimit: limit,
      pagesRead,
      scope: "player",
      seenPages,
      pages: [
        { source: "summary", rows: goalieStatsPage },
        { source: "advanced", rows: advancedGoalieStatsPage },
        { source: "days_rest", rows: daysRestStatsPage },
      ],
    });

    goalieStats = goalieStats.concat(
      filterRowsForRequestedPlayer(goalieStatsPage, normalizedPlayerId),
    );
    advancedGoalieStats = advancedGoalieStats.concat(
      filterRowsForRequestedPlayer(advancedGoalieStatsPage, normalizedPlayerId),
    );
    daysLeftStats = daysLeftStats.concat(
      filterRowsForRequestedPlayer(daysRestStatsPage, normalizedPlayerId),
    );

    moreDataAvailable = fullPages.length > 0;
    start += limit;
  }

  return {
    goalieStats,
    advancedGoalieStats,
    daysLeftStats,
  };
}

/**
 * Update goalie stats for a specific date in the Supabase database, using the correct season ID.
 * @param date - The date string 'YYYY-MM-DD' for which to update the stats.
 * @returns An object indicating whether the update was successful along with the fetched stats.
 */
async function updateGoalieStats(
  date: string,
  options: { pruneExistingAfterWrite?: boolean } = {},
): Promise<{
  // date is 'YYYY-MM-DD'
  updated: boolean;
  goalieStats: WGOGoalieStat[];
  advancedGoalieStats: WGOAdvancedGoalieStat[];
  daysRestStats: WGODaysLeftStat[];
  processedDate: string;
  actualUpsertCount: number; // Add this field to track actual upserts
}> {
  const formattedDate = date; // Assume input is 'YYYY-MM-DD'
  let updateCount = 0;

  // *** Determine the season ID for the given date ***
  const season = await getSeasonFromDate(formattedDate);
  if (!season) {
    console.warn(
      `Skipping update for ${formattedDate}: Could not find season.`,
    );
    return {
      updated: false,
      goalieStats: [],
      advancedGoalieStats: [],
      daysRestStats: [],
      processedDate: formattedDate,
      actualUpsertCount: 0,
    };
  }
  const seasonId = season.id; // Use the ID from the 'seasons' table

  // Fetch data specifically for this date
  const dataForDate = await fetchAllDataForDate(formattedDate, WGO_PAGE_LIMIT);
  const goalieStats = dataForDate.goalieStats;
  const advancedGoalieStats = dataForDate.advancedGoalieStats;
  const daysRestStats = dataForDate.daysRestStats;

  const advancedGoalieStatsByPlayer = mapByPlayerId(advancedGoalieStats);
  const daysRestStatsByPlayer = mapByPlayerId(daysRestStats);

  const records = goalieStats.map((stat) => {
    const advStats = advancedGoalieStatsByPlayer.get(stat.playerId);
    const daysRestStat = daysRestStatsByPlayer.get(stat.playerId);

    return {
      // Mapping fields from fetched data to Supabase table columns
      goalie_id: stat.playerId,
      goalie_name: stat.goalieFullName,
      date: formattedDate,
      season_id: seasonId, // *** Use the correct season ID ***
      shoots_catches: stat.shootsCatches,
      position_code: "G",
      games_played: stat.gamesPlayed,
      games_started: stat.gamesStarted,
      wins: stat.wins,
      losses: stat.losses,
      ot_losses: stat.otLosses,
      save_pct: stat.savePct,
      saves: stat.saves,
      goals_against: stat.goalsAgainst,
      goals_against_avg: stat.goalsAgainstAverage,
      shots_against: stat.shotsAgainst,
      time_on_ice: stat.timeOnIce,
      shutouts: stat.shutouts,
      goals: stat.goals,
      assists: stat.assists,
      complete_game_pct: advStats?.completeGamePct,
      complete_games: advStats?.completeGames,
      incomplete_games: advStats?.incompleteGames,
      quality_start: advStats?.qualityStart,
      quality_starts_pct: advStats?.qualityStartsPct,
      regulation_losses: advStats?.regulationLosses,
      regulation_wins: advStats?.regulationWins,
      shots_against_per_60: advStats?.shotsAgainstPer60,
      games_played_days_rest_0: daysRestStat?.gamesPlayedDaysRest0,
      games_played_days_rest_1: daysRestStat?.gamesPlayedDaysRest1,
      games_played_days_rest_2: daysRestStat?.gamesPlayedDaysRest2,
      games_played_days_rest_3: daysRestStat?.gamesPlayedDaysRest3,
      games_played_days_rest_4_plus: daysRestStat?.gamesPlayedDaysRest4Plus,
      save_pct_days_rest_0: daysRestStat?.savePctDaysRest0,
      save_pct_days_rest_1: daysRestStat?.savePctDaysRest1,
      save_pct_days_rest_2: daysRestStat?.savePctDaysRest2,
      save_pct_days_rest_3: daysRestStat?.savePctDaysRest3,
      save_pct_days_rest_4_plus: daysRestStat?.savePctDaysRest4Plus,
    };
  });

  if (options.pruneExistingAfterWrite && records.length === 0) {
    throw new WgoGoalieFetchError({
      code: "WGO_GOALIE_FETCH_FAILED",
      date: formattedDate,
      source: "summary",
      pageStart: 0,
      pageLimit: WGO_PAGE_LIMIT,
      upstreamError: new Error(
        "Refusing to replace existing goalie stats with an empty acquired summary.",
      ),
    });
  }

  const overwriteGoalieIds = options.pruneExistingAfterWrite
    ? Array.from(new Set(records.map((record) => Number(record.goalie_id))))
    : [];
  if (
    options.pruneExistingAfterWrite &&
    overwriteGoalieIds.some(
      (goalieId) => !Number.isSafeInteger(goalieId) || goalieId <= 0,
    )
  ) {
    throw new WgoGoalieFetchError({
      code: "WGO_GOALIE_FETCH_FAILED",
      date: formattedDate,
      source: "summary",
      pageStart: 0,
      pageLimit: WGO_PAGE_LIMIT,
      upstreamError: new Error(
        "Refusing to replace existing goalie stats with invalid acquired goalie identifiers.",
      ),
    });
  }

  updateCount = await upsertGoalieStatsRecords(records);

  if (options.pruneExistingAfterWrite) {
    await pruneStaleGoalieStatsForDate(
      formattedDate,
      overwriteGoalieIds,
      updateCount,
    );
  }

  console.log(
    `Updated ${updateCount} goalie stats for ${formattedDate} (Season ${seasonId})`,
  );
  return {
    updated: updateCount > 0,
    goalieStats,
    advancedGoalieStats,
    daysRestStats,
    processedDate: formattedDate,
    actualUpsertCount: updateCount, // Return the actual upsert count
  };
}

/**
 * Fetch all goalie data for a specific date with a limit on the number of records.
 * (This function remains largely the same, as it fetches based on a single date)
 * @param formattedDate - The date in 'yyyy-MM-dd' format.
 * @param limit - The maximum number of records to fetch per request.
 * @returns An object containing goalieStats and advancedGoalieStats arrays.
 */
async function fetchAllDataForDate(
  formattedDate: string,
  limit: number,
): Promise<{
  goalieStats: WGOGoalieStat[];
  advancedGoalieStats: WGOAdvancedGoalieStat[];
  daysRestStats: WGODaysLeftStat[];
}> {
  let start = 0;
  let moreDataAvailable = true;
  let goalieStats: WGOGoalieStat[] = [];
  let advancedGoalieStats: WGOAdvancedGoalieStat[] = [];
  let daysRestStats: WGODaysLeftStat[] = [];
  let pagesRead = 0;
  const seenPages = createWgoGoaliePageHistory();
  // console.log("Fetching data for date:", formattedDate); // Keep if useful

  // Loop to fetch all pages of data from the API
  while (moreDataAvailable) {
    // Include both regular season (gameTypeId=2) and playoff games (gameTypeId=3)
    const goalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=0&cayenneExp=gameDate%3C%3D%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E%3D%22${formattedDate}%22%20and%20(gameTypeId%3D2%20or%20gameTypeId%3D3)`; // Include both regular season and playoffs
    const advancedGoalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/advanced?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22qualityStart%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsAgainstAverage%22,%22direction%22:%22ASC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=0&cayenneExp=gameDate%3C%3D%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E%3D%22${formattedDate}%22%20and%20(gameTypeId%3D2%20or%20gameTypeId%3D3)`; // Include both regular season and playoffs
    const daysRestUrl = `https://api.nhle.com/stats/rest/en/goalie/daysrest?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&cayenneExp=gameDate%3C%3D%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E%3D%22${formattedDate}%22%20and%20(gameTypeId%3D2%20or%20gameTypeId%3D3)`; // Include both regular season and playoffs

    const [goalieStatsPage, advancedGoalieStatsPage, daysRestStatsPage] =
      await Promise.all([
        fetchRequiredWgoGoaliePage<WGOGoalieStat>({
          date: formattedDate,
          source: "summary",
          pageStart: start,
          pageLimit: limit,
          request: () => Fetch(goalieStatsUrl),
        }),
        fetchRequiredWgoGoaliePage<WGOAdvancedGoalieStat>({
          date: formattedDate,
          source: "advanced",
          pageStart: start,
          pageLimit: limit,
          request: () => Fetch(advancedGoalieStatsUrl),
        }),
        fetchRequiredWgoGoaliePage<WGODaysLeftStat>({
          date: formattedDate,
          source: "days_rest",
          pageStart: start,
          pageLimit: limit,
          request: () => Fetch(daysRestUrl),
        }),
      ]);

    pagesRead++;
    const fullPages = validateWgoGoaliePaginationPage({
      date: formattedDate,
      pageStart: start,
      pageLimit: limit,
      pagesRead,
      scope: "date",
      seenPages,
      pages: [
        { source: "summary", rows: goalieStatsPage },
        { source: "advanced", rows: advancedGoalieStatsPage },
        { source: "days_rest", rows: daysRestStatsPage },
      ],
    });

    goalieStats = goalieStats.concat(goalieStatsPage);
    advancedGoalieStats = advancedGoalieStats.concat(advancedGoalieStatsPage);
    daysRestStats = daysRestStats.concat(daysRestStatsPage);

    moreDataAvailable = fullPages.length > 0;

    start += limit;
  }

  return {
    goalieStats,
    advancedGoalieStats,
    daysRestStats,
  };
}

/**
 * Update goalie stats for an entire specified season by iterating through each day.
 * @param targetSeasonId - The numeric ID of the season to process (e.g., 20232024).
 * @returns An object containing a success message and the total number of updates made.
 */
async function updateAllGoalieStatsForSeason(targetSeasonId: number) {
  console.log(`Starting full season update for Season ID: ${targetSeasonId}`);

  // *** Fetch the specific season's details ***
  const seasonDetails = await getSeasonDetailsById(targetSeasonId);
  if (!seasonDetails) {
    console.error(
      `Could not find season details for ID ${targetSeasonId}. Aborting.`,
    );
    return {
      message: `Failed to find season details for ID ${targetSeasonId}.`,
      success: false,
      totalUpdates: 0,
      totalErrors: 1, // Count this as an error
    };
  }

  // Use dates from the fetched season details
  // Add one day to start date for iteration start because parseISO might handle timezones unexpectedly
  let currentDate = addDays(parseISO(seasonDetails.startDate), 0); // Start from the exact start date
  const endDate = parseISO(seasonDetails.regularSeasonEndDate);

  let totalUpdates = 0;
  let totalErrors = 0;

  // Iterate from season start date up to and including the regular season end date
  while (isBefore(currentDate, addDays(endDate, 1))) {
    // Loop until *after* the end date
    const formattedDate = format(currentDate, "yyyy-MM-dd");
    try {
      // Use the already refactored updateGoalieStats which handles fetching and upserting for a single date
      const dailyResult = await updateGoalieStats(formattedDate);
      if (dailyResult.updated) {
        // Use the actual upsert count instead of estimating
        totalUpdates += dailyResult.actualUpsertCount;
      } else if (
        !dailyResult.updated &&
        dailyResult.goalieStats.length === 0 &&
        !(await getSeasonFromDate(formattedDate))
      ) {
        // If not updated AND no season found for the date (e.g., mid-season break?), don't count as error
        console.log(
          `Skipping ${formattedDate} as it falls outside a season definition.`,
        );
      } else if (!dailyResult.updated) {
        // Potentially log non-update scenarios if needed, but maybe not errors unless fetch failed
        // console.log(`No updates performed for ${formattedDate}`);
      }
    } catch (e: any) {
      if (
        e instanceof WgoGoalieWriteError ||
        e instanceof WgoGoalieFetchError ||
        e instanceof WgoGoaliePruneError
      ) {
        e.addCompletedRowsBeforeFailure(totalUpdates);
        throw e;
      }
      console.error(`Critical error processing ${formattedDate}:`, e.message);
      totalErrors++;
    }
    currentDate = addDays(currentDate, 1); // Move to the next day
  }

  console.log(
    `Season ${targetSeasonId} update finished. Total Estimated Updates: ${totalUpdates}, Errors: ${totalErrors}`,
  );
  return {
    message: `Season ${targetSeasonId} data update finished.`,
    success: totalErrors === 0,
    totalUpdates,
    totalErrors,
  };
}

/**
 * Updates goalie stats for ALL seasons found in the 'seasons' table.
 * This is a potentially long-running operation.
 */
async function updateAllHistoricalGoalieStats(): Promise<{
  message: string;
  success: boolean;
  totalUpdates: number;
  totalErrors: number;
  seasonsProcessed: number;
}> {
  console.log("Starting full historical refresh for ALL seasons...");
  let grandTotalUpdates = 0;
  let grandTotalErrors = 0;
  let seasonsProcessed = 0;

  // 1. Fetch all season IDs
  const { data: seasons, error: seasonError } = await supabase
    .from("seasons")
    .select("id")
    .order("id", { ascending: true }); // Process chronologically

  if (seasonError) {
    console.error("Failed to fetch season list:", seasonError.message);
    return {
      message: `Failed to fetch season list: ${seasonError.message}`,
      success: false,
      totalUpdates: 0,
      totalErrors: 1,
      seasonsProcessed: 0,
    };
  }

  if (!seasons || seasons.length === 0) {
    const msg =
      "No seasons found in the 'seasons' table. Cannot perform full historical refresh.";
    console.error(msg);
    return {
      message: msg,
      success: false,
      totalUpdates: 0,
      totalErrors: 1,
      seasonsProcessed: 0,
    };
  }

  console.log(`Found ${seasons.length} seasons to process.`);

  // 2. Loop through each season and update
  for (const season of seasons) {
    const targetSeasonId = Number(season.id);
    if (isNaN(targetSeasonId)) {
      console.warn(`Skipping invalid season ID: ${season.id}`);
      grandTotalErrors++;
      continue;
    }

    console.log(`--- Processing Season ${targetSeasonId} ---`);
    try {
      // Call the function that processes a single full season
      const seasonResult = await updateAllGoalieStatsForSeason(targetSeasonId);
      grandTotalUpdates += seasonResult.totalUpdates;
      grandTotalErrors += seasonResult.totalErrors;
      seasonsProcessed++;
      console.log(
        `--- Finished Season ${targetSeasonId}. Updates: ${seasonResult.totalUpdates}, Errors: ${seasonResult.totalErrors} ---`,
      );
      // Optional: Add a small delay between seasons if needed to avoid rate limits
      // await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    } catch (e: any) {
      if (
        e instanceof WgoGoalieWriteError ||
        e instanceof WgoGoalieFetchError ||
        e instanceof WgoGoaliePruneError
      ) {
        e.addCompletedRowsBeforeFailure(grandTotalUpdates);
        throw e;
      }
      console.error(
        `Critical error during processing of season ${targetSeasonId}:`,
        e.message,
      );
      grandTotalErrors++; // Increment error count for the season that failed critically
    }
  }

  const finalMessage = `Full historical refresh finished processing ${seasonsProcessed} seasons.`;
  console.log(
    `${finalMessage} Grand Total Updates: ${grandTotalUpdates}, Grand Total Errors: ${grandTotalErrors}`,
  );
  return {
    message: finalMessage,
    success: grandTotalErrors === 0,
    totalUpdates: grandTotalUpdates,
    totalErrors: grandTotalErrors,
    seasonsProcessed: seasonsProcessed,
  };
}

/**
 * Updates goalie stats incrementally from the day after the most recent
 * record in the database up to yesterday.
 */
async function updateRecentGoalieStats(): Promise<{
  message: string;
  success: boolean;
  totalUpdates: number;
  totalErrors: number;
  startDate: string | null;
  endDate: string;
}> {
  console.log("Starting incremental update (action=all)...");
  let totalUpdates = 0;
  let totalErrors = 0;

  // 1. Find the most recent date in wgo_goalie_stats
  const { data: latestEntry, error: latestEntryError } = await supabase
    .from("wgo_goalie_stats")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle(); // Use maybeSingle to handle empty table gracefully

  if (latestEntryError) {
    console.error("Error fetching latest date:", latestEntryError.message);
    return {
      message: `Failed to fetch latest date: ${latestEntryError.message}`,
      success: false,
      totalUpdates: 0,
      totalErrors: 1,
      startDate: null,
      endDate: format(subDays(new Date(), 1), "yyyy-MM-dd"), // Yesterday
    };
  }

  // 2. Determine the start date for fetching
  let startDateToProcess: Date;
  if (latestEntry?.date) {
    startDateToProcess = addDays(parseISO(latestEntry.date), 1); // Day after the last record
    console.log(
      `Last record found on: ${latestEntry.date}. Starting update from: ${format(startDateToProcess, "yyyy-MM-dd")}`,
    );
  } else {
    // Table is empty - decide behaviour. Let's default to starting from the beginning of the *current* season.
    console.warn(
      "No existing data found. Starting incremental update from the beginning of the current season.",
    );
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const currentSeasonInfo = await getSeasonFromDate(todayStr); // Assumes today is within a season
    if (currentSeasonInfo) {
      startDateToProcess = parseISO(currentSeasonInfo.startDate);
      console.log(
        `Determined current season start date: ${currentSeasonInfo.startDate}`,
      );
    } else {
      // Still couldn't find current season (e.g., deep offseason) - maybe start from a fixed historical date or fail?
      // Let's try fetching the absolute earliest season start date as a last resort
      const { data: earliestSeason, error: earliestError } = await supabase
        .from("seasons")
        .select("startDate")
        .order("startDate", { ascending: true })
        .limit(1)
        .single();
      if (earliestSeason && !earliestError) {
        startDateToProcess = parseISO(earliestSeason.startDate);
        console.warn(
          `Could not determine current season, starting from earliest known season: ${earliestSeason.startDate}`,
        );
      } else {
        const msg =
          "Table is empty and could not determine a start date (current or earliest season not found). Run 'action=fullRefresh' first.";
        console.error(msg);
        return {
          message: msg,
          success: false,
          totalUpdates: 0,
          totalErrors: 1,
          startDate: null,
          endDate: format(subDays(new Date(), 1), "yyyy-MM-dd"),
        };
      }
    }
  }

  // 3. Determine the end date (yesterday)
  const endDateToProcess = subDays(new Date(), 1); // Process up to yesterday
  const formattedEndDate = format(endDateToProcess, "yyyy-MM-dd");

  // 4. Check if start date is already after end date
  if (isAfter(startDateToProcess, endDateToProcess)) {
    const msg = `Database is already up-to-date (Last record: ${latestEntry?.date ?? "N/A"}, Target end date: ${formattedEndDate}). No incremental update needed.`;
    console.log(msg);
    return {
      message: msg,
      success: true,
      totalUpdates: 0,
      totalErrors: 0,
      startDate: format(startDateToProcess, "yyyy-MM-dd"),
      endDate: formattedEndDate,
    };
  }

  const loopStartDateStr = format(startDateToProcess, "yyyy-MM-dd");
  console.log(
    `Processing dates from ${loopStartDateStr} to ${formattedEndDate}`,
  );

  // 5. Loop through dates and update
  let currentDate = startDateToProcess;
  while (isBefore(currentDate, addDays(endDateToProcess, 1))) {
    const formattedDate = format(currentDate, "yyyy-MM-dd");
    try {
      // Use the existing updateGoalieStats for single-day processing
      const dailyResult = await updateGoalieStats(formattedDate);
      if (dailyResult.updated) {
        // Use the actual upsert count instead of estimating
        totalUpdates += dailyResult.actualUpsertCount;
      } else if (!dailyResult.updated && dailyResult.goalieStats.length === 0) {
        // Don't count as error if no data for the day or outside season definition
        // console.log(`No data or season found for ${formattedDate}. Skipping.`);
      }
    } catch (e: any) {
      if (
        e instanceof WgoGoalieWriteError ||
        e instanceof WgoGoalieFetchError ||
        e instanceof WgoGoaliePruneError
      ) {
        e.addCompletedRowsBeforeFailure(totalUpdates);
        throw e;
      }
      console.error(
        `Critical error processing ${formattedDate} during incremental update:`,
        e.message,
      );
      totalErrors++;
      // Optional: Decide whether to stop the whole process on critical error
    }
    currentDate = addDays(currentDate, 1);
  }

  const finalMessage = `Incremental update finished. Processed dates: ${loopStartDateStr} to ${formattedEndDate}.`;
  console.log(
    `${finalMessage} Estimated Updates: ${totalUpdates}, Errors: ${totalErrors}`,
  );
  return {
    message: finalMessage,
    success: totalErrors === 0,
    totalUpdates,
    totalErrors,
    startDate: loopStartDateStr,
    endDate: formattedEndDate,
  };
}

async function runGoalieStatsDateRange(options: {
  runMode: RunMode;
  startDate?: string;
  overwrite?: boolean;
}): Promise<{
  message: string;
  success: boolean;
  totalUpdates: number;
  totalErrors: number;
  startDate: string;
  endDate: string;
  runMode: RunMode;
  overwrite: boolean;
  processedDates: number;
  skippedDates: number;
}> {
  const runMode = options.runMode;
  const overwrite =
    options.overwrite ?? (runMode === "incremental" ? false : true);
  const today = format(new Date(), "yyyy-MM-dd");
  let resolvedStartDate = options.startDate;

  if (!resolvedStartDate && runMode === "incremental") {
    const { data: latestEntry, error: latestEntryError } = await supabase
      .from("wgo_goalie_stats")
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestEntryError) {
      throw new Error(
        `Failed to fetch latest goalie stats date: ${latestEntryError.message}`,
      );
    }

    if (latestEntry?.date) {
      resolvedStartDate = format(
        addDays(parseISO(latestEntry.date), 1),
        "yyyy-MM-dd",
      );
    } else {
      const currentSeasonInfo = await getSeasonFromDate(today);
      if (currentSeasonInfo?.startDate) {
        resolvedStartDate = currentSeasonInfo.startDate;
      } else {
        resolvedStartDate = (await getEarliestSeasonStartDate()) ?? undefined;
      }
    }
  }

  if (!resolvedStartDate) {
    throw new Error(
      `Missing required startDate. Provide startDate=YYYY-MM-DD when runMode=${runMode}.`,
    );
  }

  const startDateObj = parseISO(resolvedStartDate);
  if (!isValid(startDateObj)) {
    throw new Error(
      `Invalid startDate format: ${resolvedStartDate}. Expected YYYY-MM-DD.`,
    );
  }

  let endDate = today;
  if (runMode === "single") {
    endDate = resolvedStartDate;
  } else if (runMode === "reverse") {
    const earliestSeasonStartDate = await getEarliestSeasonStartDate();
    if (!earliestSeasonStartDate) {
      throw new Error(
        "Could not determine earliest season start date for reverse mode.",
      );
    }
    endDate = earliestSeasonStartDate;
  }

  const endDateObj = parseISO(endDate);
  const dateStep = runMode === "reverse" ? -1 : 1;
  const isOutOfRange =
    runMode === "reverse"
      ? isBefore(startDateObj, endDateObj)
      : isAfter(startDateObj, endDateObj);

  if (isOutOfRange) {
    return {
      message: `No dates to process. startDate ${resolvedStartDate} is already beyond the ${runMode} target boundary ${endDate}.`,
      success: true,
      totalUpdates: 0,
      totalErrors: 0,
      startDate: resolvedStartDate,
      endDate,
      runMode,
      overwrite,
      processedDates: 0,
      skippedDates: 0,
    };
  }

  let currentDate = startDateObj;
  let totalUpdates = 0;
  let totalErrors = 0;
  let processedDates = 0;
  let skippedDates = 0;

  while (
    runMode === "reverse"
      ? !isBefore(currentDate, endDateObj)
      : !isAfter(currentDate, endDateObj)
  ) {
    const formattedDate = format(currentDate, "yyyy-MM-dd");

    try {
      const hasExistingData =
        await hasExistingGoalieStatsForDate(formattedDate);
      if (hasExistingData && !overwrite) {
        skippedDates++;
      } else {
        const dailyResult = await updateGoalieStats(formattedDate, {
          pruneExistingAfterWrite: hasExistingData && overwrite,
        });
        totalUpdates += dailyResult.actualUpsertCount;
      }
      processedDates++;
    } catch (error: any) {
      if (
        error instanceof WgoGoalieWriteError ||
        error instanceof WgoGoalieFetchError ||
        error instanceof WgoGoaliePruneError
      ) {
        error.addCompletedRowsBeforeFailure(totalUpdates);
        throw error;
      }
      totalErrors++;
      console.error(
        `Error processing ${formattedDate} in ${runMode} mode:`,
        error.message,
      );
    }

    currentDate = addDays(currentDate, dateStep);
  }

  return {
    message: `Completed ${runMode} goalie stats run from ${resolvedStartDate} to ${endDate}.`,
    success: totalErrors === 0,
    totalUpdates,
    totalErrors,
    startDate: resolvedStartDate,
    endDate,
    runMode,
    overwrite,
    processedDates,
    skippedDates,
  };
}

// --- API Handler ---
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const jobName = "update-all-wgo-goalies";
  const startTime = Date.now();

  let status: "success" | "error" = "success";
  let rowsAffected = 0; // Note: This becomes an aggregate or estimate for multi-day/season actions
  let totalErrors = 0;
  let details: any = {};
  let responseMessage = "";
  let responseData: any = {};
  let responseBody: any = null;
  let intendedStatusCode = 200;

  try {
    const actionParam = req.query.action as string | undefined;
    const dateParam = req.query.date as string | undefined;
    const playerIdParam = req.query.playerId as string | undefined;
    const runModeParam = parseRunMode(req.query.runMode);
    const startDateParam = parseDateParam(req.query.startDate);
    const overwriteParam = parseBooleanParam(req.query.overwrite);
    const goalieFullName =
      (req.query.goalieFullName as string | undefined) || "Unknown Goalie";
    const seasonParam = req.query.season as string | undefined; // Expects format like '20232024'

    const hasRangeParams =
      runModeParam !== undefined ||
      req.query.startDate !== undefined ||
      req.query.overwrite !== undefined;

    if (hasRangeParams) {
      if (actionParam || dateParam || playerIdParam) {
        throw new Error(
          "Invalid parameter combination. runMode/startDate/overwrite cannot be combined with action, date, or playerId request modes.",
        );
      }

      if (req.query.startDate !== undefined && !startDateParam) {
        throw new Error(
          `Invalid startDate format: ${Array.isArray(req.query.startDate) ? req.query.startDate[0] : req.query.startDate}. Expected YYYY-MM-DD.`,
        );
      }

      if (req.query.overwrite !== undefined && overwriteParam === undefined) {
        throw new Error(
          "Invalid overwrite value. Use true/false, yes/no, or 1/0.",
        );
      }

      const runMode = runModeParam ?? "incremental";
      if (
        (runMode === "forward" ||
          runMode === "reverse" ||
          runMode === "single") &&
        !startDateParam
      ) {
        throw new Error(
          `Missing required startDate. Provide startDate=YYYY-MM-DD when runMode=${runMode}.`,
        );
      }

      details.action = `${runMode}_range_update`;
      const result = await runGoalieStatsDateRange({
        runMode,
        startDate: startDateParam,
        overwrite: overwriteParam,
      });
      rowsAffected = result.totalUpdates;
      totalErrors = result.totalErrors;
      status = result.success ? "success" : "error";
      responseMessage = result.message;
      details = {
        ...details,
        runMode: result.runMode,
        overwrite: result.overwrite,
        startDate: result.startDate,
        endDate: result.endDate,
        processedDates: result.processedDates,
        skippedDates: result.skippedDates,
        totalUpdates: result.totalUpdates,
        totalErrors: result.totalErrors,
      };
      responseData = result;
    }

    // --- Action: all (Incremental Update) ---
    else if (actionParam === "all") {
      details.action = "incremental_update";
      // Use the updateRecentGoalieStats function for incremental updates
      const result = await updateRecentGoalieStats();
      rowsAffected = result.totalUpdates;
      totalErrors = result.totalErrors;
      status = result.totalErrors === 0 ? "success" : "error";
      responseMessage = `Incremental update finished. Updated ${result.totalUpdates} goalie stats with ${result.totalErrors} errors.`;
      details = {
        ...details,
        totalUpdates: result.totalUpdates,
        totalErrors: result.totalErrors,
        success: result.totalErrors === 0,
      };
      responseData = result;
    }

    // --- Action: fullRefresh (Specific Season or All History) ---
    else if (actionParam === "fullRefresh") {
      if (seasonParam) {
        // Process Specific Season
        details.action = "full_refresh_single_season";
        const targetSeasonId = parseInt(seasonParam, 10);
        if (isNaN(targetSeasonId)) {
          throw new Error(
            `Invalid season parameter format: ${seasonParam}. Expected numeric ID like 20232024.`,
          );
        }
        console.log(`Received request for specific season: ${targetSeasonId}`);
        details.targetSeasonId = targetSeasonId;

        const result = await updateAllGoalieStatsForSeason(targetSeasonId);
        rowsAffected = result.totalUpdates;
        totalErrors = result.totalErrors;
        status = result.success ? "success" : "error";
        responseMessage = result.message;
        details = {
          ...details,
          totalUpdates: result.totalUpdates,
          totalErrors: result.totalErrors,
        };
        responseData = result;
      } else {
        // Process All Historical Seasons
        details.action = "full_refresh_all_history";
        const result = await updateAllHistoricalGoalieStats();
        rowsAffected = result.totalUpdates; // Aggregate
        totalErrors = result.totalErrors;
        status = result.success ? "success" : "error";
        responseMessage = result.message;
        details = { ...details, ...result }; // Merge result details
        responseData = result;
      }
    }

    // --- Action: date (Update Single Date) ---
    else if (dateParam && !actionParam && !playerIdParam) {
      // Check it's *only* dateParam
      details.action = "single_date_update";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        throw new Error(
          `Invalid date format: ${dateParam}. Expected YYYY-MM-DD.`,
        );
      }
      const result = await updateGoalieStats(dateParam);
      rowsAffected = result.actualUpsertCount; // Use actual upsert count instead of fetched count
      // We consider the API call successful even if no stats found, unless underlying fetch fails
      status = "success"; // Assume success unless updateGoalieStats throws
      responseMessage = `Processed goalie stats update request for date ${dateParam}.`;
      details = {
        ...details,
        processedDate: result.processedDate,
        updated: result.updated,
        statsFetched: result.goalieStats.length,
        actualUpserts: result.actualUpsertCount,
      };
      responseData = result;
    }

    // --- Action: Fetch Single Player (requires date) ---
    else if (playerIdParam && dateParam && !actionParam) {
      // Check it's player and date only
      details.action = "fetch_single_player";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        throw new Error(
          `Invalid date format: ${dateParam}. Expected YYYY-MM-DD.`,
        );
      }
      const normalizedPlayerId = normalizePositivePlayerId(playerIdParam);
      if (!normalizedPlayerId) {
        throw new Error("Invalid playerId. Expected a positive safe integer.");
      }
      const result = await fetchDataForPlayer(
        normalizedPlayerId,
        goalieFullName,
        dateParam,
      );

      if (result === null) {
        throw new Error(
          `Failed to fetch player data for ${normalizedPlayerId} on ${dateParam}, possibly missing season context.`,
        );
      }

      rowsAffected = result.goalieStats.length; // Count fetched stats
      status = "success";
      responseMessage = `Successfully fetched goalie stats for player ${goalieFullName} up to ${dateParam}.`;
      details = {
        ...details,
        fetched: rowsAffected > 0,
        dateContext: dateParam,
        playerId: normalizedPlayerId,
      };
      responseData = result;
    }

    // --- No valid action or parameter combination ---
    else {
      throw new Error(
        "Missing or invalid required parameters. Valid combinations: 'action=all', 'action=fullRefresh' (optional '&season=YYYYYYYY'), 'date=YYYY-MM-DD', or 'playerId=<id>&date=YYYY-MM-DD'.",
      );
    }

    // --- Prepare the domain response; send only after audit persistence ---
    responseBody = {
      // Use 500 if process finished with errors
      message: responseMessage,
      success: status === "success",
      data: responseData, // Include detailed result object
    };
    intendedStatusCode = status === "success" ? 200 : 500;
  } catch (err: any) {
    console.error("Error in handler:", err);
    const goalieFailureClassification =
      classifyWgoGoalieWriteFailure(err) ??
      classifyWgoGoalieFetchFailure(err) ??
      classifyWgoGoaliePruneFailure(err);
    const goalieFailure =
      getWgoGoalieWriteFailureDetails(err) ??
      getWgoGoalieFetchFailureDetails(err) ??
      getWgoGoaliePruneFailureDetails(err);
    status = goalieFailureClassification?.jobStatus ?? "error";
    if (err instanceof WgoGoalieWriteError) {
      rowsAffected = err.details.totalPersistedRows;
    } else if (err instanceof WgoGoalieFetchError) {
      rowsAffected = err.details.completedRowsBeforeFailure;
    } else if (err instanceof WgoGoaliePruneError) {
      rowsAffected = err.details.totalPersistedRows;
    }
    // Add error message to details ONLY if not already set by specific actions
    details = {
      ...details,
      error: err.message,
      ...(goalieFailure ?? {}),
    };
    intendedStatusCode = goalieFailureClassification
      ? goalieFailureClassification.httpStatus
      : err.message.includes("Invalid") || err.message.includes("Missing")
        ? 400
        : 500;
    responseBody = goalieFailureClassification?.response ?? {
      message: err.message,
      success: false,
    };
  }

  const elapsedMs = Date.now() - startTime;
  details = { ...details, processingTimeMs: elapsedMs };

  try {
    const { error: auditError } = await supabase.from("cron_job_audit").insert([
      {
        job_name: jobName,
        status,
        rows_affected: rowsAffected,
        details: {
          method: req.method ?? null,
          url: req.url ?? null,
          statusCode: intendedStatusCode,
          intendedStatusCode,
          durationMs: elapsedMs,
          error:
            status === "error"
              ? (details?.error ?? responseMessage ?? "Unknown error")
              : null,
          response: responseBody,
          context: details,
        },
      },
    ]);
    if (auditError) {
      throw auditError;
    }
  } catch (auditErr: unknown) {
    const auditError = sanitizeWgoGoalieDiagnostic(auditErr);
    console.error("Failed to write audit row:", auditError);
    return res.status(500).json({
      message: "Failed to persist the required cron audit row.",
      success: false,
      code: "WGO_GOALIE_AUDIT_WRITE_FAILED",
      intendedStatusCode,
      auditError,
    });
  }

  return res.status(intendedStatusCode).json(responseBody);
}

export default adminOnly(handler);
