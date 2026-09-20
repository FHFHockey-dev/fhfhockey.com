// components/WiGO/PerGameStatsTable.tsx
import React, { useMemo } from "react";
import useWigoPlayerTotals from "hooks/useWigoPlayerTotals";
import {
  SkaterTotalsData
} from "utils/fetchWigoPlayerStats";
import { formatWigoStatValue } from "./statMetadata";
import { WIGO_ERROR_MESSAGES } from "./errorMessages";
import styles from "./PerGameStatsTable.module.scss";

type NumericSkaterTotalsKeys = {
  [K in keyof SkaterTotalsData]: SkaterTotalsData[K] extends number | null
    ? K
    : never;
}[keyof SkaterTotalsData];

interface PerGameStatsTableProps {
  playerId: number | null | undefined;
  seasonId?: number | null;
  desktop?: boolean;
}

// Interface for the calculated data rows
interface CalculatedStatRow {
  stat: string; // GP, G, A, PTS, SOG, PPP, HIT, BLK, PIM
  perGame: string;
  per84: string;
}

// Formatting functions remain the same
const formatStatValue = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return "-";
  }
  // Using toFixed(2) might be too many decimals for some counting stats per game
  return value.toFixed(2);
};
const formatPaceValue = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return "-";
  }
  return Math.round(value).toString();
};
const formatPercentageValue = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return "-";
  }
  return formatWigoStatValue("S%", value);
};

const PerGameStatsTable: React.FC<PerGameStatsTableProps> = ({
  playerId,
  seasonId,
  desktop = false
}) => {
  const {
    data: totalsData,
    isLoading,
    error
  } = useWigoPlayerTotals(playerId, seasonId);

  const statRows = useMemo(() => {
    if (!totalsData?.games_played || totalsData.games_played <= 0) {
      return [];
    }

    const gp = totalsData.games_played;
    const statsToCalculate: Array<{
      key: NumericSkaterTotalsKeys;
      name: string;
    }> = [
      { key: "goals", name: "G" },
      { key: "assists", name: "A" },
      { key: "points", name: "PTS" },
      { key: "shots", name: "SOG" },
      { key: "shooting_percentage", name: "S%" },
      { key: "pp_points", name: "PPP" },
      { key: "hits", name: "HIT" },
      { key: "blocked_shots", name: "BLK" },
      { key: "penalty_minutes", name: "PIM" }
    ];

    const rows = statsToCalculate.map(({ key, name }) => {
      const totalValue = totalsData[key] ?? null;

      if (key === "shooting_percentage") {
        const shootingPercentage = totalsData.goals != null && totalsData.shots != null && totalsData.shots > 0
          ? 100 * totalsData.goals / totalsData.shots
          : null;
        return {
          stat: name,
          perGame: formatPercentageValue(shootingPercentage),
          per84: "-"
        };
      }

      const perGameValue = totalValue == null ? null : totalValue / gp;
      const per84Value = perGameValue == null ? null : perGameValue * 84;

      return {
        stat: name,
        perGame: formatStatValue(perGameValue),
        per84: formatPaceValue(per84Value)
      };
    });

    rows.unshift({
      stat: "GP",
      perGame: gp.toString(),
      per84: "-"
    });

    return rows;
  }, [totalsData]);

  const errorMessage = useMemo(() => {
    if (!playerId) {
      return null;
    }

    if (error) {
      return WIGO_ERROR_MESSAGES.stats;
    }

    if (!isLoading && totalsData && (totalsData.games_played ?? 0) <= 0) {
      return "Player has 0 games played.";
    }

    if (!isLoading && !totalsData) {
      return "No stats data found for this player.";
    }

    return null;
  }, [error, isLoading, playerId, totalsData]);

  const productionSnapshot = useMemo(() => {
    if (!totalsData?.games_played) return [];

    const gp = totalsData.games_played;
    return [
      { label: "Points", value: totalsData.points, perGame: totalsData.points == null ? null : totalsData.points / gp },
      { label: "Goals", value: totalsData.goals, perGame: totalsData.goals == null ? null : totalsData.goals / gp },
      { label: "Assists", value: totalsData.assists, perGame: totalsData.assists == null ? null : totalsData.assists / gp },
      { label: "SOG", value: totalsData.shots, perGame: totalsData.shots == null ? null : totalsData.shots / gp }
    ];
  }, [totalsData]);

  const status = !playerId ? "Select a player to view stats." : !seasonId ? "Loading season info..." : isLoading ? "Loading Stats..." : errorMessage;
  const visibleRows = statRows.length ? statRows : ["GP", "G", "A", "PTS", "SOG", "S%", "PPP", "HIT", "BLK", "PIM"].map(stat => ({ stat, perGame: "-", per84: "-" }));
  return (
    <div className={`${styles.perGameTableContainer} ${desktop ? styles.desktopSummary : ""}`}>
      <section className={styles.productionSnapshot} data-coverage="C04">
        <h3>Season production <span>{totalsData?.season || seasonId || "Season unavailable"}</span></h3>
        {status ? <p className={styles.summaryStatus} role="status">{status}</p> : <div className={styles.productionGrid}>
          {productionSnapshot.map(stat => <div key={stat.label} className={styles.productionStat}>
            <span>{stat.label}</span><strong>{stat.value ?? "-"}</strong><small>{formatStatValue(stat.perGame)} / GP</small>
          </div>)}
        </div>}
      </section>
      <section className={styles.projectionTableSection} data-coverage="C05">
        <details className={styles.paceHelp}>
          <summary><h3>Per-game / 84-game pace</h3></summary>
          <p>Observed counting rate × 84, rounded to a whole count. Constant-rate pace, not a remaining-game, availability or health prediction.</p>
        </details>
        <table className={styles.verticalStatsTable}>
          <thead><tr><th className={styles.metricHeader}>Metric</th><th className={styles.valueHeader}>Per/GP</th><th className={styles.valueHeader}>Pace/84</th></tr></thead>
          <tbody>{visibleRows.map(row => <tr key={row.stat}><th scope="row" className={styles.metricCell}>{row.stat}</th><td className={styles.valueCell}>{row.perGame}</td><td className={styles.valueCell}>{row.per84}</td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
};

export default PerGameStatsTable;
