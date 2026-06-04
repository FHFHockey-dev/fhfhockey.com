import { describe, expect, it } from "vitest";

import { buildPptReplayRows } from "./pptReplayIngestion";
import type { PptReplayEvent } from "./pptReplayCoverage";

const event: PptReplayEvent = {
  seasonId: 20252026,
  gameId: 2025030314,
  gameDate: "2026-05-27",
  gameType: 3,
  gameState: "OFF",
  eventId: 428,
  eventType: "goal",
  sortOrder: 428,
  periodNumber: 2,
  periodType: "REG",
  timeInPeriod: "12:34",
  pptReplayUrl: "https://wsr.nhle.com/sprites/20252026/2025030314/ev428.json",
  highlightClip: "6396802376112",
  highlightClipSharingUrl: "https://nhl.com/video/example",
};

describe("pptReplayIngestion", () => {
  it("builds raw payload and normalized player/puck frame rows", () => {
    const rows = buildPptReplayRows({
      event,
      generatedAt: "2026-05-30T00:00:00.000Z",
      fetchResult: {
        ok: true,
        httpStatus: 200,
        payloadHash: "hash",
        errorMessage: null,
        payload: [
          {
            timeStamp: 17799293080,
            onIce: {
              "8045": {
                id: 8045,
                playerId: 8478851,
                x: 1362.386,
                y: 615.5872,
                sweaterNumber: 45,
                teamId: 8,
                teamAbbrev: "MTL",
              },
              "1": {
                id: 1,
                playerId: "",
                x: 1273.1208,
                y: 641.0665,
                sweaterNumber: "",
                teamId: "",
                teamAbbrev: "",
              },
            },
          },
        ],
      },
    });

    expect(rows.payloadRow).toMatchObject({
      game_id: 2025030314,
      event_id: 428,
      fetch_status: "fetched",
      frame_count: 1,
      entity_frame_count: 2,
      payload_hash: "hash",
    });
    expect(rows.frameRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        tracking_object_id: "8045",
        player_id: 8478851,
        is_puck: false,
        team_id: 8,
        x: 1362.386,
      }),
      expect.objectContaining({
        tracking_object_id: "1",
        player_id: null,
        is_puck: true,
        team_id: null,
        x: 1273.1208,
      }),
    ]));
  });

  it("keeps failed fetches as raw payload status rows with no frames", () => {
    const rows = buildPptReplayRows({
      event,
      fetchResult: {
        ok: false,
        httpStatus: 403,
        payload: null,
        payloadHash: null,
        errorMessage: "HTTP 403 Forbidden",
      },
    });

    expect(rows.payloadRow).toMatchObject({
      fetch_status: "failed",
      http_status: 403,
      payload: null,
      frame_count: 0,
      entity_frame_count: 0,
      error_message: "HTTP 403 Forbidden",
    });
    expect(rows.frameRows).toEqual([]);
  });
});
