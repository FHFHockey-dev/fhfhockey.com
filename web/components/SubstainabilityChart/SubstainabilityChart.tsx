import React, { useState } from "react";
import Chart from "components/Chart";
import Text, { HightText } from "components/Text";
import TimeOptions from "components/TimeOptions";
import { TimeOption } from "components/TimeOptions/TimeOptions";

import styles from "./SubstainabilityChart.module.scss";
import ClientOnly from "components/ClientOnly";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";
import { Data } from "pages/api/CareerAverages/[playerId]";
import Spinner from "components/Spinner";
import {
  BLUE,
  COLUMNS,
} from "components/CareerAveragesChart/CareerAveragesChart";
import useSustainabilityStats from "hooks/useSustainabilityStats";
import useCareerAveragesStats from "hooks/useCareerAveragesStats";

type SubstainabilityChartProps = {
  playerId: number | undefined;
};

function SubstainabilityChart({ playerId }: SubstainabilityChartProps) {
  const [timeOption, setTimeOption] = useState<TimeOption>("L7");
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
          <PCTable
            data={stats}
            careerAveragesStats={careerAveragesStats}
            loading={loading}
          />
        ) : (
          <MobileTable
            data={stats}
            careerAveragesStats={careerAveragesStats}
            loading={loading}
          />
        )}
      </ClientOnly>
    </Chart>
  );
}

function MobileTable({
  data,
  careerAveragesStats,
  loading,
}: {
  data: Data | undefined;
  careerAveragesStats: Data | undefined;
  loading: boolean;
}) {
  return (
    <div className={styles.mobileTable}>
      <div className={styles.values}>
        {COLUMNS.map(({ id, name, format, getBgColor }) => (
          <div
            key={id}
            className={styles.cell}
            style={{
              backgroundColor:
                !loading && data && careerAveragesStats && data[id] !== null
                  ? // @ts-ignore
                    getBgColor(data[id], careerAveragesStats)
                  : BLUE,
            }}
          >
            <div className={styles.statsName}>{name}</div>
            <div>
              {loading ? (
                <Spinner size="small" />
              ) : data ? (
                // @ts-ignore
                format(data[id])
              ) : (
                "-"
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function PCTable({
  data,
  careerAveragesStats,
  loading,
}: {
  data: Data | undefined;
  careerAveragesStats: Data | undefined;
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
        {COLUMNS.map(({ id, format, getBgColor }) => (
          <div
            key={id}
            className={styles.cell}
            style={{
              backgroundColor: loading
                ? BLUE
                : data && careerAveragesStats && data[id] !== null
                ? // @ts-ignore
                  getBgColor(data[id], careerAveragesStats)
                : BLUE,
            }}
          >
            {/* @ts-ignore */}
            {loading ? <Spinner size="small" /> : data ? format(data[id]) : "-"}
          </div>
        ))}
      </div>
    </div>
  );
}

export default SubstainabilityChart;
