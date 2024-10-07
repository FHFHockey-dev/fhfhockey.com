// lib/updateAllGoalies.ts

import { fetchAllGoalies } from "./fetchAllGoalies";
import { fetchDataForPlayer } from "pages/api/v1/db/update-wgo-goalies";
import supabase from "lib/supabase";
import { format, parseISO } from "date-fns";

export async function updateAllGoaliesStats(date: string): Promise<{
  totalUpdates: number;
}> {
  const formattedDate = format(parseISO(date), "yyyy-MM-dd");

  const goalies = await fetchAllGoalies();
  let totalUpdates = 0;

  for (const goalie of goalies) {
    const playerId = goalie.id.toString();
    const goalieFullName = "Unknown Goalie"; // You might want to fetch the actual name

    try {
      const { goalieStats, advancedGoalieStats } = await fetchDataForPlayer(
        playerId,
        goalieFullName
      );

      for (const stat of goalieStats) {
        const advStats = advancedGoalieStats.find(
          (aStat) => aStat.playerId === stat.playerId
        );
        await supabase.from("wgo_goalie_stats").upsert({
          // Mapping fields from fetched data to Supabase table columns
          goalie_id: stat.playerId,
          goalie_name: stat.goalieFullName,
          date: formattedDate,
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
          // Advanced stats from advancedGoalieStatsResponse (advStats)
          complete_game_pct: advStats?.completeGamePct,
          complete_games: advStats?.completeGames,
          incomplete_games: advStats?.incompleteGames,
          quality_start: advStats?.qualityStart,
          quality_starts_pct: advStats?.qualityStartsPct,
          regulation_losses: advStats?.regulationLosses,
          regulation_wins: advStats?.regulationWins,
          shots_against_per_60: advStats?.shotsAgainstPer60,
        });
        totalUpdates += 1;
      }

      console.log(`Successfully updated stats for goalie ID: ${playerId}`);
    } catch (error: any) {
      console.error(
        `Failed to update stats for goalie ID: ${playerId}. Reason: ${error.message}`
      );
    }
  }

  return { totalUpdates };
}
