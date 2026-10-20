import React, { useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import styles from "./PlayerStats.module.scss";
import {
  CHART_UNIT_META,
  ChartUnit,
  formatMinutes,
  formatPlayerStat,
  groupStatsByUnit,
  parseLocalDate,
  SEASON_INDEX_WINDOW,
  seasonIndexSeries,
  toChartValue
} from "./playerStatsContract";
import {
  PlayerStatsChartProps,
  CHART_COLORS,
  GameLogEntry,
  STAT_DISPLAY_NAMES
} from "./types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const FONT = "'Roboto Condensed', sans-serif";
const GRID_COLOR = "rgba(156, 163, 175, 0.15)";
const TICK_COLOR = "#9ca3af";

/** Axis tick and tooltip text in the panel's unit. */
const formatForUnit = (unit: ChartUnit, value: number, stat: string) => {
  if (unit === "toi") return formatMinutes(value);
  if (unit === "percent") return `${value.toFixed(1)}%`;
  return formatPlayerStat(value, stat);
};

const tickForUnit = (unit: ChartUnit, value: number) => {
  if (unit === "toi") return formatMinutes(value);
  if (unit === "percent") return `${value}%`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

type UnitChartProps = {
  unit: ChartUnit;
  stats: string[];
  colorFor: (stat: string) => string;
  games: GameLogEntry[];
  labels: string[];
  showRollingAverage: boolean;
};

function UnitChart({
  unit,
  stats,
  colorFor,
  games,
  labels,
  showRollingAverage
}: UnitChartProps) {
  const meta = CHART_UNIT_META[unit];

  const data = useMemo(() => {
    const datasets = stats.flatMap((stat) => {
      const color = colorFor(stat);
      const label = STAT_DISPLAY_NAMES[stat] || stat;
      const dataset = {
        label,
        statKey: stat,
        // Missing values stay gaps rather than plotting as zero.
        data: games.map((game) => toChartValue(game[stat], stat)),
        borderColor: color,
        backgroundColor: `${color}15`,
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: color,
        pointBorderColor: "#1a1d21",
        pointBorderWidth: 2,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: "#ffffff",
        pointHoverBorderWidth: 2,
        tension: 0.15,
        fill: false
      };
      const rollingKey = `${stat}_5game_avg`;
      if (
        !showRollingAverage ||
        !games.some((game) => game[rollingKey] !== undefined)
      ) {
        return [dataset];
      }
      return [
        dataset,
        {
          ...dataset,
          label: `${label} (5-game avg)`,
          data: games.map((game) => toChartValue(game[rollingKey], stat)),
          borderColor: `${color}80`,
          backgroundColor: `${color}08`,
          borderDash: [5, 5],
          pointRadius: 2,
          pointHoverRadius: 4
        }
      ];
    });
    return { labels, datasets };
  }, [stats, colorFor, games, labels, showRollingAverage]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top" as const,
          align: "start" as const,
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            padding: 12,
            usePointStyle: true,
            pointStyle: "circle",
            font: { size: 12, family: FONT, weight: 500 },
            color: "#cccccc"
          }
        },
        title: { display: false },
        tooltip: {
          mode: "index" as const,
          intersect: false,
          backgroundColor: "rgba(26, 29, 33, 0.95)",
          titleColor: "#ffffff",
          bodyColor: "#cccccc",
          borderColor: "#404040",
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: { size: 13, weight: 600, family: FONT },
          bodyFont: { size: 12, family: FONT },
          callbacks: {
            title: (context: any) =>
              context.length === 0
                ? ""
                : parseLocalDate(games[context[0].dataIndex].date).toLocaleDateString(
                    "en-US",
                    { weekday: "short", month: "short", day: "numeric", year: "numeric" }
                  ),
            label: (context: any) => {
              const value = context.parsed.y;
              if (value === null || value === undefined) return "";
              return `${context.dataset.label}: ${formatForUnit(
                unit,
                value,
                context.dataset.statKey
              )}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: GRID_COLOR, drawBorder: false },
          ticks: {
            maxTicksLimit: 12,
            font: { size: 11, family: FONT },
            color: TICK_COLOR,
            padding: 6
          },
          border: { display: false }
        },
        y: {
          beginAtZero: true,
          ...(unit === "percent" ? { min: 0, max: 100 } : {}),
          title: {
            display: true,
            text: meta.axis,
            color: TICK_COLOR,
            font: { size: 11, family: FONT }
          },
          grid: { color: GRID_COLOR, drawBorder: false },
          ticks: {
            font: { size: 11, family: FONT },
            color: TICK_COLOR,
            padding: 8,
            callback: (value: any) =>
              typeof value === "number" ? tickForUnit(unit, value) : value
          },
          border: { display: false }
        }
      },
      interaction: { mode: "index" as const, intersect: false },
      spanGaps: false,
      elements: {
        point: { hoverBorderWidth: 3 },
        line: {
          borderJoinStyle: "round" as const,
          borderCapStyle: "round" as const
        }
      }
    }),
    [unit, meta.axis, games]
  );

  return (
    <section className={styles.unitPanel} aria-label={`${meta.label} chart`}>
      <div className={styles.unitPanelHead}>
        <h4>{meta.label}</h4>
        <span>{meta.axis}</span>
      </div>
      <div className={`${styles.chartWrapper} ${styles.unitChart}`}>
        <Line data={data as any} options={options as any} />
      </div>
    </section>
  );
}

const INDEX_AXIS = "Index (100 = season average)";

type RelativeChartProps = {
  stats: string[];
  colorFor: (stat: string) => string;
  games: GameLogEntry[];
  seasonGames: GameLogEntry[];
  labels: string[];
};

/** One unit-free panel: every stat's 5-game average indexed to its season average. */
function RelativeChart({
  stats,
  colorFor,
  games,
  seasonGames,
  labels
}: RelativeChartProps) {
  const data = useMemo(() => {
    const datasets = stats.map((stat) => {
      const series = seasonIndexSeries(seasonGames, stat);
      const byDate = new Map(
        seasonGames.map((game, index) => [String(game.date), series[index]])
      );
      const color = colorFor(stat);
      return {
        label: STAT_DISPLAY_NAMES[stat] || stat,
        statKey: stat,
        data: games.map((game) => byDate.get(String(game.date)) ?? null),
        borderColor: color,
        backgroundColor: `${color}15`,
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: color,
        pointBorderColor: "#1a1d21",
        pointBorderWidth: 2,
        tension: 0.15,
        fill: false
      };
    });
    return { labels, datasets };
  }, [stats, colorFor, games, seasonGames, labels]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      spanGaps: false,
      plugins: {
        legend: {
          position: "top" as const,
          align: "start" as const,
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            padding: 12,
            usePointStyle: true,
            pointStyle: "circle",
            font: { size: 12, family: FONT, weight: 500 },
            color: "#cccccc"
          }
        },
        tooltip: {
          mode: "index" as const,
          intersect: false,
          backgroundColor: "rgba(26, 29, 33, 0.95)",
          titleColor: "#ffffff",
          bodyColor: "#cccccc",
          borderColor: "#404040",
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: { size: 13, weight: 600, family: FONT },
          bodyFont: { size: 12, family: FONT },
          callbacks: {
            title: (context: any) =>
              context.length === 0
                ? ""
                : `${parseLocalDate(games[context[0].dataIndex].date).toLocaleDateString(
                    "en-US",
                    { weekday: "short", month: "short", day: "numeric" }
                  )} · ${SEASON_INDEX_WINDOW}-game average vs season`,
            label: (context: any) => {
              const value = context.parsed.y;
              if (value === null || value === undefined) return "";
              return `${context.dataset.label}: ${Math.round(value)} (100 = season average)`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: GRID_COLOR, drawBorder: false },
          ticks: {
            maxTicksLimit: 12,
            font: { size: 11, family: FONT },
            color: TICK_COLOR,
            padding: 6
          },
          border: { display: false }
        },
        y: {
          // Centred on 100 so normal swings are visible; grows when needed.
          beginAtZero: false,
          suggestedMin: 50,
          suggestedMax: 150,
          title: {
            display: true,
            text: INDEX_AXIS,
            color: TICK_COLOR,
            font: { size: 11, family: FONT }
          },
          grid: {
            // Emphasise the 100 line: the player's own season average.
            color: (context: any) =>
              context.tick?.value === 100 ? "rgba(229, 231, 235, 0.55)" : GRID_COLOR,
            drawBorder: false
          },
          ticks: {
            font: { size: 11, family: FONT },
            color: TICK_COLOR,
            padding: 8,
            stepSize: 25
          },
          border: { display: false }
        }
      },
      interaction: { mode: "index" as const, intersect: false }
    }),
    [games]
  );

  return (
    <section className={styles.unitPanel} aria-label="Relative to season average chart">
      <div className={styles.unitPanelHead}>
        <h4>Relative to season average</h4>
        <span>
          {SEASON_INDEX_WINDOW}-game average · 100 = season average · shown
          after {SEASON_INDEX_WINDOW} games
        </span>
      </div>
      <div className={`${styles.chartWrapper} ${styles.unitChart}`}>
        <Line data={data as any} options={options as any} />
      </div>
    </section>
  );
}

/**
 * Selected stats grouped by unit: counts, rates, percentages (0-100) and time
 * on ice (minutes) each get their own labelled panel and axis.
 */
export function PlayerStatsChart({
  gameLog,
  seasonGameLog,
  playoffGameLog,
  selectedStats,
  showRollingAverage = false,
  title = "Performance Trends",
  showPlayoffData = false
}: PlayerStatsChartProps) {
  const games = useMemo(() => {
    const log = showPlayoffData && playoffGameLog ? playoffGameLog : gameLog;
    return [...log].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [gameLog, playoffGameLog, showPlayoffData]);

  const labels = useMemo(
    () =>
      games.map((game) =>
        parseLocalDate(game.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric"
        })
      ),
    [games]
  );

  const groups = useMemo(() => groupStatsByUnit(selectedStats), [selectedStats]);
  const [mode, setMode] = useState<"actual" | "relative">("actual");

  // Baseline for the relative view: the full regular season (or the playoff
  // log when playoffs are shown), oldest first.
  const seasonGames = useMemo(() => {
    const log =
      showPlayoffData && playoffGameLog
        ? playoffGameLog
        : (seasonGameLog ?? gameLog);
    return [...log].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [seasonGameLog, gameLog, playoffGameLog, showPlayoffData]);

  // Colours follow the stat's position in the selection, as before.
  const colorFor = useMemo(() => {
    const index = new Map(selectedStats.map((stat, i) => [stat, i]));
    return (stat: string) =>
      CHART_COLORS[(index.get(stat) ?? 0) % CHART_COLORS.length];
  }, [selectedStats]);

  if (games.length === 0 || groups.length === 0) {
    return (
      <div className={styles.chartContainer}>
        <div className={styles.chartHeader}>
          <h3>{title}</h3>
        </div>
        <div className={styles.noData}>No data available for chart</div>
      </div>
    );
  }

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <h3>{title}</h3>
        {showPlayoffData && playoffGameLog && (
          <span className={styles.chartSubtitle}>Playoff Data</span>
        )}
        <div
          className={styles.chartModeToggle}
          role="group"
          aria-label="Chart values"
        >
          <button
            type="button"
            className={styles.chartModeButton}
            aria-pressed={mode === "actual"}
            onClick={() => setMode("actual")}
          >
            Actual values
          </button>
          <button
            type="button"
            className={styles.chartModeButton}
            aria-pressed={mode === "relative"}
            onClick={() => setMode("relative")}
          >
            Relative to season average
          </button>
        </div>
      </div>
      {mode === "relative" ? (
        <RelativeChart
          stats={selectedStats}
          colorFor={colorFor}
          games={games}
          seasonGames={seasonGames}
          labels={labels}
        />
      ) : (
        <div className={styles.unitPanels}>
          {groups.map((group) => (
            <UnitChart
              key={group.unit}
              unit={group.unit}
              stats={group.stats}
              colorFor={colorFor}
              games={games}
              labels={labels}
              showRollingAverage={showRollingAverage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
