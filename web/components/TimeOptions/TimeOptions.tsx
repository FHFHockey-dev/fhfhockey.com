import React, { Dispatch, SetStateAction } from "react";

import Options from "components/Options";
import RadioOptions from "components/RadioOptions";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";

export type TimeOption = "L7" | "L14" | "L30" | "SEASON";

type TimeOptionsProps = {
  className?: string;
  timeOption: TimeOption;
  setTimeOption: Dispatch<SetStateAction<TimeOption>>;
};

const shortOptions = [
  { label: "L7", value: "L7" },
  { label: "L14", value: "L14" },
  { label: "L30", value: "L30" },
  { label: "Year", value: "SEASON" },
] as const;

const longOptions = [
  { label: "Last 7", value: "L7" },
  { label: "Last 14", value: "L14" },
  { label: "Last 30", value: "L30" },
  { label: "Season", value: "SEASON" },
] as const;

function TimeOptions({ timeOption, setTimeOption, ...rest }: TimeOptionsProps) {
  const size = useScreenSize();

  return size.screen === BreakPoint.l ? (
    <RadioOptions
      options={longOptions}
      option={timeOption}
      onOptionChange={setTimeOption}
      {...rest}
    />
  ) : (
    <Options
      options={shortOptions}
      option={timeOption}
      onOptionChange={setTimeOption}
      {...rest}
    />
  );
}

export default TimeOptions;
