// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/api/v1/db/update-wgo-skaters.ts

import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import Fetch from "lib/cors-fetch";
import {
  format,
  parseISO,
  addDays,
  isBefore,
  differenceInCalendarDays
} from "date-fns";
import { fetchNonGoaliePlayerIds } from "lib/supabase/utils/fetchAllSkaters";
import { getCurrentSeason } from "lib/NHL/server";
import {
  WGOSummarySkaterStat,
  WGOSkatersBio,
  WGORealtimeSkaterStat,
  WGOFaceoffSkaterStat,
  WGOFaceOffWinLossSkaterStat,
  WGOGoalsForAgainstSkaterStat,
  WGOPenaltySkaterStat,
  WGOPenaltyKillSkaterStat,
  WGOPowerPlaySkaterStat,
  WGOPuckPossessionSkaterStat,
  WGOSatCountSkaterStat,
  WGOSatPercentageSkaterStat,
  WGOScoringRatesSkaterStat,
  WGOScoringCountsSkaterStat,
  WGOShotTypeSkaterStat,
  WGOToiSkaterStat,
  WGOSkaterStat
} from "lib/NHL/types";

interface NHLApiResponse {
  data:
    | WGOSummarySkaterStat[]
    | WGOSkatersBio[]
    | WGORealtimeSkaterStat[]
    | WGOFaceoffSkaterStat[]
    | WGOFaceOffWinLossSkaterStat[]
    | WGOGoalsForAgainstSkaterStat[]
    | WGOPenaltySkaterStat[]
    | WGOPenaltyKillSkaterStat[]
    | WGOPowerPlaySkaterStat[]
    | WGOPuckPossessionSkaterStat[]
    | WGOSatCountSkaterStat[]
    | WGOSatPercentageSkaterStat[]
    | WGOScoringRatesSkaterStat[]
    | WGOScoringCountsSkaterStat[]
    | WGOShotTypeSkaterStat[]
    | WGOToiSkaterStat[];
}

