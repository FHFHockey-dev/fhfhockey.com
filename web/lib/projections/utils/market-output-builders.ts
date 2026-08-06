import type { MarketTypeSummary } from "../queries/market-queries";

export const ANALYTICS_MODEL_NAME = "forge";
export const ANALYTICS_MODEL_VERSION = "market-context-v1";

export const PLAYER_MARKET_EDGE_THRESHOLDS: Record<string, number> = {
  player_shots_on_goal: 0.5,
  player_goals: 0.2,
  player_assists: 0.25,
  player_points: 0.35,
  player_power_play_points: 0.15,
  player_blocked_shots: 0.4,
  player_total_saves: 1.5,
};

export const GAME_MARKET_EDGE_THRESHOLDS = {
  totals: 0.4,
  spreads: 0.5,
} as const;

export function getProjectionValueForPropMarket(args: {
  marketType: string;
  projection: {
    shots: number;
    goals: number;
    assists: number;
    powerPlayPoints: number;
    blockedShots: number;
    saves: number | null;
  };
}): number | null {
  switch (args.marketType) {
    case "player_shots_on_goal":
      return args.projection.shots;
    case "player_goals":
    case "player_goal_scorer_anytime":
      return args.projection.goals;
    case "player_assists":
      return args.projection.assists;
    case "player_points":
      return Number(
        (args.projection.goals + args.projection.assists).toFixed(3),
      );
    case "player_power_play_points":
      return args.projection.powerPlayPoints;
    case "player_blocked_shots":
      return args.projection.blockedShots;
    case "player_total_saves":
      return args.projection.saves;
    default:
      return null;
  }
}

export function getConsensusLineValue(
  summary: MarketTypeSummary | undefined,
): number | null {
  if (!summary) return null;
  const candidate = summary.outcomes.find(
    (outcome) => outcome.averageLineValue != null,
  );
  return candidate?.averageLineValue ?? null;
}

function buildFlagConfidence(edgeValue: number, threshold: number): number {
  if (
    !Number.isFinite(edgeValue) ||
    !Number.isFinite(threshold) ||
    threshold <= 0
  ) {
    return 0;
  }
  return Number(
    Math.min(100, Math.max(0, (Math.abs(edgeValue) / threshold) * 50)).toFixed(
      2,
    ),
  );
}

export function buildModelMarketFlagRow(args: {
  asOfDate: string;
  entityType: "game" | "player" | "team";
  entityId: number;
  gameId: number;
  marketType: string;
  flagType: string;
  edgeValue: number;
  reasons: Array<Record<string, unknown>>;
  provider: string | null;
  metadata?: Record<string, unknown>;
}): Record<string, unknown> {
  const threshold =
    args.entityType === "game"
      ? ((GAME_MARKET_EDGE_THRESHOLDS as Record<string, number>)[
          args.marketType
        ] ?? 0.25)
      : (PLAYER_MARKET_EDGE_THRESHOLDS[args.marketType] ?? 0.25);
  const now = new Date().toISOString();

  return {
    snapshot_date: args.asOfDate,
    entity_type: args.entityType,
    entity_id: args.entityId,
    game_id: args.gameId,
    model_name: ANALYTICS_MODEL_NAME,
    model_version: ANALYTICS_MODEL_VERSION,
    market_type: args.marketType,
    sportsbook_key: null,
    flag_type: args.flagType,
    edge_value: Number(args.edgeValue.toFixed(4)),
    confidence_0_to_100: buildFlagConfidence(args.edgeValue, threshold),
    reasons: args.reasons,
    provenance: {
      provider: args.provider,
      input_family: "forge-market-comparison",
    },
    metadata: args.metadata ?? {},
    computed_at: now,
    updated_at: now,
  };
}
