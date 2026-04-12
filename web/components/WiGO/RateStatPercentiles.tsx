import React, { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import styles from "styles/wigoCharts.module.scss";
import { fetchPercentileCohortForPlayer } from "utils/fetchWigoPercentiles";
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
  seasonId?: number | null;
  minGp: number;
  onMinGpChange: (newMinGp: number) => void;
}

const ALL_STATS_TO_DISPLAY: Array<{
  label: string;
  key: string;
  higherIsBetter: boolean;
}> = [
  { label: "TOI/GP", key: "toi_per_gp_calc", higherIsBetter: true },
  { label: "G/60", key: "goals_per_60", higherIsBetter: true },
  { label: "A/60", key: "total_assists_per_60", higherIsBetter: true },
  { label: "Pts/60", key: "total_points_per_60", higherIsBetter: true },
  { label: "SOG/60", key: "shots_per_60", higherIsBetter: true },
  { label: "iSCF/60", key: "iscfs_per_60", higherIsBetter: true },
  { label: "iHDCF/60", key: "i_hdcf_per_60", higherIsBetter: true },
  { label: "ixG/60", key: "ixg_per_60", higherIsBetter: true },
  { label: "iCF/60", key: "icf_per_60", higherIsBetter: true },
  { label: "SCF/60", key: "scf_per_60", higherIsBetter: true },
  { label: "HDCF/60", key: "oi_hdcf_per_60", higherIsBetter: true },
  { label: "CF%", key: "cf_pct", higherIsBetter: true },
  { label: "SF%", key: "sf_pct", higherIsBetter: true },
  { label: "GF%", key: "gf_pct", higherIsBetter: true },
  { label: "SCF%", key: "scf_pct", higherIsBetter: true },
  { label: "HDCF%", key: "hdcf_pct", higherIsBetter: true }
];

type CalculatedData = {
  [key: string]: number | null;
};

const generateChartConfig = (
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
    return validPercentile !== null ? Math.round(validPercentile * 100) : null;
  });

  const backgroundColors = dataValues.map((value) => {
    if (value === null) {
      return "#555555";
    }

    const brandHue = 195;
    const brandSaturation = 70;
    const minLightness = 25;
    const maxLightness = 65;
    const lightness =
      minLightness + (value / 100) * (maxLightness - minLightness);

    return `hsl(${brandHue}, ${brandSaturation}%, ${lightness}%)`;
  });
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
    indexAxis: "x",
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          color: "#ccc",
          font: { size: 10 },
          stepSize: 20
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)"
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
        labels: {
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
              size: 14,
              weight: "bolder",
              family: "Roboto Condensed",
              lineHeight: 1.2
            },
            anchor: "center",
            align: "center",
            formatter: (value, context) =>
              (context.chart.data.labels?.[context.dataIndex] as string) || ""
          },
          valueLabel: {
            display: true,
            color: "#fff",
            anchor: "end",
            align: "center",
            offset: 6,
            font: {
              size: 16,
              weight: "bolder",
              family: "Roboto Condensed"
            },
            formatter: (value) => (value === null ? null : `${value}%`)
          },
          rankLabel: {
            display: true,
            color: "#FFF",
            anchor: "start",
            align: "center",
            offset: 10,
            font: {
              size: 14,
              weight: "bolder",
              family: "Roboto Condensed"
            },
            formatter: (value, context) => {
              const statKey = statsToDisplay[context.dataIndex]?.key;
              if (!statKey || !ranks) {
                return "-";
              }
              const rank = ranks[statKey];
              return formatOrdinal(rank) ?? "-";
            }
          }
        }
      }
    }
  };

  return { data, options };
};

