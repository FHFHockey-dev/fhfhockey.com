// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Resumable FORGE runs: one run_id per date across invocations, with the
 * per-game stages faked. Only the forge_runs lifecycle and the projection
 * tables are simulated, in memory, with the filters the code uses.
 * Invocations given a `plans` entry write through the real persistence stage.
 */
type Row = Record<string, any>;

const db = vi.hoisted(() => {
  const tables: Record<string, Row[]> = {};
  // A held table's next write is sent but commits only once released.
  const holds = new Map<string, { reached: () => void; commit: Promise<void> }>();
  let sequence = 0;
  const read = (row: Row, column: string) => {
    const path = /^(\w+)->(\w+)->>(\w+)$/.exec(column);
    if (!path) return row[column];
    const value = row[path[1]]?.[path[2]]?.[path[3]];
    return value == null ? null : String(value);
  };
  function from(table: string) {
    tables[table] ??= [];
    const filters: Array<(row: Row) => boolean> = [];
    let operation: "select" | "insert" | "update" | "delete" | "upsert" = "select";
    let patch: Row = {};
    let inserted: Row[] = [];
    let conflictKeys: string[] = [];
    let columns = "";
    let returning = false;
    let order: { key: string; ascending: boolean } | null = null;
    let limit = Number.POSITIVE_INFINITY;
    const execute = () => {
      if (operation === "insert") return inserted;
      if (operation === "upsert") {
        for (const row of inserted) {
          const existing = tables[table].find((stored) => conflictKeys.every((key) => stored[key] === row[key]));
          if (existing) Object.assign(existing, row);
          else tables[table].push(row);
        }
        return inserted;
      }
      const matched = tables[table].filter((row) => filters.every((filter) => filter(row)));
      if (operation === "update") {
        for (const row of matched) Object.assign(row, structuredClone(patch));
        return matched;
      }
      if (operation === "delete") {
        tables[table] = tables[table].filter((row) => !matched.includes(row));
        return matched;
      }
      const sorted = order
        ? [...matched].sort((a, b) => {
          const compared = a[order!.key] < b[order!.key] ? -1 : a[order!.key] > b[order!.key] ? 1 : 0;
          return order!.ascending ? compared : -compared;
        })
        : matched;
      return sorted.slice(0, limit);
    };
    // Supports `alias:column->key` projections; other columns return whole rows.
    const project = (row: Row) => {
      const out = { ...row };
      for (const item of columns.split(",")) {
        const path = /^(\w+):(\w+)->(\w+)$/.exec(item.trim());
        if (path) out[path[1]] = row[path[2]]?.[path[3]] ?? null;
      }
      return out;
    };
    const result = () => {
      const rows = execute();
      return { data: operation === "select" || returning ? structuredClone(rows.map(project)) : null, error: null };
    };
    const settle = () => {
      const hold = operation === "select" ? undefined : holds.get(table);
      if (!hold) return Promise.resolve();
      holds.delete(table);
      hold.reached();
      return hold.commit;
    };
    const query: any = {
      select: (selected?: string) => {
        if (operation !== "select") returning = true;
        else columns = selected ?? "";
        return query;
      },
      insert: (value: Row | Row[]) => {
        operation = "insert";
        inserted = (Array.isArray(value) ? value : [value]).map((row) => ({
          run_id: `run-${++sequence}`, created_at: new Date().toISOString(), updated_at: null, ...structuredClone(row),
        }));
        tables[table].push(...inserted);
        return query;
      },
      upsert: (value: Row | Row[], options?: { onConflict?: string }) => {
        operation = "upsert";
        inserted = (Array.isArray(value) ? value : [value]).map((row) => structuredClone(row));
        conflictKeys = options?.onConflict?.split(",") ?? [];
        return query;
      },
      update: (value: Row) => {
        operation = "update";
        patch = value;
        return query;
      },
      delete: () => {
        operation = "delete";
        return query;
      },
      eq: (column: string, value: unknown) => {
        filters.push((row) => String(read(row, column)) === String(value));
        return query;
      },
      in: (column: string, values: unknown[]) => {
        filters.push((row) => values.includes(row[column]));
        return query;
      },
      not: (column: string, operator: string, value: unknown) => {
        if (operator === "is" && value === null) filters.push((row) => read(row, column) != null);
        else if (operator === "like" && value === "local:*") {
          filters.push((row) => read(row, column) != null && !String(read(row, column)).startsWith("local:"));
        } else throw new Error(`unsupported not(${column}, ${operator})`);
        return query;
      },
      order: (key: string, options?: { ascending?: boolean }) => {
        order = { key, ascending: options?.ascending !== false };
        return query;
      },
      limit: (count: number) => {
        limit = count;
        return query;
      },
      single: async () => {
        const rows = result().data ?? [];
        return rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: "no rows" } };
      },
      maybeSingle: async () => ({ data: result().data?.[0] ?? null, error: null }),
      then: (resolve: any, reject: any) => settle().then(result).then(resolve, reject),
    };
    return query;
  }
  function hold(table: string) {
    let reached!: () => void;
    let commit!: () => void;
    const sent = new Promise<void>((resolve) => { reached = resolve; });
    holds.set(table, { reached, commit: new Promise<void>((resolve) => { commit = resolve; }) });
    return { sent, commit: () => commit() };
  }
  return { tables, from, hold, reset: () => {
    for (const key of Object.keys(tables)) delete tables[key];
    holds.clear();
    sequence = 0;
  } };
});

