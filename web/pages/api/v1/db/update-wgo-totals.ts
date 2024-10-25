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
  WGOToiSkaterTotal,
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

// Fetch all skater data for a specific date with a limit on the number of records
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
  let start = 0;
  let moreDataAvailable = true;
  let skaterTotalStats: WGOSummarySkaterTotal[] = [];
  let skatersBio: WGOSkatersBio[] = [];
  let miscTotalSkaterStats: WGORealtimeSkaterTotal[] = [];
  let faceOffTotalStats: WGOFaceoffSkaterTotal[] = [];
  let faceoffWinLossTotalStats: WGOFaceOffWinLossSkaterTotal[] = [];
  let goalsForAgainstTotalStats: WGOGoalsForAgainstSkaterTotal[] = [];
  let penaltiesTotalStats: WGOPenaltySkaterTotal[] = [];
  let penaltyKillTotalStats: WGOPenaltyKillSkaterTotal[] = [];
  let powerPlayTotalStats: WGOPowerPlaySkaterTotal[] = [];
  let puckPossessionTotalStats: WGOPuckPossessionSkaterTotal[] = [];
  let satCountsTotalStats: WGOSatCountSkaterTotal[] = [];
  let satPercentagesTotalStats: WGOSatPercentageSkaterTotal[] = [];
  let scoringRatesTotalStats: WGOScoringRatesSkaterTotal[] = [];
  let scoringPerGameTotalStats: WGOScoringCountsSkaterTotal[] = [];
  let shotTypeTotalStats: WGOShotTypeSkaterTotal[] = [];
  let timeOnIceTotalStats: WGOToiSkaterTotal[] = [];

  // Loop to fetch all pages of data from the API
  while (moreDataAvailable) {
    // Construct the URL for fetching skater stats
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

    // Fetch data from the URL in parallel using Promise.all
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
      timeOnIceTotalsResponse,
    ] = await Promise.all([
      Fetch(skaterTotalStatsUrl).then(
        (res) => res.json() as Promise<NHLApiResponse>
      ),
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
      ),
    ]);

    // Concatenate the fetched data to the accumulated array
    skaterTotalStats = skaterTotalStats.concat(
      skaterTotalStatsResponse.data as WGOSummarySkaterTotal[]
    );
    skatersBio = skatersBio.concat(bioStatsResponse.data as WGOSkatersBio[]);
    miscTotalSkaterStats = miscTotalSkaterStats.concat(
      miscSkaterTotalsResponse.data as WGORealtimeSkaterTotal[]
    );
    faceOffTotalStats = faceOffTotalStats.concat(
      faceOffTotalsResponse.data as WGOFaceoffSkaterTotal[]
    );
    faceoffWinLossTotalStats = faceoffWinLossTotalStats.concat(
      faceoffWinLossTotalsResponse.data as WGOFaceOffWinLossSkaterTotal[]
    );
    goalsForAgainstTotalStats = goalsForAgainstTotalStats.concat(
      goalsForAgainstTotalsResponse.data as WGOGoalsForAgainstSkaterTotal[]
    );
    penaltiesTotalStats = penaltiesTotalStats.concat(
      penaltiesTotalsResponse.data as WGOPenaltySkaterTotal[]
    );
    penaltyKillTotalStats = penaltyKillTotalStats.concat(
      penaltyKillTotalsResponse.data as WGOPenaltyKillSkaterTotal[]
    );
    powerPlayTotalStats = powerPlayTotalStats.concat(
      powerPlayTotalsResponse.data as WGOPowerPlaySkaterTotal[]
    );
    puckPossessionTotalStats = puckPossessionTotalStats.concat(
      puckPossessionTotalsResponse.data as WGOPuckPossessionSkaterTotal[]
    );
    satCountsTotalStats = satCountsTotalStats.concat(
      satCountsTotalsResponse.data as WGOSatCountSkaterTotal[]
    );
    satPercentagesTotalStats = satPercentagesTotalStats.concat(
      satPercentagesTotalsResponse.data as WGOSatPercentageSkaterTotal[]
    );
    scoringRatesTotalStats = scoringRatesTotalStats.concat(
      scoringRatesTotalsResponse.data as WGOScoringRatesSkaterTotal[]
    );
    scoringPerGameTotalStats = scoringPerGameTotalStats.concat(
      scoringPerGameTotalsResponse.data as WGOScoringCountsSkaterTotal[]
    );
    shotTypeTotalStats = shotTypeTotalStats.concat(
      shotTypeTotalsResponse.data as WGOShotTypeSkaterTotal[]
    );
    timeOnIceTotalStats = timeOnIceTotalStats.concat(
      timeOnIceTotalsResponse.data as WGOToiSkaterTotal[]
    );

    // Determine if more data is available to fetch in the next iteration
    moreDataAvailable = skaterTotalStatsResponse.data?.length === limit;

    start += limit; // Increment the start index for the next fetch
  }

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
    timeOnIceTotalStats,
  };
}

