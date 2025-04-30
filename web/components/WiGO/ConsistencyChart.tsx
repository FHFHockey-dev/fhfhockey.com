// components/WiGO/ConsistencyChart.tsx
import React, { useState, useEffect } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from "chart.js";
import {
  fetchPlayerGameLogConsistencyData,
  fetchPlayerPerGameTotals,
  SkaterGameLogConsistencyData
} from "utils/fetchWigoPlayerStats"; // Adjust path
import { formatPercentage } from "utils/formattingUtils"; // Adjust path
import styles from "styles/wigoCharts.module.scss"; // Import shared styles
import {
  WIGO_COLORS,
  CHART_COLORS,
  CONSISTENCY_CHART_COLORS,
  addAlpha
} from "styles/wigoColors";

ChartJS.register(ArcElement, Tooltip, Legend, Title);

interface ConsistencyDataPoint {
  label: string;
  percentage: number;
  count: number;
  color?: string;
}

interface ConsistencyChartProps {
  playerId: number | null | undefined;
}

const ConsistencyChart: React.FC<ConsistencyChartProps> = ({ playerId }) => {
  const [processedData, setProcessedData] = useState<ConsistencyDataPoint[]>(
    []
  );
  const [chartData, setChartData] = useState<any>({ datasets: [] });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // --- Fetching logic remains the same ---
    if (!playerId) {
      return;
    }
    const loadConsistencyData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const totals = await fetchPlayerPerGameTotals(playerId);
        if (!totals || !totals.season)
          throw new Error("Could not determine latest season for player.");
        const currentSeason = totals.season;
        const gameLogs = await fetchPlayerGameLogConsistencyData(
          playerId,
          currentSeason
        );
        if (!gameLogs || gameLogs.length === 0) {
          setError("No game data found...");
          setIsLoading(false);
          return;
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
          if (points === 0 && shots === 0 && hits === 0 && blocks === 0)
            cardioGameCount++;
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

          displayData.push({ label, percentage, count, color }); // Store specific color

          chartLabels.push(label);
          chartPercentages.push(percentage * 100);
          chartBackgroundColors.push(color); // Use the assigned color
        }

        // --- Handle Cardio separately ---
        const cardioPercentage =
          totalGames > 0 ? cardioGameCount / totalGames : 0;

        // Assign a specific color for Cardio, maybe grey?
        const cardioColor = WIGO_COLORS.GREY_MEDIUM;
        displayData.push({
          label: "Cardio",
          percentage: cardioPercentage,
          count: cardioGameCount,
          color: cardioColor // Add color for the list item
        });

        setProcessedData(displayData);
        setChartData({
          labels: chartLabels,
          datasets: [
            {
              label: "Points per Game Distribution",
              data: chartPercentages,
              backgroundColor: chartBackgroundColors,
              borderColor: CHART_COLORS.BORDER_DARK, // Use var
              borderWidth: 1
            }
          ]
        });
      } catch (err: any) {
        console.error("Failed to load Consistency chart data:", err);
        setError(`Failed to load data: ${err.message || "Unknown error"}`);
        setProcessedData([]);
        setChartData({ datasets: [] });
      } finally {
        setIsLoading(false);
      }
    };
    loadConsistencyData();
  }, [playerId]);

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
    <div className={styles.chartContainer}>
      <div className={styles.chartTitle}>
        <h3 style={{ margin: 0 }}>Point Consistency</h3>
      </div>
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
        {error && (
          <div
            className={styles.chartErrorPlaceholder}
            style={{ width: "100%" }}
          >
            Error: {error}
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
    </div>
  );
};

export default ConsistencyChart;
