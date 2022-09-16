import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";

import Options from "components/Options";

import styles from "./TimeOnIceChart.module.scss";

import { Line } from "react-chartjs-2";
import "chartjs-adapter-date-fns";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  TimeScale,
} from "chart.js";
import { subDays, format, differenceInWeeks } from "date-fns";
import useCurrentSeason from "hooks/useCurrentSeason";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";
import Spinner from "components/Spinner";
import { TimeOption } from "components/TimeOptions/TimeOptions";
import Chart from "components/Chart";
import ChartTitle, { HightText } from "components/ChartTitle";

ChartJS.register(
  TimeScale,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler
);

/**
 * Time On Ice | Power Play Time On Ice
 */
export type ChartTypeOption = "TOI" | "POWER_PLAY_TOI";

type TimeOnIceChartProps = {
  chartType: ChartTypeOption;
  timeOption: TimeOption;
  playerId: number | undefined;
};

function TimeOnIceChart({
  playerId,
  timeOption,
  chartType,
}: TimeOnIceChartProps) {
  const size = useScreenSize();
  const chartRef = useRef<ChartJS | null>(null);
  const season = useCurrentSeason();

  const [loading, setLoading] = useState(false);
  const [TOI, setTOI] = useState<number[]>([]);
  const [ppTOI, setPPTOI] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);

  // fetch data when season, player id, time option change
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!season || !playerId) return;
      setLoading(true);

      let startTime: Date;
      let endTime: Date;
      switch (timeOption) {
        case "L7": {
          startTime = subDays(new Date(), 7);
          endTime = new Date();
          break;
        }
        case "L14": {
          startTime = subDays(new Date(), 14);
          endTime = new Date();
          break;
        }
        case "L30": {
          startTime = subDays(new Date(), 30);
          endTime = new Date();
          break;
        }
        case "SEASON": {
          break;
        }
        default:
          throw new Error("This time option is not implemented.");
      }

      const { data, success } = await fetch("/api/toi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          StartTime:
            // @ts-ignore
            timeOption === "SEASON" ? null : format(startTime, "yyyy-MM-dd"),
          EndTime:
            // @ts-ignore
            timeOption === "SEASON" ? null : format(endTime, "yyyy-MM-dd"),
          Season: season.seasonId,
          PlayerId: playerId,
        }),
      })
        .then((res) => res.json())
        .finally(() => {
          setLoading(false);
        });

      if (mounted && success) {
        setTOI(data.TOI.map(({ value }: any) => value));
        setPPTOI(data.PPTOI.map(({ value }: any) => value));
        setLabels(data.TOI.map((element: any) => element.date));
      }
    })();

    return () => {
      mounted = false;
    };
  }, [season, playerId, timeOption]);

  // TOI - y-axis range 0,15,30
  // PPTOI - y-axis 0-100%
  const CHART_OPTIONS = {
    responsive: true,
    maintainAspectRatio: false,
    elements: {
      line: {
        borderWidth: 1.53,
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: timeOption === "SEASON" ? "WEEKS" : "DAYS",
          font: {
            size: 12,
            weight: 500,
            family: "Didact Gothic",
          },
        },
        type: "time",
        time: {
          unit: "day",
          tooltipFormat: "yyyy-MM-dd",
          displayFormats: {
            day: "yyyy-MM-dd",
          },
        },
        ticks: {
          color: "white",
          font:
            size.screen === BreakPoint.s
              ? {
                  size: 8,
                }
              : {
                  size: 10,
                },
          callback: function (value: string, index: number) {
            if (timeOption === "SEASON") {
              const startDate = season
                ? new Date(season.regularSeasonStartDate)
                : new Date();
              const date = new Date(value);

              return differenceInWeeks(date, startDate) + 1;
            } else {
              return index + 1;
            }
          },
        },
        grid: {
          borderColor:
            size.screen === BreakPoint.l
              ? "white"
              : "rgba(255, 255, 255, 0.25)",
          borderWidth: 3,
          // remove vertial lines
          drawOnChartArea: false,
        },
      },
      y:
        chartType === "TOI"
          ? {
              type: "linear",
              beginAtZero: true,
              min: 0,
              max: 30,

              ticks: {
                color: "white",
                stepSize: 15,
                font:
                  size.screen === BreakPoint.s
                    ? {
                        size: 8,
                      }
                    : {},
              },
              grid: {
                // y axis color
                borderColor: "rgba(255, 255, 255, 0.25)",
                borderWidth: 3,
                // set the color of the background grid
                color: function (context: any) {
                  return context.index > 0 ? "rgba(255, 255, 255, 0.25)" : "";
                },
              },
            }
          : {
              type: "linear",
              beginAtZero: true,
              min: 0,
              max: 100,
              ticks: {
                color: "white",
                autoSkip: false,
                stepSize: 50,
                font:
                  size.screen === BreakPoint.s
                    ? {
                        size: 8,
                      }
                    : {},
              },
              grid: {
                borderColor: "rgba(255, 255, 255, 0.25)",
                borderWidth: 3,
                // set the color of the background grid
                color: function (context: any) {
                  return context.index > 0 ? "rgba(255, 255, 255, 0.25)" : "";
                },
              },
            },
    },
    plugins: {
      legend: {
        display: false,
      },
    },
  } as const;

  // fill the area with linear color
  const gradient = chartRef.current
    ? chartRef.current.ctx.createLinearGradient(
        0,
        0,
        0,
        chartRef.current.height * 0.8
      )
    : "rgba(43, 168, 242, 0.65)";

  if (chartRef.current?.ctx && typeof gradient !== "string") {
    gradient.addColorStop(0, "rgba(43, 168, 242, 0.65)");
    gradient.addColorStop(1, "rgba(76, 167, 221, 0)");
  }

  // x-axis - if time option is Season, display week number. Otherwise display 1,2,3,4...7
  const data = {
    labels: labels,
    datasets: [
      chartType === "TOI"
        ? {
            label: "TOI",
            borderColor: "rgba(76, 167, 221, 1)",
            fill: true,
            backgroundColor: gradient,
            data: TOI,
            pointRadius: 0,
            tension: 0.1,
          }
        : {
            label: "PPTOI",
            borderColor: "rgba(76, 167, 221, 1)",
            fill: true,
            backgroundColor: gradient,
            data: ppTOI,
            pointRadius: 0,
            tension: 0.1,
          },
    ],
  };

  return (
    <Chart
      className={styles.container}
      bodyClassName={styles.chartWrapper}
      header={
        <div className={styles.allOptions}>
          {size.screen === BreakPoint.l ? (
            <div>
              {chartType === "TOI" ? (
                <ChartTitle>
                  Time <HightText>On Ice</HightText>
                </ChartTitle>
              ) : (
                <ChartTitle>
                  Power Play <HightText>Share</HightText>
                </ChartTitle>
              )}
            </div>
          ) : (
            <></>
          )}
        </div>
      }
    >
      {loading && <Spinner className={styles.loading} />}
      {/*  @ts-ignore */}
      <Line ref={chartRef} options={CHART_OPTIONS} data={data} />
    </Chart>
  );
}

type ChartTypeOptionsProps = {
  chartTypeOption: ChartTypeOption;
  setChartTypeOption: Dispatch<SetStateAction<ChartTypeOption>>;
};

export function ChartTypeOptions({
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
