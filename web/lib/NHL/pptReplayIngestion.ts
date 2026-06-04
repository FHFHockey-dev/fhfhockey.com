import crypto from "crypto";

import type { PptReplayEvent } from "./pptReplayCoverage";

export type PptReplayFetchResult = {
  ok: boolean;
  httpStatus: number | null;
  payload: unknown;
  payloadHash: string | null;
  errorMessage: string | null;
};

export type PptReplayPayloadRow = {
  game_id: number;
  event_id: number;
  season_id: number | null;
  game_date: string | null;
  game_type: number | null;
  game_state: string | null;
  event_type: string | null;
  ppt_replay_url: string;
  fetch_status: "fetched" | "failed" | "skipped";
  http_status: number | null;
  payload_hash: string | null;
  payload: unknown | null;
  frame_count: number;
  entity_frame_count: number;
  error_message: string | null;
  provenance: Record<string, unknown>;
  fetched_at: string;
  updated_at: string;
};

export type PptReplayFrameRow = {
  game_id: number;
  event_id: number;
  frame_index: number;
  frame_timestamp: number | null;
  tracking_object_id: string;
  player_id: number | null;
  is_puck: boolean;
  team_id: number | null;
  team_abbrev: string | null;
  sweater_number: number | null;
  x: number | null;
  y: number | null;
  ppt_replay_url: string;
  provenance: Record<string, unknown>;
  updated_at: string;
};

type ReplayFrame = {
  timeStamp?: number | string | null;
  onIce?: Record<string, ReplayTrackingObject> | null;
};

type ReplayTrackingObject = {
  id?: number | string | null;
  playerId?: number | string | null;
  x?: number | string | null;
  y?: number | string | null;
  sweaterNumber?: number | string | null;
  teamId?: number | string | null;
  teamAbbrev?: string | null;
};

const DEFAULT_TIMEOUT_MS = 20_000;

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value: unknown): number | null {
  const parsed = toNumber(value);
  return parsed == null ? null : Math.trunc(parsed);
}

function toStringOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function hashPayload(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function fetchPptReplayJson(
  url: string,
  options: { timeoutMs?: number } = {}
): Promise<PptReplayFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        referer: "https://www.nhl.com/",
        "user-agent": "Chrome/130.0.0.0",
      },
    });
    if (!response.ok) {
      return {
        ok: false,
        httpStatus: response.status,
        payload: null,
        payloadHash: null,
        errorMessage: `HTTP ${response.status} ${response.statusText}`,
      };
    }

    const payload = await response.json();
    return {
      ok: true,
      httpStatus: response.status,
      payload,
      payloadHash: hashPayload(payload),
      errorMessage: null,
    };
  } catch (error) {
    return {
      ok: false,
      httpStatus: null,
      payload: null,
      payloadHash: null,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

export function buildPptReplayRows(args: {
  event: PptReplayEvent;
  fetchResult: PptReplayFetchResult;
  generatedAt?: string;
}): { payloadRow: PptReplayPayloadRow; frameRows: PptReplayFrameRow[] } {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const frames = Array.isArray(args.fetchResult.payload)
    ? (args.fetchResult.payload as ReplayFrame[])
    : [];
  const frameRows = frames.flatMap<PptReplayFrameRow>((frame, frameIndex) => {
    const onIce = frame?.onIce ?? {};
    return Object.entries(onIce).flatMap<PptReplayFrameRow>(([objectKey, object]) => {
      const trackingObjectId = toStringOrNull(object.id) ?? objectKey;
      const playerId = toInteger(object.playerId);
      const teamId = toInteger(object.teamId);
      const sweaterNumber = toInteger(object.sweaterNumber);
      const isPuck = playerId == null && teamId == null;

      return [
        {
          game_id: args.event.gameId,
          event_id: args.event.eventId,
          frame_index: frameIndex,
          frame_timestamp: toInteger(frame.timeStamp),
          tracking_object_id: trackingObjectId,
          player_id: playerId,
          is_puck: isPuck,
          team_id: teamId,
          team_abbrev: toStringOrNull(object.teamAbbrev),
          sweater_number: sweaterNumber,
          x: toNumber(object.x),
          y: toNumber(object.y),
          ppt_replay_url: args.event.pptReplayUrl,
          provenance: {
            source: "nhl_ppt_replay_payloads_raw",
            discoverySource: "nhl_gamecenter_play_by_play_pptReplayUrl",
            eventType: args.event.eventType,
          },
          updated_at: generatedAt,
        },
      ];
    });
  });

  return {
    payloadRow: {
      game_id: args.event.gameId,
      event_id: args.event.eventId,
      season_id: args.event.seasonId,
      game_date: args.event.gameDate,
      game_type: args.event.gameType,
      game_state: args.event.gameState,
      event_type: args.event.eventType,
      ppt_replay_url: args.event.pptReplayUrl,
      fetch_status: args.fetchResult.ok ? "fetched" : "failed",
      http_status: args.fetchResult.httpStatus,
      payload_hash: args.fetchResult.payloadHash,
      payload: args.fetchResult.ok ? args.fetchResult.payload : null,
      frame_count: frames.length,
      entity_frame_count: frameRows.length,
      error_message: args.fetchResult.errorMessage,
      provenance: {
        source: "nhl_gamecenter_play_by_play_pptReplayUrl",
        note: "Only fetched after NHL PBP exposed this exact replay URL.",
      },
      fetched_at: generatedAt,
      updated_at: generatedAt,
    },
    frameRows,
  };
}
