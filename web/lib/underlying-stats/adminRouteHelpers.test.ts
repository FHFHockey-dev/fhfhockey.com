import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { ingestNhlApiRawGamesBestEffortMock, pgQueryMock } = vi.hoisted(() => ({
  ingestNhlApiRawGamesBestEffortMock: vi.fn(),
  pgQueryMock: vi.fn(),
}));

vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(() => ({
    connect: async () => ({ query: pgQueryMock, release: () => undefined }),
  })),
}));

vi.mock("lib/supabase/server", () => ({
  default: {},
}));

vi.mock("lib/supabase/Upserts/nhlRawGamecenter.mjs", () => ({
  ingestNhlApiRawGamesBestEffort: ingestNhlApiRawGamesBestEffortMock,
}));

import {
  fetchFinishedSeasonGameIds,
  runRawIngestAndRefreshBatches,
  selectMissingTeamSummaryGameIds,
} from "./adminRouteHelpers";

// Rule 19 fixtures at 2026-04-03T03:30Z (contract nhl-game-state-v1).
const NOW = new Date("2026-04-03T03:30:00.000Z");
const FINALITY_GAMES = [
  { id: 1, date: "2026-04-01", startTime: "2026-04-01T23:00:00.000Z", game_state: "FINAL",
    game_schedule_state: "OK", game_state_observed_at: "2026-04-02T02:00:00.000Z" },
  // A 10 pm ET start dated Apr 2: before UTC today, still being played.
  { id: 2, date: "2026-04-02", startTime: "2026-04-03T02:00:00.000Z", game_state: "LIVE",
    game_schedule_state: "OK", game_state_observed_at: "2026-04-03T03:20:00.000Z" },
  // Postponed: never final.
  { id: 3, date: "2026-04-01", startTime: "2026-04-01T23:00:00.000Z", game_state: "FUT",
    game_schedule_state: "PPD", game_state_observed_at: "2026-04-01T18:00:00.000Z" },
  // Unknown state: the labelled start + 8 h fallback decides.
  { id: 4, date: "2026-03-31", startTime: "2026-03-31T23:00:00.000Z", game_state: null,
    game_schedule_state: null, game_state_observed_at: null },
];

describe("finished-game selection (rule 19, contract nhl-game-state-v1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("selects by stored state through Supabase: a LIVE late game dated before today is not finished", async () => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      lte: () => builder,
      order: () => builder,
      range: async () => ({ data: FINALITY_GAMES, error: null }),
    };
    const supabase = { from: () => builder };

    const ids = await fetchFinishedSeasonGameIds({ seasonId: 20252026, requestedGameType: 2,
      supabase: supabase as never });

    expect(ids).toEqual([1, 4]);
  });

  it("selects by stored state on the direct-pg team path and applies the limit after finality", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_DB_URL", "postgresql://user:secret@db.example.test:5432/postgres");
    pgQueryMock.mockImplementation(async (sql: string) => ({
      rows: sql.startsWith("SET") ? [] : FINALITY_GAMES,
    }));

    expect(await selectMissingTeamSummaryGameIds({ seasonId: 20252026, requestedGameType: 2, limit: 5 }))
      .toEqual([1, 4]);
    expect(await selectMissingTeamSummaryGameIds({ seasonId: 20252026, requestedGameType: 2, limit: 1 }))
      .toEqual([1]);
    const selectSql = String(pgQueryMock.mock.calls.find(([sql]) => !String(sql).startsWith("SET"))?.[0]);
    expect(selectSql).toContain("game_state");
    expect(selectSql).not.toMatch(/g\.date < \$3/);
  });
});

describe("runRawIngestAndRefreshBatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("excludes exact replays and endpoint observations from raw write telemetry", async () => {
    ingestNhlApiRawGamesBestEffortMock.mockResolvedValue({
      results: [
        {
          gameId: 2025021184,
          rosterCount: 10,
          eventCount: 20,
          shiftCount: 30,
          rawEndpointsStored: 4,
          idempotent: true,
        },
        {
          gameId: 2025021196,
          rosterCount: 40,
          eventCount: 50,
          shiftCount: 60,
          rawEndpointsStored: 4,
          idempotent: false,
        },
      ],
      failures: [],
    });
    const refreshSummaries = vi.fn().mockResolvedValue({ rowsUpserted: 2 });

    const result = await runRawIngestAndRefreshBatches({
      gameIdBatches: [[2025021184, 2025021196]],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldWarmLandingCache: false,
      refreshSummaries,
    });

    expect(result.rawRowsUpserted).toBe(150);
    expect(result.summaryRowsUpserted).toBe(2);
    expect(refreshSummaries).toHaveBeenCalledWith({
      gameIds: [2025021184, 2025021196],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldWarmLandingCache: false,
    });
  });
});
