import type { RankingsFilterState } from "./rankingUrlState";

export type WarEntity = RankingsFilterState["entity"];

export type WarAvailabilityStatus = "source_pending";

export type WarPrerequisiteStatus =
  | "missing"
  | "available_not_joined"
  | "needs_validation";

export type WarPrerequisite = {
  key: string;
  label: string;
  status: WarPrerequisiteStatus;
  detail: string;
};

export type WarSurfaceRequest = {
  entity: WarEntity;
  season: number;
  window: RankingsFilterState["window"];
  strength: RankingsFilterState["strength"];
  position: RankingsFilterState["position"];
  deployment: RankingsFilterState["deployment"];
};

export type WarSurfaceResponse = {
  success: true;
  request: WarSurfaceRequest;
  status: WarAvailabilityStatus;
  methodology: {
    key: "wins_above_replacement";
    label: "Wins Above Replacement";
    version: null;
    updatedAt: null;
    sourceStatus: WarAvailabilityStatus;
    replacementBaseline: null;
    formula: null;
    denominator: "wins";
    direction: "higher_is_better";
  };
  summary: string;
  sourcePendingReason: string;
  sourceTables: string[];
  prerequisites: WarPrerequisite[];
  caveats: string[];
  rows: [];
  meta: {
    generatedAt: string;
    sourceStatus: WarAvailabilityStatus;
    rowCount: 0;
    message: string;
  };
};

function parseSeason(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20252026;
}

function parseEntity(value: string | string[] | undefined): WarEntity {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "goalies" || raw === "teams") return raw;
  return "skaters";
}

function parseWindow(value: string | string[] | undefined): RankingsFilterState["window"] {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "last5" || raw === "last10" || raw === "last20") return raw;
  return "season";
}

function parseStrength(
  value: string | string[] | undefined,
): RankingsFilterState["strength"] {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "all" || raw === "ev" || raw === "pp" || raw === "pk") return raw;
  return "5v5";
}

function parsePosition(
  value: string | string[] | undefined,
): RankingsFilterState["position"] {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "F" || raw === "D") return raw;
  return "all";
}

function parseDeployment(
  value: string | string[] | undefined,
): RankingsFilterState["deployment"] {
  const raw = Array.isArray(value) ? value[0] : value;
  if (
    raw === "L1" ||
    raw === "L2" ||
    raw === "L3" ||
    raw === "L4" ||
    raw === "P1" ||
    raw === "P2" ||
    raw === "P3" ||
    raw === "PP1" ||
    raw === "PP2" ||
    raw === "PP3" ||
    raw === "PK1" ||
    raw === "PK2"
  ) {
    return raw;
  }
  return "all";
}

export function parseWarSurfaceRequest(
  query: Record<string, string | string[] | undefined>,
): WarSurfaceRequest {
  return {
    entity: parseEntity(query.entity),
    season: parseSeason(query.season),
    window: parseWindow(query.window),
    strength: parseStrength(query.strength),
    position: parsePosition(query.position),
    deployment: parseDeployment(query.deployment),
  };
}

export function buildWarSurface(request: WarSurfaceRequest): WarSurfaceResponse {
  return {
    success: true,
    request,
    status: "source_pending",
    methodology: {
      key: "wins_above_replacement",
      label: "Wins Above Replacement",
      version: null,
      updatedAt: null,
      sourceStatus: "source_pending",
      replacementBaseline: null,
      formula: null,
      denominator: "wins",
      direction: "higher_is_better",
    },
    summary:
      "WAR remains unavailable until a defensible replacement-level model is documented, validated, and populated.",
    sourcePendingReason:
      "The current rankings snapshots publish descriptive rates, percentiles, deployment context, and composites, but they do not define replacement baselines, position adjustments, or win-value conversion.",
    sourceTables: [
      "rolling_player_game_metrics",
      "skater_composite_ratings",
      "goalie_stats_unified",
      "team_power_ratings_daily",
    ],
    prerequisites: [
      {
        key: "replacement_baseline",
        label: "Replacement Baseline",
        status: "missing",
        detail:
          "No approved skater, goalie, or team replacement baseline is published for this ranking surface.",
      },
      {
        key: "position_adjustment",
        label: "Position Adjustment",
        status: "missing",
        detail:
          "Forward, defense, goalie, and team contexts need separately validated adjustment rules before WAR can be shown.",
      },
      {
        key: "win_value_conversion",
        label: "Win Conversion",
        status: "needs_validation",
        detail:
          "Existing percentile composites are not a goals-to-wins or replacement-value model.",
      },
      {
        key: "source_join",
        label: "Snapshot Join",
        status: "available_not_joined",
        detail:
          "Ranking snapshots expose inputs that could feed a future model, but no WAR row contract is populated.",
      },
    ],
    caveats: [
      "No WAR values are exposed in API or UI.",
      "Current matrix metrics are not a WAR substitute.",
      "Do not compare source-pending WAR state against live percentile rankings.",
    ],
    rows: [],
    meta: {
      generatedAt: new Date().toISOString(),
      sourceStatus: "source_pending",
      rowCount: 0,
      message:
        "Wins Above Replacement is Source Pending for this entity and filter context.",
    },
  };
}
