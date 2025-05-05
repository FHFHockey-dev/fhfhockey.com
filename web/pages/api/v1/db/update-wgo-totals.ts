import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import Fetch from "lib/cors-fetch";
import { getCurrentSeason } from "lib/NHL/server";
import pLimit from "p-limit";
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

// --------------------------
// Helper: Concurrently fetch all pages for one endpoint.
// The urlBuilder function receives a start value and returns the URL.
async function fetchAllDataForEndpoint<T>(
  urlBuilder: (start: number) => string,
  concurrency: number = 4
): Promise<T[]> {
  const limit = 100;
  let page = 0;
  let allData: T[] = [];

  // We'll use a concurrency limiter for the "count" phase.
  const limiter = pLimit(concurrency);
  let done = false;
  while (!done) {
    // Fire off a batch of requests concurrently.
    const batchPromises = [];
    for (let i = 0; i < concurrency; i++) {
      batchPromises.push(
        limiter(
          () =>
            Fetch(urlBuilder((page + i) * limit)).then((res) =>
              res.json()
            ) as Promise<{ data: T[] }>
        )
      );
    }
    const batchResults = await Promise.all(batchPromises);
    for (const result of batchResults) {
      allData.push(...result.data);
      // If this page returned fewer than limit items, we have reached the end.
      if (result.data.length < limit) {
        done = true;
        break;
      }
    }
    page += concurrency;
  }
  return allData;
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

// --------------------------
// Full fetchAllTotalsForSeason() function with concurrent endpoint fetching.
async function fetchAllTotalsForSeason(season: string): Promise<{
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

  // Define URL builders for each endpoint.
  const buildSkaterTotalStatsUrl = (start: number) =>
    `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goals%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22assists%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;

  const buildSkatersBioUrl = (start: number) =>
    `https://api.nhle.com/stats/rest/en/skater/bios?isAggregate=false&isGame=false&sort=%5B%7B%22property%22:%22lastName%22,%22direction%22:%22ASC_CI%22%7D,%7B%22property%22:%22skaterFullName%22,%22direction%22:%22ASC_CI%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;

  const buildMiscSkaterTotalsUrl = (start: number) =>
    `https://api.nhle.com/stats/rest/en/skater/realtime?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22hits%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;

  const buildFaceOffTotalsUrl = (start: number) =>
    `https://api.nhle.com/stats/rest/en/skater/faceoffpercentages?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22totalFaceoffs%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;

  const buildFaceoffWinLossTotalsUrl = (start: number) =>
    `https://api.nhle.com/stats/rest/en/skater/faceoffwins?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22totalFaceoffWins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22faceoffWinPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;

  const buildGoalsForAgainstTotalsUrl = (start: number) =>
    `https://api.nhle.com/stats/rest/en/skater/goalsForAgainst?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22evenStrengthGoalDifference%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;

  const buildPenaltiesTotalsUrl = (start: number) =>
    `https://api.nhle.com/stats/rest/en/skater/penalties?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22penaltyMinutes%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;

  const buildPenaltyKillTotalsUrl = (start: number) =>
    `https://api.nhle.com/stats/rest/en/skater/penaltykill?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22shTimeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;

  const buildPowerPlayTotalsUrl = (start: number) =>
    `https://api.nhle.com/stats/rest/en/skater/powerplay?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22ppTimeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;

  const buildPuckPossessionTotalsUrl = (start: number) =>
    `https://api.nhle.com/stats/rest/en/skater/puckPossessions?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22satPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;

  const buildSatCountsTotalsUrl = (start: number) =>
    `https://api.nhle.com/stats/rest/en/skater/summaryshooting?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22satTotal%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22usatTotal%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;

  const buildSatPercentagesTotalsUrl = (start: number) =>
    `https://api.nhle.com/stats/rest/en/skater/percentages?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22satPercentage%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;

  const buildScoringRatesTotalsUrl = (start: number) =>
    `https://api.nhle.com/stats/rest/en/skater/scoringRates?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22pointsPer605v5%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsPer605v5%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;

  const buildScoringPerGameTotalsUrl = (start: number) =>
    `https://api.nhle.com/stats/rest/en/skater/scoringpergame?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22pointsPerGame%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsPerGame%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;

  const buildShotTypeTotalsUrl = (start: number) =>
    `https://api.nhle.com/stats/rest/en/skater/shottype?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22shootingPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22shootingPctBat%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;

  const buildTimeOnIceTotalsUrl = (start: number) =>
    `https://api.nhle.com/stats/rest/en/skater/timeonice?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22timeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;

  // Fire off concurrent requests for each endpoint.
  const [
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
  ] = await Promise.all([
    fetchAllDataForEndpoint<WGOSummarySkaterTotal>(buildSkaterTotalStatsUrl),
    fetchAllDataForEndpoint<WGOSkatersBio>(buildSkatersBioUrl),
    fetchAllDataForEndpoint<WGORealtimeSkaterTotal>(buildMiscSkaterTotalsUrl),
    fetchAllDataForEndpoint<WGOFaceoffSkaterTotal>(buildFaceOffTotalsUrl),
    fetchAllDataForEndpoint<WGOFaceOffWinLossSkaterTotal>(
      buildFaceoffWinLossTotalsUrl
    ),
    fetchAllDataForEndpoint<WGOGoalsForAgainstSkaterTotal>(
      buildGoalsForAgainstTotalsUrl
    ),
    fetchAllDataForEndpoint<WGOPenaltySkaterTotal>(buildPenaltiesTotalsUrl),
    fetchAllDataForEndpoint<WGOPenaltyKillSkaterTotal>(
      buildPenaltyKillTotalsUrl
    ),
    fetchAllDataForEndpoint<WGOPowerPlaySkaterTotal>(buildPowerPlayTotalsUrl),
    fetchAllDataForEndpoint<WGOPuckPossessionSkaterTotal>(
      buildPuckPossessionTotalsUrl
    ),
    fetchAllDataForEndpoint<WGOSatCountSkaterTotal>(buildSatCountsTotalsUrl),
    fetchAllDataForEndpoint<WGOSatPercentageSkaterTotal>(
      buildSatPercentagesTotalsUrl
    ),
    fetchAllDataForEndpoint<WGOScoringRatesSkaterTotal>(
      buildScoringRatesTotalsUrl
    ),
    fetchAllDataForEndpoint<WGOScoringCountsSkaterTotal>(
      buildScoringPerGameTotalsUrl
    ),
    fetchAllDataForEndpoint<WGOShotTypeSkaterTotal>(buildShotTypeTotalsUrl),
    fetchAllDataForEndpoint<WGOToiSkaterTotal>(buildTimeOnIceTotalsUrl)
  ]);

  return {
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
  };
}

// --------------------------
// Batch upsert helper: split records into smaller chunks and upsert concurrently.
async function batchUpsert(
  dataArray: any[],
  batchSize: number = 500,
  concurrency: number = 4
) {
  const chunks = [];
  for (let i = 0; i < dataArray.length; i += batchSize) {
    chunks.push(dataArray.slice(i, i + batchSize));
  }
  const limit = pLimit(concurrency);
  await Promise.all(
    chunks.map((chunk) =>
      limit(() =>
        supabase
          .from("wgo_skater_stats_totals")
          .upsert(chunk, { onConflict: "player_id,season" })
      )
    )
  );
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

// --------------------------
// updateSkaterTotals: process fetched data, then perform a batch upsert.
async function updateSkaterTotals(
  season: string
): Promise<{ updated: boolean; playersUpdated: number; totalErrors: number }> {
  console.log(`Starting to update skater totals for season ${season}`);
  const startTime = Date.now();
  let playersUpdated = 0;
  let totalErrors = 0;

  try {
    // Fetch all totals for the season using our concurrent method.
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
    } = await fetchAllTotalsForSeason(season);

    console.log(
      `Data fetched for ${skaterTotalStats.length} players, beginning processing`
    );

    // Create lookup maps
    const skatersBioMap = new Map<number, WGOSkatersBio>();
    skatersBio.forEach((s) => skatersBioMap.set(s.playerId, s));

    const miscMap = new Map<number, WGORealtimeSkaterTotal>();
    miscTotalSkaterStats.forEach((s) => miscMap.set(s.playerId, s));

    const faceoffMap = new Map<number, WGOFaceoffSkaterTotal>();
    faceOffTotalStats.forEach((s) => faceoffMap.set(s.playerId, s));

    const faceoffWLMap = new Map<number, WGOFaceOffWinLossSkaterTotal>();
    faceoffWinLossTotalStats.forEach((s) => faceoffWLMap.set(s.playerId, s));

    const goalsMap = new Map<number, WGOGoalsForAgainstSkaterTotal>();
    goalsForAgainstTotalStats.forEach((s) => goalsMap.set(s.playerId, s));

    const penMap = new Map<number, WGOPenaltySkaterTotal>();
    penaltiesTotalStats.forEach((s) => penMap.set(s.playerId, s));

    const pkMap = new Map<number, WGOPenaltyKillSkaterTotal>();
    penaltyKillTotalStats.forEach((s) => pkMap.set(s.playerId, s));

    const ppMap = new Map<number, WGOPowerPlaySkaterTotal>();
    powerPlayTotalStats.forEach((s) => ppMap.set(s.playerId, s));

    const puckMap = new Map<number, WGOPuckPossessionSkaterTotal>();
    puckPossessionTotalStats.forEach((s) => puckMap.set(s.playerId, s));

    const satCountMap = new Map<number, WGOSatCountSkaterTotal>();
    satCountsTotalStats.forEach((s) => satCountMap.set(s.playerId, s));

    const satPctMap = new Map<number, WGOSatPercentageSkaterTotal>();
    satPercentagesTotalStats.forEach((s) => satPctMap.set(s.playerId, s));

    const rateMap = new Map<number, WGOScoringRatesSkaterTotal>();
    scoringRatesTotalStats.forEach((s) => rateMap.set(s.playerId, s));

    const countMap = new Map<number, WGOScoringCountsSkaterTotal>();
    scoringPerGameTotalStats.forEach((s) => countMap.set(s.playerId, s));

    const shotMap = new Map<number, WGOShotTypeSkaterTotal>();
    shotTypeTotalStats.forEach((s) => shotMap.set(s.playerId, s));

    const toiMap = new Map<number, WGOToiSkaterTotal>();
    timeOnIceTotalStats.forEach((s) => toiMap.set(s.playerId, s));

    // Prepare data array
    const dataArray: any[] = [];
    const now = new Date().toISOString();

    for (const stat of skaterTotalStats) {
      const bio = skatersBioMap.get(stat.playerId);
      const misc = miscMap.get(stat.playerId);
      const fo = faceoffMap.get(stat.playerId);
      const foWL = faceoffWLMap.get(stat.playerId);
      const gfga = goalsMap.get(stat.playerId);
      const pen = penMap.get(stat.playerId);
      const pk = pkMap.get(stat.playerId);
      const pp = ppMap.get(stat.playerId);
      const puck = puckMap.get(stat.playerId);
      const satCt = satCountMap.get(stat.playerId);
      const satPct = satPctMap.get(stat.playerId);
      const rates = rateMap.get(stat.playerId);
      const counts = countMap.get(stat.playerId);
      const shots = shotMap.get(stat.playerId);
      const toiStats = toiMap.get(stat.playerId);

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
        birth_date: bio?.birthDate,
        current_team_abbreviation: bio?.currentTeamAbbrev,
        current_team_name: bio?.currentTeamName,
        birth_city: bio?.birthCity,
        birth_country: bio?.birthCountryCode,
        height: bio?.height,
        weight: bio?.weight,
        draft_year: bio?.draftYear,
        draft_round: bio?.draftRound,
        draft_overall: bio?.draftOverall,
        first_season_for_game_type: bio?.firstSeasonForGameType,
        nationality_code: bio?.nationalityCode,
        // Realtime stats
        blocked_shots: misc?.blockedShots,
        blocks_per_60: misc?.blockedShotsPer60,
        empty_net_goals: misc?.emptyNetGoals,
        empty_net_points: misc?.emptyNetPoints,
        giveaways: misc?.giveaways,
        giveaways_per_60: misc?.giveawaysPer60,
        hits: misc?.hits,
        hits_per_60: misc?.hitsPer60,
        missed_shots: misc?.missedShots,
        takeaways: misc?.takeaways,
        takeaways_per_60: misc?.takeawaysPer60,
        // Faceoff stats
        d_zone_fo_percentage: fo?.defensiveZoneFaceoffPct, // float
        d_zone_faceoffs: fo?.defensiveZoneFaceoffs, // int
        ev_faceoff_percentage: fo?.evFaceoffPct, // float
        ev_faceoffs: fo?.evFaceoffs, // int
        n_zone_fo_percentage: fo?.neutralZoneFaceoffPct, // float
        n_zone_faceoffs: fo?.neutralZoneFaceoffs, // int
        o_zone_fo_percentage: fo?.offensiveZoneFaceoffPct, // float
        o_zone_faceoffs: fo?.offensiveZoneFaceoffs, // int
        pp_faceoff_percentage: fo?.ppFaceoffPct, // float
        pp_faceoffs: fo?.ppFaceoffs, // int
        sh_faceoff_percentage: fo?.shFaceoffPct, // float
        sh_faceoffs: fo?.shFaceoffs, // int
        total_faceoffs: fo?.totalFaceoffs, // int
        // Faceoff win/loss stats
        d_zone_fol: foWL?.defensiveZoneFaceoffLosses,
        d_zone_fow: foWL?.defensiveZoneFaceoffWins,
        ev_fol: foWL?.evFaceoffsLost,
        ev_fow: foWL?.evFaceoffsWon,
        n_zone_fol: foWL?.neutralZoneFaceoffLosses,
        n_zone_fow: foWL?.neutralZoneFaceoffWins,
        o_zone_fol: foWL?.offensiveZoneFaceoffLosses,
        o_zone_fow: foWL?.offensiveZoneFaceoffWins,
        pp_fol: foWL?.ppFaceoffsLost,
        pp_fow: foWL?.ppFaceoffsWon,
        sh_fol: foWL?.shFaceoffsLost,
        sh_fow: foWL?.shFaceoffsWon,
        total_fol: foWL?.totalFaceoffLosses,
        total_fow: foWL?.totalFaceoffWins,
        // Goals for/against stats
        es_goals_against: gfga?.evenStrengthGoalsAgainst,
        es_goals_for: gfga?.evenStrengthGoalsFor,
        es_goals_for_percentage: gfga?.evenStrengthGoalsForPct,
        es_toi_per_game: gfga?.evenStrengthTimeOnIcePerGame,
        pp_goals_against: gfga?.powerPlayGoalsAgainst,
        pp_goals_for: gfga?.powerPlayGoalFor,
        pp_toi_per_game: gfga?.powerPlayTimeOnIcePerGame,
        sh_goals_against: gfga?.shortHandedGoalsAgainst,
        sh_goals_for: gfga?.shortHandedGoalsFor,
        sh_toi_per_game: gfga?.shortHandedTimeOnIcePerGame,
        // Penalties stats
        game_misconduct_penalties: pen?.gameMisconductPenalties,
        major_penalties: pen?.majorPenalties,
        match_penalties: pen?.matchPenalties,
        minor_penalties: pen?.minorPenalties,
        misconduct_penalties: pen?.misconductPenalties,
        penalties: pen?.penalties,
        penalties_drawn: pen?.penaltiesDrawn,
        penalties_drawn_per_60: pen?.penaltiesDrawnPer60,
        penalties_taken_per_60: pen?.penaltiesTakenPer60,
        penalty_minutes: pen?.penaltyMinutes,
        penalty_seconds_per_game: pen?.penaltySecondsPerGame,
        // Penalty kill stats
        pp_goals_against_per_60: pk?.ppGoalsAgainstPer60,
        sh_assists: pk?.shAssists,
        sh_goals: pk?.shGoals,
        sh_points: pk?.shPoints,
        sh_goals_per_60: pk?.shGoalsPer60,
        sh_individual_sat_for: pk?.shIndividualSatFor,
        sh_individual_sat_per_60: pk?.shIndividualSatForPer60,
        sh_points_per_60: pk?.shPointsPer60,
        sh_primary_assists: pk?.shPrimaryAssists,
        sh_primary_assists_per_60: pk?.shPrimaryAssistsPer60,
        sh_secondary_assists: pk?.shSecondaryAssists,
        sh_secondary_assists_per_60: pk?.shSecondaryAssistsPer60,
        sh_shooting_percentage: pk?.shShootingPct,
        sh_shots: pk?.shShots,
        sh_shots_per_60: pk?.shShotsPer60,
        sh_time_on_ice: pk?.shTimeOnIce,
        sh_time_on_ice_pct_per_game: pk?.shTimeOnIcePctPerGame,
        // Power play stats
        pp_assists: pp?.ppAssists,
        pp_goals: pp?.ppGoals,
        pp_goals_for_per_60: pp?.ppGoalsForPer60,
        pp_goals_per_60: pp?.ppGoalsPer60,
        pp_individual_sat_for: pp?.ppIndividualSatFor,
        pp_individual_sat_per_60: pp?.ppIndividualSatForPer60,
        pp_points_per_60: pp?.ppPointsPer60,
        pp_primary_assists: pp?.ppPrimaryAssists,
        pp_primary_assists_per_60: pp?.ppPrimaryAssistsPer60,
        pp_secondary_assists: pp?.ppSecondaryAssists,
        pp_secondary_assists_per_60: pp?.ppSecondaryAssistsPer60,
        pp_shooting_percentage: pp?.ppShootingPct,
        pp_shots: pp?.ppShots,
        pp_shots_per_60: pp?.ppShotsPer60,
        pp_toi: pp?.ppTimeOnIce,
        pp_toi_pct_per_game: pp?.ppTimeOnIcePctPerGame,
        // Puck possession stats
        goals_pct: puck?.goalsPct,
        faceoff_pct_5v5: puck?.faceoffPct5v5,
        individual_sat_for_per_60: puck?.individualSatForPer60,
        individual_shots_for_per_60: puck?.individualShotsForPer60,
        on_ice_shooting_pct: puck?.onIceShootingPct,
        sat_pct: puck?.satPct,
        toi_per_game_5v5: puck?.timeOnIcePerGame5v5,
        usat_pct: puck?.usatPct,
        zone_start_pct: puck?.zoneStartPct,
        // Shooting stats (sat counts)
        sat_against: satCt?.satAgainst,
        sat_ahead: satCt?.satAhead,
        sat_behind: satCt?.satBehind,
        sat_close: satCt?.satClose,
        sat_for: satCt?.satFor,
        sat_tied: satCt?.satTied,
        sat_total: satCt?.satTotal,
        usat_against: satCt?.usatAgainst,
        usat_ahead: satCt?.usatAhead,
        usat_behind: satCt?.usatBehind,
        usat_close: satCt?.usatClose,
        usat_for: satCt?.usatFor,
        usat_tied: satCt?.usatTied,
        usat_total: satCt?.usatTotal,
        // Shooting percentages
        sat_percentage: satPct?.satPercentage,
        sat_percentage_ahead: satPct?.satPercentageAhead,
        sat_percentage_behind: satPct?.satPercentageBehind,
        sat_percentage_close: satPct?.satPercentageClose,
        sat_percentage_tied: satPct?.satPercentageTied,
        sat_relative: satPct?.satRelative,
        shooting_percentage_5v5: satPct?.shootingPct5v5,
        skater_save_pct_5v5: satPct?.skaterSavePct5v5,
        skater_shooting_plus_save_pct_5v5: satPct?.skaterShootingPlusSavePct5v5,
        usat_percentage: satPct?.usatPercentage,
        usat_percentage_ahead: satPct?.usatPercentageAhead,
        usat_percentage_behind: satPct?.usatPercentageBehind,
        usat_percentage_close: satPct?.usatPrecentageClose,
        usat_percentage_tied: satPct?.usatPercentageTied,
        usat_relative: satPct?.usatRelative,
        zone_start_pct_5v5: satPct?.zoneStartPct5v5,
        // Scoring rates
        assists_5v5: rates?.assists5v5,
        assists_per_60_5v5: rates?.assistsPer605v5,
        goals_5v5: rates?.goals5v5,
        goals_per_60_5v5: rates?.goalsPer605v5,
        o_zone_start_pct_5v5: rates?.offensiveZoneStartPct5v5,
        on_ice_shooting_pct_5v5: rates?.onIceShootingPct5v5,
        points_5v5: rates?.points5v5,
        points_per_60_5v5: rates?.pointsPer605v5,
        primary_assists_5v5: rates?.primaryAssists5v5,
        primary_assists_per_60_5v5: rates?.primaryAssistsPer605v5,
        sat_relative_5v5: rates?.satRelative5v5,
        secondary_assists_5v5: rates?.secondaryAssists5v5,
        secondary_assists_per_60_5v5: rates?.secondaryAssistsPer605v5,
        // Scoring per game
        total_primary_assists: counts?.totalPrimaryAssists,
        total_secondary_assists: counts?.totalSecondaryAssists,
        // Shot type stats
        goals_backhand: shots?.goalsBackhand,
        goals_bat: shots?.goalsBat,
        goals_between_legs: shots?.goalsBetweenLegs,
        goals_cradle: shots?.goalsCradle,
        goals_deflected: shots?.goalsDeflected,
        goals_poke: shots?.goalsPoke,
        goals_slap: shots?.goalsSlap,
        goals_snap: shots?.goalsSnap,
        goals_tip_in: shots?.goalsTipIn,
        goals_wrap_around: shots?.goalsWrapAround,
        goals_wrist: shots?.goalsWrist,
        shots_on_net_backhand: shots?.shotsOnNetBackhand,
        shots_on_net_bat: shots?.shotsOnNetBat,
        shots_on_net_between_legs: shots?.shotsOnNetBetweenLegs,
        shots_on_net_cradle: shots?.shotsOnNetCradle,
        shots_on_net_deflected: shots?.shotsOnNetDeflected,
        shots_on_net_poke: shots?.shotsOnNetPoke,
        shots_on_net_slap: shots?.shotsOnNetSlap,
        shots_on_net_snap: shots?.shotsOnNetSnap,
        shots_on_net_tip_in: shots?.shotsOnNetTipIn,
        shots_on_net_wrap_around: shots?.shotsOnNetWrapAround,
        shots_on_net_wrist: shots?.shotsOnNetWrist,
        // Time on ice stats
        ev_time_on_ice: toiStats?.evTimeOnIce,
        ev_time_on_ice_per_game: toiStats?.evTimeOnIcePerGame,
        ot_time_on_ice: toiStats?.otTimeOnIce,
        ot_time_on_ice_per_game: toiStats?.otTimeOnIcePerOtGame,
        shifts: toiStats?.shifts,
        shifts_per_game: toiStats?.shiftsPerGame,
        time_on_ice_per_shift: toiStats?.timeOnIcePerShift,
        // Include the updated_at timestamp
        updated_at: now
      };

      dataArray.push(skatersData);
    }

    // Batch upsert
    try {
      await batchUpsert(dataArray, 500, 4);
      playersUpdated = dataArray.length;
    } catch (e) {
      console.error("batchUpsert failed:", e);
      totalErrors++;
    }
  } catch (e: any) {
    console.error("Fatal error in updateSkaterTotals:", e);
    totalErrors++;
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(
    `Season ${season} done: ${playersUpdated} players updated in ${durationSec}s with ${totalErrors} error(s).`
  );

  return {
    updated: totalErrors === 0,
    playersUpdated,
    totalErrors
  };
}

// ==============================
// API handler
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const jobName = "update-skater-totals";
  const startTime = Date.now();
  let status: "success" | "error" = "success";
  let rowsAffected = 0;
  let totalErrors = 0;
  let details: any = {};

  try {
    // ─── decide “all” vs single season ─────────────────────
    const seasonParam = Array.isArray(req.query.season)
      ? req.query.season[0]
      : req.query.season;

    if (seasonParam?.toLowerCase() === "all") {
      console.log("Processing all seasons…");
      const { seasonsProcessed, totalTimeInSeconds } = await processSeasons();
      rowsAffected = seasonsProcessed.length;
      details = { seasonsProcessed, totalTimeInSeconds };
      return res.json({
        message: `Updated ${rowsAffected} season(s).`,
        success: true,
        ...details
      });
    }

    // ─── single season ───────────────────────────────────────
    const seasonValue = seasonParam!;
    console.log(`Processing season ${seasonValue}`);
    const result = await updateSkaterTotals(seasonValue);
    rowsAffected = result.playersUpdated;
    totalErrors = result.totalErrors;
    details = {
      playersUpdated: result.playersUpdated,
      totalErrors: result.totalErrors
    };
    return res.json({
      message: `Updated ${rowsAffected} players for ${seasonValue}.`,
      success: result.updated,
      ...details
    });
  } catch (err: any) {
    status = "error";
    totalErrors += 1;
    details = { ...details, error: err.message };
    if (!res.headersSent) {
      res.status(500).json({ message: err.message, success: false });
    }
  } finally {
    const processingTimeMs = Date.now() - startTime;
    details = { ...details, processingTimeMs };

    // write a single audit row no matter what
    try {
      await supabase.from("cron_job_audit").insert([
        {
          job_name: jobName,
          status,
          rows_affected: rowsAffected,
          details
        }
      ]);
    } catch (auditErr) {
      console.error("Failed to write audit row:", auditErr);
    }
  }
}
