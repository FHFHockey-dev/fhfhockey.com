import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import Fetch from "lib/cors-fetch";
import { getCurrentSeason } from "lib/NHL/server";
import {
  WGOSummarySkaterTotalLY,
  WGORealtimeSkaterTotalLY,
  WGOFaceoffSkaterTotalLY,
  WGOFaceOffWinLossSkaterTotalLY,
  WGOGoalsForAgainstSkaterTotalLY,
  WGOPenaltySkaterTotalLY,
  WGOPenaltyKillSkaterTotalLY,
  WGOPowerPlaySkaterTotalLY,
  WGOPuckPossessionSkaterTotalLY,
  WGOSatCountSkaterTotalLY,
  WGOSatPercentageSkaterTotalLY,
  WGOScoringRatesSkaterTotalLY,
  WGOScoringCountsSkaterTotalLY,
  WGOShotTypeSkaterTotalLY,
  WGOToiSkaterTotalLY,
} from "lib/NHL/types";

// Define the structure of the NHL API response for skater stats
interface NHLApiResponse {
  data:
    | WGOSummarySkaterTotalLY[]
    | WGORealtimeSkaterTotalLY[]
    | WGOFaceoffSkaterTotalLY[]
    | WGOFaceOffWinLossSkaterTotalLY[]
    | WGOGoalsForAgainstSkaterTotalLY[]
    | WGOPenaltySkaterTotalLY[]
    | WGOPenaltyKillSkaterTotalLY[]
    | WGOPowerPlaySkaterTotalLY[]
    | WGOPuckPossessionSkaterTotalLY[]
    | WGOSatCountSkaterTotalLY[]
    | WGOSatPercentageSkaterTotalLY[]
    | WGOScoringRatesSkaterTotalLY[]
    | WGOScoringCountsSkaterTotalLY[]
    | WGOShotTypeSkaterTotalLY[]
    | WGOToiSkaterTotalLY[];
}

