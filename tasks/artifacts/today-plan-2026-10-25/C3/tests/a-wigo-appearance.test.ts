// C3 (a): WiGO "Invalid or duplicate regular-season NHL appearance for player 8476368."
// Offline only: Supabase, season lookup, audit and auth are mocked; rows are fabricated.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, getCurrentSeasonMock } = vi.hoisted(() => ({ fromMock: vi.fn(), getCurrentSeasonMock: vi.fn() }));
vi.mock("lib/supabase/server", () => ({ default: { from: fromMock } }));
vi.mock("lib/NHL/server", () => ({ getCurrentSeason: getCurrentSeasonMock }));
vi.mock("lib/cron/withCronJobAudit", () => ({ withCronJobAudit: (handler: unknown) => handler }));
vi.mock("lib/cron/nhlOffSeason", () => ({ withNhlOffSeasonSkip: (handler: unknown) => handler }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: unknown) => handler }));

import released from "pages/api/v1/db/calculate-wigo-stats";
import patched from "../patched/calculate-wigo-stats";

const REPORTED = 8476368, CLEAN = 8478402;

/** One NHL regular-season appearance with matching NST counts for the same date. */
function appearance(playerId: number, season: number, date: string, serial: number, overrides: Record<string, unknown> = {}) {
  return {
    player_id: playerId, game_id: Math.floor(season / 10000) * 1000000 + 20000 + serial,
    season_id: season, season, date, date_scraped: date, games_played: 1,
    goals: 0, assists: 1, points: 1, total_primary_assists: 1, shots: 2, pp_goals: 0, pp_assists: 0, pp_points: 0,
    pp_toi: 0, pp_toi_pct_per_game: 0, hits: 1, blocked_shots: 1, penalty_minutes: 0,
    toi: 900, ixg: 0.2, icf: 4, hdcf: 1, iscfs: 2, gf: 1, sf: 8, off_zone_starts: 2, def_zone_starts: 2,
    ...overrides,
  };
}

/** A low-appearance skater: 6 games this season and 10 last season, so the last-20 frame reaches 2024-25. */
function lowAppearanceFrame(playerId: number, legacy: Record<string, unknown> | null) {
  const current = Array.from({ length: 6 }, (_, i) => appearance(playerId, 20262027, `2026-10-${String(22 - i * 2).padStart(2, "0")}`, 100 + i));
  const last = Array.from({ length: 10 }, (_, i) => appearance(playerId, 20252026, `2026-03-${String(28 - i * 2).padStart(2, "0")}`, 1000 + i));
  const older = Array.from({ length: 6 }, (_, i) => appearance(playerId, 20242025, `2025-04-${String(15 - i * 2).padStart(2, "0")}`, 1200 + i));
  if (legacy) older[1] = { ...older[1], ...legacy };
  return [...current, ...last, ...older];
}

function installDb(players: number[], gameLogs: Record<string, any>[]) {
  const writes: Record<string, any[]> = {};
  fromMock.mockImplementation((table: string) => {
    const filters: Array<(row: any) => boolean> = [], orders: Array<[string, boolean]> = [];
    let columns = "*", limit = Infinity;
    const source = table === "players" ? players.map(id => ({ id, position: "C" }))
      : table === "wgo_skater_stats" ? gameLogs
      : table === "nst_gamelog_as_counts" || table === "nst_gamelog_as_counts_oi" ? gameLogs
      : [];
    const query: any = {
      select(value: string) { columns = value; return query; },
      eq(key: string, value: unknown) { filters.push(row => row[key] === value); return query; },
      neq(key: string, value: unknown) { filters.push(row => row[key] !== value); return query; },
      in(key: string, values: unknown[]) { filters.push(row => values.includes(row[key])); return query; },
      order(key: string, options: { ascending: boolean }) { orders.push([key, options.ascending]); return query; },
      limit(value: number) { limit = value; return query; },
      range() { return query; },
      upsert(data: any[]) { (writes[table] ??= []).push(...data); return Promise.resolve({ error: null }); },
      then(resolve: (value: unknown) => unknown) {
        let rows = source.filter(row => filters.every(filter => filter(row)));
        rows = [...rows].sort((a, b) => {
          for (const [key, ascending] of orders) {
            const result = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
            if (result) return ascending ? result : -result;
          }
          return 0;
        }).slice(0, limit);
        if (columns !== "*") rows = rows.map(row => Object.fromEntries(columns.split(",").map(key => key.trim()).map(key => [key, row[key]])));
        return Promise.resolve({ data: rows, error: null, count: rows.length }).then(resolve);
      },
    };
    return query;
  });
  return writes;
}

