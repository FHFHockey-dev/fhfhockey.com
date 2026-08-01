// components/WiGO/PerGameStatsTable.tsx
import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchPlayerPerGameTotals,
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
}

// Interface for the calculated data rows
interface CalculatedStatRow {
  stat: string; // GP, G, A, PTS, SOG, PPP, HIT, BLK, PIM
  perGame: string;
  per82: string;
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
  seasonId
}) => {
  const {
    data: totalsData,
    isLoading,
    error
  } = useQuery<SkaterTotalsData | null>({
    queryKey: ["wigoPerGameTotals", playerId, seasonId ?? "latest"],
    queryFn: () => fetchPlayerPerGameTotals(playerId as number, seasonId),
    enabled: typeof playerId === "number"
  });

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
        return {
          stat: name,
          perGame: formatPercentageValue(totalValue),
          per82: "-"
        };
      }

      const numericTotalValue = Number(totalValue ?? 0);
      const perGameValue = numericTotalValue / gp;
      const per82Value = perGameValue * 82;

      return {
        stat: name,
        perGame: formatStatValue(perGameValue),
        per82: formatPaceValue(per82Value)
      };
    });

    rows.unshift({
      stat: "GP",
      perGame: gp.toString(),
      per82: "-"
    });

    return rows;
  }, [totalsData]);

  const errorMessage = useMemo(() => {
    if (!playerId) {
      return null;
    }

    if (error instanceof Error) {
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
      { label: "Points", value: totalsData.points, perGame: totalsData.points_per_game },
      { label: "Goals", value: totalsData.goals, perGame: (totalsData.goals ?? 0) / gp },
      { label: "Assists", value: totalsData.assists, perGame: (totalsData.assists ?? 0) / gp },
      { label: "SOG", value: totalsData.shots, perGame: (totalsData.shots ?? 0) / gp }
    ];
  }, [totalsData]);

  return (
    <div className={styles.perGameTableContainer}>
      {isLoading && (
        <div className={styles.loadingMessage}>Loading Stats...</div>
      )}
      {errorMessage && (
        <div className={styles.errorMessage}>{errorMessage}</div>
      )}
      {!isLoading && !errorMessage && statRows.length === 0 && playerId && (
        <div className={styles.noDataMessage}>No data available.</div>
      )}
      {!isLoading && !errorMessage && statRows.length > 0 && (
        <>
          <section className={styles.productionSnapshot}>
            <h3>Production Snapshot <span>(This season)</span></h3>
            <div className={styles.productionGrid}>
              {productionSnapshot.map((stat) => (
                <div key={stat.label} className={styles.productionStat}>
                  <span>{stat.label}</span>
                  <strong>{stat.value ?? "-"}</strong>
                  <small>{formatStatValue(stat.perGame)} / GP</small>
                </div>
              ))}
            </div>
          </section>
          <section className={styles.projectionTableSection}>
            <h3>Per-game / Per-82 projection</h3>
            <table className={styles.verticalStatsTable}>
              <thead>
                <tr>
                  <th className={styles.metricHeader}>Metric</th>
                  <th className={styles.valueHeader}>Per/GP</th>
                  <th className={styles.valueHeader}>Per/82</th>
                </tr>
              </thead>
              <tbody>
                {statRows.map((row) => (
                  <tr key={row.stat}>
                    <th scope="row" className={styles.metricCell}>
                      {row.stat}
                    </th>
                    <td className={styles.valueCell}>{row.perGame}</td>
                    <td className={styles.valueCell}>{row.per82}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
      {!playerId && !isLoading && (
        <div className={styles.noPlayerMessage}>
          Select a player to view stats.
        </div>
      )}
    </div>
  );
};

export default PerGameStatsTable;
