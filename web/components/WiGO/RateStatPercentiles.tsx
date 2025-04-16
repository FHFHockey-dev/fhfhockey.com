// /components/WiGO/RateStatPercentiles.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Bar } from "react-chartjs-2"; // Import the Bar component
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData,
  ScriptableContext
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels"; // Import the plugin
import styles from "styles/wigoCharts.module.scss";
import { fetchAllPlayerStatsForStrength } from "utils/fetchWigoPercentiles"; // Adjust path if needed
import { PlayerRawStats, PercentileStrength } from "components/WiGO/types"; // Adjust path if needed
import { calculatePercentileRank } from "utils/calculatePercentiles"; // Adjust path if needed

// Register Chart.js components and the datalabels plugin
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels // Register the plugin
);

interface RateStatPercentilesProps {
  playerId: number | null | undefined;
}

// --- Stat Definitions ---
const ALL_STATS_TO_DISPLAY: Array<{
  label: string;
  key: keyof PlayerRawStats | "toi_per_gp_calc";
  higherIsBetter: boolean;
}> = [
  // Rate Stats
  { label: "TOI/GP", key: "toi_per_gp_calc", higherIsBetter: true },
  { label: "G/60", key: "goals_per_60", higherIsBetter: true },
  { label: "A/60", key: "total_assists_per_60", higherIsBetter: true },
  { label: "Pts/60", key: "total_points_per_60", higherIsBetter: true },
  { label: "SOG/60", key: "shots_per_60", higherIsBetter: true },
  { label: "iSCF/60", key: "iscfs_per_60", higherIsBetter: true },
  { label: "iHDCF/60", key: "i_hdcf_per_60", higherIsBetter: true },
  { label: "ixG/60", key: "ixg_per_60", higherIsBetter: true },
  { label: "iCF/60", key: "icf_per_60", higherIsBetter: true },
  { label: "CF/60", key: "cf_per_60", higherIsBetter: true },
  { label: "SCF/60", key: "scf_per_60", higherIsBetter: true },
  { label: "HDCF/60", key: "oi_hdcf_per_60", higherIsBetter: true },
  // Percentage Stats
  { label: "CF%", key: "cf_pct", higherIsBetter: true },
  { label: "SF%", key: "sf_pct", higherIsBetter: true },
  { label: "GF%", key: "gf_pct", higherIsBetter: true },
  { label: "SCF%", key: "scf_pct", higherIsBetter: true },
  { label: "HDCF%", key: "hdcf_pct", higherIsBetter: true },
  { label: "xGF%", key: "xgf_pct", higherIsBetter: true }
];

// Type for the calculated percentiles state
type CalculatedPercentiles = {
  [key: string]: number | null;
};

// --- Chart.js Helper Function ---
const generateChartConfig = (
  title: string,
  statsToDisplay: Array<{
    label: string;
    key: string;
    higherIsBetter: boolean;
  }>,
  percentiles: CalculatedPercentiles | null
): { data: ChartData<"bar">; options: ChartOptions<"bar"> } => {
  const labels = statsToDisplay.map((stat) => stat.label);
  const dataValues = statsToDisplay.map((stat) => {
    const percentile = percentiles ? percentiles[stat.key] : null;
    const validPercentile =
      percentile !== null && !isNaN(percentile)
        ? Math.max(0, Math.min(1, percentile))
        : null;
    return validPercentile !== null ? Math.round(validPercentile * 100) : null; // Scale to 0-100
  });

  // Generate background colors based on value (Green=100, Red=0)
  const backgroundColors = dataValues.map((value) => {
    if (value === null) return "#555"; // Grey for null
    return `hsl(${(value / 100) * 120}, 70%, 45%)`;
  });

  const data: ChartData<"bar"> = {
    labels: labels,
    datasets: [
      {
        label: "Percentile Rank",
        data: dataValues,
        backgroundColor: backgroundColors,
        borderColor: backgroundColors, // Optional: border color same as bg
        borderWidth: 1
      }
    ]
  };

  const options: ChartOptions<"bar"> = {
    indexAxis: "x", // Vertical bars
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        // The value axis (0-100)
        beginAtZero: true,
        max: 100,
        ticks: {
          color: "#ccc",
          font: { size: 10 },
          stepSize: 20 // Adjust step size as needed
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)"
        }
      },
      x: {
        // The category axis (stat labels)
        ticks: {
          display: false, // Hide labels on axis, we'll use datalabels
          color: "#ccc",
          font: { size: 12 }
        },
        grid: {
          display: false // Hide vertical grid lines
        }
      }
    },
    plugins: {
      legend: {
        display: false // Hide dataset legend
      },
      tooltip: {
        // Customize tooltips
        enabled: true,
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y + "%"; // Add percentage sign
            }
            return label;
          },
          title: function (context) {
            // Show the stat label (e.g., "G/60") as the tooltip title
            return context[0]?.label || "";
          }
        }
      },
      datalabels: {
        // Configure the datalabels plugin
        display: true,
        rotation: -90,
        color: (context) => {
          // Basic contrast check: white text on darker/taller bars
          // Type inference should handle the context type correctly here
          const value = context.dataset.data[context.dataIndex] as
            | number
            | null;
          return value !== null && value > 50 ? "#ffffff" : "#dddddd";
        },
        font: {
          size: 12, // Adjust font size
          weight: "bold",
          family: "Roboto Condensed",
          lineHeight: 1.2 // Adjust line height for better spacing
        },
        anchor: "center", // Anchor the label text to the center of the bar
        align: "center", // Align the label text to the center of the bar
        formatter: (value, context) => {
          // Display the category label (e.g., "G/60") inside the bar
          return (
            (context.chart.data.labels?.[context.dataIndex] as string) || ""
          );
        }
        // Optional: Add padding or offset if needed
        // offset: 10,
        // padding: 0,
      }
    }
  };

  return { data, options };
};

