import React, { Dispatch, SetStateAction } from "react";

import RadioOptions from "components/RadioOptions";
import Select from "components/Select";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";
import useCurrentSeason, { Season } from "hooks/useCurrentSeason";

export type TimeOption = "L7" | "L14" | "L30" | "SEASON";

type TimeOptionsProps = {
  className?: string;
  type?: "row" | "column";
  timeOption: TimeOption;
  setTimeOption: Dispatch<SetStateAction<TimeOption>>;
};

const shortOptions = [
  { label: "Last 7 Days", value: "L7" },
  { label: "Last 14 Days", value: "L14" },
  { label: "Last 30 Days", value: "L30" },
  { label: "Season Stats", value: "SEASON" },
] as const;

function TimeOptions({ timeOption, setTimeOption, ...rest }: TimeOptionsProps) {
  const size = useScreenSize();
  const season = useCurrentSeason();
  console.log(typeof season?.seasonId);

  const longOptions = [
    { label: season ? getSeasonLable(season) : "2021/22", value: "SEASON" },
    { label: "Last 7", value: "L7" },
    { label: "Last 14", value: "L14" },
    { label: "Last 30", value: "L30" },
  ] as const;

  return size.screen === BreakPoint.l ? (
    <RadioOptions
      options={longOptions}
      option={timeOption}
      onOptionChange={setTimeOption}
      {...rest}
    />
  ) : (
    <Select
      options={shortOptions}
      option={timeOption}
      onOptionChange={setTimeOption}
    />
  );
}

function getSeasonLable(season: Season) {
  const seasonLabel = `${season?.seasonId.slice(0, 4)}/${season?.seasonId.slice(
    6,
    8
  )}`;

  return seasonLabel;
}

export default TimeOptions;
