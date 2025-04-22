// /components/WiGO/RateStatPercentiles.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import styles from "styles/wigoCharts.module.scss"; // Assuming styles are shared or adjust path
import { fetchAllPlayerStatsForStrength } from "utils/fetchWigoPercentiles"; // Adjust path if needed
import { PlayerRawStats, PercentileStrength } from "components/WiGO/types";
import {
  calculatePercentileRank,
  calculatePlayerRank
} from "utils/calculatePercentiles";
import { formatOrdinal } from "utils/formattingUtils";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

interface RateStatPercentilesProps {
  playerId: number | null | undefined;
  minGp: number; // Received from parent
  onMinGpChange: (newMinGp: number) => void; // Handler received from parent
}

// --- Stat Definitions ---
const ALL_STATS_TO_DISPLAY: Array<{
  label: string;
  key: string;
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

// Type for calculated percentiles and ranks
type CalculatedData = {
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
  percentiles: CalculatedData | null,
  ranks: CalculatedData | null
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

  const backgroundColors = dataValues.map((value) => {
    if (value === null) {
      return "#555555"; // Grey for null values
    }

    const brandHue = 195; // Hue for brand blue (#14a2d2)
    const brandSaturation = 70;

    // Vary Lightness: Map percentile (0-100) to a lightness range.
    // 0 maps to 25% lightness (darker blue), 100 maps to 65% (brighter blue)
    const minLightness = 25;
    const maxLightness = 65;
    const lightness =
      minLightness + (value / 100) * (maxLightness - minLightness);

    return `hsl(${brandHue}, ${brandSaturation}%, ${lightness}%)`;
  });
  // --- End of NEW color generation ---

  const data: ChartData<"bar"> = {
    labels: labels,
    datasets: [
      {
        label: "Percentile Rank",
        data: dataValues,
        backgroundColor: backgroundColors,
        borderColor: backgroundColors,
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
        beginAtZero: true,
        max: 100,
        ticks: {
          color: "#ccc", // Consider using $text-color-secondary from vars?
          font: { size: 10 },
          stepSize: 20
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)" // Consider using $border-color-primary/secondary?
        }
      },
      x: {
        ticks: {
          display: false,
          color: "#ccc"
        },
        grid: {
          display: false
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y + "%";
            }
            return label;
          },
          title: function (context) {
            return context[0]?.label || "";
          }
        }
      },
      datalabels: {
        // Wrap configurations inside a 'labels' object
        labels: {
          // --- Configuration for Category Label (INSIDE bar) ---
          categoryLabel: {
            display: true,
            rotation: -90,
            color: (context) => {
              const value = context.dataset.data[context.dataIndex] as
                | number
                | null;
              return value !== null && value > 50 ? "#ffffff" : "#dddddd";
            },
            font: {
              size: 12,
              weight: "bolder",
              family: "Roboto Condensed",
              lineHeight: 1.2
            },
            anchor: "center",
            align: "center",
            formatter: (value, context) => {
              // Keep formatter for category name
              return (
                (context.chart.data.labels?.[context.dataIndex] as string) || ""
              );
            }
          },
          // --- Configuration for Value Label (ABOVE bar) ---
          valueLabel: {
            display: true,
            color: "#ccc",
            anchor: "end",
            align: "center",
            offset: 6,
            font: {
              size: 14,
              weight: "bolder",
              family: "Roboto Condensed"
            },
            formatter: (value, context) => {
              // Formatter for the value itself
              if (value === null) {
                return value + "%"; // Display the percentile value with a % sign
              }
            }
          },
          // --- NEW Rank Label (BELOW bar) ---
          rankLabel: {
            display: true,
            color: "#FFF", // Adjust color as needed
            anchor: "start", // Position at the bottom of the bar
            align: "center", // Center horizontally relative to the anchor
            offset: 10, // Distance below the bar (adjust as needed)
            font: {
              size: 12, // Adjust size
              weight: "bolder", // Adjust weight
              family: "Roboto Condensed"
            },
            formatter: (value, context) => {
              // Get the stat key corresponding to this bar's index
              const statKey = statsToDisplay[context.dataIndex]?.key;
              if (!statKey || !ranks) {
                return "-"; // No key or no rank data
              }
              // Retrieve the rank for this specific stat key
              const rank = ranks[statKey];
              // Format the rank using your existing utility
              return formatOrdinal(rank) ?? "-"; // Use formatOrdinal, default to '-'
            }
          }
        }
      }
    }
  };

  return { data, options };
};

