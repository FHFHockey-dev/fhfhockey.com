import type { RollingPlayerAlignedCountSupport } from "lib/rollingPlayerCountSupport";

export const ROLLING_PLAYER_SUPPORT_PAYLOAD_TABLE =
  "rolling_player_metric_support_payloads" as const;

export const ROLLING_PLAYER_SUPPORT_PAYLOAD_SCHEMA_VERSION = 1 as const;

export type RollingPlayerSupportScalar = string | number | boolean | null;

export type RollingPlayerSupportPayload = {
  alignedCountSupport?: RollingPlayerAlignedCountSupport | null;
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

/**
 * Restores the scalar fields the rolling writer moved from a wide
 * `rolling_player_game_metrics` row into its support payload. Only columns the
 * row already carries are filled, and a non-null wide value always wins.
 */
export function mergeRollingSupportPayloadFields<TRow extends Record<string, unknown>>(
  row: TRow,
  supportPayload: Pick<
    RollingPlayerSupportPayload,
    "historicalCompatibility" | "deprecatedCompatibility"
  > | null | undefined
): TRow {
  const merged: Record<string, unknown> = { ...row };
  for (const fields of [
    supportPayload?.historicalCompatibility,
    supportPayload?.deprecatedCompatibility
  ]) {
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) continue;
    for (const [field, value] of Object.entries(fields)) {
      if (value == null || !(field in merged) || merged[field] != null) continue;
      merged[field] = value;
    }
  }
  return merged as TRow;
}
