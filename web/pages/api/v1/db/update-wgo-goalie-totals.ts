// C:\Users\timbr\Desktop\FHFH\fhfhockey.com-3\web\pages\api\v1\db\update-wgo-goalie-totals.ts

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import Fetch from "lib/cors-fetch";
import { getCurrentSeason } from "lib/NHL/server";
import { WGOGoalieStat, WGOAdvancedGoalieStat } from "lib/NHL/types";

/**
 * Fetches aggregate goalie data for a given season by querying both the summary and advanced endpoints.
 * Uses batched parallel requests to speed up fetching for a single season.
 *
 * @param seasonId - The season identifier (e.g. "20082009")
 * @param limit - The maximum number of records per request (default is 100)
 * @returns An object containing arrays of goalieStats and advancedGoalieStats.
 */
async function fetchTotalsDataForSeason(
  seasonId: string,
  limit: number
): Promise<{
  goalieStats: WGOGoalieStat[];
  advancedGoalieStats: WGOAdvancedGoalieStat[];
  bioGoalieStats: WGOAdvancedGoalieStat[];
}> {
  let allGoalieStats: WGOGoalieStat[] = [];
  let allAdvancedGoalieStats: WGOAdvancedGoalieStat[] = [];
  let allBioGoalieStats: WGOAdvancedGoalieStat[] = [];
  let start = 0;
  const batchSize = 5; // Number of pages to fetch concurrently
  let keepFetching = true;

  console.log(
    `Starting batched fetch for season ${seasonId} with limit ${limit} per page.`
  );

  while (keepFetching) {
    const batchSummaryPromises = [];
    const batchAdvancedPromises = [];
    const batchBioPromises = [];

    console.log(`Fetching batch starting at index ${start}`);

    // Create a batch of requests
    for (let i = 0; i < batchSize; i++) {
      const pageStart = start + i * limit;
      const summaryUrl = `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=false&isGame=false&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${pageStart}&limit=${limit}&cayenneExp=gameTypeId=2%20and%20seasonId%3C%3D${seasonId}%20and%20seasonId%3E%3D${seasonId}`;
      const advancedUrl = `https://api.nhle.com/stats/rest/en/goalie/advanced?isAggregate=false&isGame=false&sort=%5B%7B%22property%22:%22qualityStart%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsAgainstAverage%22,%22direction%22:%22ASC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${pageStart}&limit=${limit}&cayenneExp=gameTypeId=2%20and%20seasonId%3C%3D${seasonId}%20and%20seasonId%3E%3D${seasonId}`;
      const bioUrl = `https://api.nhle.com/stats/rest/en/goalie/bios?isAggregate=false&isGame=false&sort=%5B%7B%22property%22:%22lastName%22,%22direction%22:%22ASC_CI%22%7D,%7B%22property%22:%22goalieFullName%22,%22direction%22:%22ASC_CI%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${pageStart}&limit=${limit}&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${seasonId}%20and%20seasonId%3E=${seasonId}`;
      batchSummaryPromises.push(Fetch(summaryUrl).then((res) => res.json()));
      batchAdvancedPromises.push(Fetch(advancedUrl).then((res) => res.json()));
      batchBioPromises.push(Fetch(bioUrl).then((res) => res.json()));
    }

    // Await the entire batch concurrently
    const batchSummaryResults = await Promise.all(batchSummaryPromises);
    const batchAdvancedResults = await Promise.all(batchAdvancedPromises);
    const batchBioResults = await Promise.all(batchBioPromises);

    let batchHasData = false;
    for (let i = 0; i < batchSize; i++) {
      const summaryData = batchSummaryResults[i].data as WGOGoalieStat[];
      const advancedData = batchAdvancedResults[i]
        .data as WGOAdvancedGoalieStat[];
      const bioData = batchBioResults[i].data as WGOAdvancedGoalieStat[];

      console.log(
        `Page ${start + i * limit}: Summary returned ${
          summaryData.length
        } records; Advanced returned ${advancedData.length} records.`
      );

      if (
        summaryData.length > 0 ||
        advancedData.length > 0 ||
        bioData.length > 0
      ) {
        batchHasData = true;
      }

      allGoalieStats = allGoalieStats.concat(summaryData);
      allAdvancedGoalieStats = allAdvancedGoalieStats.concat(advancedData);
      allBioGoalieStats = allBioGoalieStats.concat(bioData);

      // If both endpoints return fewer than 'limit' records on any page, assume it's the last page.
      if (
        summaryData.length < limit &&
        advancedData.length < limit &&
        bioData.length < limit
      ) {
        keepFetching = false;
      }
    }

    // If the entire batch returned no data, break out.
    if (!batchHasData) {
      break;
    }
    start += batchSize * limit;
  }

  console.log(
    `Finished fetching. Total summary records: ${allGoalieStats.length}, total advanced records: ${allAdvancedGoalieStats.length}.`
  );

  return {
    goalieStats: allGoalieStats,
    advancedGoalieStats: allAdvancedGoalieStats,
    bioGoalieStats: allBioGoalieStats
  };
}

/**
 * Updates season totals for each goalie by performing a single bulk upsert into the Supabase table.
 *
 * @param seasonId - The season identifier to update totals for.
 * @returns An object with the total number of upsert operations performed.
 */
