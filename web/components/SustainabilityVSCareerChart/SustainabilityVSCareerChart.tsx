import React from "react";

import Chart from "components/Chart";
import ChartTitle, { HightText } from "components/ChartTitle";
import useSustainabilityStats from "hooks/useSustainabilityStats";
import useCareerAveragesStats from "hooks/useCareerAveragesStats";
import { TimeOption } from "components/TimeOptions/TimeOptions";
import { Data } from "pages/api/CareerAverages/[playerId]";
import {
  compareWindowToCareer,
  type CareerComparisonStat,
  type CareerComparisonStatus,
} from "lib/sustainability/careerComparison";
import Spinner from "components/Spinner";

import styles from "./SustainabilityVSCareerChart.module.scss";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";

const asPercent = (num: number | null) =>
  num === null ? (
    <span>&nbsp;</span>
  ) : (
    num.toLocaleString(undefined, {
      style: "percent",
      minimumFractionDigits: 1,
    })
  );

const BLUE = "#07AAE3";
const RED = "#F65B61";

const GREY = "#a7b4c0"; // $color-neutral-400: insufficient sample

// The current window is judged against a usual range for a window of its own
// size, built from the pooled career (BC W1-9 D12). Red means outside that
// range in the direction the column calls unsustainable; grey means the
// window or career sample is insufficient. Descriptive, not a forecast.
const COLUMNS: ReadonlyArray<{
  id: CareerComparisonStat;
  name: string;
  description: string;
  format: (num: number | null) => React.ReactNode;
  redWhen: "hot" | "cold";
}> = [
  {
    id: "S%",
    name: "S%",
    description: "Shooting percentage: goals ÷ shots on goal",
    format: asPercent,
    redWhen: "hot",
  },
  {
    id: "xS%",
    name: "xS%",
    description:
      "Expected shooting percentage: ixG ÷ unblocked attempts (iFF) × 100",
    format: asPercent,
    redWhen: "cold",
  },
  {
    id: "IPP",
    name: "IPP",
    description: "Individual points percentage: points ÷ on-ice goals for",
    format: asPercent,
    redWhen: "hot",
  },
  {
    id: "oiSH%",
    name: "oiSH%",
    description: "On-ice shooting percentage: on-ice goals ÷ on-ice shots",
    format: asPercent,
    redWhen: "hot",
  },
  {
    id: "secA%",
    name: "SecA%",
    description: "Secondary assists ÷ total assists",
    format: asPercent,
    redWhen: "hot",
  },
  {
    id: "SOG/60",
    name: "SOG/60",
    description: "Shots on goal per 60 minutes",
    format: (num: number | null) =>
      num === null ? <span>&nbsp;</span> : num.toFixed(1),
    redWhen: "cold",
  },
  {
    id: "oZS%",
    name: "oZS%",
    description:
      "Offensive zone start %: offensive ÷ (offensive + defensive) zone starts",
    format: asPercent,
    redWhen: "cold",
  },
];

function statusColor(
  status: CareerComparisonStatus,
  redWhen: "hot" | "cold"
): string {
  if (status === "insufficient") return GREY;
  return status === redWhen ? RED : BLUE;
}

type SustainabilityVSCareerChartProps = {
  playerId: number | undefined;
  timeOption: TimeOption;
};

function SustainabilityVSCareerChart({
  playerId,
  timeOption,
}: SustainabilityVSCareerChartProps) {
  const size = useScreenSize();
  const { stats, loading: firstLoading } = useSustainabilityStats(
    playerId,
    timeOption
  );
  const { stats: careerAveragesStats, loading: secondLoading } =
    useCareerAveragesStats(playerId);
  const loading = firstLoading || secondLoading;
  return (
    (<Chart
      className={styles.container}
      headerClassName={styles.header}
      bodyClassName={styles.body}
      header={
        <ChartTitle>
          Sustainability <HightText>Stats</HightText>
        </ChartTitle>
      }
    >
      <div className={styles.stats}>
        {/* table header */}
        <div className={styles.row}>
          <span className={styles.statsHeader}>
            <ChartTitle>CURRENT</ChartTitle>
          </span>
          <span className={styles.statsHeader}>
            <HightText>VS</HightText>
          </span>
          <span className={styles.statsHeader}>
            <HightText>CAREER</HightText>
          </span>
        </div>
        {COLUMNS.map(({ id, name, description, format, redWhen }) => {
          const current = stats as Data | undefined;
          const status: CareerComparisonStatus =
            !loading && current && careerAveragesStats
              ? compareWindowToCareer(
                  id,
                  current.components?.[id],
                  careerAveragesStats.components?.[id]
                ).status
              : "insufficient";
          const color = loading ? BLUE : statusColor(status, redWhen);
          const title =
            status === "insufficient" && !loading
              ? `${description} (insufficient sample to compare)`
              : description;
          return (
            (<div key={id} title={title} className={styles.row}>
              <span
                className={styles.sustainabilityStat}
                style={{
                  backgroundColor: color,
                }}
              >
                {loading ? (
                  <Spinner
                    size={size.screen === BreakPoint.l ? "medium" : "small"}
                    center
                  />
                ) : current ? (
                  format(current[id] ?? null)
                ) : (
                  <span>&nbsp;</span>
                )}
              </span>
              <span
                className={styles.label}
                style={{ color: color === RED ? color : "" }}
              >
                {name}
              </span>
              <span className={styles.careerAveragesStat}>
                {loading ? (
                  <Spinner
                    size={size.screen === BreakPoint.l ? "medium" : "small"}
                    center
                  />
                ) : careerAveragesStats ? (
                  format(careerAveragesStats[id] ?? null)
                ) : (
                  <span>&nbsp;</span>
                )}
              </span>
            </div>)
          );
        })}
      </div>
      <Legend />
    </Chart>)
  );
}

const LEGEND_INFO = [
  {
    color: BLUE,
    label: "Blue: within the career usual range for this sample",
  },
  {
    color: RED,
    label: "Red: outside it in the unsustainable direction",
  },
  {
    color: GREY,
    label: "Grey: sample too small to compare",
  },
] as const;

function Legend() {
  return (
    <div className={styles.legends}>
      {LEGEND_INFO.map(({ color, label }) => (
        <div key={label} className={styles.legend}>
          <div className={styles.box} style={{ backgroundColor: color }} />
          <div className={styles.label}>{label}</div>
        </div>
      ))}
    </div>
  );
}
export default SustainabilityVSCareerChart;
