import {
  getContextualRankingMetricDefinition,
  type ContextualRankingMetricKey,
} from "./metricDefinitions";
import type {
  GoalieMatrixMetricKey,
  GoalieMatrixRoleFilter,
} from "./goalieMatrix";
import type { TeamMatrixMetricKey } from "./teamMatrix";
import {
  MATRIX_METRIC_GROUPS,
  getMatrixMetricColumn,
} from "./matrixMetricRegistry";
import type { ContextualRankingPeerGroupType } from "./rankingCalculator";
import type {
  ContextualRankingsDeploymentFilter,
  ContextualRankingsPositionFilter,
  ContextualRankingsRequest,
  ContextualRankingsSortDirection,
  ContextualRankingsSortKey,
} from "./rankingTypes";

export type RankingsFilterState = {
  entity: "skaters" | "goalies" | "teams";
  tab:
    | "rankings"
    | "metric_explorer"
    | "deployment_tiers"
    | "trending"
    | "splits"
    | "war";
  season: string;
  window: "season" | "last5" | "last10" | "last20";
  position: ContextualRankingsPositionFilter;
  deployment: ContextualRankingsDeploymentFilter;
  strength: "all" | "5v5" | "ev" | "pp" | "pk";
  metric: ContextualRankingMetricKey;
  minGp: string;
  minToi: string;
  team: string;
  search: string;
  sort: ContextualRankingsSortKey;
  direction: ContextualRankingsSortDirection;
  matrixSortMetric: ContextualRankingMetricKey;
  goalieMetric: GoalieMatrixMetricKey;
  goalieRole: GoalieMatrixRoleFilter;
  teamMetric: TeamMatrixMetricKey;
  matrixSortDirection: ContextualRankingsSortDirection;
  sampleConfidence: "all" | "medium_plus" | "high";
  sourceQuality: "all" | "clean_only" | "caveats_only";
  displayMode: "percentile" | "raw_rank" | "both" | "metric_value";
  metricGroups: string;
  metricColumns: string;
  page: string;
  pageSize: string;
  selectedPlayerId: string;
  selectedGoalieId: string;
  selectedTeam: string;
};

export const DEFAULT_RANKINGS_FILTERS: RankingsFilterState = {
  entity: "skaters",
  tab: "rankings",
  season: "20252026",
  window: "season",
  position: "all",
  deployment: "all",
  strength: "5v5",
  metric: "goals_per_60",
  minGp: "1",
  minToi: "300",
  team: "",
  search: "",
  sort: "percentile",
  direction: "desc",
  matrixSortMetric: "points_per_60",
  goalieMetric: "save_percentage",
  goalieRole: "all",
  teamMetric: "off_rating",
  matrixSortDirection: "desc",
  sampleConfidence: "all",
  sourceQuality: "all",
  displayMode: "both",
  metricGroups: "",
  metricColumns: "",
  page: "1",
  pageSize: "10",
  selectedPlayerId: "",
  selectedGoalieId: "",
  selectedTeam: "",
};

type QueryValue = string | string[] | undefined;
type RankingsQuery = Record<string, QueryValue>;
const MATRIX_PAGE_SIZE_OPTIONS = ["10", "25", "50"] as const;

const DEPLOYMENT_OPTIONS = [
  "all",
  "L1",
  "L2",
  "L3",
  "L4",
  "P1",
  "P2",
  "P3",
  "PP1",
  "PP2",
  "PP3",
  "PK1",
  "PK2",
] as const;

function queryValue(value: QueryValue) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function isValidDeploymentForPosition(
  deployment: RankingsFilterState["deployment"],
  position: RankingsFilterState["position"],
) {
  if (deployment === "all") return true;
  if (!DEPLOYMENT_OPTIONS.includes(deployment)) return false;
  if (deployment.startsWith("PP") || deployment.startsWith("PK")) return true;
  if (position === "F") return deployment.startsWith("L");
  if (position === "D") return deployment.startsWith("P");
  return deployment.startsWith("L") || deployment.startsWith("P");
}

