import type { NextApiRequest } from "next";

import {
  getContextualRankingMetricDefinition,
  type ContextualRankingMetricKey,
} from "./metricDefinitions";
import { buildContextualRankingsSurface } from "./rankingQueries";
import {
  ContextualRankingsQueryError,
  parseContextualRankingsRequest,
  type ContextualRankingApiRow,
  type ContextualRankingsDeploymentFilter,
  type ContextualRankingsRequest,
  type ContextualRankingsResponse,
} from "./rankingTypes";
import type { ContextualRankingPeerGroupType } from "./rankingCalculator";
import type {
  SkaterProductionWindow,
  SkaterWindowStrengthState,
} from "./skaterWindowAggregation";

const SPLIT_STRENGTHS = ["all", "5v5", "ev", "pp", "pk"] as const;
const SPLIT_WINDOWS = ["season", "last20", "last10", "last5"] as const;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

export type RankingsSplitDimension = "strength" | "window" | "deployment";

export type RankingsSplitValue = {
  value: number | null;
  formattedValue: string | null;
  percentile: number | null;
  rank: number | null;
  qualifiedPeerCount: number;
};

export type RankingsSplitComparison = {
  key: string;
  label: string;
  context: {
    strength: SkaterWindowStrengthState;
    window: SkaterProductionWindow;
    deployment: ContextualRankingsDeploymentFilter;
  };
  sourceState: "available" | "unavailable";
  snapshotDate: string | null;
  rowCount: number;
  message: string | null;
};

export type RankingsSplitSection = {
  key: RankingsSplitDimension;
  label: string;
  description: string;
  comparisons: RankingsSplitComparison[];
  sourceState: "available" | "partial" | "unavailable";
};

export type RankingsSplitRow = {
  entity: ContextualRankingApiRow["entity"];
  team: ContextualRankingApiRow["team"];
  deployment: ContextualRankingApiRow["deployment"];
  sample: ContextualRankingApiRow["sample"];
  base: RankingsSplitValue;
  splits: Record<string, RankingsSplitValue | null>;
};

export type RankingsSplitsRequest = Pick<
  ContextualRankingsRequest,
  | "entity"
  | "season"
  | "asOfDate"
  | "window"
  | "position"
  | "deployment"
  | "strength"
  | "metric"
  | "minGp"
  | "minToiSeconds"
  | "teamId"
  | "peerGroupType"
> & {
  limit: number;
};

export type RankingsSplitsResponse = {
  success: boolean;
  request: RankingsSplitsRequest;
  rows: RankingsSplitRow[];
  sections: RankingsSplitSection[];
  meta: {
    generatedAt: string;
    rowCount: number;
    sourceTable: "rolling_player_game_metrics";
    metric: {
      key: ContextualRankingMetricKey;
      displayName: string;
    };
    baseSnapshotDate: string | null;
    latestAvailableSnapshotDate: string | null;
    unsupportedSplits: Array<{
      key: string;
      reason: string;
    }>;
    message: string | null;
  };
};

type QueryValue = string | string[] | undefined;

function first(value: QueryValue) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parsePositiveInt(value: QueryValue, key: string, fallback: number) {
  const raw = first(value);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: "must be a positive integer",
    });
  }
  return Math.min(parsed, MAX_LIMIT);
}

function derivePeerGroupType(args: {
  teamId: number | null;
  deployment: ContextualRankingsDeploymentFilter;
  position: ContextualRankingsRequest["position"];
}): ContextualRankingPeerGroupType {
  if (args.teamId != null) return "team";
  if (args.deployment !== "all") return "deployment";
  if (args.position !== "all") return "position";
  return "all_skaters";
}

function splitValue(row: ContextualRankingApiRow | null): RankingsSplitValue | null {
  if (!row) return null;
  return {
    value: row.metric.value,
    formattedValue: row.metric.formattedValue,
    percentile: row.metric.percentile,
    rank: row.metric.rawRank,
    qualifiedPeerCount: row.metric.qualifiedPeerCount,
  };
}