const fakes = vi.hoisted(() => ({
  games: [] as Array<{ id: number; date: string; homeTeamId: number; awayTeamId: number }>,
  // Games whose next pass writes an extra row, as if its player pool changed.
  strayRowGameIds: new Set<number>(),
  skaterCalls: [] as number[],
  stageMs: 20_000,
  // Keyed by the invocation's deadline: the value it writes, and where it pauses.
  plans: new Map<number, { value: number; pause?: "projection_write" | "sidecar"; paused?: () => void; resume?: Promise<void> }>(),
  skaterError: null as Error | null,
  snapshotError: null as Error | null,
}));

vi.mock("lib/supabase/server", () => ({ default: { from: db.from } }));
vi.mock("./pbpCompletenessServer", () => ({ hasCompleteStoredPbpGame: async () => true }));
vi.mock("./shiftChartCompletenessServer", () => ({
  classifyStoredShiftChartStrengthGame: async () => ({ status: "complete" }),
}));
vi.mock("./dailyBoardEvidence", () => ({ applyDailyBoardEvidence: () => ({}) }));
vi.mock("./stages/preflight-stage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./stages/preflight-stage")>()),
  runProjectionPreflightStage: async () => ({
    currentSeasonId: 20262027, games: fakes.games, teamIds: [], gameIds: fakes.games.map((game) => game.id),
    teamAbbreviationById: new Map(), playerAvailabilityMultiplier: new Map(), availabilityEventByPlayer: new Map(),
    roleEventByPlayer: new Map(), ppEventByPlayer: new Map(), dailyBoardEvidence: { assertions: [], conflicts: [] },
    goalieOverrideByTeamId: new Map(), gameMarketContextByGameId: new Map(), playerPropContextByGamePlayerKey: new Map(),
  }),
}));
// Each game takes `stageMs`; a game whose processing passes the deadline
// stops partway, as the real stage does, after writing some rows.
vi.mock("./stages/skater-stage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./stages/skater-stage")>()),
  runPerGameSkaterStage: async (args: {
    runId: string; asOfDate: string; game: { id: number; homeTeamId: number }; deadlineMs: number;
    playerPredictionOutputRows: Array<Record<string, unknown>>;
  }) => {
    fakes.skaterCalls.push(args.game.id);
    if (fakes.skaterError) throw fakes.skaterError;
    const plan = fakes.plans.get(args.deadlineMs);
    if (plan) {
      if (plan.pause === "projection_write") {
        plan.paused?.();
        await plan.resume;
      }
      const persistence = await vi.importActual<typeof import("./stages/persistence-stage")>("./stages/persistence-stage");
      const key = { run_id: args.runId, game_id: args.game.id, horizon_games: 1 };
      await persistence.persistForgePlayerProjectionRows([1, 2].map((player_id) => ({ ...key, player_id, proj_goals_es: plan.value })));
      await persistence.persistForgeTeamProjection({ ...key, team_id: args.game.homeTeamId, proj_goals_es: plan.value });
      args.playerPredictionOutputRows.push({
        snapshot_date: args.asOfDate, game_id: args.game.id, player_id: 1, model_name: "forge", model_version: "v2",
        prediction_scope: "pregame", metric_key: "goals", expected_value: plan.value,
      });
      return { playerRowsUpserted: 2, teamRowsUpserted: 1, timedOut: Date.now() > args.deadlineMs };
    }
    const players = fakes.strayRowGameIds.delete(args.game.id) ? [1, 2, 99] : [1, 2];
    const rows = db.tables.forge_player_projections ??= [];
    for (const player_id of players) {
      const key = { run_id: args.runId, game_id: args.game.id, player_id, horizon_games: 1 };
      const existing = rows.find((row) => Object.entries(key).every(([column, value]) => row[column] === value));
      if (existing) existing.proj_goals_es = 0.2;
      else rows.push({ ...key, proj_goals_es: 0.1 });
    }
    vi.setSystemTime(Date.now() + fakes.stageMs);
    return { playerRowsUpserted: players.length, teamRowsUpserted: 2, timedOut: Date.now() > args.deadlineMs };
  },
}));
// The in-memory client is not intercepted, so a captured run records no reads.
vi.mock("./inputCapture", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./inputCapture")>()),
  capturedReadReceipt: () => ({ synthetic: true }),
}));
vi.mock("./gameRevisions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./gameRevisions")>()),
  saveForgeInputSnapshot: async () => {
    if (fakes.snapshotError) throw fakes.snapshotError;
    return "snapshot-1";
  },
}));
vi.mock("./stages/goalie-stage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./stages/goalie-stage")>()),
  runPerGameGoalieStage: async (args: { deadlineMs: number }) => {
    // The goalie stage is the last step before the game's analytics sidecars.
    const plan = fakes.plans.get(args.deadlineMs);
    if (plan?.pause === "sidecar") {
      plan.paused?.();
      await plan.resume;
    }
    return { goalieRowsUpserted: 2, timedOut: false };
  },
}));

