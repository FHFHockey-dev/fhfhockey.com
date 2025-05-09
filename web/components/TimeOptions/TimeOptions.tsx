import React, { Dispatch, SetStateAction } from "react";

import RadioOptions from "components/RadioOptions";
import Select from "components/Select";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";
import useCurrentSeason from "hooks/useCurrentSeason";
import { Season } from "lib/NHL/types";

export type TimeOption =
  | "L7"
  | "L14"
  | "L30"
  | "SEASON"
  | "L5"
  | "L10"
  | "L20"
  | "3YA";

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
  const id = season.seasonId.toString();
  const seasonLabel = `${id.slice(0, 4)}/${id.slice(6, 8)}`;

  return seasonLabel;
}

export default TimeOptions;
