import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import Fetch from "lib/cors-fetch";
import { format, parseISO, addDays, isBefore } from "date-fns";
import { getCurrentSeason } from "lib/NHL/client";
import { SKOSummarySkaterStat } from "lib/NHL/types";

interface SKOApiResponse {
  data: SKOSummarySkaterStat[];
}

// Fetch all skater data for a specific date with a limit on the number of records
async function fetchAllDataForDate(
  formattedDate: string,
  limit: number
): Promise<{ skaterStats: SKOSummarySkaterStat[] }> {
  let start = 0;
  let moreDataAvailable = true;
  let skaterStats: SKOSummarySkaterStat[] = [];

  while (moreDataAvailable) {
    const skaterSummaryUrl = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goals%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22assists%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;

    const [skaterSummaryResponse] = await Promise.all([
      Fetch(skaterSummaryUrl).then((res) =>
        res.json()
      ) as Promise<SKOApiResponse>,
    ]);

    skaterStats = skaterStats.concat(
      skaterSummaryResponse.data as SKOSummarySkaterStat[]
    );

    moreDataAvailable = skaterSummaryResponse.data.length === limit;
    start += limit;
  }

  return {
    skaterStats,
  };
}

// Function to update the skater stats in the database for a specific date
async function updateSkaterStatsInDatabase(date: string): Promise<{
  updated: boolean;
  skaterStats: SKOSummarySkaterStat[];
}> {
  const formattedDate = format(parseISO(date), "yyyy-MM-dd");
  const { skaterStats } = await fetchAllDataForDate(formattedDate, 100);

  for (const stat of skaterStats) {
    const mergedData = {
      player_id: stat.playerId,
      skater_full_name: stat.skaterFullName,
      team_abbrevs: stat.teamAbbrevs,
      game_date: formattedDate,
      games_played: stat.gamesPlayed,
      goals: stat.goals,
      assists: stat.assists,
      points: stat.points,
      shots: stat.shots,
      time_on_ice: stat.timeOnIcePerGame,
      created_at: new Date(),
    };

    await supabase.from("sko_skaters_gamelog").upsert(mergedData);
  }

  return {
    updated: true,
    skaterStats,
  };
}

// Function to update the skater stats for the entire season
async function updateSkaterStatsForSeason() {
  const currentSeason = await getCurrentSeason();
  let currentDate = parseISO(currentSeason.regularSeasonStartDate);
  const endDate = parseISO(currentSeason.regularSeasonEndDate);
  let totalUpdates = 0; // total number of updates

  while (isBefore(currentDate, endDate)) {
    const formattedDate = format(currentDate, "yyyy-MM-dd");
    console.log(`Updating skater stats for ${formattedDate}`);

    const result = await updateSkaterStatsInDatabase(formattedDate);
    totalUpdates += result.skaterStats.length;

    currentDate = addDays(currentDate, 1);
  }

  return {
    message: "Skater Stats Updated",
    success: true,
    totalUpdates,
  };
}

// Fetch skater data for a specific player
async function fetchDataForPlayer(
  playerId: number,
  playerName: string
): Promise<{
  skaterStats: SKOSummarySkaterStat[];
}> {
  let start = 0;
  let moreDataAvailable = true;
  let skaterStats: SKOSummarySkaterStat[] = [];

  while (moreDataAvailable) {
    const encodedPlayerName = encodeURIComponent(`%${playerName}%`);
    const today = new Date();
    const formattedDate = format(today, "yyyy-MM-dd");
    const regularSeasonStartDate = format(
      parseISO((await getCurrentSeason()).regularSeasonStartDate),
      "yyyy-MM-dd"
    );
    const skaterStatsURL = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goals%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22assists%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${regularSeasonStartDate}%22%20and%20gameTypeId=2%20and%20skaterFullName%20likeIgnoreCase%20%22${encodedPlayerName}%22`;

    const [skaterStatsResponse] = await Promise.all([
      Fetch(skaterStatsURL).then((res) =>
        res.json()
      ) as Promise<SKOApiResponse>,
    ]);

    skaterStats = skaterStats.concat(
      skaterStatsResponse.data as SKOSummarySkaterStat[]
    );

    moreDataAvailable = skaterStatsResponse.data.length === 100;
    start += 100;
  }
  return {
    skaterStats,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const dateParam = req.query.date;
    const playerIdParam = req.query.playerId;
    const date = Array.isArray(dateParam) ? dateParam[0] : dateParam;
    const playerId = Array.isArray(playerIdParam)
      ? playerIdParam[0]
      : playerIdParam;
    const playerFullName = Array.isArray(req.query.playerFullName)
      ? req.query.playerFullName[0]
      : req.query.playerFullName || "Unknown Player";

    if (date) {
      const result = await updateSkaterStatsInDatabase(date);
      res.json({
        message: "Skater Stats Updated",
        success: true,
        updated: result.updated,
      });
    } else if (playerId && playerFullName) {
      const result = await fetchDataForPlayer(Number(playerId), playerFullName);
      res.json({
        message: "Player Stats Fetched",
        success: true,
        skaterStats: result.skaterStats,
      });
    } else {
      const result = await updateSkaterStatsForSeason();
      res.json({
        message: "Skater Stats Updated",
        success: true,
        data: result,
      });
    }
  } catch (e: any) {
    console.error(e);
    res.status(500).json({
      message: "Internal Server Error",
      success: false,
    });
  }
}
