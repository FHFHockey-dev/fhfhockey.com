import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ROLLING_WINDOW_COUNT_SUPPORT_VERSION } from "lib/rollingPlayerWindowCountSupport";
import type { Database } from "lib/supabase/database-generated.types";
import type { RollingPlayerGameMetricRow } from "./skaterWindowAggregation";

interface RankingPublicationSource {
  playerId: number;
  gameId: number;
  gameDate: string;
  updatedAt: string;
  supportUpdatedAt: string;
}

export interface RankingPublicationReady {
  status: "ready";
  cutoffDate: string;
  readyAt: string;
  sourceDigest: string;
  expectedPlayerIds: readonly number[];
  expectedRollingSources: readonly RankingPublicationSource[];
}

export type RankingPublicationReadiness =
  | RankingPublicationReady
  | { status: "no_slate"; cutoffDate: string }
  | { status: "blocked"; reason: string; details: string[] };

type ReadinessRpcClient = {
  rpc(
    name: "read_rankings_publication_readiness",
    params: { p_season: number; p_last_served: string; p_cutoff: string },
  ): PromiseLike<{ data: unknown; error: unknown }>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isoDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
}

// Preserve PostgreSQL's six-digit precision while normalizing equivalent
// timestamptz representations from the RPC and the PostgREST row reader.
function timestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parts = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts) return null;
  const seconds = Date.parse(parts[1] + parts[3]);
  if (!Number.isFinite(seconds)) return null;
  return `${new Date(seconds).toISOString().slice(0, 19)}.${(parts[2] ?? "").padEnd(6, "0")}Z`;
}

function positiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function blocked(reason: string, details: string[] = []): RankingPublicationReadiness {
  return { status: "blocked", reason, details };
}

export async function readRankingPublicationReadiness(args: {
  client: SupabaseClient<Database>;
  season: number;
  lastServedDate: string;
  cutoffDate: string;
}): Promise<RankingPublicationReadiness> {
  const { client, season, lastServedDate, cutoffDate } = args;
  if (!Number.isSafeInteger(season) || !isoDay(lastServedDate) || !isoDay(cutoffDate) ||
      cutoffDate <= lastServedDate) return blocked("invalid_scope");

  // This new RPC is unavailable until the migration is applied. A missing
  // function or incompatible return value keeps the previous pair serving.
  const { data, error } = await (client as unknown as ReadinessRpcClient).rpc(
    "read_rankings_publication_readiness",
    { p_season: season, p_last_served: lastServedDate, p_cutoff: cutoffDate },
  );
  if (error) return blocked("readiness_read_failed");
  if (!isObject(data)) return blocked("invalid_readiness_receipt");
  if (data.status === "blocked" && typeof data.reason === "string") {
    return blocked(data.reason, Array.isArray(data.details)
      ? data.details.filter((detail): detail is string => typeof detail === "string")
      : []);
  }
  if (data.status === "no_slate" && data.cutoffDate === cutoffDate) {
    return { status: "no_slate", cutoffDate };
  }
  const readyAt = timestamp(data.readyAt);
  if (data.status !== "ready" || data.cutoffDate !== cutoffDate || readyAt == null ||
      !isObject(data.evidence) || !Array.isArray(data.expectedRollingSources) ||
      data.expectedRollingSources.length < 1 || data.expectedRollingSources.length > 1000) {
    return blocked("invalid_readiness_receipt");
  }

  const expectedRollingSources: RankingPublicationSource[] = [];
  for (const source of data.expectedRollingSources) {
    if (!isObject(source) || !positiveId(source.playerId) || !positiveId(source.gameId) ||
        !isoDay(source.gameDate) || source.gameDate > cutoffDate) {
      return blocked("invalid_readiness_receipt");
    }
    const updatedAt = timestamp(source.updatedAt);
    const supportUpdatedAt = timestamp(source.supportUpdatedAt);
    if (updatedAt == null || supportUpdatedAt == null ||
        updatedAt > readyAt || supportUpdatedAt > readyAt) return blocked("invalid_readiness_receipt");
    expectedRollingSources.push({
      playerId: source.playerId, gameId: source.gameId, gameDate: source.gameDate,
      updatedAt, supportUpdatedAt,
    });
  }
  expectedRollingSources.sort((a, b) => a.playerId - b.playerId);
  const expectedPlayerIds = expectedRollingSources.map((source) => source.playerId);
  if (new Set(expectedPlayerIds).size !== expectedPlayerIds.length ||
      !expectedRollingSources.some((source) => source.gameDate === cutoffDate)) {
    return blocked("invalid_readiness_receipt");
  }
  const sourceDigest = createHash("sha256").update(JSON.stringify({
    season, lastServedDate, cutoffDate, expectedRollingSources, evidence: data.evidence,
  })).digest("hex");
  return { status: "ready", cutoffDate, readyAt, sourceDigest, expectedPlayerIds, expectedRollingSources };
}

export function validateRankingPublicationBuildSources(
  readiness: RankingPublicationReady,
  rows: readonly (RollingPlayerGameMetricRow & { windowCountSupportUpdatedAt?: string | null })[],
): void {
  const actual = new Map(rows.map((row) => [row.player_id, row]));
  if (actual.size !== rows.length || actual.size !== readiness.expectedRollingSources.length) {
    throw new Error("The loaded rolling cohort does not match the source readiness receipt.");
  }
  for (const source of readiness.expectedRollingSources) {
    const row = actual.get(source.playerId);
    if (!row || row.game_id !== source.gameId || row.game_date !== source.gameDate ||
        timestamp(row.updated_at) !== timestamp(source.updatedAt) ||
        timestamp(row.windowCountSupportUpdatedAt) !== timestamp(source.supportUpdatedAt) ||
        row.windowCountSupport?.version !== ROLLING_WINDOW_COUNT_SUPPORT_VERSION) {
      throw new Error(`The loaded rolling source for player ${source.playerId} changed after readiness was verified.`);
    }
  }
}