export function defaultDirectionForSort(
  sort: ContextualRankingsSortKey,
): ContextualRankingsSortDirection {
  return sort === "raw_rank" ? "asc" : "desc";
}

function parseSort(value: string): ContextualRankingsSortKey {
  return value === "raw_rank" ||
    value === "metric_value" ||
    value === "gp" ||
    value === "toi_per_game"
    ? value
    : "percentile";
}

function parseDirection(
  value: string,
  sort: ContextualRankingsSortKey,
): ContextualRankingsSortDirection {
  if (value === "asc" || value === "desc") return value;
  return defaultDirectionForSort(sort);
}

function parseMatrixDirection(value: string): ContextualRankingsSortDirection {
  return value === "asc" ? "asc" : "desc";
}

function parseGoalieMetric(value: string): GoalieMatrixMetricKey {
  return value === "gsax" ||
    value === "gsaa_per_60" ||
    value === "xga_per_shot_against" ||
    value === "goalie_value_signal" ||
    value === "high_danger_save_percentage" ||
    value === "quality_start_pct" ||
    value === "really_bad_start_rate" ||
    value === "steal_rate" ||
    value === "start_share"
    ? value
    : "save_percentage";
}

function parseGoalieRole(value: string): GoalieMatrixRoleFilter {
  return value === "g1_workhorse" ||
    value === "g1_starter" ||
    value === "g1a_tandem_lead" ||
    value === "g1b_tandem_secondary" ||
    value === "g2_backup" ||
    value === "g2_reserve"
    ? value
    : "all";
}

function parseTeamMetric(value: string): TeamMatrixMetricKey {
  return value === "def_rating" ||
    value === "xgf60" ||
    value === "xga60" ||
    value === "xgf_percentage" ||
    value === "shot_quality" ||
    value === "event_rate" ||
    value === "finishing_luck" ||
    value === "save_luck" ||
    value === "net_luck" ||
    value === "pace_rating" ||
    value === "special_rating" ||
    value === "one_goal_game_rate" ||
    value === "home_road_point_pct_gap" ||
    value === "pp_opportunity_rate" ||
    value === "penalties_taken_per_60"
    ? value
    : "off_rating";
}

function parseSampleConfidence(
  value: string,
): RankingsFilterState["sampleConfidence"] {
  return value === "medium_plus" || value === "high" ? value : "all";
}

function parseSourceQuality(
  value: string,
): RankingsFilterState["sourceQuality"] {
  return value === "clean_only" || value === "caveats_only" ? value : "all";
}

function parseDisplayMode(value: string): RankingsFilterState["displayMode"] {
  return value === "percentile" ||
    value === "raw_rank" ||
    value === "both" ||
    value === "metric_value"
    ? value
    : DEFAULT_RANKINGS_FILTERS.displayMode;
}

function parsePageSize(value: string): RankingsFilterState["pageSize"] {
  return MATRIX_PAGE_SIZE_OPTIONS.includes(value as any)
    ? value
    : DEFAULT_RANKINGS_FILTERS.pageSize;
}

function parseCsvFilter(value: string, isAllowed: (entry: string) => boolean) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "" && isAllowed(entry))
    .filter((entry, index, entries) => entries.indexOf(entry) === index)
    .join(",");
}

function parseTab(value: string): RankingsFilterState["tab"] {
  if (
    value === "metric_explorer" ||
    value === "deployment_tiers" ||
    value === "trending" ||
    value === "splits" ||
    value === "war"
  ) {
    return value;
  }
  return "rankings";
}

function parseDeployment(value: string): ContextualRankingsDeploymentFilter {
  return DEPLOYMENT_OPTIONS.includes(
    value as ContextualRankingsDeploymentFilter,
  )
    ? (value as ContextualRankingsDeploymentFilter)
    : "all";
}

