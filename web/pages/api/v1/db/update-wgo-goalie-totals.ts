// C:\Users\timbr\Desktop\FHFH\fhfhockey.com-3\web\pages\api\v1\db\update-wgo-goalie-totals.ts

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import adminOnly from "utils/adminOnlyMiddleware";
import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import { getCurrentSeason } from "lib/NHL/server";
import {
  WGOGoalieBio,
  WGOGoalieStat,
  WGOAdvancedGoalieStat,
} from "lib/NHL/types";
import pLimit from "p-limit";
import {
  fetchAllWgoStatsPages,
  mapWgoRowsByPlayerId,
  parseWgoSeasonId,
} from "lib/cron/wgoIngestion";

// Query parameters:
// - no season or season=current: refresh the current season
// - season=YYYYYYYY: refresh one validated season
// - season=all: refresh every known season through the current season

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
  limit: number,
): Promise<{
  goalieStats: WGOGoalieStat[];
  advancedGoalieStats: WGOAdvancedGoalieStat[];
  bioGoalieStats: WGOGoalieBio[];
}> {
  console.log(
    `Starting aggregate goalie totals fetch for season ${seasonId}.`,
  );
  const seasonFilter = `gameTypeId=2 and seasonId=${seasonId}`;
  const fetchPages = <T>(report: string, label: string, factFilter = true) =>
    fetchAllWgoStatsPages<T>({
      buildUrl: (start) => {
        const params = new URLSearchParams({
          cayenneExp: seasonFilter,
          isAggregate: report === "bios" ? "false" : "true",
          isGame: "false",
          limit: String(limit),
          sort: '[{"property":"playerId","direction":"ASC"}]',
          start: String(start),
        });
        if (factFilter) {
          params.set("factCayenneExp", "gamesPlayed>0");
        }
        return `https://api.nhle.com/stats/rest/en/goalie/${report}?${params}`;
      },
      concurrency: 3,
      label,
      pageSize: limit,
    });

  const [allGoalieStats, allAdvancedGoalieStats, allBioGoalieStats] =
    await Promise.all([
      fetchPages<WGOGoalieStat>("summary", "goalie totals summary"),
      fetchPages<WGOAdvancedGoalieStat>("advanced", "goalie totals advanced"),
      fetchPages<WGOGoalieBio>("bios", "goalie totals bios", false),
    ]);

  console.log(
    `Finished fetching. Total summary records: ${allGoalieStats.length}, total advanced records: ${allAdvancedGoalieStats.length}.`,
  );

  return {
    goalieStats: allGoalieStats,
    advancedGoalieStats: allAdvancedGoalieStats,
    bioGoalieStats: allBioGoalieStats,
  };
}

/**
 * Updates season totals for each goalie by performing a single bulk upsert into the Supabase table.
 *
 * @param seasonId - The season identifier to update totals for.
 * @returns An object with the total number of upsert operations performed.
 */
async function updateGoalieTotals(
  seasonId: string,
): Promise<{ totalUpdates: number }> {
  const limit = 100;
  const { goalieStats, advancedGoalieStats, bioGoalieStats } =
    await fetchTotalsDataForSeason(seasonId, limit);

  console.log(
    `Starting bulk upsert for season ${seasonId} with ${goalieStats.length} summary records.`,
  );

  mapWgoRowsByPlayerId(goalieStats, "goalie totals summary");
  const advancedGoalieStatsByPlayer = mapWgoRowsByPlayerId(
    advancedGoalieStats,
    "goalie totals advanced",
  );
  const bioGoalieStatsByPlayer = mapWgoRowsByPlayerId(
    bioGoalieStats,
    "goalie totals bios",
  );

  // Build an array of combined records
  const records = goalieStats.map((stat) => {
    const advStats = advancedGoalieStatsByPlayer.get(stat.playerId);
    const bioStats = bioGoalieStatsByPlayer.get(stat.playerId);

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
      team_abbrevs: stat.teamAbbrevs ?? bioStats?.currentTeamAbbrev,
      complete_game_pct: advStats?.completeGamePct,
      complete_games: advStats?.completeGames,
      incomplete_games: advStats?.incompleteGames,
      quality_start: advStats?.qualityStart,
      quality_starts_pct: advStats?.qualityStartsPct,
      regulation_losses: advStats?.regulationLosses,
      regulation_wins: advStats?.regulationWins,
      shots_against_per_60: advStats?.shotsAgainstPer60,
      current_team_abbreviation: bioStats?.currentTeamAbbrev,
      updated_at: new Date().toISOString(),
    };
  });

  const chunkSize = 500;
  for (let index = 0; index < records.length; index += chunkSize) {
    const { error } = await supabase
      .from("wgo_goalie_stats_totals")
      .upsert(records.slice(index, index + chunkSize), {
        onConflict: "goalie_id,season_id",
      });
    if (error) {
      throw new Error(`Goalie totals upsert failed: ${error.message}`);
    }
  }

  console.log(
    `Bulk upsert completed for season ${seasonId}. Total records upserted: ${records.length}.`,
  );
  return { totalUpdates: records.length };
}

