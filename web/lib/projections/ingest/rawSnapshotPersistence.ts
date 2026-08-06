import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";

import type { PbpResponse } from "./pbp";
import type { NhleShiftChartsRawPayload } from "./shifts";

const SHA256_HEX = /^[a-f0-9]{64}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_COMBINED_RAW_SNAPSHOT_BYTES = 16_000_000;

type RpcResult = { data: unknown; error: unknown };

type ProjectionRawSnapshotClient = {
  rpc(
    functionName: "capture_projection_raw_source_snapshots_v1",
    args: Record<string, unknown>,
  ): PromiseLike<RpcResult>;
};

export type ProjectionRawSnapshotIdentity = {
  rawPayloadId: number;
  snapshotVersion: number;
  payloadHash: string;
};

export type ProjectionRawSourceSnapshotReceipt = {
  gameId: number;
  pbp: ProjectionRawSnapshotIdentity;
  shifts: ProjectionRawSnapshotIdentity;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (isRecord(error) && typeof error.message === "string") {
    return new Error(error.message);
  }
  return new Error(fallback);
}

/**
 * Match the existing immutable Gamecenter writer's byte identity. This is
 * deliberately not the canonical normalized-row hash used by projection
 * materialization: raw payload and normalized content are separate evidence.
 */
export function hashProjectionRawJson(payload: unknown): string {
  const serialized = JSON.stringify(payload);
  if (serialized === undefined) {
    throw new Error("Projection raw snapshot is not JSON serializable");
  }
  return createHash("sha256").update(serialized).digest("hex");
}

function parseIdentity(args: {
  rawPayloadId: unknown;
  snapshotVersion: unknown;
  payloadHash: unknown;
  expectedHash: string;
  label: string;
}): ProjectionRawSnapshotIdentity {
  if (
    !Number.isSafeInteger(args.rawPayloadId) ||
    (args.rawPayloadId as number) <= 0 ||
    !Number.isSafeInteger(args.snapshotVersion) ||
    (args.snapshotVersion as number) <= 0 ||
    typeof args.payloadHash !== "string" ||
    !SHA256_HEX.test(args.payloadHash) ||
    args.payloadHash !== args.expectedHash
  ) {
    throw new Error(
      `Projection raw snapshot RPC returned an invalid ${args.label} identity`,
    );
  }
  return {
    rawPayloadId: args.rawPayloadId as number,
    snapshotVersion: args.snapshotVersion as number,
    payloadHash: args.payloadHash,
  };
}

export async function captureProjectionRawSourceSnapshots(args: {
  supabase: SupabaseClient<Database>;
  gameId: number;
  pbp: PbpResponse;
  shiftPayload: NhleShiftChartsRawPayload;
}): Promise<ProjectionRawSourceSnapshotReceipt> {
  if (
    !Number.isSafeInteger(args.gameId) ||
    args.gameId <= 0 ||
    args.pbp.id !== args.gameId
  ) {
    throw new Error("Projection raw snapshot has an invalid game identity");
  }
  const seasonId = Number(args.pbp.season);
  if (
    !Number.isSafeInteger(seasonId) ||
    seasonId <= 0 ||
    !DATE_ONLY.test(args.pbp.gameDate)
  ) {
    throw new Error("Projection raw snapshot has an invalid game scope");
  }
  if (
    args.shiftPayload.source !== "json-api" ||
    !Array.isArray(args.shiftPayload.data) ||
    args.shiftPayload.data.length === 0 ||
    args.shiftPayload.data.length > 20_000 ||
    args.shiftPayload.total !== args.shiftPayload.data.length ||
    args.shiftPayload.data.some((row) => row.gameId !== args.gameId)
  ) {
    throw new Error("Projection raw shift snapshot is incomplete");
  }

  const pbpSerialized = JSON.stringify(args.pbp);
  const shiftSerialized = JSON.stringify(args.shiftPayload);
  if (
    pbpSerialized === undefined ||
    shiftSerialized === undefined ||
    Buffer.byteLength(pbpSerialized, "utf8") +
      Buffer.byteLength(shiftSerialized, "utf8") >
      MAX_COMBINED_RAW_SNAPSHOT_BYTES
  ) {
    throw new Error(
      "Projection raw snapshot payload exceeds the bounded scope",
    );
  }

  const pbpPayloadHash = hashProjectionRawJson(args.pbp);
  const shiftPayloadHash = hashProjectionRawJson(args.shiftPayload);
  const pbpSourceUrl = `https://api-web.nhle.com/v1/gamecenter/${args.gameId}/play-by-play`;
  const shiftSourceUrl =
    "https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=" +
    args.gameId;
  const client = args.supabase as unknown as ProjectionRawSnapshotClient;

  let result: RpcResult;
  try {
    result = await client.rpc("capture_projection_raw_source_snapshots_v1", {
      p_game_date: args.pbp.gameDate,
      p_game_id: args.gameId,
      p_pbp_payload: args.pbp,
      p_pbp_payload_hash: pbpPayloadHash,
      p_pbp_source_url: pbpSourceUrl,
      p_season_id: seasonId,
      p_shift_payload: args.shiftPayload,
      p_shift_payload_hash: shiftPayloadHash,
      p_shift_source_url: shiftSourceUrl,
    });
  } catch (error) {
    throw toError(error, "Projection raw snapshot RPC failed");
  }
  if (result.error) {
    throw toError(result.error, "Projection raw snapshot RPC failed");
  }
  if (
    !Array.isArray(result.data) ||
    result.data.length !== 1 ||
    !isRecord(result.data[0]) ||
    result.data[0].game_id !== args.gameId
  ) {
    throw new Error(
      "Projection raw snapshot RPC did not return exactly one receipt",
    );
  }
  const receipt = result.data[0];
  return {
    gameId: args.gameId,
    pbp: parseIdentity({
      rawPayloadId: receipt.pbp_raw_payload_id,
      snapshotVersion: receipt.pbp_raw_snapshot_version,
      payloadHash: receipt.pbp_raw_payload_hash,
      expectedHash: pbpPayloadHash,
      label: "PBP",
    }),
    shifts: parseIdentity({
      rawPayloadId: receipt.shift_raw_payload_id,
      snapshotVersion: receipt.shift_raw_snapshot_version,
      payloadHash: receipt.shift_raw_payload_hash,
      expectedHash: shiftPayloadHash,
      label: "shift",
    }),
  };
}
