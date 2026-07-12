import { GOALIE_SOURCE_PENDING_METRIC_CONTRACTS } from "./goalieMatrix";
import { getContextualRankingMetricDefinition } from "./metricDefinitions";
import { GOALIE_ROLE_FILTER_OPTIONS } from "./goalieMethodology";
import { getMatrixMetricColumns } from "./matrixMetricRegistry";
import { SKATER_ARCHETYPE_TAG_CONTRACTS } from "./skaterCompositeMethodology";
import { TEAM_SOURCE_PENDING_METRIC_CONTRACTS } from "./teamStyleMethodology";

export type RankingsFilterAvailabilityStatus =
  | "available"
  | "source_pending"
  | "unavailable";

type AvailableFilterOption<T extends string = string> = {
  value: T;
  label: string;
  status: RankingsFilterAvailabilityStatus;
  description?: string;
  disabledReason?: string;
};

type EntityFilterOption = AvailableFilterOption<
  "skaters" | "goalies" | "teams"
> & {
  defaultTab: "rankings";
  supportedTabs: Array<
    | "rankings"
    | "metric_explorer"
    | "deployment_tiers"
    | "trending"
    | "splits"
    | "war"
  >;
};

export type ContextualRankingsAvailableFiltersResponse = ReturnType<
  typeof buildContextualRankingsAvailableFilters
>;

const TABS = [
  { value: "rankings", label: "Rankings", status: "available" },
  { value: "metric_explorer", label: "Metric Explorer", status: "available" },
  {
    value: "deployment_tiers",
    label: "Deployment Tiers",
    status: "available",
    description:
      "Skater deployment-tier rows are live; goalie/team deployment-tier tabs remain Source Pending through entity support metadata.",
  },
  {
    value: "trending",
    label: "Trending",
    status: "available",
    description:
      "Skater trending rows are live; goalie/team trend rows remain Source Pending through entity support metadata.",
  },
  {
    value: "splits",
    label: "Splits",
    status: "available",
    description:
      "Skater split rows are live; goalie/team split rows remain Source Pending through entity support metadata.",
  },
  {
    value: "war",
    label: "Wins Above Replacement",
    status: "source_pending",
    disabledReason:
      "WAR has a published API/UI contract, but no validated replacement-level model is populated.",
  },
] as const satisfies readonly AvailableFilterOption[];

const ENTITY_OPTIONS: EntityFilterOption[] = [
  {
    value: "skaters",
    label: "Skaters",
    status: "available",
    defaultTab: "rankings",
    supportedTabs: [
      "rankings",
      "metric_explorer",
      "deployment_tiers",
      "trending",
      "splits",
      "war",
    ],
  },
  {
    value: "goalies",
    label: "Goalies",
    status: "available",
    defaultTab: "rankings",
    supportedTabs: ["rankings", "war"],
    description:
      "Goalie rankings and snapshots are live. Metric Explorer, trend, split, and deployment-tier row contracts remain Source Pending for goalies.",
  },
  {
    value: "teams",
    label: "Teams",
    status: "available",
    defaultTab: "rankings",
    supportedTabs: ["rankings", "war"],
    description:
      "Team rankings and raw/contextual style snapshots are live. Metric Explorer, trend, split, and deployment-tier row contracts remain Source Pending for teams.",
  },
];

const WINDOW_OPTIONS = [
  { value: "season", label: "Season", status: "available" },
  { value: "last5", label: "Last 5 GP", status: "available" },
  { value: "last10", label: "Last 10 GP", status: "available" },
  { value: "last20", label: "Last 20 GP", status: "available" },
] as const satisfies readonly AvailableFilterOption[];

const POSITION_OPTIONS = [
  { value: "all", label: "All Skaters", status: "available" },
  { value: "F", label: "Forwards", status: "available" },
  { value: "D", label: "Defensemen", status: "available" },
  { value: "G", label: "Goalies", status: "available" },
] as const satisfies readonly AvailableFilterOption[];

const DEPLOYMENT_OPTIONS = [
  { value: "all", label: "All Deployments", status: "available" },
  { value: "L1", label: "L1", status: "available" },
  { value: "L2", label: "L2", status: "available" },
  { value: "L3", label: "L3", status: "available" },
  { value: "L4", label: "L4", status: "available" },
  { value: "P1", label: "P1", status: "available" },
  { value: "P2", label: "P2", status: "available" },
  { value: "P3", label: "P3", status: "available" },
  { value: "PP1", label: "PP1", status: "available" },
  { value: "PP2", label: "PP2", status: "available" },
  { value: "PP3", label: "PP3", status: "available" },
  { value: "PK1", label: "PK1", status: "available" },
  { value: "PK2", label: "PK2", status: "available" },
] as const satisfies readonly AvailableFilterOption[];

