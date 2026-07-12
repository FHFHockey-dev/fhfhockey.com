import {
  getContextualRankingMetricDefinition,
  type ContextualRankingMetricDefinition,
  type ContextualRankingMetricKey,
} from "./metricDefinitions";
import type { SkaterWindowStrengthState } from "./skaterWindowAggregation";

export type MatrixMetricGroupKey =
  | "offense"
  | "playmaking"
  | "shot_volume"
  | "defense_on_ice"
  | "physical_fantasy"
  | "regression_finishing"
  | "overall_context";

export type MatrixMetricGroup = {
  key: MatrixMetricGroupKey;
  label: string;
  description: string;
};

export type MatrixMetricColumn = {
  metricKey: ContextualRankingMetricKey;
  groupKey: MatrixMetricGroupKey;
  shortLabel: string;
  fullLabel: string;
  tooltip: string;
  defaultVisible: boolean;
  playerTypes: readonly ("skater" | "goalie")[];
  plannedReason?: string;
};

export type MatrixMetricColumnDefinition = MatrixMetricColumn & {
  definition: ContextualRankingMetricDefinition | undefined;
  availabilityState: "available" | "planned" | "unavailable";
  lowerIsBetter: boolean;
  sourceQualityFlags: readonly string[];
  denominatorKey: string | null;
  denominatorDescription: string | null;
  methodologyVersion: string | null;
};

export const MATRIX_METRIC_GROUPS: MatrixMetricGroup[] = [
  {
    key: "offense",
    label: "Offense",
    description: "Result and scoring-rate production in the selected context.",
  },
  {
    key: "playmaking",
    label: "Playmaking",
    description: "Assist creation and point involvement signals.",
  },
  {
    key: "shot_volume",
    label: "Shot Volume",
    description: "Shot pressure and individual chance-generation volume.",
  },
  {
    key: "defense_on_ice",
    label: "Defense / On-Ice",
    description:
      "Verified raw on-ice defensive and process metrics, with context caveats.",
  },
  {
    key: "physical_fantasy",
    label: "Physical / Fantasy",
    description: "Fantasy-relevant peripherals from verified rolling sources.",
  },
  {
    key: "regression_finishing",
    label: "Regression / Finishing",
    description: "xG finishing, shot quality, and regression-oriented metrics.",
  },
  {
    key: "overall_context",
    label: "Overall / Context",
    description: "Composite and archetype slots that remain planned for this milestone.",
  },
];

