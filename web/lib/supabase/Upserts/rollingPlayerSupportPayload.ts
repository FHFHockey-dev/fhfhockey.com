export const ROLLING_PLAYER_SUPPORT_PAYLOAD_TABLE =
  "rolling_player_metric_support_payloads" as const;

export const ROLLING_PLAYER_SUPPORT_PAYLOAD_SCHEMA_VERSION = 1 as const;

export type RollingPlayerSupportScalar = string | number | boolean | null;

export type RollingPlayerSupportPayload = {
  recomputeSupport?: Record<string, RollingPlayerSupportScalar>;
  historicalCompatibility?: Record<string, RollingPlayerSupportScalar>;
  deprecatedCompatibility?: Record<string, RollingPlayerSupportScalar>;
  diagnostics?: {
    compactedFromWideRow?: boolean;
    prunedFieldCount?: number;
    source?: string;
    warnings?: string[];
  };
};

export type RollingPlayerMetricSupportPayloadRow = {
  player_id: number;
  game_date: string;
  strength_state: string;
  season: number;
  team_id: number | null;
  game_id: number | null;
  payload_schema_version: typeof ROLLING_PLAYER_SUPPORT_PAYLOAD_SCHEMA_VERSION;
  support_payload: RollingPlayerSupportPayload;
  updated_at?: string;
};
