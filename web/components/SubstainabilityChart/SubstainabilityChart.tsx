import React, { useEffect, useState } from "react";
import Chart from "components/Chart";
import Text, { HightText } from "components/Text";
import TimeOptions from "components/TimeOptions";
import { TimeOption } from "components/TimeOptions/TimeOptions";

import styles from "./SubstainabilityChart.module.scss";
import ClientOnly from "components/ClientOnly";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";
import { Data } from "pages/api/CareerAverages/[playerId]";
import Spinner from "components/Spinner";
import { COLUMNS } from "components/CareerAveragesChart/CareerAveragesChart";
import useSustainabilityStats from "hooks/useSustainabilityStats";

type SubstainabilityChartProps = {
  playerId: number | undefined;
};

function SubstainabilityChart({ playerId }: SubstainabilityChartProps) {
  const [timeOption, setTimeOption] = useState<TimeOption>("L7");
  const size = useScreenSize();
  const { stats, loading } = useSustainabilityStats(playerId, timeOption);

  return (
    <Chart
      className={styles.container}
      bodyClassName={styles.content}
      header={
        <div className={styles.chartHeader}>
          <TimeOptions
            className={styles.timeOptions}
            timeOption={timeOption}
            setTimeOption={setTimeOption}
          />
          <Text>
            Substainability <HightText>Stats</HightText>
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
        {COLUMNS.map(({ id, name, format, bgColor }) => (
          <div
            key={id}
            className={styles.cell}
            style={{ backgroundColor: bgColor }}
          >
            <div className={styles.statsName}>{name}</div>
            {/* @ts-ignore */}
            <div>{loading ? <Spinner /> : data ? format(data[id]) : "-"}</div>
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
        {COLUMNS.map(({ id, format, bgColor }) => (
          <div
            key={id}
            className={styles.cell}
            style={{ backgroundColor: bgColor }}
          >
            {/* @ts-ignore */}
            {loading ? <Spinner /> : data ? format(data[id]) : "-"}
          </div>
        ))}
      </div>
    </div>
  );
}

export default SubstainabilityChart;