const GOALIE_ROLE_OPTIONS = [
  ...GOALIE_ROLE_FILTER_OPTIONS.map((option) => ({
    ...option,
    status: "available" as const,
    description:
      option.value === "all"
        ? "All goalies regardless of workload bucket."
        : "Goalie workload bucket derived from projected season start share, falling back to selected-window team start share.",
  })),
] as const satisfies readonly AvailableFilterOption[];

const STRENGTH_OPTIONS = [
  { value: "all", label: "All Strengths", status: "available" },
  { value: "5v5", label: "True 5v5", status: "available" },
  { value: "ev", label: "Even Strength", status: "available" },
  { value: "pp", label: "Power Play", status: "available" },
  { value: "pk", label: "Penalty Kill / SH", status: "available" },
] as const satisfies readonly AvailableFilterOption[];

const SAMPLE_OPTIONS = [
  { value: "all", label: "All Samples", status: "available" },
  { value: "medium_plus", label: "Medium+", status: "available" },
  { value: "high", label: "High Confidence", status: "available" },
] as const satisfies readonly AvailableFilterOption[];

const SOURCE_QUALITY_OPTIONS = [
  { value: "all", label: "All Sources", status: "available" },
  { value: "clean_only", label: "Clean Only", status: "available" },
  { value: "caveats_only", label: "Caveats Only", status: "available" },
] as const satisfies readonly AvailableFilterOption[];

const DISPLAY_MODE_OPTIONS = [
  { value: "percentile", label: "Percentile", status: "available" },
  { value: "raw_rank", label: "Raw Rank", status: "available" },
  { value: "both", label: "Percentile + Rank + Value", status: "available" },
] as const satisfies readonly AvailableFilterOption[];

const GOALIE_METRIC_OPTIONS = [
  { value: "save_percentage", label: "SV%", status: "available" },
  { value: "gsax", label: "GSAx", status: "available" },
  { value: "gsaa_per_60", label: "GSAA/60", status: "available" },
  {
    value: "xga_per_shot_against",
    label: "xGA/Shot",
    status: "available",
    description:
      "5v5 expected goals against per 5v5 shot against; workload context, not pure goalie talent.",
  },
  {
    value: "goalie_value_signal",
    label: "Value Signal",
    status: "available",
    description:
      "Documented saved-goals signal from available cumulative 5v5 GSAx and GSAA; distinct from Relative SV%.",
  },
  {
    value: "high_danger_save_percentage",
    label: "HD SV%",
    status: "available",
    description: "5v5 high-danger save percentage from NST goalie counts.",
  },
  { value: "quality_start_pct", label: "QS%", status: "available" },
  { value: "really_bad_start_rate", label: "RBS%", status: "available" },
  { value: "steal_rate", label: "Steal Rate", status: "available" },
  { value: "start_share", label: "Start Share", status: "available" },
  {
    value: "relative_save_percentage",
    label: "Rel SV%",
    status: "available",
    description:
      "5v5 save percentage compared with same-team other-goalie 5v5 save percentage in the selected window.",
  },
  ...GOALIE_SOURCE_PENDING_METRIC_CONTRACTS.map((contract) => ({
    value: contract.metricKey,
    label: contract.label,
    status: "source_pending" as const,
    disabledReason: contract.reason,
  })),
] as const satisfies readonly AvailableFilterOption[];

const TEAM_METRIC_OPTIONS = [
  { value: "off_rating", label: "Off Rating", status: "available" },
  { value: "def_rating", label: "Def Rating", status: "available" },
  { value: "xgf60", label: "xGF/60", status: "available" },
  { value: "xga60", label: "xGA/60", status: "available" },
  { value: "xgf_percentage", label: "xGF%", status: "available" },
  { value: "shot_quality", label: "Shot Quality", status: "available" },
  { value: "event_rate", label: "Event Rate", status: "available" },
  { value: "finishing_luck", label: "Finishing Luck", status: "available" },
  { value: "save_luck", label: "Save Luck", status: "available" },
  { value: "net_luck", label: "Net Luck", status: "available" },
  { value: "pace_rating", label: "Pace Rating", status: "available" },
  { value: "special_rating", label: "Special Teams", status: "available" },
  { value: "one_goal_game_rate", label: "1-Goal Game Rate", status: "available" },
  { value: "home_road_point_pct_gap", label: "Home Edge", status: "available" },
  { value: "pp_opportunity_rate", label: "PP Opp/G", status: "available" },
  {
    value: "penalties_taken_per_60",
    label: "Penalties/60",
    status: "available",
    description: "Penalties taken per 60 minutes; lower raw values are better.",
  },
  {
    value: "forward_top_load_index",
    label: "Forward Top Load",
    status: "available",
    description:
      "Average top forward-line share from durable team_unit_toi pooled player-seconds.",
  },
  {
    value: "defense_pair_top_load_index",
    label: "Defense Pair Top Load",
    status: "available",
    description:
      "Average top defense-pair share from durable team_unit_toi pooled player-seconds.",
  },
  {
    value: "pp1_pp2_usage_share",
    label: "PP1/PP2 Usage Share",
    status: "available",
    description:
      "Average PP1 and PP2 share from durable team_unit_toi power-play unit rows.",
  },
  ...TEAM_SOURCE_PENDING_METRIC_CONTRACTS.map((contract) => ({
    value: contract.metricKey,
    label: contract.label,
    status: "source_pending" as const,
    disabledReason: contract.reason,
  })),
] as const satisfies readonly AvailableFilterOption[];

