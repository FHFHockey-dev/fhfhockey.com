import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from "chart.js";
import {
  fetchPlayerGameLogConsistencyData
} from "utils/fetchWigoPlayerStats";
import { formatPercentage } from "utils/formattingUtils";
import styles from "styles/wigoCharts.module.scss";
import {
  WIGO_COLORS,
  CHART_COLORS,
  CONSISTENCY_CHART_COLORS
} from "styles/wigoColors";
import WigoSectionCard from "./WigoSectionCard";

ChartJS.register(ArcElement, Tooltip, Legend, Title);

interface ConsistencyDataPoint {
  label: string;
  percentage: number;
  count: number;
  color?: string;
}

interface ConsistencyChartProps {
  playerId: number | null | undefined;
  seasonId?: number | null;
}

const ConsistencyChart: React.FC<ConsistencyChartProps> = ({
  playerId,
  seasonId
}) => {
  const {
    data: gameLogs = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ["wigoConsistencyGameLog", playerId, seasonId],
    queryFn: () =>
      fetchPlayerGameLogConsistencyData(playerId as number, String(seasonId)),
    enabled: typeof playerId === "number" && typeof seasonId === "number"
  });

  const { processedData, chartData } = useMemo(() => {
    if (!gameLogs || gameLogs.length === 0) {
      return { processedData: [] as ConsistencyDataPoint[], chartData: { datasets: [] } };
    }

    const totalGames = gameLogs.length;
    let maxPoints = 0;
    const pointCounts: { [key: number]: number } = {};
    let cardioGameCount = 0;

    gameLogs.forEach((log) => {
      const points = log.points ?? 0;
      const shots = log.shots ?? 0;
      const hits = log.hits ?? 0;
      const blocks = log.blocked_shots ?? 0;
      pointCounts[points] = (pointCounts[points] || 0) + 1;
      if (points > maxPoints) maxPoints = points;
      if (points === 0 && shots === 0 && hits === 0 && blocks === 0) {
        cardioGameCount++;
      }
    });

    const displayData: ConsistencyDataPoint[] = [];
    const chartLabels: string[] = [];
    const chartPercentages: number[] = [];
    const chartBackgroundColors: string[] = [];

    for (let i = 0; i <= maxPoints; i++) {
      const count = pointCounts[i] || 0;
      const percentage = totalGames > 0 ? count / totalGames : 0;
      const label = `${i} Pt${i !== 1 ? "s" : ""}`;
      const color = CONSISTENCY_CHART_COLORS[i] ?? WIGO_COLORS.GREY_MEDIUM;

      displayData.push({ label, percentage, count, color });
      chartLabels.push(label);
      chartPercentages.push(percentage * 100);
      chartBackgroundColors.push(color);
    }

    displayData.push({
      label: "Cardio",
      percentage: totalGames > 0 ? cardioGameCount / totalGames : 0,
      count: cardioGameCount,
      color: WIGO_COLORS.GREY_MEDIUM
    });

    return {
      processedData: displayData,
      chartData: {
        labels: chartLabels,
        datasets: [
          {
            label: "Points per Game Distribution",
            data: chartPercentages,
            backgroundColor: chartBackgroundColors,
            borderColor: CHART_COLORS.BORDER_DARK,
            borderWidth: 1
          }
        ]
      }
    };
  }, [gameLogs]);

  // --- chartOptions remain the same ---
  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "60%",
    plugins: {
      legend: { display: false },
      title: { display: false },
      datalabels: {
        display: false // Explicitly disable the plugin for this chart
      },
      tooltip: {
        backgroundColor: CHART_COLORS.TOOLTIP_BACKGROUND, // Use new var name
        titleColor: CHART_COLORS.TOOLTIP_TEXT,
        bodyColor: CHART_COLORS.TOOLTIP_TEXT,
        borderColor: CHART_COLORS.TOOLTIP_BORDER, // Add border
        borderWidth: 1,
        callbacks: {
          label: function (context: any) {
            // Consider using TooltipItem<'doughnut'> from 'chart.js' for better typing
            let label = context.label || "";
            // Ensure processedData is accessible here (it should be via closure)
            const dataPoint = processedData.find(
              (p) => p.label === context.label
            );
            const valueColor = dataPoint?.color ?? CHART_COLORS.TOOLTIP_TEXT;
            if (label) label += ": ";
            if (context.parsed !== null)
              label += context.parsed.toFixed(1) + "%";

            if (dataPoint) label += ` (${dataPoint.count} Games)`;

            return label;
          }
        }
      }
    }
  };

  // --- JSX structure remains the same ---
  // The inline style `style={{ color: item.color }}` on the label
  // will automatically pick up the new colors stored in processedData
  return (
    <WigoSectionCard
      title="Point Consistency"
      bodyClassName={styles.sectionCardBodyFlush}
    >
      <div className={styles.consistencyContent}>
        {/* Loading/Error/No Data/Content rendering logic remains the same */}
        {isLoading && (
          <div
            className={styles.chartLoadingPlaceholder}
            style={{ width: "100%" }}
          >
            Loading Consistency...
          </div>
        )}
        {error instanceof Error && (
          <div
            className={styles.chartErrorPlaceholder}
            style={{ width: "100%" }}
          >
            Error: Failed to load data: {error.message || "Unknown error"}
          </div>
        )}
        {!playerId && !isLoading && !error && (
          <div
            className={styles.chartLoadingPlaceholder}
            style={{ width: "100%" }}
          >
            Select a player
          </div>
        )}
        {playerId && !seasonId && !isLoading && !error && (
          <div
            className={styles.chartLoadingPlaceholder}
            style={{ width: "100%" }}
          >
            Loading season info...
          </div>
        )}
        {!isLoading &&
          !error &&
          playerId &&
          seasonId &&
          processedData.length === 0 && (
            <div
              className={styles.chartLoadingPlaceholder}
              style={{ width: "100%" }}
            >
              No game data found...
            </div>
          )}

        {!isLoading && !error && processedData.length > 0 && (
          <>
            <div className={styles.consistencyChartArea}>
              {chartData.datasets.length > 0 &&
              chartData.datasets[0]?.data?.length > 0 ? (
                <Doughnut options={chartOptions} data={chartData} />
              ) : (
                !isLoading && !error && <div>No chart data to display.</div>
              )}
            </div>
            <div className={styles.consistencyListArea}>
              <ul>
                {processedData.map((item) => (
                  <li key={item.label} className={styles.consistencyItem}>
                    {/* Color applied to label text via inline style */}
                    <span
                      className={styles.consistencyLabel}
                      style={{ color: item.color }} // Uses the color stored in processedData
                    >
                      {item.label}:
                    </span>
                    <span className={styles.consistencyValue}>
                      {formatPercentage(item.percentage)}
                    </span>
                    <span className={styles.consistencyCount}>
                      ({item.count})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </WigoSectionCard>
  );
};

export default ConsistencyChart;
