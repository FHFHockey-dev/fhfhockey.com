import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Decision 152 acceptance: with PP_SHARE_SERVING_ENABLED unset, the rows the rolling writer would upsert are
 * identical, field for field, to today's writer's rows on the same inputs.
 *
 * The baseline JSON was recorded by running this same harness against the writer before the reader gates
 * (fetchRollingPlayerAverages.ts and rollingPlayerPpShareContract.ts at 05c43f981^, identical to origin/master):
 *   RECORD_PP_PIN_BASELINE=1 npm test -- lib/supabase/Upserts/fetchRollingPlayerAverages.ppServingPin.test.ts
 */
const BASELINE = path.join(__dirname, "__fixtures__", "rolling-pp-share-flag-off-baseline.json");
const PLAYER_ID = 8475158;

// One player's six dressed games for TOR (team 10): PP time in four, stored rows for three of those, and stored
// clock rows covering every outcome (available, not applicable, unavailable, missing).
const GAMES: Array<[date: string, gameId: number, ppToi: number, ppPct: number]> = [
  ["2026-10-09", 2026020020, 112, 0.9333],
  ["2026-10-11", 2026020035, 0, 0],
  ["2026-10-14", 2026020060, 95, 0.6],
  ["2026-10-17", 2026020090, 0, 0],
  ["2026-10-19", 2026020110, 61, 0.4],
  ["2026-10-22", 2026020131, 40, 0.3333]
];
const tables: Record<string, Record<string, unknown>[]> = {
  games: GAMES.map(([date, id]) => ({ id, date, seasonId: 20262027, homeTeamId: 10, awayTeamId: 8 })),
  powerPlayCombinations: [
    { gameId: 2026020020, playerId: PLAYER_ID, PPTOI: 112, unit: 1, pp_share_of_team: 0.933333,
      pp_unit_usage_index: 1.02, pp_unit_relative_toi: 2, pp_vs_unit_avg: 0.02 },
    { gameId: 2026020060, playerId: PLAYER_ID, PPTOI: 95, unit: 1, pp_share_of_team: 0.791667,
      pp_unit_usage_index: 0.98, pp_unit_relative_toi: -2, pp_vs_unit_avg: -0.02 },
    { gameId: 2026020131, playerId: PLAYER_ID, PPTOI: 29, unit: 1, pp_share_of_team: 1,
      pp_unit_usage_index: 1, pp_unit_relative_toi: 0, pp_vs_unit_avg: 0 }
  ],
  pp_team_game_clock: [
    { game_id: 2026020020, team_id: 10, availability: "available", clock_seconds: 120, unavailable_reason: null, computed_at: "t" },
    { game_id: 2026020035, team_id: 10, availability: "not_applicable", clock_seconds: 0, unavailable_reason: null, computed_at: "t" },
    { game_id: 2026020060, team_id: 10, availability: "available", clock_seconds: 120, unavailable_reason: null, computed_at: "t" },
    { game_id: 2026020090, team_id: 10, availability: "available", clock_seconds: 240, unavailable_reason: null, computed_at: "t" },
    { game_id: 2026020110, team_id: 10, availability: "unavailable", clock_seconds: 148,
      unavailable_reason: "The clock differs from the official team PP total by +28 s.", computed_at: "t" }
  ]
};

function client(queried: string[]) {
  return {
    rpc: vi.fn(async () => ({ data: null, error: null })),
    from(table: string) {
      queried.push(table);
      const filters: Record<string, unknown> = {};
      let selected = "";
      let rangeFrom = 0;
      const query: Record<string, unknown> = {};
      for (const method of ["neq", "gt", "gte", "lt", "lte", "is", "not", "or", "order", "limit", "delete"]) {
        query[method] = () => query;
      }
      query.select = (fields: string) => { selected = fields; return query; };
      query.eq = (field: string, value: unknown) => { filters[field] = value; return query; };
      query.in = (field: string, values: unknown[]) => { filters[field] = values; return query; };
      query.range = (from: number) => { rangeFrom = from; return query; };
      const rows = () => {
        if (rangeFrom > 0) return [];
        if (table === "players") return (filters.id as number[]).map((id) => ({ id }));
        if (table === "wgo_skater_stats") {
          if (selected === "player_id") return [{ player_id: PLAYER_ID }];
          return GAMES.map(([date, game_id, pp_toi, pp_toi_pct_per_game]) => ({
            player_id: PLAYER_ID, game_id, date, season_id: 20262027, team_abbrev: "TOR", goals: 0, assists: 1,
            shots: 2, points: 1, toi_per_game: 1080, es_toi_per_game: 900, pp_toi, pp_toi_pct_per_game
          }));
        }
        return tables[table] ?? [];
      };
      query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: rows(), error: null }).then(resolve, reject);
      return query;
    }
  };
}

async function upsertRows(): Promise<{ rows: Record<string, unknown>[]; queried: string[] }> {
  for (const method of ["info", "warn", "debug", "error", "time", "timeEnd", "log"] as const) {
    vi.spyOn(console, method).mockImplementation(() => undefined);
  }
  const queried: string[] = [];
  vi.resetModules();
  vi.doMock("@supabase/supabase-js", () => ({ createClient: () => client(queried) }));
  try {
    const { main } = await import("./fetchRollingPlayerAverages");
    const rows: Record<string, unknown>[] = [];
    await main({
      playerId: PLAYER_ID,
      dryRunUpsert: true,
      skipDiagnostics: true,
      dryRunBatchObserver: (batch) => rows.push(...batch.rankingRows, ...batch.supportRows)
    });
    return { rows: JSON.parse(JSON.stringify(rows)), queried };
  } finally {
    vi.doUnmock("@supabase/supabase-js");
  }
}

describe("decision 152: the rolling writer's stored output with PP share serving off", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.PP_SHARE_SERVING_ENABLED;
  });

  it("flag unset: the upsert rows equal today's writer's rows, field for field, and no clock row is read", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    delete process.env.PP_SHARE_SERVING_ENABLED;
    const { rows, queried } = await upsertRows();
    expect(rows.length).toBeGreaterThan(0);
    if (process.env.RECORD_PP_PIN_BASELINE === "1") {
      writeFileSync(BASELINE, "[\n" + rows.map((row) => JSON.stringify(row)).join(",\n") + "\n]\n");
      return;
    }
    expect(queried).not.toContain("pp_team_game_clock");
    expect(rows).toEqual(JSON.parse(readFileSync(BASELINE, "utf8")));
  });

  it("flag on: only PP share fields differ from today's rows", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    if (process.env.RECORD_PP_PIN_BASELINE === "1") return;
    process.env.PP_SHARE_SERVING_ENABLED = "true";
    const { rows, queried } = await upsertRows();
    const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as Record<string, unknown>[];
    expect(queried).toContain("pp_team_game_clock");
    expect(rows).toHaveLength(baseline.length);
    // Every changed leaf, nested support payloads included, must be a pp_share_pct field.
    const changedPaths = new Set<string>();
    const diff = (a: unknown, b: unknown, at: string) => {
      if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
        const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
        for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) diff(x[key], y[key], at ? `${at}.${key}` : key);
      } else if (JSON.stringify(a) !== JSON.stringify(b)) {
        changedPaths.add(at);
      }
    };
    rows.forEach((row, i) => diff(row, baseline[i], ""));
    expect(changedPaths.size).toBeGreaterThan(0);
    expect([...changedPaths].filter((leaf) => !leaf.split(".").at(-1)!.startsWith("pp_share_pct"))).toEqual([]);
  });
});