import { requireLatestSucceededRunId } from "./apiHelpers";
import { buildForgeInputProvenance } from "./calibrationEligibility";
import {
  RUN_LEASE_GRACE_MS,
  RUN_RESUME_MAX_AGE_MS,
  RUN_RESUME_VERSION,
  RUN_TAKEOVER_GRACE_MS,
  RUN_WRITE_SAFETY_MARGIN_MS,
  claimResumableRun,
  clearRunGameRows,
  createRun,
  runWithClaimedRunWrites,
  writeClaimedRun,
} from "./queries/run-lifecycle-queries";
import { runProjectionV2ForDate } from "./run-forge-projections";

const values = (table: string) => (db.tables[table] ?? []).map((row) => row.proj_goals_es ?? row.expected_value);

/** Starts an invocation that writes `value`, optionally pausing where `pause` says. */
function invoke(deadlineMs: number, value: number, pause?: "projection_write" | "sidecar") {
  let paused!: () => void;
  let resume!: () => void;
  const reachedPause = new Promise<void>((resolve) => { paused = resolve; });
  fakes.plans.set(deadlineMs, { value, pause, paused, resume: new Promise<void>((resolve) => { resume = resolve; }) });
  const run = runProjectionV2ForDate(date, { deadlineMs });
  // Observed by the test; keeps an expected rejection from going unhandled.
  run.catch(() => undefined);
  return { run, reachedPause, resume };
}