// I need to fetch all skater data for a specific date with a limit on the number of records
async function fetchAllDataForDate(
  formattedDate: string,
  limit: number
): Promise<{
  skaterStats: WGOSummarySkaterStat[];
  skatersBio: WGOSkatersBio[];
  miscSkaterStats: WGORealtimeSkaterStat[];
  faceOffStats: WGOFaceoffSkaterStat[];
  faceoffWinLossStats: WGOFaceOffWinLossSkaterStat[];
  goalsForAgainstStats: WGOGoalsForAgainstSkaterStat[];
  penaltiesStats: WGOPenaltySkaterStat[];
  penaltyKillStats: WGOPenaltyKillSkaterStat[];
  powerPlayStats: WGOPowerPlaySkaterStat[];
  puckPossessionStats: WGOPuckPossessionSkaterStat[];
  satCountsStats: WGOSatCountSkaterStat[];
  satPercentagesStats: WGOSatPercentageSkaterStat[];
  scoringRatesStats: WGOScoringRatesSkaterStat[];
  scoringPerGameStats: WGOScoringCountsSkaterStat[];
  shotTypeStats: WGOShotTypeSkaterStat[];
  timeOnIceStats: WGOToiSkaterStat[];
}> {
  // I'll create a helper function to fetch data for a specific game type (regular season or playoffs)
  async function fetchDataForGameType(gameTypeId: number) {
    let start = 0;
    let moreDataAvailable = true;
    let skaterStats: WGOSummarySkaterStat[] = [];
    let skatersBio: WGOSkatersBio[] = [];
    let miscSkaterStats: WGORealtimeSkaterStat[] = [];
    let faceOffStats: WGOFaceoffSkaterStat[] = [];
    let faceoffWinLossStats: WGOFaceOffWinLossSkaterStat[] = [];
    let goalsForAgainstStats: WGOGoalsForAgainstSkaterStat[] = [];
    let penaltiesStats: WGOPenaltySkaterStat[] = [];
    let penaltyKillStats: WGOPenaltyKillSkaterStat[] = [];
    let powerPlayStats: WGOPowerPlaySkaterStat[] = [];
    let puckPossessionStats: WGOPuckPossessionSkaterStat[] = [];
    let satCountsStats: WGOSatCountSkaterStat[] = [];
    let satPercentagesStats: WGOSatPercentageSkaterStat[] = [];
    let scoringRatesStats: WGOScoringRatesSkaterStat[] = [];
    let scoringPerGameStats: WGOScoringCountsSkaterStat[] = [];
    let shotTypeStats: WGOShotTypeSkaterStat[] = [];
    let timeOnIceStats: WGOToiSkaterStat[] = [];

    // I need to loop to fetch all pages of data from the API
    while (moreDataAvailable) {
      // I'll construct the URL for fetching skater stats
      const skaterStatsUrl = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goals%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22assists%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=${gameTypeId}`;
      const skaterBioUrl = `https://api.nhle.com/stats/rest/en/skater/bios?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22lastName%22,%22direction%22:%22ASC_CI%22%7D,%7B%22property%22:%22skaterFullName%22,%22direction%22:%22ASC_CI%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=${gameTypeId}`;
      const miscSkaterStatsUrl = `https://api.nhle.com/stats/rest/en/skater/realtime?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22hits%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=${gameTypeId}`;
      const faceOffStatsUrl = `https://api.nhle.com/stats/rest/en/skater/faceoffpercentages?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22totalFaceoffs%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=${gameTypeId}`;
      const faceoffWinLossUrl = `https://api.nhle.com/stats/rest/en/skater/faceoffwins?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22totalFaceoffWins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22faceoffWinPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=${gameTypeId}`;
      const goalsForAgainstUrl = `https://api.nhle.com/stats/rest/en/skater/goalsForAgainst?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22evenStrengthGoalDifference%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=${gameTypeId}`;
      const penaltiesUrl = `https://api.nhle.com/stats/rest/en/skater/penalties?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22penaltyMinutes%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=${gameTypeId}`;
      const penaltyKillUrl = `https://api.nhle.com/stats/rest/en/skater/penaltykill?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22shTimeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=${gameTypeId}`;
      const powerPlayUrl = `https://api.nhle.com/stats/rest/en/skater/powerplay?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22ppTimeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=${gameTypeId}`;
      const puckPossessionUrl = `https://api.nhle.com/stats/rest/en/skater/puckPossessions?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22satPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=${gameTypeId}`;
      const satCountsUrl = `https://api.nhle.com/stats/rest/en/skater/summaryshooting?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22satTotal%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22usatTotal%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=${gameTypeId}`;
      const satPercentagesUrl = `https://api.nhle.com/stats/rest/en/skater/percentages?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22satPercentage%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=${gameTypeId}`;
      const scoringRatesUrl = `https://api.nhle.com/stats/rest/en/skater/scoringRates?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22pointsPer605v5%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsPer605v5%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=${gameTypeId}`;
      const scoringPerGameUrl = `https://api.nhle.com/stats/rest/en/skater/scoringpergame?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22pointsPerGame%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsPerGame%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=${gameTypeId}`;
      const shotTypeUrl = `https://api.nhle.com/stats/rest/en/skater/shottype?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22shootingPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22shootingPctBat%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=${gameTypeId}`;
      const timeOnIceUrl = `https://api.nhle.com/stats/rest/en/skater/timeonice?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22timeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=${gameTypeId}`;

      // I'll fetch data from the URLs in parallel using Promise.all
      const [
        skaterStatsResponse,
        bioStatsResponse,
        miscSkaterStatsResponse,
        faceOffStatsResponse,
        faceoffWinLossResponse,
        goalsForAgainstResponse,
        penaltiesResponse,
        penaltyKillResponse,
        powerPlayResponse,
        puckPossessionResponse,
        satCountsResponse,
        satPercentagesResponse,
        scoringRatesResponse,
        scoringPerGameResponse,
        shotTypeResponse,
        timeOnIceResponse
      ] = await Promise.all([
        Fetch(skaterStatsUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(skaterBioUrl).then((res) => res.json() as Promise<NHLApiResponse>),
        Fetch(miscSkaterStatsUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(faceOffStatsUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(faceoffWinLossUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(goalsForAgainstUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(penaltiesUrl).then((res) => res.json() as Promise<NHLApiResponse>),
        Fetch(penaltyKillUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(powerPlayUrl).then((res) => res.json() as Promise<NHLApiResponse>),
        Fetch(puckPossessionUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(satCountsUrl).then((res) => res.json() as Promise<NHLApiResponse>),
        Fetch(satPercentagesUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(scoringRatesUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(scoringPerGameUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(shotTypeUrl).then((res) => res.json() as Promise<NHLApiResponse>),
        Fetch(timeOnIceUrl).then((res) => res.json() as Promise<NHLApiResponse>)
      ]);

      // I need to concatenate the fetched data to the accumulated array
      skaterStats = skaterStats.concat(
        skaterStatsResponse.data as WGOSummarySkaterStat[]
      );
      skatersBio = skatersBio.concat(bioStatsResponse.data as WGOSkatersBio[]);
      miscSkaterStats = miscSkaterStats.concat(
        miscSkaterStatsResponse.data as WGORealtimeSkaterStat[]
      );
      faceOffStats = faceOffStats.concat(
        faceOffStatsResponse.data as WGOFaceoffSkaterStat[]
      );
      faceoffWinLossStats = faceoffWinLossStats.concat(
        faceoffWinLossResponse.data as WGOFaceOffWinLossSkaterStat[]
      );
      goalsForAgainstStats = goalsForAgainstStats.concat(
        goalsForAgainstResponse.data as WGOGoalsForAgainstSkaterStat[]
      );
      penaltiesStats = penaltiesStats.concat(
        penaltiesResponse.data as WGOPenaltySkaterStat[]
      );
      penaltyKillStats = penaltyKillStats.concat(
        penaltyKillResponse.data as WGOPenaltyKillSkaterStat[]
      );
      powerPlayStats = powerPlayStats.concat(
        powerPlayResponse.data as WGOPowerPlaySkaterStat[]
      );
      puckPossessionStats = puckPossessionStats.concat(
        puckPossessionResponse.data as WGOPuckPossessionSkaterStat[]
      );
      satCountsStats = satCountsStats.concat(
        satCountsResponse.data as WGOSatCountSkaterStat[]
      );
      satPercentagesStats = satPercentagesStats.concat(
        satPercentagesResponse.data as WGOSatPercentageSkaterStat[]
      );
      scoringRatesStats = scoringRatesStats.concat(
        scoringRatesResponse.data as WGOScoringRatesSkaterStat[]
      );
      scoringPerGameStats = scoringPerGameStats.concat(
        scoringPerGameResponse.data as WGOScoringCountsSkaterStat[]
      );
      shotTypeStats = shotTypeStats.concat(
        shotTypeResponse.data as WGOShotTypeSkaterStat[]
      );
      timeOnIceStats = timeOnIceStats.concat(
        timeOnIceResponse.data as WGOToiSkaterStat[]
      );

      // I need to determine if more data is available to fetch in the next iteration
      moreDataAvailable =
        skaterStatsResponse.data.length === limit ||
        bioStatsResponse.data.length === limit ||
        miscSkaterStatsResponse.data.length === limit ||
        faceOffStatsResponse.data.length === limit ||
        faceoffWinLossResponse.data.length === limit ||
        goalsForAgainstResponse.data.length === limit ||
        penaltiesResponse.data.length === limit ||
        penaltyKillResponse.data.length === limit ||
        powerPlayResponse.data.length === limit ||
        puckPossessionResponse.data.length === limit ||
        satCountsResponse.data.length === limit ||
        satPercentagesResponse.data.length === limit ||
        scoringRatesResponse.data.length === limit ||
        scoringPerGameResponse.data.length === limit ||
        shotTypeResponse.data.length === limit ||
        timeOnIceResponse.data.length === limit;
      start += limit; // I'll increment the start index for the next fetch
    }

    return {
      skaterStats,
      skatersBio,
      miscSkaterStats,
      faceOffStats,
      faceoffWinLossStats,
      goalsForAgainstStats,
      penaltiesStats,
      penaltyKillStats,
      powerPlayStats,
      puckPossessionStats,
      satCountsStats,
      satPercentagesStats,
      scoringRatesStats,
      scoringPerGameStats,
      shotTypeStats,
      timeOnIceStats
    };
  }

  // I'll create a helper function to merge stats by player ID
  function mergeStatsByPlayerId<T extends { playerId: string | number }>(
    regularSeasonStats: T[],
    playoffStats: T[]
  ): T[] {
    const merged = new Map<string, T>();
    
    // I'll add regular season stats
    regularSeasonStats.forEach(stat => {
      merged.set(stat.playerId.toString(), stat);
    });
    
    // I need to merge playoff stats - if player exists, I'll combine the stats
    playoffStats.forEach(playoffStat => {
      const playerId = playoffStat.playerId.toString();
      const existingStat = merged.get(playerId);
      
      if (existingStat) {
        // I'll merge numeric stats by adding them together
        const mergedStat = { ...existingStat };
        Object.keys(playoffStat).forEach(key => {
          if (key !== 'playerId' && typeof (playoffStat as any)[key] === 'number' && typeof (existingStat as any)[key] === 'number') {
            (mergedStat as any)[key] = (existingStat as any)[key] + (playoffStat as any)[key];
          }
        });
        merged.set(playerId, mergedStat);
      } else {
        // Player only has playoff stats
        merged.set(playerId, playoffStat);
      }
    });
    
    return Array.from(merged.values());
  }

  // I'll fetch data for both regular season and playoffs
  console.log(`Fetching regular season data for ${formattedDate}...`);
  const regularSeasonData = await fetchDataForGameType(2); // Regular season
  
  console.log(`Fetching playoff data for ${formattedDate}...`);
  const playoffData = await fetchDataForGameType(3); // Playoffs

  // I'll merge the data from both game types
  console.log(`Merging regular season and playoff data for ${formattedDate}...`);
  return {
    skaterStats: mergeStatsByPlayerId(regularSeasonData.skaterStats, playoffData.skaterStats),
    skatersBio: mergeStatsByPlayerId(regularSeasonData.skatersBio, playoffData.skatersBio),
    miscSkaterStats: mergeStatsByPlayerId(regularSeasonData.miscSkaterStats, playoffData.miscSkaterStats),
    faceOffStats: mergeStatsByPlayerId(regularSeasonData.faceOffStats, playoffData.faceOffStats),
    faceoffWinLossStats: mergeStatsByPlayerId(regularSeasonData.faceoffWinLossStats, playoffData.faceoffWinLossStats),
    goalsForAgainstStats: mergeStatsByPlayerId(regularSeasonData.goalsForAgainstStats, playoffData.goalsForAgainstStats),
    penaltiesStats: mergeStatsByPlayerId(regularSeasonData.penaltiesStats, playoffData.penaltiesStats),
    penaltyKillStats: mergeStatsByPlayerId(regularSeasonData.penaltyKillStats, playoffData.penaltyKillStats),
    powerPlayStats: mergeStatsByPlayerId(regularSeasonData.powerPlayStats, playoffData.powerPlayStats),
    puckPossessionStats: mergeStatsByPlayerId(regularSeasonData.puckPossessionStats, playoffData.puckPossessionStats),
    satCountsStats: mergeStatsByPlayerId(regularSeasonData.satCountsStats, playoffData.satCountsStats),
    satPercentagesStats: mergeStatsByPlayerId(regularSeasonData.satPercentagesStats, playoffData.satPercentagesStats),
    scoringRatesStats: mergeStatsByPlayerId(regularSeasonData.scoringRatesStats, playoffData.scoringRatesStats),
    scoringPerGameStats: mergeStatsByPlayerId(regularSeasonData.scoringPerGameStats, playoffData.scoringPerGameStats),
    shotTypeStats: mergeStatsByPlayerId(regularSeasonData.shotTypeStats, playoffData.shotTypeStats),
    timeOnIceStats: mergeStatsByPlayerId(regularSeasonData.timeOnIceStats, playoffData.timeOnIceStats)
  };
}

// I need a function to fetch data for a specific skater across multiple dates
async function fetchDataForPlayer(
  playerId: string,
  playerName: string
): Promise<{
  skaterStats: WGOSummarySkaterStat[];
  skatersBio: WGOSkatersBio[];
  miscSkaterStats: WGORealtimeSkaterStat[];
  faceOffStats: WGOFaceoffSkaterStat[];
  faceoffWinLossStats: WGOFaceOffWinLossSkaterStat[];
  goalsForAgainstStats: WGOGoalsForAgainstSkaterStat[];
  penaltiesStats: WGOPenaltySkaterStat[];
  penaltyKillStats: WGOPenaltyKillSkaterStat[];
  powerPlayStats: WGOPowerPlaySkaterStat[];
  puckPossessionStats: WGOPuckPossessionSkaterStat[];
  satCountsStats: WGOSatCountSkaterStat[];
  satPercentagesStats: WGOSatPercentageSkaterStat[];
  scoringRatesStats: WGOScoringRatesSkaterStat[];
  scoringPerGameStats: WGOScoringCountsSkaterStat[];
  shotTypeStats: WGOShotTypeSkaterStat[];
  timeOnIceStats: WGOToiSkaterStat[];
}> {
  // I'll create a helper function to fetch data for a specific game type (regular season or playoffs)
  async function fetchPlayerDataForGameType(gameTypeId: number) {
    let start = 0;
    let moreDataAvailable = true;
    let skaterStats: WGOSkaterStat[] = [];
    let skatersBio: WGOSkatersBio[] = [];
    let miscSkaterStats: WGORealtimeSkaterStat[] = [];
    let faceOffStats: WGOFaceoffSkaterStat[] = [];
    let faceoffWinLossStats: WGOFaceOffWinLossSkaterStat[] = [];
    let goalsForAgainstStats: WGOGoalsForAgainstSkaterStat[] = [];
    let penaltiesStats: WGOPenaltySkaterStat[] = [];
    let penaltyKillStats: WGOPenaltyKillSkaterStat[] = [];
    let powerPlayStats: WGOPowerPlaySkaterStat[] = [];
    let puckPossessionStats: WGOPuckPossessionSkaterStat[] = [];
    let satCountsStats: WGOSatCountSkaterStat[] = [];
    let satPercentagesStats: WGOSatPercentageSkaterStat[] = [];
    let scoringRatesStats: WGOScoringRatesSkaterStat[] = [];
    let scoringPerGameStats: WGOScoringCountsSkaterStat[] = [];
    let shotTypeStats: WGOShotTypeSkaterStat[] = [];
    let timeOnIceStats: WGOToiSkaterStat[] = [];

    while (moreDataAvailable) {
      const encodedPlayerName = encodeURIComponent(`%${playerName}%`);
      const today = new Date();
      const formattedDate = format(today, "yyyy-MM-dd");
      const regularSeasonStartDate = format(
        parseISO((await getCurrentSeason()).regularSeasonStartDate),
        "yyyy-MM-dd"
      );
      const skaterStatsURL = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goals%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22assists%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${regularSeasonStartDate}%22%20and%20gameTypeId=${gameTypeId}%20and%20skaterFullName%20likeIgnoreCase%20%22${encodedPlayerName}%22`;
      const skatersBioURL = `https://api.nhle.com/stats/rest/en/skater/bios?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22lastName%22,%22direction%22:%22ASC_CI%22%7D,%7B%22property%22:%22skaterFullName%22,%22direction%22:%22ASC_CI%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&cayenneExp=gameDate%3C=%22${regularSeasonStartDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=${gameTypeId}%20and%20skaterFullName%20likeIgnoreCase%20%22${encodedPlayerName}%22`;
      const miscSkaterStatsURL = `https://api.nhle.com/stats/rest/en/skater/realtime?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22hits%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${regularSeasonStartDate}%22%20and%20gameTypeId=${gameTypeId}%20and%20skaterFullName%20likeIgnoreCase%20%22${encodedPlayerName}%22`;
      const faceOffStatsURL = `https://api.nhle.com/stats/rest/en/skater/faceoffpercentages?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22totalFaceoffs%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${regularSeasonStartDate}%22%20and%20gameTypeId=${gameTypeId}%20and%20skaterFullName%20likeIgnoreCase%20%22${encodedPlayerName}%22`;
      const faceoffWinLossUrl = `https://api.nhle.com/stats/rest/en/skater/faceoffwins?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22totalFaceoffWins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22faceoffWinPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${regularSeasonStartDate}%22%20and%20gameTypeId=${gameTypeId}%20and%20skaterFullName%20likeIgnoreCase%20%22${encodedPlayerName}%22`;
      const goalsForAgainstUrl = `https://api.nhle.com/stats/rest/en/skater/goalsForAgainst?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22evenStrengthGoalDifference%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${regularSeasonStartDate}%22%20and%20gameTypeId=${gameTypeId}%20and%20skaterFullName%20likeIgnoreCase%20%22${encodedPlayerName}%22`;
      const penaltiesUrl = `https://api.nhle.com/stats/rest/en/skater/penalties?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22penaltyMinutes%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${regularSeasonStartDate}%22%20and%20gameTypeId=${gameTypeId}%20and%20skaterFullName%20likeIgnoreCase%20%22${encodedPlayerName}%22`;
      const penaltyKillUrl = `https://api.nhle.com/stats/rest/en/skater/penaltykill?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22shTimeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${regularSeasonStartDate}%22%20and%20gameTypeId=${gameTypeId}%20and%20skaterFullName%20likeIgnoreCase%20%22${encodedPlayerName}%22`;
      const powerPlayUrl = `https://api.nhle.com/stats/rest/en/skater/powerplay?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22ppTimeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${regularSeasonStartDate}%22%20and%20gameTypeId=${gameTypeId}%20and%20skaterFullName%20likeIgnoreCase%20%22${encodedPlayerName}%22`;
      const puckPossessionUrl = `https://api.nhle.com/stats/rest/en/skater/puckPossessions?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22satPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${regularSeasonStartDate}%22%20and%20gameTypeId=${gameTypeId}%20and%20skaterFullName%20likeIgnoreCase%20%22${encodedPlayerName}%22`;
      const satCountsUrl = `https://api.nhle.com/stats/rest/en/skater/summaryshooting?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22satTotal%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22usatTotal%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${regularSeasonStartDate}%22%20and%20gameTypeId=${gameTypeId}%20and%20skaterFullName%20likeIgnoreCase%20%22${encodedPlayerName}%22`;
      const satPercentagesUrl = `https://api.nhle.com/stats/rest/en/skater/percentages?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22satPercentage%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${regularSeasonStartDate}%22%20and%20gameTypeId=${gameTypeId}%20and%20skaterFullName%20likeIgnoreCase%20%22${encodedPlayerName}%22`;
      const scoringRatesUrl = `https://api.nhle.com/stats/rest/en/skater/scoringRates?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22pointsPer605v5%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsPer605v5%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${regularSeasonStartDate}%22%20and%20gameTypeId=${gameTypeId}%20and%20skaterFullName%20likeIgnoreCase%20%22${encodedPlayerName}%22`;
      const scoringPerGameUrl = `https://api.nhle.com/stats/rest/en/skater/scoringpergame?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22pointsPerGame%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsPerGame%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${regularSeasonStartDate}%22%20and%20gameTypeId=${gameTypeId}%20and%20skaterFullName%20likeIgnoreCase%20%22${encodedPlayerName}%22`;
      const shotTypesUrl = `https://api.nhle.com/stats/rest/en/skater/shottype?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22shootingPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22shootingPctBat%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${regularSeasonStartDate}%22%20and%20gameTypeId=${gameTypeId}%20and%20skaterFullName%20likeIgnoreCase%20%22${encodedPlayerName}%22`;
      const timeOnIceUrl = `https://api.nhle.com/stats/rest/en/skater/timeonice?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22timeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${regularSeasonStartDate}%22%20and%20gameTypeId=${gameTypeId}%20and%20skaterFullName%20likeIgnoreCase%20%22${encodedPlayerName}%22`;

      const [
        skaterStatsResponse,
        skatersBioResponse,
        miscSkaterStatsResponse,
        faceOffStatsResponse,
        faceoffWinLossResponse,
        goalsForAgainstResponse,
        penaltiesResponse,
        penaltyKillResponse,
        powerPlayResponse,
        puckPossessionResponse,
        satCountsResponse,
        satPercentagesResponse,
        scoringRatesResponse,
        scoringPerGameResponse,
        shotTypeResponse,
        timeOnIceResponse
      ] = await Promise.all([
        Fetch(skaterStatsURL).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(skatersBioURL).then((res) => res.json() as Promise<NHLApiResponse>),
        Fetch(miscSkaterStatsURL).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(faceOffStatsURL).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(faceoffWinLossUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(goalsForAgainstUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(penaltiesUrl).then((res) => res.json() as Promise<NHLApiResponse>),
        Fetch(penaltyKillUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(powerPlayUrl).then((res) => res.json() as Promise<NHLApiResponse>),
        Fetch(puckPossessionUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(satCountsUrl).then((res) => res.json() as Promise<NHLApiResponse>),
        Fetch(satPercentagesUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(scoringRatesUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(scoringPerGameUrl).then(
          (res) => res.json() as Promise<NHLApiResponse>
        ),
        Fetch(shotTypesUrl).then((res) => res.json() as Promise<NHLApiResponse>),
        Fetch(timeOnIceUrl).then((res) => res.json() as Promise<NHLApiResponse>)
      ]);

      skaterStats = skaterStats.concat(
        skaterStatsResponse.data as WGOSkaterStat[]
      );
      skatersBio = skatersBio.concat(skatersBioResponse.data as WGOSkatersBio[]);
      miscSkaterStats = miscSkaterStats.concat(
        miscSkaterStatsResponse.data as WGORealtimeSkaterStat[]
      );
      faceOffStats = faceOffStats.concat(
        faceOffStatsResponse.data as WGOFaceoffSkaterStat[]
      );
      faceoffWinLossStats = faceoffWinLossStats.concat(
        faceoffWinLossResponse.data as WGOFaceOffWinLossSkaterStat[]
      );
      goalsForAgainstStats = goalsForAgainstStats.concat(
        goalsForAgainstResponse.data as WGOGoalsForAgainstSkaterStat[]
      );
      penaltiesStats = penaltiesStats.concat(
        penaltiesResponse.data as WGOPenaltySkaterStat[]
      );
      penaltyKillStats = penaltyKillStats.concat(
        penaltyKillResponse.data as WGOPenaltyKillSkaterStat[]
      );
      powerPlayStats = powerPlayStats.concat(
        powerPlayResponse.data as WGOPowerPlaySkaterStat[]
      );
      puckPossessionStats = puckPossessionStats.concat(
        puckPossessionResponse.data as WGOPuckPossessionSkaterStat[]
      );
      satCountsStats = satCountsStats.concat(
        satCountsResponse.data as WGOSatCountSkaterStat[]
      );
      satPercentagesStats = satPercentagesStats.concat(
        satPercentagesResponse.data as WGOSatPercentageSkaterStat[]
      );
      scoringRatesStats = scoringRatesStats.concat(
        scoringRatesResponse.data as WGOScoringRatesSkaterStat[]
      );
      scoringPerGameStats = scoringPerGameStats.concat(
        scoringPerGameResponse.data as WGOScoringCountsSkaterStat[]
      );
      shotTypeStats = shotTypeStats.concat(
        shotTypeResponse.data as WGOShotTypeSkaterStat[]
      );
      timeOnIceStats = timeOnIceStats.concat(
        timeOnIceResponse.data as WGOToiSkaterStat[]
      );

      // I need to determine if more data is available to fetch in the next iteration
      moreDataAvailable =
        skaterStatsResponse.data.length === 100 ||
        skatersBioResponse.data.length === 100 ||
        miscSkaterStatsResponse.data.length === 100 ||
        faceOffStatsResponse.data.length === 100 ||
        faceoffWinLossResponse.data.length === 100 ||
        goalsForAgainstResponse.data.length === 100 ||
        penaltiesResponse.data.length === 100 ||
        penaltyKillResponse.data.length === 100 ||
        powerPlayResponse.data.length === 100 ||
        puckPossessionResponse.data.length === 100 ||
        satCountsResponse.data.length === 100 ||
        satPercentagesResponse.data.length === 100 ||
        scoringRatesResponse.data.length === 100 ||
        scoringPerGameResponse.data.length === 100 ||
        shotTypeResponse.data.length === 100 ||
        timeOnIceResponse.data.length === 100;
      start += 100;
    }

    return {
      skaterStats,
      skatersBio,
      miscSkaterStats,
      faceOffStats,
      faceoffWinLossStats,
      goalsForAgainstStats,
      penaltiesStats,
      penaltyKillStats,
      powerPlayStats,
      puckPossessionStats,
      satCountsStats,
      satPercentagesStats,
      scoringRatesStats,
      scoringPerGameStats,
      shotTypeStats,
      timeOnIceStats
    };
  }

  // I'll create a helper function to merge stats by player ID (same as in fetchAllDataForDate)
  function mergeStatsByPlayerId<T extends { playerId: string | number }>(
    regularSeasonStats: T[],
    playoffStats: T[]
  ): T[] {
    const merged = new Map<string, T>();
    
    // I'll add regular season stats
    regularSeasonStats.forEach(stat => {
      merged.set(stat.playerId.toString(), stat);
    });
    
    // I need to merge playoff stats - if player exists, I'll combine the stats
    playoffStats.forEach(playoffStat => {
      const playerId = playoffStat.playerId.toString();
      const existingStat = merged.get(playerId);
      
      if (existingStat) {
        // I'll merge numeric stats by adding them together
        const mergedStat = { ...existingStat };
        Object.keys(playoffStat).forEach(key => {
          if (key !== 'playerId' && typeof (playoffStat as any)[key] === 'number' && typeof (existingStat as any)[key] === 'number') {
            (mergedStat as any)[key] = (existingStat as any)[key] + (playoffStat as any)[key];
          }
        });
        merged.set(playerId, mergedStat);
      } else {
        // Player only has playoff stats
        merged.set(playerId, playoffStat);
      }
    });
    
    return Array.from(merged.values());
  }

  // I'll fetch data for both regular season and playoffs
  console.log(`Fetching regular season data for player ${playerName}...`);
  const regularSeasonData = await fetchPlayerDataForGameType(2); // Regular season
  
  console.log(`Fetching playoff data for player ${playerName}...`);
  const playoffData = await fetchPlayerDataForGameType(3); // Playoffs

  // I'll merge the data from both game types
  console.log(`Merging regular season and playoff data for player ${playerName}...`);
  return {
    skaterStats: mergeStatsByPlayerId(regularSeasonData.skaterStats, playoffData.skaterStats),
    skatersBio: mergeStatsByPlayerId(regularSeasonData.skatersBio, playoffData.skatersBio),
    miscSkaterStats: mergeStatsByPlayerId(regularSeasonData.miscSkaterStats, playoffData.miscSkaterStats),
    faceOffStats: mergeStatsByPlayerId(regularSeasonData.faceOffStats, playoffData.faceOffStats),
    faceoffWinLossStats: mergeStatsByPlayerId(regularSeasonData.faceoffWinLossStats, playoffData.faceoffWinLossStats),
    goalsForAgainstStats: mergeStatsByPlayerId(regularSeasonData.goalsForAgainstStats, playoffData.goalsForAgainstStats),
    penaltiesStats: mergeStatsByPlayerId(regularSeasonData.penaltiesStats, playoffData.penaltiesStats),
    penaltyKillStats: mergeStatsByPlayerId(regularSeasonData.penaltyKillStats, playoffData.penaltyKillStats),
    powerPlayStats: mergeStatsByPlayerId(regularSeasonData.powerPlayStats, playoffData.powerPlayStats),
    puckPossessionStats: mergeStatsByPlayerId(regularSeasonData.puckPossessionStats, playoffData.puckPossessionStats),
    satCountsStats: mergeStatsByPlayerId(regularSeasonData.satCountsStats, playoffData.satCountsStats),
    satPercentagesStats: mergeStatsByPlayerId(regularSeasonData.satPercentagesStats, playoffData.satPercentagesStats),
    scoringRatesStats: mergeStatsByPlayerId(regularSeasonData.scoringRatesStats, playoffData.scoringRatesStats),
    scoringPerGameStats: mergeStatsByPlayerId(regularSeasonData.scoringPerGameStats, playoffData.scoringPerGameStats),
    shotTypeStats: mergeStatsByPlayerId(regularSeasonData.shotTypeStats, playoffData.shotTypeStats),
    timeOnIceStats: mergeStatsByPlayerId(regularSeasonData.timeOnIceStats, playoffData.timeOnIceStats)
  };
}

// I need a function to update skater stats for a specific date
async function updateSkaterStats(date: string) {
  const formattedDate = format(parseISO(date), "yyyy-MM-dd");
  console.log(`Updating skater stats for ${formattedDate}`);

  const {
    skaterStats,
    skatersBio,
    miscSkaterStats,
    faceOffStats,
    faceoffWinLossStats,
    goalsForAgainstStats,
    penaltiesStats,
    penaltyKillStats,
    powerPlayStats,
    puckPossessionStats,
    satCountsStats,
    satPercentagesStats,
    scoringRatesStats,
    scoringPerGameStats,
    shotTypeStats,
    timeOnIceStats,
  } = await fetchAllDataForDate(formattedDate, 100);

  let totalUpdates = 0;

  for (const stat of skaterStats) {
    const bioStats = skatersBio.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const miscStats = miscSkaterStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const faceOffStat = faceOffStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const faceoffWinLossStat = faceoffWinLossStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const goalsForAgainstStat = goalsForAgainstStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const penaltiesStat = penaltiesStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const penaltyKillStat = penaltyKillStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const powerPlayStat = powerPlayStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const puckPossessionStat = puckPossessionStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const satCountsStat = satCountsStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const satPercentagesStat = satPercentagesStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const scoringRatesStat = scoringRatesStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const scoringPerGameStat = scoringPerGameStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const shotTypeStat = shotTypeStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const timeOnIceStat = timeOnIceStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );

    await supabase.from("wgo_skater_stats").upsert({
      // summary stats from skaterStatsResponse (stat)
      player_id: stat.playerId,
      player_name: stat.skaterFullName,
      date: formattedDate,
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
      // bio stats from skatersBioResponse (bioStats)
      birth_date: bioStats?.birthDate,
      current_team_abbreviation: bioStats?.currentTeamAbbrev,
      current_team_name: bioStats?.currentTeamName,
      birth_city: bioStats?.birthCity,
      birth_country: bioStats?.birthCountryCode,
      height: bioStats?.height,
      weight: bioStats?.weight,
      draft_year: bioStats?.draftYear,
      draft_round: bioStats?.draftRound,
      draft_overall: bioStats?.draftOverall,
      first_season_for_game_type: bioStats?.firstSeasonForGameType,
      nationality_code: bioStats?.nationalityCode,
      // realtime stats from miscSkaterStatsResponse (miscStats)
      blocked_shots: miscStats?.blockedShots,
      blocks_per_60: miscStats?.blockedShotsPer60,
      empty_net_assists: miscStats?.emptyNetAssists,
      empty_net_goals: miscStats?.emptyNetGoals,
      empty_net_points: miscStats?.emptyNetPoints,
      first_goals: miscStats?.firstGoals,
      giveaways: miscStats?.giveaways,
      giveaways_per_60: miscStats?.giveawaysPer60,
      hits: miscStats?.hits,
      hits_per_60: miscStats?.hitsPer60,
      missed_shot_crossbar: miscStats?.missedShotCrossbar,
      missed_shot_goal_post: miscStats?.missedShotGoalpost,
      missed_shot_over_net: miscStats?.missedShotOverNet,
      missed_shot_short_side: miscStats?.missedShotShort,
      missed_shot_wide_of_net: miscStats?.missedShotWideOfNet,
      missed_shots: miscStats?.missedShots,
      takeaways: miscStats?.takeaways,
      takeaways_per_60: miscStats?.takeawaysPer60,
      // faceoff stats from faceOffStatsResponse (faceOffStats)
      d_zone_fo_percentage: faceOffStat?.defensiveZoneFaceoffPct,
      d_zone_faceoffs: faceOffStat?.defensiveZoneFaceoffs,
      ev_faceoff_percentage: faceOffStat?.evFaceoffPct,
      ev_faceoffs: faceOffStat?.evFaceoffs,
      n_zone_fo_percentage: faceOffStat?.neutralZoneFaceoffPct,
      n_zone_faceoffs: faceOffStat?.neutralZoneFaceoffs,
      o_zone_fo_percentage: faceOffStat?.offensiveZoneFaceoffPct,
      o_zone_faceoffs: faceOffStat?.offensiveZoneFaceoffs,
      pp_faceoff_percentage: faceOffStat?.ppFaceoffPct,
      pp_faceoffs: faceOffStat?.ppFaceoffs,
      sh_faceoff_percentage: faceOffStat?.shFaceoffPct,
      sh_faceoffs: faceOffStat?.shFaceoffs,
      total_faceoffs: faceOffStat?.totalFaceoffs,
      // faceoff win/loss stats from faceoffWinLossResponse (faceoffWinLossStats)
      d_zone_fol: faceoffWinLossStat?.defensiveZoneFaceoffLosses,
      d_zone_fow: faceoffWinLossStat?.defensiveZoneFaceoffWins,
      ev_fol: faceoffWinLossStat?.evFaceoffsLost,
      ev_fow: faceoffWinLossStat?.evFaceoffsWon,
      n_zone_fol: faceoffWinLossStat?.neutralZoneFaceoffLosses,
      n_zone_fow: faceoffWinLossStat?.neutralZoneFaceoffWins,
      o_zone_fol: faceoffWinLossStat?.offensiveZoneFaceoffLosses,
      o_zone_fow: faceoffWinLossStat?.offensiveZoneFaceoffWins,
      pp_fol: faceoffWinLossStat?.ppFaceoffsLost,
      pp_fow: faceoffWinLossStat?.ppFaceoffsWon,
      sh_fol: faceoffWinLossStat?.shFaceoffsLost,
      sh_fow: faceoffWinLossStat?.shFaceoffsWon,
      total_fol: faceoffWinLossStat?.totalFaceoffLosses,
      total_fow: faceoffWinLossStat?.totalFaceoffWins,
      // goals for/against stats from goalsForAgainstResponse (goalsForAgainstStats)
      es_goal_diff: goalsForAgainstStat?.evenStrengthGoalDifference,
      es_goals_against: goalsForAgainstStat?.evenStrengthGoalsAgainst,
      es_goals_for: goalsForAgainstStat?.evenStrengthGoalsFor,
      es_goals_for_percentage: goalsForAgainstStat?.evenStrengthGoalsForPct,
      es_toi_per_game: goalsForAgainstStat?.evenStrengthTimeOnIcePerGame,
      pp_goals_against: goalsForAgainstStat?.powerPlayGoalsAgainst,
      pp_goals_for: goalsForAgainstStat?.powerPlayGoalFor,
      pp_toi_per_game: goalsForAgainstStat?.powerPlayTimeOnIcePerGame,
      sh_goals_against: goalsForAgainstStat?.shortHandedGoalsAgainst,
      sh_goals_for: goalsForAgainstStat?.shortHandedGoalsFor,
      sh_toi_per_game: goalsForAgainstStat?.shortHandedTimeOnIcePerGame,
      // penalties stats from penaltiesResponse (penaltiesStat)
      game_misconduct_penalties: penaltiesStat?.gameMisconductPenalties,
      major_penalties: penaltiesStat?.majorPenalties,
      match_penalties: penaltiesStat?.matchPenalties,
      minor_penalties: penaltiesStat?.minorPenalties,
      misconduct_penalties: penaltiesStat?.misconductPenalties,
      net_penalties: penaltiesStat?.netPenalties,
      net_penalties_per_60: penaltiesStat?.netPenaltiesPer60,
      penalties: penaltiesStat?.penalties,
      penalties_drawn: penaltiesStat?.penaltiesDrawn,
      penalties_drawn_per_60: penaltiesStat?.penaltiesDrawnPer60,
      penalties_taken_per_60: penaltiesStat?.penaltiesTakenPer60,
      penalty_minutes: penaltiesStat?.penaltyMinutes,
      penalty_minutes_per_toi: penaltiesStat?.penaltyMinutesPerTimeOnIce,
      penalty_seconds_per_game: penaltiesStat?.penaltySecondsPerGame,
      // penalty kill stats from penaltyKillResponse (penaltyKillStat)
      pp_goals_against_per_60: penaltyKillStat?.ppGoalsAgainstPer60,
      sh_assists: penaltyKillStat?.shAssists,
      sh_goals: penaltyKillStat?.shGoals,
      sh_points: penaltyKillStat?.shPoints,
      sh_goals_per_60: penaltyKillStat?.shGoalsPer60,
      sh_individual_sat_for: penaltyKillStat?.shIndividualSatFor,
      sh_individual_sat_per_60: penaltyKillStat?.shIndividualSatForPer60,
      sh_points_per_60: penaltyKillStat?.shPointsPer60,
      sh_primary_assists: penaltyKillStat?.shPrimaryAssists,
      sh_primary_assists_per_60: penaltyKillStat?.shPrimaryAssistsPer60,
      sh_secondary_assists: penaltyKillStat?.shSecondaryAssists,
      sh_secondary_assists_per_60: penaltyKillStat?.shSecondaryAssistsPer60,
      sh_shooting_percentage: penaltyKillStat?.shShootingPct,
      sh_shots: penaltyKillStat?.shShots,
      sh_shots_per_60: penaltyKillStat?.shShotsPer60,
      sh_time_on_ice: penaltyKillStat?.shTimeOnIce,
      sh_time_on_ice_pct_per_game: penaltyKillStat?.shTimeOnIcePctPerGame,
      // power play stats from powerPlayResponse (powerPlayStat)
      pp_assists: powerPlayStat?.ppAssists,
      pp_goals: powerPlayStat?.ppGoals,
      pp_goals_for_per_60: powerPlayStat?.ppGoalsForPer60,
      pp_goals_per_60: powerPlayStat?.ppGoalsPer60,
      pp_individual_sat_for: powerPlayStat?.ppIndividualSatFor,
      pp_individual_sat_per_60: powerPlayStat?.ppIndividualSatPer60,
      pp_points_per_60: powerPlayStat?.ppPointsPer60,
      pp_primary_assists: powerPlayStat?.ppPrimaryAssists,
      pp_primary_assists_per_60: powerPlayStat?.ppPrimaryAssistsPer60,
      pp_secondary_assists: powerPlayStat?.ppSecondaryAssists,
      pp_secondary_assists_per_60: powerPlayStat?.ppSecondaryAssistsPer60,
      pp_shooting_percentage: powerPlayStat?.ppShootingPct,
      pp_shots: powerPlayStat?.ppShots,
      pp_shots_per_60: powerPlayStat?.ppShotsPer60,
      pp_toi: powerPlayStat?.ppTimeOnIce,
      pp_toi_pct_per_game: powerPlayStat?.ppTimeOnIcePctPerGame,
      // puck possession stats from puckPossessionResponse (puckPossessionStat)
      goals_pct: puckPossessionStat?.goalsPct,
      faceoff_pct_5v5: puckPossessionStat?.faceoffPct5v5,
      individual_sat_for_per_60: puckPossessionStat?.individualSatForPer60,
      individual_shots_for_per_60: puckPossessionStat?.individualShotsForPer60,
      on_ice_shooting_pct: puckPossessionStat?.onIceShootingPct,
      sat_pct: puckPossessionStat?.satPct,
      toi_per_game_5v5: puckPossessionStat?.timeOnIcePerGame5v5,
      usat_pct: puckPossessionStat?.usatPct,
      zone_start_pct: puckPossessionStat?.zoneStartPct,
      // shooting stats from satCountsResponse (satCountsStat)
      sat_against: satCountsStat?.satAgainst,
      sat_ahead: satCountsStat?.satAhead,
      sat_behind: satCountsStat?.satBehind,
      sat_close: satCountsStat?.satClose,
      sat_for: satCountsStat?.satFor,
      sat_tied: satCountsStat?.satTied,
      sat_total: satCountsStat?.satTotal,
      usat_against: satCountsStat?.usatAgainst,
      usat_ahead: satCountsStat?.usatAhead,
      usat_behind: satCountsStat?.usatBehind,
      usat_close: satCountsStat?.usatClose,
      usat_for: satCountsStat?.usatFor,
      usat_tied: satCountsStat?.usatTied,
      usat_total: satCountsStat?.usatTotal,
      // shooting percentages from satPercentagesResponse (satPercentagesStat)
      sat_percentage: satPercentagesStat?.satPercentage,
      sat_percentage_ahead: satPercentagesStat?.satPercentageAhead,
      sat_percentage_behind: satPercentagesStat?.satPercentageBehind,
      sat_percentage_close: satPercentagesStat?.satPercentageClose,
      sat_percentage_tied: satPercentagesStat?.satPercentageTied,
      sat_relative: satPercentagesStat?.satRelative,
      shooting_percentage_5v5: satPercentagesStat?.shootingPct5v5,
      skater_save_pct_5v5: satPercentagesStat?.skaterSavePct5v5,
      skater_shooting_plus_save_pct_5v5: satPercentagesStat?.skaterShootingPlusSavePct5v5,
      usat_percentage: satPercentagesStat?.usatPercentage,
      usat_percentage_ahead: satPercentagesStat?.usatPercentageAhead,
      usat_percentage_behind: satPercentagesStat?.usatPercentageBehind,
      usat_percentage_close: satPercentagesStat?.usatPrecentageClose,
      usat_percentage_tied: satPercentagesStat?.usatPercentageTied,
      usat_relative: satPercentagesStat?.usatRelative,
      zone_start_pct_5v5: satPercentagesStat?.zoneStartPct5v5,
      // scoring rates from scoringRatesResponse (scoringRatesStat)
      assists_5v5: scoringRatesStat?.assists5v5,
      assists_per_60_5v5: scoringRatesStat?.assistsPer605v5,
      goals_5v5: scoringRatesStat?.goals5v5,
      goals_per_60_5v5: scoringRatesStat?.goalsPer605v5,
      net_minor_penalties_per_60: scoringRatesStat?.netMinorPenaltiesPer60,
      o_zone_start_pct_5v5: scoringRatesStat?.offensiveZoneStartPct5v5,
      on_ice_shooting_pct_5v5: scoringRatesStat?.onIceShootingPct5v5,
      points_5v5: scoringRatesStat?.points5v5,
      points_per_60_5v5: scoringRatesStat?.pointsPer605v5,
      primary_assists_5v5: scoringRatesStat?.primaryAssists5v5,
      primary_assists_per_60_5v5: scoringRatesStat?.primaryAssistsPer605v5,
      sat_relative_5v5: scoringRatesStat?.satRelative5v5,
      secondary_assists_5v5: scoringRatesStat?.secondaryAssists5v5,
      secondary_assists_per_60_5v5: scoringRatesStat?.secondaryAssistsPer605v5,
      // scoring per game from scoringPerGameResponse (scoringPerGameStat)
      assists_per_game: scoringPerGameStat?.assistsPerGame,
      blocks_per_game: scoringPerGameStat?.blocksPerGame,
      goals_per_game: scoringPerGameStat?.goalsPerGame,
      hits_per_game: scoringPerGameStat?.hitsPerGame,
      penalty_minutes_per_game: scoringPerGameStat?.penaltyMinutesPerGame,
      primary_assists_per_game: scoringPerGameStat?.primaryAssistsPerGame,
      secondary_assists_per_game: scoringPerGameStat?.secondaryAssistsPerGame,
      shots_per_game: scoringPerGameStat?.shotsPerGame,
      total_primary_assists: scoringPerGameStat?.totalPrimaryAssists,
      total_secondary_assists: scoringPerGameStat?.totalSecondaryAssists,
      // shot type stats from shotTypeResponse (shotTypeStat)
      goals_backhand: shotTypeStat?.goalsBackhand,
      goals_bat: shotTypeStat?.goalsBat,
      goals_between_legs: shotTypeStat?.goalsBetweenLegs,
      goals_cradle: shotTypeStat?.goalsCradle,
      goals_deflected: shotTypeStat?.goalsDeflected,
      goals_poke: shotTypeStat?.goalsPoke,
      goals_slap: shotTypeStat?.goalsSlap,
      goals_snap: shotTypeStat?.goalsSnap,
      goals_tip_in: shotTypeStat?.goalsTipIn,
      goals_wrap_around: shotTypeStat?.goalsWrapAround,
      goals_wrist: shotTypeStat?.goalsWrist,
      shooting_pct_backhand: shotTypeStat?.shootingPctBackhand,
      shooting_pct_bat: shotTypeStat?.shootingPctBat,
      shooting_pct_between_legs: shotTypeStat?.shootingPctBetweenLegs,
      shooting_pct_cradle: shotTypeStat?.shootingPctCradle,
      shooting_pct_deflected: shotTypeStat?.shootingPctDeflected,
      shooting_pct_poke: shotTypeStat?.shootingPctPoke,
      shooting_pct_slap: shotTypeStat?.shootingPctSlap,
      shooting_pct_snap: shotTypeStat?.shootingPctSnap,
      shooting_pct_tipIn: shotTypeStat?.shootingPctTipIn,
      shooting_pct_wrap_around: shotTypeStat?.shootingPctWrapAround,
      shooting_pct_wrist: shotTypeStat?.shootingPctWrist,
      shots_on_net_backhand: shotTypeStat?.shotsOnNetBackhand,
      shots_on_net_bat: shotTypeStat?.shotsOnNetBat,
      shots_on_net_between_legs: shotTypeStat?.shotsOnNetBetweenLegs,
      shots_on_net_cradle: shotTypeStat?.shotsOnNetCradle,
      shots_on_net_deflected: shotTypeStat?.shotsOnNetDeflected,
      shots_on_net_poke: shotTypeStat?.shotsOnNetPoke,
      shots_on_net_slap: shotTypeStat?.shotsOnNetSlap,
      shots_on_net_snap: shotTypeStat?.shotsOnNetSnap,
      shots_on_net_tip_in: shotTypeStat?.shotsOnNetTipIn,
      shots_on_net_wrap_around: shotTypeStat?.shotsOnNetWrapAround,
      shots_on_net_wrist: shotTypeStat?.shotsOnNetWrist,
      // time on ice stats from timeOnIceResponse (timeOnIceStat)
      ev_time_on_ice: timeOnIceStat?.evTimeOnIce,
      ev_time_on_ice_per_game: timeOnIceStat?.evTimeOnIcePerGame,
      ot_time_on_ice: timeOnIceStat?.otTimeOnIce,
      ot_time_on_ice_per_game: timeOnIceStat?.otTimeOnIcePerOtGame,
      shifts: timeOnIceStat?.shifts,
      shifts_per_game: timeOnIceStat?.shiftsPerGame,
      time_on_ice_per_shift: timeOnIceStat?.timeOnIcePerShift,
    });
    totalUpdates++;
  }

  return {
    message: `Skater stats updated for ${formattedDate} successfully. Total updates: ${totalUpdates}`,
    success: true,
    totalUpdates: totalUpdates,
  };
}

// I need a function to update skater stats for the entire season
async function updateSkaterStatsForSeason() {
  const currentSeason = await getCurrentSeason();
  let currentDate = parseISO(currentSeason.regularSeasonStartDate);
  const endDate = parseISO(currentSeason.regularSeasonEndDate);
  let totalUpdates = 0;

  while (isBefore(currentDate, endDate)) {
    const formattedDate = format(currentDate, "yyyy-MM-dd");
    console.log(`Updating skater stats for ${formattedDate}`);

    const result = await updateSkaterStats(formattedDate);
    totalUpdates += result.totalUpdates;

    currentDate = addDays(currentDate, 1);
  }

  return {
    message: `Skater stats updated for the entire season successfully. Total updates: ${totalUpdates}`,
    success: true,
    totalUpdates: totalUpdates,
  };
}

// I need a function to get the most recent date from the database
async function getMostRecentDateFromDB(): Promise<string | null> {
  const { data, error } = await supabase
    .from("wgo_skater_stats")
    .select("date")
    .order("date", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error fetching most recent date:", error);
    return null;
  }

  return data && data.length > 0 ? data[0].date : null;
}

// I need a function to update all skaters for all dates from most recent to today
async function updateAllSkatersFromMostRecentDate(fullRefresh: boolean = false): Promise<{
  message: string;
  success: boolean;
  totalUpdates: number;
  datesProcessed: string[];
}> {
  let startDate: Date;
  const today = new Date();
  const currentSeason = await getCurrentSeason();
  
  if (fullRefresh) {
    // Start from the beginning of the current season
    startDate = parseISO(currentSeason.regularSeasonStartDate);
    console.log("Full refresh mode: Starting from season start date:", format(startDate, "yyyy-MM-dd"));
  } else {
    // Get the most recent date from the database
    const mostRecentDate = await getMostRecentDateFromDB();
    
    if (mostRecentDate) {
      // Start from the day after the most recent date
      startDate = addDays(parseISO(mostRecentDate), 1);
      console.log("Incremental update: Starting from day after most recent date:", format(startDate, "yyyy-MM-dd"));
    } else {
      // No data in database, start from season start
      startDate = parseISO(currentSeason.regularSeasonStartDate);
      console.log("No existing data found: Starting from season start date:", format(startDate, "yyyy-MM-dd"));
    }
  }

  const endDate = today;
  let totalUpdates = 0;
  const datesProcessed: string[] = [];
  let currentDate = startDate;

  // I won't process future dates
  if (isBefore(endDate, startDate)) {
    return {
      message: "No dates to process - database is already up to date.",
      success: true,
      totalUpdates: 0,
      datesProcessed: []
    };
  }

  console.log(`Processing dates from ${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}`);

  while (isBefore(currentDate, endDate) || currentDate.toDateString() === endDate.toDateString()) {
    const formattedDate = format(currentDate, "yyyy-MM-dd");
    console.log(`Processing skater stats for ${formattedDate}`);

    try {
      const result = await updateSkaterStats(formattedDate);
      totalUpdates += result.totalUpdates;
      datesProcessed.push(formattedDate);
      console.log(`Completed ${formattedDate}: ${result.totalUpdates} updates`);
    } catch (error: any) {
      console.error(`Error processing ${formattedDate}:`, error.message);
      // I'll continue with next date even if one fails
    }

    currentDate = addDays(currentDate, 1);
  }

  return {
    message: `All skater stats updated successfully. Processed ${datesProcessed.length} dates with ${totalUpdates} total updates.`,
    success: true,
    totalUpdates,
    datesProcessed
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const dateParam = req.query.date;
    const playerIdParam = req.query.playerId;
    const actionParam = req.query.action;
    const fullRefreshParam = req.query.fullRefresh;
    
    const date = Array.isArray(dateParam) ? dateParam[0] : dateParam;
    const playerId = Array.isArray(playerIdParam) ? playerIdParam[0] : playerIdParam;
    const action = Array.isArray(actionParam) ? actionParam[0] : actionParam;
    const fullRefresh = fullRefreshParam === 'true' || fullRefreshParam === '1';
    const playerFullName = Array.isArray(req.query.playerFullName)
      ? req.query.playerFullName[0]
      : req.query.playerFullName || "Unknown Player";

    // I'll handle action=all parameter
    if (action === 'all') {
      const result = await updateAllSkatersFromMostRecentDate(fullRefresh);
      return res.json({
        message: result.message,
        success: result.success,
        data: {
          totalUpdates: result.totalUpdates,
          datesProcessed: result.datesProcessed,
          fullRefresh
        },
      });
    }

    // I'll handle specific date
    if (date) {
      const result = await updateSkaterStats(date);
      return res.json({
        message: `Skater stats updated successfully for ${date}.`,
        success: true,
        data: result,
      });
    }
    
    // I'll handle specific player data fetch
    if (playerId && playerFullName) {
      const result = await fetchDataForPlayer(playerId, playerFullName);
      return res.json({
        message: `Data fetched successfully for player ${playerFullName}.`,
        success: true,
        data: result,
      });
    }
    
    // I'll handle season update for specific player
    if (playerId) {
      const result = await updateSkaterStatsForSeason();
      return res.json({
        message: `Skater stats updated successfully for the entire season.`,
        success: true,
        data: result,
      });
    }

    // No valid parameters provided
    return res.status(400).json({
      message: "Missing required parameters. Please provide: 'action=all' for all dates, 'date' for specific date, or 'playerId' with optional 'playerFullName' for player data.",
      success: false,
    });
    
  } catch (e: any) {
    console.error("Handler error:", e);
    return res.status(500).json({
      message: "Failed to process request. Reason: " + e.message,
      success: false,
    });
  }
}
