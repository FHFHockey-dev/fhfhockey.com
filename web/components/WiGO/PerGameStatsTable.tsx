// components/WiGO/PerGameStatsTable.tsx
import React, { useState, useEffect } from "react";
import supabase from "lib/supabase"; // Adjust path if necessary
import {
  fetchPlayerPerGameTotals,
  SkaterTotalsData
} from "utils/fetchWigoPlayerStats"; // Adjust path
import styles from "./PerGameStatsTable.module.scss"; // We'll create this SCSS file next

interface PerGameStatsTableProps {
  playerId: number | null | undefined;
}

interface CalculatedStatRow {
  stat: string; // Display name (e.g., "Goals", "PP Points")
  perGame: string; // Formatted string
  per82: string; // Formatted string
}

// Simple number formatting utility (adjust precision as needed)
const formatStatValue = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return "-"; // Or '0.00' or '' depending on preference
  }
  // Format to 2 decimal places for rates
  return value.toFixed(2);
};

// Integer formatting for 82-game pace
const formatPaceValue = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return "-";
  }
  // Round to nearest integer for pace
  return Math.round(value).toString();
};

const PerGameStatsTable: React.FC<PerGameStatsTableProps> = ({ playerId }) => {
  const [totalsData, setTotalsData] = useState<SkaterTotalsData | null>(null);
  const [calculatedStats, setCalculatedStats] = useState<CalculatedStatRow[]>(
    []
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) {
      setTotalsData(null);
      setCalculatedStats([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      setTotalsData(null); // Clear previous data
      setCalculatedStats([]);

      try {
        const data = await fetchPlayerPerGameTotals(playerId);
        if (data) {
          setTotalsData(data);
        } else {
          setError("No stats data found for this player."); // Or handle silently
          setTotalsData(null); // Ensure it's null if no data
        }
      } catch (err) {
        console.error("Failed to load per game totals:", err);
        setError("Failed to load stats.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [playerId]); // Re-run effect when playerId changes

  useEffect(() => {
    // Calculate stats whenever totalsData changes
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
        const totalValue = totalsData[key] ?? 0; // Default nulls to 0
        const perGameValue = Number(totalValue) / gp; // Ensure totalValue is treated as a number
        const per82Value = perGameValue * 82;

        return {
          stat: name,
          perGame: formatStatValue(perGameValue),
          per82: formatPaceValue(per82Value) // Format pace as integer
        };
      });

      // Add Games Played row separately
      newCalculatedStats.unshift({
        stat: "GP",
        perGame: gp.toString(),
        per82: "-" // Pace doesn't apply to GP
      });

      setCalculatedStats(newCalculatedStats);
    } else {
      // Clear calculated stats if no data or games played is 0
      setCalculatedStats([]);
      // Optionally set an error/message if gp is 0 but data exists
      if (
        totalsData &&
        (!totalsData.games_played || totalsData.games_played <= 0)
      ) {
        setError("Player has 0 games played.");
      }
    }
  }, [totalsData]); // Re-run calculation when totalsData is updated

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
        <table>
          <thead>
            <tr>
              <th>Stat</th>
              <th>Per/GP</th>
              <th>Per/82</th>
            </tr>
          </thead>
          <tbody>
            {calculatedStats.map((row) => (
              <tr
                key={row.stat}
                className={row.stat === "GP" ? styles.gpRowHighlight : ""}
              >
                <td>{row.stat}</td>
                <td>{row.perGame}</td>
                <td>{row.per82}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {/* Placeholder if no player is selected */}
      {!playerId && !isLoading && (
        <div className={styles.noPlayerMessage}>
          Select a player to view stats.
        </div>
      )}
    </div>
  );
};

export default PerGameStatsTable;