// --- RateStatPercentiles Component ---
const RateStatPercentiles: React.FC<RateStatPercentilesProps> = ({
  playerId,
  minGp,
  onMinGpChange
}) => {
  const [selectedStrength, setSelectedStrength] =
    useState<PercentileStrength>("as");
  const [allPlayersStats, setAllPlayersStats] = useState<PlayerRawStats[]>([]);
  const [calculatedPercentiles, setCalculatedPercentiles] =
    useState<CalculatedData | null>(null);
  const [calculatedRanks, setCalculatedRanks] = // <-- NEW STATE FOR RANKS
    useState<CalculatedData | null>(null);

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
      setCalculatedRanks(null); // Clear old ranks

      try {
        const data = await fetchAllPlayerStatsForStrength(selectedStrength);
        setAllPlayersStats(data);

        // Calculate the overall max GP for fallback purposes
        const maxGpOverall = data.reduce(
          (max, p) => Math.max(max, p.gp ?? 0),
          0
        );
        setMaxPossibleGp(maxGpOverall > 0 ? maxGpOverall : 82); // Use league max as fallback max

        // --- Find selected player's GP immediately after fetch ---
        // --- This ensures selectedPlayerGp state is updated when strength changes ---
        if (playerId) {
          const newlyFetchedPlayerData = data.find(
            (p) => p.player_id === playerId
          );
          setSelectedPlayerGp(newlyFetchedPlayerData?.gp ?? null);
        } else {
          setSelectedPlayerGp(null); // Clear if no player ID
        }
      } catch (err: any) {
        console.error("Failed to load all player data:", err);
        setError(
          `Failed to load player list: ${err.message || "Unknown error"}`
        );
        setAllPlayersStats([]);
        setSelectedPlayerGp(null); // Clear GP on error
      } finally {
        setIsLoading(false);
      }
    };
    loadAllPlayerData();
    // Depend on selectedStrength AND playerId so selectedPlayerGp updates if playerId changes *without* strength changing
  }, [selectedStrength, playerId]);

  // --- Calculation Logic (Percentiles and Ranks) ---
  useEffect(() => {
    if (!playerId || allPlayersStats.length === 0) {
      /* ... clear state ... */ return;
    }
    const selectedPlayerData = allPlayersStats.find(
      (p) => p.player_id === playerId
    );
    const currentPlayerGp = selectedPlayerData?.gp ?? null;
    setSelectedPlayerGp(currentPlayerGp);

    const filteredPlayers = allPlayersStats.filter(
      (p) => p.gp !== null && p.gp >= minGp
    );

    // If filtering results in no players (e.g., minGp is too high), clear results
    if (filteredPlayers.length === 0) {
      setCalculatedPercentiles({});
      setCalculatedRanks({});
      return;
    }

    const percentileResults: CalculatedData = {};
    const rankResults: CalculatedData = {};

    // --- Calculate TOI/GP Separately ---
    const toiGpData = filteredPlayers
      .map((p) => ({
        player_id: p.player_id,
        // Ensure both toi and gp are numbers before division
        value:
          p.toi != null && p.gp != null && p.gp > 0
            ? Number(p.toi) / Number(p.gp)
            : null
      }))
      .filter(
        (p): p is { player_id: number; value: number } => p.value !== null
      );

    percentileResults["toi_per_gp_calc"] = calculatePercentileRank(
      toiGpData,
      playerId,
      "value",
      true // higherIsBetter
    );
    rankResults["toi_per_gp_calc"] = calculatePlayerRank(
      toiGpData,
      playerId,
      true // higherIsBetter
    );

    // --- Calculate Other Stats ---
    ALL_STATS_TO_DISPLAY.forEach((stat) => {
      if (stat.key === "toi_per_gp_calc") return; // Already calculated

      const validStatKey = stat.key as keyof PlayerRawStats;

      // Prepare data for the current stat
      const statData = filteredPlayers
        .map((p) => ({
          player_id: p.player_id,
          value: p[validStatKey] as number | null // Cast necessary? Check type
        }))
        .filter(
          (p): p is { player_id: number; value: number } =>
            p.value !== null && !isNaN(p.value)
        ); // Ensure value is non-null number

      // Calculate percentile
      percentileResults[validStatKey] = calculatePercentileRank(
        statData,
        playerId,
        "value",
        stat.higherIsBetter
      );

      // Calculate rank
      rankResults[validStatKey] = calculatePlayerRank(
        statData,
        playerId,
        stat.higherIsBetter
      );
    });

    setCalculatedPercentiles(percentileResults);
    setCalculatedRanks(rankResults); // <-- Set the ranks state
  }, [allPlayersStats, playerId, minGp]);

  // Handlers (remain the same)
  const handleStrengthChange = useCallback((strength: PercentileStrength) => {
    setSelectedStrength(strength);
  }, []);

  const handleSliderChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onMinGpChange(Number(event.target.value)); // Call parent's handler
    },
    [onMinGpChange]
  );

  // Memoized check (remains the same)
  const selectedPlayerMeetsGpThreshold = useMemo(() => {
    return selectedPlayerGp !== null && selectedPlayerGp >= minGp;
  }, [selectedPlayerGp, minGp]);

  // --- Determine the slider's actual max value ---
  // Use selected player's GP if available and positive, otherwise fallback
  const sliderMax =
    selectedPlayerGp !== null && selectedPlayerGp > 0
      ? selectedPlayerGp
      : maxPossibleGp > 0
      ? maxPossibleGp
      : 1; // Use league max as fallback, ensure > 0

  // --- Generate Chart Configs ---
  // Use useMemo to prevent regenerating chart configs on every render unless data changes
  const combinedChartConfig = useMemo(
    () =>
      generateChartConfig(
        "Player Percentile Ranks",
        ALL_STATS_TO_DISPLAY,
        calculatedPercentiles,
        calculatedRanks
      ),
    [calculatedPercentiles, calculatedRanks]
  ); // Recalculate only when percentiles change

  return (
    <div className={styles.rateStatPercentilesComponent}>
      {/* Loading / Error / No Player Messages - Render these first if applicable */}
      {isLoading && (
        <div className={styles.loadingMessage}>Loading Player Data...</div>
      )}
      {!isLoading && error && (
        <div className={styles.errorMessage}>{error}</div>
      )}
      {!isLoading && !error && allPlayersStats.length === 0 && (
        <div className={styles.noDataMessage}>
          No player data available for {selectedStrength.toUpperCase()}.
        </div>
      )}
      {!isLoading && !error && !playerId && (
        <div className={styles.noPlayerMessage}>Please select a player.</div>
      )}

      {/* Main Content: Filters (Left) + Chart & Ranks (Right) */}
      {!isLoading && !error && playerId && (
        <div className={styles.mainContentWrapper}>
          {/* Filters Container */}
          <div className={styles.percentileFiltersContainer}>
            <h1 className={styles.filtersTitle}>Rate Stat Percentiles</h1>
            {/* NEW Wrapper for side-by-side controls */}
            <div className={styles.filterControlsWrapper}>
              {/* Strength Selector (Left side of wrapper) */}
              <div className={styles.strengthSelector}>
                {(["as", "es", "pp", "pk"] as PercentileStrength[]).map(
                  (strength) => (
                    <button
                      key={strength}
                      onClick={() => handleStrengthChange(strength)}
                      className={
                        selectedStrength === strength ? styles.active : ""
                      }
                      disabled={isLoading}
                    >
                      {strength.toUpperCase()}
                    </button>
                  )
                )}
              </div>{" "}
              {/* End Strength Selector */}
              {/* GP Slider Container (Right side of wrapper - Vertical Slider) */}
              <div className={styles.gpSliderContainer}>
                {/* Position Label Above */}
                <label htmlFor="gpSlider">
                  Min GP:
                  <span className={styles.minGpValue}>{minGp}</span>
                </label>
                {/* Display Max Value (Top of slider range) */}
                <span className={styles.gpSliderMaxLabel}>
                  {sliderMax > 1
                    ? sliderMax
                    : selectedPlayerGp !== null
                    ? selectedPlayerGp
                    : ""}{" "}
                  {/* Show player GP if available, else the fallback if > 1 */}
                </span>

                <input
                  type="range"
                  id="gpSlider"
                  min="0"
                  max={sliderMax}
                  value={minGp}
                  onChange={handleSliderChange}
                  disabled={isLoading || allPlayersStats.length === 0}
                  className={styles.gpSlider}
                  // Add orient="vertical" for semantic correctness, though CSS handles appearance
                  // Note: `orient` attribute is deprecated/non-standard for input[type=range] in HTML5
                  // Use CSS `appearance` or `transform` instead.
                  style={
                    {
                      "--min": 0,
                      "--max": sliderMax,
                      "--val": minGp
                    } as React.CSSProperties
                  } // Optional: For custom styling track fill
                />

                <span className={styles.gpSliderMinLabel}>0</span>
              </div>
            </div>

            <div className={styles.thresholdMessagesContainer}>
              {calculatedPercentiles !== null &&
                !selectedPlayerMeetsGpThreshold &&
                selectedPlayerGp !== null && (
                  <div className={styles.thresholdMessage}>
                    Selected Player GP ({selectedPlayerGp}) below threshold (
                    {minGp}). Comparing against {minGp}+ GP players.
                  </div>
                )}
              {/* Message if player has 0 GP for this strength */}
              {selectedPlayerGp === 0 && (
                <div className={styles.thresholdMessage}>
                  Selected Player has 0 GP for {selectedStrength.toUpperCase()}.
                </div>
              )}
              {/* Message if player has null GP (data missing) */}
              {selectedPlayerGp === null && playerId && !isLoading && (
                <div className={styles.thresholdMessage}>
                  Selected Player has no GP data for{" "}
                  {selectedStrength.toUpperCase()}.
                </div>
              )}
            </div>
          </div>
          {/* Chart Area + Ranks Area (Takes remaining space on the Right) */}
          {/* Wrap Chart and Ranks together */}
          <div className={styles.chartAndRanksArea}>
            {/* Chart Container */}
            <div className={styles.percentileChartsContainer}>
              {calculatedPercentiles !== null ? (
                <Bar
                  options={combinedChartConfig.options}
                  data={combinedChartConfig.data}
                  plugins={[ChartDataLabels]}
                />
              ) : (
                <div className={styles.chartLoadingPlaceholder}>
                  Calculating...
                </div>
              )}
            </div>{" "}
            {/* End Chart Container */}
            {/* Ranks Container - Display ranks only if calculated */}
          </div>{" "}
          {/* End Chart And Ranks Area */}
        </div> // End Main Content Wrapper
      )}
    </div> // End Component Root
  );
};

export default RateStatPercentiles;