async function updateGoalieTotals(
  seasonId: string
): Promise<{ totalUpdates: number }> {
  const limit = 100;
  const { goalieStats, advancedGoalieStats, bioGoalieStats } =
    await fetchTotalsDataForSeason(seasonId, limit);

  console.log(
    `Starting bulk upsert for season ${seasonId} with ${goalieStats.length} summary records.`
  );

  // Build an array of combined records
  const records = goalieStats.map((stat) => {
    const advStats = advancedGoalieStats.find(
      (aStat) => aStat.playerId === stat.playerId
    );
    const bioStats = bioGoalieStats.find(
      (bStat) => bStat.playerId === stat.playerId
    );

    return {
      goalie_id: stat.playerId,
      goalie_name: stat.goalieFullName,
      season_id: Number(seasonId),
      shoots_catches: stat.shootsCatches,
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
      team_abbrevs: stat.teamAbbrevs,
      complete_game_pct: advStats?.completeGamePct,
      complete_games: advStats?.completeGames,
      incomplete_games: advStats?.incompleteGames,
      quality_start: advStats?.qualityStart,
      quality_starts_pct: advStats?.qualityStartsPct,
      regulation_losses: advStats?.regulationLosses,
      regulation_wins: advStats?.regulationWins,
      shots_against_per_60: advStats?.shotsAgainstPer60,
      current_team_abbreviation: bioStats?.currentTeamAbbrev,
      updated_at: new Date().toISOString()
    };
  });

  // Perform a bulk upsert in a single request
  const { error } = await supabase
    .from("wgo_goalie_stats_totals")
    .upsert(records);

  if (error) {
    console.error("Bulk upsert error:", error);
    throw error;
  }

  console.log(
    `Bulk upsert completed for season ${seasonId}. Total records upserted: ${records.length}.`
  );
  return { totalUpdates: records.length };
}

/**
 * Fetches the list of all historical seasons from the NHL API.
 *
 * @returns An array of season objects.
 */
async function fetchAllSeasons(): Promise<any[]> {
  const seasonUrl =
    "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22ASC%22%7D%5D";
  const response = await Fetch(seasonUrl).then((res) => res.json());
  console.log(`Fetched ${response.data.length} seasons from NHL API.`);
  return response.data;
}

/**
 * Main API Route handler for updating season totals.
 *
 * This handler will update ONLY the most recent season (based on the season_id in the database).
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = Date.now();

  try {
    // Check for the "season=all" query parameter
    const updateAll = req.query.season?.toString().toLowerCase() === "all";

    if (updateAll) {
      console.log(
        "Query parameter 'season=all' detected. Updating all seasons."
      );
      const currentSeason = await getCurrentSeason();
      const allSeasons = await fetchAllSeasons();
      const validSeasons = allSeasons.filter(
        (season) => Number(season.id) <= Number(currentSeason.seasonId)
      );
      let totalUpdatesOverall = 0;
      for (const season of validSeasons) {
        console.log(`Updating season ${season.id}...`);
        const seasonIdStr = season.id.toString();
        const result = await updateGoalieTotals(seasonIdStr);
        totalUpdatesOverall += result.totalUpdates;
      }
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`Completed update for all seasons in ${durationSec} s.`);
      return res.status(200).json({
        message: `Successfully upserted goalie season totals for seasons: ${validSeasons
          .map((s) => s.id)
          .join(", ")}`,
        success: true,
        data: { totalUpdates: totalUpdatesOverall },
        duration: `${durationSec} s`
      });
    } else {
      // Original behavior: Update only the most recent season if data exists,
      // or update all seasons if there is no existing season data.
      const { data: existingData } = await supabase
        .from("wgo_goalie_stats_totals")
        .select("season_id")
        .order("season_id", { ascending: false })
        .limit(1);
      console.log("Existing season data in table:", existingData);

      if (existingData && existingData.length > 0) {
        const mostRecentSeasonId = Number(existingData[0].season_id);
        console.log(
          "Most recent season determined from table:",
          mostRecentSeasonId
        );

        // Update only the most recent season.
        const result = await updateGoalieTotals(mostRecentSeasonId.toString());
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(
          `Completed update for season ${mostRecentSeasonId} in ${durationSec} s.`
        );
        return res.status(200).json({
          message: `Successfully refreshed (upserted) goalie season totals for season ${mostRecentSeasonId}.`,
          success: true,
          data: result,
          duration: `${durationSec} s`
        });
      } else {
        console.log("No existing season data found. Updating all seasons.");
        const currentSeason = await getCurrentSeason();
        const allSeasons = await fetchAllSeasons();
        const validSeasons = allSeasons.filter(
          (season) => Number(season.id) <= Number(currentSeason.seasonId)
        );
        let totalUpdatesOverall = 0;
        for (const season of validSeasons) {
          console.log(`Updating season ${season.id}...`);
          const seasonIdStr = season.id.toString();
          const result = await updateGoalieTotals(seasonIdStr);
          totalUpdatesOverall += result.totalUpdates;
        }
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`Completed update for all seasons in ${durationSec} s.`);
        return res.status(200).json({
          message: `Successfully upserted goalie season totals for seasons: ${validSeasons
            .map((s) => s.id)
            .join(", ")}`,
          success: true,
          data: { totalUpdates: totalUpdatesOverall },
          duration: `${durationSec} s`
        });
      }
    }
  } catch (e: any) {
    console.error("Update Totals Error:", e.message);
    return res.status(500).json({
      message: "Failed to update goalie season totals. Reason: " + e.message,
      success: false
    });
  }
}

export default withCronJobAudit(handler);
