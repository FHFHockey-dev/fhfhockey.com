import React, { useMemo } from "react";
import styles from "./PlayerStats.module.scss";
import { SeasonTotals } from "../../pages/stats/player/[playerId]";

interface GameLogEntry {
  date: string;
  [key: string]: any;
}

interface PlayerInfo {
  id: number;
  fullName: string;
  position: string;
}

interface PlayerContextualStatsProps {
  player: PlayerInfo;
  gameLog: GameLogEntry[];
  playoffGameLog: GameLogEntry[];
  seasonTotals: SeasonTotals[];
  isGoalie: boolean;
}

export function PlayerContextualStats({
  player,
  gameLog,
  seasonTotals,
  isGoalie
}: PlayerContextualStatsProps) {
  const insights = useMemo(() => {
    if (gameLog.length === 0) return null;

    const gamesPlayed = gameLog.reduce(
      (sum, game) => sum + (game.games_played || 0),
      0
    );
    const insights = [];

    if (isGoalie) {
      // Goalie-specific insights
      const wins = gameLog.reduce(
        (sum, game) => sum + (Number(game.wins) || 0),
        0
      );
      const saves = gameLog.reduce(
        (sum, game) => sum + (Number(game.saves) || 0),
        0
      );
      const shotsAgainst = gameLog.reduce(
        (sum, game) => sum + (Number(game.shots_against) || 0),
        0
      );
      const shutouts = gameLog.reduce(
        (sum, game) => sum + (Number(game.shutouts) || 0),
        0
      );
      const qualityStarts = gameLog.reduce(
        (sum, game) => sum + (Number(game.quality_start) || 0),
        0
      );

      const savePct = shotsAgainst > 0 ? saves / shotsAgainst : 0;
      const winRate = gamesPlayed > 0 ? wins / gamesPlayed : 0;
      const qsRate = gamesPlayed > 0 ? qualityStarts / gamesPlayed : 0;

      insights.push({
        label: "Win Rate",
        value: `${(winRate * 100).toFixed(1)}%`,
        trend:
          winRate >= 0.6 ? "positive" : winRate >= 0.4 ? "neutral" : "negative",
        description:
          winRate >= 0.6
            ? "Excellent"
            : winRate >= 0.4
              ? "Average"
              : "Below Average"
      });

      insights.push({
        label: "Save Percentage",
        value: savePct.toFixed(3),
        trend:
          savePct >= 0.92
            ? "positive"
            : savePct >= 0.9
              ? "neutral"
              : "negative",
        description:
          savePct >= 0.92
            ? "Elite"
            : savePct >= 0.9
              ? "Average"
              : "Below Average"
      });

      insights.push({
        label: "Quality Start Rate",
        value: `${(qsRate * 100).toFixed(1)}%`,
        trend:
          qsRate >= 0.6 ? "positive" : qsRate >= 0.4 ? "neutral" : "negative",
        description:
          qsRate >= 0.6
            ? "Consistent"
            : qsRate >= 0.4
              ? "Average"
              : "Inconsistent"
      });

      if (shutouts > 0) {
        insights.push({
          label: "Shutouts",
          value: shutouts.toString(),
          trend: "positive",
          description: `${shutouts} shutout${shutouts > 1 ? "s" : ""} this period`
        });
      }
    } else {
      // Skater insights
      const points = gameLog.reduce(
        (sum, game) => sum + (Number(game.points) || 0),
        0
      );
      const goals = gameLog.reduce(
        (sum, game) => sum + (Number(game.goals) || 0),
        0
      );
      const assists = gameLog.reduce(
        (sum, game) => sum + (Number(game.assists) || 0),
        0
      );
      const shots = gameLog.reduce(
        (sum, game) => sum + (Number(game.shots) || 0),
        0
      );
      const ppPoints = gameLog.reduce(
        (sum, game) => sum + (Number(game.pp_points) || 0),
        0
      );

      const pointsPerGame = gamesPlayed > 0 ? points / gamesPlayed : 0;
      const shootingPct = shots > 0 ? (goals / shots) * 100 : 0;
      const ppContribution = points > 0 ? (ppPoints / points) * 100 : 0;

      insights.push({
        label: "Points per Game",
        value: pointsPerGame.toFixed(2),
        trend:
          pointsPerGame >= 1.0
            ? "positive"
            : pointsPerGame >= 0.5
              ? "neutral"
              : "negative",
        description:
          pointsPerGame >= 1.0
            ? "Elite Producer"
            : pointsPerGame >= 0.5
              ? "Solid Contributor"
              : "Depth Player"
      });

      if (shots > 0) {
        insights.push({
          label: "Shooting %",
          value: `${shootingPct.toFixed(1)}%`,
          trend:
            shootingPct >= 15
              ? "positive"
              : shootingPct >= 8
                ? "neutral"
                : "negative",
          description:
            shootingPct >= 15
              ? "Hot Streak"
              : shootingPct >= 8
                ? "Average"
                : "Cold Streak"
        });
      }

      if (ppPoints > 0) {
        insights.push({
          label: "PP Production",
          value: `${ppContribution.toFixed(0)}% of points`,
          trend:
            ppContribution >= 40
              ? "positive"
              : ppContribution >= 20
                ? "neutral"
                : "negative",
          description:
            ppContribution >= 40
              ? "PP Specialist"
              : ppContribution >= 20
                ? "Balanced"
                : "Even Strength"
        });
      }

      // Position-specific insights
      if (player.position === "C") {
        const faceoffData = gameLog.filter(
          (game) => Number(game.total_faceoffs) > 0
        );
        if (faceoffData.length > 0) {
          const totalFaceoffs = faceoffData.reduce(
            (sum, game) => sum + (Number(game.total_faceoffs) || 0),
            0
          );
          const faceoffWins = faceoffData.reduce(
            (sum, game) => sum + (Number(game.total_fow) || 0),
            0
          );
          const faceoffPct =
            totalFaceoffs > 0 ? (faceoffWins / totalFaceoffs) * 100 : 0;

          insights.push({
            label: "Faceoff %",
            value: `${faceoffPct.toFixed(1)}%`,
            trend:
              faceoffPct >= 55
                ? "positive"
                : faceoffPct >= 45
                  ? "neutral"
                  : "negative",
            description:
              faceoffPct >= 55
                ? "Dominant"
                : faceoffPct >= 45
                  ? "Average"
                  : "Struggling"
          });
        }
      }

      if (player.position === "D") {
        const blocks = gameLog.reduce(
          (sum, game) => sum + (Number(game.blocked_shots) || 0),
          0
        );
        const hits = gameLog.reduce(
          (sum, game) => sum + (Number(game.hits) || 0),
          0
        );

        const blocksPerGame = gamesPlayed > 0 ? blocks / gamesPlayed : 0;
        const hitsPerGame = gamesPlayed > 0 ? hits / gamesPlayed : 0;

        insights.push({
          label: "Defensive Impact",
          value: `${blocksPerGame.toFixed(1)} BLK, ${hitsPerGame.toFixed(1)} HIT/game`,
          trend:
            blocksPerGame + hitsPerGame >= 3
              ? "positive"
              : blocksPerGame + hitsPerGame >= 1.5
                ? "neutral"
                : "negative",
          description:
            blocksPerGame + hitsPerGame >= 3
              ? "Physical Presence"
              : "Skill-Based"
        });
      }
    }

    // Recent form analysis
    if (gameLog.length >= 5) {
      const recentGames = gameLog.slice(-5);
      const recentPerformance = isGoalie
        ? recentGames.reduce((sum, game) => sum + (Number(game.wins) || 0), 0) /
          recentGames.length
        : recentGames.reduce(
            (sum, game) => sum + (Number(game.points) || 0),
            0
          ) / recentGames.length;

      const fullPerformance = isGoalie
        ? gameLog.reduce((sum, game) => sum + (Number(game.wins) || 0), 0) /
          gameLog.length
        : gameLog.reduce((sum, game) => sum + (Number(game.points) || 0), 0) /
          gameLog.length;

      const formTrend =
        recentPerformance > fullPerformance * 1.2
          ? "Hot"
          : recentPerformance < fullPerformance * 0.8
            ? "Cold"
            : "Steady";

      const recentValue = isGoalie
        ? `${(recentPerformance * 100).toFixed(1)}% Win Rate`
        : `${recentPerformance.toFixed(2)} PPG`;

      const seasonValue = isGoalie
        ? `${(fullPerformance * 100).toFixed(1)}% Win Rate`
        : `${fullPerformance.toFixed(2)} PPG`;

      insights.push({
        label: "Recent Form",
        value: formTrend,
        trend:
          formTrend === "Hot"
            ? "positive"
            : formTrend === "Cold"
              ? "negative"
              : "neutral",
        description: `L5: ${recentValue} vs Season: ${seasonValue}`
      });
    }

    return insights;
  }, [gameLog, player, isGoalie]);

  const streakAnalysis = useMemo(() => {
    if (gameLog.length === 0) return null;

    // Sort games by date
    const sortedGames = [...gameLog].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (isGoalie) {
      // Win/loss streaks for goalies
      let currentStreak = 0;
      let streakType = "";

      for (let i = sortedGames.length - 1; i >= 0; i--) {
        const game = sortedGames[i];
        const won = Number(game.wins) > 0;

        if (i === sortedGames.length - 1) {
          streakType = won ? "wins" : "losses";
          currentStreak = 1;
        } else {
          const expectedType = streakType === "wins";
          if (won === expectedType) {
            currentStreak++;
          } else {
            break;
          }
        }
      }

      return {
        type: streakType,
        length: currentStreak,
        description: `${currentStreak} ${streakType} in a row`
      };
    } else {
      // Point streaks for skaters
      let currentPointStreak = 0;
      let currentGoalStreak = 0;

      for (let i = sortedGames.length - 1; i >= 0; i--) {
        const game = sortedGames[i];
        const points = Number(game.points) || 0;
        const goals = Number(game.goals) || 0;

        if (points > 0) {
          currentPointStreak++;
        } else if (currentPointStreak === 0) {
          // Still looking for the start of a streak
          continue;
        } else {
          break;
        }

        if (goals > 0) {
          currentGoalStreak++;
        }
      }

      return {
        pointStreak: currentPointStreak,
        goalStreak: currentGoalStreak,
        description:
          currentPointStreak > 0
            ? `${currentPointStreak} GM Point Streak`
            : "No active point streak"
      };
    }
  }, [gameLog, isGoalie]);

  if (!insights) {
    return (
      <div className={styles.contextualContainer}>
        <h3>Performance Insights</h3>
        <div className={styles.noData}>No data available for analysis</div>
      </div>
    );
  }

  return (
    <div className={styles.contextualContainer}>
      <h3>Performance Insights</h3>

      <div className={styles.insightsGrid}>
        {insights.map((insight, index) => (
          <div
            key={index}
            className={`${styles.insightCard} ${styles[insight.trend]}`}
          >
            <div className={styles.insightLabel}>{insight.label}</div>
            <div className={styles.insightValue}>{insight.value}</div>
            <div className={styles.insightDescription}>
              {insight.description}
            </div>
          </div>
        ))}
      </div>

      {streakAnalysis && (
        <div className={styles.streakSection}>
          <h4>Current Streaks</h4>
          <div className={styles.streakCard}>
            {isGoalie ? (
              <div
                className={`${styles.streak} ${streakAnalysis.type === "wins" ? styles.positive : styles.negative}`}
              >
                <span className={styles.streakValue}>
                  {streakAnalysis.length}
                </span>
                <span className={styles.streakLabel}>
                  {streakAnalysis.description}
                </span>
              </div>
            ) : (
              <div className={styles.skaterStreaks}>
                <div
                  className={`${styles.streak} ${(streakAnalysis.pointStreak || 0) > 0 ? styles.positive : styles.neutral}`}
                >
                  <span className={styles.streakValue}>
                    {streakAnalysis.pointStreak || 0} GM
                  </span>
                  <span className={styles.streakLabel}>Point Streak</span>
                </div>
                {(streakAnalysis.goalStreak || 0) > 0 && (
                  <div className={`${styles.streak} ${styles.positive}`}>
                    <span className={styles.streakValue}>
                      {streakAnalysis.goalStreak} GM
                    </span>
                    <span className={styles.streakLabel}>Goal Streak</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className={styles.seasonComparison}>
        <h4>Season Context</h4>
        <div className={styles.comparisonStats}>
          <div className={styles.comparisonItem}>
            <span className={styles.comparisonLabel}>Games Analyzed:</span>
            <span className={styles.comparisonValue}>{gameLog.length}</span>
          </div>
          <div className={styles.comparisonItem}>
            <span className={styles.comparisonLabel}>Position:</span>
            <span className={styles.comparisonValue}>{player.position}</span>
          </div>
          {seasonTotals.length > 0 && (
            <div className={styles.comparisonItem}>
              <span className={styles.comparisonLabel}>Career Seasons:</span>
              <span className={styles.comparisonValue}>
                {seasonTotals.length}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