function buildRequest(
  base: RankingsSplitsRequest,
  overrides: Partial<
    Pick<ContextualRankingsRequest, "strength" | "window" | "deployment">
  >,
  entityIds: number[],
): ContextualRankingsRequest {
  const deployment = overrides.deployment ?? base.deployment;
  return {
    entity: "skaters",
    season: base.season,
    asOfDate: base.asOfDate,
    window: overrides.window ?? base.window,
    position: base.position,
    deployment,
    strength: overrides.strength ?? base.strength,
    metric: base.metric,
    minGp: base.minGp,
    minToiSeconds: base.minToiSeconds,
    teamId: base.teamId,
    peerGroupType: derivePeerGroupType({
      teamId: base.teamId,
      deployment,
      position: base.position,
    }),
    sort: "percentile",
    direction: "desc",
    limit: null,
    entityIds,
  };
}

function deploymentComparisons(
  request: RankingsSplitsRequest,
): ContextualRankingsDeploymentFilter[] {
  if (request.strength === "pp") return ["all", "PP1", "PP2", "PP3"];
  if (request.strength === "pk") return ["all", "PK1", "PK2"];
  if (request.position === "F") return ["all", "L1", "L2", "L3", "L4"];
  if (request.position === "D") return ["all", "P1", "P2", "P3"];
  return ["all", "L1", "L2", "L3", "L4", "P1", "P2", "P3"];
}

function comparisonKey(section: RankingsSplitDimension, key: string) {
  return `${section}:${key}`;
}

function sectionState(comparisons: RankingsSplitComparison[]) {
  const available = comparisons.filter(
    (comparison) => comparison.sourceState === "available",
  ).length;
  if (available === comparisons.length && available > 0) return "available" as const;
  if (available > 0) return "partial" as const;
  return "unavailable" as const;
}

async function loadComparison(args: {
  base: RankingsSplitsRequest;
  section: RankingsSplitDimension;
  key: string;
  label: string;
  entityIds: number[];
  overrides: Partial<
    Pick<ContextualRankingsRequest, "strength" | "window" | "deployment">
  >;
}) {
  const request = buildRequest(args.base, args.overrides, args.entityIds);
  const response = await buildContextualRankingsSurface(request);
  return {
    comparison: {
      key: comparisonKey(args.section, args.key),
      label: args.label,
      context: {
        strength: request.strength,
        window: request.window,
        deployment: request.deployment,
      },
      sourceState:
        response.meta.unavailable || response.rankings.length === 0
          ? "unavailable"
          : "available",
      snapshotDate: response.meta.snapshotDate,
      rowCount: response.rankings.length,
      message: response.meta.message,
    } satisfies RankingsSplitComparison,
    response,
  };
}

export function parseRankingsSplitsRequest(
  query: NextApiRequest["query"],
): RankingsSplitsRequest {
  const base = parseContextualRankingsRequest({
    ...query,
    sort: "percentile",
    direction: "desc",
    limit: String(parsePositiveInt(query.limit, "limit", DEFAULT_LIMIT)),
  });
  return {
    entity: base.entity,
    season: base.season,
    asOfDate: base.asOfDate,
    window: base.window,
    position: base.position,
    deployment: base.deployment,
    strength: base.strength,
    metric: base.metric,
    minGp: base.minGp,
    minToiSeconds: base.minToiSeconds,
    teamId: base.teamId,
    peerGroupType: base.peerGroupType,
    limit: base.limit ?? DEFAULT_LIMIT,
  };
}