const RateStatPercentiles: React.FC<RateStatPercentilesProps> = ({
  playerId,
  seasonId,
  minGp,
  onMinGpChange
}) => {
  const [selectedStrength, setSelectedStrength] =
    useState<PercentileStrength>("as");
  const {
    data: percentileCohort,
    isLoading,
    error
  } = useQuery({
    queryKey: ["wigoPercentileStats", selectedStrength, seasonId, playerId],
    queryFn: () =>
      fetchPercentileCohortForPlayer(
        selectedStrength,
        seasonId as number,
        playerId as number
      ),
    enabled: typeof seasonId === "number" && typeof playerId === "number"
  });
  const allPlayersStats: PlayerRawStats[] = percentileCohort?.stats ?? [];
  const usingFallbackSeason =
    (percentileCohort?.appliedSeasonId ?? seasonId) !==
    (percentileCohort?.requestedSeasonId ?? seasonId);

  const maxPossibleGp = useMemo(() => {
    const maxGpOverall = allPlayersStats.reduce(
      (max, player) => Math.max(max, player.gp ?? 0),
      0
    );

    return maxGpOverall > 0 ? maxGpOverall : 82;
  }, [allPlayersStats]);

  const selectedPlayerGp = useMemo(() => {
    if (!playerId) {
      return null;
    }

    const cohortGp =
      allPlayersStats.find((player) => player.player_id === playerId)?.gp ?? null;

    return percentileCohort?.canonicalPlayerGp ?? cohortGp;
  }, [allPlayersStats, percentileCohort?.canonicalPlayerGp, playerId]);

  const { calculatedPercentiles, calculatedRanks } = useMemo(() => {
    if (!playerId || allPlayersStats.length === 0) {
      return {
        calculatedPercentiles: null as CalculatedData | null,
        calculatedRanks: null as CalculatedData | null
      };
    }

    const filteredPlayers = allPlayersStats.filter(
      (player) =>
        player.gp !== null &&
        (player.gp >= minGp || player.player_id === playerId)
    );

    if (filteredPlayers.length === 0) {
      return {
        calculatedPercentiles: {} as CalculatedData,
        calculatedRanks: {} as CalculatedData
      };
    }

    const percentileResults: CalculatedData = {};
    const rankResults: CalculatedData = {};

    const toiGpData = filteredPlayers
      .map((player) => ({
        player_id: player.player_id,
        value:
          player.toi != null && player.gp != null && player.gp > 0
            ? Number(player.toi) / Number(player.gp)
            : null
      }))
      .filter(
        (player): player is { player_id: number; value: number } =>
          player.value !== null
      );

    percentileResults.toi_per_gp_calc = calculatePercentileRank(
      toiGpData,
      playerId,
      "value",
      true
    );
    rankResults.toi_per_gp_calc = calculatePlayerRank(
      toiGpData,
      playerId,
      true
    );

    ALL_STATS_TO_DISPLAY.forEach((stat) => {
      if (stat.key === "toi_per_gp_calc") {
        return;
      }

      const validStatKey = stat.key as keyof PlayerRawStats;
      const statData = filteredPlayers
        .map((player) => ({
          player_id: player.player_id,
          value: player[validStatKey] as number | null
        }))
        .filter(
          (player): player is { player_id: number; value: number } =>
            player.value !== null && !isNaN(player.value)
        );

      percentileResults[validStatKey] = calculatePercentileRank(
        statData,
        playerId,
        "value",
        stat.higherIsBetter
      );
      rankResults[validStatKey] = calculatePlayerRank(
        statData,
        playerId,
        stat.higherIsBetter
      );
    });

    return {
      calculatedPercentiles: percentileResults,
      calculatedRanks: rankResults
    };
  }, [allPlayersStats, minGp, playerId]);

  const handleStrengthChange = useCallback((strength: PercentileStrength) => {
    setSelectedStrength(strength);
  }, []);

  const handleSliderChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onMinGpChange(Number(event.target.value));
    },
    [onMinGpChange]
  );

  const selectedPlayerMeetsGpThreshold = useMemo(() => {
    return selectedPlayerGp !== null && selectedPlayerGp >= minGp;
  }, [selectedPlayerGp, minGp]);

  const sliderMax =
    Math.max(selectedPlayerGp ?? 0, maxPossibleGp, 1);

  const combinedChartConfig = useMemo(
    () =>
      generateChartConfig(
        ALL_STATS_TO_DISPLAY,
        calculatedPercentiles,
        calculatedRanks
      ),
    [calculatedPercentiles, calculatedRanks]
  );

  return (
    <div className={styles.rateStatPercentilesComponent}>
      {isLoading && (
        <div className={styles.loadingMessage}>Loading Player Data...</div>
      )}
      {!isLoading && error && (
        <div className={styles.errorMessage}>
          Failed to load player list:{" "}
          {error instanceof Error ? error.message || "Unknown error" : "Unknown error"}
        </div>
      )}
      {!isLoading && !error && !seasonId && playerId && (
        <div className={styles.loadingMessage}>Loading season info...</div>
      )}
      {!isLoading && !error && seasonId && allPlayersStats.length === 0 && (
        <div className={styles.noDataMessage}>
          No player data available for {selectedStrength.toUpperCase()}.
        </div>
      )}
      {!isLoading && !error && !playerId && (
        <div className={styles.noPlayerMessage}>Please select a player.</div>
      )}

      {!isLoading && !error && playerId && seasonId && (
        <div className={styles.mainContentWrapper}>
          <div className={styles.percentileFiltersContainer}>
            <h1 className={styles.filtersTitle}>Rate Stat Percentiles</h1>
            <div className={styles.filterControlsWrapper}>
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
              </div>
              <div className={styles.gpSliderContainer}>
                <label htmlFor="gpSlider">
                  Min GP:
                  <span className={styles.minGpValue}>{minGp}</span>
                </label>
                <span className={styles.gpSliderMaxLabel}>
                  {sliderMax > 1
                    ? sliderMax
                    : selectedPlayerGp !== null
                    ? selectedPlayerGp
                    : ""}
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
                  style={
                    {
                      "--min": 0,
                      "--max": sliderMax,
                      "--val": minGp
                    } as React.CSSProperties
                  }
                />

                <span className={styles.gpSliderMinLabel}>0</span>
              </div>
            </div>

            <div className={styles.thresholdMessagesContainer}>
              {calculatedPercentiles !== null &&
                percentileCohort?.fallbackReason && (
                <div className={styles.thresholdMessage}>
                  {percentileCohort.fallbackReason}
                </div>
              )}
              {calculatedPercentiles !== null &&
                !usingFallbackSeason &&
                !selectedPlayerMeetsGpThreshold &&
                selectedPlayerGp !== null && (
                <div className={styles.thresholdMessage}>
                  Selected Player GP ({selectedPlayerGp}) below threshold (
                  {minGp}). Comparing against {minGp}+ GP players.
                </div>
              )}
              {selectedPlayerGp === 0 && (
                <div className={styles.thresholdMessage}>
                  Selected Player has 0 GP for {selectedStrength.toUpperCase()}.
                </div>
              )}
              {selectedPlayerGp === null && playerId && !isLoading && (
                <div className={styles.thresholdMessage}>
                  Selected Player has no GP data for{" "}
                  {selectedStrength.toUpperCase()}.
                </div>
              )}
            </div>
          </div>
          <div className={styles.chartAndRanksArea}>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RateStatPercentiles;
