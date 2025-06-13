import React, { useMemo } from "react";
import styles from "./PlayerStats.module.scss";
import { SeasonTotals, MissedGame } from "./types";
import { useMissedGames } from "hooks/useMissedGames";

interface GameLogEntry {
  date: string;
  [key: string]: any;
}

interface PlayerInfo {
  id: number;
  fullName: string;
  position: string;
  team_id?: number;
}

interface PlayerContextualStatsProps {
  player: PlayerInfo;
  gameLog: GameLogEntry[];
  playoffGameLog: GameLogEntry[];
  seasonTotals: SeasonTotals[];
  isGoalie: boolean;
  playerId?: number;
  seasonId?: string | number | null;
  missedGames?: MissedGame[]; // Add missing prop
}

export function PlayerContextualStats({
  player,
  gameLog,
  playoffGameLog,
  seasonTotals,
  isGoalie,
  playerId,
  seasonId,
  missedGames = [] // Accept missed games from props (server-side data)
}: PlayerContextualStatsProps) {
  // Use server-side missed games data instead of client-side hook
  // Still keep the hook for backward compatibility but prioritize props
  const {
    missedGames: hookMissedGames,
    isLoading: missedGamesLoading,
    error: missedGamesError
  } = useMissedGames(
    playerId || player.id,
    player.team_id,
    seasonId,
    gameLog,
    playoffGameLog || []
  );

  // Use server-side data if available, otherwise fall back to hook
  const activeMissedGames =
    missedGames.length > 0 ? missedGames : hookMissedGames;

  console.log("[PlayerContextualStats] Missed games debug:", {
    source: missedGames.length > 0 ? "server-side" : "client-hook",
    propsCount: missedGames.length,
    hookCount: hookMissedGames.length,
    activeCount: activeMissedGames.length,
    loading: missedGamesLoading,
    error: missedGamesError
  });

  const insights = useMemo(() => {
    if (gameLog.length === 0 && playoffGameLog.length === 0) return null;

    // Combine regular season and playoff games for comprehensive analysis
    const allGames = [...gameLog, ...playoffGameLog];
    const regularSeasonGames = gameLog.length;
    const playoffGames = playoffGameLog.length;

    const gamesPlayed = allGames.reduce(
      (sum, game) => sum + (game.games_played || 0),
      0
    );
    const insights = [];

    // Enhanced availability calculation using missed games data
    const regularSeasonGamesPlayed = gameLog.reduce(
      (sum, game) => sum + (game.games_played || 0),
      0
    );

    // Count only regular season missed games for availability calculation
    const regularSeasonMissedGames = activeMissedGames.filter(
      (mg) => !mg.isPlayoff
    ).length;

    // Total possible regular season games = games played + missed games
    const totalPossibleRegularSeasonGames =
      regularSeasonGamesPlayed + regularSeasonMissedGames;

    // Calculate availability percentage based on actual possible games
    const availabilityPercentage =
      totalPossibleRegularSeasonGames > 0
        ? (regularSeasonGamesPlayed / totalPossibleRegularSeasonGames) * 100
        : regularSeasonGamesPlayed > 0
          ? (regularSeasonGamesPlayed / 82) * 100 // Fallback to standard 82-game season
          : 0;

    // Enhanced availability insight with missed games context
    insights.push({
      label: "Availability",
      value: `${availabilityPercentage.toFixed(1)}%`,
      trend:
        availabilityPercentage >= 90
          ? "positive"
          : availabilityPercentage >= 75
            ? "neutral"
            : "negative",
      description:
        totalPossibleRegularSeasonGames > 0
          ? `${regularSeasonGamesPlayed} of ${totalPossibleRegularSeasonGames} possible games${regularSeasonMissedGames > 0 ? ` (${regularSeasonMissedGames} missed)` : ""}`
          : `${regularSeasonGamesPlayed} games played (missed games data unavailable)`
    });

    if (isGoalie) {
      // Goalie-specific insights with playoff data
      const wins = allGames.reduce(
        (sum, game) => sum + (Number(game.wins) || 0),
        0
      );
      const saves = allGames.reduce(
        (sum, game) => sum + (Number(game.saves) || 0),
        0
      );
      const shotsAgainst = allGames.reduce(
        (sum, game) => sum + (Number(game.shots_against) || 0),
        0
      );
      const shutouts = allGames.reduce(
        (sum, game) => sum + (Number(game.shutouts) || 0),
        0
      );
      const qualityStarts = allGames.reduce(
        (sum, game) => sum + (Number(game.quality_start) || 0),
        0
      );

      // Separate playoff performance
      const playoffWins = playoffGameLog.reduce(
        (sum, game) => sum + (Number(game.wins) || 0),
        0
      );
      const playoffSaves = playoffGameLog.reduce(
        (sum, game) => sum + (Number(game.saves) || 0),
        0
      );
      const playoffShotsAgainst = playoffGameLog.reduce(
        (sum, game) => sum + (Number(game.shots_against) || 0),
        0
      );

      const savePct = shotsAgainst > 0 ? saves / shotsAgainst : 0;
      const winRate = gamesPlayed > 0 ? wins / gamesPlayed : 0;
      const qsRate = gamesPlayed > 0 ? qualityStarts / gamesPlayed : 0;
      const playoffSavePct =
        playoffShotsAgainst > 0 ? playoffSaves / playoffShotsAgainst : 0;

      insights.push({
        label: "Overall Win Rate",
        value: `${(winRate * 100).toFixed(1)}%`,
        trend:
          winRate >= 0.6 ? "positive" : winRate >= 0.4 ? "neutral" : "negative",
        description:
          winRate >= 0.6
            ? "Excellent across all games"
            : winRate >= 0.4
              ? "Average performance"
              : "Below average"
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
            ? "Elite level"
            : savePct >= 0.9
              ? "Solid performance"
              : "Needs improvement"
      });

      if (playoffGames > 0) {
        insights.push({
          label: "Playoff Performance",
          value: `${playoffWins}W in ${playoffGames}GP`,
          trend:
            playoffSavePct >= 0.92
              ? "positive"
              : playoffSavePct >= 0.9
                ? "neutral"
                : "negative",
          description: `${playoffSavePct.toFixed(3)} SV% in playoffs`
        });
      }

      insights.push({
        label: "Quality Start Rate",
        value: `${(qsRate * 100).toFixed(1)}%`,
        trend:
          qsRate >= 0.6 ? "positive" : qsRate >= 0.4 ? "neutral" : "negative",
        description:
          qsRate >= 0.6
            ? "Very consistent"
            : qsRate >= 0.4
              ? "Reasonably consistent"
              : "Inconsistent starts"
      });

      if (shutouts > 0) {
        insights.push({
          label: "Shutouts",
          value: shutouts.toString(),
          trend: "positive",
          description: `${shutouts} shutout${shutouts > 1 ? "s" : ""} across all games`
        });
      }
    } else {
      // Skater insights with playoff data
      const points = allGames.reduce(
        (sum, game) => sum + (Number(game.points) || 0),
        0
      );
      const goals = allGames.reduce(
        (sum, game) => sum + (Number(game.goals) || 0),
        0
      );
      const assists = allGames.reduce(
        (sum, game) => sum + (Number(game.assists) || 0),
        0
      );
      const shots = allGames.reduce(
        (sum, game) => sum + (Number(game.shots) || 0),
        0
      );
      const ppPoints = allGames.reduce(
        (sum, game) => sum + (Number(game.pp_points) || 0),
        0
      );

      // Separate playoff performance
      const playoffPoints = playoffGameLog.reduce(
        (sum, game) => sum + (Number(game.points) || 0),
        0
      );
      const playoffGoals = playoffGameLog.reduce(
        (sum, game) => sum + (Number(game.goals) || 0),
        0
      );

      const pointsPerGame = gamesPlayed > 0 ? points / gamesPlayed : 0;
      const shootingPct = shots > 0 ? (goals / shots) * 100 : 0;
      const ppContribution = points > 0 ? (ppPoints / points) * 100 : 0;
      const playoffPPG = playoffGames > 0 ? playoffPoints / playoffGames : 0;

      insights.push({
        label: "Overall Points/Game",
        value: pointsPerGame.toFixed(2),
        trend:
          pointsPerGame >= 1.0
            ? "positive"
            : pointsPerGame >= 0.5
              ? "neutral"
              : "negative",
        description:
          pointsPerGame >= 1.0
            ? "Elite offensive producer"
            : pointsPerGame >= 0.5
              ? "Solid contributor"
              : "Depth/role player"
      });

      if (playoffGames > 0) {
        insights.push({
          label: "Playoff Production",
          value: `${playoffPPG.toFixed(2)} PPG`,
          trend:
            playoffPPG > pointsPerGame * 1.1
              ? "positive"
              : playoffPPG < pointsPerGame * 0.8
                ? "negative"
                : "neutral",
          description: `${playoffPoints}pts in ${playoffGames} playoff games`
        });
      }

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
              ? "Hot shooting streak"
              : shootingPct >= 8
                ? "League average"
                : "Due for positive regression"
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
              ? "PP specialist"
              : ppContribution >= 20
                ? "Balanced scoring"
                : "Even strength focus"
        });
      }

      // Position-specific insights
      if (player.position === "C") {
        const faceoffData = allGames.filter(
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
                ? "Dominant in dot"
                : faceoffPct >= 45
                  ? "Average faceoff ability"
                  : "Struggles in faceoffs"
          });
        }
      }

      if (player.position === "D") {
        const blocks = allGames.reduce(
          (sum, game) => sum + (Number(game.blocked_shots) || 0),
          0
        );
        const hits = allGames.reduce(
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
              ? "Strong physical presence"
              : "Skill-based defenseman"
        });
      }
    }

    // Enhanced recent form analysis including playoff context
    if (allGames.length >= 5) {
      const recentGames = allGames.slice(-5);
      const recentPerformance = isGoalie
        ? recentGames.reduce((sum, game) => sum + (Number(game.wins) || 0), 0) /
          recentGames.length
        : recentGames.reduce(
            (sum, game) => sum + (Number(game.points) || 0),
            0
          ) / recentGames.length;

      const fullPerformance = isGoalie
        ? allGames.reduce((sum, game) => sum + (Number(game.wins) || 0), 0) /
          allGames.length
        : allGames.reduce((sum, game) => sum + (Number(game.points) || 0), 0) /
          allGames.length;

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
        description: `L5: ${recentValue} vs Overall: ${seasonValue}`
      });
    }

    return insights;
  }, [gameLog, playoffGameLog, player, isGoalie, activeMissedGames]);

  const streakAnalysis = useMemo(() => {
    if (gameLog.length === 0 && playoffGameLog.length === 0) return null;

    // Combine and sort all games by date for proper streak analysis
    const allGames = [...gameLog, ...playoffGameLog].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (isGoalie) {
      // Win/loss streaks for goalies across all games
      let currentStreak = 0;
      let streakType = "";
      let longestWinStreak = 0;
      let longestLossStreak = 0;

      // Calculate current streak
      for (let i = allGames.length - 1; i >= 0; i--) {
        const game = allGames[i];
        const won = Number(game.wins) > 0;

        if (i === allGames.length - 1) {
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

      // Calculate longest streaks
      let tempWinStreak = 0;
      let tempLossStreak = 0;

      allGames.forEach((game) => {
        const won = Number(game.wins) > 0;
        if (won) {
          tempWinStreak++;
          tempLossStreak = 0;
          longestWinStreak = Math.max(longestWinStreak, tempWinStreak);
        } else {
          tempLossStreak++;
          tempWinStreak = 0;
          longestLossStreak = Math.max(longestLossStreak, tempLossStreak);
        }
      });

      return {
        type: streakType,
        length: currentStreak,
        longestWinStreak,
        longestLossStreak,
        description: `${currentStreak} ${streakType} in a row`,
        seasonBest: `Season best: ${longestWinStreak}W, ${longestLossStreak}L`
      };
    } else {
      // Point and goal streaks for skaters across all games
      let currentPointStreak = 0;
      let currentGoalStreak = 0;
      let longestPointStreak = 0;
      let longestGoalStreak = 0;
      let currentGoallessStreak = 0;

      // Calculate current streaks
      for (let i = allGames.length - 1; i >= 0; i--) {
        const game = allGames[i];
        const points = Number(game.points) || 0;
        const goals = Number(game.goals) || 0;

        if (points > 0) {
          currentPointStreak++;
        } else if (currentPointStreak === 0) {
          continue;
        } else {
          break;
        }

        if (goals > 0) {
          currentGoalStreak++;
        }
      }

      // Calculate goalless streak if no current goal streak
      if (currentGoalStreak === 0) {
        for (let i = allGames.length - 1; i >= 0; i--) {
          const game = allGames[i];
          const goals = Number(game.goals) || 0;

          if (goals === 0) {
            currentGoallessStreak++;
          } else {
            break;
          }
        }
      }

      // Calculate longest streaks
      let tempPointStreak = 0;
      let tempGoalStreak = 0;

      allGames.forEach((game) => {
        const points = Number(game.points) || 0;
        const goals = Number(game.goals) || 0;

        if (points > 0) {
          tempPointStreak++;
          longestPointStreak = Math.max(longestPointStreak, tempPointStreak);
        } else {
          tempPointStreak = 0;
        }

        if (goals > 0) {
          tempGoalStreak++;
          longestGoalStreak = Math.max(longestGoalStreak, tempGoalStreak);
        } else {
          tempGoalStreak = 0;
        }
      });

      return {
        pointStreak: currentPointStreak,
        goalStreak: currentGoalStreak,
        goallessStreak: currentGoallessStreak,
        longestPointStreak,
        longestGoalStreak,
        description:
          currentPointStreak > 0
            ? `${currentPointStreak} GM Point Streak`
            : "No active point streak",
        seasonBests: `Season best: ${longestPointStreak}GP points, ${longestGoalStreak}GP goals`
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
              <>
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
                <div className={styles.seasonBest}>
                  {streakAnalysis.seasonBest}
                </div>
              </>
            ) : (
              <>
                <div className={styles.skaterStreaks}>
                  <div
                    className={`${styles.streak} ${(streakAnalysis.pointStreak || 0) > 0 ? styles.positive : styles.neutral}`}
                  >
                    <span className={styles.streakValue}>
                      {streakAnalysis.pointStreak || 0} GM
                    </span>
                    <span className={styles.streakLabel}>Point Streak</span>
                  </div>
                  {(streakAnalysis.goalStreak || 0) > 0 ? (
                    <div className={`${styles.streak} ${styles.positive}`}>
                      <span className={styles.streakValue}>
                        {streakAnalysis.goalStreak} GM
                      </span>
                      <span className={styles.streakLabel}>Goal Streak</span>
                    </div>
                  ) : (
                    <div className={`${styles.streak} ${styles.negative}`}>
                      <span className={styles.streakValue}>
                        {streakAnalysis.goallessStreak} GM
                      </span>
                      <span className={styles.streakLabel}>Goalless</span>
                    </div>
                  )}
                </div>
                <div className={styles.seasonBest}>
                  {streakAnalysis.seasonBests}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className={styles.seasonComparison}>
        <h4>Season Context</h4>
        <div className={styles.comparisonStats}>
          <div className={styles.comparisonItem}>
            <span className={styles.comparisonLabel}>Regular Season:</span>
            <span className={styles.comparisonValue}>
              {gameLog.length} games
            </span>
          </div>
          <div className={styles.comparisonItem}>
            <span className={styles.comparisonLabel}>Playoff Games:</span>
            <span className={styles.comparisonValue}>
              {playoffGameLog.length} games
            </span>
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
