import React, { useEffect, useRef } from "react";
import classNames from "classnames";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";

import usePercentileRank from "hooks/usePercentileRank";
import Chart from "components/Chart";
import ChartTitle, { HightText } from "components/ChartTitle";

import styles from "./CategoryCoverageChart.module.scss";
import { TimeOption } from "components/TimeOptions/TimeOptions";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Tooltip, Filler);

const LABELS = [
  { key: "Goals", label: "GOALS" },
  { key: "Assists", label: "ASSISTS" },
  { key: "PPP", label: "PPP" },
  { key: "Shots", label: "SOG" },
  { key: "PlusMinus", label: "+/-" },
  { key: "PIM", label: "PIM" },
  { key: "Blocks", label: "BLK" },
  { key: "Hits", label: "HITS" },
] as const;

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
      tension: 0.1,
    },
  ],
};

const OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  elements: {
    line: {
      borderWidth: 2,
      color: "rgba(255, 255, 255, 0.25)",
    },
  },
  scales: {
    r: {
      angleLines: {
        color: "rgba(255, 255, 255, 0.25)",
      },
      grid: {
        color: "white",
      },
      pointLabels: {
        color: "white",
        callback() {
          return " ";
        },
      },
      ticks: {
        display: false,
        stepSize: 20,
      },
      min: 0,
      max: 100,
    },
  },
  layout: {
    padding: 30,
  },
} as const;

type CategoryCoverageChartProps = {
  playerId: number | undefined;
  timeOption: TimeOption;
};

function CategoryCoverageChart({
  playerId,
  timeOption,
}: CategoryCoverageChartProps) {
  const chartRef = useRef<ChartJS>(null);
  const size = useScreenSize();

  const { data, loading } = usePercentileRank(playerId, timeOption);

  useEffect(() => {
    const chart = chartRef.current;
    if (loading || !chart) return;
    // update the radar chart
    chart.data.datasets[0].data = data
      ? LABELS.map(({ key }) => data[key])
      : [];
    chart.update();
  }, [data, loading]);

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
        if (point.textAlign === "left") {
          x = point.x + 10;
        } else if (point.textAlign === "right") {
          x = point.x - 10;
        } else {
          x = point.x;
        }

        // mobile: 12px
        // pc: 16px

        chart.ctx.font =
          size.screen === BreakPoint.l
            ? "700 16px Roboto Condensed"
            : "100 10px Didact Gothic";
        chart.ctx.fillStyle = "white";
        chart.ctx.fillText(LABELS[i].label, x, y);

        // draw percentage
        chart.ctx.font =
          size.screen === BreakPoint.l
            ? "400 14px Roboto Condensed"
            : "700 12px Didact Gothic";

        chart.ctx.fillStyle = "rgba(76, 167, 221, 1)";
        dataset[i] && chart.ctx.fillText(`${dataset[i]}`, x, y - 16);
      });
    },
  };

  return (
    <Chart
      className={styles.container}
      headerClassName={styles.chartHeader}
      bodyClassName={classNames(styles.content)}
      header={
        <>
          <ChartTitle className={styles.title}>
            Percentile <HightText>Ranks</HightText>
          </ChartTitle>
        </>
      }
    >
      <Radar
        // @ts-ignore
        ref={chartRef}
        data={DATA}
        options={OPTIONS}
        plugins={[LABEL_PLUGIN]}
      />
    </Chart>
  );
}

export default CategoryCoverageChart;
