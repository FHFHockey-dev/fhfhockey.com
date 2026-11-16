import { describe, expect, it } from "vitest";

import { readForgeServingHealth } from "./forgeServingHealth.server";

const LISTED = "9b1821fff8b64983f5e28c572a054cdc7d49f2a320b8e2e18dec514e4ad4c219";
const UNLISTED = "f".repeat(64);
const runRow = (runId: string, createdAt: string, closure: string) => ({ run_id: runId, status: "succeeded",
  git_sha: "a5816ce6d1eeeba4b7213d1f66c96025f0b5818e", created_at: createdAt, invocations: "1",
  producer_identity: { version: "forge-producer-closure-v1", invocations: [closure], code_versions: [null] },
  rolling_player_history_contract: null, execution_mode: "full_slate", scope_key: "h1:full" });
const stageRows = ["core_entity_freshness", "upstream_skater_sources", "contextual_builders", "rolling_player_recompute",
  "projection_input_ingest", "projection_relationship_build", "projection_derived_build", "projection_execution"]
  .map(operation_key => ({ operation_key, status: "complete", cursor_game_id: null, last_error: null, lease_owner: null,
    lease_expires_at: null, updated_at: "2026-11-13T10:40:00Z" }));

type Call = { table: string; ops: Array<[string, ...unknown[]]> };
/** A Supabase stand-in: every chain is thenable and resolves from `tables` (or `fail`). Records each read. */
function fakeClient(tables: Record<string, unknown[]>, fail: Record<string, string> = {}) {
  const calls: Call[] = [];
  const client = { from(table: string) {
    const call: Call = { table, ops: [] };
    calls.push(call);
    const chain: any = new Proxy({}, { get(_target, op: string) {
      if (op === "then") {
        const result = fail[table] ? { data: null, error: { message: fail[table] } } : { data: tables[table] ?? [], error: null };
        return (resolve: (value: unknown) => void) => resolve(result);
      }
      return (...args: unknown[]) => { call.ops.push([op, ...args]); return chain; };
    } });
    return chain;
  } };
  return { client: client as any, calls };
}
const read = (client: any, now = "2026-11-13T13:01:20Z") => readForgeServingHealth({ client, now: new Date(now),
  seasonState: "in_season", deadlineAt: Date.now() + 5_000 });

describe("readForgeServingHealth", () => {
  it("makes two bounded reads when today's run is served", async () => {
    const { client, calls } = fakeClient({ forge_runs: [runRow("today", "2026-11-13T10:20:00Z", LISTED)],
      projection_pipeline_state: stageRows });
    const health = await read(client);
    expect(health).toMatchObject({ status: "ok", date: "2026-11-13" });
    expect(calls.map(call => call.table)).toEqual(["forge_runs", "projection_pipeline_state"]);
    const [runs, pipeline] = calls;
    expect(runs.ops).toEqual(expect.arrayContaining([["eq", "as_of_date", "2026-11-13"],
      ["order", "created_at", { ascending: false }], ["limit", 30]]));
    expect(runs.ops.some(([op, filter]) => op === "or" && String(filter).includes("horizon_games.eq.1"))).toBe(true);
    expect(pipeline.ops).toEqual(expect.arrayContaining([["eq", "pipeline_key", "rolling_forge_pipeline"],
      ["eq", "scope_key", "daily_incremental:2026-11-13"]]));
  });

  it("confirms a withheld run through the readers' snapshot proof before alerting", async () => {
    const { client, calls } = fakeClient({ forge_runs: [runRow("older", "2026-11-09T10:30:00Z", LISTED),
      runRow("today", "2026-11-13T10:20:00Z", UNLISTED)], projection_pipeline_state: stageRows,
    player_forecast_source_observations: [] });
    const health = await read(client);
    expect(health.status).toBe("critical");
    expect(health.problems[0]).toContain(`producer closure ${UNLISTED} is not in VERIFIED_FORGE_PRODUCER_CLOSURES`);
    expect(calls.map(call => call.table)).toEqual(["forge_runs", "projection_pipeline_state",
      "player_forecast_source_observations", "forge_runs"]);
    expect(calls[2].ops).toContainEqual(["in", "entity_key", ["today"]]);
  });

  it("never throws: a failed runs read is unknown, a failed pipeline read leaves a note", async () => {
    const failed = await read(fakeClient({}, { forge_runs: "permission denied" }).client);
    expect(failed.status).toBe("unknown");
    expect(failed.notes).toContain("FORGE runs unavailable: permission denied");
    const noPipeline = await read(fakeClient({ forge_runs: [runRow("today", "2026-11-13T10:20:00Z", LISTED)] },
      { projection_pipeline_state: "timeout" }).client);
    expect(noPipeline.status).toBe("ok");
    expect(noPipeline.pipeline.state).toBe("unknown");
    expect(noPipeline.notes[0]).toContain("Rolling pipeline state unavailable");
  });

  it("reads nothing off season", async () => {
    const { client, calls } = fakeClient({});
    const health = await readForgeServingHealth({ client, now: new Date("2026-07-01T13:00:00Z"), seasonState: "off_season",
      deadlineAt: Date.now() + 5_000 });
    expect(health.status).toBe("not_applicable");
    expect(calls).toEqual([]);
  });
});
