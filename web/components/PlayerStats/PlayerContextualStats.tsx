import React, { useMemo } from "react";
import styles from "./PlayerStats.module.scss";

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
  playoffGameLog?: GameLogEntry[]; // Add optional playoff game log
  seasonTotals: any[];
  isGoalie: boolean;
}

export function PlayerContextualStats({
  player,
  gameLog,
  playoffGameLog,
  seasonTotals,
  isGoalie
}: PlayerContextualStatsProps) {
  const insights = useMemo(() => {
    const combinedGameLog =
      playoffGameLog && playoffGameLog.length > 0 ? playoffGameLog : gameLog;

    if (combinedGameLog.length === 0) return null;

    const gamesPlayed = combinedGameLog.reduce(
      (sum, game) => sum + (game.games_played || 0),
      0
    );
    const insights = [];

    if (isGoalie) {
      // Goalie-specific insights
      const wins = combinedGameLog.reduce(
        (sum, game) => sum + (Number(game.wins) || 0),
        0
      );
      const saves = combinedGameLog.reduce(
        (sum, game) => sum + (Number(game.saves) || 0),
        0
      );
      const shotsAgainst = combinedGameLog.reduce(
        (sum, game) => sum + (Number(game.shots_against) || 0),
        0
      );
      const shutouts = combinedGameLog.reduce(
        (sum, game) => sum + (Number(game.shutouts) || 0),
        0
      );
      const qualityStarts = combinedGameLog.reduce(
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
      // Skater insights - Basic stats
      const points = combinedGameLog.reduce(
        (sum, game) => sum + (Number(game.points) || 0),
        0
      );
      const goals = combinedGameLog.reduce(
        (sum, game) => sum + (Number(game.goals) || 0),
        0
      );
      const assists = combinedGameLog.reduce(
        (sum, game) => sum + (Number(game.assists) || 0),
        0
      );
      const shots = combinedGameLog.reduce(
        (sum, game) => sum + (Number(game.shots) || 0),
        0
      );
      const ppPoints = combinedGameLog.reduce(
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

      // NST Advanced Stats - Possession Metrics
      const cfPct =
        combinedGameLog.reduce(
          (sum, game) => sum + (Number(game.cf_pct) || 0),
          0
        ) / combinedGameLog.length;

      const xgfPct =
        combinedGameLog.reduce(
          (sum, game) => sum + (Number(game.xgf_pct) || 0),
          0
        ) / combinedGameLog.length;

      const hdcfPct =
        combinedGameLog.reduce(
          (sum, game) => sum + (Number(game.hdcf_pct) || 0),
          0
        ) / combinedGameLog.length;

      if (cfPct > 0) {
        insights.push({
          label: "Possession Impact",
          value: `${cfPct.toFixed(1)}% CF`,
          trend:
            cfPct >= 52 ? "positive" : cfPct >= 48 ? "neutral" : "negative",
          description:
            cfPct >= 52 ? "Drives Play" : cfPct >= 48 ? "Neutral" : "Struggles"
        });
      }

      if (xgfPct > 0) {
        insights.push({
          label: "Scoring Chance Quality",
          value: `${xgfPct.toFixed(1)}% xGF`,
          trend:
            xgfPct >= 52 ? "positive" : xgfPct >= 48 ? "neutral" : "negative",
          description:
            xgfPct >= 52
              ? "Creates Quality"
              : xgfPct >= 48
                ? "Average"
                : "Limited Quality"
        });
      }

      // NST Advanced Stats - Individual Production Per 60
      const ixgPer60 =
        combinedGameLog.reduce(
          (sum, game) => sum + (Number(game.ixg_per_60) || 0),
          0
        ) / combinedGameLog.length;

      const icfPer60 =
        combinedGameLog.reduce(
          (sum, game) => sum + (Number(game.icf_per_60) || 0),
          0
        ) / combinedGameLog.length;

      if (ixgPer60 > 0) {
        insights.push({
          label: "Expected Goals",
          value: `${ixgPer60.toFixed(1)} ixG/60`,
          trend:
            ixgPer60 >= 2.0
              ? "positive"
              : ixgPer60 >= 1.2
                ? "neutral"
                : "negative",
          description:
            ixgPer60 >= 2.0
              ? "Elite Chances"
              : ixgPer60 >= 1.2
                ? "Average"
                : "Limited Chances"
        });
      }

      // NST Advanced Stats - Zone Usage
      const ozStartPct =
        combinedGameLog.reduce(
          (sum, game) => sum + (Number(game.off_zone_start_pct) || 0),
          0
        ) / combinedGameLog.length;

      if (ozStartPct > 0) {
        const deployment =
          ozStartPct >= 60
            ? "Offensive Role"
            : ozStartPct >= 55
              ? "Balanced Role"
              : ozStartPct >= 45
                ? "Defensive Role"
                : "Shutdown Role";

        insights.push({
          label: "Deployment",
          value: `${ozStartPct.toFixed(1)}% OZ`,
          trend: "neutral", // Deployment is context-dependent
          description: deployment
        });
      }

      // NST Advanced Stats - PDO (Luck indicator)
      const pdo =
        combinedGameLog.reduce(
          (sum, game) => sum + (Number(game.pdo) || 0),
          0
        ) / combinedGameLog.length;

      if (pdo > 0) {
        insights.push({
          label: "PDO (Luck Factor)",
          value: pdo.toFixed(1),
          trend:
            pdo >= 101.5 ? "positive" : pdo >= 98.5 ? "neutral" : "negative",
          description:
            pdo >= 101.5
              ? "Unsustainably High"
              : pdo >= 98.5
                ? "Normal Range"
                : "Unlucky"
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

      // Position-specific insights with NST stats
      if (player.position === "C") {
        const faceoffData = combinedGameLog.filter(
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
        const blocks = combinedGameLog.reduce(
          (sum, game) => sum + (Number(game.blocked_shots) || 0),
          0
        );
        const hits = combinedGameLog.reduce(
          (sum, game) => sum + (Number(game.hits) || 0),
          0
        );

        const blocksPerGame = gamesPlayed > 0 ? blocks / gamesPlayed : 0;
        const hitsPerGame = gamesPlayed > 0 ? hits / gamesPlayed : 0;

        // NST Advanced defensive stats for defensemen
        const hdcaPer60 =
          combinedGameLog.reduce(
            (sum, game) => sum + (Number(game.hdca_per_60) || 0),
            0
          ) / combinedGameLog.length;

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

        if (hdcaPer60 > 0) {
          insights.push({
            label: "High Danger Defense",
            value: `${hdcaPer60.toFixed(1)} HDCA/60`,
            trend:
              hdcaPer60 <= 5.5
                ? "positive"
                : hdcaPer60 <= 7.0
                  ? "neutral"
                  : "negative",
            description:
              hdcaPer60 <= 5.5
                ? "Elite Defense"
                : hdcaPer60 <= 7.0
                  ? "Average"
                  : "Struggles"
          });
        }
      }
    }

    // Recent form analysis
    if (combinedGameLog.length >= 5) {
      const recentGames = combinedGameLog.slice(-5);
      const recentPerformance = isGoalie
        ? recentGames.reduce((sum, game) => sum + (Number(game.wins) || 0), 0) /
          recentGames.length
        : recentGames.reduce(
            (sum, game) => sum + (Number(game.points) || 0),
            0
          ) / recentGames.length;

      const fullPerformance = isGoalie
        ? combinedGameLog.reduce(
            (sum, game) => sum + (Number(game.wins) || 0),
            0
          ) / combinedGameLog.length
        : combinedGameLog.reduce(
            (sum, game) => sum + (Number(game.points) || 0),
            0
          ) / combinedGameLog.length;

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
  }, [gameLog, playoffGameLog, player, isGoalie]);

  const streakAnalysis = useMemo(() => {
    const combinedGameLog =
      playoffGameLog && playoffGameLog.length > 0 ? playoffGameLog : gameLog;

    if (combinedGameLog.length === 0) return null;

    // Sort games by date
    const sortedGames = [...combinedGameLog].sort(
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
  }, [gameLog, playoffGameLog, isGoalie]);

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
