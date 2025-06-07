import React, { useMemo } from "react";
import styles from "./PlayerStats.module.scss";
import { useMissedGames } from "hooks/useMissedGames";
import {
  PlayerStatsTableProps,
  GameLogEntry,
  formatStatValue,
  STAT_DISPLAY_NAMES,
  MissedGame
} from "./types";

const PERCENTAGE_STATS = [
  'shooting_percentage', 'save_pct', 'fow_percentage', 'sat_pct', 'zone_start_pct',
  'cf_pct', 'ff_pct', 'sf_pct', 'gf_pct', 'xgf_pct', 'scf_pct', 'hdcf_pct',
  'on_ice_cf_pct', 'on_ice_ff_pct', 'on_ice_sf_pct', 'on_ice_gf_pct', 'on_ice_xgf_pct',
  'on_ice_sh_pct', 'on_ice_sv_pct', 'off_zone_start_pct', 'def_zone_start_pct'
];

const PER_60_STATS = [
  'goals_per_60', 'total_assists_per_60', 'total_points_per_60', 'shots_per_60',
  'ixg_per_60', 'icf_per_60', 'iff_per_60', 'hdcf_per_60', 'hdca_per_60',
  'pim_per_60', 'hits_per_60', 'takeaways_per_60', 'giveaways_per_60',
  'on_ice_goals_per_60', 'on_ice_goals_against_per_60', 'on_ice_shots_per_60'
];

const PER_GAME_STATS = [
  'toi_per_game', 'goals_against_avg'
];

