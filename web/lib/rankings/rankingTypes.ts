import type { NextApiRequest } from "next";

import {
  getContextualRankingMetricDefinition,
  type ContextualRankingMetricKey,
} from "./metricDefinitions";
import type {
  ContextualRankingPeerGroupType,
  RankingPeerGroupWarning,
  RankingSampleConfidence,
} from "./rankingCalculator";
import type {
  EvDeploymentBucket,
  SpecialTeamsDeploymentBucket,
} from "./skaterDeploymentAggregation";
import type {
  SkaterProductionWindow,
  SkaterWindowStrengthState,
} from "./skaterWindowAggregation";

export type ContextualRankingsEntity = "skaters";
export type ContextualRankingsPositionFilter = "all" | "F" | "D";
export type ContextualRankingsDeploymentFilter =
  | "all"
  | EvDeploymentBucket
  | SpecialTeamsDeploymentBucket;
export type ContextualRankingsSortKey =
  | "percentile"
  | "raw_rank"
  | "metric_value"
  | "gp"
  | "toi_per_game";
export type ContextualRankingsSortDirection = "asc" | "desc";

export type ContextualRankingsRequest = {
  entity: ContextualRankingsEntity;
  season: number;
  asOfDate: string | null;
  window: SkaterProductionWindow;
  position: ContextualRankingsPositionFilter;
  deployment: ContextualRankingsDeploymentFilter;
  strength: SkaterWindowStrengthState;
  metric: ContextualRankingMetricKey;
  minGp: number | null;
  minToiSeconds: number | null;
  teamId: number | null;
  peerGroupType: ContextualRankingPeerGroupType;
  sort: ContextualRankingsSortKey;
  direction: ContextualRankingsSortDirection;
  limit: number | null;
  entityIds: number[] | null;
};

export type ContextualRankingApiRow = {
  entity: {
    id: number;
    name: string | null;
    position: string | null;
    positionGroup: "forward" | "defense" | null;
    imageUrl: string | null;
  };
  team: {
    id: number | null;
    abbreviation: string | null;
    name: string | null;
  };
  deployment: {
    ev: EvDeploymentBucket | null;
    pp: SpecialTeamsDeploymentBucket | null;
    pk: SpecialTeamsDeploymentBucket | null;
    confidence: RankingSampleConfidence;
  };
  sample: {
    gamesPlayed: number | null;
    toiSeconds: number | null;
    toiPerGameSeconds: number | null;
    confidence: RankingSampleConfidence;
    minimumSampleMet: boolean;
  };
  metric: {
    key: ContextualRankingMetricKey;
    value: number | null;
    formattedValue: string | null;
    rawRank: number | null;
    percentile: number | null;
    qualifiedPeerCount: number;
  };
  peerGroup: {
    type: ContextualRankingPeerGroupType;
    key: string;
  };
  tags: string[];
  warnings: RankingPeerGroupWarning[];
  explanationItems: string[];
};

export type ContextualRankingsResponse = {
  success: boolean;
  request: ContextualRankingsRequest;
  rankings: ContextualRankingApiRow[];
  meta: {
    generatedAt: string;
    snapshotDate: string | null;
    snapshotUpdatedAt: string | null;
    latestAvailableSnapshotDate: string | null;
    snapshotSelectionReason:
      | "latest_available"
      | "latest_calculable_metric"
      | "metric_unavailable"
      | "no_snapshot";
    sourceTable: "rolling_player_game_metrics";
    metric: {
      key: string;
      displayName: string | null;
      availabilityStatus: string | null;
      higherIsBetter: boolean | null;
      description: string | null;
      formulaDescription: string | null;
      applicableStrengthStates: string[];
      denominatorKey: string | null;
      denominatorDescription: string | null;
      sampleRequirements: {
        minimumGp: number;
        minimumToiSeconds: number;
        windowSource: string;
        notes?: readonly string[];
      } | null;
      methodologyVersion: string | null;
      methodologyUpdatedAt: string | null;
      sourceQualityFlags: string[];
    };
    unavailable: boolean;
    rowCount: number;
    limit: number | null;
    message: string | null;
  };
};

type QueryValue = string | string[] | undefined;

export class ContextualRankingsQueryError extends Error {
  statusCode = 400;
  details?: Record<string, string>;

  constructor(message: string, details?: Record<string, string>) {
    super(message);
    this.details = details;
  }
}

function first(value: QueryValue): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseIntParam(
  value: QueryValue,
  key: string,
  options?: { required?: boolean; min?: number; max?: number },
): number | null {
  const raw = first(value);
  if (!raw) {
    if (options?.required) {
      throw new ContextualRankingsQueryError(`Missing required query param: ${key}`, {
        [key]: "required",
      });
    }
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: "must be an integer",
    });
  }
  if (options?.min != null && parsed < options.min) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: `must be >= ${options.min}`,
    });
  }
  if (options?.max != null && parsed > options.max) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: `must be <= ${options.max}`,
    });
  }
  return parsed;
}