const date = "2026-10-20";
const start = Date.parse("2026-10-20T10:05:00.000Z");
const runs = () => db.tables.forge_runs ?? [];
const playerRows = (runId: string) =>
  (db.tables.forge_player_projections ?? []).filter((row) => row.run_id === runId)
    .map((row) => `${row.game_id}:${row.player_id}`).sort();

function seedRun(row: Row) {
  (db.tables.forge_runs ??= []).push({ as_of_date: date, git_sha: "a".repeat(40), updated_at: null, ...row });
}

// `released`: the owner stopped cleanly and released the lease; otherwise it was killed.
function seedPausedRun(args: {
  runId: string; owner: string; leaseExpiresAt: string; createdAt: string; completed: number[]; released?: boolean;
}) {
  seedRun({
    run_id: args.runId, status: "running", created_at: args.createdAt,
    metrics: {
      games: args.completed.length, player_rows: 2 * args.completed.length, team_rows: 2 * args.completed.length,
      goalie_rows: 2 * args.completed.length, warnings: [], data_quality: {},
      input_provenance: buildForgeInputProvenance(),
      resume: {
        version: RUN_RESUME_VERSION, scope_key: "h1:full", lease_owner: args.owner,
        lease_expires_at: args.leaseExpiresAt, completed_game_ids: args.completed, invocations: 1,
        released_by: args.released === false ? null : args.owner,
      },
    },
  });
}

