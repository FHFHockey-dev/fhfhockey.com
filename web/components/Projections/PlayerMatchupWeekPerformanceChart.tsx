import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  // CategoryScale, // No longer primary for x-axis
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarController,
  LineController,
  TimeScale // Added TimeScale
} from "chart.js";
import { Chart } from "react-chartjs-2";
import "chartjs-adapter-date-fns"; // Import date adapter
import {
  MatchupWeekStats,
  GameStatPoint
} from "hooks/usePlayerMatchupWeekStats";
import { PerformanceTier } from "utils/tierUtils";

ChartJS.register(
  TimeScale, // Register TimeScale
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarController,
  LineController
);
import { WIGO_COLORS, CHART_COLORS, addAlpha } from "styles/wigoColors"; // Adjust path

interface PlayerMatchupWeekPerformanceChartProps {
  matchupWeekStats: MatchupWeekStats[];
  gameStatPoints: GameStatPoint[];
  performanceTiers: PerformanceTier[];
  styles?: Record<string, string>;
  isLoading?: boolean;
  error?: string | null;
}

function getTierColor(tiers: PerformanceTier[], fp: number | null): string {
  if (fp == null || isNaN(fp)) return "#888888"; // Default color for null/NaN FP
  const tier = tiers.find((t) => fp >= t.minFP && fp < t.maxFP);
  return tier ? tier.color : "#888888"; // Default color if no tier matches
}

const PlayerMatchupWeekPerformanceChart: React.FC<
  PlayerMatchupWeekPerformanceChartProps