function parseEnumParam<T extends readonly string[]>(
  value: QueryValue,
  key: string,
  allowed: T,
  defaultValue: T[number],
): T[number] {
  const raw = first(value);
  const normalized = (raw ?? defaultValue).toLowerCase();
  const match = allowed.find((entry) => entry.toLowerCase() === normalized);
  if (!match) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: `must be one of ${allowed.join(", ")}`,
    });
  }
  return match;
}

function parseOptionalDate(value: QueryValue): string | null {
  const raw = first(value);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ContextualRankingsQueryError("Invalid query param: as_of_date", {
      as_of_date: "must be YYYY-MM-DD",
    });
  }
  return raw;
}

function parseIntListParam(
  value: QueryValue,
  key: string,
  options?: { min?: number; maxItems?: number },
): number[] | null {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const parts = values
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (options?.maxItems != null && parts.length > options.maxItems) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: `must include ${options.maxItems} or fewer ids`,
    });
  }

  const ids = parts.map((part) => Number(part));
  if (
    ids.some(
      (id) =>
        !Number.isInteger(id) || (options?.min != null && id < options.min),
    )
  ) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: "must be a comma-separated list of positive integer ids",
    });
  }
  return Array.from(new Set(ids));
}

function parseMetric(value: QueryValue): ContextualRankingMetricKey {
  const raw = first(value) ?? "goals_per_60";
  const definition = getContextualRankingMetricDefinition(raw);
  if (!definition) {
    throw new ContextualRankingsQueryError("Invalid query param: metric", {
      metric: "unknown metric key",
    });
  }
  return definition.metricKey as ContextualRankingMetricKey;
}

function derivePeerGroupType(args: {
  explicit: string | undefined;
  teamId: number | null;
  deployment: ContextualRankingsDeploymentFilter;
  position: ContextualRankingsPositionFilter;
}): ContextualRankingPeerGroupType {
  if (args.explicit) {
    return parseEnumParam(
      args.explicit,
      "peer_group",
      ["all_skaters", "position", "deployment", "team"] as const,
      "all_skaters",
    );
  }
  if (args.teamId != null) return "team";
  if (args.deployment !== "all") return "deployment";
  if (args.position !== "all") return "position";
  return "all_skaters";
}

export function parseContextualRankingsRequest(
  query: NextApiRequest["query"],
): ContextualRankingsRequest {
  const entity = parseEnumParam(
    query.entity,
    "entity",
    ["skaters"] as const,
    "skaters",
  );
  const season = parseIntParam(query.season, "season", {
    required: true,
    min: 19000000,
    max: 21000000,
  });
  const position = parseEnumParam(
    query.position,
    "position",
    ["all", "F", "D"] as const,
    "all",
  );
  const deployment = parseEnumParam(
    query.deployment,
    "deployment",
    [
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
    ] as const,
    "all",
  );
  const strength = parseEnumParam(
    query.strength,
    "strength",
    ["all", "5v5", "ev", "pp", "pk"] as const,
    "all",
  );
  const metric = parseMetric(query.metric);
  const teamId = parseIntParam(query.team, "team", { min: 1 });
  const limit = parseIntParam(query.limit, "limit", {
    min: 1,
    max: 100,
  });
  const minGp = parseIntParam(query.min_gp, "min_gp", { min: 0 });
  const minToiSeconds = parseIntParam(query.min_toi, "min_toi", { min: 0 });
  const sort = parseEnumParam(
    query.sort,
    "sort",
    ["percentile", "raw_rank", "metric_value", "gp", "toi_per_game"] as const,
    "percentile",
  );

  return {
    entity,
    season: season ?? 0,
    asOfDate: parseOptionalDate(query.as_of_date),
    window: parseEnumParam(
      query.window,
      "window",
      ["season", "last5", "last10", "last20"] as const,
      "season",
    ),
    position,
    deployment,
    strength,
    metric,
    minGp,
    minToiSeconds,
    teamId,
    peerGroupType: derivePeerGroupType({
      explicit: first(query.peer_group),
      teamId,
      deployment,
      position,
    }),
    sort,
    direction: parseEnumParam(
      query.direction,
      "direction",
      ["asc", "desc"] as const,
      sort === "raw_rank" ? "asc" : "desc",
    ),
    limit: limit ?? 100,
    entityIds: parseIntListParam(query.entity_ids, "entity_ids", {
      min: 1,
      maxItems: 25,
    }),
  };
}
