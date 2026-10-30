// C3 (b): update-player-underlying-stats?gameId=2026020179&warmLandingCache=true
// "Player underlying stats ingest failed for every requested game." with
// NHL_NORMALIZATION_WRITER_BUSY for 2026020179 and 2026020171.
// Offline only: raw ingest, summary refreshers, season lookup and Supabase are mocked; games are fabricated.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveRequestedGameIds: vi.fn(),
  ingestBestEffort: vi.fn(),
  refreshPlayerSummaries: vi.fn(),
  refreshTeamSummaries: vi.fn(),
  getCurrentSeason: vi.fn(),
  summaryGameIds: vi.fn(),
  gamesRows: [] as Array<Record<string, unknown>>,
}));

vi.mock("lib/cron/withCronJobAudit", () => ({ withCronJobAudit: (handler: unknown) => handler }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: unknown) => handler }));
vi.mock("lib/supabase/Upserts/nhlRawGamecenterRoute", () => ({ resolveRequestedGameIds: mocks.resolveRequestedGameIds }));
vi.mock("lib/cron/nhlOffSeason", () => ({ withNhlOffSeasonSkip: (handler: unknown) => handler }));
vi.mock("lib/supabase/Upserts/nhlRawGamecenter.mjs", () => ({ ingestNhlApiRawGamesBestEffort: mocks.ingestBestEffort }));
vi.mock("lib/underlying-stats/playerStatsSummaryRefresh", async (importOriginal) => ({
  ...await importOriginal<typeof import("lib/underlying-stats/playerStatsSummaryRefresh")>(),
  refreshPlayerUnderlyingSummarySnapshotsForGameIds: mocks.refreshPlayerSummaries,
  fetchSeasonSummaryGameIdSet: mocks.summaryGameIds,
}));
vi.mock("lib/underlying-stats/teamStatsSummaryRefresh", () => ({ refreshTeamUnderlyingSummaryRowsForGameIds: mocks.refreshTeamSummaries }));
vi.mock("lib/NHL/server", () => ({ getCurrentSeason: mocks.getCurrentSeason }));
vi.mock("lib/supabase/pagination", () => ({
  fetchAllSupabasePages: async (factory: (page: { from: number; to: number }) => PromiseLike<{ data: unknown[] }>) =>
    (await factory({ from: 0, to: 999 })).data,
}));
vi.mock("lib/supabase/server", () => {
  const query: any = {
    select: () => query, eq: () => query, lte: () => query, order: () => query, range: () => query,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: mocks.gamesRows, error: null }).then(resolve),
  };
  return { default: { from: () => query } };
});

import handler from "pages/api/v1/db/update-player-underlying-stats";
import { resolvePlayerStatsIncrementalSelection as released } from "lib/underlying-stats/playerStatsRefreshWindow";
import { resolvePlayerStatsIncrementalSelection as patched } from "../patched/playerStatsRefreshWindow";

const busy = (gameId: number) => ({
  gameId, message: "NHL_NORMALIZATION_WRITER_BUSY", code: "P0001", stage: "capture_raw_sources", endpoint: "play-by-play", attempts: 2,
});

async function call(query: Record<string, string>) {
  const res: any = { statusCode: 200, body: null, setHeader: vi.fn(), status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } };
  await handler({ method: "POST", query, headers: {} } as any, res);
  return res;
}

describe("C3 (b) route behaviour for the trigger-fanned single-game request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refreshPlayerSummaries.mockResolvedValue({ rowsUpserted: 10, summaryWriteBusyRetries: 0 });
    mocks.refreshTeamSummaries.mockResolvedValue({ rowsUpserted: 2 });
  });

  it.each([2026020179, 2026020171])("reproduces the email: busy raw capture for %i fails the request and commits no summaries", async (gameId) => {
    mocks.resolveRequestedGameIds.mockResolvedValue({ mode: "game", seasonId: 20262027, gameIds: [gameId] });
    mocks.ingestBestEffort.mockResolvedValue({ results: [], failures: [busy(gameId)] });
    const res = await call({ gameId: String(gameId), warmLandingCache: "true" });
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toBe("Player underlying stats ingest failed for every requested game.");
    expect(res.body.issues).toEqual([`${gameId}: NHL_NORMALIZATION_WRITER_BUSY`]);
    expect(mocks.refreshPlayerSummaries).not.toHaveBeenCalled();
    expect(mocks.refreshTeamSummaries).not.toHaveBeenCalled();
  });

  it("control: once the competing writer has finished, the same URL succeeds", async () => {
    mocks.resolveRequestedGameIds.mockResolvedValue({ mode: "game", seasonId: 20262027, gameIds: [2026020179] });
    mocks.ingestBestEffort.mockResolvedValue({ results: [{ gameId: 2026020179, rosterCount: 40, eventCount: 300, shiftCount: 800, rawEndpointsStored: 4, idempotent: false }], failures: [] });
    const res = await call({ gameId: "2026020179", warmLandingCache: "true" });
    expect(res.statusCode).toBe(200);
    expect(mocks.refreshPlayerSummaries).toHaveBeenCalledWith(expect.objectContaining({ gameIds: [2026020179], shouldWarmLandingCache: true }));
  });
});

/** Oct 24 slate (171–179) and Oct 25 slate (180–185); dates and start times are fabricated. */
function slate(date: string, ids: number[]) {
  return ids.map(id => ({ id, date, startTime: `${date}T23:00:00Z`, seasonId: 20262027, type: 2 }));
}
const OCT24 = slate("2026-10-24", [171, 172, 173, 174, 175, 176, 177, 178, 179].map(n => 2026020000 + n));
const OCT25 = slate("2026-10-25", [180, 181, 182, 183, 184, 185].map(n => 2026020000 + n));
const HOLES = [2026020171, 2026020179];

