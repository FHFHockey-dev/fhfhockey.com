import React, { useMemo } from "react";
import styles from "./PlayerStats.module.scss";
import { GameLogEntry } from "pages/stats/player/[playerId]";
import { useMissedGames } from "hooks/useMissedGames";

interface PlayerStatsTableProps {
  gameLog: GameLogEntry[]; // This now uses the correct type
  playoffGameLog?: GameLogEntry[];
  selectedStats: string[];
  isGoalie: boolean;
  showAdvanced?: boolean;
  showPlayoffData?: boolean;
  playerId?: string | number;
  playerTeamId?: number;
  seasonId?: string | number | null;
}

const STAT_FORMATTERS = {
  // Percentages
  shooting_percentage: (value: number) => `${(value || 0).toFixed(1)}%`,
  save_pct: (value: number) => `${(value || 0).toFixed(3)}`,
  fow_percentage: (value: number) => `${(value || 0).toFixed(1)}%`,
  sat_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  zone_start_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  on_ice_shooting_pct: (value: number) => `${(value || 0).toFixed(1)}%`,

  // NST Advanced Stats - Possession Percentages
  cf_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  ff_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  sf_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  gf_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  xgf_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  scf_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  hdcf_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  mdcf_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  ldcf_pct: (value: number) => `${(value || 0).toFixed(1)}%`,

  // NST Advanced Stats - Zone Usage Percentages
  off_zone_start_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  def_zone_start_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  neu_zone_start_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  off_zone_faceoff_pct: (value: number) => `${(value || 0).toFixed(1)}%`,

  // NST Advanced Stats - On-Ice Impact
  on_ice_sh_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  on_ice_sv_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  pdo: (value: number) => (value || 0).toFixed(1),

  // Decimal stats
  goals_against_avg: (value: number) => (value || 0).toFixed(2),
  toi_per_game: (value: number) => {
    const totalMinutes = value || 0;
    const minutes = Math.floor(totalMinutes);
    const seconds = Math.round((totalMinutes - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  },

  // NST Advanced Stats - Per 60 stats (1 decimal place)
  ixg_per_60: (value: number) => (value || 0).toFixed(1),
  icf_per_60: (value: number) => (value || 0).toFixed(1),
  iff_per_60: (value: number) => (value || 0).toFixed(1),
  iscfs_per_60: (value: number) => (value || 0).toFixed(1),
  hdcf_per_60: (value: number) => (value || 0).toFixed(1),
  shots_per_60: (value: number) => (value || 0).toFixed(1),
  goals_per_60: (value: number) => (value || 0).toFixed(1),
  total_assists_per_60: (value: number) => (value || 0).toFixed(1),
  total_points_per_60: (value: number) => (value || 0).toFixed(1),
  rush_attempts_per_60: (value: number) => (value || 0).toFixed(1),
  rebounds_created_per_60: (value: number) => (value || 0).toFixed(1),

  // NST Advanced Stats - Defensive Per 60
  hdca_per_60: (value: number) => (value || 0).toFixed(1),
  sca_per_60: (value: number) => (value || 0).toFixed(1),
  shots_blocked_per_60: (value: number) => (value || 0).toFixed(1),
  xga_per_60: (value: number) => (value || 0).toFixed(1),
  ga_per_60: (value: number) => (value || 0).toFixed(1),

  // NST Advanced Stats - Discipline Per 60
  pim_per_60: (value: number) => (value || 0).toFixed(1),
  total_penalties_per_60: (value: number) => (value || 0).toFixed(1),
  penalties_drawn_per_60: (value: number) => (value || 0).toFixed(1),
  giveaways_per_60: (value: number) => (value || 0).toFixed(1),
  takeaways_per_60: (value: number) => (value || 0).toFixed(1),
  hits_per_60: (value: number) => (value || 0).toFixed(1),

  // Individual_sat_for_per_60 - legacy stat
  individual_sat_for_per_60: (value: number) => (value || 0).toFixed(1),
  blocks_per_60: (value: number) => (value || 0).toFixed(1),

  // Default integer formatting
  default: (value: number) => Math.round(value || 0).toString()
};

const STAT_DISPLAY_NAMES: { [key: string]: string } = {
  // Basic Stats
  date: "Date",
  games_played: "GP",
  points: "P",
  goals: "G",
  assists: "A",
  shots: "SOG",
  shooting_percentage: "SH%",
  plus_minus: "+/-",
  pp_points: "PPP",
  fow_percentage: "FO%",
  toi_per_game: "TOI",
  hits: "HIT",
  blocked_shots: "BLK",
  takeaways: "TK",
  giveaways: "GV",
  sat_pct: "CF%",
  zone_start_pct: "ZS%",

  // Goalie stats
  wins: "W",
  losses: "L",
  ot_losses: "OTL",
  save_pct: "SV%",
  saves: "SV",
  goals_against: "GA",
  goals_against_avg: "GAA",
  shots_against: "SA",
  shutouts: "SO",
  time_on_ice: "TOI",
  quality_start: "QS",

  // NST Advanced Stats - Possession Metrics
  cf_pct: "CF%",
  ff_pct: "FF%",
  sf_pct: "SF%",
  gf_pct: "GF%",
  xgf_pct: "xGF%",
  scf_pct: "SCF%",
  hdcf_pct: "HDCF%",
  mdcf_pct: "MDCF%",
  ldcf_pct: "LDCF%",

  // NST Advanced Stats - Individual Per 60
  ixg_per_60: "ixG/60",
  icf_per_60: "iCF/60",
  iff_per_60: "iFF/60",
  iscfs_per_60: "iSCF/60",
  hdcf_per_60: "HDCF/60",
  shots_per_60: "SOG/60",
  goals_per_60: "G/60",
  total_assists_per_60: "A/60",
  total_points_per_60: "P/60",
  rush_attempts_per_60: "Rush/60",
  rebounds_created_per_60: "Reb/60",

  // NST Advanced Stats - Defensive Per 60
  hdca_per_60: "HDCA/60",
  sca_per_60: "SCA/60",
  shots_blocked_per_60: "BLK/60",
  xga_per_60: "xGA/60",
  ga_per_60: "GA/60",

  // NST Advanced Stats - Zone Usage
  off_zone_start_pct: "OZ Start%",
  def_zone_start_pct: "DZ Start%",
  neu_zone_start_pct: "NZ Start%",
  off_zone_faceoff_pct: "OZ FO%",

  // NST Advanced Stats - On-Ice Impact
  on_ice_sh_pct: "oiSH%",
  on_ice_sv_pct: "oiSV%",
  pdo: "PDO",

  // NST Advanced Stats - Discipline Per 60
  pim_per_60: "PIM/60",
  total_penalties_per_60: "Pen/60",
  penalties_drawn_per_60: "PenD/60",
  giveaways_per_60: "GV/60",
  takeaways_per_60: "TK/60",
  hits_per_60: "HIT/60",

  // Advanced stats (legacy)
  individual_sat_for_per_60: "iCF/60",
  on_ice_shooting_pct: "oiSH%",
  sat_relative: "CF% Rel",
  usat_pct: "FF%"
};

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
      if (
        [
          "shooting_percentage",
          "save_pct",
          "fow_percentage",
          "sat_pct",
          "zone_start_pct",
          // NST Advanced Stats - Possession Percentages
          "cf_pct",
          "ff_pct",
          "sf_pct",
          "gf_pct",
          "xgf_pct",
          "scf_pct",
          "hdcf_pct",
          "mdcf_pct",
          "ldcf_pct",
          // Zone Usage Percentages
          "off_zone_start_pct",
          "def_zone_start_pct",
          "neu_zone_start_pct",
          "off_zone_faceoff_pct",
          // On-Ice Impact Percentages
          "on_ice_sh_pct",
          "on_ice_sv_pct",
          "pdo",
          // Legacy percentage stats
          "on_ice_shooting_pct",
          "usat_pct"
        ].includes(stat)
      ) {
        const weights = log.map((game) => game.games_played || 1);
        const weightedSum = values.reduce(
          (sum, val, idx) => sum + val * weights[idx],
          0
        );
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        totals[stat] = totalWeight > 0 ? weightedSum / totalWeight : 0;
      } else if (
        // For per-60 and per-game stats, calculate simple average across games
        stat.includes("_per_60") ||
        stat === "goals_against_avg" ||
        stat === "toi_per_game"
      ) {
        const validValues = values.filter((val) => val > 0); // Only count games where player actually played
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

  const formatStatValue = (value: any, stat: string): string => {
    if (value === null || value === undefined) return "-";

    const numValue = Number(value);
    if (isNaN(numValue)) return "-";

    const formatter = STAT_FORMATTERS[stat as keyof typeof STAT_FORMATTERS];
    if (formatter) {
      return formatter(numValue);
    }
    return STAT_FORMATTERS.default(numValue);
  };

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
