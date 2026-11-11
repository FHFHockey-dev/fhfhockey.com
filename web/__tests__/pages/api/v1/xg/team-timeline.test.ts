import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, reads: [] as string[] }));

vi.mock("lib/supabase/server", () => ({
  getServiceRoleClient: () => ({
    from: (table: string) => {
      const filters: Array<[string, unknown]> = [];
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return query;
        },
        order: () => query,
        then: (resolve: (value: unknown) => void) => {
          db.reads.push(table);
          const data = (db.tables[table] ?? []).filter((row) =>
            filters.every(([column, value]) => row[column] === value)
          );
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return query;
    },
  }),
}));

import handler from "pages/api/v1/xg/team-timeline";

function response() {
  const res: any = { statusCode: 0, body: undefined, headers: {} as Record<string, unknown> };
  res.setHeader = (key: string, value: unknown) => { res.headers[key] = value; };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: unknown) => { res.body = body; return res; };
  return res;
}

const registry = (overrides: Row): Row => ({
  model_version: "cfg-champion", feature_version: 1, prediction_type: "shot_goal",
  approval_status: "approved", model_approved: true, is_active: true, is_champion: true, ...overrides,
});
const aggregate = (overrides: Row): Row => ({
  team_id: 10, season_id: 20252026, game_id: 2025020001, game_date: "2026-01-10",
  model_version: "cfg-champion", feature_version: 1, xg_for: 2.9, xg_against: 2.3,
  source_model_approved: true, source_prediction_type: "shot_goal", ...overrides,
});

beforeEach(() => {
  db.reads = [];
  db.tables = {
    nhl_xg_model_registry: [
      registry({}),
      registry({ model_version: "cfg-shadow", feature_version: 2, approval_status: "candidate", model_approved: false, is_active: false, is_champion: false }),
    ],
    nhl_xg_team_game_aggregates: [
      aggregate({ model_version: "cfg-shadow", feature_version: 2, xg_for: 1.1 }),
      aggregate({}),
      aggregate({ feature_version: 2, xg_for: 7 }),
    ],
  };
});

describe("GET /api/v1/xg/team-timeline", () => {
  it("serves only the registry-pinned model and feature version", async () => {
    const res = response();
    await handler({ method: "GET", query: { teamId: "10", seasonId: "20252026" } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.model).toEqual({ modelVersion: "cfg-champion", featureVersion: 1, predictionType: "shot_goal" });
    expect(res.body.rows.map((row: Row) => [row.model_version, row.feature_version, row.xg_for])).toEqual([
      ["cfg-champion", 1, 2.9],
    ]);
  });

  it("returns no rows, without reading aggregates, when the registry pin is ambiguous", async () => {
    db.tables.nhl_xg_model_registry.push(registry({ model_version: "cfg-two" }));
    const res = response();
    await handler({ method: "GET", query: { teamId: "10", seasonId: "20252026" } } as any, res);
    expect(res.body).toEqual({ model: null, reason: "ambiguous_active_models", rows: [] });
    expect(db.reads).toEqual(["nhl_xg_model_registry"]);
  });

  it("rejects a non-integer team or season", async () => {
    const res = response();
    await handler({ method: "GET", query: { teamId: "10;drop", seasonId: "20252026" } } as any, res);
    expect(res.statusCode).toBe(400);
  });
});
