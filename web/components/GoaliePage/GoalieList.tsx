// web/components/GoaliePage/GoalieList.tsx
import React, { useEffect, useState, useMemo, FC } from "react";
import GoalieTable from "./GoalieTable"; // Assuming GoalieTable displays game/week stats
import styles from "styles/Goalies.module.scss";
import { format } from "date-fns";
import {
  ApiGoalieData, // Raw game data from API
  Week,
  NumericGoalieStatKey,
  StatColumn,
  GoalieAverages,
  Ranking,
  GoalieGameStat // Use game stat type
} from "components/GoaliePage/goalieTypes";
import {
  calculateAverages, // For calculating averages *within this week*
  calculateRanking, // For ranking games *within this week*
  statMap // Needed? Maybe not directly here if GoalieTable handles comparison classes
} from "./goalieCalculations"; // Import shared functions

// Type for goalies ranked *within* this specific week's games
interface GoalieGameRank extends GoalieGameStat {
  // Based on GameStat now
  percentage: number; // % of selected stats >= weekly average
  ranking: Ranking; // Rank based on weekly average comparison
  // These might not be relevant for single week display, but keep for consistency?
  // percentAcceptableWeeks: number; // Always 100 or 0 for a single game/week view
  // percentGoodWeeks: number; // Always 100 or 0
}

interface Props {
  weekGameData: ApiGoalieData[]; // Changed prop name to reflect game data
  week: Week; // The specific week interval
  selectedStats: NumericGoalieStatKey[];
  statColumns: StatColumn[]; // Pass STAT_COLUMNS for consistency
  setView: React.Dispatch<React.SetStateAction<"leaderboard" | "week">>;
}

const GoalieList: FC<Props> = ({
  weekGameData,
  week,
  selectedStats,
  statColumns,
  setView
}) => {
  // State holds the processed & ranked GAME data for the table
  const [rankedGames, setRankedGames] = useState<GoalieGameRank[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!weekGameData) {
      setIsLoading(false);
      setRankedGames([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      if (weekGameData.length === 0) {
        setRankedGames([]);
        setIsLoading(false);
        return;
      }

      // Calculate averages based ONLY on the games played THIS week
      const weeklyGameAverages = calculateAverages(weekGameData);

      // Rank each GAME played this week against the weekly average
      const gamesWithRanking: GoalieGameRank[] = weekGameData.map((game) => {
        // Ensure derived stats are calculated for ranking if not present
        const gameForRanking: GoalieGameStat = {
          ...game,
          savePct:
            game.savePct ?? calculateSavePct(game.saves, game.shotsAgainst),
          goalsAgainstAverage:
            game.goalsAgainstAverage ??
            calculateGAA(game.goalsAgainst, game.timeOnIce),
          // Calculate per 60 if needed by selectedStats
          savesPer60: calculatePer60(game.saves, game.timeOnIce),
          shotsAgainstPer60: calculatePer60(game.shotsAgainst, game.timeOnIce),
          // weekLabel isn't strictly needed here but keep for type consistency
          weekLabel: "SingleWeek"
        };

        const { points, ranking } = calculateRanking(
          // Use points for sorting?
          gameForRanking,
          weeklyGameAverages,
          selectedStats
        );
        // Calculate percentage based on points/ranking thresholds? Or keep old logic?
        // Let's recalculate percentage from scratch based on comparison
        let betterStats = 0;
        selectedStats.forEach((stat) => {
          const comparisonType = statMap[stat];
          let value: number | undefined;
          if (stat === "savesPer60") value = gameForRanking.savesPer60;
          else if (stat === "shotsAgainstPer60")
            value = gameForRanking.shotsAgainstPer60;
          else if (stat === "savePct") value = gameForRanking.savePct;
          else if (stat === "goalsAgainstAverage")
            value = gameForRanking.goalsAgainstAverage;
          else value = gameForRanking[stat];

          const averageValueStr = weeklyGameAverages[stat];
          const averageValue =
            averageValueStr !== undefined ? parseFloat(averageValueStr) : NaN;

          if (value === undefined || isNaN(value) || isNaN(averageValue))
            return;
          if (comparisonType === "larger" && value >= averageValue)
            betterStats++;
          else if (comparisonType === "smaller" && value <= averageValue)
            betterStats++;
        });
        const percentage =
          selectedStats.length > 0
            ? (betterStats / selectedStats.length) * 100
            : 0;

        return {
          ...gameForRanking, // Spread the potentially augmented game data
          percentage: percentage, // Use the calculated percentage
          ranking: ranking
        };
      });

      // Sort games, e.g., by ranking points (desc) then name (asc)
      // Note: calculateRanking returns points now
      // gamesWithRanking.sort((a, b) => {
      //     const rankDiff = rankingPoints[b.ranking] - rankingPoints[a.ranking];
      //     if (rankDiff !== 0) return rankDiff;
      //     return a.goalieFullName.localeCompare(b.goalieFullName);
      // });
      // Or sort by percentage > AVG
      gamesWithRanking.sort((a, b) => b.percentage - a.percentage);

      setRankedGames(gamesWithRanking);
    } catch (err: any) {
      console.error("Error processing goalie game data for the week:", err);
      setError("Failed to process goalie rankings for the week.");
      setRankedGames([]);
    } finally {
      setIsLoading(false);
    }
    // Add calculateSavePct, calculateGAA, calculatePer60 to deps if defined outside useEffect
  }, [weekGameData, selectedStats]); // Dependencies

  // Format week dates for display (unchanged)
  const { startDate, endDate } = useMemo(() => {
    if (!week || !week.start || !week.end)
      return { startDate: "N/A", endDate: "N/A" };
    // ... (rest of formatting logic is fine)
    const startDt =
      week.start instanceof Date ? week.start : new Date(week.start);
    const endDt = week.end instanceof Date ? week.end : new Date(week.end);
    return {
      startDate: !isNaN(startDt.getTime())
        ? format(startDt, "MM/dd/yyyy")
        : "Invalid Date",
      endDate: !isNaN(endDt.getTime())
        ? format(endDt, "MM/dd/yyyy")
        : "Invalid Date"
    };
  }, [week]);

  if (isLoading) return <p>Calculating weekly game rankings...</p>;
  if (error) return <p className={styles.errorText}>{error}</p>;
  if (rankedGames.length === 0)
    return <p>No goalie game data found for this week.</p>;

  return (
    <div className={styles.tableContainer}>
      {/* Pass ranked GAME data to GoalieTable */}
      <GoalieTable
        goalies={rankedGames} // Pass ranked games
        averages={calculateAverages(rankedGames)} // Pass calculated averages for this week's games
        selectedStats={selectedStats}
        statColumns={statColumns}
        setView={setView} // Pass view setter for Back button
        startDate={startDate}
        endDate={endDate}
        isSingleWeek={true} // Indicate single week context
      />
    </div>
  );
};

// Add helpers if not imported
const calculateSavePct = (saves: number, shotsAgainst: number): number => {
  return shotsAgainst > 0 ? saves / shotsAgainst : 0;
};
const calculateGAA = (goalsAgainst: number, timeOnIce: number): number => {
  return timeOnIce > 0 ? (goalsAgainst * 60) / timeOnIce : 0;
};
const calculatePer60 = (stat: number, timeOnIce: number): number => {
  return timeOnIce > 0 ? (stat * 60) / timeOnIce : 0;
};

export default GoalieList;