export function normalizeRankingsFilters(query: RankingsQuery) {
  const sort = parseSort(queryValue(query.sort));
  const deployment = parseDeployment(queryValue(query.deployment));
  const matrixSortMetric = getContextualRankingMetricDefinition(
    queryValue(query.sort_metric),
  )
    ? (queryValue(query.sort_metric) as ContextualRankingMetricKey)
    : DEFAULT_RANKINGS_FILTERS.matrixSortMetric;
  const next: RankingsFilterState = {
    ...DEFAULT_RANKINGS_FILTERS,
    entity:
      queryValue(query.entity) === "goalies" ||
      queryValue(query.entity) === "teams"
        ? (queryValue(query.entity) as RankingsFilterState["entity"])
        : "skaters",
    tab: parseTab(queryValue(query.tab)),
    season: queryValue(query.season) || DEFAULT_RANKINGS_FILTERS.season,
    window:
      queryValue(query.window) === "last5" ||
      queryValue(query.window) === "last10" ||
      queryValue(query.window) === "last20"
        ? (queryValue(query.window) as RankingsFilterState["window"])
        : "season",
    position:
      queryValue(query.position) === "F" || queryValue(query.position) === "D"
        ? (queryValue(query.position) as RankingsFilterState["position"])
        : "all",
    deployment,
    strength:
      queryValue(query.strength) === "5v5" ||
      queryValue(query.strength) === "ev" ||
      queryValue(query.strength) === "pp" ||
      queryValue(query.strength) === "pk"
        ? (queryValue(query.strength) as RankingsFilterState["strength"])
        : DEFAULT_RANKINGS_FILTERS.strength,
    metric: getContextualRankingMetricDefinition(queryValue(query.metric))
      ? (queryValue(query.metric) as ContextualRankingMetricKey)
      : DEFAULT_RANKINGS_FILTERS.metric,
    minGp: queryValue(query.min_gp) || DEFAULT_RANKINGS_FILTERS.minGp,
    minToi: queryValue(query.min_toi) || DEFAULT_RANKINGS_FILTERS.minToi,
    team: queryValue(query.team),
    search: queryValue(query.search).trim().slice(0, 80),
    sort,
    direction: parseDirection(queryValue(query.direction), sort),
    matrixSortMetric,
    goalieMetric: parseGoalieMetric(queryValue(query.goalie_metric)),
    goalieRole: parseGoalieRole(queryValue(query.goalie_role)),
    teamMetric: parseTeamMetric(queryValue(query.team_metric)),
    matrixSortDirection: parseMatrixDirection(queryValue(query.sort_direction)),
    sampleConfidence: parseSampleConfidence(
      queryValue(query.sample_confidence),
    ),
    sourceQuality: parseSourceQuality(queryValue(query.source_quality)),
    displayMode: parseDisplayMode(queryValue(query.display)),
    metricGroups: parseCsvFilter(queryValue(query.groups), (entry) =>
      MATRIX_METRIC_GROUPS.some((group) => group.key === entry),
    ),
    metricColumns: parseCsvFilter(queryValue(query.columns), (entry) =>
      Boolean(getMatrixMetricColumn(entry)),
    ),
    page: queryValue(query.page) || DEFAULT_RANKINGS_FILTERS.page,
    pageSize: parsePageSize(queryValue(query.page_size)),
    selectedPlayerId: queryValue(query.selected_player),
    selectedGoalieId: queryValue(query.selected_goalie),
    selectedTeam: queryValue(query.selected_team).toUpperCase(),
  };
  if (!isValidDeploymentForPosition(next.deployment, next.position)) {
    next.deployment = "all";
  }
  return next;
}

export function buildRankingsContextSummary(filters: RankingsFilterState) {
  const metric = getContextualRankingMetricDefinition(filters.metric);
  const matrixMetric = getMatrixMetricColumn(filters.matrixSortMetric);
  const peer =
    filters.team !== ""
      ? `team ${filters.team}`
      : filters.deployment !== "all"
        ? filters.deployment
        : filters.position !== "all"
          ? filters.position === "F"
            ? "forwards"
            : "defensemen"
          : "all skaters";
  const window =
    filters.window === "season"
      ? "Season"
      : `${filters.window.replace("last", "Last ")} games`;
  const strength = filters.strength.toUpperCase();
  const minGp = Number(filters.minGp) || null;

  if (filters.tab === "rankings") {
    return `Sorted by ${matrixMetric?.fullLabel ?? filters.matrixSortMetric} percentile across ${peer} · ${strength} · ${window}${minGp == null ? "" : ` · Min ${minGp} GP`}`;
  }

  return `${metric?.displayName ?? filters.metric} explorer across ${peer} · ${strength} · ${window}${minGp == null ? "" : ` · Min ${minGp} GP`}`;
}

