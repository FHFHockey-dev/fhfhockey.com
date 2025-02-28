import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import Fetch from "lib/cors-fetch";
import { getCurrentSeason } from "lib/NHL/server";
import {
  WGOSummarySkaterTotal,
  WGOSkatersBio,
  WGORealtimeSkaterTotal,
  WGOFaceoffSkaterTotal,
  WGOFaceOffWinLossSkaterTotal,
  WGOGoalsForAgainstSkaterTotal,
  WGOPenaltySkaterTotal,
  WGOPenaltyKillSkaterTotal,
  WGOPowerPlaySkaterTotal,
  WGOPuckPossessionSkaterTotal,
  WGOSatCountSkaterTotal,
  WGOSatPercentageSkaterTotal,
  WGOScoringRatesSkaterTotal,
  WGOScoringCountsSkaterTotal,
  WGOShotTypeSkaterTotal,
  WGOToiSkaterTotal
} from "lib/NHL/types";

import pLimit from "p-limit";

// Define the structure of the NHL API response for skater stats
interface NHLApiResponse {
  data:
    | WGOSummarySkaterTotal[]
    | WGOSkatersBio[]
    | WGORealtimeSkaterTotal[]
    | WGOFaceoffSkaterTotal[]
    | WGOFaceOffWinLossSkaterTotal[]
    | WGOGoalsForAgainstSkaterTotal[]
    | WGOPenaltySkaterTotal[]
    | WGOPenaltyKillSkaterTotal[]
    | WGOPowerPlaySkaterTotal[]
    | WGOPuckPossessionSkaterTotal[]
    | WGOSatCountSkaterTotal[]
    | WGOSatPercentageSkaterTotal[]
    | WGOScoringRatesSkaterTotal[]
    | WGOScoringCountsSkaterTotal[]
    | WGOShotTypeSkaterTotal[]
    | WGOToiSkaterTotal[];
}

// Interface for Season from getCurrentSeason
interface Season {
  seasonId: string;
  regularSeasonStartDate: string;
  regularSeasonEndDate: string;
  seasonEndDate: string;
  numberOfGames: number;
  lastSeasonId: string;
  lastRegularSeasonStartDate: string;
  lastRegularSeasonEndDate: string;
  lastSeasonEndDate: string;
  lastNumberOfGames: number;
  slice(arg0: number, arg1: number): string;
}

// ==============================
// NEW: Helper function to get the earliest season ID from the NHL season endpoint.
async function getEarliestSeasonID(): Promise<string> {
  const response = await Fetch(
    "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22ASC%22%7D%5D"
  ).then((res) => res.json());
  // Assumes that response.data is an array and that the first item’s "id" property holds the earliest season id.
  return response.data[0].id.toString();
}