export function PlayerStatsTable({
  gameLog,
  playoffGameLog,
  selectedStats,
  isGoalie,
  showAdvanced = false,
  showPlayoffData = false,
  playerId,
  playerTeamId,
  seasonId
}: PlayerStatsTableProps) {
  // Debug: Log available stats in the first game
  React.useEffect(() => {
    if (gameLog.length > 0) {
      const firstGame = gameLog[0];
      const advancedStats = Object.keys(firstGame).filter(
        (key) =>
          key.includes("_per_60") ||
          key.includes("_pct") ||
          key.includes("cf_") ||
          key.includes("ff_") ||
          key.includes("xg") ||
          key.includes("hdcf") ||
          key.includes("pdo")
      );
      console.log(
        "[PlayerStatsTable] Available advanced stats:",
        advancedStats
      );
      console.log(
        "[PlayerStatsTable] Sample values from first game:",
        advancedStats.reduce(
          (acc, stat) => ({ ...acc, [stat]: firstGame[stat] }),
          {}
        )
      );
    }
  }, [gameLog]);

  // Fetch missed games using the new hook
  const {
    missedGames,
    isLoading: missedGamesLoading,
    error: missedGamesError
  } = useMissedGames(
    playerId,
    playerTeamId,
    seasonId,
    gameLog,
    playoffGameLog || []
  );

  // Combine game log with missed games, sorted by date
  const combinedGameLog = useMemo(() => {
    const log = showPlayoffData && playoffGameLog ? playoffGameLog : gameLog;

    // Create missed game entries that match the structure of regular game log entries
    const missedGameEntries = missedGames
      .filter((missedGame) => {
        // Filter missed games based on showPlayoffData flag
        return showPlayoffData ? missedGame.isPlayoff : !missedGame.isPlayoff;
      })
      .map((missedGame) => {
        // Create a game log entry structure with null/0 values and missed game flag
        const missedEntry: any = {
          date: missedGame.date,
          games_played: 0,
          isMissedGame: true,
          missedGameInfo: missedGame
        };

        // Add all selected stats as null/0
        selectedStats.forEach((stat) => {
          if (stat !== "date" && stat !== "games_played") {
            missedEntry[stat] = null;
          }
        });

        return missedEntry;
      });

    // Combine regular games and missed games, then sort by date
    const combined = [...log, ...missedGameEntries];
    return combined.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [gameLog, playoffGameLog, selectedStats, showPlayoffData, missedGames]);

  // Calculate totals and averages for the timeframe (excluding missed games)
  const summary = useMemo(() => {
    const log = showPlayoffData && playoffGameLog ? playoffGameLog : gameLog;

    if (log.length === 0) return null;

    const totals: { [key: string]: number } = {};
    const gamesPlayed = log.reduce(
      (sum, game) => sum + (game.games_played || 0),
      0
    );

    selectedStats.forEach((stat) => {
      if (stat === "date" || stat === "games_played") return;

      const values = log.map((game) => Number(game[stat]) || 0);

      // For percentages, calculate weighted average
      if (PERCENTAGE_STATS.includes(stat as any)) {
        const weights = log.map((game) => game.games_played || 1);
        const weightedSum = values.reduce(
          (sum, val, idx) => sum + val * weights[idx],
          0
        );
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        totals[stat] = totalWeight > 0 ? weightedSum / totalWeight : 0;
      } else if (
        PER_60_STATS.includes(stat as any) ||
        PER_GAME_STATS.includes(stat as any)
      ) {
        // For per-60 and per-game stats, calculate simple average across games where player played
        const validValues = values.filter((val) => val > 0);
        totals[stat] =
          validValues.length > 0
            ? validValues.reduce((sum, val) => sum + val, 0) /
              validValues.length
            : 0;
      } else {
        // For counting stats (goals, assists, points, etc.), sum them up
        totals[stat] = values.reduce((sum, val) => sum + val, 0);
      }
    });

    return { totals, gamesPlayed };
  }, [gameLog, playoffGameLog, selectedStats, showPlayoffData]);

  if (combinedGameLog.length === 0) {
    return (
      <div className={styles.playerStatsContainer}>
        <div className={styles.tableHeader}>
          <h3>Game Statistics</h3>
        </div>
        <div className={styles.noData}>No game data available</div>
      </div>
    );
  }

  return (
    <div className={styles.playerStatsContainer}>
      <div className={styles.tableHeader}>
        <h3>
          {showAdvanced ? "Advanced Statistics" : "Game Statistics"}
          {showPlayoffData ? " (Playoffs)" : " (Regular Season)"}
        </h3>
        <div className={styles.tableControls}>
          <div className={styles.gameRangeSelector}>
            <span>
              Games: {gameLog.length}
              {missedGames.length > 0 && (
                <span className={styles.missedGamesCount}>
                  {" "}
                  | Missed:{" "}
                  {
                    missedGames.filter((mg) =>
                      showPlayoffData ? mg.isPlayoff : !mg.isPlayoff
                    ).length
                  }
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.scrollableTableWrapper}>
        <table className={styles.statsTable}>
          <thead>
            <tr>
              <th>Date</th>
              <th>GP</th>
              {selectedStats
                .filter((stat) => stat !== "date" && stat !== "games_played")
                .map((stat) => (
                  <th key={stat} title={stat}>
                    {STAT_DISPLAY_NAMES[stat] || stat}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {combinedGameLog.map((game, index) => (
              <tr
                key={`${game.date}-${index}`}
                className={game.isMissedGame ? styles.missedGameRow : ""}
              >
                <td className={styles.dateCell}>
                  {new Date(game.date).toLocaleDateString()}
                  {game.isMissedGame && (
                    <img
                      src="/pictures/injured.png"
                      alt="Missed Game"
                      className={styles.injuredIconTable}
                      title="Player missed this game - possible injury or healthy scratch"
                    />
                  )}
                </td>
                <td>{game.isMissedGame ? 0 : game.games_played || 0}</td>
                {selectedStats
                  .filter((stat) => stat !== "date" && stat !== "games_played")
                  .map((stat) => (
                    <td key={stat}>
                      {game.isMissedGame
                        ? "-"
                        : formatStatValue(game[stat], stat)}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {missedGamesError && (
        <div className={styles.errorMessage}>
          Error loading missed games: {missedGamesError}
        </div>
      )}
    </div>
  );
}
