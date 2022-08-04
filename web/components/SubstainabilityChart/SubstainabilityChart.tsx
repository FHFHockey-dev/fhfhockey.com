import ClientOnly from "components/ClientOnly";
import Text, { HightText } from "components/Text";
import TimeOptions from "components/TimeOptions";
import { TimeOption } from "components/TimeOptions/TimeOptions";
import React, { useState } from "react";

import styles from "./SubstainabilityChart.module.scss";

type SubstainabilityChartProps = {
  playerId: number | undefined;
};

function SubstainabilityChart({ playerId }: SubstainabilityChartProps) {
  const [timeOption, setTimeOption] = useState<TimeOption>("L7");

  return (
    <section className={styles.container}>
      <ClientOnly>
        <header className={styles.header}>
          <TimeOptions timeOption={timeOption} setTimeOption={setTimeOption} />
          <Text>
            Substainability <HightText>Stats</HightText>
          </Text>
        </header>
      </ClientOnly>

      <div className={styles.body}>
        Lorem ipsum dolor sit amet consectetur, adipisicing elit. Facere
        voluptas blanditiis excepturi nesciunt ea magnam consequuntur itaque
        aliquam cupiditate esse ducimus, quisquam dolore a possimus repudiandae
        dolor labore, similique veritatis.
      </div>
    </section>
  );
}

export default SubstainabilityChart;
