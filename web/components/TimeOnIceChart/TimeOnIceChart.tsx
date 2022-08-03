import { Dispatch, SetStateAction, useEffect, useState } from "react";

import Options from "components/Options";

import styles from "./TimeOnIceChart.module.scss";

import { Line } from "react-chartjs-2";
import "chartjs-adapter-date-fns";

import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  TimeScale,
} from "chart.js";
import { subDays, format, differenceInWeeks } from "date-fns";
import useCurrentSeason from "hooks/useCurrentSeason";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";
import Spinner from "components/Spinner";
import Text, { HightText } from "components/Text";
import ClientOnly from "components/ClientOnly";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  TimeScale
);

type TimeOption = "L7" | "L14" | "L30" | "SEASON";

/**
 * Time On Ice | Power Play Time On Ice
 */
type ChartTypeOption = "TOI" | "POWER_PLAY_TOI";

type TimeOnIceChartProps = {
  chartType: ChartTypeOption;
  playerId: number | undefined;
};

const CHART_AXIS_COLOR = "#07aae2";
function TimeOnIceChart({ playerId, chartType }: TimeOnIceChartProps) {
  const size = useScreenSize();
  const [timeOption, setTimeOption] = useState<TimeOption>("L7");
  const [chartTypeOption, setChartTypeOption] =
    useState<ChartTypeOption>(chartType);

  const season = useCurrentSeason();

  const [loading, setLoading] = useState(false);
  const [TOI, setTOI] = useState<number[]>([]);
  const [ppTOI, setPPTOI] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);

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

  let CHART_OPTIONS = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
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
              : {},
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
          borderColor: CHART_AXIS_COLOR,
          borderWidth: 3,
        },
      },
      y:
        chartTypeOption === "TOI"
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
                borderColor: CHART_AXIS_COLOR,
                borderWidth: 3,
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
                borderColor: CHART_AXIS_COLOR,
                borderWidth: 3,
              },
            },
    },
  } as const;

  // x-axis - if time option is Season, display week number. Otherwise display 1,2,3,4...7
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
        <ClientOnly>
          {size.screen === BreakPoint.l ? (
            <div>
              {chartTypeOption === "TOI" ? (
                <Text>
                  Time On <HightText>Ice</HightText>
                </Text>
              ) : (
                <Text>
                  Power Play <HightText>Share</HightText>
                </Text>
              )}
            </div>
          ) : (
            <ChartTypeOptions
              chartTypeOption={chartTypeOption}
              setChartTypeOption={setChartTypeOption}
            />
          )}
        </ClientOnly>
      </div>
      <div className={styles.chartWrapper}>
        {loading && <Spinner className={styles.loading} />}
        {/*  @ts-ignore */}
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
