export type SkaterTrendCategoryId =
  | "shotsPer60"
  | "ixgPer60"
  | "timeOnIce"
  | "powerPlayTime";

export interface SkaterTrendCategoryDefinition {
  id: SkaterTrendCategoryId;
  label: string;
  description: string;
  metricKey: string;
  higherIsBetter: boolean;
}

export const SKATER_TREND_CATEGORIES: SkaterTrendCategoryDefinition[] = [
  {
    id: "shotsPer60",
    label: "Shots per 60",
    description: "Individual shot volume rate at all strengths.",
    metricKey: "shots_per_60",
    higherIsBetter: true
  },
  {
    id: "ixgPer60",
    label: "ixG per 60",
    description: "Individual expected goal generation rate.",
    metricKey: "ixg_per_60",
    higherIsBetter: true
  },
  {
    id: "timeOnIce",
    label: "Time on Ice",
    description: "Average time on ice per game.",
    metricKey: "toi",
    higherIsBetter: true
  },
  {
    id: "powerPlayTime",
    label: "Power Play TOI",
    description: "Average power-play time on ice per game.",
    metricKey: "pp_toi",
    higherIsBetter: true
  }
];

export const SKATER_WINDOW_OPTIONS = [1, 3, 5, 10] as const;
export type SkaterWindowSize = (typeof SKATER_WINDOW_OPTIONS)[number];

export const FORWARD_POSITIONS = ["C", "LW", "RW", "F", "L", "R"];
export const DEFENSE_POSITIONS = ["D"];

export type SkaterPositionGroup = "forward" | "defense" | "all";

export const SKATER_POSITION_GROUP_MAP: Record<
  SkaterPositionGroup,
  string[] | undefined
> = {
  forward: FORWARD_POSITIONS,
  defense: DEFENSE_POSITIONS,
  all: undefined
};

export const DEFAULT_SKATER_LIMIT = 25;
export const MAX_SKATER_LIMIT = 50;
export const DEFAULT_SKATER_WINDOW: SkaterWindowSize = 1;
