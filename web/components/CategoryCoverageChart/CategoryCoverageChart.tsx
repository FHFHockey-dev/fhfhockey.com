import React, { useEffect, useRef, useState } from "react";
import classNames from "classnames";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Tooltip,
} from "chart.js";

import usePercentileRank from "hooks/usePercentileRank";
import Chart from "components/Chart";
import TimeOptions from "components/TimeOptions";
import Text, { HightText } from "components/Text";

import styles from "./CategoryCoverageChart.module.scss";
import { TimeOption } from "components/TimeOptions/TimeOptions";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Tooltip);

const DATA = {
  labels: [
    "Goals",
    "Assists",
    "PPP",
    "Hits",
    "Blocks",
    "PIM",
    "Shots",
    "PlusMinus",
  ],
  datasets: [
    {
      data: [0, 0, 0, 0, 0, 0, 0, 0],
      label: "Percentile",
      fill: false,
      borderColor: "#07aae2",
      pointBackgroundColor: "#07aae2",
      pointBorderColor: "#fff",
      pointHoverBackgroundColor: "#fff",
      pointHoverBorderColor: "#07aae2",
    },
  ],
};

const OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  elements: {
    line: {
      borderWidth: 3,
    },
  },
  scales: {
    r: {
      grid: {
        color: "white",
      },
      pointLabels: {
        color: "white",
      },
      min: 0,
      max: 100,
    },
  },
};

type CategoryCoverageChartProps = {
  playerId: number | undefined;
  timeOption: TimeOption;
};

function CategoryCoverageChart({
  playerId,
  timeOption,
}: CategoryCoverageChartProps) {
  const chartRef = useRef<ChartJS>(null);
  const [mounted, setMounted] = useState(false);

  const { data, loading } = usePercentileRank(playerId, timeOption);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (loading || !chart) return;
    // update the radar chart
    chart.data.datasets[0].data = data ? Object.values(data) : [];
    chart.update();
  }, [data, loading]);

  return (
    <Chart
      className={styles.container}
      headerClassName={styles.chartHeader}
      bodyClassName={classNames(styles.content, {
        [styles.fullHeight]: mounted,
      })}
      header={
        <>
          <Text className={styles.title}>
            Percentile <HightText>Ranks</HightText>
          </Text>
        </>
      }
    >
      {/* <div className={styles.chartWrapper}> */}
      {/* @ts-ignore */}
      <Radar ref={chartRef} data={DATA} options={OPTIONS} />
      {/* </div> */}
    </Chart>
  );
}

export default CategoryCoverageChart;
