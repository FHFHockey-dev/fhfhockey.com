// components/WiGO/PerGameStatsTable.tsx
import React, { useState, useEffect } from "react";
// Keep existing imports: supabase, utils, types, styles
import supabase from "lib/supabase";
import {
  fetchPlayerPerGameTotals,
  SkaterTotalsData
} from "utils/fetchWigoPlayerStats";
import styles from "./PerGameStatsTable.module.scss"; // Ensure this path is correct
import { TableAggregateData } from "./types"; // Assuming SkaterTotalsData is defined here or imported

interface PerGameStatsTableProps {
  playerId: number | null | undefined;
}

// Interface for the original calculated data (easier to work with)
interface CalculatedStat {
  stat: string; // GP, G, A, PTS, SOG, PPP, HIT, BLK, PIM
  perGame: string;
  per82: string;
}

// Formatting functions remain the same
const formatStatValue = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return "-";
  }
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
  // Store the calculated stats in the original row format first
  const [calculatedStats, setCalculatedStats] = useState<CalculatedStat[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // useEffect for fetching data remains the same
  useEffect(() => {
    // ... (fetch logic unchanged) ...
    if (!playerId) {
      /* ... */ return;
    }
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      setTotalsData(null);
      setCalculatedStats([]);
      try {
        const data = await fetchPlayerPerGameTotals(playerId);
        if (data) {
          setTotalsData(data);
        } else {
          setError("No stats data found for this player.");
          setTotalsData(null);
        }
      } catch (err) {
        console.error("Failed...", err);
        setError("Failed...");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [playerId]);

  // useEffect for calculating stats remains largely the same, just storing the result
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
        { key: "pp_points", name: "PPP" },
        { key: "hits", name: "HIT" },
        { key: "blocked_shots", name: "BLK" },
        { key: "penalty_minutes", name: "PIM" }
      ];
      const newCalculatedStats = statsToCalculate.map(({ key, name }) => {
        const totalValue = totalsData[key] ?? 0;
        const perGameValue = Number(totalValue) / gp;
        const per82Value = perGameValue * 82;
        return {
          stat: name,
          perGame: formatStatValue(perGameValue),
          per82: formatPaceValue(per82Value)
        };
      });
      newCalculatedStats.unshift({
        stat: "GP",
        perGame: gp.toString(),
        per82: "-"
      });
      setCalculatedStats(newCalculatedStats);
      setError(null); // Clear previous errors if data is now valid
    } else {
      setCalculatedStats([]);
      if (
        totalsData &&
        (!totalsData.games_played || totalsData.games_played <= 0)
      ) {
        setError("Player has 0 games played.");
      } else if (!totalsData && !isLoading) {
        // Don't set an error if not loading and simply no data yet or player cleared
        // setError("No stats data available.");
      }
    }
  }, [totalsData, isLoading]); // Depend on isLoading to potentially clear error when loading starts

  // --- NEW Render Logic for Transposed Table ---
  const statHeaders = calculatedStats.map((item) => item.stat); // Get ["GP", "G", "A", ...]

  return (
    <div className={styles.perGameTableContainer}>
      {isLoading && (
        <div className={styles.loadingMessage}>Loading Stats...</div>
      )}
      {error && <div className={styles.errorMessage}>{error}</div>}
      {!isLoading && !error && calculatedStats.length === 0 && playerId && (
        <div className={styles.noDataMessage}>No data available.</div>
      )}
      {!isLoading && !error && calculatedStats.length > 0 && (
        // Add a class for specific transposed styling if needed
        <table className={styles.transposedTable}>
          <thead>
            <tr>
              {/* First header cell is empty or 'Metric' */}
              <th className={styles.metricHeaderCell}>Metric</th>
              {/* Map stat names (G, A, PTS...) as column headers */}
              {statHeaders.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Row 1: Per Game */}
            <tr>
              <th className={styles.rowHeaderCell}>Per/GP</th>
              {calculatedStats.map((item) => (
                <td key={`${item.stat}-perGame`}>{item.perGame}</td>
              ))}
            </tr>
            {/* Row 2: Per 82 */}
            <tr>
              <th className={styles.rowHeaderCell}>Per/82</th>
              {calculatedStats.map((item) => (
                <td key={`${item.stat}-per82`}>{item.per82}</td>
              ))}
            </tr>
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