// ==============================
// Helper function "fetchPage" to concurrently fetch one page of data.
// This function builds all URLs using the given "start" value and returns an object
// with all fetched arrays.
async function fetchPage(
  season: string,
  start: number,
  limit: number
): Promise<{
  skaterTotalStats: WGOSummarySkaterTotal[];
  skatersBio: WGOSkatersBio[];
  miscTotalSkaterStats: WGORealtimeSkaterTotal[];
  faceOffTotalStats: WGOFaceoffSkaterTotal[];
  faceoffWinLossTotalStats: WGOFaceOffWinLossSkaterTotal[];
  goalsForAgainstTotalStats: WGOGoalsForAgainstSkaterTotal[];
  penaltiesTotalStats: WGOPenaltySkaterTotal[];
  penaltyKillTotalStats: WGOPenaltyKillSkaterTotal[];
  powerPlayTotalStats: WGOPowerPlaySkaterTotal[];
  puckPossessionTotalStats: WGOPuckPossessionSkaterTotal[];
  satCountsTotalStats: WGOSatCountSkaterTotal[];
  satPercentagesTotalStats: WGOSatPercentageSkaterTotal[];
  scoringRatesTotalStats: WGOScoringRatesSkaterTotal[];
  scoringPerGameTotalStats: WGOScoringCountsSkaterTotal[];
  shotTypeTotalStats: WGOShotTypeSkaterTotal[];
  timeOnIceTotalStats: WGOToiSkaterTotal[];
}> {
  const skaterTotalStatsUrl = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goals%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22assists%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
  const skatersBioUrl = `https://api.nhle.com/stats/rest/en/skater/bios?isAggregate=false&isGame=false&sort=%5B%7B%22property%22:%22lastName%22,%22direction%22:%22ASC_CI%22%7D,%7B%22property%22:%22skaterFullName%22,%22direction%22:%22ASC_CI%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
  const miscSkaterTotalsUrl = `https://api.nhle.com/stats/rest/en/skater/realtime?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22hits%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
  const faceOffTotalsUrl = `https://api.nhle.com/stats/rest/en/skater/faceoffpercentages?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22totalFaceoffs%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
  const faceoffWinLossTotalsUrl = `https://api.nhle.com/stats/rest/en/skater/faceoffwins?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22totalFaceoffWins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22faceoffWinPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
  const goalsForAgainstTotalsUrl = `https://api.nhle.com/stats/rest/en/skater/goalsForAgainst?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22evenStrengthGoalDifference%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
  const penaltiesTotalsUrl = `https://api.nhle.com/stats/rest/en/skater/penalties?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22penaltyMinutes%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
  const penaltyKillTotalsUrl = `https://api.nhle.com/stats/rest/en/skater/penaltykill?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22shTimeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
  const powerPlayTotalsUrl = `https://api.nhle.com/stats/rest/en/skater/powerplay?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22ppTimeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
  const puckPossessionTotalsUrl = `https://api.nhle.com/stats/rest/en/skater/puckPossessions?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22satPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
  const satCountsTotalsUrl = `https://api.nhle.com/stats/rest/en/skater/summaryshooting?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22satTotal%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22usatTotal%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
  const satPercentagesTotalsUrl = `https://api.nhle.com/stats/rest/en/skater/percentages?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22satPercentage%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
  const scoringRatesTotalsUrl = `https://api.nhle.com/stats/rest/en/skater/scoringRates?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22pointsPer605v5%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsPer605v5%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
  const scoringPerGameTotalsUrl = `https://api.nhle.com/stats/rest/en/skater/scoringpergame?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22pointsPerGame%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsPerGame%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
  const shotTypeTotalsUrl = `https://api.nhle.com/stats/rest/en/skater/shottype?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22shootingPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22shootingPctBat%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
  const timeOnIceTotalsUrl = `https://api.nhle.com/stats/rest/en/skater/timeonice?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22timeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
  const [
    skaterTotalStatsResponse,
    bioStatsResponse,
    miscSkaterTotalsResponse,
    faceOffTotalsResponse,
    faceoffWinLossTotalsResponse,
    goalsForAgainstTotalsResponse,
    penaltiesTotalsResponse,
    penaltyKillTotalsResponse,
    powerPlayTotalsResponse,
    puckPossessionTotalsResponse,
    satCountsTotalsResponse,
    satPercentagesTotalsResponse,
    scoringRatesTotalsResponse,
    scoringPerGameTotalsResponse,
    shotTypeTotalsResponse,
    timeOnIceTotalsResponse
  ] = await Promise.all([
    Fetch(skaterTotalStatsUrl).then((res) => {
      // Capture headers from the first request to get total count if available.
      return res.json() as Promise<NHLApiResponse>;
    }),
    Fetch(skatersBioUrl).then((res) => res.json() as Promise<NHLApiResponse>),
    Fetch(miscSkaterTotalsUrl).then(
      (res) => res.json() as Promise<NHLApiResponse>
    ),
    Fetch(faceOffTotalsUrl).then(
      (res) => res.json() as Promise<NHLApiResponse>
    ),
    Fetch(faceoffWinLossTotalsUrl).then(
      (res) => res.json() as Promise<NHLApiResponse>
    ),
    Fetch(goalsForAgainstTotalsUrl).then(
      (res) => res.json() as Promise<NHLApiResponse>
    ),
    Fetch(penaltiesTotalsUrl).then(
      (res) => res.json() as Promise<NHLApiResponse>
    ),
    Fetch(penaltyKillTotalsUrl).then(
      (res) => res.json() as Promise<NHLApiResponse>
    ),
    Fetch(powerPlayTotalsUrl).then(
      (res) => res.json() as Promise<NHLApiResponse>
    ),
    Fetch(puckPossessionTotalsUrl).then(
      (res) => res.json() as Promise<NHLApiResponse>
    ),
    Fetch(satCountsTotalsUrl).then(
      (res) => res.json() as Promise<NHLApiResponse>
    ),
    Fetch(satPercentagesTotalsUrl).then(
      (res) => res.json() as Promise<NHLApiResponse>
    ),
    Fetch(scoringRatesTotalsUrl).then(
      (res) => res.json() as Promise<NHLApiResponse>
    ),
    Fetch(scoringPerGameTotalsUrl).then(
      (res) => res.json() as Promise<NHLApiResponse>
    ),
    Fetch(shotTypeTotalsUrl).then(
      (res) => res.json() as Promise<NHLApiResponse>
    ),
    Fetch(timeOnIceTotalsUrl).then(
      (res) => res.json() as Promise<NHLApiResponse>
    )
  ]);
  // Return concatenated results as before
  return {
    skaterTotalStats: skaterTotalStatsResponse.data as WGOSummarySkaterTotal[],
    skatersBio: bioStatsResponse.data as WGOSkatersBio[],
    miscTotalSkaterStats:
      miscSkaterTotalsResponse.data as WGORealtimeSkaterTotal[],
    faceOffTotalStats: faceOffTotalsResponse.data as WGOFaceoffSkaterTotal[],
    faceoffWinLossTotalStats:
      faceoffWinLossTotalsResponse.data as WGOFaceOffWinLossSkaterTotal[],
    goalsForAgainstTotalStats:
      goalsForAgainstTotalsResponse.data as WGOGoalsForAgainstSkaterTotal[],
    penaltiesTotalStats:
      penaltiesTotalsResponse.data as WGOPenaltySkaterTotal[],
    penaltyKillTotalStats:
      penaltyKillTotalsResponse.data as WGOPenaltyKillSkaterTotal[],
    powerPlayTotalStats:
      powerPlayTotalsResponse.data as WGOPowerPlaySkaterTotal[],
    puckPossessionTotalStats:
      puckPossessionTotalsResponse.data as WGOPuckPossessionSkaterTotal[],
    satCountsTotalStats:
      satCountsTotalsResponse.data as WGOSatCountSkaterTotal[],
    satPercentagesTotalStats:
      satPercentagesTotalsResponse.data as WGOSatPercentageSkaterTotal[],
    scoringRatesTotalStats:
      scoringRatesTotalsResponse.data as WGOScoringRatesSkaterTotal[],
    scoringPerGameTotalStats:
      scoringPerGameTotalsResponse.data as WGOScoringCountsSkaterTotal[],
    shotTypeTotalStats: shotTypeTotalsResponse.data as WGOShotTypeSkaterTotal[],
    timeOnIceTotalStats: timeOnIceTotalsResponse.data as WGOToiSkaterTotal[]
  };
}

async function fetchAllTotalsForSeason(
  season: string,
  limit: number
): Promise<{
  skaterTotalStats: WGOSummarySkaterTotal[];
  skatersBio: WGOSkatersBio[];
  miscTotalSkaterStats: WGORealtimeSkaterTotal[];
  faceOffTotalStats: WGOFaceoffSkaterTotal[];
  faceoffWinLossTotalStats: WGOFaceOffWinLossSkaterTotal[];
  goalsForAgainstTotalStats: WGOGoalsForAgainstSkaterTotal[];
  penaltiesTotalStats: WGOPenaltySkaterTotal[];
  penaltyKillTotalStats: WGOPenaltyKillSkaterTotal[];
  powerPlayTotalStats: WGOPowerPlaySkaterTotal[];
  puckPossessionTotalStats: WGOPuckPossessionSkaterTotal[];
  satCountsTotalStats: WGOSatCountSkaterTotal[];
  satPercentagesTotalStats: WGOSatPercentageSkaterTotal[];
  scoringRatesTotalStats: WGOScoringRatesSkaterTotal[];
  scoringPerGameTotalStats: WGOScoringCountsSkaterTotal[];
  shotTypeTotalStats: WGOShotTypeSkaterTotal[];
  timeOnIceTotalStats: WGOToiSkaterTotal[];
}> {
  console.log(`Fetching data for season ${season}...`);
  let start = 0;
  let moreData = true;

  // Initialize empty arrays to hold all data
  const combined = {
    skaterTotalStats: [] as WGOSummarySkaterTotal[],
    skatersBio: [] as WGOSkatersBio[],
    miscTotalSkaterStats: [] as WGORealtimeSkaterTotal[],
    faceOffTotalStats: [] as WGOFaceoffSkaterTotal[],
    faceoffWinLossTotalStats: [] as WGOFaceOffWinLossSkaterTotal[],
    goalsForAgainstTotalStats: [] as WGOGoalsForAgainstSkaterTotal[],
    penaltiesTotalStats: [] as WGOPenaltySkaterTotal[],
    penaltyKillTotalStats: [] as WGOPenaltyKillSkaterTotal[],
    powerPlayTotalStats: [] as WGOPowerPlaySkaterTotal[],
    puckPossessionTotalStats: [] as WGOPuckPossessionSkaterTotal[],
    satCountsTotalStats: [] as WGOSatCountSkaterTotal[],
    satPercentagesTotalStats: [] as WGOSatPercentageSkaterTotal[],
    scoringRatesTotalStats: [] as WGOScoringRatesSkaterTotal[],
    scoringPerGameTotalStats: [] as WGOScoringCountsSkaterTotal[],
    shotTypeTotalStats: [] as WGOShotTypeSkaterTotal[],
    timeOnIceTotalStats: [] as WGOToiSkaterTotal[]
  };

  // Continue paginating until a page returns fewer than the limit.
  while (moreData) {
    const pageData = await fetchPage(season, start, limit);
    combined.skaterTotalStats.push(...pageData.skaterTotalStats);
    combined.skatersBio.push(...pageData.skatersBio);
    combined.miscTotalSkaterStats.push(...pageData.miscTotalSkaterStats);
    combined.faceOffTotalStats.push(...pageData.faceOffTotalStats);
    combined.faceoffWinLossTotalStats.push(
      ...pageData.faceoffWinLossTotalStats
    );
    combined.goalsForAgainstTotalStats.push(
      ...pageData.goalsForAgainstTotalStats
    );
    combined.penaltiesTotalStats.push(...pageData.penaltiesTotalStats);
    combined.penaltyKillTotalStats.push(...pageData.penaltyKillTotalStats);
    combined.powerPlayTotalStats.push(...pageData.powerPlayTotalStats);
    combined.puckPossessionTotalStats.push(
      ...pageData.puckPossessionTotalStats
    );
    combined.satCountsTotalStats.push(...pageData.satCountsTotalStats);
    combined.satPercentagesTotalStats.push(
      ...pageData.satPercentagesTotalStats
    );
    combined.scoringRatesTotalStats.push(...pageData.scoringRatesTotalStats);
    combined.scoringPerGameTotalStats.push(
      ...pageData.scoringPerGameTotalStats
    );
    combined.shotTypeTotalStats.push(...pageData.shotTypeTotalStats);
    combined.timeOnIceTotalStats.push(...pageData.timeOnIceTotalStats);

    // If the current page returned less than "limit" items, we're done.
    if (pageData.skaterTotalStats.length < limit) {
      moreData = false;
    } else {
      start += limit;
    }
  }

  return combined;
}

// ==============================
// Modified processSeasons() to decide the starting season based on table data.
async function processSeasons(): Promise<{
  seasonsProcessed: string[];
  totalTimeInSeconds: number;
}> {
  const overallStartTime = Date.now();
  const currentSeason = await getCurrentSeason();
  const currentSeasonId = currentSeason.seasonId.toString();

  // Get the most recent season in the database.
  let dbSeason = await getMostRecentSeasonInDB();
  if (!dbSeason) {
    // CASE 1: Table is empty – use earliest season from the endpoint.
    dbSeason = await getEarliestSeasonID();
    console.log(`No data in DB. Starting from earliest season: ${dbSeason}`);
  } else {
    console.log(`Most recent season in DB: ${dbSeason}`);
  }

  // Build an array of season IDs to process from dbSeason to currentSeasonId (inclusive).
  const seasons: string[] = [];
  let seasonToProcess = dbSeason;
  while (parseInt(seasonToProcess) <= parseInt(currentSeasonId)) {
    seasons.push(seasonToProcess);
    seasonToProcess = getNextSeason(seasonToProcess);
  }
  console.log(`Seasons to update: ${seasons.join(", ")}`);

  // Use pLimit to update multiple seasons concurrently (e.g., limit to 2 concurrent updates)
  const seasonLimit = pLimit(2);
  const updateTasks = seasons.map((season) =>
    seasonLimit(() => {
      console.log(`Updating season: ${season}`);
      return updateSkaterTotals(season);
    })
  );
  await Promise.all(updateTasks);

  const overallEndTime = Date.now();
  const totalTimeInSeconds = (overallEndTime - overallStartTime) / 1000;
  console.log(
    `Total script execution time: ${totalTimeInSeconds.toFixed(2)} seconds.`
  );
  return {
    seasonsProcessed: seasons,
    totalTimeInSeconds
  };
}

// ==============================
// getMostRecentSeasonInDB() and getNextSeason() remain unchanged.
async function getMostRecentSeasonInDB(): Promise<string | null> {
  const { data, error } = await supabase
    .from("wgo_skater_stats_totals")
    .select("season")
    .order("season", { ascending: false })
    .limit(1);
  if (error) {
    console.error("Error fetching most recent season:", error);
    return null;
  }
  return data.length > 0 ? data[0].season : null;
}

function getNextSeason(currentSeason: string): string {
  const startYear = parseInt(currentSeason.substring(0, 4));
  const endYear = parseInt(currentSeason.substring(4, 8));
  return `${startYear + 1}${endYear + 1}`;
}

// Function to update skater stats for a season in the Supabase database
async function updateSkaterTotals(
  season: string
): Promise<{ updated: boolean; playersUpdated: number }> {
  console.log(`Starting to update skater totals for season ${season}`);
  const startTime = Date.now();

  // Delete any existing records for this season to ensure an overwrite
  const { error: deleteError } = await supabase
    .from("wgo_skater_stats_totals")
    .delete()
    .eq("season", season);
  if (deleteError) {
    console.error(`Error deleting records for season ${season}:`, deleteError);
    throw new Error(`Deletion error for season ${season}`);
  }
  console.log(`Existing records for season ${season} deleted successfully.`);

  // Fetch all totals for the season
  const {
    skaterTotalStats,
    skatersBio,
    miscTotalSkaterStats,
    faceOffTotalStats,
    faceoffWinLossTotalStats,
    goalsForAgainstTotalStats,
    penaltiesTotalStats,
    penaltyKillTotalStats,
    powerPlayTotalStats,
    puckPossessionTotalStats,
    satCountsTotalStats,
    satPercentagesTotalStats,
    scoringRatesTotalStats,
    scoringPerGameTotalStats,
    shotTypeTotalStats,
    timeOnIceTotalStats
  } = await fetchAllTotalsForSeason(season, 100);

  console.log(
    `Data fetched for ${skaterTotalStats.length} players, beginning processing`
  );

  // Create maps for fast lookups from other datasets
  const skatersBioMap = new Map<number, WGOSkatersBio>();
  skatersBio.forEach((stat) => skatersBioMap.set(stat.playerId, stat));
  const miscTotalSkaterStatsMap = new Map<number, WGORealtimeSkaterTotal>();
  miscTotalSkaterStats.forEach((stat) =>
    miscTotalSkaterStatsMap.set(stat.playerId, stat)
  );

  const faceOffTotalStatsMap = new Map<number, WGOFaceoffSkaterTotal>();
  faceOffTotalStats.forEach((stat) =>
    faceOffTotalStatsMap.set(stat.playerId, stat)
  );

  const faceoffWinLossTotalStatsMap = new Map<
    number,
    WGOFaceOffWinLossSkaterTotal
  >();
  faceoffWinLossTotalStats.forEach((stat) =>
    faceoffWinLossTotalStatsMap.set(stat.playerId, stat)
  );
  const goalsForAgainstTotalStatsMap = new Map<
    number,
    WGOGoalsForAgainstSkaterTotal
  >();
  goalsForAgainstTotalStats.forEach((stat) =>
    goalsForAgainstTotalStatsMap.set(stat.playerId, stat)
  );
  const penaltiesTotalStatsMap = new Map<number, WGOPenaltySkaterTotal>();
  penaltiesTotalStats.forEach((stat) =>
    penaltiesTotalStatsMap.set(stat.playerId, stat)
  );
  const penaltyKillTotalStatsMap = new Map<number, WGOPenaltyKillSkaterTotal>();
  penaltyKillTotalStats.forEach((stat) =>
    penaltyKillTotalStatsMap.set(stat.playerId, stat)
  );
  const powerPlayTotalStatsMap = new Map<number, WGOPowerPlaySkaterTotal>();
  powerPlayTotalStats.forEach((stat) =>
    powerPlayTotalStatsMap.set(stat.playerId, stat)
  );
  const puckPossessionTotalStatsMap = new Map<
    number,
    WGOPuckPossessionSkaterTotal
  >();
  puckPossessionTotalStats.forEach((stat) =>
    puckPossessionTotalStatsMap.set(stat.playerId, stat)
  );
  const satCountsTotalStatsMap = new Map<number, WGOSatCountSkaterTotal>();
  satCountsTotalStats.forEach((stat) =>
    satCountsTotalStatsMap.set(stat.playerId, stat)
  );
  const satPercentagesTotalStatsMap = new Map<
    number,
    WGOSatPercentageSkaterTotal
  >();
  satPercentagesTotalStats.forEach((stat) =>
    satPercentagesTotalStatsMap.set(stat.playerId, stat)
  );
  const scoringRatesTotalStatsMap = new Map<
    number,
    WGOScoringRatesSkaterTotal
  >();
  scoringRatesTotalStats.forEach((stat) =>
    scoringRatesTotalStatsMap.set(stat.playerId, stat)
  );
  const scoringPerGameTotalStatsMap = new Map<
    number,
    WGOScoringCountsSkaterTotal
  >();
  scoringPerGameTotalStats.forEach((stat) =>
    scoringPerGameTotalStatsMap.set(stat.playerId, stat)
  );
  const shotTypeTotalStatsMap = new Map<number, WGOShotTypeSkaterTotal>();
  shotTypeTotalStats.forEach((stat) =>
    shotTypeTotalStatsMap.set(stat.playerId, stat)
  );
  const timeOnIceTotalStatsMap = new Map<number, WGOToiSkaterTotal>();
  timeOnIceTotalStats.forEach((stat) =>
    timeOnIceTotalStatsMap.set(stat.playerId, stat)
  );

  // Collect upsert data into an array (each record gets an updated_at timestamp)
  const dataArray = [];
  const currentTimestamp = new Date().toISOString();

  for (const stat of skaterTotalStats) {
    const playerId = stat.playerId;
    const bioTotals = skatersBioMap.get(playerId);
    const miscTotals = miscTotalSkaterStatsMap.get(playerId);
    const faceOffTotals = faceOffTotalStatsMap.get(playerId);
    const faceoffWinLossTotals = faceoffWinLossTotalStatsMap.get(playerId);
    const goalsForAgainstTotals = goalsForAgainstTotalStatsMap.get(playerId);
    const penaltiesTotals = penaltiesTotalStatsMap.get(playerId);
    const penaltyKillTotals = penaltyKillTotalStatsMap.get(playerId);
    const powerPlayTotals = powerPlayTotalStatsMap.get(playerId);
    const puckPossessionTotals = puckPossessionTotalStatsMap.get(playerId);
    const satCountsTotals = satCountsTotalStatsMap.get(playerId);
    const satPercentagesTotals = satPercentagesTotalStatsMap.get(playerId);
    const scoringRatesTotals = scoringRatesTotalStatsMap.get(playerId);
    const scoringPerGameTotals = scoringPerGameTotalStatsMap.get(playerId);
    const shotTypeTotals = shotTypeTotalStatsMap.get(playerId);
    const timeOnIceTotals = timeOnIceTotalStatsMap.get(playerId);

    const skatersData = {
      player_id: stat.playerId,
      player_name: stat.skaterFullName,
      season: season,
      shoots_catches: stat.shootsCatches,
      position_code: stat.positionCode,
      games_played: stat.gamesPlayed,
      points: stat.points,
      points_per_game: stat.pointsPerGame,
      goals: stat.goals,
      assists: stat.assists,
      shots: stat.shots,
      shooting_percentage: stat.shootingPct,
      plus_minus: stat.plusMinus,
      ot_goals: stat.otGoals,
      gw_goals: stat.gameWinningGoals,
      pp_points: stat.ppPoints,
      fow_percentage: stat.faceoffWinPct,
      toi_per_game: stat.timeOnIcePerGame,
      // Bio stats
      birth_date: bioTotals?.birthDate,
      current_team_abbreviation: bioTotals?.currentTeamAbbrev,
      current_team_name: bioTotals?.currentTeamName,
      birth_city: bioTotals?.birthCity,
      birth_country: bioTotals?.birthCountryCode,
      height: bioTotals?.height,
      weight: bioTotals?.weight,
      draft_year: bioTotals?.draftYear,
      draft_round: bioTotals?.draftRound,
      draft_overall: bioTotals?.draftOverall,
      first_season_for_game_type: bioTotals?.firstSeasonForGameType,
      nationality_code: bioTotals?.nationalityCode,
      // Realtime stats
      blocked_shots: miscTotals?.blockedShots,
      blocks_per_60: miscTotals?.blockedShotsPer60,
      empty_net_goals: miscTotals?.emptyNetGoals,
      empty_net_points: miscTotals?.emptyNetPoints,
      giveaways: miscTotals?.giveaways,
      giveaways_per_60: miscTotals?.giveawaysPer60,
      hits: miscTotals?.hits,
      hits_per_60: miscTotals?.hitsPer60,
      missed_shots: miscTotals?.missedShots,
      takeaways: miscTotals?.takeaways,
      takeaways_per_60: miscTotals?.takeawaysPer60,
      // Faceoff stats
      d_zone_fo_percentage: faceOffTotals?.defensiveZoneFaceoffPct, // float
      d_zone_faceoffs: faceOffTotals?.defensiveZoneFaceoffs, // int
      ev_faceoff_percentage: faceOffTotals?.evFaceoffPct, // float
      ev_faceoffs: faceOffTotals?.evFaceoffs, // int
      n_zone_fo_percentage: faceOffTotals?.neutralZoneFaceoffPct, // float
      n_zone_faceoffs: faceOffTotals?.neutralZoneFaceoffs, // int
      o_zone_fo_percentage: faceOffTotals?.offensiveZoneFaceoffPct, // float
      o_zone_faceoffs: faceOffTotals?.offensiveZoneFaceoffs, // int
      pp_faceoff_percentage: faceOffTotals?.ppFaceoffPct, // float
      pp_faceoffs: faceOffTotals?.ppFaceoffs, // int
      sh_faceoff_percentage: faceOffTotals?.shFaceoffPct, // float
      sh_faceoffs: faceOffTotals?.shFaceoffs, // int
      total_faceoffs: faceOffTotals?.totalFaceoffs, // int
      // Faceoff win/loss stats
      d_zone_fol: faceoffWinLossTotals?.defensiveZoneFaceoffLosses,
      d_zone_fow: faceoffWinLossTotals?.defensiveZoneFaceoffWins,
      ev_fol: faceoffWinLossTotals?.evFaceoffsLost,
      ev_fow: faceoffWinLossTotals?.evFaceoffsWon,
      n_zone_fol: faceoffWinLossTotals?.neutralZoneFaceoffLosses,
      n_zone_fow: faceoffWinLossTotals?.neutralZoneFaceoffWins,
      o_zone_fol: faceoffWinLossTotals?.offensiveZoneFaceoffLosses,
      o_zone_fow: faceoffWinLossTotals?.offensiveZoneFaceoffWins,
      pp_fol: faceoffWinLossTotals?.ppFaceoffsLost,
      pp_fow: faceoffWinLossTotals?.ppFaceoffsWon,
      sh_fol: faceoffWinLossTotals?.shFaceoffsLost,
      sh_fow: faceoffWinLossTotals?.shFaceoffsWon,
      total_fol: faceoffWinLossTotals?.totalFaceoffLosses,
      total_fow: faceoffWinLossTotals?.totalFaceoffWins,
      // Goals for/against stats
      es_goals_against: goalsForAgainstTotals?.evenStrengthGoalsAgainst,
      es_goals_for: goalsForAgainstTotals?.evenStrengthGoalsFor,
      es_goals_for_percentage: goalsForAgainstTotals?.evenStrengthGoalsForPct,
      es_toi_per_game: goalsForAgainstTotals?.evenStrengthTimeOnIcePerGame,
      pp_goals_against: goalsForAgainstTotals?.powerPlayGoalsAgainst,
      pp_goals_for: goalsForAgainstTotals?.powerPlayGoalFor,
      pp_toi_per_game: goalsForAgainstTotals?.powerPlayTimeOnIcePerGame,
      sh_goals_against: goalsForAgainstTotals?.shortHandedGoalsAgainst,
      sh_goals_for: goalsForAgainstTotals?.shortHandedGoalsFor,
      sh_toi_per_game: goalsForAgainstTotals?.shortHandedTimeOnIcePerGame,
      // Penalties stats
      game_misconduct_penalties: penaltiesTotals?.gameMisconductPenalties,
      major_penalties: penaltiesTotals?.majorPenalties,
      match_penalties: penaltiesTotals?.matchPenalties,
      minor_penalties: penaltiesTotals?.minorPenalties,
      misconduct_penalties: penaltiesTotals?.misconductPenalties,
      penalties: penaltiesTotals?.penalties,
      penalties_drawn: penaltiesTotals?.penaltiesDrawn,
      penalties_drawn_per_60: penaltiesTotals?.penaltiesDrawnPer60,
      penalties_taken_per_60: penaltiesTotals?.penaltiesTakenPer60,
      penalty_minutes: penaltiesTotals?.penaltyMinutes,
      penalty_seconds_per_game: penaltiesTotals?.penaltySecondsPerGame,
      // Penalty kill stats
      pp_goals_against_per_60: penaltyKillTotals?.ppGoalsAgainstPer60,
      sh_assists: penaltyKillTotals?.shAssists,
      sh_goals: penaltyKillTotals?.shGoals,
      sh_points: penaltyKillTotals?.shPoints,
      sh_goals_per_60: penaltyKillTotals?.shGoalsPer60,
      sh_individual_sat_for: penaltyKillTotals?.shIndividualSatFor,
      sh_individual_sat_per_60: penaltyKillTotals?.shIndividualSatForPer60,
      sh_points_per_60: penaltyKillTotals?.shPointsPer60,
      sh_primary_assists: penaltyKillTotals?.shPrimaryAssists,
      sh_primary_assists_per_60: penaltyKillTotals?.shPrimaryAssistsPer60,
      sh_secondary_assists: penaltyKillTotals?.shSecondaryAssists,
      sh_secondary_assists_per_60: penaltyKillTotals?.shSecondaryAssistsPer60,
      sh_shooting_percentage: penaltyKillTotals?.shShootingPct,
      sh_shots: penaltyKillTotals?.shShots,
      sh_shots_per_60: penaltyKillTotals?.shShotsPer60,
      sh_time_on_ice: penaltyKillTotals?.shTimeOnIce,
      sh_time_on_ice_pct_per_game: penaltyKillTotals?.shTimeOnIcePctPerGame,
      // Power play stats
      pp_assists: powerPlayTotals?.ppAssists,
      pp_goals: powerPlayTotals?.ppGoals,
      pp_goals_for_per_60: powerPlayTotals?.ppGoalsForPer60,
      pp_goals_per_60: powerPlayTotals?.ppGoalsPer60,
      pp_individual_sat_for: powerPlayTotals?.ppIndividualSatFor,
      pp_individual_sat_per_60: powerPlayTotals?.ppIndividualSatForPer60,
      pp_points_per_60: powerPlayTotals?.ppPointsPer60,
      pp_primary_assists: powerPlayTotals?.ppPrimaryAssists,
      pp_primary_assists_per_60: powerPlayTotals?.ppPrimaryAssistsPer60,
      pp_secondary_assists: powerPlayTotals?.ppSecondaryAssists,
      pp_secondary_assists_per_60: powerPlayTotals?.ppSecondaryAssistsPer60,
      pp_shooting_percentage: powerPlayTotals?.ppShootingPct,
      pp_shots: powerPlayTotals?.ppShots,
      pp_shots_per_60: powerPlayTotals?.ppShotsPer60,
      pp_toi: powerPlayTotals?.ppTimeOnIce,
      pp_toi_pct_per_game: powerPlayTotals?.ppTimeOnIcePctPerGame,
      // Puck possession stats
      goals_pct: puckPossessionTotals?.goalsPct,
      faceoff_pct_5v5: puckPossessionTotals?.faceoffPct5v5,
      individual_sat_for_per_60: puckPossessionTotals?.individualSatForPer60,
      individual_shots_for_per_60:
        puckPossessionTotals?.individualShotsForPer60,
      on_ice_shooting_pct: puckPossessionTotals?.onIceShootingPct,
      sat_pct: puckPossessionTotals?.satPct,
      toi_per_game_5v5: puckPossessionTotals?.timeOnIcePerGame5v5,
      usat_pct: puckPossessionTotals?.usatPct,
      zone_start_pct: puckPossessionTotals?.zoneStartPct,
      // Shooting stats (sat counts)
      sat_against: satCountsTotals?.satAgainst,
      sat_ahead: satCountsTotals?.satAhead,
      sat_behind: satCountsTotals?.satBehind,
      sat_close: satCountsTotals?.satClose,
      sat_for: satCountsTotals?.satFor,
      sat_tied: satCountsTotals?.satTied,
      sat_total: satCountsTotals?.satTotal,
      usat_against: satCountsTotals?.usatAgainst,
      usat_ahead: satCountsTotals?.usatAhead,
      usat_behind: satCountsTotals?.usatBehind,
      usat_close: satCountsTotals?.usatClose,
      usat_for: satCountsTotals?.usatFor,
      usat_tied: satCountsTotals?.usatTied,
      usat_total: satCountsTotals?.usatTotal,
      // Shooting percentages
      sat_percentage: satPercentagesTotals?.satPercentage,
      sat_percentage_ahead: satPercentagesTotals?.satPercentageAhead,
      sat_percentage_behind: satPercentagesTotals?.satPercentageBehind,
      sat_percentage_close: satPercentagesTotals?.satPercentageClose,
      sat_percentage_tied: satPercentagesTotals?.satPercentageTied,
      sat_relative: satPercentagesTotals?.satRelative,
      shooting_percentage_5v5: satPercentagesTotals?.shootingPct5v5,
      skater_save_pct_5v5: satPercentagesTotals?.skaterSavePct5v5,
      skater_shooting_plus_save_pct_5v5:
        satPercentagesTotals?.skaterShootingPlusSavePct5v5,
      usat_percentage: satPercentagesTotals?.usatPercentage,
      usat_percentage_ahead: satPercentagesTotals?.usatPercentageAhead,
      usat_percentage_behind: satPercentagesTotals?.usatPercentageBehind,
      usat_percentage_close: satPercentagesTotals?.usatPrecentageClose,
      usat_percentage_tied: satPercentagesTotals?.usatPercentageTied,
      usat_relative: satPercentagesTotals?.usatRelative,
      zone_start_pct_5v5: satPercentagesTotals?.zoneStartPct5v5,
      // Scoring rates
      assists_5v5: scoringRatesTotals?.assists5v5,
      assists_per_60_5v5: scoringRatesTotals?.assistsPer605v5,
      goals_5v5: scoringRatesTotals?.goals5v5,
      goals_per_60_5v5: scoringRatesTotals?.goalsPer605v5,
      o_zone_start_pct_5v5: scoringRatesTotals?.offensiveZoneStartPct5v5,
      on_ice_shooting_pct_5v5: scoringRatesTotals?.onIceShootingPct5v5,
      points_5v5: scoringRatesTotals?.points5v5,
      points_per_60_5v5: scoringRatesTotals?.pointsPer605v5,
      primary_assists_5v5: scoringRatesTotals?.primaryAssists5v5,
      primary_assists_per_60_5v5: scoringRatesTotals?.primaryAssistsPer605v5,
      sat_relative_5v5: scoringRatesTotals?.satRelative5v5,
      secondary_assists_5v5: scoringRatesTotals?.secondaryAssists5v5,
      secondary_assists_per_60_5v5:
        scoringRatesTotals?.secondaryAssistsPer605v5,
      // Scoring per game
      total_primary_assists: scoringPerGameTotals?.totalPrimaryAssists,
      total_secondary_assists: scoringPerGameTotals?.totalSecondaryAssists,
      // Shot type stats
      goals_backhand: shotTypeTotals?.goalsBackhand,
      goals_bat: shotTypeTotals?.goalsBat,
      goals_between_legs: shotTypeTotals?.goalsBetweenLegs,
      goals_cradle: shotTypeTotals?.goalsCradle,
      goals_deflected: shotTypeTotals?.goalsDeflected,
      goals_poke: shotTypeTotals?.goalsPoke,
      goals_slap: shotTypeTotals?.goalsSlap,
      goals_snap: shotTypeTotals?.goalsSnap,
      goals_tip_in: shotTypeTotals?.goalsTipIn,
      goals_wrap_around: shotTypeTotals?.goalsWrapAround,
      goals_wrist: shotTypeTotals?.goalsWrist,
      shots_on_net_backhand: shotTypeTotals?.shotsOnNetBackhand,
      shots_on_net_bat: shotTypeTotals?.shotsOnNetBat,
      shots_on_net_between_legs: shotTypeTotals?.shotsOnNetBetweenLegs,
      shots_on_net_cradle: shotTypeTotals?.shotsOnNetCradle,
      shots_on_net_deflected: shotTypeTotals?.shotsOnNetDeflected,
      shots_on_net_poke: shotTypeTotals?.shotsOnNetPoke,
      shots_on_net_slap: shotTypeTotals?.shotsOnNetSlap,
      shots_on_net_snap: shotTypeTotals?.shotsOnNetSnap,
      shots_on_net_tip_in: shotTypeTotals?.shotsOnNetTipIn,
      shots_on_net_wrap_around: shotTypeTotals?.shotsOnNetWrapAround,
      shots_on_net_wrist: shotTypeTotals?.shotsOnNetWrist,
      // Time on ice stats
      ev_time_on_ice: timeOnIceTotals?.evTimeOnIce,
      ev_time_on_ice_per_game: timeOnIceTotals?.evTimeOnIcePerGame,
      ot_time_on_ice: timeOnIceTotals?.otTimeOnIce,
      ot_time_on_ice_per_game: timeOnIceTotals?.otTimeOnIcePerOtGame,
      shifts: timeOnIceTotals?.shifts,
      shifts_per_game: timeOnIceTotals?.shiftsPerGame,
      time_on_ice_per_shift: timeOnIceTotals?.timeOnIcePerShift,
      // Include the updated_at timestamp
      updated_at: currentTimestamp
    };

    dataArray.push(skatersData);
  }

  // Insert the new data into Supabase
  const { error: insertError } = await supabase
    .from("wgo_skater_stats_totals")
    .insert(dataArray);
  if (insertError) {
    console.error(
      `Error inserting updated records for season ${season}:`,
      insertError
    );
    throw new Error(`Insertion error for season ${season}`);
  }

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  console.log(
    `Season ${season} updated for ${
      dataArray.length
    } players in ${duration.toFixed(2)} seconds.`
  );
  return { updated: true, playersUpdated: dataArray.length };
}

// ==============================
// API handler
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const startTime = Date.now();
    const seasonParam = req.query.season;
    if (seasonParam) {
      const seasonValue = Array.isArray(seasonParam)
        ? seasonParam[0]
        : seasonParam;
      if (seasonValue.toLowerCase() === "all") {
        console.log("Processing all seasons (overwrite mode)...");
        const { seasonsProcessed, totalTimeInSeconds } = await processSeasons();
        return res.json({
          message: `Skater stats updated successfully for ${
            seasonsProcessed.length
          } season(s): ${seasonsProcessed.join(", ")}`,
          success: true,
          executionTime: `${totalTimeInSeconds.toFixed(2)} seconds`,
          seasonsProcessed
        });
      } else {
        console.log(`Processing single season: ${seasonValue}`);
        const result = await updateSkaterTotals(seasonValue);
        return res.json({
          message: `Skater stats updated successfully for season ${seasonValue}.`,
          success: true,
          executionTime: `${((Date.now() - startTime) / 1000).toFixed(
            2
          )} seconds`,
          data: result
        });
      }
    } else {
      console.log("No season specified, processing all seasons...");
      const { seasonsProcessed, totalTimeInSeconds } = await processSeasons();
      return res.json({
        message: `Skater stats updated successfully for ${
          seasonsProcessed.length
        } season(s): ${seasonsProcessed.join(", ")}`,
        success: true,
        executionTime: `${totalTimeInSeconds.toFixed(2)} seconds`,
        seasonsProcessed
      });
    }
  } catch (e: any) {
    console.error("Error in handler:", e.message);
    res.status(400).json({
      message: `Failed to process request. Reason: ${e.message}`,
      success: false
    });
  }
}