export async function buildRankingsSplitsSurface(
  request: RankingsSplitsRequest,
): Promise<RankingsSplitsResponse> {
  const generatedAt = new Date().toISOString();
  const definition = getContextualRankingMetricDefinition(request.metric);
  const baseSurface = await buildContextualRankingsSurface({
    entity: "skaters",
    season: request.season,
    asOfDate: request.asOfDate,
    window: request.window,
    position: request.position,
    deployment: request.deployment,
    strength: request.strength,
    metric: request.metric,
    minGp: request.minGp,
    minToiSeconds: request.minToiSeconds,
    teamId: request.teamId,
    peerGroupType: request.peerGroupType,
    sort: "percentile",
    direction: "desc",
    limit: request.limit,
    entityIds: null,
  });
  const anchorRows = baseSurface.rankings;
  const entityIds = anchorRows.map((row) => row.entity.id);

  if (entityIds.length === 0) {
    return {
      success: true,
      request,
      rows: [],
      sections: [],
      meta: {
        generatedAt,
        rowCount: 0,
        sourceTable: "rolling_player_game_metrics",
        metric: {
          key: request.metric,
          displayName: definition?.displayName ?? request.metric,
        },
        baseSnapshotDate: baseSurface.meta.snapshotDate,
        latestAvailableSnapshotDate: baseSurface.meta.latestAvailableSnapshotDate,
        unsupportedSplits: [
          {
            key: "home_away",
            reason:
              "Home/away is not exposed by the verified rolling rankings surface.",
          },
        ],
        message: baseSurface.meta.message ?? "No base ranking rows matched these filters.",
      },
    };
  }

  const comparisonInputs = [
    ...SPLIT_STRENGTHS.map((strength) => ({
      section: "strength" as const,
      key: strength,
      label: strength.toUpperCase(),
      overrides: {
        strength,
        deployment: "all" as ContextualRankingsDeploymentFilter,
      },
    })),
    ...SPLIT_WINDOWS.map((window) => ({
      section: "window" as const,
      key: window,
      label: window === "season" ? "Season" : window.replace("last", "Last "),
      overrides: { window },
    })),
    ...deploymentComparisons(request).map((deployment) => ({
      section: "deployment" as const,
      key: deployment,
      label: deployment === "all" ? "All" : deployment,
      overrides: { deployment },
    })),
  ];

  const loadedComparisons = await Promise.all(
    comparisonInputs.map((input) =>
      loadComparison({
        base: request,
        section: input.section,
        key: input.key,
        label: input.label,
        entityIds,
        overrides: input.overrides,
      }),
    ),
  );
  const responseByComparisonKey = new Map(
    loadedComparisons.map((entry) => [entry.comparison.key, entry.response]),
  );
  const baseSections: RankingsSplitSection[] = [
    {
      key: "strength",
      label: "Strength Splits",
      description: "Selected players compared across verified all, 5v5, EV, PP, and PK contexts.",
      comparisons: loadedComparisons
        .filter((entry) => entry.comparison.key.startsWith("strength:"))
        .map((entry) => entry.comparison),
      sourceState: "unavailable",
    },
    {
      key: "window",
      label: "Window Splits",
      description: "Selected players compared across season, last 20, last 10, and last 5 rolling windows.",
      comparisons: loadedComparisons
        .filter((entry) => entry.comparison.key.startsWith("window:"))
        .map((entry) => entry.comparison),
      sourceState: "unavailable",
    },
    {
      key: "deployment",
      label: "Deployment Splits",
      description: "Selected players compared across verified deployment buckets for the active position and strength.",
      comparisons: loadedComparisons
        .filter((entry) => entry.comparison.key.startsWith("deployment:"))
        .map((entry) => entry.comparison),
      sourceState: "unavailable",
    },
  ];
  const sections: RankingsSplitSection[] = baseSections.map((section) => ({
    ...section,
    sourceState: sectionState(section.comparisons),
  }));

  const rows = anchorRows.map((row) => {
    const splits: Record<string, RankingsSplitValue | null> = {};
    for (const comparison of loadedComparisons) {
      const response = responseByComparisonKey.get(comparison.comparison.key);
      const splitRow =
        response?.rankings.find((entry) => entry.entity.id === row.entity.id) ??
        null;
      splits[comparison.comparison.key] = splitValue(splitRow);
    }

    return {
      entity: row.entity,
      team: row.team,
      deployment: row.deployment,
      sample: row.sample,
      base: splitValue(row) ?? {
        value: null,
        formattedValue: null,
        percentile: null,
        rank: null,
        qualifiedPeerCount: 0,
      },
      splits,
    };
  });

  return {
    success: true,
    request,
    rows,
    sections,
    meta: {
      generatedAt,
      rowCount: rows.length,
      sourceTable: "rolling_player_game_metrics",
      metric: {
        key: request.metric,
        displayName: definition?.displayName ?? request.metric,
      },
      baseSnapshotDate: baseSurface.meta.snapshotDate,
      latestAvailableSnapshotDate: baseSurface.meta.latestAvailableSnapshotDate,
      unsupportedSplits: [
        {
          key: "home_away",
          reason:
            "Home/away is not exposed by the verified rolling rankings surface.",
        },
      ],
      message: rows.length === 0 ? "No split rows matched the current filters." : null,
    },
  };
}