const MATRIX_METRIC_COLUMNS: MatrixMetricColumn[] = [
  {
    metricKey: "goals_per_60",
    groupKey: "offense",
    shortLabel: "G/60",
    fullLabel: "Goals/60",
    tooltip: "Goals per 60 minutes in the selected window.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "points_per_60",
    groupKey: "offense",
    shortLabel: "P/60",
    fullLabel: "Points/60",
    tooltip: "Total points per 60 minutes in the selected window.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "pp_points_per_60",
    groupKey: "offense",
    shortLabel: "PPP/60",
    fullLabel: "PP Points/60",
    tooltip: "Power-play points per 60 minutes in the selected PP window.",
    defaultVisible: false,
    playerTypes: ["skater"],
  },
  {
    metricKey: "ixg_per_60",
    groupKey: "offense",
    shortLabel: "ixG/60",
    fullLabel: "Individual xG/60",
    tooltip: "Individual expected goals per 60 minutes.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "assists_per_60",
    groupKey: "playmaking",
    shortLabel: "A1+A2/60",
    fullLabel: "Assists/60",
    tooltip: "Total assists per 60 minutes.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "primary_assists_per_60",
    groupKey: "playmaking",
    shortLabel: "A1/60",
    fullLabel: "Primary Assists/60",
    tooltip: "Primary assists per 60 minutes.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "sog_per_60",
    groupKey: "shot_volume",
    shortLabel: "SOG/60",
    fullLabel: "Shots/60",
    tooltip: "Shots on goal per 60 minutes.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "shot_attempts_per_60",
    groupKey: "shot_volume",
    shortLabel: "iCF/60",
    fullLabel: "Shot Attempts/60",
    tooltip: "Individual shot attempts per 60 minutes from verified ICF source data.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "xga_per_60",
    groupKey: "defense_on_ice",
    shortLabel: "xGA/60",
    fullLabel: "xGA/60",
    tooltip: "Raw on-ice expected goals against per 60 minutes. Lower raw values are better.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "on_ice_gf_percentage",
    groupKey: "defense_on_ice",
    shortLabel: "oiGF%",
    fullLabel: "On-ice GF%",
    tooltip: "Share of on-ice goals that were goals for.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "on_ice_xgf_percentage",
    groupKey: "defense_on_ice",
    shortLabel: "oiXGF%",
    fullLabel: "On-ice xGF%",
    tooltip: "Share of on-ice expected goals that were expected goals for.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "hits_per_60",
    groupKey: "physical_fantasy",
    shortLabel: "Hits/60",
    fullLabel: "Hits/60",
    tooltip: "Hits per 60 minutes.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "blocks_per_60",
    groupKey: "physical_fantasy",
    shortLabel: "Blks/60",
    fullLabel: "Blocks/60",
    tooltip: "Blocked shots per 60 minutes.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "expected_shooting_percentage",
    groupKey: "regression_finishing",
    shortLabel: "xS%",
    fullLabel: "Expected Shooting %",
    tooltip: "Expected shooting percentage from individual xG and unblocked attempts.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "sax_percentage",
    groupKey: "regression_finishing",
    shortLabel: "SAX%",
    fullLabel: "Shooting Above Expected",
    tooltip: "Actual shooting percentage minus expected shooting percentage.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "goals_above_expected",
    groupKey: "regression_finishing",
    shortLabel: "G above xG",
    fullLabel: "Goals Above Expected",
    tooltip: "Goals scored above individual expected goals.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "unrealized_xg",
    groupKey: "regression_finishing",
    shortLabel: "Unreal xG",
    fullLabel: "Unrealized xG",
    tooltip: "Expected goals generated but not converted into goals.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "penalties_taken_per_60",
    groupKey: "physical_fantasy",
    shortLabel: "Pen/60",
    fullLabel: "Penalties Taken/60",
    tooltip: "Total penalties taken per 60 minutes. Lower raw values are better.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "rel_5v5_gf_percentage",
    groupKey: "defense_on_ice",
    shortLabel: "Rel GF%",
    fullLabel: "Relative 5v5 GF%",
    tooltip: "Planned team-without-player relative goal-share metric.",
    defaultVisible: false,
    playerTypes: ["skater"],
    plannedReason:
      "Requires matched team-without-player 5v5 goals-for/goals-against and TOI baselines.",
  },
  {
    metricKey: "rel_5v5_xgf_percentage",
    groupKey: "defense_on_ice",
    shortLabel: "Rel xGF%",
    fullLabel: "Relative 5v5 xGF%",
    tooltip: "Planned team-without-player relative xG-share metric.",
    defaultVisible: false,
    playerTypes: ["skater"],
    plannedReason:
      "Requires matched team-without-player 5v5 xGF/xGA and TOI baselines.",
  },
  {
    metricKey: "results_luck_index",
    groupKey: "overall_context",
    shortLabel: "Luck",
    fullLabel: "Results Luck Index",
    tooltip:
      "Current 100-centered Results Luck Index; values above 100 mean current results are running hotter than a selected-window-excluded baseline.",
    defaultVisible: false,
    playerTypes: ["skater"],
  },
  {
    metricKey: "offense_rating",
    groupKey: "overall_context",
    shortLabel: "Off",
    fullLabel: "Offense Rating",
    tooltip:
      "Published contextual descriptive offensive composite from skater_composite_ratings; not an adjusted isolated-impact metric.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "defense_rating",
    groupKey: "overall_context",
    shortLabel: "Def",
    fullLabel: "Defensive Impact",
    tooltip:
      "Published contextual defensive-impact-in-context composite from skater_composite_ratings; uses unadjusted on-ice inputs and is not isolated defensive talent.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "mcm_score",
    groupKey: "overall_context",
    shortLabel: "MCM",
    fullLabel: "MCM Score",
    tooltip:
      "Multi-category fantasy composite from verified contextual percentile components, including live PP points where PP rows are available.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
  {
    metricKey: "beast_tier",
    groupKey: "overall_context",
    shortLabel: "BEAST",
    fullLabel: "BEAST Tier",
    tooltip:
      "Fantasy tier label from verified MCM component gates, including live PP points where PP rows are available.",
    defaultVisible: true,
    playerTypes: ["skater"],
  },
];

export function getMatrixMetricColumns(): MatrixMetricColumnDefinition[] {
  return MATRIX_METRIC_COLUMNS.map((column) => {
    const definition = getContextualRankingMetricDefinition(column.metricKey);
    const availabilityState = definition?.availabilityStatus ?? "unavailable";

    return {
      ...column,
      definition,
      availabilityState,
      lowerIsBetter: definition?.higherIsBetter === false,
      sourceQualityFlags: definition?.sourceQualityFlags ?? [],
      denominatorKey: definition?.denominatorKey ?? null,
      denominatorDescription: definition?.denominatorDescription ?? null,
      methodologyVersion: definition?.methodologyVersion ?? null,
    };
  });
}

export function getDefaultMatrixMetricColumns(args?: {
  strength?: SkaterWindowStrengthState;
}) {
  return getMatrixMetricColumns().filter((column) => {
    if (!column.defaultVisible) return false;
    if (column.availabilityState !== "available") return false;
    if (
      args?.strength &&
      column.definition &&
      !column.definition.applicableStrengthStates.includes(args.strength)
    ) {
      return false;
    }
    return true;
  });
}

export function getMatrixMetricColumn(metricKey: string) {
  return getMatrixMetricColumns().find((column) => column.metricKey === metricKey);
}
