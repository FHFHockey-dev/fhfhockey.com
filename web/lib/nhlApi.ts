// lib/nhlApi.ts

import Fetch from "lib/cors-fetch"; // Assuming this exists and works
import { format, parseISO } from "date-fns";
import type {
  Week,
  ApiResponse,
  ApiGoalieData, // Expecting game-level data now
  ApiSeasonData,
  Season
} from "components/GoaliePage/goalieTypes"; // Adjust path if needed

const BASE_NHL_API_URL = "https://api-web.nhle.com/v1"; // Switched to potential newer base URL structure
const BASE_NHL_STATS_API_URL = "https://api.nhle.com/stats/rest/en"; // Keep old one for stats?

// Helper to build the goalie stats URL (using stats API)
const buildGoalieApiUrl = (week: Week): string => {
  const startDt =
    week.start instanceof Date ? week.start : new Date(week.start);
  const endDt = week.end instanceof Date ? week.end : new Date(week.end);

  if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) {
    console.error("Invalid date provided to buildGoalieApiUrl:", week);
    return "";
  }

  const formattedStartDate = format(startDt, "yyyy-MM-dd");
  // Include the whole end day
  const formattedEndDate = format(endDt, "yyyy-MM-dd"); // API seems inclusive

  // Construct the report parameters for game-level goalie stats
  // Reference: Check NHL API documentation or observe network requests on NHL.com
  // This endpoint might require different parameters or structure.
  // Example using the known endpoint (might need adjustments):
  const reportName = "goaliesummary"; // Check if this report supports isGame=true properly

  // Parameters might include:
  // - reportName=goaliesummary
  // - isAggregate=false
  // - isGame=true
  // - factCayenneExp="gamesPlayed>=0" (or maybe "gamesPlayed>=1")
  // - cayenneExp= (date range and gameTypeId=2)
  // - sort (optional, e.g., by date or player ID)
  // - limit (important!)
  // - start (for pagination, maybe not supported well)

  // Let's try constructing the URL using known patterns
  const reportParams = `isAggregate=false&isGame=true`;
  const filterParams = `factCayenneExp=gamesPlayed%3E=0`; // Filter for goalies who appeared
  // Ensure gameTypeId=2 (regular season) is included, adjust if playoffs needed
  // Ensure date comparison uses the correct field (e.g., gameDate)
  const dateFilter = `cayenneExp=gameDate%3C%3D%22${formattedEndDate}%22%20and%20gameDate%3E%3D%22${formattedStartDate}%22%20and%20gameTypeId=2`;
  const paginationParams = `start=0&limit=300`; // Increased limit significantly, assuming many games per week

  // **Critical**: Verify the endpoint and parameters needed for game-by-game stats.
  // The old URL structure was: `${BASE_NHL_STATS_API_URL}/goalie/summary?${reportParams}...`
  // Let's stick with that for now unless confirmed otherwise.
  const finalUrl = `${BASE_NHL_STATS_API_URL}/goalie/summary?${reportParams}&${filterParams}&${dateFilter}&${paginationParams}&sort=[{"property":"gameDate","direction":"ASC"},{"property":"playerId","direction":"ASC"}]`;

  console.log("Constructed NHL API URL for week:", finalUrl); // Log for debugging
  return finalUrl;
};

