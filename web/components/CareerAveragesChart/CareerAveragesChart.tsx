import React, { useEffect, useState } from "react";
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

const COLUMNS = [
  {
    id: "S%",
    name: "S%",
    description: "Shoting Percentage",
    format: asPercent,
  },
  {
    id: "xS%",
    name: "xS%",
    description: "XG Per Sixty",
    format: asPercent,
  },
  {
    id: "IPP",
    name: "IPP",
    description: "IPP",
    format: asPercent,
  },
  {
    id: "oiSH%",
    name: "oiSH%",
    description: "On-Ice Shotting Percentage",
    format: asPercent,
  },
  {
    id: "secA%",
    name: "SecA%",
    description: "Secondary assist %",
    format: asPercent,
  },
  {
    id: "SOG/60",
    name: "SOG/60",
    description: "SOG/60",
    format: (num: number) => num.toFixed(1),
  },
  {
    id: "oZS%",
    name: "oZS%",
    description: "offensive zone start %",
    format: asPercent,
  },
] as const;

function CareerAveragesChart({ playerId }: SubstainabilityChartProps) {
  const size = useScreenSize();
  const [stats, setStats] = useState<Data | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!playerId) return;
    (async () => {
      setLoading(true);
      const { success, message, data } = await fetch(
        `/api/CareerAverages/${playerId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      )
        .then((res) => res.json())
        .finally(() => {
          setLoading(false);
        });

      if (success) {
        setStats(data);
      } else {
        setStats(undefined);
        console.error(message);
      }
    })();
  }, [playerId]);

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
            {loading ? <Spinner /> : data ? format(data[id]) : "-"}
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