// Fetch all skater data for a specific date with a limit on the number of records
async function fetchAllTotalsForSeason(
  season: string,
  limit: number
): Promise<{
  SkaterTotalLYStats: WGOSummarySkaterTotalLY[];
  miscTotalSkaterStats: WGORealtimeSkaterTotalLY[];
  faceOffTotalStats: WGOFaceoffSkaterTotalLY[];
  faceoffWinLossTotalStats: WGOFaceOffWinLossSkaterTotalLY[];
  goalsForAgainstTotalStats: WGOGoalsForAgainstSkaterTotalLY[];
  penaltiesTotalStats: WGOPenaltySkaterTotalLY[];
  penaltyKillTotalStats: WGOPenaltyKillSkaterTotalLY[];
  powerPlayTotalStats: WGOPowerPlaySkaterTotalLY[];
  puckPossessionTotalStats: WGOPuckPossessionSkaterTotalLY[];
  satCountsTotalStats: WGOSatCountSkaterTotalLY[];
  satPercentagesTotalStats: WGOSatPercentageSkaterTotalLY[];
  scoringRatesTotalStats: WGOScoringRatesSkaterTotalLY[];
  scoringPerGameTotalStats: WGOScoringCountsSkaterTotalLY[];
  shotTypeTotalStats: WGOShotTypeSkaterTotalLY[];
  timeOnIceTotalStats: WGOToiSkaterTotalLY[];
}> {
  let start = 0;
  let moreDataAvailable = true;
  let SkaterTotalLYStats: WGOSummarySkaterTotalLY[] = [];
  let miscTotalSkaterStats: WGORealtimeSkaterTotalLY[] = [];
  let faceOffTotalStats: WGOFaceoffSkaterTotalLY[] = [];
  let faceoffWinLossTotalStats: WGOFaceOffWinLossSkaterTotalLY[] = [];
  let goalsForAgainstTotalStats: WGOGoalsForAgainstSkaterTotalLY[] = [];
  let penaltiesTotalStats: WGOPenaltySkaterTotalLY[] = [];
  let penaltyKillTotalStats: WGOPenaltyKillSkaterTotalLY[] = [];
  let powerPlayTotalStats: WGOPowerPlaySkaterTotalLY[] = [];
  let puckPossessionTotalStats: WGOPuckPossessionSkaterTotalLY[] = [];
  let satCountsTotalStats: WGOSatCountSkaterTotalLY[] = [];
  let satPercentagesTotalStats: WGOSatPercentageSkaterTotalLY[] = [];
  let scoringRatesTotalStats: WGOScoringRatesSkaterTotalLY[] = [];
  let scoringPerGameTotalStats: WGOScoringCountsSkaterTotalLY[] = [];
  let shotTypeTotalStats: WGOShotTypeSkaterTotalLY[] = [];
  let timeOnIceTotalStats: WGOToiSkaterTotalLY[] = [];

  // Loop to fetch all pages of data from the API
  while (moreDataAvailable) {
    // Construct the URL for fetching skater stats
    const SkaterTotalLYStatsUrl = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goals%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22assists%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
    const miscSkaterTotalLYsUrl = `https://api.nhle.com/stats/rest/en/skater/realtime?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22hits%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
    const faceOffTotalsUrl = `https://api.nhle.com/stats/rest/en/skater/faceoffpercentages?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22totalFaceoffs%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
    const faceoffWinLossTotalsUrl = `https://api.nhle.com/stats/rest/en/skater/faceoffwins?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22totalFaceoffWins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22faceoffWinPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
    const goalsForAgainstTotalsUrl = `https://api.nhle.com/stats/rest/en/skater/goalsForAgainst?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22evenStrengthGoalDifference%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
    const penaltiesTotalsUrl = `https://api.nhle.com/stats/rest/en/skater/penalties?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22penaltyMinutes%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}`;
    const penaltyKillTotalsUrl = `https://api.nhle.com/stats/rest/en/skater/penaltykill?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22shTimeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=%${season}`;
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
      SkaterTotalLYStatsResponse,
      miscSkaterTotalLYsResponse,
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
      Fetch(SkaterTotalLYStatsUrl).then(
        (res) => res.json() as Promise<NHLApiResponse>
      ),
      Fetch(miscSkaterTotalLYsUrl).then(
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
    SkaterTotalLYStats = SkaterTotalLYStats.concat(
      SkaterTotalLYStatsResponse.data as WGOSummarySkaterTotalLY[]
    );
    miscTotalSkaterStats = miscTotalSkaterStats.concat(
      miscSkaterTotalLYsResponse.data as WGORealtimeSkaterTotalLY[]
    );
    faceOffTotalStats = faceOffTotalStats.concat(
      faceOffTotalsResponse.data as WGOFaceoffSkaterTotalLY[]
    );
    faceoffWinLossTotalStats = faceoffWinLossTotalStats.concat(
      faceoffWinLossTotalsResponse.data as WGOFaceOffWinLossSkaterTotalLY[]
    );
    goalsForAgainstTotalStats = goalsForAgainstTotalStats.concat(
      goalsForAgainstTotalsResponse.data as WGOGoalsForAgainstSkaterTotalLY[]
    );
    penaltiesTotalStats = penaltiesTotalStats.concat(
      penaltiesTotalsResponse.data as WGOPenaltySkaterTotalLY[]
    );
    penaltyKillTotalStats = penaltyKillTotalStats.concat(
      penaltyKillTotalsResponse.data as WGOPenaltyKillSkaterTotalLY[]
    );
    powerPlayTotalStats = powerPlayTotalStats.concat(
      powerPlayTotalsResponse.data as WGOPowerPlaySkaterTotalLY[]
    );
    puckPossessionTotalStats = puckPossessionTotalStats.concat(
      puckPossessionTotalsResponse.data as WGOPuckPossessionSkaterTotalLY[]
    );
    satCountsTotalStats = satCountsTotalStats.concat(
      satCountsTotalsResponse.data as WGOSatCountSkaterTotalLY[]
    );
    satPercentagesTotalStats = satPercentagesTotalStats.concat(
      satPercentagesTotalsResponse.data as WGOSatPercentageSkaterTotalLY[]
    );
    scoringRatesTotalStats = scoringRatesTotalStats.concat(
      scoringRatesTotalsResponse.data as WGOScoringRatesSkaterTotalLY[]
    );
    scoringPerGameTotalStats = scoringPerGameTotalStats.concat(
      scoringPerGameTotalsResponse.data as WGOScoringCountsSkaterTotalLY[]
    );
    shotTypeTotalStats = shotTypeTotalStats.concat(
      shotTypeTotalsResponse.data as WGOShotTypeSkaterTotalLY[]
    );
    timeOnIceTotalStats = timeOnIceTotalStats.concat(
      timeOnIceTotalsResponse.data as WGOToiSkaterTotalLY[]
    );

    // Determine if more data is available to fetch in the next iteration
    moreDataAvailable =
      SkaterTotalLYStatsResponse.data?.length === limit &&
      miscSkaterTotalLYsResponse.data?.length === limit &&
      faceOffTotalsResponse.data?.length === limit &&
      faceoffWinLossTotalsResponse.data?.length === limit &&
      goalsForAgainstTotalsResponse.data?.length === limit &&
      penaltiesTotalsResponse.data?.length === limit &&
      penaltyKillTotalsResponse.data?.length === limit &&
      powerPlayTotalsResponse.data?.length === limit &&
      puckPossessionTotalsResponse.data?.length === limit &&
      satCountsTotalsResponse.data?.length === limit &&
      satPercentagesTotalsResponse.data?.length === limit &&
      scoringRatesTotalsResponse.data?.length === limit &&
      scoringPerGameTotalsResponse.data?.length === limit &&
      shotTypeTotalsResponse.data?.length === limit &&
      timeOnIceTotalsResponse.data?.length === limit;

    start += limit; // Increment the start index for the next fetch
  }

  return {
    SkaterTotalLYStats,
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
async function updateSkaterTotalLYs(season: string): Promise<{
  updated: boolean;
  playerStats: Record<number, any>;
}> {
  const {
    SkaterTotalLYStats,
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

  let playerStats: Record<number, any> = {};

  // Iterate over each skater stat and upsert into the Supabase table
  for (const stat of SkaterTotalLYStats) {
    // Find the corresponding stats for the skater
    const playerId = stat.playerId;
    const miscTotals = miscTotalSkaterStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const faceOffTotals = faceOffTotalStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const faceoffWinLossTotals = faceoffWinLossTotalStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const goalsForAgainstTotals = goalsForAgainstTotalStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const penaltiesTotals = penaltiesTotalStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const penaltyKillTotals = penaltyKillTotalStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const powerPlayTotals = powerPlayTotalStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const puckPossessionTotals = puckPossessionTotalStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const satCountsTotals = satCountsTotalStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const satPercentagesTotals = satPercentagesTotalStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const scoringRatesTotals = scoringRatesTotalStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const scoringPerGameTotals = scoringPerGameTotalStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const shotTypeTotals = shotTypeTotalStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const timeOnIceTotals = timeOnIceTotalStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    console.log(`Updating player ${stat.skaterFullName}`);

    playerStats[playerId] = {
      // Include all the stats for the player here
      ...stat,
      miscTotals,
      faceOffTotals,
      faceoffWinLossTotals,
      goalsForAgainstTotals,
      penaltiesTotals,
      penaltyKillTotals,
      powerPlayTotals,
      puckPossessionTotals,
      satCountsTotals,
      satPercentagesTotals,
      scoringRatesTotals,
      scoringPerGameTotals,
      shotTypeTotals,
      timeOnIceTotals,
    };

    await supabase.from("wgo_skater_stats_totals_ly").upsert({
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
      usat_percentage_close: satPercentagesTotals?.usatPrecentageClose, // float
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
      // scoring per game from scoringPerGameResponse (scoringPerGameTotals)
      assists_per_game: scoringPerGameTotals?.assistsPerGame, // float
      blocks_per_game: scoringPerGameTotals?.blocksPerGame, // float
      goals_per_game: scoringPerGameTotals?.goalsPerGame, // float
      hits_per_game: scoringPerGameTotals?.hitsPerGame, // float
      penalty_minutes_per_game: scoringPerGameTotals?.penaltyMinutesPerGame, // float
      primary_assists_per_game: scoringPerGameTotals?.primaryAssistsPerGame, // float
      secondary_assists_per_game: scoringPerGameTotals?.secondaryAssistsPerGame, // float
      shots_per_game: scoringPerGameTotals?.shotsPerGame, // float
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
    });
    console.log(`Player ${stat.skaterFullName} updated successfully`);
  }
  console.log(`Player stats updated successfully for season ${season}`);

  return {
    updated: true,
    playerStats,
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

    // Calculate the previous season based on the current season parameter
    const startYear = parseInt(season.slice(0, 4));
    const endYear = parseInt(season.slice(4));
    const lastSeason = `${startYear - 1}${endYear - 1}`;

    const result = await updateSkaterTotalLYs(lastSeason); // Fetch and update stats for the previous season
    res.json({
      message: `Skater stats updated successfully for last season ${lastSeason}.`,
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
