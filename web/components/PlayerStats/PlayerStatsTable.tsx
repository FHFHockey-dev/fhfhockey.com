import React, { useMemo } from "react";
import styles from "./PlayerStatsTable.module.scss";

interface GameLogEntry {
  date: string;
  games_played: number;
  [key: string]: any;
}

interface PlayerStatsTableProps {
  gameLog: GameLogEntry[];
  selectedStats: string[];
  isGoalie: boolean;
  showAdvanced?: boolean;
}

const STAT_FORMATTERS = {
  // Percentages
  shooting_percentage: (value: number) => `${(value || 0).toFixed(1)}%`,
  save_pct: (value: number) => `${(value || 0).toFixed(3)}`,
  fow_percentage: (value: number) => `${(value || 0).toFixed(1)}%`,
  sat_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  zone_start_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  on_ice_shooting_pct: (value: number) => `${(value || 0).toFixed(1)}%`,

  // Decimal stats
  goals_against_avg: (value: number) => (value || 0).toFixed(2),
  toi_per_game: (value: number) => {
    const totalMinutes = value || 0;
    const minutes = Math.floor(totalMinutes);
    const seconds = Math.round((totalMinutes - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  },

  // Per-60 stats
  individual_sat_for_per_60: (value: number) => (value || 0).toFixed(1),
  hits_per_60: (value: number) => (value || 0).toFixed(1),
  blocks_per_60: (value: number) => (value || 0).toFixed(1),

  // Default integer formatting
  default: (value: number) => Math.round(value || 0).toString()
};

const STAT_DISPLAY_NAMES: { [key: string]: string } = {
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

  // Advanced stats
  individual_sat_for_per_60: "iCF/60",
  on_ice_shooting_pct: "oiSH%",
  sat_relative: "CF% Rel",
  usat_pct: "FF%"
};

export function PlayerStatsTable({
  gameLog,
  selectedStats,
  isGoalie,
  showAdvanced = false
}: PlayerStatsTableProps) {
  // Calculate totals and averages for the timeframe
  const summary = useMemo(() => {
    if (gameLog.length === 0) return null;

    const totals: { [key: string]: number } = {};
    const gamesPlayed = gameLog.reduce(
      (sum, game) => sum + (game.games_played || 0),
      0
    );

    selectedStats.forEach((stat) => {
      if (stat === "date" || stat === "games_played") return;

      const values = gameLog.map((game) => Number(game[stat]) || 0);

      // For percentages, calculate weighted average
      if (
        [
          "shooting_percentage",
          "save_pct",
          "fow_percentage",
          "sat_pct",
          "zone_start_pct"
        ].includes(stat)
      ) {
        const weights = gameLog.map((game) => game.games_played || 1);
        const weightedSum = values.reduce(
          (sum, val, idx) => sum + val * weights[idx],
          0
        );
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        totals[stat] = totalWeight > 0 ? weightedSum / totalWeight : 0;
      } else {
        // For counting stats, sum them up
        totals[stat] = values.reduce((sum, val) => sum + val, 0);
      }
    });

    return { totals, gamesPlayed };
  }, [gameLog, selectedStats]);

  const formatStatValue = (value: any, stat: string): string => {
    if (value == null || value === "") return "-";

    if (stat === "date") {
      return new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      });
    }

    const numValue = Number(value);
    if (isNaN(numValue)) return "-";

    const formatter =
      STAT_FORMATTERS[stat as keyof typeof STAT_FORMATTERS] ||
      STAT_FORMATTERS.default;
    return formatter(numValue);
  };

  const getStatClass = (value: any, stat: string): string => {
    const numValue = Number(value);
    if (isNaN(numValue)) return "";

    // Color coding for key stats
    if (stat === "goals" && numValue > 0) return styles.positive;
    if (stat === "assists" && numValue >= 2) return styles.positive;
    if (stat === "points" && numValue >= 2) return styles.positive;
    if (stat === "save_pct" && numValue >= 0.92) return styles.positive;
    if (stat === "save_pct" && numValue < 0.9) return styles.negative;
    if (stat === "goals_against_avg" && numValue <= 2.5) return styles.positive;
    if (stat === "goals_against_avg" && numValue >= 3.5) return styles.negative;
    if (stat === "shooting_percentage" && numValue >= 15)
      return styles.positive;
    if (stat === "plus_minus" && numValue > 0) return styles.positive;
    if (stat === "plus_minus" && numValue < 0) return styles.negative;

    return "";
  };

  const displayStats = ["date", "games_played", ...selectedStats].filter(
    (stat) => !(stat === "games_played" && isGoalie) // Hide GP for goalies in individual games
  );

  return (
    <div className={styles.tableContainer}>
      {summary && (
        <div className={styles.summaryRow}>
          <h3>
            {gameLog.length} Games Summary
            {summary.gamesPlayed !== gameLog.length &&
              ` (${summary.gamesPlayed} GP)`}
          </h3>
          <div className={styles.summaryStats}>
            {selectedStats.map((stat) => (
              <div key={stat} className={styles.summaryStat}>
                <span className={styles.statLabel}>
                  {STAT_DISPLAY_NAMES[stat] || stat}:
                </span>
                <span className={styles.statValue}>
                  {formatStatValue(summary.totals[stat], stat)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.tableWrapper}>
        <table className={styles.statsTable}>
          <thead>
            <tr>
              {displayStats.map((stat) => (
                <th key={stat} className={styles.statHeader}>
                  {STAT_DISPLAY_NAMES[stat] || stat}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gameLog.length === 0 ? (
              <tr>
                <td colSpan={displayStats.length} className={styles.noData}>
                  No games found for selected timeframe
                </td>
              </tr>
            ) : (
              gameLog.map((game, index) => (
                <tr key={`${game.date}-${index}`} className={styles.gameRow}>
                  {displayStats.map((stat) => (
                    <td
                      key={stat}
                      className={`${styles.statCell} ${getStatClass(game[stat], stat)}`}
                    >
                      {formatStatValue(game[stat], stat)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdvanced && (
        <div className={styles.advancedNote}>
          <p>
            <strong>Advanced Stats:</strong> CF% = Corsi For %, ZS% = Zone Start
            %, iCF/60 = Individual Corsi For per 60 minutes, oiSH% = On-Ice
            Shooting %
          </p>
        </div>
      )}
    </div>
  );
}
