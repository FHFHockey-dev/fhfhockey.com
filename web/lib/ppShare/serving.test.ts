import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PP_CLOCK_MISSING_REASON,
  PP_PLAYER_ABOVE_CLOCK_REASON,
  PP_PLAYER_TIME_MISSING_REASON,
  liveClockVerdict,
  ppClockVerdict,
  ppPlayerShare,
  ppShareServingEnabled,
  readPpTeamGameClocks,
  type PpTeamGameClock
} from "./serving";

const clock = (over: Partial<PpTeamGameClock> = {}): PpTeamGameClock => ({
  gameId: 2026020163, teamId: 12, availability: "available", clockSeconds: 126, unavailableReason: null,
  computedAt: "2026-11-13T21:00:00Z", ...over
});

describe("decision 152 PP share serving rules", () => {
  afterEach(() => {
    delete process.env.PP_SHARE_SERVING_ENABLED;
  });

  it.each([[undefined, false], ["true", true], ["false", false], ["1", false], ["TRUE", false], ["", false]])(
    "PP_SHARE_SERVING_ENABLED=%j serves: %s", (value, expected) => {
      if (value === undefined) delete process.env.PP_SHARE_SERVING_ENABLED;
      else process.env.PP_SHARE_SERVING_ENABLED = value;
      expect(ppShareServingEnabled()).toBe(expected);
    });

  it("only an available clock above 0 is served; a qualified zero is N/A; everything else carries its reason", () => {
    expect(ppClockVerdict(clock())).toEqual({ status: "available", clockSeconds: 126, reason: null });
    expect(ppClockVerdict(clock({ availability: "not_applicable", clockSeconds: 0 })))
      .toEqual({ status: "not_applicable", clockSeconds: 0, reason: null });
    expect(ppClockVerdict(clock({ availability: "unavailable", clockSeconds: 148,
      unavailableReason: "The clock differs from the official team PP total by +28 s." })))
      .toEqual({ status: "unavailable", clockSeconds: null, reason: "The clock differs from the official team PP total by +28 s." });
    expect(ppClockVerdict(null)).toEqual({ status: "unavailable", clockSeconds: null, reason: PP_CLOCK_MISSING_REASON });
    // A malformed row is never served.
    expect(ppClockVerdict(clock({ clockSeconds: 0 })).status).toBe("unavailable");
    expect(ppClockVerdict(clock({ clockSeconds: null })).status).toBe("unavailable");
    expect(ppClockVerdict(clock({ availability: "not_applicable", clockSeconds: 5 })).status).toBe("unavailable");
  });

  it("a player's share is stored PPTOI / clock; a real 0 is 0; missing or impossible values are withheld, never capped", () => {
    const available = ppClockVerdict(clock());
    expect(ppPlayerShare(available, 92)).toMatchObject({ status: "available", share: 92 / 126, playerSeconds: 92 });
    expect(ppPlayerShare(available, 0)).toMatchObject({ status: "available", share: 0 });
    expect(ppPlayerShare(available, 126)).toMatchObject({ status: "available", share: 1 });
    expect(ppPlayerShare(available, 127)).toEqual({ status: "unavailable", playerSeconds: null, clockSeconds: 126,
      share: null, reason: PP_PLAYER_ABOVE_CLOCK_REASON });
    expect(ppPlayerShare(available, null)).toMatchObject({ status: "unavailable", share: null,
      reason: PP_PLAYER_TIME_MISSING_REASON });
    expect(ppPlayerShare(ppClockVerdict(clock({ availability: "not_applicable", clockSeconds: 0 })), null))
      .toEqual({ status: "not_applicable", playerSeconds: 0, clockSeconds: 0, share: null, reason: null });
    expect(ppPlayerShare(ppClockVerdict(null), 50)).toMatchObject({ status: "unavailable", share: null,
      reason: PP_CLOCK_MISSING_REASON });
  });

  it("a live PP computation is shown only when it equals the stored clock", () => {
    const available = ppClockVerdict(clock());
    expect(liveClockVerdict(available, 126)).toBe(available);
    expect(liveClockVerdict(available, 120)).toMatchObject({ status: "unavailable",
      reason: "This view's power-play time (120 s) doesn't match the stored qualified clock (126 s), so it is withheld." });
    const na = ppClockVerdict(clock({ availability: "not_applicable", clockSeconds: 0 }));
    expect(liveClockVerdict(na, 0)).toBe(na);
  });

  it("reads clock rows 100 games per request and surfaces read errors", async () => {
    const calls: number[][] = [];
    const client = {
      from: vi.fn(() => ({
        select: () => ({
          in: async (_col: string, ids: number[]) => {
            calls.push(ids);
            return { data: ids.map((id) => ({ game_id: id, team_id: 1, availability: "available", clock_seconds: 120,
              unavailable_reason: null, computed_at: "t" })), error: null };
          }
        })
      }))
    };
    const ids = Array.from({ length: 150 }, (_, i) => 2026020001 + i);
    const clocks = await readPpTeamGameClocks(client, [...ids, ids[0]]);
    expect(calls.map((c) => c.length)).toEqual([100, 50]);
    expect(clocks).toHaveLength(150);
    expect(clocks[0]).toEqual({ gameId: 2026020001, teamId: 1, availability: "available", clockSeconds: 120,
      unavailableReason: null, computedAt: "t" });
    const failing = { from: () => ({ select: () => ({ in: async () => ({ data: null, error: { message: "boom" } }) }) }) };
    await expect(readPpTeamGameClocks(failing, [1])).rejects.toThrow("Reading pp_team_game_clock failed: boom");
  });
});
