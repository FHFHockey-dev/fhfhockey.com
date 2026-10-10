// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import fixture from "./fixtures/native-player-offline-synthetic.json";
import { projectionInputHash } from "../lib/projections/inputCapture";
import { installOfflineFence, offlineTableAdapter, qualifyNativePlayersOffline, runOfflinePlayerQualification, type OfflinePlayerInputs } from "./qualify-native-players-offline";

const asOf = "2026-10-09T18:00:00.000Z";
const backend = vi.hoisted(() => ({ createClient: vi.fn(() => { throw new Error("Live DB client forbidden"); }) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: backend.createClient }));
// The native runner's NHL import also imports these unused eager public clients.
vi.mock("lib/supabase/public-client", () => ({ default: {} }));
vi.mock("lib/supabase/client", () => ({ default: {} }));
vi.mock("lib/supabase", () => ({ default: {} }));
const input = () => JSON.parse(JSON.stringify(fixture)) as OfflinePlayerInputs;
function updateRows(inputs: OfflinePlayerInputs, table: string, rows: any[]) {
  inputs.tables[table].rows = rows;
  inputs.tables[table].receipt.rowCount = rows.length;
  inputs.tables[table].receipt.rowsHash = projectionInputHash(rows);
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("offline current native player qualification", () => {
  it("reproduces current native calculations with genuine admission and zero live client/transport/writes", async () => {
    const inputs = input(), original = projectionInputHash(inputs);
    const env = process.env.STARTER_BOARD_COMPUTE_ENABLED;
    const network = vi.fn(() => { throw new Error("Unexpected network"); });
    vi.stubGlobal("fetch", network);
    const first = await qualifyNativePlayersOffline(inputs, asOf);
    const second = await qualifyNativePlayersOffline(inputs, asOf);
    expect(first.resultHash).toBe(second.resultHash);
    expect(first.result.outputHash).toBe(second.result.outputHash);
    expect(first.result.blockers).toEqual([]);
    expect(first.result.calculation).toMatchObject({ gamesProcessed: 1, playerRows: 36, teamRows: 2, goalieRows: 2, timedOut: false });
    expect(first.result.boundary).toMatchObject({ networkCalls: 0, databaseCalls: 0, rpcCalls: 0, committedWrites: 0, forbiddenAttempts: [] });
    expect(first.result.boundary.suppressedNativeMutations).toBeGreaterThan(0);
    expect(first.result.boundary.inMemoryReads).toBeGreaterThan(20);
    expect(network).not.toHaveBeenCalled(); expect(backend.createClient).not.toHaveBeenCalled();
    expect(projectionInputHash(inputs)).toBe(original);
    expect(process.env.STARTER_BOARD_COMPUTE_ENABLED).toBe(env);
    expect(first.result.qualificationEligible).toBe(false);
    const skater = first.result.categoryCoverage[0], goalie = first.result.categoryCoverage[1];
    expect(skater.participation.status).toBe("confirmed_evidence");
    expect(skater.admission.acceptedByUnchangedConsumer).toBe(true);
    for (const key of ["G", "A", "SOG"]) expect(skater.categories.find(row => row.category === key)).toMatchObject({
      modeledStatus: "missing", status: "blocked", reasons: expect.arrayContaining(["missing_pk_heads_and_fullgame_bridge"]) });
    expect(skater.categories.find(row => row.category === "PPP")).toMatchObject({ modeledStatus: "present_native_diagnostic", status: "blocked",
      reasons: expect.arrayContaining(["synthetic_fixture_is_not_forecast_evidence"]) });
    expect(skater.categories.find(row => row.category === "HIT")?.reasons).toContain("full_strength_exposure_unproven");
    expect(goalie.categories.find(row => row.category === "SO")?.reasons).toContain("official_individual_shutout_credit_unproven");
    expect(goalie.categories.find(row => row.category === "W")?.reasons).toContain("fullgame_team_goals_driver_unproven");
    expect(skater.categories.map(row => row.category)).toEqual(["G", "A", "PPP", "SOG", "HIT", "BLK", "W", "GA", "SV", "SO"]);
    expect(Date.parse(first.createdAt)).toBeGreaterThan(Date.parse(asOf));
  });

  it("leaves absent playing/start evidence unknown and preserves consumer missing-participation rejection", async () => {
    const inputs = input();
    updateRows(inputs, "player_forecast_lineup_snapshots", []);
    updateRows(inputs, "player_forecast_lineup_assignments", []);
    updateRows(inputs, "player_forecast_goalie_start_observations", []);
    const receipt = await qualifyNativePlayersOffline(inputs, asOf);
    expect(receipt.result.blockers).toEqual([]);
    const skater = receipt.result.categoryCoverage[0];
    expect(skater.participation).toMatchObject({ status: "missing", probability: null });
    expect(skater.admission.acceptedByUnchangedConsumer).toBe(false);
    expect(skater.admission.reasons.some(row => row.reasons.includes("missing_participation"))).toBe(true);
    expect(receipt.result.categoryCoverage[1].participation.status).toBe("uncalibrated_model");
  });

  it.each(["publishedAt", "receivedAt", "verifiedAt"] as const)("rejects late %s before calculation", async key => {
    const inputs = input(); inputs.tables.rolling_player_game_metrics.receipt[key] = "2026-10-10T12:00:00.000Z";
    const receipt = await qualifyNativePlayersOffline(inputs, asOf);
    expect(receipt.result.calculation).toBeNull();
    expect(receipt.result.blockers).toContain("late_or_unordered_source_evidence:rolling_player_game_metrics");
    expect(receipt.result.boundary.inMemoryReads).toBe(0);
  });

  it("rejects source evidence even one microsecond beyond the supplied cutoff", async () => {
    const inputs = input(); inputs.tables.players.receipt.verifiedAt = "2026-10-09T18:00:00.000001Z";
    expect((await qualifyNativePlayersOffline(inputs, asOf)).result.blockers).toContain("late_or_unordered_source_evidence:players");
  });

  it("never promotes a confirmed PP role to playing participation", async () => {
    const inputs = input();
    updateRows(inputs, "player_forecast_lineup_assignments", inputs.tables.player_forecast_lineup_assignments.rows.filter(row => row.unit_type === "power_play"));
    const result = (await qualifyNativePlayersOffline(inputs, asOf)).result;
    expect(result.categoryCoverage[0].participation.probability).toBeNull();
    expect(result.categoryCoverage[0].admission.reasons.some(row => row.reasons.includes("missing_participation"))).toBe(true);
  });

  it("rejects missing receipts, incomplete exports, changed hashes and late nested source evidence", async () => {
    const inputs = input();
    inputs.tables.rolling_player_game_metrics.receipt.rowsHash = "0".repeat(64);
    inputs.tables.forge_goalie_game.receipt.complete = false;
    delete (inputs.tables.teams as any).receipt;
    const rows = inputs.tables.player_forecast_lineup_assignments.rows;
    rows[0].created_at = "2026-10-10T12:00:00.000Z";
    updateRows(inputs, "player_forecast_lineup_assignments", rows);
    const receipt = await qualifyNativePlayersOffline(inputs, asOf);
    expect(receipt.result.calculation).toBeNull();
    expect(receipt.result.blockers).toEqual(expect.arrayContaining(["missing_or_incomplete_source_receipt:rolling_player_game_metrics",
      "missing_or_incomplete_source_receipt:forge_goalie_game", "missing_or_incomplete_source_receipt:teams",
      "late_or_invalid_row_evidence:player_forecast_lineup_assignments.0.created_at"]));
  });

  it("fails closed if a native optional query swallows an unprovided input table", async () => {
    const inputs = input(); delete inputs.tables.wgo_skater_stats;
    const receipt = await qualifyNativePlayersOffline(inputs, asOf);
    expect(receipt.result.blockers).toContain("missing_table:wgo_skater_stats");
    expect(receipt.result.categoryCoverage.every(target => !target.admission.acceptedByUnchangedConsumer)).toBe(true);
  });

  it("rejects omitted retained columns even when a producer fallback catches the query error", async () => {
    const inputs = input(), rows = inputs.tables.rolling_player_game_metrics.rows;
    delete rows[0].toi_seconds_avg_last5;
    updateRows(inputs, "rolling_player_game_metrics", rows);
    const result = (await qualifyNativePlayersOffline(inputs, asOf)).result;
    expect(result.blockers).toContain("missing_export_column:rolling_player_game_metrics.toi_seconds_avg_last5");
    expect(result.categoryCoverage.every(target => !target.admission.acceptedByUnchangedConsumer)).toBe(true);
  });

  it("rejects later accepted-news evidence without backdating its receipt", async () => {
    const inputs = input();
    const newsAt = "2026-10-09T18:00:00.000Z";
    updateRows(inputs, "forge_board_news_events", [{ id: "synthetic-refresh", game_id: inputs.gameId, queue_version: 1, accepted_at: newsAt }]);
    const receipt = await qualifyNativePlayersOffline(inputs, "2026-10-09T17:00:00.000Z");
    expect(receipt.result.blockers).toContain("late_or_invalid_row_evidence:forge_board_news_events.0.accepted_at");
  });

  it("rejects missing/future as-of and target/roster mismatch", async () => {
    await expect(qualifyNativePlayersOffline(input(), "")).rejects.toThrow("explicit --as-of");
    await expect(qualifyNativePlayersOffline(input(), "2999-10-09T18:00:00Z")).rejects.toThrow("explicit --as-of");
    const inputs = input(); inputs.targets[0].canonicalId = 12345;
    expect((await qualifyNativePlayersOffline(inputs, asOf)).result.blockers).toContain("target_identity_not_in_retained_roster");
  });

  it("blocks direct RPC, adapter mutations and unsupported/unrecorded reads", async () => {
    const adapter = offlineTableAdapter(input());
    expect(() => adapter.rpc()).toThrow("rpc_forbidden");
    expect(() => adapter.from("players").upsert({ id: 1 })).toThrow("database_write_forbidden");
    await expect(adapter.from("absent").select("*")).rejects.toThrow("missing_table");
    await expect(adapter.from("players").select("unprovided_column")).rejects.toThrow("missing_export_column");
    await expect(adapter.from("players").select("*").ilike("id", "*")).rejects.toThrow("unsupported_query");
  });

  it.each([
    ["limit", [1, { referencedTable: "unexported_relation" }]],
    ["limit", [1, { foreignTable: "unexported_relation" }]],
    ["select", ["id", { count: "estimated" }]],
    ["order", ["id", { ascending: true, nullsFirst: true }]],
    ["order", ["id", { ascending: "true" }]],
    ["range", [0, 1, { referencedTable: "relation" }]],
    ["eq", ["id", 601, { ignored: true }]],
    ["or", ["id.eq.601", { referencedTable: "relation" }]],
    ["maybeSingle", [{ ignored: true }]],
    ["abortSignal", [{}]],
  ])("rejects unsupported argument/options shape for %s", async (method, args) => {
    const adapter = offlineTableAdapter(input());
    await expect(adapter.from("players")[method as string](...(args as any[]))).rejects.toThrow(`unsupported_query_shape:${method}`);
    expect(adapter.violations).toContain(`unsupported_query_shape:${method}`);
  });

  it("rejects implicit predicate type coercion and compares zoned timestamp filters exactly", async () => {
    const inputs = input();
    const adapter = offlineTableAdapter(inputs);
    await expect(adapter.from("players").select("id").eq("id", "601")).rejects.toThrow("unsupported_predicate_type");
    updateRows(inputs, "forge_board_news_events", [{ id: "early", accepted_at: "2026-10-09T18:00:00+01:00" },
      { id: "late", accepted_at: "2026-10-09T18:00:00.000001Z" }]);
    const result = await adapter.from("forge_board_news_events").select("id").lte("accepted_at", asOf);
    expect(result.data).toEqual([{ id: "early" }]);
  });

  it("implements native exact-count HEAD without returning rows", async () => {
    const adapter = offlineTableAdapter(input());
    expect(await adapter.from("players").select("id", { head: true, count: "exact" })).toEqual({ data: null, count: 38, error: null });
    expect(adapter.violations).toEqual([]);
  });

  it("blocks equivalent client paths and SDK entry points before inert config/sentinel access in a fresh process", () => {
    const webRoot = resolve(__dirname, "..");
    const script = `
      const root = ${JSON.stringify(webRoot)};
      require(root + '/node_modules/ts-node/register/transpile-only');
      const { installOfflineFence, offlineTableAdapter } = require(root + '/scripts/qualify-native-players-offline.ts');
      const inputs = require(root + '/scripts/fixtures/native-player-offline-synthetic.json');
      const Module = require('node:module'), originalLoad = Module._load;
      const env = process.env, events = [], rejections = [];
      Module._load = function(request, parent, isMain) {
        if (request.includes('@supabase/')) { events.push('SDK_load_reached'); throw new Error('Inert SDK sentinel reached'); }
        return originalLoad.call(this, request, parent, isMain);
      };
      process.env = new Proxy({ NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-only' }, {
        get(target, key) { if (String(key).includes('SUPABASE')) events.push('configuration_read:' + String(key)); return target[key]; }
      });
      const adapter = offlineTableAdapter(inputs), fence = installOfflineFence(adapter);
      const blocked = action => { try { action(); } catch (error) { rejections.push(error.message); } };
      try {
        for (const path of ['lib/supabase/server', root + '/lib/supabase/server.ts', './lib/supabase/server']) {
          const server = require(path);
          blocked(() => server.getServiceRoleClient());
          blocked(() => server.default.rpc('inert'));
          blocked(() => server.default.from('players').upsert({id:1}));
          blocked(() => server.default.auth);
        }
        for (const name of ['client', 'public-client', 'serverReadonly', 'index']) {
          blocked(() => require(root + '/lib/supabase/' + name + '.ts').default.auth);
        }
        for (const path of ['@supabase/supabase-js', require.resolve('@supabase/supabase-js')]) {
          blocked(() => require(path).createClient('https://fixture.invalid','synthetic-only'));
          blocked(() => new (require(path).SupabaseClient)());
        }
        const { createRequire } = require('node:module');
        blocked(() => createRequire(root + '/lib/NHL/server/index.ts')('../../supabase/server').getServiceRoleClient());
        console.log(JSON.stringify({ events, rejections, fenceAttempts: fence.attempts, adapterViolations: adapter.violations }));
      } finally { fence.restore(); Module._load = originalLoad; process.env = env; }
    `;
    const result = JSON.parse(execFileSync(process.execPath, ["-e", script], { cwd: webRoot, encoding: "utf8",
      env: { NODE_ENV: "test", PATH: process.env.PATH, NODE_PATH: webRoot, TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node"}' } }));
    expect(result.events).toEqual([]);
    expect(result.rejections).toHaveLength(21);
    expect(result.fenceAttempts).toContain("getServiceRoleClient");
    expect(result.fenceAttempts).toContain("SDK.createClient");
    expect(result.adapterViolations).toContain("rpc_forbidden");
    expect(result.adapterViolations).toContain("database_write_forbidden:upsert");
  });

  it("rejects future outcomes in rolling/team/goalie history and their referenced game", async () => {
    const inputs = input();
    for (const table of ["rolling_player_game_metrics", "forge_team_game_strength", "forge_goalie_game"]) {
      updateRows(inputs, table, inputs.tables[table].rows.map(row => ({ ...row, game_date: "2026-10-11" })));
    }
    inputs.tables.games.rows[1].date = "2026-10-11";
    updateRows(inputs, "games", inputs.tables.games.rows);
    const result = (await qualifyNativePlayersOffline(inputs, asOf)).result;
    expect(result.blockers.some(reason => reason.startsWith("late_or_ambiguous_history:rolling_player_game_metrics"))).toBe(true);
    expect(result.blockers).toContain("late_or_ambiguous_history:games.1.date");
    expect(result.calculation).toBeNull(); expect(result.boundary.inMemoryReads).toBe(0);
    expect(result.categoryCoverage.every(target => !target.admission.acceptedByUnchangedConsumer)).toBe(true);
  });

  it("checks aggregate and camel-case event times while allowing future schedule/expiry", async () => {
    const inputs = input();
    const row = { player_id: 601, date: "2026-10-11", sourceEvidence: { eventTime: "2026-10-11T12:00:00Z" } };
    updateRows(inputs, "player_stats_unified", [row]);
    const result = (await qualifyNativePlayersOffline(inputs, asOf)).result;
    expect(result.blockers).toContain("late_or_ambiguous_history:player_stats_unified.0.date");
    expect(result.blockers).toContain("late_or_invalid_row_evidence:player_stats_unified.0.sourceEvidence.eventTime");
    expect(result.blockers.some(reason => reason.includes("games.0"))).toBe(false);
  });

  it("requires exact completion for cutoff-day history, and completion before the original publication", async () => {
    const inputs = input();
    for (const table of ["rolling_player_game_metrics", "forge_team_game_strength", "forge_goalie_game"]) {
      updateRows(inputs, table, inputs.tables[table].rows.map(row => ({ ...row, game_date: "2026-10-09" })));
    }
    inputs.tables.games.rows[1].date = "2026-10-09";
    updateRows(inputs, "games", inputs.tables.games.rows);
    expect((await qualifyNativePlayersOffline(inputs, asOf)).result.blockers).toContain("late_or_ambiguous_history:games.1.date");
    inputs.tables.games.rows[1].completedAt = "2026-10-09T10:00:00.000Z";
    updateRows(inputs, "games", inputs.tables.games.rows);
    expect((await qualifyNativePlayersOffline(inputs, asOf)).result.blockers).toEqual([]);
    inputs.tables.games.rows[1].completedAt = "2026-10-09T13:00:00.000Z";
    updateRows(inputs, "games", inputs.tables.games.rows);
    expect((await qualifyNativePlayersOffline(inputs, asOf)).result.blockers.some(reason => reason.includes("source_publication"))).toBe(true);
  });

  it("rejects historical statistics whose referenced puck drop is still in the future", async () => {
    const inputs = input(); inputs.tables.games.rows[1].startTime = "2026-10-09T23:00:00Z";
    updateRows(inputs, "games", inputs.tables.games.rows);
    expect((await qualifyNativePlayersOffline(inputs, asOf)).result.blockers.some(reason => reason.startsWith("historical_game_not_started_by_cutoff:"))).toBe(true);
  });

  it("cannot certify PPP from missing or zero PP exposure denominators", async () => {
    const inputs = input();
    updateRows(inputs, "rolling_player_game_metrics", inputs.tables.rolling_player_game_metrics.rows.map(row => row.player_id === 601 && row.strength_state === "pp"
      ? { ...row, toi_seconds_avg_all: 0, toi_seconds_avg_last5: null } : row));
    const ppp = (await qualifyNativePlayersOffline(inputs, asOf)).result.categoryCoverage[0].categories.find(row => row.category === "PPP");
    expect(ppp?.status).toBe("blocked"); expect(ppp?.reasons).toContain("missing_pp_counts_or_exposure_denominators");
  });

  it("retains a native PPP diagnostic but blocks source support when PP rows are absent", async () => {
    const inputs = input();
    updateRows(inputs, "rolling_player_game_metrics", inputs.tables.rolling_player_game_metrics.rows.filter(row => row.strength_state !== "pp"));
    const result = (await qualifyNativePlayersOffline(inputs, asOf)).result;
    expect(result.blockers).toEqual([]);
    const target = result.categoryCoverage[0], ppp = target.categories.find(row => row.category === "PPP");
    expect(target.inputCoverage.retainedRollingRowsByStrength.pp).toBe(0);
    expect(ppp).toMatchObject({ modeledStatus: "present_native_diagnostic", status: "blocked" });
    expect(ppp?.modeledValue).toBeGreaterThan(0);
    expect(ppp?.reasons).toContain("missing_retained_pp_history");
    expect(ppp?.reasons).toContain("pp_event_exposure_coverage_unproven");
  });

  it.each([false, true])("cannot relabel the immutable fictional artifact as retained exports (replace strings=%s)", async replaceStrings => {
    const inputs = input(); inputs.classification = "retained_exports";
    if (replaceStrings) for (const entry of Object.values(inputs.tables)) {
      Object.assign(entry.receipt, { source: "operator export", revision: "revision-1", scope: "supplied rows" });
    }
    const result = (await qualifyNativePlayersOffline(inputs, asOf)).result;
    expect(result.classification).toBe("synthetic_fixture");
    expect(result.declaredClassification).toBe("retained_exports");
    expect(result.blockers).toContain("contradictory_fictional_provenance");
    expect(result.calculation).toBeNull();
    expect(result.categoryCoverage[0].categories.find(row => row.category === "PPP")?.status).toBe("blocked");
  });

  it("blocks network primitives and process escapes before dispatch and restores them", async () => {
    const originalFetch = globalThis.fetch, originalRequest = require("node:https").request;
    const fence = installOfflineFence();
    try {
      expect(() => globalThis.fetch("https://fixture.invalid")).toThrow("offline_side_effect_forbidden");
      for (const [name, method, args] of [["node:https", "request", ["https://fixture.invalid"]],
        ["node:net", "connect", [443]], ["node:tls", "connect", [443]], ["node:http2", "connect", ["https://fixture.invalid"]],
        ["node:dgram", "createSocket", ["udp4"]], ["node:child_process", "execFileSync", ["true"]]] as const) {
        expect(() => require(name)[method](...args)).toThrow("offline_side_effect_forbidden");
      }
      expect(() => new (require("node:net").Socket)().connect(443)).toThrow("offline_side_effect_forbidden");
      expect(fence.attempts).toHaveLength(8);
    } finally { fence.restore(); }
    expect(globalThis.fetch).toBe(originalFetch); expect(require("node:https").request).toBe(originalRequest);
  });

  it("writes a new reproducible receipt without changing or overwriting original inputs", async () => {
    const path = resolve(__dirname, "fixtures/native-player-offline-synthetic.json");
    const original = readFileSync(path), sha256 = createHash("sha256").update(new Uint8Array(original)).digest("hex");
    const directory = mkdtempSync(join(tmpdir(), "native-player-offline-")), output = join(directory, "receipt.json");
    const args = ["--input", path, "--input-sha256", sha256, "--as-of", asOf, "--output", output];
    try {
      const receipt = await runOfflinePlayerQualification(args);
      expect(JSON.parse(readFileSync(output, "utf8")).resultHash).toBe(receipt.resultHash);
      expect(receipt.inputFile.sha256).toBe(sha256);
      await expect(runOfflinePlayerQualification(args)).rejects.toThrow("EEXIST");
      await expect(runOfflinePlayerQualification(["--input", path])).rejects.toThrow("--as-of");
      await expect(runOfflinePlayerQualification(args.map(value => value === sha256 ? "0".repeat(64) : value === output ? join(directory, "bad-receipt.json") : value))).rejects.toThrow("checksum");
      expect(readFileSync(path)).toEqual(original);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