// Fetch Active Season Data (using newer base URL potentially)
export const fetchSeasonData = async (): Promise<Season> => {
  // Try the newer endpoint structure first
  // const url = `${BASE_NHL_API_URL}/season`; // This might just return current season ID
  // Fallback to the stats API endpoint if needed
  const seasonUrl = `${BASE_NHL_STATS_API_URL}/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22DESC%22%7D%5D&limit=2`;

  try {
    const response = await Fetch(seasonUrl); // Use the CORS Fetch wrapper
    if (!response.ok) {
      throw new Error(
        `NHL API Error: ${response.status} - Failed to fetch season data from ${seasonUrl}`
      );
    }
    // Assuming structure { data: [ { id, regularSeasonStartDate, regularSeasonEndDate, ... } ] }
    const json: ApiResponse<ApiSeasonData> = await response.json();

    if (!json.data || json.data.length === 0) {
      throw new Error("No season data returned from NHL API");
    }

    // Logic to determine the correct season (current or previous)
    let seasonData = json.data[0];
    // Rename API fields to match expected Season interface fields (if needed)
    // Assuming API returns startDate and regularSeasonEndDate
    let seasonStart = parseISO(seasonData.startDate);
    const today = new Date();

    // If today is before the official start date of the latest season, use the previous one
    if (today < seasonStart && json.data.length > 1) {
      seasonData = json.data[1];
      seasonStart = parseISO(seasonData.startDate);
    }
    // Use regularSeasonEndDate for the end of the period we care about
    const seasonEnd = parseISO(seasonData.regularSeasonEndDate);

    if (isNaN(seasonStart.getTime()) || isNaN(seasonEnd.getTime())) {
      throw new Error("Invalid date format received for season start/end");
    }

    console.log("Using Season:", { start: seasonStart, end: seasonEnd });
    return { start: seasonStart, end: seasonEnd };
  } catch (error) {
    console.error("Error in fetchSeasonData:", error);
    // Provide a default fallback or re-throw
    throw new Error(
      `Failed to fetch or parse season data: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    // Or return a default season? Might hide underlying issues.
    // return { start: new Date(2023, 9, 10), end: new Date(2024, 3, 18) }; // Example fallback
  }
};

// Fetch Goalie Stats (Games) for multiple weeks concurrently
export const fetchGoalieStatsForWeeks = async (
  weeks: Week[]
): Promise<Map<number, ApiGoalieData[]>> => {
  if (!weeks || weeks.length === 0) {
    return new Map();
  }

  const promises = weeks.map(async (week, index) => {
    const url = buildGoalieApiUrl(week);
    if (!url) {
      console.warn(
        `Skipping fetch for week index ${index} due to invalid date.`
      );
      return { weekIndex: index, data: [] }; // Return data format consistent with success
    }
    try {
      const response = await Fetch(url); // Use CORS Fetch wrapper
      if (!response.ok) {
        // Log more details on failure
        const errorText = await response
          .text()
          .catch(() => "Could not read error text");
        console.warn(
          `Failed to fetch data for week index ${index} (URL: ${url}): ${response.status} ${response.statusText}. Response: ${errorText}`
        );
        return { weekIndex: index, data: [] }; // Return empty data for this week
      }
      const json: ApiResponse<ApiGoalieData> = await response.json();
      // Ensure gameDate is included if the API provides it, otherwise it needs to be added based on context if possible
      // The 'ApiGoalieData' type should include 'gameDate?: string | Date'
      // Add basic validation/transformation if needed
      const games = (json.data || []).map((game) => ({
        ...game,
        // Attempt to parse gameDate if it exists and is a string
        gameDate:
          game.gameDate && typeof game.gameDate === "string"
            ? parseISO(game.gameDate)
            : game.gameDate,
        // Ensure essential numeric fields are numbers, default to 0 if null/undefined
        saves: game.saves ?? 0,
        shotsAgainst: game.shotsAgainst ?? 0,
        goalsAgainst: game.goalsAgainst ?? 0,
        timeOnIce: game.timeOnIce ?? 0,
        wins: game.wins ?? 0,
        losses: game.losses ?? 0,
        otLosses: game.otLosses ?? 0,
        shutouts: game.shutouts ?? 0,
        gamesPlayed: game.gamesPlayed ?? (game.timeOnIce > 0 ? 1 : 0), // Infer GP
        gamesStarted: game.gamesStarted ?? (game.timeOnIce > 0 ? 1 : 0) // Infer GS? Risky.
      }));

      return { weekIndex: index, data: games };
    } catch (error) {
      console.error(`Error fetching week index ${index} (URL: ${url}):`, error);
      return { weekIndex: index, data: [] }; // Consistent error return
    }
  });

  const results = await Promise.all(promises);
  const weeklyDataMap = new Map<number, ApiGoalieData[]>();
  results.forEach((result) => {
    // The key is the original index in the input 'weeks' array
    weeklyDataMap.set(result.weekIndex, result.data);
  });
  return weeklyDataMap;
};

// Fetch Goalie Stats (Games) for a single week
export const fetchGoalieStatsForSingleWeek = async (
  week: Week
): Promise<ApiGoalieData[]> => {
  const url = buildGoalieApiUrl(week);
  if (!url) return [];

  try {
    const response = await Fetch(url); // Use CORS Fetch wrapper
    if (!response.ok) {
      const errorText = await response
        .text()
        .catch(() => "Could not read error text");
      console.warn(
        `Failed to fetch data for single week (URL: ${url}): ${response.status} ${response.statusText}. Response: ${errorText}`
      );
      return [];
    }
    const json: ApiResponse<ApiGoalieData> = await response.json();
    // Apply same validation/transformation as in fetchGoalieStatsForWeeks
    const games = (json.data || []).map((game) => ({
      ...game,
      gameDate:
        game.gameDate && typeof game.gameDate === "string"
          ? parseISO(game.gameDate)
          : game.gameDate,
      saves: game.saves ?? 0,
      shotsAgainst: game.shotsAgainst ?? 0,
      goalsAgainst: game.goalsAgainst ?? 0,
      timeOnIce: game.timeOnIce ?? 0,
      wins: game.wins ?? 0,
      losses: game.losses ?? 0,
      otLosses: game.otLosses ?? 0,
      shutouts: game.shutouts ?? 0,
      gamesPlayed: game.gamesPlayed ?? (game.timeOnIce > 0 ? 1 : 0),
      gamesStarted: game.gamesStarted ?? (game.timeOnIce > 0 ? 1 : 0)
    }));
    return games;
  } catch (error) {
    console.error(`Error fetching single week (URL: ${url}):`, error);
    return [];
  }
};
