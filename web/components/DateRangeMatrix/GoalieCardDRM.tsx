///////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:/Users/timbr/OneDrive/Desktop/fhfhockey.com-3/web/components/DateRangeMatrix/GoalieCardDRM.tsx
// @ts-nocheck
import React, { useEffect, useState } from "react";
import styles from "../../styles/LinePairGrid.module.scss";
import supabase from "lib/supabase";
import { getTeamColors } from "components/DateRangeMatrix/utilities";

type GoalieCardProps = {
  name: string;
  firstName: string;
  lastName: string;
  teamId: number;
  playerId: string;
  startDate?: string;
  endDate?: string;
  timeFrame: "L7" | "L14" | "L30" | "Totals";
};

type GoalieStats = {
  record: string;
  save_pct: number;
  goals_against_avg: number;
  saves: number;
  quality_start_pct: number;
  shutouts: number;
  games_started: number;
};

const GoalieCardDRM: React.FC<GoalieCardProps> = ({
  name,
  firstName,
  lastName,
  teamId,
  playerId,
  startDate,
  endDate,
  timeFrame,
}) => {
  const [goalieStats, setGoalieStats] = useState<GoalieStats | null>(null);

  useEffect(() => {
    const fetchGoalieData = async () => {
      if (!startDate || !endDate) {
        console.error("Invalid date range provided:", { startDate, endDate });
        return;
      }

      const { data, error } = await supabase
        .from("wgo_goalie_stats")
        .select(
          `
          games_played,
          games_started,
          wins,
          losses,
          ot_losses,
          saves,
          shots_against,
          goals_against,
          time_on_ice,
          shutouts,
          quality_start
        `
        )
        .eq("goalie_id", playerId)
        .gte("date", startDate) // Filter by start date
        .lte("date", endDate); // Filter by end date

      if (error) {
        console.error("Error fetching goalie data:", error);
        return;
      }

      if (data && data.length > 0) {
        const totalGames = data.reduce(
          (acc, game) => acc + game.games_played,
          0
        );
        const totalGamesStarted = data.reduce(
          (acc, game) => acc + game.games_started,
          0
        );
        const totalWins = data.reduce((acc, game) => acc + game.wins, 0);
        const totalLosses = data.reduce((acc, game) => acc + game.losses, 0);
        const totalOTLosses = data.reduce(
          (acc, game) => acc + game.ot_losses,
          0
        );
        const totalSaves = data.reduce((acc, game) => acc + game.saves, 0);
        const totalGoalsAgainst = data.reduce(
          (acc, game) => acc + game.goals_against,
          0
        );
        const totalTimeOnIce = data.reduce(
          (acc, game) => acc + game.time_on_ice,
          0
        );
        const totalShutouts = data.reduce(
          (acc, game) => acc + game.shutouts,
          0
        );
        const totalQualityStarts = data.reduce(
          (acc, game) => acc + game.quality_start,
          0
        );
        const qualityStartPct = (totalQualityStarts / totalGames) * 100;

        // Correct calculation of save percentage
        const calculatedSavePct =
          totalSaves / data.reduce((acc, game) => acc + game.shots_against, 0);

        // Correct calculation of GAA: (total goals against * 60) / (total time on ice in minutes)
        const calculatedGAA = (totalGoalsAgainst * 60) / (totalTimeOnIce / 60);

        setGoalieStats({
          record: `${totalWins}-${totalLosses}-${totalOTLosses}`,
          save_pct: calculatedSavePct,
          goals_against_avg: calculatedGAA,
          saves: totalSaves,
          quality_start_pct: qualityStartPct,
          shutouts: totalShutouts,
          games_started: totalGamesStarted,
        });
      }
    };

    fetchGoalieData();
  }, [playerId, startDate, endDate, timeFrame]);

  const teamColors = getTeamColors(teamId);

  if (!goalieStats) {
    return <div>Loading...</div>; // Display a loading state while fetching data
  }

  // Ensure the save percentage is displayed as .900 instead of 0.900 and rounded to 3 decimal places
  const formattedSavePct = goalieStats.save_pct.toFixed(3).slice(1);

  return (
    <div
      className={styles.goalieCard}
      style={{
        ["--accent-color" as any]: teamColors.accent,
        ["--secondary-color" as any]: teamColors.secondary,
        ["--primary-color" as any]: teamColors.primary,
        ["--jersey-color" as any]: teamColors.jersey,
      }}
    >
      <div className={styles.goalieCardHeader}>
        <div className={styles.goalieCardName}>
          <span className={styles.firstNameGoalieCard}>{firstName}</span>
          <span className={styles.lastNameGoalieCard}>{lastName}</span>
        </div>
      </div>

      <div className={styles.goalieRecord}>
        <span className={`${styles.line} ${styles.left}`}></span>
        <span>Record: {goalieStats.record}</span>
        <span className={`${styles.line} ${styles.right}`}></span>
      </div>

      <div className={styles.statsGridGoalies}>
        <div className={styles.goalieStat}>
          <span className={styles.goalieStatLabel}>SV%</span>
          <span className={styles.goalieStatValue}>{formattedSavePct}</span>
        </div>
        <div className={styles.goalieStat}>
          <span className={styles.goalieStatLabel}>GAA</span>
          <span className={styles.goalieStatValue}>
            {goalieStats.goals_against_avg.toFixed(2)}
          </span>
        </div>
        <div className={styles.goalieStat}>
          <span className={styles.goalieStatLabel}>SV</span>
          <span className={styles.goalieStatValue}>{goalieStats.saves}</span>
        </div>
        <div className={styles.goalieStat}>
          <span className={styles.goalieStatLabel}>QS%</span>
          <span className={styles.goalieStatValue}>
            {goalieStats.quality_start_pct.toFixed(2)}
          </span>
        </div>
        <div className={styles.goalieStat}>
          <span className={styles.goalieStatLabel}>SO</span>
          <span className={styles.goalieStatValue}>{goalieStats.shutouts}</span>
        </div>
        <div className={styles.goalieStat}>
          <span className={styles.goalieStatLabel}>GS</span>
          <span className={styles.goalieStatValue}>
            {goalieStats.games_started}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GoalieCardDRM;