function skaterMetricOptions() {
  return getMatrixMetricColumns().map((column) => {
    const definition = getContextualRankingMetricDefinition(column.metricKey);
    return {
      value: column.metricKey,
      label: column.fullLabel,
      status: column.availabilityState,
      description: definition?.description ?? column.tooltip,
      disabledReason: column.plannedReason,
    };
  });
}

export function buildContextualRankingsAvailableFilters() {
  return {
    success: true,
    version: "contextual_rankings_available_filters_v1",
    generatedAt: new Date().toISOString(),
    defaults: {
      entity: "skaters",
      tab: "rankings",
      window: "season",
      strength: "5v5",
      position: "all",
      deployment: "all",
      skaterMetric: "points_per_60",
      goalieMetric: "save_percentage",
      teamMetric: "off_rating",
      pageSize: 10,
    },
    tabs: [...TABS],
    shared: {
      windows: [...WINDOW_OPTIONS],
      search: {
        status: "available" as const,
        label: "Search",
        description:
          "Filters cached ranking rows by player, goalie, team name, abbreviation, or visible style label before pagination without changing peer rank semantics.",
      },
      sampleConfidence: [...SAMPLE_OPTIONS],
      sourceQuality: [...SOURCE_QUALITY_OPTIONS],
      displayModes: [...DISPLAY_MODE_OPTIONS],
      pageSizes: [10, 25, 50],
    },
    entities: ENTITY_OPTIONS.map((entity) => ({
      ...entity,
      filters:
        entity.value === "skaters"
          ? {
              positions: POSITION_OPTIONS.filter((option) => option.value !== "G"),
              deployments: [...DEPLOYMENT_OPTIONS],
              strengths: [...STRENGTH_OPTIONS],
              team: { status: "available" as const, label: "Team" },
              minimums: {
                gamesPlayed: { status: "available" as const, defaultValue: 1 },
                toiSeconds: { status: "available" as const, defaultValue: 300 },
              },
              metrics: skaterMetricOptions(),
              archetypes: SKATER_ARCHETYPE_TAG_CONTRACTS.map((contract) => ({
                value: contract.key,
                label: contract.label,
                status: "available" as const,
                description: contract.rule,
                components: [...contract.components],
              })),
            }
          : entity.value === "goalies"
            ? {
                positions: POSITION_OPTIONS.filter((option) => option.value === "G"),
                deployments: [...GOALIE_ROLE_OPTIONS],
                strengths: STRENGTH_OPTIONS.map((option) => ({
                  ...option,
                  status: "source_pending" as const,
                  disabledReason:
                    "Goalie rankings currently publish goalie-window metrics without strength-state row partitions.",
                })),
                team: { status: "available" as const, label: "Team" },
                minimums: {
                  starts: { status: "available" as const, defaultValue: 1 },
                  shotsAgainst: { status: "available" as const, defaultValue: 300 },
                },
                metrics: [...GOALIE_METRIC_OPTIONS],
              }
            : {
                positions: [],
                deployments: [],
                strengths: STRENGTH_OPTIONS.map((option) => ({
                  ...option,
                  status: option.value === "5v5" ? "available" as const : "source_pending" as const,
                  disabledReason:
                    option.value === "5v5"
                      ? undefined
                      : "Team matrix currently publishes raw/contextual team style rows from verified available sources, with non-5v5 splits Source Pending.",
                })),
                team: { status: "unavailable" as const, label: "Team" },
                minimums: {},
                metrics: [...TEAM_METRIC_OPTIONS],
              },
    })),
  };
}