describe("C3 (b) recovery path: incremental selection after the busy failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mocks.getCurrentSeason.mockResolvedValue({ seasonId: 20262027 });
  });
  afterEach(() => vi.useRealTimers());

  it("same day (before the next slate is covered): the released watermark still reselects both holes", async () => {
    vi.setSystemTime(new Date("2026-10-25T16:00:00Z"));
    mocks.gamesRows = [...OCT24].reverse();
    mocks.summaryGameIds.mockResolvedValue(new Set(OCT24.map(g => g.id).filter(id => !HOLES.includes(id))));
    const selection = await released({});
    expect(selection.latestCoveredDate).toBe("2026-10-24");
    expect(selection.gameIds).toEqual(expect.arrayContaining(HOLES));
  });

  it("DEFECT: once any later game is summarised, the released watermark skips the earlier holes permanently", async () => {
    vi.setSystemTime(new Date("2026-10-26T16:00:00Z"));
    mocks.gamesRows = [...OCT24, ...OCT25].reverse();
    mocks.summaryGameIds.mockResolvedValue(new Set([...OCT24, ...OCT25].map(g => g.id).filter(id => !HOLES.includes(id))));
    const selection = await released({});
    expect(selection.latestCoveredDate).toBe("2026-10-25");
    expect(selection.gameIds).toEqual(OCT25.map(g => g.id));
    for (const hole of HOLES) expect(selection.gameIds).not.toContain(hole);
  });

  it("PROPOSED patch (unapplied): reselects only the recent uncovered games, not the covered ones in between", async () => {
    vi.setSystemTime(new Date("2026-10-26T16:00:00Z"));
    mocks.gamesRows = [...OCT24, ...OCT25].reverse();
    mocks.summaryGameIds.mockResolvedValue(new Set([...OCT24, ...OCT25].map(g => g.id).filter(id => !HOLES.includes(id))));
    const selection = await patched({});
    expect(selection.latestCoveredDate).toBe("2026-10-25");
    expect(selection.gameIds).toEqual([...HOLES, ...OCT25.map(g => g.id)]);
  });

  it("PROPOSED patch bound: a hole older than 7 days is not retried forever", async () => {
    vi.setSystemTime(new Date("2026-11-03T16:00:00Z"));
    const NOV2 = slate("2026-11-02", [2026020250]);
    mocks.gamesRows = [...OCT24, ...OCT25, ...NOV2].reverse();
    mocks.summaryGameIds.mockResolvedValue(new Set([...OCT24, ...OCT25, ...NOV2].map(g => g.id).filter(id => !HOLES.includes(id))));
    const selection = await patched({});
    expect(selection.gameIds).toEqual([2026020250]);
  });

  it("control: with no holes the patch selects exactly what the released code selects", async () => {
    vi.setSystemTime(new Date("2026-10-26T16:00:00Z"));
    mocks.gamesRows = [...OCT24, ...OCT25].reverse();
    mocks.summaryGameIds.mockResolvedValue(new Set([...OCT24, ...OCT25].map(g => g.id)));
    expect((await patched({})).gameIds).toEqual((await released({})).gameIds);
  });
});

describe("C3 (b) source evidence: why two different games contend", () => {
  const repo = "/Users/tim/Code/fhfhockey.com";
  const read = async (path: string) => (await import("node:fs")).readFileSync(`${repo}/${path}`, "utf8");

  it("the direct-writer serializer takes one global try-lock (no game id in the key) and fails fast", async () => {
    const sql = await read("supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql");
    const serializer = sql.slice(sql.indexOf("function public.serialize_nhl_api_game_normalization_writes"), sql.indexOf("function public.lock_nhl_api_game_normalization_scope_write"));
    expect(serializer).toContain("pg_try_advisory_xact_lock(");
    expect(serializer).toContain("hashtextextended('fhfh:normalization-direct-writer', 0)");
    expect(serializer).toContain("message = 'NHL_NORMALIZATION_WRITER_BUSY'");
    expect(serializer).not.toMatch(/game_id|p_game/);
  });

  it("each home-team lineCombinations insert fans out an async per-game POST to this exact URL", async () => {
    const sql = await read("supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql");
    expect(sql).toContain("'https://fhfhockey.com/api/v1/db/update-player-underlying-stats?gameId='");
    expect(sql).toContain("'&warmLandingCache=true'");
    expect(sql).toMatch(/after insert on public\."lineCombinations"\s+for each row execute function public\.on_new_player_underlying_stats\(\)/);
  });

  it("the pipeline's own projection-input ingest writes the same normalized tables in the same window", async () => {
    const route = await read("web/pages/api/v1/db/ingest-projection-inputs.ts");
    expect(route).toContain("persistCapturedGameNormalization");
    const pipeline = await read("web/lib/rollingForgePipeline.ts");
    expect(pipeline.indexOf("/api/v1/db/update-line-combinations")).toBeLessThan(pipeline.indexOf("/api/v1/db/ingest-projection-inputs"));
  });

  it("raw capture retries a busy rejection at most once (min(retries, 2) - 1) after <= 500 ms", async () => {
    const mjs = await read("web/lib/supabase/Upserts/nhlRawGamecenter.mjs");
    expect(mjs).toContain("const budget = { remaining: Math.min(retries, 2) - 1, used: 0,");
    expect(mjs).toContain("delayMs: Math.min(delayMs, DEFAULT_RETRY_DELAY_MS) };");
    expect(mjs).toContain("export const DEFAULT_RETRY_DELAY_MS = 500;");
  });
});
