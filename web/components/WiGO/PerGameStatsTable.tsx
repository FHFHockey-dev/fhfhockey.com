// components/WiGO/PerGameStatsTable.tsx
import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchPlayerPerGameTotals,
  SkaterTotalsData
} from "utils/fetchWigoPlayerStats";
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

  value = value * 100;
  return `${value.toFixed(1)}%`;
};

const PerGameStatsTable: React.FC<PerGameStatsTableProps> = ({
  playerId,
  seasonId
}) => {
  const { data: totalsData, isLoading, error } = useQuery<SkaterTotalsData | null>(
    {
      queryKey: ["wigoPerGameTotals", playerId, seasonId ?? "latest"],
      queryFn: () => fetchPlayerPerGameTotals(playerId as number, seasonId),
      enabled: typeof playerId === "number"
    }
  );

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
      return `Failed to load stats: ${error.message || "Unknown error"}`;
    }

    if (!isLoading && totalsData && (totalsData.games_played ?? 0) <= 0) {
      return "Player has 0 games played.";
    }

    if (!isLoading && !totalsData) {
      return "No stats data found for this player.";
    }

    return null;
  }, [error, isLoading, playerId, totalsData]);

  return (
    <div className={styles.perGameTableContainer}>
      {isLoading && (
        <div className={styles.loadingMessage}>Loading Stats...</div>
      )}
      {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}
      {!isLoading && !errorMessage && statRows.length === 0 && playerId && (
        <div className={styles.noDataMessage}>No data available.</div>
      )}
      {!isLoading && !errorMessage && statRows.length > 0 && (
        <table className={styles.verticalStatsTable}>
          <thead>
            <tr>
              {/* Fixed Column Headers */}
              <th className={styles.metricHeader}>Metric</th>
              <th className={styles.valueHeader}>Per/GP</th>
              <th className={styles.valueHeader}>Per/82</th>
            </tr>
          </thead>
          <tbody>
            {/* Map over calculated rows */}
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
