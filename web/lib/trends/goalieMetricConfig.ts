export type GoalieTrendCategoryId =
  | "savePct"
  | "qualityStartsPct"
  | "goalsAgainstAvg"
  | "saveVolume";

export interface GoalieTrendCategoryDefinition {
  id: GoalieTrendCategoryId;
  label: string;
  description: string;
  metricKey: string;
  higherIsBetter: boolean;
}

export const GOALIE_TREND_CATEGORIES: GoalieTrendCategoryDefinition[] = [
  {
    id: "savePct",
    label: "Save %",
    description: "Recent shot-stopping efficiency.",
    metricKey: "save_pct",
    higherIsBetter: true
  },
  {
    id: "qualityStartsPct",
    label: "Quality Starts %",
    description: "Recent quality-start share.",
    metricKey: "quality_starts_pct",
    higherIsBetter: true
  },
  {
    id: "goalsAgainstAvg",
    label: "GAA",
    description: "Recent goals-against average.",
    metricKey: "goals_against_avg",
    higherIsBetter: false
  },
  {
    id: "saveVolume",
    label: "Saves",
    description: "Recent save volume and workload pressure.",
    metricKey: "saves",
    higherIsBetter: true
  }
];

export const GOALIE_WINDOW_OPTIONS = [1, 3, 5, 10] as const;
export type GoalieWindowSize = (typeof GOALIE_WINDOW_OPTIONS)[number];

export const DEFAULT_GOALIE_LIMIT = 20;
export const MAX_GOALIE_LIMIT = 40;
export const DEFAULT_GOALIE_WINDOW: GoalieWindowSize = 3;
