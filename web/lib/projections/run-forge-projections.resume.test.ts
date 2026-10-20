// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Resumable FORGE runs: one run_id per date across invocations, with the
 * per-game stages faked. Only the forge_runs lifecycle and the projection
 * tables are simulated, in memory, with the filters the code uses.
 */
type Row = Record<string, any>;

const db = vi.hoisted(() => {
  const tables: Record<string, Row[]> = {};
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
    let operation: "select" | "insert" | "update" | "delete" = "select";
    let patch: Row = {};
    let inserted: Row[] = [];
    let returning = false;
    let order: { key: string; ascending: boolean } | null = null;
    let limit = Number.POSITIVE_INFINITY;
    const execute = () => {
      if (operation === "insert") return inserted;
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
    const result = () => {
      const rows = execute();
      return { data: operation === "select" || returning ? structuredClone(rows) : null, error: null };
    };
    const query: any = {
      select: () => {
        if (operation !== "select") returning = true;
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
      then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject),
    };
    return query;
  }
  return { tables, from, reset: () => { for (const key of Object.keys(tables)) delete tables[key]; sequence = 0; } };
});

const fakes = vi.hoisted(() => ({
  games: [] as Array<{ id: number; date: string; homeTeamId: number; awayTeamId: number }>,
  // Games whose next pass writes an extra row, as if its player pool changed.
  strayRowGameIds: new Set<number>(),
  skaterCalls: [] as number[],
  stageMs: 20_000,
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
  runPerGameSkaterStage: async (args: { runId: string; game: { id: number }; deadlineMs: number }) => {
    fakes.skaterCalls.push(args.game.id);
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
vi.mock("./stages/goalie-stage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./stages/goalie-stage")>()),
  runPerGameGoalieStage: async () => ({ goalieRowsUpserted: 2, timedOut: false }),
}));
vi.mock("./stages/persistence-stage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./stages/persistence-stage")>()),
  persistPerGameAnalyticsOutputs: async () => undefined,
}));

import { requireLatestSucceededRunId } from "./apiHelpers";
import { buildForgeInputProvenance } from "./calibrationEligibility";
import {
  RUN_RESUME_MAX_AGE_MS,
  RUN_RESUME_VERSION,
  claimResumableRun,
  createRun,
  writeClaimedRun,
} from "./queries/run-lifecycle-queries";
import { runProjectionV2ForDate } from "./run-forge-projections";

const date = "2026-10-20";
const start = Date.parse("2026-10-20T10:05:00.000Z");
const runs = () => db.tables.forge_runs ?? [];
const playerRows = (runId: string) =>
  (db.tables.forge_player_projections ?? []).filter((row) => row.run_id === runId)
    .map((row) => `${row.game_id}:${row.player_id}`).sort();

function seedRun(row: Row) {
  (db.tables.forge_runs ??= []).push({ as_of_date: date, git_sha: "a".repeat(40), updated_at: null, ...row });
}

function seedPausedRun(args: { runId: string; owner: string; leaseExpiresAt: string; createdAt: string; completed: number[] }) {
  seedRun({
    run_id: args.runId, status: "running", created_at: args.createdAt,
    metrics: {
      games: args.completed.length, player_rows: 2 * args.completed.length, team_rows: 2 * args.completed.length,
      goalie_rows: 2 * args.completed.length, warnings: [], data_quality: {},
      input_provenance: buildForgeInputProvenance(),
      resume: {
        version: RUN_RESUME_VERSION, scope_key: "h1:full", lease_owner: args.owner,
        lease_expires_at: args.leaseExpiresAt, completed_game_ids: args.completed, invocations: 1,
      },
    },
  });
}

beforeEach(() => {
  db.reset();
  fakes.games = [1, 2, 3, 4].map((id) => ({ id, date, homeTeamId: 10 + id, awayTeamId: 20 + id }));
  fakes.strayRowGameIds.clear();
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

  it("refuses a run whose lease is still held, then takes it over once the lease expires", async () => {
    // A killed invocation: game 1 finished, game 2 was in flight, no release.
    seedPausedRun({
      runId: "killed-run", owner: "dead-owner", leaseExpiresAt: new Date(start + 60_000).toISOString(),
      createdAt: new Date(start - 4 * 60_000).toISOString(), completed: [1],
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

    vi.setSystemTime(start + 2 * 60_000);
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
      runId: "killed-run", owner: "dead-owner", leaseExpiresAt: new Date(start - 1_000).toISOString(),
      createdAt: new Date(start - 4 * 60_000).toISOString(), completed: [1],
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

    await writeClaimedRun(claim, { status: "running", metrics: {}, completedGameIds: [1, 2] });
    expect(runs()[0].metrics.resume.completed_game_ids).toEqual([1, 2]);
    expect(runs()).toHaveLength(1);
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
