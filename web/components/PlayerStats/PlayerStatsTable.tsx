import React, { useMemo } from "react";
import styles from "./PlayerStats.module.scss";
import { useMissedGames } from "hooks/useMissedGames";
import {
  PlayerStatsTableProps,
  GameLogEntry,
  STAT_DISPLAY_NAMES,
  MissedGame
} from "./types";
import {
  countAppearances,
  formatPlayerStat,
  leagueDateKey,
  parseLocalDate,
  splitTeamSchedule
} from "./playerStatsContract";

export function PlayerStatsTable({
  gameLog,
  playoffGameLog,
  selectedStats,
  isGoalie,
  showAdvanced = false,
  showPlayoffData = false,
  playerId,
  playerTeamId,
  seasonId,
  missedGames,
  asOfDate,
  windowStartDate = null
}: PlayerStatsTableProps & {
  // Team schedule rows without an appearance; null = schedule unknown,
  // undefined = not supplied (fetched client-side).
  missedGames?: MissedGame[] | null;
  asOfDate?: string;
  windowStartDate?: string | null;
}) {
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

  // Use server-side missed games data instead of client-side hook
  // Still keep the hook for backward compatibility but prioritize props
  const {
    missedGames: hookMissedGames,
    error: missedGamesError
  } = useMissedGames(
    playerId,
    playerTeamId,
    missedGames === undefined ? seasonId : null,
    gameLog,
    playoffGameLog || []
  );

  // Server-supplied schedule wins (even when empty); only elapsed absences in
  // the selected window become rows; upcoming games are never "missed".
  const activeMissedGames = useMemo(
    () =>
      splitTeamSchedule(
        missedGames === undefined ? hookMissedGames : missedGames,
        asOfDate ?? leagueDateKey(),
        windowStartDate
      ).absences,
    [missedGames, hookMissedGames, asOfDate, windowStartDate]
  );

  // Combine game log with missed games, sorted by date
  const combinedGameLog = useMemo(() => {
    const log = showPlayoffData && playoffGameLog ? playoffGameLog : gameLog;

    console.log("[PlayerStatsTable] Combining games:", {
      gameLogLength: log.length,
      missedGamesLength: activeMissedGames.length,
      showPlayoffData
    });

    // Create missed game entries that match the structure of regular game log entries
    const missedGameEntries = activeMissedGames
      .filter((missedGame) => {
        // Filter missed games based on showPlayoffData flag
        return showPlayoffData ? missedGame.isPlayoff : !missedGame.isPlayoff;
      })
      .map((missedGame) => {
        console.log("[PlayerStatsTable] Processing missed game:", {
          date: missedGame.date,
          isPlayoff: missedGame.isPlayoff,
          gameId: missedGame.gameId
        });

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

    console.log(
      "[PlayerStatsTable] Created missed game entries:",
      missedGameEntries.length
    );

    // Combine regular games and missed games, then sort by date
    const combined = [...log, ...missedGameEntries];
    const sorted = combined.sort(
      (a, b) => String(a.date).localeCompare(String(b.date))
    );

    console.log("[PlayerStatsTable] Final combined log:", {
      totalEntries: sorted.length,
      regularGames: log.length,
      missedGames: missedGameEntries.length
    });

    return sorted;
  }, [
    gameLog,
    playoffGameLog,
    selectedStats,
    showPlayoffData,
    activeMissedGames
  ]);

  const visibleAbsences = combinedGameLog.filter(
    (game) => game.isMissedGame
  ).length;

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
              Games:{" "}
              {countAppearances(
                showPlayoffData && playoffGameLog ? playoffGameLog : gameLog
              )}
              {visibleAbsences > 0 && (
                <span className={styles.missedGamesCount}>
                  {" "}
                  | Missed: {visibleAbsences}
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
                  {parseLocalDate(game.date).toLocaleDateString()}
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
                        : formatPlayerStat(game[stat], stat)}
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
