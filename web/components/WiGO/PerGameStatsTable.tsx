// components/WiGO/PerGameStatsTable.tsx
import React, { useState, useEffect } from "react";
import {
  fetchPlayerPerGameTotals,
  SkaterTotalsData
} from "utils/fetchWigoPlayerStats";
import styles from "./PerGameStatsTable.module.scss";

interface PerGameStatsTableProps {
  playerId: number | null | undefined;
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

const PerGameStatsTable: React.FC<PerGameStatsTableProps> = ({ playerId }) => {
  const [totalsData, setTotalsData] = useState<SkaterTotalsData | null>(null);
  const [statRows, setStatRows] = useState<CalculatedStatRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) {
      setTotalsData(null);
      setStatRows([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      setTotalsData(null);
      setStatRows([]);
      try {
        const data = await fetchPlayerPerGameTotals(playerId);
        if (data) {
          setTotalsData(data);
        } else {
          // Set error only if player selected but no data found
          setError("No stats data found for this player.");
          setTotalsData(null);
        }
      } catch (err: any) {
        console.error("Failed to fetch player totals:", err);
        setError(`Failed to load stats: ${err.message || "Unknown error"}`);
        setTotalsData(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [playerId]);

  // Calculation logic populates statRows
  useEffect(() => {
    if (totalsData && totalsData.games_played && totalsData.games_played > 0) {
      const gp = totalsData.games_played;
      const statsToCalculate: Array<{
        key: keyof SkaterTotalsData;
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

      const newStatRows = statsToCalculate.map(({ key, name }) => {
        // Ensure totalValue is treated as a number, default to 0 if null/undefined
        const totalValue = Number(totalsData[key] ?? 0);
        const perGameValue = totalValue / gp;
        const per82Value = perGameValue * 82;
        return {
          stat: name,
          perGame: formatStatValue(perGameValue),
          per82: formatPaceValue(per82Value)
        };
      });

      // Add the GP row at the beginning
      newStatRows.unshift({
        stat: "GP",
        perGame: gp.toString(),
        per82: "-"
      });

      setStatRows(newStatRows);
      setError(null); // Clear previous errors
    } else {
      setStatRows([]); // Clear rows if no valid data
      // Set error only if data was fetched but GP is invalid
      if (
        totalsData &&
        (!totalsData.games_played || totalsData.games_played <= 0) &&
        !isLoading
      ) {
        setError("Player has 0 games played.");
      }
    }
  }, [totalsData, isLoading]);

  return (
    <div className={styles.perGameTableContainer}>
      {isLoading && (
        <div className={styles.loadingMessage}>Loading Stats...</div>
      )}
      {error && <div className={styles.errorMessage}>{error}</div>}
      {!isLoading && !error && statRows.length === 0 && playerId && (
        <div className={styles.noDataMessage}>No data available.</div>
      )}
      {!isLoading && !error && statRows.length > 0 && (
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
