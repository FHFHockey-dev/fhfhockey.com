// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guardedForgeFetch, type RequestCounts } from "../../scripts/run-forge-local";
import { projectionWritesHash, type ForgeInputSnapshot } from "./gameRevisions";
import { projectionInputHash } from "./inputCapture";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

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
  it("captures a prospective private draft and replays the native scorer without RPC, publication or network", async () => {
    const backend = fixture();
    vi.stubGlobal("fetch", backend.transport);
    const { captureForgePregameInputs, scoreFrozenForgeSnapshot } = await import("./run-forge-projections");
    const exportPath = process.env.FHFH_PREREQUISITE_FIXTURE_EXPORT;
    const diagnosticCodeVersion = exportPath ? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() : "a".repeat(40);
    const capture = await captureForgePregameInputs({ slateDate: date, gameId, inputCutoff: "2026-10-05T22:30:00.000Z",
      codeVersion: diagnosticCodeVersion, runId, deadlineMs: Date.now() + 150000 });
    expect(capture.snapshot.replayClassification).toBe("prospective_frozen");
    expect(capture.snapshot.runId).toBe(runId);
    expect(backend.calls.filter(call => !["GET", "HEAD"].includes(call.method) || call.table.startsWith("rpc/"))).toEqual([]);
    expect(backend.published).toBe(0);
    expect(backend.tables.forge_player_projections).toHaveLength(0);
    const callsBefore = backend.calls.length;
    vi.stubGlobal("fetch", () => { throw new Error("Network disabled"); });
    const replay = await scoreFrozenForgeSnapshot(capture.snapshot, capture.snapshotHash);
    expect(replay.outputHash).toBe(capture.snapshot.outputHash);
    expect(backend.calls).toHaveLength(callsBefore);
    const projections = replay.writes.filter(ops => ops[0].args[0] === "forge_player_projections");
    expect(projections.length).toBeGreaterThan(0);
    const { accountForgeTeamGoals } = await import("../forecast-diagnostics/pairedInputs");
    const rows = projections.flatMap(ops => ops.find(op => op.method === "upsert")?.args[0] as any[] ?? []);
    const home = rows.filter(row => row.team_id === 6);
    const accounting = accountForgeTeamGoals(home, { rosterPlayerIds: home.map(row => row.player_id), residualMean: null,
      strengthPartition: "unknown", overtime: "unknown", emptyNet: "unknown", proofRevisionIds: [] });
    expect(accounting.mean).toBeNull();
    expect(accounting.reasons.some(reason => reason.startsWith("missing_strength_goal:"))).toBe(true);
    expect(projectionWritesHash(replay.writes)).toBe(projectionWritesHash(capture.writes));

    const { goalHistoryFromOfficialFinal, TEAM_GOALS_VERSION, TEAM_GOALS_FEATURES, TEAM_GOALS_PARAMETERS } = await import("../forecast-diagnostics/pairedInputs");
    const { computeFrozenPair, verifyPairReplay } = await import("../forecast-diagnostics/frozenPairRunner");
    const payload = { id: historyId, season: 20262027, gameType: 2, gameState: "OFF", startTimeUTC: "2026-10-03T23:00:00.000Z",
      periodDescriptor: { periodType: "REG" }, homeTeam: { id: 6, score: 3 }, awayTeam: { id: 9, score: 1 },
      plays: [6, 6, 9, 6].map((team, index) => ({ eventId: index + 1, typeDescKey: "goal",
        periodDescriptor: { periodType: "REG" }, details: { eventOwnerTeamId: team } })) };
    const receipt = { revisionId: "official-fixture:1", payloadHash: projectionInputHash(payload), source: "synthetic official fixture",
      firstReceivedAt: now, verifiedAt: now, publishedAt: null, availabilityBasis: "retained_capture" as const, correctionOf: null };
    const teamFreeze = { codeCommit: diagnosticCodeVersion, sourceTreeHash: "b".repeat(64), lockfileHash: "c".repeat(64), nodeVersion: process.version,
      modelVersion: TEAM_GOALS_VERSION, featureSchemaVersion: TEAM_GOALS_VERSION, featureNames: [...TEAM_GOALS_FEATURES],
      parameters: TEAM_GOALS_PARAMETERS, parametersHash: projectionInputHash(TEAM_GOALS_PARAMETERS), calibration: { kind: "none" as const } };
    const forgeFreeze = { ...teamFreeze, modelVersion: "synthetic-native-forge", featureSchemaVersion: "forge-recorded-queries-v1" };
    const missing = { rosterPlayerIds: [] as number[], residualMean: null, strengthPartition: "unknown" as const,
      overtime: "unknown" as const, emptyNet: "unknown" as const, proofRevisionIds: [] as string[] };
    const packet: import("../forecast-diagnostics/frozenPairRunner").FrozenPair = { version: "frozen-pair-v1" as const, evidenceKind: "synthetic_fixture" as const,
      pairId: snapshotId, forgeRunId: runId, teamRunId: operationId, frozenAt: now,
      scope: { gameId, seasonId: 20262027, phase: 2 as const, homeTeamId: 6, awayTeamId: 9,
        gameDate: date, startAt: `${date}T23:30:00.000Z`, cutoffAt: capture.snapshot.inputCutoff, horizonGames: 1 as const },
      teamFreeze, forgeFreeze, history: goalHistoryFromOfficialFinal(payload, receipt),
      retainedHistorySources: [{ revisionId: receipt.revisionId, payload, bodyUtf8: JSON.stringify(payload),
        rawBytesHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex") }],
      forgeSnapshot: capture.snapshot, forgeSnapshotHash: capture.snapshotHash,
      forgeReadProvenance: capture.snapshot.reads.map((read, index) => ({ ...receipt, revisionId: `read:${index}`,
        source: String(read.request[0].args[0]), firstReceivedAt: read.receivedAt, payloadHash: projectionInputHash(read) })),
      forgeCoverage: { home: missing, away: missing } };
    const paired = await computeFrozenPair(packet, { team: teamFreeze, forge: forgeFreeze }, { forge: scoreFrozenForgeSnapshot });
    expect([paired.team.homeMean, paired.team.awayMean]).toEqual([3, 1]);
    expect(paired.forge.home.mean).toBeNull(); expect(paired.acceptanceEligible).toBe(false);
    const original = { inputHash: projectionInputHash(packet), forecastHash: projectionInputHash(paired), forecasts: paired };
    vi.setSystemTime(new Date(Date.parse(now) + 60000));
    const pairedReplay = await computeFrozenPair(packet, { team: teamFreeze, forge: forgeFreeze }, { forge: scoreFrozenForgeSnapshot });
    expect(verifyPairReplay(original, packet, pairedReplay).matched).toBe(true);
    expect(backend.calls).toHaveLength(callsBefore);
    if (exportPath) {
      const { executionFreeze, runFrozenPairCommand } = await import("../../scripts/run-frozen-forecast-pair");
      const pin = executionFreeze(packet);
      packet.teamFreeze = pin.team; packet.forgeFreeze = pin.forge;
      writeFileSync(exportPath, JSON.stringify(packet, null, 2), { flag: "wx", mode: 0o600 });
      const frozenDirectory = `${exportPath}.frozen`, issuedDirectory = `${exportPath}.issued`, replayDirectory = `${exportPath}.replay`;
      const capturePath = `${exportPath}.capture.json`, historyPath = `${exportPath}.history.json`;
      const captureBytes = JSON.stringify({ evidenceKind: "synthetic_fixture", ...capture }, null, 2) + "\n";
      const historyBytes = JSON.stringify({ scope: packet.scope, history: packet.history,
        retainedHistorySources: packet.retainedHistorySources, capturedAt: now, acceptanceEligible: false }, null, 2) + "\n";
      writeFileSync(capturePath, captureBytes, { flag: "wx", mode: 0o600 });
      writeFileSync(historyPath, historyBytes, { flag: "wx", mode: 0o600 });
      await runFrozenPairCommand(["prepare", capturePath, historyPath, frozenDirectory]);
      expect(readFileSync(`${frozenDirectory}/capture.json`, "utf8")).toBe(captureBytes);
      expect(readFileSync(`${frozenDirectory}/history.json`, "utf8")).toBe(historyBytes);
      const prepared: import("../forecast-diagnostics/frozenPairRunner").FrozenPair = JSON.parse(readFileSync(`${frozenDirectory}/inputs.json`, "utf8"));
      expect(prepared.forgeRunId).toBe(capture.snapshot.runId);
      expect(prepared.evidenceKind).toBe("synthetic_fixture");
      expect(prepared.forgeReadProvenance.every(read => read.verifiedAt === prepared.frozenAt)).toBe(true);
      expect(JSON.parse(readFileSync(`${frozenDirectory}/manifest.json`, "utf8"))).toMatchObject({ status: "inputs_frozen",
        captureHash: createHash("sha256").update(captureBytes).digest("hex"), historyHash: createHash("sha256").update(historyBytes).digest("hex") });
      await expect(runFrozenPairCommand(["prepare", capturePath, historyPath, frozenDirectory])).rejects.toThrow();
      // The parent test clock and all source events are explicitly synthetic. Child scoring runs with its own real clock offline.
      vi.setSystemTime(new Date(packet.scope.cutoffAt));
      await runFrozenPairCommand(["issue", `${frozenDirectory}/inputs.json`, issuedDirectory]);
      const originalBytes = readFileSync(`${issuedDirectory}/original.json`, "utf8");
      vi.setSystemTime(new Date(Date.parse(packet.scope.cutoffAt) + 60000));
      await runFrozenPairCommand(["replay", `${issuedDirectory}/inputs.json`, replayDirectory]);
      expect(readFileSync(`${issuedDirectory}/original.json`, "utf8")).toBe(originalBytes);
      const { forecastDiagnosticsMarkdown } = await import("../forecast-diagnostics/contract");
      for (const directory of [issuedDirectory, replayDirectory]) {
        const report = JSON.parse(readFileSync(`${directory}/diagnostics.json`, "utf8"));
        expect(report.evidenceKind).toBe("synthetic_fixture");
        expect(report.replay.status).toBe("not_verified");
        expect(readFileSync(`${directory}/diagnostics.md`, "utf8")).toBe(forecastDiagnosticsMarkdown(report));
      }
      expect(JSON.parse(readFileSync(`${replayDirectory}/replay.json`, "utf8")).matched).toBe(true);
      const { loadLocalFrozenPairDiagnostics } = await import("../forecast-diagnostics/loader");
      const loaded = await loadLocalFrozenPairDiagnostics(issuedDirectory, { gameId, cutoffAt: packet.scope.cutoffAt });
      expect(loaded).toEqual(JSON.parse(readFileSync(`${issuedDirectory}/diagnostics.json`, "utf8")));
      await expect(loadLocalFrozenPairDiagnostics(issuedDirectory, { gameId: gameId + 1, cutoffAt: packet.scope.cutoffAt })).rejects.toMatchObject({ status: 404 });
      for (const [name, initialClock, finalClock, message] of [
        ["late", Date.parse(packet.scope.startAt) - 1000, Date.parse(packet.scope.startAt), "missed pregame issuance"],
        ["rollback", Date.parse(packet.scope.cutoffAt), Date.parse(packet.scope.cutoffAt) - 1000, "before the issuance cutoff"],
      ] as const) {
        const destination = `${exportPath}.${name}`;
        vi.setSystemTime(new Date(initialClock));
        const issuing = runFrozenPairCommand(["issue", `${frozenDirectory}/inputs.json`, destination]);
        vi.setSystemTime(new Date(finalClock));
        await expect(issuing).rejects.toThrow(message);
        expect(existsSync(`${destination}/original.json`)).toBe(false);
        expect(JSON.parse(readFileSync(`${destination}/failed.json`, "utf8")).status).toBe("failed");
        await expect(loadLocalFrozenPairDiagnostics(destination, { gameId, cutoffAt: packet.scope.cutoffAt })).rejects.toMatchObject({ status: 503 });
      }
      const failedSource = `${exportPath}.failed-source`;
      mkdirSync(failedSource, { mode: 0o700 });
      for (const name of ["inputs.json", "original.json"]) writeFileSync(`${failedSource}/${name}`, readFileSync(`${issuedDirectory}/${name}`, "utf8"), { flag: "wx", mode: 0o600 });
      writeFileSync(`${failedSource}/failed.json`, JSON.stringify({ status: "failed" }), { flag: "wx", mode: 0o600 });
      await expect(runFrozenPairCommand(["replay", `${failedSource}/inputs.json`, `${exportPath}.failed-source-replay`])).rejects.toThrow("Failed original issuance");
      expect(JSON.parse(readFileSync(`${exportPath}.failed-source-replay/failed.json`, "utf8")).status).toBe("failed");
      expect(readFileSync(`${issuedDirectory}/original.json`, "utf8")).toBe(originalBytes);
    }
  });

  it("rejects a prospective acquisition deadline reaching the cutoff before any access", async () => {
    const transport = vi.fn(); vi.stubGlobal("fetch", transport);
    const { captureForgePregameInputs } = await import("./run-forge-projections");
    await expect(captureForgePregameInputs({ slateDate: date, gameId, inputCutoff: "2026-10-05T22:30:00.000Z", codeVersion,
      runId, deadlineMs: Date.parse("2026-10-05T22:30:00.000Z") })).rejects.toThrow("before cutoff");
    expect(transport).not.toHaveBeenCalled();
  });

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