> = ({
  matchupWeekStats,
  gameStatPoints,
  performanceTiers,
  styles,
  isLoading,
  error
}) => {
  // weekLabels are no longer needed for TimeScale
  // const weekLabels = useMemo(
  //   () => matchupWeekStats.map((w) => `Week ${w.week}`),
  //   [matchupWeekStats]
  // );

  const chartData = useMemo(() => {
    return {
      // labels: weekLabels, // Removed for TimeScale
      datasets: [
        {
          type: "bar" as const,
          label: "Avg Fantasy Points per Game (by Week)",
          data: matchupWeekStats.map((w) => ({
            x: new Date(w.start_date).valueOf(), // Bars centered on week start_date
            y: w.avgFantasyPoints
            // tierColor is used directly in backgroundColor below
          })),
          backgroundColor: matchupWeekStats.map((w) =>
            getTierColor(performanceTiers, w.avgFantasyPoints)
          ),
          borderColor: matchupWeekStats.map((w) =>
            getTierColor(performanceTiers, w.avgFantasyPoints)
          ),
          borderWidth: 1,
          // Adjust bar width/spacing for time scale.
          // barThickness: 60, // Example: fixed thickness in pixels
          // Or, make it relative to the time unit.
          // For 'week' unit on x-axis, barPercentage can try to fill portion of week.
          barPercentage: 0.4, // Covers ~2.8 days of a 7-day week. Adjust.
          categoryPercentage: 1.0, // Ensure it uses the full space for that percentage
          order: 1
        } as any,
        {
          type: "line" as const,
          label: "Individual Game Fantasy Points",
          data: gameStatPoints.map((g) => ({
            x: new Date(g.date).valueOf(), // Use timestamp for x
            y: g.fantasyPoints,
            gameDateString: g.date // Keep original date string for tooltips
          })),
          borderColor: CHART_COLORS.DATALABEL_TEXT,
          backgroundColor: addAlpha(CHART_COLORS.DATALABEL_TEXT, 0.2),
          pointBackgroundColor: CHART_COLORS.DATALABEL_TEXT,
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: false,
          tension: 0.1,
          yAxisID: "y",
          order: 0
        } as any
      ]
    };
  }, [matchupWeekStats, gameStatPoints, performanceTiers]);

  const options: any = useMemo(() => {
    // Determine overall min and max dates for the x-axis
    let minDate: number | undefined = undefined;
    let maxDate: number | undefined = undefined;

    if (matchupWeekStats.length > 0) {
      minDate = new Date(matchupWeekStats[0].start_date).valueOf();
      // Find the latest end_date among all weeks
      const latestEndDate = matchupWeekStats.reduce((latest, week) => {
        const currentEnd = new Date(week.end_date);
        return currentEnd > latest ? currentEnd : latest;
      }, new Date(matchupWeekStats[0].end_date));
      maxDate = latestEndDate.valueOf();
    } else if (gameStatPoints.length > 0) {
      // Fallback if no matchup weeks but games exist (less likely with current logic)
      minDate = new Date(gameStatPoints[0].date).valueOf();
      maxDate = new Date(
        gameStatPoints[gameStatPoints.length - 1].date
      ).valueOf();
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: "time" as const,
          min: minDate, // Set min date for the axis
          max: maxDate, // Set max date for the axis
          time: {
            unit: "day" as const, // Base unit for data parsing
            tooltipFormat: "MMM d, yyyy", // e.g., Jan 1, 2023
            displayFormats: {
              day: "MMM d", // Display format for day ticks
              week: "MMM d", // Display format for week ticks (major)
              month: "MMM yyyy" // Display format for month ticks
            }
          },
          title: {
            display: true,
            text: "Date",
            color: "#DDDDDD"
          },
          grid: {
            color: "rgba(255,255,255,0.08)"
            // offset: false, // offset is less relevant for time scale bars positioned by x value
          },
          ticks: {
            color: "#DDDDDD",
            source: "auto" as const,
            major: {
              enabled: true // Enable major ticks
              // fontStyle: 'bold', // Optional: style major ticks
            },
            // Auto-skip helps prevent overcrowding
            autoSkip: true,
            maxRotation: 45,
            minRotation: 0
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Fantasy Points",
            color: "#DDDDDD"
          },
          grid: {
            color: "rgba(255,255,255,0.12)"
          },
          ticks: {
            color: "#DDDDDD"
          }
        }
      },
      plugins: {
        legend: {
          position: "top" as const,
          labels: {
            color: "#DDDDDD"
          }
        },
        title: {
          display: true,
          text: "Player Fantasy Points by Matchup Week",
          color: "#FFFFFF",
          font: { size: 16 }
        },
        tooltip: {
          callbacks: {
            title: function (tooltipItems: any[]) {
              if (tooltipItems.length > 0) {
                const date = new Date(tooltipItems[0].parsed.x);
                // Find the matchup week this date belongs to for context
                const currentWeek = matchupWeekStats.find(
                  (mw) =>
                    date.valueOf() >= new Date(mw.start_date).valueOf() &&
                    date.valueOf() <= new Date(mw.end_date).valueOf()
                );
                let titleStr = date.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                });
                if (currentWeek) {
                  titleStr += ` (Week ${currentWeek.week})`;
                }
                return titleStr;
              }
              return "";
            },
            label: function (context: any) {
              const datasetLabel = context.dataset.label || "";
              let valueLabel = "";

              if (context.dataset.type === "bar") {
                const avgFP = context.parsed.y;
                valueLabel = `Avg FP/Gm: ${avgFP !== null ? avgFP.toFixed(1) : "N/A"}`;
                const tier = performanceTiers.find(
                  (t) => avgFP !== null && avgFP >= t.minFP && avgFP < t.maxFP
                );
                if (tier) {
                  valueLabel += ` (Tier: ${tier.name})`;
                }
              } else if (context.dataset.type === "line") {
                // context.raw should be {x: timestamp, y: gameFP, gameDateString: "YYYY-MM-DD"}
                const gameData = context.raw as {
                  gameDateString: string;
                  y: number;
                };
                valueLabel = `Game FP: ${gameData.y.toFixed(1)}`;
              }
              return `${datasetLabel}: ${valueLabel}`;
            }
          }
        }
      }
    };
  }, [matchupWeekStats, gameStatPoints, performanceTiers]);

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>Loading chart…</div>
    );
  }
  if (error) {
    return (
      <div style={{ color: "#ff3333", textAlign: "center", padding: "2rem" }}>
        {error}
      </div>
    );
  }
  if (!matchupWeekStats.length && !gameStatPoints.length) {
    // Check both
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        No matchup week or game data available.
      </div>
    );
  }

  // Legend for tiers (can remain similar)
  const tierLegend = (
    <div
      style={{
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        margin: "0.5rem 0 1rem 0",
        justifyContent: "center" // Center the legend items
      }}
    >
      {performanceTiers.map((tier) => (
        <span
          key={tier.name}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <span
            style={{
              width: 18,
              height: 18,
              background: tier.color,
              display: "inline-block",
              borderRadius: 4,
              border: "1px solid #333"
            }}
          />
          <span style={{ color: "#DDDDDD", fontSize: 14 }}>{tier.name}</span>
        </span>
      ))}
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 18,
            height: 4, // Keep line legend distinct
            background: "#FFFFFF", // Match line color
            display: "inline-block",
            borderRadius: 2
          }}
        />
        <span style={{ color: "#DDDDDD", fontSize: 14 }}>
          Individual Game FP
        </span>
      </span>
    </div>
  );

  return (
    <div
      className={styles?.chartContainer}
      style={{
        height: 450, // Increased height slightly for better time scale display
        width: "100%",
        background: "rgba(0,0,0,0.08)",
        padding: "1rem 0"
      }}
    >
      {tierLegend}
      <Chart type="bar" data={chartData} options={options} />
      {/* type="bar" is still okay as Chart.js handles mixed types */}
    </div>
  );
};

export default PlayerMatchupWeekPerformanceChart;
