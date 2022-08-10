import React, { useEffect, useState } from "react";
import Chart from "components/Chart";
import Text, { HightText } from "components/Text";
import TimeOptions from "components/TimeOptions";
import { TimeOption } from "components/TimeOptions/TimeOptions";

import styles from "./SubstainabilityChart.module.scss";
import ClientOnly from "components/ClientOnly";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";

type SubstainabilityChartProps = {
  playerId: number | undefined;
};

const COLUMNS = [
  {
    id: "SH%",
    name: "S%",
    description: "Shoting Percentage",
  },
  {
    id: "ixGPerSixty",
    name: "xS%",
    description: "XG Per Sixty",
  },
  {
    id: "IPP",
    name: "IPP",
    description: "IPP",
  },
  {
    id: "oiSH%",
    name: "oiSH%",
    description: "On-Ice Shotting Percentage",
  },
  {
    id: "SecondAssistsPerSixty",
    name: "SecA%",
    description: "Secondary assist %",
  },
  {
    id: "SOG/60",
    name: "SOG/60",
    description: "SOG/60",
  },
  {
    id: "ozS%",
    name: "ozS%",
    description: "offensive zone start %",
  },
] as const;

function SubstainabilityChart({ playerId }: SubstainabilityChartProps) {
  const [timeOption, setTimeOption] = useState<TimeOption>("L7");
  const size = useScreenSize();

  useEffect(() => {}, [playerId]);
  return (
    <Chart
      header={
        <div className={styles.header}>
          <TimeOptions timeOption={timeOption} setTimeOption={setTimeOption} />
          <Text>
            Substainability <HightText>Stats</HightText>
          </Text>
        </div>
      }
    >
      <ClientOnly>
        {size.screen === BreakPoint.s ? <MobileTable /> : <PCTable />}
      </ClientOnly>
    </Chart>
  );
}

type ColumnProps = {
  name: string;
  data: React.ReactNode;
  /**
   * The color of the data cell.
   */
  color: string;
};

function Column({ name, data, color }: ColumnProps) {
  return (
    <div className={styles.column}>
      <div className={styles.name}>{name}</div>
      <div className={styles.dataCell} style={{ backgroundColor: color }}>
        {data}
      </div>
    </div>
  );
}

function MobileTable({ data }: any) {
  return (
    <table className={styles.mobileTable}>
      <thead>
        <tr>
          {COLUMNS.map((col) => (
            <th key={col.name}>{col.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {COLUMNS.map(({ id, name }) => (
            <td key={id}>
              <div>
                <div>{name}</div>
                <div>{data && data[id]}</div>
              </div>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function PCTable() {
  return (
    <table>
      <tr>
        {COLUMNS.map((col) => (
          <th key={col.name}>{col.name}</th>
        ))}
      </tr>
      <tr>
        {COLUMNS.map(() => (
          <></>
        ))}
      </tr>
    </table>
  );
}

export default SubstainabilityChart;
