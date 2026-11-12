/**
 * L16 served readers, end to end: `/api/v1/homepage/pulse` through its route
 * handler, and the slate analytics through `enrichHomepageGames`, which both
 * `/api/v1/games` and the homepage's server render call unchanged.
 * (`pages/api/v1/games/index.js` is plain JS; Vitest's tsconfig-paths plugin
 * does not resolve its `lib/` imports, so the handler itself is not loaded.)
 */
import { afterEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, reads: [] as string[] }));

function fakeClient() {
  return {
    from(table: string) {
      db.reads.push(table);
      const filters: Array<(row: Row) => boolean> = [];
      const query: any = {
        select: () => query,
        eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), query),
        in: (column: string, values: unknown[]) => (filters.push((row) => values.includes(row[column])), query),
        gte: () => query,
        lte: () => query,
        not: () => query,
        or: () => query,
        order: () => query,
        limit: () => query,
        then: (resolve: (value: unknown) => void, reject?: (error: unknown) => void) =>
          Promise.resolve({
            data: (db.tables[table] ?? []).filter((row) => filters.every((filter) => filter(row))),
            error: null,
          }).then(resolve, reject),
      };
      return query;
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  };
}

vi.mock("lib/supabase/server", () => ({ default: fakeClient(), getServiceRoleClient: () => fakeClient() }));

import { enrichHomepageGames } from "lib/homepageGameAnalytics";
import pulseHandler from "pages/api/v1/homepage/pulse";

function response() {
  const res: any = { statusCode: 200, headers: {} as Record<string, string> };
  res.status = (code: number) => ((res.statusCode = code), res);
  res.json = (body: unknown) => ((res.body = body), res);
  res.setHeader = (name: string, value: string) => ((res.headers[name] = value), res);
  return res;
}

afterEach(() => {
  db.tables = {};
  db.reads = [];
});

describe("slate analytics served to /api/v1/games and the homepage render", () => {
  it("serves no partial SOG pair and no xG without an active approved model", async () => {
    db.tables = {
      nhl_xg_model_registry: [],
      nhl_xg_team_game_aggregates: [
        { game_id: 2026020001, team_id: 3, xg_for: 1.8, model_version: "cfg9bac2706", feature_version: 1, source_model_approved: true, source_prediction_type: "shot_goal", updated_at: "2026-10-10T23:00:00.000Z" },
        { game_id: 2026020001, team_id: 6, xg_for: 2.4, model_version: "cfg9bac2706", feature_version: 1, source_model_approved: true, source_prediction_type: "shot_goal", updated_at: "2026-10-10T23:00:00.000Z" },
      ],
      forge_team_game_strength: [
        { game_id: 2026020001, team_id: 3, shots_es: 20, shots_pp: null, shots_pk: 1, updated_at: "2026-10-10T23:01:00.000Z" },
        { game_id: 2026020001, team_id: 6, shots_es: 20, shots_pp: 4, shots_pk: 0, updated_at: "2026-10-10T23:01:00.000Z" },
      ],
    };

    const [game] = (await enrichHomepageGames({
      supabase: fakeClient() as any,
      date: "2026-10-10",
      games: [
        {
          id: 2026020001,
          startTimeUTC: "2026-10-10T20:00:00.000Z",
          awayTeam: { id: 3 },
          homeTeam: { id: 6 },
        },
      ],
    })) as Array<{ analytics?: Record<string, unknown> }>;

    const analytics = game!.analytics ?? {};
    expect(analytics.awayShotsOnGoal).toBeUndefined();
    expect(analytics.homeShotsOnGoal).toBeUndefined();
    expect(analytics.awayXg).toBeUndefined();
    expect(analytics.homeXg).toBeUndefined();
  });
});

describe("/api/v1/homepage/pulse", () => {
  it("serves no points and reads no prediction history without a production game model", async () => {
    db.tables = {
      game_prediction_model_versions: [{ model_name: "m", model_version: "v", feature_set_version: "f", status: "candidate" }],
      game_prediction_history: [
        { game_id: 1, snapshot_date: "2026-06-17", computed_at: "2026-06-17T12:00:00.000Z", home_win_probability: 0.6, metadata: {}, components: {}, model_name: "m", model_version: "v", feature_set_version: "f", is_public: true, prediction_scope: "pregame" },
        { game_id: 1, snapshot_date: "2026-06-17", computed_at: "2026-06-17T12:30:00.000Z", home_win_probability: 0.7, metadata: {}, components: {}, model_name: "m", model_version: "v", feature_set_version: "f", is_public: true, prediction_scope: "pregame" },
      ],
    };

    const res = response();
    await pulseHandler({ method: "GET" } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ points: [] });
    expect(db.reads).not.toContain("game_prediction_history");
  });
});
