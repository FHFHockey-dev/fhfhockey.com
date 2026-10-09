// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guardedForgeFetch, type RequestCounts } from "../../scripts/run-forge-local";
import { projectionWritesHash, type ForgeInputSnapshot } from "./gameRevisions";
import { projectionInputHash } from "./inputCapture";

const origin = "https://forge-fixture.supabase.invalid";
const date = "2026-10-05";
const now = "2026-10-04T23:30:00.000Z";
const gameId = 2026020041;
const historyId = 2026020031;
const runId = "11111111-1111-4111-8111-111111111111";
const snapshotId = "22222222-2222-4222-8222-222222222222";
const operationId = "33333333-3333-4333-8333-333333333333";
const codeVersion = `local:${"a".repeat(64)}`;
type Row = Record<string, any>;
type Call = { table: string; method: string; body: any };
const outputTables = ["forge_player_projections", "forge_team_projections", "forge_goalie_projections"];
const analyticsTables = ["player_prediction_outputs", "game_prediction_outputs", "model_market_flags_daily"];

/** Only HTTP is simulated: queries, SDK, capture, stages and persistence are real. */
function fixture(failure?: "player" | "snapshot" | "publication") {
  const players = [6, 9].flatMap(team => Array.from({ length: 19 }, (_, index) => ({
    id: team * 100 + index + 1, team_id: team, position: index === 18 ? "G" : index < 12 ? "C" : "D",
  })));
  const historyDate = "2026-10-03";
  const tables: Record<string, Row[]> = {
    games: [
      { id: gameId, date, seasonId: 20262027, type: 2, startTime: `${date}T23:30:00.000Z`, homeTeamId: 6, awayTeamId: 9 },
      { id: historyId, date: historyDate, seasonId: 20262027, type: 2, homeTeamId: 6, awayTeamId: 9 },
    ],
    seasons: [{ id: 20262027, startDate: "2026-10-01", regularSeasonEndDate: "2027-04-15", endDate: "2027-06-30", numberOfGames: 82 }],
    teams: [{ id: 6, abbreviation: "BOS" }, { id: 9, abbreviation: "OTT" }],
    players,
    rosters: players.map(p => ({ playerId: p.id, teamId: p.team_id, seasonId: 20262027, is_current: true, created_at: now })),
    fhfh_player_identities: players.map(p => ({ id: p.id + 10000, nhl_player_id: p.id, current_nhl_team_id: p.team_id,
      verification_status: "verified", lifecycle_status: "active_nhl", merged_into_id: null, updated_at: now })),
    roster_optimizer_team_games: [6, 9].map(team => ({ game_key: `fixture-${team}`, season: "2026",
      source_season_id: 20262027, source_game_id: gameId, team_id: team, opponent_team_id: team === 6 ? 9 : 6,
      team_abbreviation: team === 6 ? "BOS" : "OTT", opponent_abbreviation: team === 6 ? "OTT" : "BOS",
      start_time: `${date}T23:30:00.000Z`, game_status: "FUT", schedule_status: "OK", fetched_at: now, source_updated_at: now })),
    lineCombinations: [6, 9].map(team => ({ gameId: historyId, teamId: team,
      forwards: players.filter(p => p.team_id === team && p.position === "C").map(p => p.id),
      defensemen: players.filter(p => p.team_id === team && p.position === "D").map(p => p.id), goalies: [team * 100 + 19] })),
    rolling_player_game_metrics: players.filter(p => p.position !== "G").flatMap(p => ["ev", "pp"].map(state => ({
      player_id: p.id, game_id: historyId, season: 20262027, strength_state: state, game_date: historyDate,
      toi_seconds_avg_last5: state === "ev" ? 800 : 100, toi_seconds_avg_all: state === "ev" ? 800 : 100,
      sog_per_60_last5: 7, sog_per_60_all: 7, hits_per_60_last5: 4, hits_per_60_all: 4,
      blocks_per_60_last5: 3, blocks_per_60_all: 3, goals_total_last5: 2, shots_total_last5: 20,
      assists_total_last5: 3, goals_total_all: 4, shots_total_all: 40, assists_total_all: 6,
    }))),
    forge_team_game_strength: [6, 9].map(team => ({ team_id: team, game_id: historyId, game_date: historyDate,
      toi_es_seconds: 15000, toi_pp_seconds: 1500, shots_es: 25, shots_pp: 5, goals_es: 2, goals_pp: 1 })),
    forge_goalie_game: [6, 9].map(team => ({ team_id: team, goalie_id: team * 100 + 19, game_id: historyId,
      game_date: historyDate, toi_seconds: 3600, shots_against: 30, goals_allowed: 3, saves: 27 })),
  };
  for (const table of ["market_prices_daily", "prop_market_prices_daily", "forge_roster_events", "pbp_games", "pbp_plays",
    "player_forecast_lineup_snapshots", "player_forecast_goalie_start_observations", "player_forecast_observation_conflicts",
    "player_forecast_lineup_assignments", "player_forecast_conflict_resolutions", "wgo_skater_stats", "player_stats_unified",
    "sustainability_trend_bands", "nhl_xg_team_rolling_aggregates", "nhl_team_data", "wgo_team_stats", "nst_team_all",
    "nst_team_stats", "wgo_goalie_stats", "goalie_start_projections", ...outputTables, ...analyticsTables,
    "forge_runs", "player_forecast_source_observations"]) tables[table] = [];
  const calls: Call[] = [];
  let published = 0;
  let snapshot: ForgeInputSnapshot | null = null;
  const json = (value: unknown, headers: HeadersInit = {}) => new Response(JSON.stringify(value), {
    status: 200, headers: { "Content-Type": "application/json", ...headers },
  });
  function matches(row: Row, key: string, expression: string): boolean {
    const dot = expression.indexOf(".");
    const operator = expression.slice(0, dot), value = expression.slice(dot + 1);
    const actual = row[key];
    switch (operator) {
      case "eq": return String(actual) === value;
      case "is": return value === "null" ? actual == null : String(actual) === value;
      case "in": return value.slice(1, -1).split(",").includes(String(actual));
      case "lt": return actual != null && String(actual) < value;
      case "lte": return actual != null && String(actual) <= value;
      case "gt": return actual != null && String(actual) > value;
      case "gte": return actual != null && String(actual) >= value;
      default: throw new Error(`Unsupported fixture predicate ${expression}`);
    }
  }
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    expect(url.origin).toBe(origin);
    const table = url.pathname.slice("/rest/v1/".length);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ table, method, body });
    if (table === "rpc/begin_forge_local_run") {
      expect(body).toEqual({ p_operation_id: operationId, p_date: date, p_game_id: gameId,
        p_code_version: codeVersion, p_expected_revision_id: null, p_lease_ms: 150000 });
      tables.forge_runs.push({ run_id: runId, status: "running" });
      return json({ version: "forge-local-attempt-v1", operationId, slateDate: date, gameId, codeVersion,
        expectedRevisionId: null, leaseMs: 150000, runId, reservedAt: now,
        leaseExpiresAt: "2026-10-04T23:32:30.000Z", state: "active", reservation: "new" });
    }
    if (table === "rpc/begin_forge_game_run") {
      tables.forge_runs.push({ run_id: runId, status: "running" });
      return json(runId);
    }
    if (table === "rpc/publish_forge_game_revisions") {
      if (failure === "publication") return new Response(JSON.stringify({ code: "TEST_PUBLICATION_REJECTED", message: "fixture publication rejected" }), { status: 409 });
      expect(body).toEqual({ p_run_id: runId, p_snapshot_id: snapshotId });
      expect(tables.forge_runs[0].status).toBe("succeeded");
      expect(snapshot).toMatchObject({ runId, gameIds: [gameId], horizonGames: 1, replayClassification: "captured_live" });
      for (const output of outputTables) expect(new Set(tables[output].map(row => row.team_id))).toEqual(new Set([6, 9]));
      const writes = outputTables.map(table => [{ method: "from", args: [table] }, { method: "upsert", args: [tables[table]] }]);
      expect(snapshot!.outputHash).toBe(projectionWritesHash(writes));
      published++;
      return json(1);
    }
    if (!(table in tables)) throw new Error(`Unexpected fixture table ${table}`);
    if (method === "GET" || method === "HEAD") {
      let rows = tables[table].filter(row => [...url.searchParams].every(([key, value]) => {
        if (["select", "order", "limit", "offset"].includes(key)) return true;
        if (key === "or") return value.slice(1, -1).split(",").some(part => {
          const dot = part.indexOf("."); return matches(row, part.slice(0, dot), part.slice(dot + 1));
        });
        return matches(row, key, value);
      }));
      const total = rows.length;
      const ordering = url.searchParams.get("order")?.split(",") ?? [];
      rows.sort((left, right) => {
        for (const spec of ordering) {
          const [key, direction] = spec.split(".");
          const compared = left[key] < right[key] ? -1 : left[key] > right[key] ? 1 : 0;
          if (compared) return direction === "desc" ? -compared : compared;
        }
        return 0;
      });
      const offset = Number(url.searchParams.get("offset") ?? 0);
      rows = rows.slice(offset, offset + Number(url.searchParams.get("limit") ?? total));
      const selected = url.searchParams.get("select");
      if (selected && selected !== "*") rows = rows.map(row => Object.fromEntries(selected.split(",").map(key => [key, row[key] ?? null])));
      const single = new Headers(init?.headers).get("accept")?.includes("application/vnd.pgrst.object+json");
      return json(single ? rows[0] ?? null : rows, { "content-range": `${offset}-${Math.max(offset, offset + rows.length - 1)}/${total}` });
    }
    if (failure === "player" && table === "forge_player_projections") return new Response(JSON.stringify({ code: "TEST_WRITE_REJECTED", message: "fixture player write rejected" }), { status: 409 });
    if (failure === "snapshot" && table === "player_forecast_source_observations") return new Response(JSON.stringify({ code: "TEST_SNAPSHOT_REJECTED", message: "fixture snapshot rejected" }), { status: 409 });
    if (method === "PATCH") tables[table].forEach(row => Object.assign(row, body));
    else if (method === "DELETE") tables[table] = [];
    else if (method === "POST") {
      const rows = Array.isArray(body) ? body : [body];
      tables[table].push(...rows);
      if (table === "player_forecast_source_observations") {
        snapshot = body.payload;
        expect(body.payload_hash).toBe(projectionInputHash(snapshot));
        expect(body.metadata.outputHash).toBe(snapshot!.outputHash);
        return json({ id: snapshotId });
      }
    } else throw new Error(`Unexpected fixture method ${method}`);
    return new Response(null, { status: 204 });
  };
  return { transport, calls, tables, get snapshot() { return snapshot; }, get published() { return published; } };
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(now));
  for (const [key, value] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: "synthetic-key",
    FORGE_CODE_VERSION: codeVersion, STARTER_BOARD_CAPTURE_ENABLED: "true", STARTER_BOARD_COMPUTE_ENABLED: "true",
    STARTER_BOARD_SERVING_ENABLED: "false", STARTER_BOARD_CANARY_GAME_IDS: String(gameId), STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED: "false" })) vi.stubEnv(key, value);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

