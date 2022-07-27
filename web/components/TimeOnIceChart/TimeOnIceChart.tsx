import { Dispatch, SetStateAction, useEffect, useState } from "react";

import Options from "components/Options";
import fetchTOIData from "lib/NHL/TOI";
import styles from "./TimeOnIceChart.module.scss";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend
);

type TimeOption = "L7" | "L14" | "L30" | "SEASON";

/**
 * Time On Ice | Power Play Time On Ice
 */
type ChartTypeOption = "TOI" | "POWER_PLAY_TOI";

type TimeOnIceChartProps = {
  playerId: number;
};

const CHART_AXIS_COLOR = "#07aae2";
function TimeOnIceChart({ playerId }: TimeOnIceChartProps) {
  const [timeOption, setTimeOption] = useState<TimeOption>("L7");
  const [chartTypeOption, setChartTypeOption] =
    useState<ChartTypeOption>("POWER_PLAY_TOI");

  const [TOI, setTOI] = useState<number[]>([]);
  const [ppTOI, setPpTOI] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    // TODO: pass time option, and receive dates rather than labels
    fetchTOIData(playerId).then((data) => {
      console.log(data);

      setTOI(data.TOI);
      setPpTOI(data.PPTOI);
      setLabels(data.labels);
    });
  }, [playerId]);

  const CHART_OPTIONS = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: {
          color: "white",
        },
        grid: {
          borderColor: CHART_AXIS_COLOR,
          borderWidth: 3,
        },
      },
      y: {
        type: "linear",
        beginAtZero: true,
        min: 0,
        max: 100,

        title: {
          display: false,
          text: "Percentage",
        },
        ticks: {
          color: "white",
          stepSize: 50,
        },
        grid: {
          borderColor: CHART_AXIS_COLOR,
          borderWidth: 3,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
    },
  } as const;

  const data = {
    labels: labels,
    datasets: [
      chartTypeOption === "TOI"
        ? {
            label: "TOI",
            borderColor: "white",
            data: TOI,
            pointRadius: 0,
            tension: 0.1,
          }
        : {
            label: "PPTOI",
            borderColor: "white",
            data: ppTOI,
            pointRadius: 0,
            tension: 0.1,
          },
    ],
  };

  return (
    <section className={styles.container}>
      <div className={styles.allOptions}>
        <TimeOptions timeOption={timeOption} setTimeOption={setTimeOption} />
        <ChartTypeOptions
          chartTypeOption={chartTypeOption}
          setChartTypeOption={setChartTypeOption}
        />
      </div>
      <div className={styles.chartWrapper}>
        <Line options={CHART_OPTIONS} data={data} />
      </div>
    </section>
  );
}

type TimeOptionsProps = {
  timeOption: TimeOption;
  setTimeOption: Dispatch<SetStateAction<TimeOption>>;
};

function TimeOptions({ timeOption, setTimeOption }: TimeOptionsProps) {
  const options = [
    { label: "L7", value: "L7" },
    { label: "L14", value: "L14" },
    { label: "L30", value: "L30" },
    { label: "Year", value: "SEASON" },
  ] as const;

  return (
    <Options
      options={options}
      option={timeOption}
      onOptionChange={setTimeOption}
    />
  );
}

type ChartTypeOptionsProps = {
  chartTypeOption: ChartTypeOption;
  setChartTypeOption: Dispatch<SetStateAction<ChartTypeOption>>;
};

function ChartTypeOptions({
  chartTypeOption,
  setChartTypeOption,
}: ChartTypeOptionsProps) {
  const options = [
    { label: "PP%", value: "POWER_PLAY_TOI" },
    { label: "TOI", value: "TOI" },
  ] as const;

  return (
    <Options
      options={options}
      option={chartTypeOption}
      onOptionChange={setChartTypeOption}
    />
  );
}

export default TimeOnIceChart;
