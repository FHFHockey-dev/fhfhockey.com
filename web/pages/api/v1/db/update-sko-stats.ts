// web\pages\api\v1\db\update-sko-stats.ts

import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import Fetch from "lib/cors-fetch";
import { format, parseISO, addDays, isBefore } from "date-fns";
import { SKOSummarySkaterStat } from "lib/NHL/types";
import { getCurrentSeason } from "lib/NHL/client";

// Fetch skater data from NHL API
async function fetchSkaterStats(
  date: string,
  limit: number
): Promise<SKOSummarySkaterStat[]> {
  let start = 0;
  let moreDataAvailable = true;
  let skaterStats: SKOSummarySkaterStat[] = [];

  while (moreDataAvailable) {
    const summaryUrl = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goals%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22assists%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&cayenneExp=gameDate%3C=%22${date}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${date}%22%20and%20gameTypeId=2`;

    const response = await Fetch(summaryUrl).then((res) => res.json());
    console.log("Fetched skater stats:", response.data);
    skaterStats = skaterStats.concat(response.data as SKOSummarySkaterStat[]);

    moreDataAvailable = response.data.length === limit;
    start += limit;
  }

  return skaterStats;
}

// Upsert skater stats into Supabase
async function upsertSkaterStats(
  date: string,
  stats: SKOSummarySkaterStat[]
): Promise<void> {
  for (const stat of stats) {
    const { error } = await supabase.from("sko_skater_stats").upsert({
      player_id: stat.playerId,
      skater_full_name: stat.skaterFullName,
      team_abbrevs: stat.teamAbbrevs,
      games_played: stat.gamesPlayed,
      goals: stat.goals,
      assists: stat.assists,
      points: stat.points,
      shooting_pct: stat.shootingPct,
      time_on_ice_per_game: stat.timeOnIcePerGame,
      points_per_game: stat.pointsPerGame,
      ev_goals: stat.evGoals,
      ev_points: stat.evPoints,
      pp_goals: stat.ppGoals,
      pp_points: stat.ppPoints,
      shots: stat.shots,
      created_at: new Date(),
    });

    if (error) {
      console.error("Error upserting skater stats:", error);
    }
  }
}

// Fetch and upsert data for the entire season
async function fetchAndUpsertSeasonStats(
  startDate: string,
  endDate: string
): Promise<void> {
  const summaryUrl = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goals%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22assists%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=100&cayenneExp=gameDate%3C=%22${endDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${startDate}%22%20and%20gameTypeId=2`;
  const response = await Fetch(summaryUrl).then((res) => res.json());
  console.log("Fetched season stats:", response.data);
  await upsertSkaterStats(startDate, response.data as SKOSummarySkaterStat[]);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const currentSeason = await getCurrentSeason();
    let startDate = parseISO(currentSeason.regularSeasonStartDate);
    const endDate = parseISO(currentSeason.regularSeasonEndDate);
    const today = new Date();

    // Check if today is before the current season's start date
    if (isBefore(today, startDate)) {
      // Use the previous season's data
      const previousSeasonId =
        (
          parseInt(currentSeason.seasonId.toString().substring(0, 4)) - 1
        ).toString() +
        (
          parseInt(currentSeason.seasonId.toString().substring(4, 8)) - 1
        ).toString();
      const previousSeasonData = await getCurrentSeason(); // Fetch current season data without arguments
      startDate = parseISO(previousSeasonData.regularSeasonStartDate);
    }

    while (isBefore(startDate, endDate) || startDate === endDate) {
      const formattedDate = format(startDate, "yyyy-MM-dd");
      const skaterStats = await fetchSkaterStats(formattedDate, 100);
      await upsertSkaterStats(formattedDate, skaterStats);
      startDate = addDays(startDate, 1);
    }

    // Fetch and upsert season stats
    await fetchAndUpsertSeasonStats(
      format(parseISO(currentSeason.regularSeasonStartDate), "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd")
    );

    res.json({
      message: `Skater stats updated successfully for the season.`,
      success: true,
    });
  } catch (e: any) {
    res.status(500).json({
      message: "Failed to process request. Reason: " + e.message,
      success: false,
    });
  }
}