async function run(local: boolean, backend: ReturnType<typeof fixture>, guarded = local) {
  const counts: RequestCounts = { reads: 0, writes: 0, readMs: 0, writeMs: 0, acknowledgedWrites: 0, rejectedWrites: 0, unknownWrites: 0 };
  const bounds = { deadlineMs: Date.now() + 150000, requestTimeoutMs: 10000, maxWrites: 100, maxRequests: 1000 };
  vi.stubGlobal("fetch", guarded ? (input: RequestInfo | URL, init?: RequestInit) => guardedForgeFetch(input, init,
    origin, true, backend.transport, counts, bounds) : backend.transport);
  const { runProjectionV2ForDate } = await import("./run-forge-projections");
  return runProjectionV2ForDate(date, { gameIds: [gameId], horizonGames: 1,
    ...(local ? { localAttempt: { operationId, expectedRevisionId: null, leaseMs: 150000 } } : {}) });
}

describe("actual FORGE producer through fenced local transport", () => {
  it("publishes both clubs with real persistence and captured output hash while explicitly omitting optional analytics", async () => {
    const backend = fixture();
    const result = await run(true, backend);
    expect(result).toMatchObject({ runId, inputSnapshotId: snapshotId, publishedGames: 1, timedOut: false });
    expect(backend.tables.forge_player_projections).toHaveLength(36);
    expect(backend.tables.forge_team_projections).toHaveLength(2);
    expect(backend.tables.forge_goalie_projections).toHaveLength(2);
    expect(backend.calls.filter(call => call.method === "DELETE" || analyticsTables.includes(call.table))).toEqual([]);
    expect(backend.tables.forge_runs[0]).toMatchObject({ status: "succeeded", metrics: {
      analytics_sidecar: { version: "forge-analytics-sidecar-scope-v1", status: "omitted_fenced_local_attempt" },
    } });
    expect(backend.snapshot!.inputProvenance!.issuedContexts![0].roster).toHaveLength(38);
    expect(backend.snapshot!.reads.length).toBeGreaterThan(20);
    expect(backend.published).toBe(1);
  });

  it("keeps the normal scheduled analytics replacement enabled", async () => {
    const backend = fixture();
    await run(false, backend);
    expect(backend.calls.filter(call => call.method === "DELETE").map(call => call.table)).toEqual(analyticsTables);
    expect(backend.tables.game_prediction_outputs).toHaveLength(1);
    expect(backend.tables.forge_runs[0].metrics.analytics_sidecar.status).toBe("enabled");
    expect(backend.published).toBe(1);
  });

  it("still denies DELETE when a nonlocal run uses the fenced transport", async () => {
    const backend = fixture();
    await expect(run(false, backend, true)).rejects.toThrow("Local FORGE transport rejected a request");
    expect(backend.calls.some(call => call.method === "DELETE")).toBe(false);
    expect(backend.tables.forge_runs[0].status).toBe("failed");
    expect(backend.tables.forge_runs[0].metrics.analytics_sidecar.status).toBe("enabled");
    expect(backend.snapshot).toBeNull();
    expect(backend.published).toBe(0);
  });

  it("does not capture or publish after actual FORGE persistence fails", async () => {
    const backend = fixture("player");
    await expect(run(true, backend)).rejects.toMatchObject({ code: "TEST_WRITE_REJECTED" });
    expect(backend.tables.forge_runs[0].status).toBe("failed");
    expect(backend.tables.forge_runs[0].metrics.analytics_sidecar.status).toBe("omitted_fenced_local_attempt");
    expect(backend.snapshot).toBeNull();
    expect(backend.published).toBe(0);
  });

  it.each(["snapshot", "publication"] as const)("retains the omission diagnostic after real %s rejection", async failure => {
    const backend = fixture(failure);
    await expect(run(true, backend)).rejects.toMatchObject({
      code: failure === "snapshot" ? "TEST_SNAPSHOT_REJECTED" : "TEST_PUBLICATION_REJECTED",
    });
    expect(backend.tables.forge_player_projections).toHaveLength(36);
    expect(backend.tables.forge_runs[0]).toMatchObject({ status: "failed", metrics: {
      publication_failed: true,
      analytics_sidecar: { version: "forge-analytics-sidecar-scope-v1", status: "omitted_fenced_local_attempt" },
    } });
    expect(backend.calls.filter(call => call.method === "DELETE" || analyticsTables.includes(call.table))).toEqual([]);
    expect(backend.snapshot === null).toBe(failure === "snapshot");
    expect(backend.published).toBe(0);
  });
});
