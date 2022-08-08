import React, { useState } from "react";
import Chart from "components/Chart";
import Text, { HightText } from "components/Text";
import { TimeOption } from "components/TimeOptions/TimeOptions";

import styles from "./CareerAveragesChart.module.scss";

type SubstainabilityChartProps = {
  playerId: number | undefined;
};

function CareerAveragesChart({ playerId }: SubstainabilityChartProps) {
  const [timeOption, setTimeOption] = useState<TimeOption>("L7");

  return (
    <Chart
      header={
        <div className={styles.header}>
          <Text>
            Career <HightText>Averages</HightText>
          </Text>
        </div>
      }
    >
      Lorem ipsum dolor sit amet consectetur, adipisicing elit. Facere voluptas
      blanditiis excepturi nesciunt ea magnam consequuntur itaque aliquam
      cupiditate esse ducimus, quisquam dolore a possimus repudiandae dolor
      labore, similique veritatis.
    </Chart>
  );
}

export default CareerAveragesChart;
