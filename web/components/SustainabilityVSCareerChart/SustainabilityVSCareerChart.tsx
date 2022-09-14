import React from "react";

import Chart from "components/Chart";
import ChartTitle, { HightText } from "components/ChartTitle";
import useSustainabilityStats from "hooks/useSustainabilityStats";
import useCareerAveragesStats from "hooks/useCareerAveragesStats";
import { TimeOption } from "components/TimeOptions/TimeOptions";
import { Data } from "pages/api/CareerAverages/[playerId]";
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

// How to decide which bg color to use?
// https://github.com/FHFHockey-dev/fhfhockey.com/issues/14#issuecomment-1208254068
const COLUMNS = [
  {
    id: "S%",
    name: "S%",
    description: "Shoting Percentage",
    format: asPercent,
    getBgColor: (value: number, cAvg: Data) => {
      if (cAvg["S%"] === null) {
        return BLUE;
      }
      // Red: If S% is higher than cAvg by 2 or more %
      const TWO_PERCENT = 0.02;
      return value - cAvg["S%"] >= TWO_PERCENT ? RED : BLUE;
    },
  },
  {
    id: "xS%",
    name: "xS%",
    description: "XG Per Sixty",
    format: asPercent,
    getBgColor: (value: number, cAvg: Data) => {
      if (cAvg["xS%"] === null) {
        return BLUE;
      }
      // is xS% is lower than cAvg by 2 or more %
      const TWO_PERCENT = 0.02;
      return cAvg["xS%"] - value >= TWO_PERCENT ? RED : BLUE;
    },
  },
  {
    id: "IPP",
    name: "IPP",
    description: "IPP",
    format: asPercent,
    getBgColor: (value: number, cAvg: Data) => {
      if (cAvg["IPP"] === null) {
        return BLUE;
      }
      // if IPP is higher than cAvg by 5 or more %
      const FIVE_PERCENT = 0.05;
      return value - cAvg["IPP"] >= FIVE_PERCENT ? RED : BLUE;
    },
  },
  {
    id: "oiSH%",
    name: "oiSH%",
    description: "On-Ice Shotting Percentage",
    format: asPercent,
    getBgColor: (value: number, cAvg: Data) => {
      if (cAvg["oiSH%"] === null) {
        return BLUE;
      }
      // oiSH% is more than 1% above cAvg
      const ONE_PERCENT = 0.01;
      return value - cAvg["oiSH%"] >= ONE_PERCENT ? RED : BLUE;
    },
  },
  {
    id: "secA%",
    name: "SecA%",
    description: "Secondary assist %",
    format: asPercent,
    getBgColor: (value: number, cAvg: Data) => {
      if (cAvg["secA%"] === null) {
        return BLUE;
      }
      // secA% is higher than cAvg in any fashion
      return value >= cAvg["secA%"] ? RED : BLUE;
    },
  },
  {
    id: "SOG/60",
    name: "SOG/60",
    description: "SOG/60",
    format: (num: number) => num.toFixed(1),
    getBgColor: (value: number, cAvg: Data) => {
      if (cAvg["SOG/60"] === null) {
        return BLUE;
      }
      // SOG/60 is lower than cAVG
      return value <= cAvg["SOG/60"] ? RED : BLUE;
    },
  },
  {
    id: "oZS%",
    name: "oZS%",
    description: "Offensive zone start %",
    format: asPercent,
    getBgColor: (value: number, cAvg: Data) => {
      if (cAvg["oZS%"] === null) {
        return BLUE;
      }
      // oZS% is lower than cAvg by 5 or more %
      const FIVE_PERCENT = 0.05;
      return cAvg["oZS%"] - value >= FIVE_PERCENT ? RED : BLUE;
    },
  },
] as const;

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
    <Chart
      className={styles.container}
      headerClassName={styles.header}
      bodyClassName={styles.body}
      header={
        <ChartTitle>
          Sustainability <HightText>VS</HightText> Career
        </ChartTitle>
      }
    >
      <div className={styles.stats}>
        {COLUMNS.map(({ id, name, description, format, getBgColor }) => (
          <div key={id} title={description} className={styles.row}>
            <span
              className={styles.sustainabilityStat}
              style={{
                backgroundColor:
                  !loading && stats && careerAveragesStats && stats[id] !== null
                    ? // @ts-ignore
                      getBgColor(stats[id], careerAveragesStats)
                    : BLUE,
              }}
            >
              {loading ? (
                <Spinner
                  size={size.screen === BreakPoint.l ? "medium" : "small"}
                  center
                />
              ) : stats ? (
                // @ts-ignore
                format(stats[id])
              ) : (
                <span>&nbsp;</span>
              )}
            </span>
            <span className={styles.label}>{name}</span>
            <span className={styles.careerAveragesStat}>
              {loading ? (
                <Spinner
                  size={size.screen === BreakPoint.l ? "medium" : "small"}
                  center
                />
              ) : careerAveragesStats ? (
                // @ts-ignore
                format(careerAveragesStats[id])
              ) : (
                <span>&nbsp;</span>
              )}
            </span>
          </div>
        ))}
      </div>
      <Legend />
    </Chart>
  );
}

const LEGEND_INFO = [
  {
    color: "rgba(76, 167, 222, 1)",
    label: "Blue is sustainable",
  },
  {
    color: "rgba(212, 97, 97, 1)",
    label: "Red is unsustainable",
  },
  {
    color: "rgba(255, 255, 255, 0.5)",
    label: "Grey is career average",
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
