import React from "react";
import useCareerAveragesStats from "hooks/useCareerAveragesStats";
import Chart from "components/Chart";
import Text, { HightText } from "components/Text";
import Spinner from "components/Spinner";

import useScreenSize, { BreakPoint } from "hooks/useScreenSize";
import ClientOnly from "components/ClientOnly";
import { Data } from "pages/api/CareerAverages/[playerId]";
import styles from "./CareerAveragesChart.module.scss";

type SubstainabilityChartProps = {
  playerId: number | undefined;
};

const asPercent = (num: number | null) =>
  num === null
    ? "-"
    : num.toLocaleString(undefined, {
        style: "percent",
        minimumFractionDigits: 1,
      });

export const BLUE = "#07AAE3";
export const RED = "#F65B61";

// How to decide which bg color to use?
// https://github.com/FHFHockey-dev/fhfhockey.com/issues/14#issuecomment-1208254068
export const COLUMNS = [
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
    description: "offensive zone start %",
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

function CareerAveragesChart({ playerId }: SubstainabilityChartProps) {
  const size = useScreenSize();
  const { stats, loading } = useCareerAveragesStats(playerId);

  return (
    <Chart
      className={styles.container}
      bodyClassName={styles.content}
      header={
        <div className={styles.chartHeader}>
          <Text>
            Career <HightText>Averages</HightText>
          </Text>
        </div>
      }
    >
      <ClientOnly style={{ height: "100%" }}>
        {size.screen === BreakPoint.l ? (
          <PCTable data={stats} loading={loading} />
        ) : (
          <MobileTable data={stats} loading={loading} />
        )}
      </ClientOnly>
    </Chart>
  );
}

function MobileTable({
  data,
  loading,
}: {
  data: Data | undefined;
  loading: boolean;
}) {
  return (
    <div className={styles.mobileTable}>
      <div className={styles.values}>
        {COLUMNS.map(({ id, format }) => (
          <div key={id} className={styles.cell}>
            {/* @ts-ignore */}
            {loading ? <Spinner size="small" /> : data ? format(data[id]) : "-"}
          </div>
        ))}
      </div>
    </div>
  );
}

function PCTable({
  data,
  loading,
}: {
  data: Data | undefined;
  loading: boolean;
}) {
  return (
    <div className={styles.pcTable}>
      <div className={styles.header}>
        {COLUMNS.map((col) => (
          <div key={col.name} title={col.description}>
            {col.name}
          </div>
        ))}
      </div>

      <div className={styles.values}>
        {COLUMNS.map(({ id, format }) => (
          <div key={id} className={styles.cell}>
            {/* @ts-ignore */}
            {loading ? <Spinner /> : data ? format(data[id]) : "-"}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CareerAveragesChart;