beforeEach(() => {
  db.reset();
  fakes.games = [1, 2, 3, 4].map((id) => ({ id, date, homeTeamId: 10 + id, awayTeamId: 20 + id }));
  fakes.strayRowGameIds.clear();
  fakes.plans.clear();
  fakes.skaterError = null;
  fakes.snapshotError = null;
  fakes.skaterCalls = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(start);
  vi.stubEnv("STARTER_BOARD_CAPTURE_ENABLED", "false");
  // A hosted deployment: runs it makes are served (local runs are fenced).
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "a".repeat(40));
  vi.stubEnv("STARTER_BOARD_COMPUTE_ENABLED", "false");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("resumable FORGE projection run", () => {
  it("stops at the deadline, then a later call finishes the same run_id; readers keep the last succeeded run until then", async () => {
    seedRun({
      run_id: "earlier-succeeded", status: "succeeded", created_at: "2026-10-20T06:00:00.000Z",
      metrics: { input_provenance: buildForgeInputProvenance() },
    });
    // Game 3 is cut off partway and leaves a row its next pass will not write.
    fakes.strayRowGameIds.add(3);

    const first = await runProjectionV2ForDate(date, { deadlineMs: start + 50_000 });

    expect(first).toMatchObject({
      timedOut: true, gamesProcessed: 2, playerRowsUpserted: 4,
      resume: { resumed: false, invocations: 1, completedGames: 2, totalGames: 4, pendingGames: 2 },
    });
    const run = runs().find((row) => row.run_id === first.runId)!;
    expect(run.status).toBe("running");
    expect(run.metrics).toMatchObject({ games: 2, player_rows: 4, resume: { completed_game_ids: [1, 2] } });
    expect(run.metrics).not.toHaveProperty("finished_at");
    // The lease is released, so the next call can continue at once.
    expect(Date.parse(run.metrics.resume.lease_expires_at)).toBeLessThanOrEqual(Date.now());
    expect(await requireLatestSucceededRunId(date)).toBe("earlier-succeeded");

    vi.setSystemTime(start + 5 * 60_000);
    const second = await runProjectionV2ForDate(date, { deadlineMs: Date.now() + 200_000 });

    expect(second).toMatchObject({
      runId: first.runId, timedOut: false, gamesProcessed: 4, playerRowsUpserted: 8, goalieRowsUpserted: 8,
      resume: { resumed: true, invocations: 2, completedGames: 4, totalGames: 4, pendingGames: 0 },
    });
    expect(fakes.skaterCalls).toEqual([1, 2, 3, 3, 4]);
    expect(runs()).toHaveLength(2);
    expect(run.status).toBe("succeeded");
    expect(run.metrics).toMatchObject({
      games: 4, player_rows: 8, timed_out: false,
      // forge/players ranks full-slate runs first by this scope.
      execution_scope: { mode: "full_slate", requested_game_ids: [] },
      input_provenance: buildForgeInputProvenance(),
      resume: { completed_game_ids: [1, 2, 3, 4], invocations: 2 },
    });
    // One row per game and player; game 3's stray row from the cut-off pass is gone.
    expect(playerRows(first.runId)).toEqual(["1:1", "1:2", "2:1", "2:2", "3:1", "3:2", "4:1", "4:2"]);
    expect(await requireLatestSucceededRunId(date)).toBe(first.runId);
  });

  it.each([undefined, ""])("stamps an uncaptured localhost run local:unknown and keeps serving the released run (SHA env %j)", async (sha) => {
    for (const key of ["FORGE_CODE_VERSION", "VERCEL_GIT_COMMIT_SHA", "GIT_SHA"]) vi.stubEnv(key, sha);
    seedRun({
      run_id: "released-succeeded", status: "succeeded", created_at: "2026-10-20T06:00:00.000Z",
      metrics: { input_provenance: buildForgeInputProvenance() },
    });
    const result = await runProjectionV2ForDate(date, { deadlineMs: Date.now() + 200_000 });
    expect(runs().find((row) => row.run_id === result.runId)).toMatchObject({ status: "succeeded", git_sha: "local:unknown" });
    expect(await requireLatestSucceededRunId(date)).toBe("released-succeeded");
  });

  it("refuses a killed run while its lease holds and through the takeover grace, then takes it over", async () => {
    // A killed invocation: game 1 finished, game 2 was in flight, no release.
    seedPausedRun({
      runId: "killed-run", owner: "dead-owner", leaseExpiresAt: new Date(start + 60_000).toISOString(),
      createdAt: new Date(start - 4 * 60_000).toISOString(), completed: [1], released: false,
    });
    db.tables.forge_player_projections = [
      { run_id: "killed-run", game_id: 1, player_id: 1, horizon_games: 1 },
      { run_id: "killed-run", game_id: 1, player_id: 2, horizon_games: 1 },
      { run_id: "killed-run", game_id: 2, player_id: 99, horizon_games: 1 },
    ];

    await expect(runProjectionV2ForDate(date, { deadlineMs: start + 200_000 }))
      .rejects.toMatchObject({ code: "ACTIVE_RUN_EXISTS", statusCode: 409, resumeInProgress: true });
    expect(runs()).toHaveLength(1);
    expect(fakes.skaterCalls).toEqual([]);

    // Expired but unreleased: a write it sent may still land, so wait out the grace.
    vi.setSystemTime(start + 60_000 + RUN_TAKEOVER_GRACE_MS - 1);
    await expect(runProjectionV2ForDate(date, { deadlineMs: Date.now() + 200_000 }))
      .rejects.toMatchObject({ code: "ACTIVE_RUN_EXISTS", statusCode: 409, resumeInProgress: true });
    expect(fakes.skaterCalls).toEqual([]);

    vi.setSystemTime(start + 60_000 + RUN_TAKEOVER_GRACE_MS);
    const result = await runProjectionV2ForDate(date, { deadlineMs: Date.now() + 200_000 });

    expect(result).toMatchObject({ runId: "killed-run", timedOut: false, resume: { resumed: true, invocations: 2 } });
    expect(fakes.skaterCalls).toEqual([2, 3, 4]);
    expect(runs()).toHaveLength(1);
    expect(runs()[0]).toMatchObject({ status: "succeeded", metrics: { games: 4, resume: { completed_game_ids: [1, 2, 3, 4] } } });
    expect(playerRows("killed-run")).toEqual(["1:1", "1:2", "2:1", "2:2", "3:1", "3:2", "4:1", "4:2"]);
  });

  it.each([
    ["hosted", "hosted", true],
    ["hosted", "local", false],
    ["local", "hosted", false],
    ["local", "local", true],
  ] as const)("a %s invocation meeting a paused %s run resumes it only when both match: %s", async (invocation, paused, resumes) => {
    // Hosted runs need not share a deployment SHA, only the release side.
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", invocation === "hosted" ? "b".repeat(40) : "");
    vi.stubEnv("GIT_SHA", "");
    seedPausedRun({
      runId: "paused-run", owner: "dead-owner", leaseExpiresAt: new Date(start - 1_000).toISOString(),
      createdAt: new Date(start - 4 * 60_000).toISOString(), completed: [1],
    });
    const pausedSha = paused === "hosted" ? "a".repeat(40) : "local:unknown";
    runs()[0].git_sha = pausedSha;

    const result = await runProjectionV2ForDate(date, { deadlineMs: Date.now() + 200_000 });
    const pausedRow = runs().find((row) => row.run_id === "paused-run")!;
    if (resumes) {
      expect(result).toMatchObject({ runId: "paused-run", resume: { resumed: true, invocations: 2 } });
      expect(pausedRow).toMatchObject({ status: "succeeded", git_sha: pausedSha });
      expect(runs()).toHaveLength(1);
    } else {
      // The other side's paused run is neither adopted nor failed: it waits for its own resume.
      expect(result).toMatchObject({ resume: { resumed: false, invocations: 1 } });
      expect(result.runId).not.toBe("paused-run");
      expect(runs().find((row) => row.run_id === result.runId)).toMatchObject({
        status: "succeeded", git_sha: invocation === "hosted" ? "b".repeat(40) : "local:unknown",
      });
      expect(pausedRow).toMatchObject({ status: "running", git_sha: pausedSha,
        metrics: { resume: { lease_owner: "dead-owner", invocations: 1, completed_game_ids: [1] } } });
      expect(fakes.skaterCalls).toEqual([1, 2, 3, 4]);
    }
  });

  it("fences the previous owner and a second claimer once a run is taken over", async () => {
    seedPausedRun({
      runId: "killed-run", owner: "dead-owner", leaseExpiresAt: new Date(start - RUN_TAKEOVER_GRACE_MS).toISOString(),
      createdAt: new Date(start - 4 * 60_000).toISOString(), completed: [1], released: false,
    });
    const leaseExpiresAt = new Date(start + 240_000).toISOString();

    // Both read the paused run before either takes it; only one may win.
    const [first, second] = await Promise.allSettled([
      claimResumableRun(date, { scopeKey: "h1:full", leaseExpiresAt }),
      claimResumableRun(date, { scopeKey: "h1:full", leaseExpiresAt }),
    ]);
    expect(first.status).toBe("fulfilled");
    expect(second).toMatchObject({
      status: "rejected", reason: { code: "ACTIVE_RUN_EXISTS", resumeInProgress: true },
    });
    const claim = (first as PromiseFulfilledResult<Awaited<ReturnType<typeof claimResumableRun>>>).value;
    expect(claim).toMatchObject({ runId: "killed-run", resumed: true, invocations: 2, completedGameIds: [1] });

    // A late write from the killed invocation cannot touch the run it lost.
    await expect(writeClaimedRun({ ...claim, leaseOwner: "dead-owner" }, {
      status: "failed", metrics: {}, completedGameIds: [1, 2],
    })).rejects.toMatchObject({ code: "RUN_LEASE_LOST" });
    expect(runs()[0]).toMatchObject({
      status: "running", metrics: { resume: { lease_owner: claim.leaseOwner, completed_game_ids: [1] } },
    });
    // Its output cleanup is refused by ownership, though its own lease clock has not run out.
    db.tables.forge_player_projections = [{ run_id: "killed-run", game_id: 2, player_id: 1, horizon_games: 1 }];
    await expect(runWithClaimedRunWrites({ ...claim, leaseOwner: "dead-owner" }, () => clearRunGameRows("killed-run", [2])))
      .rejects.toMatchObject({ code: "RUN_LEASE_LOST" });
    expect(db.tables.forge_player_projections).toHaveLength(1);

    await writeClaimedRun(claim, { status: "running", metrics: {}, completedGameIds: [1, 2] });
    expect(runs()[0].metrics.resume.completed_game_ids).toEqual([1, 2]);
    expect(runs()).toHaveLength(1);
  });

  it("does not hand over a killed invocation's run while a write it sent may still land", async () => {
    fakes.games = [{ id: 1, date, homeTeamId: 11, awayTeamId: 21 }];
    const held = db.hold("forge_player_projections");
    // A's lease runs to its deadline + 60 s; its first write is sent but not yet committed.
    const a = invoke(start + 1_000, 0.1);
    await held.sent;
    const runId = runs()[0].run_id;

    // A's lease has expired without a release: B must wait rather than adopt the run.
    vi.setSystemTime(start + 1_000 + RUN_LEASE_GRACE_MS + 1_000);
    await expect(invoke(Date.now() + 200_000, 0.9).run)
      .rejects.toMatchObject({ code: "ACTIVE_RUN_EXISTS", resumeInProgress: true });

    // A's write lands late; A then writes nothing more on its expired lease.
    held.commit();
    await expect(a.run).rejects.toMatchObject({ code: "RUN_LEASE_LOST" });
    expect(values("forge_player_projections")).toEqual([0.1, 0.1]);
    expect(db.tables.forge_team_projections ?? []).toEqual([]);

    vi.setSystemTime(start + 1_000 + RUN_LEASE_GRACE_MS + RUN_TAKEOVER_GRACE_MS);
    const b = await invoke(Date.now() + 200_000, 0.9).run;

    expect(b).toMatchObject({ runId, timedOut: false, resume: { resumed: true, invocations: 2, completedGames: 1 } });
    expect(runs()).toHaveLength(1);
    expect(runs()[0]).toMatchObject({ status: "succeeded", metrics: { resume: { completed_game_ids: [1] } } });
    expect(values("forge_player_projections")).toEqual([0.9, 0.9]);
    expect(values("forge_team_projections")).toEqual([0.9]);
    expect(values("player_prediction_outputs")).toEqual([0.9]);
  });

  it("sends no write once the invocation is past its write deadline, even before any takeover", async () => {
    fakes.games = [{ id: 1, date, homeTeamId: 11, awayTeamId: 21 }];
    const a = invoke(start + 1_000, 0.1, "projection_write");
    await a.reachedPause;
    const runId = runs()[0].run_id;

    // Still A's lease (deadline + 60 s), but inside the safety margin before it expires.
    vi.setSystemTime(start + 1_000 + RUN_LEASE_GRACE_MS - RUN_WRITE_SAFETY_MARGIN_MS);
    a.resume();
    await expect(a.run).rejects.toMatchObject({ code: "RUN_LEASE_LOST" });
    expect(db.tables.forge_player_projections ?? []).toEqual([]);
    expect(db.tables.forge_team_projections ?? []).toEqual([]);
    // A was not released, so the run waits out the grace before anyone adopts it.
    expect(runs()[0]).toMatchObject({ status: "running", metrics: { resume: { released_by: null } } });

    vi.setSystemTime(start + 1_000 + RUN_LEASE_GRACE_MS + RUN_TAKEOVER_GRACE_MS);
    expect(await invoke(Date.now() + 200_000, 0.9).run).toMatchObject({ runId, timedOut: false, resume: { resumed: true } });
    expect(values("forge_player_projections")).toEqual([0.9, 0.9]);
  });

  it.each(["projection_write", "sidecar"] as const)(
    "an invocation whose run was taken over during a pause writes nothing at its %s", async (pause) => {
      fakes.games = [{ id: 1, date, homeTeamId: 11, awayTeamId: 21 }];
      const a = invoke(start + 1_000, 0.1, pause);
      await a.reachedPause;
      const runId = runs()[0].run_id;

      // A stays paused past its lease and the takeover grace; B takes the run and finishes it.
      vi.setSystemTime(start + 1_000 + RUN_LEASE_GRACE_MS + RUN_TAKEOVER_GRACE_MS);
      const b = await invoke(Date.now() + 200_000, 0.9).run;
      expect(b).toMatchObject({ runId, timedOut: false, resume: { resumed: true, invocations: 2 } });
      const sidecarGame = structuredClone(db.tables.game_prediction_outputs);

      a.resume();
      await expect(a.run).rejects.toMatchObject({ code: "RUN_LEASE_LOST" });

      // B's rows and its date/game-scoped sidecars are untouched by A.
      expect(runs()[0]).toMatchObject({ status: "succeeded", metrics: { resume: { completed_game_ids: [1] } } });
      expect(values("forge_player_projections")).toEqual([0.9, 0.9]);
      expect(values("forge_team_projections")).toEqual([0.9]);
      expect(values("player_prediction_outputs")).toEqual([0.9]);
      expect(db.tables.game_prediction_outputs).toEqual(sidecarGame);
    });

  describe("captured run (Starter Board capture on, compute off)", () => {
    beforeEach(() => vi.stubEnv("STARTER_BOARD_CAPTURE_ENABLED", "true"));

    it("keeps a succeeded run succeeded when the later input-snapshot save fails, and reports the step", async () => {
      fakes.snapshotError = new Error("<!DOCTYPE html><html><title>supabase.co | 520</title></html>");

      const result = await runProjectionV2ForDate(date, { deadlineMs: start + 200_000 });

      expect(result).toMatchObject({
        timedOut: false, gamesProcessed: 4,
        postRunFailure: { step: "save_input_snapshot", message: expect.stringContaining("<!DOCTYPE html>") },
      });
      expect(result).not.toHaveProperty("inputSnapshotId");
      // Capture runs single-call (no resume lease) and finalize before the snapshot.
      expect(result).not.toHaveProperty("resume");
      expect(runs()).toHaveLength(1);
      expect(runs()[0]).toMatchObject({ run_id: result.runId, status: "succeeded", metrics: { games: 4 } });
      expect(runs()[0].metrics).not.toHaveProperty("error");
    });

    it("still fails the run when the projection itself fails", async () => {
      fakes.skaterError = new Error("integer cast");

      await expect(runProjectionV2ForDate(date, { deadlineMs: start + 200_000 })).rejects.toThrow("integer cast");

      expect(runs()).toHaveLength(1);
      expect(runs()[0]).toMatchObject({ status: "failed", metrics: { error: "integer cast", publication_failed: true } });
    });
  });

  it("fails a paused run past the resume age and starts a new one", async () => {
    seedPausedRun({
      runId: "old-run", owner: "old-owner", leaseExpiresAt: new Date(start - RUN_RESUME_MAX_AGE_MS).toISOString(),
      createdAt: new Date(start - RUN_RESUME_MAX_AGE_MS - 60_000).toISOString(), completed: [1, 2],
    });

    const result = await runProjectionV2ForDate(date, { deadlineMs: start + 200_000 });

    expect(result.runId).not.toBe("old-run");
    expect(result.resume).toMatchObject({ resumed: false, completedGames: 4 });
    expect(fakes.skaterCalls).toEqual([1, 2, 3, 4]);
    expect(runs().map((row) => [row.run_id, row.status])).toEqual([["old-run", "failed"], [result.runId, "succeeded"]]);
  });

  it("keeps a paused run for its next call when a non-resumable run starts on the same date", async () => {
    seedPausedRun({
      runId: "paused-run", owner: "paused-owner", leaseExpiresAt: new Date(start - 1_000).toISOString(),
      createdAt: new Date(start - 30 * 60_000).toISOString(), completed: [1],
    });

    const runId = await createRun(date);

    expect(runs().map((row) => [row.run_id, row.status])).toEqual([["paused-run", "running"], [runId, "running"]]);
  });
});
