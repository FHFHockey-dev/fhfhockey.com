import React from "react";
import classNames from "classnames";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
} from "chart.js";

import usePercentileRank from "hooks/usePercentileRank";
import Chart from "components/Chart";
import ChartTitle, { HightText } from "components/ChartTitle";

import styles from "./CategoryCoverageChart.module.scss";
import { TimeOption } from "components/TimeOptions/TimeOptions";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";
import { PercentileRank } from "lib/NHL/types";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Tooltip, Filler);

const LABELS: { key: keyof PercentileRank; label: string }[] = [
  { key: "goals", label: "GOALS" },
  { key: "assists", label: "ASSISTS" },
  { key: "powerPlayPoints", label: "PPP" },
  { key: "shots", label: "SOG" },
  { key: "plusMinus", label: "+/−" },
  { key: "pim", label: "PIM" },
  { key: "blockedShots", label: "BLK" },
  { key: "hits", label: "HITS" }
];

const DATA = {
  labels: LABELS.map((element) => element.label),
  datasets: [
    {
      data: [0, 0, 0, 0, 0, 0, 0, 0],
      label: "Percentile",
      fill: true,
      backgroundColor: "rgba(43, 168, 242, 0.65)",
      borderColor: "#07aae2",
      pointBackgroundColor: "#07aae2",
      pointBorderColor: "#fff",
      pointHoverBackgroundColor: "#fff",
      pointHoverBorderColor: "#07aae2",
      pointRadius: 0,
      tension: 0.1
    }
  ]
};

type CategoryCoverageChartProps = {
  playerId: number | undefined;
  timeOption: TimeOption;
  showTitle?: boolean;
  compact?: boolean;
};

// This surface intentionally stays on the legacy usePercentileRank pipeline.
// It does not consume the WiGO stat metadata/ranking contract introduced for /wigoCharts.
function CategoryCoverageChart({
  playerId,
  timeOption,
  showTitle = false,
  compact = false
}: CategoryCoverageChartProps) {
  const size = useScreenSize();

  const { data, loading, error, retry, retrying } = usePercentileRank(playerId, timeOption);
  const hasData = data && LABELS.every(({ key }) => Number.isFinite(data[key]));
  const chartData = { ...DATA, datasets: [{ ...DATA.datasets[0], data: hasData ? LABELS.map(({ key }) => data[key]) : [] }] };

  const LABEL_PLUGIN = {
    id: "label_with_percentage",
    afterDraw(chart: ChartJS) {
      const dataset = chart.data.datasets[0].data as number[];

      // @ts-ignore
      chart.scales.r._pointLabelItems.forEach((point, i) => {
        // stay away from the center of the circle
        // x-distance
        // slide-distance
        const center = { x: chart.width / 2, y: chart.height / 2 };
        const yDistance = point.y - center.y;
        const slideDistance = Math.sqrt(
          Math.pow(center.x - point.x, 2) + Math.pow(center.y - point.y, 2)
        );

        // cos x / slide = new_x / 20px
        // sin newY / 20px = yDistance / slideDistance
        const newY = (yDistance / slideDistance) * 10;

        chart.ctx.textAlign = point.textAlign;
        let x = 0;
        let y = point.y + newY + 20;
        const distance = size.screen === BreakPoint.l ? 10 : 2;
        if (point.textAlign === "left") {
          x = point.x + distance;
        } else if (point.textAlign === "right") {
          x = point.x - distance;
        } else {
          x = point.x;
        }

        // mobile: 12px
        // pc: 16px

        chart.ctx.font =
          size.screen === BreakPoint.l
            ? "700 16px Roboto Condensed"
            : "100 10px Roboto";
        chart.ctx.fillStyle = "white";
        chart.ctx.fillText(LABELS[i].label, x, y);

        // draw percentage
        chart.ctx.font =
          size.screen === BreakPoint.l
            ? "400 14px Roboto Condensed"
            : "700 12px Roboto";

        chart.ctx.fillStyle = "rgba(76, 167, 221, 1)";
        dataset[i] && chart.ctx.fillText(`${dataset[i].toFixed(1)}`, x, y - 16);
      });
    }
  };

  const OPTIONS = {
    responsive: true,
    maintainAspectRatio: true,
    elements: {
      line: {
        borderWidth: 2,
        color: "rgba(255, 255, 255, 0.25)"
      }
    },
    plugins: {
      legend: {
        display: false // This hides the legend
      },
      datalabels: {
        display: false // Explicitly disable the plugin for this chart
      }
    },
    scales: {
      r: {
        angleLines: {
          color: "rgba(255, 255, 255, 0.25)"
        },
        grid: {
          color: "white"
        },
        pointLabels: {
          color: "white",
          callback() {
            return " ";
          }
        },
        ticks: {
          display: false,
          stepSize: 20
        },
        min: 0,
        max: 100
      }
    },
    layout: {
      padding: size.screen === BreakPoint.l ? 30 : 20
    }
  } as const;

  if (!playerId) return <p role="status">Select a player to view category percentiles.</p>;
  if (loading) return <p role="status">Loading category percentiles…</p>;
  if (error && !hasData) return <div className={styles.status} role="status">
    <p>{"code" in error && error.code === "57014" ? "Category percentile request timed out." : "Unable to load category percentiles right now."}</p>
    <button type="button" onClick={() => void retry()} disabled={retrying}>{retrying ? "Retrying…" : "Retry category percentiles"}</button>
  </div>;
  if (!hasData) return <p role="status">Category percentiles unavailable for this player and season.</p>;

  if (compact) {
    return <div className={styles.compactRadar}><Radar data={chartData} options={{
      ...OPTIONS, maintainAspectRatio: false,
      layout: { padding: 6 },
      scales: { r: { ...OPTIONS.scales.r,
        pointLabels: { color: "#ccc", font: { size: 12 }, callback: (label: string) => label },
        ticks: { display: true, stepSize: 50, font: { size: 12 }, color: "#ccc", showLabelBackdrop: false }
      } }
    }} /></div>;
  }

  return (
    <Chart
      className={styles.container}
      headerClassName={styles.chartHeader}
      bodyClassName={classNames(styles.content)}
      header={
        <>
          {showTitle && (
            <ChartTitle className={styles.title}>
              Percentile <HightText>Ranks</HightText>
            </ChartTitle>
          )}
        </>
      }
    >
      <Radar
        data={chartData}
        options={OPTIONS}
        plugins={[LABEL_PLUGIN]}
      />
    </Chart>
  );
}

export default CategoryCoverageChart;