// --- RateStatPercentiles Component ---
const RateStatPercentiles: React.FC<RateStatPercentilesProps> = ({
  playerId
}) => {
  const [selectedStrength, setSelectedStrength] =
    useState<PercentileStrength>("as");
  const [allPlayersStats, setAllPlayersStats] = useState<PlayerRawStats[]>([]);
  const [calculatedPercentiles, setCalculatedPercentiles] =
    useState<CalculatedPercentiles | null>(null);
  const [minGp, setMinGp] = useState<number>(10);
  const [maxPossibleGp, setMaxPossibleGp] = useState<number>(82);
  const [selectedPlayerGp, setSelectedPlayerGp] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // --- Fetching Logic ---
  useEffect(() => {
    const loadAllPlayerData = async () => {
      setIsLoading(true);
      setError(null);
      setAllPlayersStats([]);
      setCalculatedPercentiles(null); // Clear old calculations
      setSelectedPlayerGp(null);

      try {
        const data = await fetchAllPlayerStatsForStrength(selectedStrength);
        setAllPlayersStats(data);
        const maxGp = data.reduce((max, p) => Math.max(max, p.gp ?? 0), 0);
        setMaxPossibleGp(maxGp > 0 ? maxGp : 82);
      } catch (err: any) {
        console.error("Failed to load all player data:", err);
        setError(
          `Failed to load player list: ${err.message || "Unknown error"}`
        );
        setAllPlayersStats([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadAllPlayerData();
  }, [selectedStrength]);

  // --- Calculation Logic ---
  useEffect(() => {
    if (!playerId || allPlayersStats.length === 0) {
      setCalculatedPercentiles(null);
      setSelectedPlayerGp(null);
      return;
    }
    const selectedPlayerData = allPlayersStats.find(
      (p) => p.player_id === playerId
    );
    setSelectedPlayerGp(selectedPlayerData?.gp ?? null);
    const filteredPlayers = allPlayersStats.filter(
      (p) => p.gp !== null && p.gp >= minGp
    );
    if (filteredPlayers.length === 0) {
      setCalculatedPercentiles({});
      return;
    }
    const results: CalculatedPercentiles = {};
    const toiGpData = filteredPlayers
      .map((p) => ({
        player_id: p.player_id,
        value: p.toi !== null && p.gp !== null && p.gp > 0 ? p.toi / p.gp : null
      }))
      .filter((p) => p.value !== null) as Array<{
      player_id: number;
      value: number;
    }>;
    results["toi_per_gp_calc"] = calculatePercentileRank(
      toiGpData,
      playerId,
      "value",
      true
    );
    ALL_STATS_TO_DISPLAY.forEach((stat) => {
      if (stat.key === "toi_per_gp_calc") return;
      const validStatKey = stat.key as keyof PlayerRawStats;
      const statData = filteredPlayers
        .map((p) => ({
          player_id: p.player_id,
          value: p[validStatKey] as number | null
        }))
        .filter((p) => p.value !== null) as Array<{
        player_id: number;
        value: number;
      }>;
      results[validStatKey] = calculatePercentileRank(
        statData,
        playerId,
        "value",
        stat.higherIsBetter
      );
    });
    setCalculatedPercentiles(results);
  }, [allPlayersStats, playerId, minGp]);

  // Handlers (remain the same)
  const handleStrengthChange = useCallback((strength: PercentileStrength) => {
    /* ... */ setSelectedStrength(strength);
  }, []);
  const handleGpChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      /* ... */ setMinGp(Number(event.target.value));
    },
    []
  );

  // Memoized check (remains the same)
  const selectedPlayerMeetsGpThreshold = useMemo(() => {
    /* ... */ return selectedPlayerGp !== null && selectedPlayerGp >= minGp;
  }, [selectedPlayerGp, minGp]);

  // --- Generate Chart Configs ---
  // Use useMemo to prevent regenerating chart configs on every render unless data changes
  // --- Generate SINGLE Chart Config ---
  const combinedChartConfig = useMemo(
    () =>
      generateChartConfig(
        "Player Percentile Ranks", // New title (optional)
        ALL_STATS_TO_DISPLAY, // Use the combined stats list
        calculatedPercentiles
      ),
    [calculatedPercentiles]
  ); // Recalculate only when percentiles change

  return (
    <div className={styles.rateStatPercentilesComponent}>
      {/* Filters Container (remains the same) */}
      <div className={styles.percentileFiltersContainer}>
        {/* ... filters ... */}
        <div className={styles.strengthSelector}>
          {(["as", "es", "pp", "pk"] as PercentileStrength[]).map(
            (strength /* ... buttons ... */) => (
              <button
                key={strength}
                onClick={() => handleStrengthChange(strength)}
                className={selectedStrength === strength ? styles.active : ""}
                disabled={isLoading}
              >
                {strength.toUpperCase()}
              </button>
            )
          )}
        </div>
        <div className={styles.gpSliderContainer}>
          <label htmlFor="gpSlider">Min GP: {minGp}</label>
          <input
            type="range"
            id="gpSlider"
            min="0"
            max={maxPossibleGp}
            value={minGp}
            onChange={handleGpChange}
            disabled={isLoading || allPlayersStats.length === 0}
            className={styles.gpSlider}
          />
          <span>{maxPossibleGp > 0 ? maxPossibleGp : ""}</span>
        </div>
      </div>

      {/* Loading / Error / Threshold Messages (remain the same) */}
      {/* ... loading/error messages ... */}
      {isLoading && (
        <div className={styles.loadingMessage}>Loading Player Data...</div>
      )}
      {error && !isLoading && (
        <div className={styles.errorMessage}>{error}</div>
      )}
      {!isLoading && !error && allPlayersStats.length === 0 && !error && (
        <div className={styles.noDataMessage}>
          No player data loaded for {selectedStrength.toUpperCase()}.
        </div>
      )}
      {!isLoading && !error && !playerId && (
        <div className={styles.noPlayerMessage}>Select a player.</div>
      )}
      {!isLoading &&
        !error &&
        playerId &&
        calculatedPercentiles !== null &&
        !selectedPlayerMeetsGpThreshold &&
        selectedPlayerGp !== null && (
          <div className={styles.thresholdMessage}>
            Selected Player GP ({selectedPlayerGp}) is below threshold ({minGp}
            ). Percentiles relative to {minGp}+ GP players.
          </div>
        )}
      {!isLoading &&
        !error &&
        playerId &&
        calculatedPercentiles !== null &&
        selectedPlayerGp === null && (
          <div className={styles.thresholdMessage}>
            Selected Player has no GP data for {selectedStrength.toUpperCase()}.
          </div>
        )}

      {/* --- SINGLE Chart Container --- */}
      {!isLoading && !error && playerId && calculatedPercentiles !== null && (
        // Use the existing container class, or rename if desired
        <div className={styles.percentileChartsContainer}>
          {/* Render only ONE Bar component */}
          <Bar
            options={combinedChartConfig.options}
            data={combinedChartConfig.data}
            // If using local plugin registration, add it here:
            plugins={[ChartDataLabels]}
          />
        </div>
      )}
    </div>
  );
};

export default RateStatPercentiles;