// Function to update skater stats for a season date in the Supabase database
// Function to update skater stats for a season in the Supabase database
async function updateSkaterTotals(
  season: string
): Promise<{ updated: boolean }> {
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
    timeOnIceTotalStats,
  } = await fetchAllTotalsForSeason(season, 100);

  // **Create Maps for Fast Lookups**
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

  // **Collect Upsert Data into an Array**
  const upsertDataArray = [];

  // Iterate over each skater stat and collect data
  for (const stat of skaterTotalStats) {
    // Find the corresponding stats for the skater using Maps
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

    const upsertData = {
      // Mapping fields from fetched data to Supabase table columns
      // summary stats from skaterStatsResponse (stat)
      player_id: stat.playerId, // int
      player_name: stat.skaterFullName, // text
      season: season, // STRING
      shoots_catches: stat.shootsCatches, // text
      position_code: stat.positionCode, // text
      games_played: stat.gamesPlayed, // int
      points: stat.points, // int
      points_per_game: stat.pointsPerGame, // float
      goals: stat.goals, // int
      assists: stat.assists, // int
      shots: stat.shots, // int
      shooting_percentage: stat.shootingPct, // float
      plus_minus: stat.plusMinus, // int
      ot_goals: stat.otGoals, // int
      gw_goals: stat.gameWinningGoals, // int
      pp_points: stat.ppPoints, // int
      fow_percentage: stat.faceoffWinPct, // float
      toi_per_game: stat.timeOnIcePerGame, // float
      // bio stats from skatersBioResponse (bioTotals)
      birth_date: bioTotals?.birthDate, // date
      current_team_abbreviation: bioTotals?.currentTeamAbbrev, // text
      current_team_name: bioTotals?.currentTeamName, // text
      birth_city: bioTotals?.birthCity, // text
      birth_country: bioTotals?.birthCountryCode, // text
      height: bioTotals?.height, // text
      weight: bioTotals?.weight, // int
      draft_year: bioTotals?.draftYear, // int
      draft_round: bioTotals?.draftRound, // int
      draft_overall: bioTotals?.draftOverall, // int
      first_season_for_game_type: bioTotals?.firstSeasonForGameType, // int
      nationality_code: bioTotals?.nationalityCode, // text
      // realtime stats from miscSkaterStatsResponse (miscStats)
      blocked_shots: miscTotals?.blockedShots, // int
      blocks_per_60: miscTotals?.blockedShotsPer60, // float
      empty_net_goals: miscTotals?.emptyNetGoals, // int
      empty_net_points: miscTotals?.emptyNetPoints, // int
      giveaways: miscTotals?.giveaways, // int
      giveaways_per_60: miscTotals?.giveawaysPer60, // float
      hits: miscTotals?.hits, // int
      hits_per_60: miscTotals?.hitsPer60, // float
      missed_shots: miscTotals?.missedShots, // int
      takeaways: miscTotals?.takeaways, // int
      takeaways_per_60: miscTotals?.takeawaysPer60, // float
      // faceoff stats from faceOffStatsResponse (faceOffStats)
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
      // faceoff win/loss stats from faceoffWinLossResponse (faceoffWinLossStats)
      d_zone_fol: faceoffWinLossTotals?.defensiveZoneFaceoffLosses, // int
      d_zone_fow: faceoffWinLossTotals?.defensiveZoneFaceoffWins, // int
      ev_fol: faceoffWinLossTotals?.evFaceoffsLost, // int
      ev_fow: faceoffWinLossTotals?.evFaceoffsWon, // int
      n_zone_fol: faceoffWinLossTotals?.neutralZoneFaceoffLosses, // int
      n_zone_fow: faceoffWinLossTotals?.neutralZoneFaceoffWins, // int
      o_zone_fol: faceoffWinLossTotals?.offensiveZoneFaceoffLosses, // int
      o_zone_fow: faceoffWinLossTotals?.offensiveZoneFaceoffWins, // int
      pp_fol: faceoffWinLossTotals?.ppFaceoffsLost, // int
      pp_fow: faceoffWinLossTotals?.ppFaceoffsWon, // int
      sh_fol: faceoffWinLossTotals?.shFaceoffsLost, // int
      sh_fow: faceoffWinLossTotals?.shFaceoffsWon, // int
      total_fol: faceoffWinLossTotals?.totalFaceoffLosses, // int
      total_fow: faceoffWinLossTotals?.totalFaceoffWins, // int
      // goals for/against stats from goalsForAgainstResponse (goalsForAgainstStats)
      es_goals_against: goalsForAgainstTotals?.evenStrengthGoalsAgainst, // int
      es_goals_for: goalsForAgainstTotals?.evenStrengthGoalsFor, // int
      es_goals_for_percentage: goalsForAgainstTotals?.evenStrengthGoalsForPct, // float
      es_toi_per_game: goalsForAgainstTotals?.evenStrengthTimeOnIcePerGame, // float
      pp_goals_against: goalsForAgainstTotals?.powerPlayGoalsAgainst, // int
      pp_goals_for: goalsForAgainstTotals?.powerPlayGoalFor, // int
      pp_toi_per_game: goalsForAgainstTotals?.powerPlayTimeOnIcePerGame, // float
      sh_goals_against: goalsForAgainstTotals?.shortHandedGoalsAgainst, // int
      sh_goals_for: goalsForAgainstTotals?.shortHandedGoalsFor, // int
      sh_toi_per_game: goalsForAgainstTotals?.shortHandedTimeOnIcePerGame, // float
      // penalties stats from penaltiesResponse (penaltiesStat)
      game_misconduct_penalties: penaltiesTotals?.gameMisconductPenalties, // int
      major_penalties: penaltiesTotals?.majorPenalties, // int
      match_penalties: penaltiesTotals?.matchPenalties, // int
      minor_penalties: penaltiesTotals?.minorPenalties, // int
      misconduct_penalties: penaltiesTotals?.misconductPenalties, // int
      penalties: penaltiesTotals?.penalties, // int
      penalties_drawn: penaltiesTotals?.penaltiesDrawn, // int
      penalties_drawn_per_60: penaltiesTotals?.penaltiesDrawnPer60, // float
      penalties_taken_per_60: penaltiesTotals?.penaltiesTakenPer60, // float
      penalty_minutes: penaltiesTotals?.penaltyMinutes, // int
      penalty_seconds_per_game: penaltiesTotals?.penaltySecondsPerGame, // float
      // penalty kill stats from penaltyKillResponse (penaltyKillStat)
      pp_goals_against_per_60: penaltyKillTotals?.ppGoalsAgainstPer60, // float/
      sh_assists: penaltyKillTotals?.shAssists, // int
      sh_goals: penaltyKillTotals?.shGoals, // int
      sh_points: penaltyKillTotals?.shPoints, // int
      sh_goals_per_60: penaltyKillTotals?.shGoalsPer60, // float
      sh_individual_sat_for: penaltyKillTotals?.shIndividualSatFor, // int
      sh_individual_sat_per_60: penaltyKillTotals?.shIndividualSatForPer60, // float
      sh_points_per_60: penaltyKillTotals?.shPointsPer60, // float
      sh_primary_assists: penaltyKillTotals?.shPrimaryAssists, // int
      sh_primary_assists_per_60: penaltyKillTotals?.shPrimaryAssistsPer60, // float
      sh_secondary_assists: penaltyKillTotals?.shSecondaryAssists, // int
      sh_secondary_assists_per_60: penaltyKillTotals?.shSecondaryAssistsPer60, // float
      sh_shooting_percentage: penaltyKillTotals?.shShootingPct, // float
      sh_shots: penaltyKillTotals?.shShots, // int
      sh_shots_per_60: penaltyKillTotals?.shShotsPer60, // float
      sh_time_on_ice: penaltyKillTotals?.shTimeOnIce, // int
      sh_time_on_ice_pct_per_game: penaltyKillTotals?.shTimeOnIcePctPerGame, // float
      // power play stats from powerPlayResponse (powerPlayStat)
      pp_assists: powerPlayTotals?.ppAssists, // int
      pp_goals: powerPlayTotals?.ppGoals, // int
      pp_goals_for_per_60: powerPlayTotals?.ppGoalsForPer60, // float
      pp_goals_per_60: powerPlayTotals?.ppGoalsPer60, // float
      pp_individual_sat_for: powerPlayTotals?.ppIndividualSatFor, // int
      pp_individual_sat_per_60: powerPlayTotals?.ppIndividualSatPer60, // float
      pp_points_per_60: powerPlayTotals?.ppPointsPer60, // float
      pp_primary_assists: powerPlayTotals?.ppPrimaryAssists, // int
      pp_primary_assists_per_60: powerPlayTotals?.ppPrimaryAssistsPer60, // float
      pp_secondary_assists: powerPlayTotals?.ppSecondaryAssists, // int
      pp_secondary_assists_per_60: powerPlayTotals?.ppSecondaryAssistsPer60, // float
      pp_shooting_percentage: powerPlayTotals?.ppShootingPct, // float
      pp_shots: powerPlayTotals?.ppShots, // int
      pp_shots_per_60: powerPlayTotals?.ppShotsPer60, // float
      pp_toi: powerPlayTotals?.ppTimeOnIce, // int
      pp_toi_pct_per_game: powerPlayTotals?.ppTimeOnIcePctPerGame, // float
      // puck possession stats from puckPossessionResponse (puckPossessionStat)
      goals_pct: puckPossessionTotals?.goalsPct, // float
      faceoff_pct_5v5: puckPossessionTotals?.faceoffPct5v5, // float
      individual_sat_for_per_60: puckPossessionTotals?.individualSatForPer60, // float
      individual_shots_for_per_60:
        puckPossessionTotals?.individualShotsForPer60, // float
      on_ice_shooting_pct: puckPossessionTotals?.onIceShootingPct, // float
      sat_pct: puckPossessionTotals?.satPct, // float
      toi_per_game_5v5: puckPossessionTotals?.timeOnIcePerGame5v5, // float
      usat_pct: puckPossessionTotals?.usatPct, // float
      zone_start_pct: puckPossessionTotals?.zoneStartPct, // float
      // shooting stats from satCountsResponse (satCountsStat)
      sat_against: satCountsTotals?.satAgainst, // int
      sat_ahead: satCountsTotals?.satAhead, // int
      sat_behind: satCountsTotals?.satBehind, // int
      sat_close: satCountsTotals?.satClose, // int
      sat_for: satCountsTotals?.satFor, // int
      sat_tied: satCountsTotals?.satTied, // int
      sat_total: satCountsTotals?.satTotal, // int
      usat_against: satCountsTotals?.usatAgainst, // int
      usat_ahead: satCountsTotals?.usatAhead, // int
      usat_behind: satCountsTotals?.usatBehind, // int
      usat_close: satCountsTotals?.usatClose, // int
      usat_for: satCountsTotals?.usatFor, // int
      usat_tied: satCountsTotals?.usatTied, // int
      usat_total: satCountsTotals?.usatTotal, // int
      // shooting percentages from satPercentagesResponse (satPercentagesStat)
      sat_percentage: satPercentagesTotals?.satPercentage, // float
      sat_percentage_ahead: satPercentagesTotals?.satPercentageAhead, // float
      sat_percentage_behind: satPercentagesTotals?.satPercentageBehind, // float
      sat_percentage_close: satPercentagesTotals?.satPercentageClose, // float
      sat_percentage_tied: satPercentagesTotals?.satPercentageTied, // float
      sat_relative: satPercentagesTotals?.satRelative, // float
      shooting_percentage_5v5: satPercentagesTotals?.shootingPct5v5, // float
      skater_save_pct_5v5: satPercentagesTotals?.skaterSavePct5v5, // float
      skater_shooting_plus_save_pct_5v5:
        satPercentagesTotals?.skaterShootingPlusSavePct5v5, // float
      usat_percentage: satPercentagesTotals?.usatPercentage, // float
      usat_percentage_ahead: satPercentagesTotals?.usatPercentageAhead, // float
      usat_percentage_behind: satPercentagesTotals?.usatPercentageBehind, // float
      usat_percentage_close: satPercentagesTotals?.usatPercentageClose, // float
      usat_percentage_tied: satPercentagesTotals?.usatPercentageTied, // float
      usat_relative: satPercentagesTotals?.usatRelative, // float
      zone_start_pct_5v5: satPercentagesTotals?.zoneStartPct5v5, // float
      // scoring rates from scoringRatesResponse (scoringRatesStat)
      assists_5v5: scoringRatesTotals?.assists5v5, // int
      assists_per_60_5v5: scoringRatesTotals?.assistsPer605v5, // float
      goals_5v5: scoringRatesTotals?.goals5v5, // int
      goals_per_60_5v5: scoringRatesTotals?.goalsPer605v5, // float
      o_zone_start_pct_5v5: scoringRatesTotals?.offensiveZoneStartPct5v5, // float
      on_ice_shooting_pct_5v5: scoringRatesTotals?.onIceShootingPct5v5, // float
      points_5v5: scoringRatesTotals?.points5v5, // int
      points_per_60_5v5: scoringRatesTotals?.pointsPer605v5, // float
      primary_assists_5v5: scoringRatesTotals?.primaryAssists5v5, // int
      primary_assists_per_60_5v5: scoringRatesTotals?.primaryAssistsPer605v5, // float
      sat_relative_5v5: scoringRatesTotals?.satRelative5v5, // float
      secondary_assists_5v5: scoringRatesTotals?.secondaryAssists5v5, // int
      secondary_assists_per_60_5v5:
        scoringRatesTotals?.secondaryAssistsPer605v5, // float
      // scoring per game from scoringPerGameResponse (scoringPerGameStat)
      total_primary_assists: scoringPerGameTotals?.totalPrimaryAssists, // int
      total_secondary_assists: scoringPerGameTotals?.totalSecondaryAssists, // int
      // shot type stats from shotTypeResponse (shotTypeStat)
      goals_backhand: shotTypeTotals?.goalsBackhand, // int
      goals_bat: shotTypeTotals?.goalsBat, // int
      goals_between_legs: shotTypeTotals?.goalsBetweenLegs, // int
      goals_cradle: shotTypeTotals?.goalsCradle, // int
      goals_deflected: shotTypeTotals?.goalsDeflected, // int
      goals_poke: shotTypeTotals?.goalsPoke, // int
      goals_slap: shotTypeTotals?.goalsSlap, // int
      goals_snap: shotTypeTotals?.goalsSnap, // int
      goals_tip_in: shotTypeTotals?.goalsTipIn, // int
      goals_wrap_around: shotTypeTotals?.goalsWrapAround, // int
      goals_wrist: shotTypeTotals?.goalsWrist, // int
      shots_on_net_backhand: shotTypeTotals?.shotsOnNetBackhand, // int
      shots_on_net_bat: shotTypeTotals?.shotsOnNetBat, // int
      shots_on_net_between_legs: shotTypeTotals?.shotsOnNetBetweenLegs, // int
      shots_on_net_cradle: shotTypeTotals?.shotsOnNetCradle, // int
      shots_on_net_deflected: shotTypeTotals?.shotsOnNetDeflected, // int
      shots_on_net_poke: shotTypeTotals?.shotsOnNetPoke, // int
      shots_on_net_slap: shotTypeTotals?.shotsOnNetSlap, // int
      shots_on_net_snap: shotTypeTotals?.shotsOnNetSnap, // int
      shots_on_net_tip_in: shotTypeTotals?.shotsOnNetTipIn, // int
      shots_on_net_wrap_around: shotTypeTotals?.shotsOnNetWrapAround, // int
      shots_on_net_wrist: shotTypeTotals?.shotsOnNetWrist, // int
      // time on ice stats from timeOnIceResponse (timeOnIceStat)
      ev_time_on_ice: timeOnIceTotals?.evTimeOnIce, // int
      ev_time_on_ice_per_game: timeOnIceTotals?.evTimeOnIcePerGame, // float
      ot_time_on_ice: timeOnIceTotals?.otTimeOnIce, // int
      ot_time_on_ice_per_game: timeOnIceTotals?.otTimeOnIcePerOtGame, // float
      shifts: timeOnIceTotals?.shifts, // int
      shifts_per_game: timeOnIceTotals?.shiftsPerGame, // float
      time_on_ice_per_shift: timeOnIceTotals?.timeOnIcePerShift, // float
    };
    console.log(`Player ${stat.skaterFullName} updated successfully`);

    console.log(`Player stats updated successfully for season ${season}`);

    // **Add upsert data to the array**
    upsertDataArray.push(upsertData);
  }
  // **Perform Bulk Upsert**
  const { error } = await supabase
    .from("wgo_skater_stats_totals")
    .upsert(upsertDataArray, { onConflict: "player_id,season" });

  if (error) {
    console.error("Error during bulk upsert:", error);
    throw new Error("Bulk upsert failed");
  } else {
    console.log(`Player stats updated successfully for season ${season}`);
  }

  return {
    updated: true,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const seasonParam = req.query.season;
    if (!seasonParam) {
      throw new Error("Season parameter is missing");
    }

    const season = Array.isArray(seasonParam) ? seasonParam[0] : seasonParam;

    const result = await updateSkaterTotals(season);
    res.json({
      message: `Skater stats updated successfully for season ${season}.`,
      success: true,
      data: result,
    });
  } catch (e: any) {
    console.error("Error in handler:", e.message); // Log the error for debugging
    res.status(400).json({
      message: `Failed to process request in handler. Reason: ${e.message}`,
      success: false,
    });
  }
}