async function updateGoalieTotalsForSeasons(
  seasons: { id: number | string }[],
  concurrency: number = 2,
): Promise<number> {
  const limit = pLimit(concurrency);
  const results = await Promise.all(
    seasons.map((season) =>
      limit(async () => {
        console.log(`Updating season ${season.id}...`);
        return updateGoalieTotals(season.id.toString());
      }),
    ),
  );

  return results.reduce((sum, result) => sum + result.totalUpdates, 0);
}

async function fetchAllSeasons(): Promise<{ id: number }[]> {
  const { data, error } = await supabase
    .from("seasons")
    .select("id")
    .order("id", { ascending: true });
  if (error) {
    throw new Error(
      `Could not fetch seasons from the database: ${error.message}`,
    );
  }
  return (data ?? []).map((season) => ({ id: Number(season.id) }));
}

/**
 * Main API Route handler for updating season totals.
 *
 * This handler will update ONLY the most recent season (based on the season_id in the database).
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startTime = Date.now();

  try {
    const rawSeason = Array.isArray(req.query.season)
      ? req.query.season[0]
      : req.query.season;
    const seasonParam = rawSeason?.toLowerCase();
    const updateAll = seasonParam === "all";
    const currentSeason = await getCurrentSeason();
    const allSeasons = await fetchAllSeasons();
    const validSeasons = allSeasons.filter(
      (season) => Number(season.id) <= Number(currentSeason.seasonId),
    );

    if (updateAll) {
      console.log(
        "Query parameter 'season=all' detected. Updating all seasons.",
      );
      const totalUpdatesOverall =
        await updateGoalieTotalsForSeasons(validSeasons);
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`Completed update for all seasons in ${durationSec} s.`);
      return res.status(200).json({
        message: `Successfully upserted goalie season totals for seasons: ${validSeasons
          .map((s) => s.id)
          .join(", ")}`,
        success: true,
        data: { totalUpdates: totalUpdatesOverall },
        duration: `${durationSec} s`,
      });
    } else {
      const requestedSeason =
        !seasonParam || seasonParam === "current"
          ? Number(currentSeason.seasonId)
          : parseWgoSeasonId(seasonParam);
      if (!requestedSeason) {
        return res.status(400).json({
          message:
            "Invalid season. Use current, all, or a consecutive YYYYyyyy season ID.",
          success: false,
        });
      }
      if (!validSeasons.some((season) => season.id === requestedSeason)) {
        return res.status(400).json({
          message: `Season ${requestedSeason} was not found in the seasons table.`,
          success: false,
        });
      }
      const result = await updateGoalieTotals(String(requestedSeason));
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
      return res.status(200).json({
        message: `Successfully refreshed goalie season totals for ${requestedSeason}.`,
        success: true,
        data: result,
        duration: `${durationSec} s`,
      });
    }
  } catch (e: any) {
    console.error("Update Totals Error:", e.message);
    return res.status(500).json({
      message: "Failed to update goalie season totals. Reason: " + e.message,
      success: false,
    });
  }
}

export default withCronJobAudit(adminOnly(handler as any));
