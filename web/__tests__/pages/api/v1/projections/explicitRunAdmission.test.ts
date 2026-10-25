import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  from: vi.fn(), latest: vi.fn(), run: null as any, runError: null as any,
  rows: [{ fixture: "native-projection" }] as any[], rowError: null as any,
  operations: [] as Array<[string, string, unknown[]]>,
}));
vi.mock("lib/supabase/server", () => ({ default: { from: db.from } }));
vi.mock("lib/projections/apiHelpers", async importOriginal => ({
  ...await importOriginal<typeof import("lib/projections/apiHelpers")>(),
  requireLatestSucceededRunId: db.latest,
}));

import players from "../../../../../pages/api/v1/projections/players";
import goalies from "../../../../../pages/api/v1/projections/goalies";
import teams from "../../../../../pages/api/v1/projections/teams";
import { buildForgeInputProvenance } from "lib/projections/calibrationEligibility";

const runId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const date = "2026-10-13";
function response() {
  const res: any = { statusCode: 200, headers: {}, body: null };
  res.setHeader = (key: string, value: unknown) => { res.headers[key] = value; };
  res.status = (status: number) => { res.statusCode = status; return res; };
  res.json = (body: unknown) => { res.body = body; return res; };
  return res;
}

describe.each([
  { name: "players", handler: players, table: "forge_player_projections", idFilter: "playerId", column: "player_id" },
  { name: "goalies", handler: goalies, table: "forge_goalie_projections", idFilter: "goalieId", column: "goalie_id" },
  { name: "teams", handler: teams, table: "forge_team_projections", idFilter: "teamId", column: "team_id" },
])("explicit run admission: $name", ({ name, handler, table, idFilter, column }) => {
  beforeEach(() => {
    db.from.mockReset(); db.latest.mockReset(); db.latest.mockResolvedValue("latest-run");
    db.run = { metrics: { input_provenance: buildForgeInputProvenance({ externalFantasyInputsExcluded: true }) } };
    db.runError = null; db.rowError = null; db.rows = [{ fixture: "native-projection" }]; db.operations = [];
    db.from.mockImplementation((source: string) => {
      if (source !== "forge_runs" && source !== table) throw new Error(`Unexpected offline read: ${source}`);
      const query: any = {
        maybeSingle: async () => ({ data: db.run, error: db.runError }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: db.rows, error: db.rowError }).then(resolve),
      };
      for (const method of ["select", "eq"]) query[method] = (...args: unknown[]) => {
        db.operations.push([source, method, args]); return query;
      };
      return query;
    });
  });

  it("validates the requested identity before serving unchanged rows and filters", async () => {
    const res = response();
    await handler({ method: "GET", query: { date, runId, horizon: "5", [idFilter]: "7" } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ runId, asOfDate: date, horizonGames: 5, data: db.rows });
    expect(db.from.mock.calls).toEqual([["forge_runs"], [table]]);
    expect(db.operations.slice(0, 2)).toEqual([["forge_runs", "select", ["metrics"]], ["forge_runs", "eq", ["run_id", runId]]]);
    expect(db.operations).toEqual(expect.arrayContaining([[table, "eq", ["run_id", runId]],
      [table, "eq", ["as_of_date", date]], [table, "eq", ["horizon_games", 5]], [table, "eq", [column, 7]]]));
    expect(db.latest).not.toHaveBeenCalled();
    if (name !== "teams") expect(res.headers.Deprecation).toBe("true");
  });

  it.each([undefined, null, true, [], {}, "comparison_reference", "blended_v0"])(
    "rejects unsupported provenance before projection reads or fallback: %j",
    async contract => {
      db.run.metrics.input_provenance.external_fantasy_input_contract = contract;
      const res = response();
      await handler({ method: "GET", query: { date, runId } } as any, res);
      expect(res.statusCode).toBe(422);
      expect(res.body.error).toBe("Selected projection run lacks external fantasy exclusion provenance.");
      expect(db.from.mock.calls).toEqual([["forge_runs"]]);
      expect(db.latest).not.toHaveBeenCalled();
    },
  );

  it("distinguishes a missing run from missing projection rows", async () => {
    db.run = null;
    const absent = response();
    await handler({ method: "GET", query: { date, runId } } as any, absent);
    expect(absent.statusCode).toBe(404);
    expect(db.from.mock.calls).toEqual([["forge_runs"]]);
    expect(db.latest).not.toHaveBeenCalled();
    db.run = { metrics: { input_provenance: buildForgeInputProvenance({ externalFantasyInputsExcluded: true }) } }; db.rows = [];
    const empty = response();
    await handler({ method: "GET", query: { date, runId } } as any, empty);
    expect(empty.statusCode).toBe(200);
    expect(empty.body.data).toEqual([]);
  });

  it.each(["run", "rows"] as const)("preserves sanitized database errors from %s reads", async stage => {
    const error = Object.assign(new Error("private database detail"), { statusCode: 503 });
    if (stage === "run") db.runError = error; else db.rowError = error;
    const res = response();
    await handler({ method: "GET", query: { date, runId } } as any, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toBe(`PROJECTION_${name.toUpperCase()}_UNAVAILABLE`);
    expect(db.latest).not.toHaveBeenCalled();
    if (stage === "run") expect(db.from.mock.calls).toEqual([["forge_runs"]]);
  });

  it("keeps default latest-run resolution on the existing admitted helper", async () => {
    const res = response();
    await handler({ method: "GET", query: { date } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.runId).toBe("latest-run");
    expect(db.latest).toHaveBeenCalledWith(date);
    expect(db.from.mock.calls).toEqual([[table]]);
  });
});
