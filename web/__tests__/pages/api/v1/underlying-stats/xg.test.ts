import { beforeEach, describe, expect, it, vi } from "vitest";

// Served-route proof for W3-1 D7: the xG Lab reads only the registry-pinned
// model (L14) and serves null when no approved model is active (decision 99).
const state = vi.hoisted(() => ({
  selection: { model: null as null | { modelVersion: string; featureVersion: number }, reason: "no_active_model" },
  filters: [] as Array<[string, string, unknown]>,
  tables: {} as Record<string, Array<Record<string, unknown>>>,
}));

vi.mock("lib/xg/modelRegistry", () => ({
  fetchActiveXgModel: vi.fn(async () => state.selection),
}));

vi.mock("lib/supabase/server", () => {
  const from = (table: string) => {
    let rows = [...(state.tables[table] ?? [])];
    const builder: any = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        state.filters.push([table, column, value]);
        rows = rows.filter((row) => row[column] === value);
        return builder;
      },
      in: (column: string, values: unknown[]) => ((rows = rows.filter((row) => values.includes(row[column]))), builder),
      order: () => builder,
      range: (start: number, end: number) => Promise.resolve({ data: rows.slice(start, end + 1), error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    return builder;
  };
  return { default: { from } };
});

import handler from "../../../../../pages/api/v1/underlying-stats/xg";

async function serve(query: Record<string, string>) {
  const res: any = {
    body: null,
    statusCode: 200,
    setHeader: vi.fn(),
    status: vi.fn((code: number) => ((res.statusCode = code), res)),
    json: vi.fn((payload: unknown) => ((res.body = payload), res)),
  };
  await handler({ method: "GET", query } as never, res);
  return res;
}

const coreRow = (modelVersion: string, featureVersion: number, ixg: number) => ({
  player_id: 10,
  team_id: 1,
  season_id: 20252026,
  window_games: 10,
  model_version: modelVersion,
  feature_version: featureVersion,
  as_of_game_date: "2026-02-10",
  as_of_game_id: 50,
  games_count: 10,
  ixg,
  goals: 5,
  shot_attempts: 41,
});

beforeEach(() => {
  state.filters = [];
  state.tables = {
    nhl_xg_player_rolling_aggregates: [
      coreRow("approved-v2", 2, 4),
      // A newer row from an unapproved model must never be served.
      { ...coreRow("leaky-latest", 1, 99), as_of_game_date: "2026-03-01", as_of_game_id: 90 },
    ],
    nhl_xg_player_created_xg_rolling_aggregates: [],
    players: [{ id: 10, fullName: "Shot Creator", team_id: 1, position: "C" }],
    teams: [{ id: 1, abbreviation: "BOS", name: "Boston Bruins" }],
  };
});

describe("GET /api/v1/underlying-stats/xg", () => {
  it("serves in-house xG as unavailable when no approved model is active", async () => {
    state.selection = { model: null, reason: "no_active_model" };
    const res = await serve({ scope: "players", seasonId: "20252026", modelVersion: "leaky-latest" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ modelVersion: null, featureVersion: null, rows: [] });
    expect(res.body.notes.join(" ")).toContain("In-house xG unavailable");
  });

  it("reads only the registry-pinned model and feature version; missing created xG is null", async () => {
    state.selection = { model: { modelVersion: "approved-v2", featureVersion: 2 }, reason: "unique_active_champion" };
    const res = await serve({ scope: "players", seasonId: "20252026", modelVersion: "leaky-latest" });
    expect(res.body).toMatchObject({ modelVersion: "approved-v2", featureVersion: 2 });
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0]).toMatchObject({ ixg: 4, createdXg: null, transitionCreatedXg: null });
    expect(res.body.coverage).toMatchObject({ status: "warning", servedRows: 1, alignedRows: 0 });
    expect(state.filters).toContainEqual(["nhl_xg_player_rolling_aggregates", "model_version", "approved-v2"]);
    expect(state.filters).toContainEqual(["nhl_xg_player_rolling_aggregates", "feature_version", 2]);
  });
});