export function deriveRankingsPeerGroupType(
  filters: RankingsFilterState,
): ContextualRankingPeerGroupType {
  if (filters.team.trim() !== "") return "team";
  if (filters.deployment !== "all") return "deployment";
  if (filters.position !== "all") return "position";
  return "all_skaters";
}

function numericTeamIdOrNull(team: string) {
  const normalized = team.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function buildClientRankingsRequest(
  filters: RankingsFilterState,
): ContextualRankingsRequest {
  return {
    entity: "skaters",
    season: Number(filters.season) || 0,
    asOfDate: null,
    window: filters.window,
    position: filters.position,
    deployment: filters.deployment,
    strength: filters.strength,
    metric: filters.metric,
    minGp: Number(filters.minGp) || null,
    minToiSeconds: Number(filters.minToi) || null,
    teamId: numericTeamIdOrNull(filters.team),
    peerGroupType: deriveRankingsPeerGroupType(filters),
    sort: filters.sort,
    direction: filters.direction,
    limit: 100,
    entityIds: null,
  };
}

export function buildRankingsRequestPath(filters: RankingsFilterState) {
  if (filters.entity !== "skaters") return null;

  const params = new URLSearchParams({
    entity: "skaters",
    season: filters.season,
    window: filters.window,
    position: filters.position,
    deployment: filters.deployment,
    strength: filters.strength,
    metric: filters.metric,
    min_gp: filters.minGp,
    min_toi: filters.minToi,
    sort: filters.sort,
    direction: filters.direction,
    limit: "100",
  });
  if (filters.team.trim() !== "") {
    params.set("team", filters.team.trim());
  }
  if (filters.search.trim() !== "") {
    params.set("search", filters.search.trim());
  }
  return `/api/v1/contextual-rankings?${params.toString()}`;
}

export function buildMatrixRequestPath(filters: RankingsFilterState) {
  if (filters.entity !== "skaters") return null;

  const params = new URLSearchParams({
    entity: "skaters",
    season: filters.season,
    window: filters.window,
    position: filters.position,
    deployment: filters.deployment,
    strength: filters.strength,
    min_gp: filters.minGp,
    min_toi: filters.minToi,
    sort_metric: filters.matrixSortMetric,
    sort_direction: filters.matrixSortDirection,
    page: filters.page,
    page_size: filters.pageSize,
    ranking_source: "entity_metric_rankings",
  });
  if (filters.team.trim() !== "") {
    params.set("team", filters.team.trim());
  }
  if (filters.search.trim() !== "") {
    params.set("search", filters.search.trim());
  }
  if (filters.sampleConfidence !== "all") {
    params.set("sample_confidence", filters.sampleConfidence);
  }
  if (filters.selectedPlayerId.trim() !== "") {
    params.set("selected_player", filters.selectedPlayerId.trim());
  }
  return `/api/v1/contextual-rankings/matrix?${params.toString()}`;
}

export function buildGoalieMatrixRequestPath(filters: RankingsFilterState) {
  const params = new URLSearchParams({
    season: filters.season,
    window: filters.window,
    metric: filters.goalieMetric,
    role: filters.goalieRole,
    sort_direction: filters.matrixSortDirection,
    min_starts: filters.minGp,
    min_shots: filters.minToi,
    page: filters.page,
    page_size: filters.pageSize,
  });
  if (filters.team.trim() !== "") {
    params.set("team", filters.team.trim());
  }
  if (filters.search.trim() !== "") {
    params.set("search", filters.search.trim());
  }
  return `/api/v1/contextual-rankings/goalies?${params.toString()}`;
}

export function buildTeamMatrixRequestPath(filters: RankingsFilterState) {
  const params = new URLSearchParams({
    season: filters.season,
    metric: filters.teamMetric,
    sort_direction: filters.matrixSortDirection,
    page: filters.page,
    page_size: filters.pageSize,
  });
  if (filters.search.trim() !== "") {
    params.set("search", filters.search.trim());
  }
  return `/api/v1/contextual-rankings/teams?${params.toString()}`;
}

export function buildDeploymentTiersRequestPath(filters: RankingsFilterState) {
  if (filters.entity !== "skaters") return null;

  const params = new URLSearchParams({
    entity: "skaters",
    season: filters.season,
    window: filters.window,
    position: filters.position,
    strength: filters.strength,
    min_gp: filters.minGp,
    min_toi: filters.minToi,
  });
  if (filters.team.trim() !== "") {
    params.set("team", filters.team.trim());
  }
  return `/api/v1/contextual-rankings/deployment-tiers?${params.toString()}`;
}

export function buildTrendingRequestPath(filters: RankingsFilterState) {
  if (filters.entity !== "skaters") return null;

  const params = new URLSearchParams({
    entity: "skaters",
    season: filters.season,
    position: filters.position,
    deployment: filters.deployment,
    strength: filters.strength,
    min_gp: filters.minGp,
    min_toi: filters.minToi,
    sort_direction: filters.matrixSortDirection,
    limit: "25",
  });
  if (filters.team.trim() !== "") {
    params.set("team", filters.team.trim());
  }
  return `/api/v1/contextual-rankings/trending?${params.toString()}`;
}

export function buildSplitsRequestPath(filters: RankingsFilterState) {
  if (filters.entity !== "skaters") return null;

  const params = new URLSearchParams({
    entity: "skaters",
    season: filters.season,
    window: filters.window,
    position: filters.position,
    deployment: filters.deployment,
    strength: filters.strength,
    metric: filters.metric,
    min_gp: filters.minGp,
    min_toi: filters.minToi,
    limit: "25",
  });
  if (filters.team.trim() !== "") {
    params.set("team", filters.team.trim());
  }
  return `/api/v1/contextual-rankings/splits?${params.toString()}`;
}

export function buildWarRequestPath(filters: RankingsFilterState) {
  const params = new URLSearchParams({
    entity: filters.entity,
    season: filters.season,
    window: filters.window,
    position: filters.position,
    deployment: filters.deployment,
    strength: filters.strength,
  });
  if (filters.team.trim() !== "") {
    params.set("team", filters.team.trim());
  }
  return `/api/v1/contextual-rankings/war?${params.toString()}`;
}

export function buildSnapshotRequestPath(filters: RankingsFilterState) {
  if (filters.tab !== "rankings") return null;

  const params = new URLSearchParams({
    entity: filters.entity,
    season: filters.season,
    window: filters.window,
    position: filters.position,
    deployment: filters.deployment,
    strength: filters.strength,
    min_gp: filters.minGp,
    min_toi: filters.minToi,
    sort_metric: filters.matrixSortMetric,
    goalie_metric: filters.goalieMetric,
    goalie_role: filters.goalieRole,
    team_metric: filters.teamMetric,
    sort_direction: filters.matrixSortDirection,
  });
  if (filters.team.trim() !== "") {
    params.set("team", filters.team.trim());
  }
  if (filters.search.trim() !== "") {
    params.set("search", filters.search.trim());
  }

  if (filters.entity === "goalies") {
    if (filters.selectedGoalieId.trim() === "") return null;
    params.set("selected_goalie", filters.selectedGoalieId.trim());
  } else if (filters.entity === "teams") {
    if (filters.selectedTeam.trim() === "") return null;
    params.set("selected_team", filters.selectedTeam.trim().toUpperCase());
  } else {
    if (filters.selectedPlayerId.trim() === "") return null;
    params.set("selected_player", filters.selectedPlayerId.trim());
  }

  return `/api/v1/contextual-rankings/snapshot?${params.toString()}`;
}
