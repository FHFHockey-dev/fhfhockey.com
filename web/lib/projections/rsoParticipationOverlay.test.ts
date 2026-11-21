// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { loadRsoParticipationSources, RSO_APPEARANCE_LOOKBACK_DAYS, RSO_ROSTER_EVENT_LOOKBACK_DAYS } from "./rsoParticipationOverlay";

vi.mock("./dailyBoardEvidence", () => ({ loadDailyBoardEvidence: vi.fn(async () => ({ assertions: [], conflicts: [] })) }));

// A recording fake: every chained call is kept per query; each query returns an empty, complete page.
function recordingDb() {
  const queries: Array<{ table: string; calls: Array<[string, unknown[]]> }> = [];
  const db = { from: (table: string) => {
    const query = { table, calls: [] as Array<[string, unknown[]]> };
    queries.push(query);
    const chain: any = new Proxy({}, { get: (_, method) => method === "then"
      ? (resolve: (value: unknown) => void) => resolve({ data: [], error: null, count: 0 })
      : (...args: unknown[]) => { query.calls.push([String(method), args]); return chain; } });
    return chain;
  } };
  return { db, queries };
}

describe("RSO participation overlay loader bounds", () => {
  it("reads roster events for planned skaters in batches of 100 within a year and still active; appearances only for the injured", async () => {
    const { db, queries } = recordingDb();
    const readAt = "2026-10-10T12:00:00.000Z";
    const players = Array.from({ length: 150 }, (_, index) => 8_470_000 + index);
    await loadRsoParticipationSources(db as never, { gameIds: [2026020001], playerNhlIds: players,
      appearancePlayerNhlIds: [players[0], players[1], 9_999_999], readAt, deadlineMs: Date.now() + 2000 });
    const events = queries.filter(query => query.table === "forge_roster_events");
    const appearances = queries.filter(query => query.table === "wgo_skater_stats");
    expect(events).toHaveLength(2);
    expect(events.map(query => (query.calls.find(([method]) => method === "in")![1][1] as number[]).length)).toEqual([100, 50]);
    const since = new Date(Date.parse(readAt) - RSO_ROSTER_EVENT_LOOKBACK_DAYS * 86_400_000).toISOString();
    expect(events[0].calls).toContainEqual(["gte", ["effective_from", since]]);
    expect(events[0].calls).toContainEqual(["or", [`effective_to.is.null,effective_to.gte.${readAt}`]]);
    expect(events[0].calls).toContainEqual(["lte", ["created_at", readAt]]);
    // Injured players outside the planned set are not read.
    expect(appearances).toHaveLength(1);
    expect(appearances[0].calls).toContainEqual(["in", ["player_id", [players[0], players[1]]]]);
    expect(appearances[0].calls).toContainEqual(["gte", ["date", new Date(Date.parse(readAt) - RSO_APPEARANCE_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10)]]);
    expect(appearances[0].calls).toContainEqual(["select", ["id,player_id,date,games_played,toi_per_game", { count: "exact" }]]);
  });

  it("refuses an oversized scope instead of reading it", async () => {
    const { db, queries } = recordingDb();
    await expect(loadRsoParticipationSources(db as never, { gameIds: [1], playerNhlIds: Array.from({ length: 2001 }, (_, index) => index + 1),
      appearancePlayerNhlIds: [], readAt: "2026-10-10T12:00:00Z", deadlineMs: Date.now() + 2000 })).rejects.toThrow("Invalid overlay scope");
    expect(queries).toEqual([]);
  });
});
