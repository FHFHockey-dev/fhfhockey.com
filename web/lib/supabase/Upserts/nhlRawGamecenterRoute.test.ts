import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("lib/NHL/server", () => ({ getCurrentSeason: vi.fn() }));
vi.mock("lib/supabase/server", () => ({ default: {} }));
vi.mock("./nhlRawGamecenter.mjs", () => ({
  ingestNhlApiRawGames: vi.fn(),
  ingestNhlApiRawGamesBestEffort: vi.fn(),
  NORMALIZATION_PARSER_FINGERPRINT: "test-fingerprint",
}));

import { resolveRequestedGameIds } from "./nhlRawGamecenterRoute";

// Rule 19 fixtures at 2026-04-03T03:30Z (contract nhl-game-state-v1).
const GAMES = [
  { id: 2025021001, date: "2026-04-01", startTime: "2026-04-01T23:00:00.000Z", seasonId: 20252026,
    game_state: "OFF", game_schedule_state: "OK", game_state_observed_at: "2026-04-02T02:00:00.000Z" },
  // A 10 pm ET start dated Apr 2: before UTC today, still being played.
  { id: 2025021002, date: "2026-04-02", startTime: "2026-04-03T02:00:00.000Z", seasonId: 20252026,
    game_state: "LIVE", game_schedule_state: "OK", game_state_observed_at: "2026-04-03T03:20:00.000Z" },
  // Dated before today and past start + 8 h, but postponed: never final.
  { id: 2025021003, date: "2026-04-01", startTime: "2026-04-01T23:00:00.000Z", seasonId: 20252026,
    game_state: "FUT", game_schedule_state: "PPD", game_state_observed_at: "2026-04-01T18:00:00.000Z" },
  // Unknown state: the labelled start + 8 h fallback decides.
  { id: 2025021004, date: "2026-03-31", startTime: "2026-03-31T23:00:00.000Z", seasonId: 20252026,
    game_state: null, game_schedule_state: null, game_state_observed_at: null },
];

// No raw coverage and no completed normalization: every finished game is a candidate.
function createSupabase() {
  return {
    from(table: string) {
      const rows = table === "games" ? GAMES : [];
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        gt: () => chain,
        lte: () => chain,
        order: () => chain,
        range: async (from: number) => ({ data: from === 0 ? rows : [], error: null }),
      };
      return chain;
    },
  };
}

describe("resolveRequestedGameIds backfill (rule 19, contract nhl-game-state-v1)", () => {
  afterEach(() => vi.useRealTimers());

  it("selects finished games by stored state: a LIVE late game and a postponed game are not candidates", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-04-03T03:30:00.000Z"));

    const selection = await resolveRequestedGameIds(
      { backfill: "true", seasonId: "20252026", limit: "10" },
      createSupabase() as never,
    );

    expect(selection).toEqual({
      mode: "backfill_batch",
      seasonId: 20252026,
      gameIds: [2025021001, 2025021004],
    });
  });
});