async function run(handler: any) {
  const res: any = { statusCode: 200, body: null, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } };
  await handler({ method: "GET", query: {}, headers: {} }, res);
  return res;
}

const LEGACY = {
  "missing game identity (pre-hardening row)": { game_id: null },
  "season label from the run date (legacy writer)": { season_id: 20262027 },
  "postseason identity in the regular-season table": { game_id: 2024030115 },
  "duplicate game identity on a second date": { game_id: 2024021200 },
} as const;

describe("C3 (a) released calculate-wigo-stats (sha256 f438eb12, identical on origin/master 0619f9126)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentSeasonMock.mockResolvedValue({ seasonId: 20262027, lastSeasonId: 20252026 });
  });

  it.each(Object.entries(LEGACY))("reproduces the email text when the last-20 frame reaches a legacy row: %s", async (_label, legacy) => {
    const writes = installDb([REPORTED], lowAppearanceFrame(REPORTED, legacy));
    const res = await run(released);
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe("Invalid or duplicate regular-season NHL appearance for player 8476368.");
    expect(writes).toEqual({});
  });

  it("control: the same legacy row outside the last-20 frame is never read, so the run succeeds", async () => {
    const extra = Array.from({ length: 6 }, (_, i) => appearance(REPORTED, 20262027, `2026-10-${String(23 - i * 2).padStart(2, "0")}`, 200 + i));
    const writes = installDb([REPORTED], [...extra, ...lowAppearanceFrame(REPORTED, LEGACY["missing game identity (pre-hardening row)"])]);
    const res = await run(released);
    expect(res.statusCode).toBe(200);
    expect(writes.wigo_recent?.map(row => row.player_id)).toEqual([REPORTED]);
  });

  it("control: a clean frame for the same player is accepted", async () => {
    const writes = installDb([REPORTED], lowAppearanceFrame(REPORTED, null));
    expect((await run(released)).statusCode).toBe(200);
    expect(writes.wigo_recent).toHaveLength(1);
  });

  it("blast radius: one rejected player withholds every other player's WiGO rows for the whole run", async () => {
    const writes = installDb([REPORTED, CLEAN], [...lowAppearanceFrame(REPORTED, { game_id: null }), ...lowAppearanceFrame(CLEAN, null)]);
    const res = await run(released);
    expect(res.statusCode).toBe(500);
    expect(writes).toEqual({});
  });
});

describe("C3 (a) PROPOSED patch (unapplied): per-player quarantine keeps the guard and the failure signal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentSeasonMock.mockResolvedValue({ seasonId: 20262027, lastSeasonId: 20252026 });
  });

  it.each(Object.entries(LEGACY))("still refuses to publish the rejected player's frame: %s", async (_label, legacy) => {
    const writes = installDb([REPORTED, CLEAN], [...lowAppearanceFrame(REPORTED, legacy), ...lowAppearanceFrame(CLEAN, null)]);
    const res = await run(patched);
    expect(res.statusCode).toBe(207);
    expect(res.body).toMatchObject({ success: false, rejectedPlayerIds: [REPORTED] });
    expect(res.body.error).toContain("8476368");
    expect(writes.wigo_recent.map(row => row.player_id)).toEqual([CLEAN]);
    expect(writes.wigo_career.map(row => row.player_id)).toEqual([CLEAN]);
  });

  it("control: a clean run is unchanged (200, both players written)", async () => {
    const writes = installDb([REPORTED, CLEAN], [...lowAppearanceFrame(REPORTED, null), ...lowAppearanceFrame(CLEAN, null)]);
    const res = await run(patched);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(writes.wigo_recent.map(row => row.player_id).sort()).toEqual([REPORTED, CLEAN].sort());
  });
});
