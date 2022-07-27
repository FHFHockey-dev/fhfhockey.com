import { Dispatch, SetStateAction, useState } from "react";
import CheckButton from "components/CheckButton";

import styles from "./TimeOnIceChart.module.scss";

type TimeOption = "L7" | "L14" | "L30" | "SEASON";

/**
 * Time On Ice | Power Play Time On Ice
 */
type ChartTypeOption = "TOI" | "PPTOI";

type TimeOnIceChartProps = {
  playerId: number;
};

function TimeOnIceChart({ playerId }: TimeOnIceChartProps) {
  const [timeOption, setTimeOption] = useState<TimeOption>("L7");

  return (
    <div>
      <TimeOptions timeOption={timeOption} setTimeOption={setTimeOption} />
      {playerId}
    </div>
  );
}

type TimeOptionsProps = {
  timeOption: string;
  setTimeOption: Dispatch<SetStateAction<TimeOption>>;
};

function TimeOptions({ timeOption, setTimeOption }: TimeOptionsProps) {
  const options = [
    { label: "L7", value: "L7" },
    { label: "L14", value: "L14" },
    { label: "L30", value: "L30" },
    { label: "Season", value: "SEASON" },
  ] as const;

  return (
    <div>
      {options.map((option) => (
        <CheckButton
          key={option.value}
          checked={timeOption === option.value}
          onClick={() => setTimeOption(option.value)}
        >
          {option.label}
        </CheckButton>
      ))}
    </div>
  );
}

export default TimeOnIceChart;
