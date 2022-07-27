import { Dispatch, SetStateAction, useState } from "react";
import CheckButton from "components/CheckButton";

import styles from "./TimeOnIceChart.module.scss";

type TimeOption = "L7" | "L14" | "L30" | "SEASON";

/**
 * Time On Ice | Power Play Time On Ice
 */
type ChartTypeOption = "TOI" | "POWER_PLAY_TOI";

type TimeOnIceChartProps = {
  playerId: number;
};

function TimeOnIceChart({ playerId }: TimeOnIceChartProps) {
  const [timeOption, setTimeOption] = useState<TimeOption>("L7");
  const [chartTypeOption, setChartTypeOption] =
    useState<ChartTypeOption>("POWER_PLAY_TOI");

  return (
    <div>
      <TimeOptions timeOption={timeOption} setTimeOption={setTimeOption} />
      <ChartTypeOptions
        chartTypeOption={chartTypeOption}
        setChartTypeOption={setChartTypeOption}
      />
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

type ChartTypeOptionsProps = {
  chartTypeOption: string;
  setChartTypeOption: Dispatch<SetStateAction<ChartTypeOption>>;
};

function ChartTypeOptions({
  chartTypeOption,
  setChartTypeOption,
}: ChartTypeOptionsProps) {
  const options = [
    { label: "PP%", value: "POWER_PLAY_TOI" },
    { label: "TOI", value: "TOI" },
  ] as const;

  return (
    <div>
      {options.map((option) => (
        <CheckButton
          key={option.value}
          checked={chartTypeOption === option.value}
          onClick={() => setChartTypeOption(option.value)}
        >
          {option.label}
        </CheckButton>
      ))}
    </div>
  );
}

export default TimeOnIceChart;
