import React, { useMemo } from "react";
import styles from "./PlayerStats.module.scss";
import { GameLogEntry } from "pages/stats/player/[playerId]";

interface PlayerStatsSummaryProps {
  gameLog: GameLogEntry[];
  playoffGameLog?: GameLogEntry[];
  selectedStats: string[];
  isGoalie: boolean;
  showPlayoffData?: boolean;
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

  // Zone Usage Percentages
  off_zone_start_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  def_zone_start_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
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

  // Per 60 stats
  ixg_per_60: (value: number) => (value || 0).toFixed(1),
  icf_per_60: (value: number) => (value || 0).toFixed(1),
  shots_per_60: (value: number) => (value || 0).toFixed(1),
  goals_per_60: (value: number) => (value || 0).toFixed(1),
  total_points_per_60: (value: number) => (value || 0).toFixed(1),

  // Default integer formatting
  default: (value: number) => Math.round(value || 0).toString()
};

const STAT_DISPLAY_NAMES: { [key: string]: string } = {
  points: "Points",
  goals: "Goals",
  assists: "Assists",
  shots: "Shots",
  shooting_percentage: "SH%",
  save_pct: "SV%",
  goals_against_avg: "GAA",
  wins: "Wins",
  saves: "Saves",
  shutouts: "SO",
  toi_per_game: "TOI/GP",
  hits: "Hits",
  blocked_shots: "Blocks",
  fow_percentage: "FO%",
  sat_pct: "CF%",

  // NST Advanced Stats
  cf_pct: "CF%",
  ff_pct: "FF%",
  sf_pct: "SF%",
  xgf_pct: "xGF%",
  hdcf_pct: "HDCF%",
  ixg_per_60: "ixG/60",
  icf_per_60: "iCF/60",
  shots_per_60: "SOG/60",
  goals_per_60: "G/60",
  total_points_per_60: "P/60",
  off_zone_start_pct: "OZ Start%",
  on_ice_sh_pct: "oiSH%",
  pdo: "PDO"
};

export function PlayerStatsSummary({
  gameLog,
  playoffGameLog,
  selectedStats,
  isGoalie,
  showPlayoffData = false
}: PlayerStatsSummaryProps) {
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
          "cf_pct",
          "ff_pct",
          "sf_pct",
          "gf_pct",
          "xgf_pct",
          "scf_pct",
          "hdcf_pct",
          "off_zone_start_pct",
          "def_zone_start_pct",
          "on_ice_sh_pct",
          "on_ice_sv_pct",
          "pdo"
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
        stat.includes("_per_60") ||
        stat === "goals_against_avg" ||
        stat === "toi_per_game"
      ) {
        const validValues = values.filter((val) => val > 0);
        totals[stat] =
          validValues.length > 0
            ? validValues.reduce((sum, val) => sum + val, 0) /
              validValues.length
            : 0;
      } else {
        totals[stat] = values.reduce((sum, val) => sum + val, 0);
      }
    });

    return { totals, gamesPlayed };
  }, [gameLog, playoffGameLog, selectedStats, showPlayoffData]);

  const formatStatValue = (value: number, stat: string): string => {
    const formatter = STAT_FORMATTERS[stat as keyof typeof STAT_FORMATTERS];
    if (formatter) {
      return formatter(value);
    }
    return STAT_FORMATTERS.default(value);
  };

  if (!summary || summary.gamesPlayed === 0) {
    return null;
  }

  return (
    <div className={styles.summarySection}>
      <h3>Season Summary</h3>
      <div className={styles.summaryGrid}>
        {selectedStats.map((stat) => (
          <div key={stat} className={styles.summaryCard}>
            <div className={styles.summaryLabel}>
              {STAT_DISPLAY_NAMES[stat] || stat}
            </div>
            <div className={styles.summaryValue}>
              {formatStatValue(summary.totals[stat] || 0, stat)}
            </div>
            <div className={styles.summaryDescription}>
              {summary.gamesPlayed} games played
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
