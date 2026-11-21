// @vitest-environment node
/**
 * Compute-off parity: production runs FORGE with STARTER_BOARD_COMPUTE_ENABLED off, on the uncaptured, resumable
 * path (claimResumableRun / writeClaimedRun). Each scenario wraps that writer call in a plain input capture (no
 * suppressWrites, so the RPC path is used) to record its reads and writes. The oracle in oracle/compute-off was recorded
 * by this file run inside a `git archive 52c3b6919 web` export (the unmodified writer); RECORD_FORGE_ORACLE=1 writes it.
 * Never re-record it from a changed writer. One TJ-approved re-record (2026-11-15, trend-band reader integration)
 * changed only the trend read and the renamed counter: tasks/artifacts/forge-pregame-capture-2026-11-14/trend-band-reader/
 * ORACLE-DIFF-20261115.md.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { captureProjectionInputs, projectionInputHash, type ProjectionInputRead } from "lib/projections/inputCapture";
import { projectionWritesHash } from "lib/projections/gameRevisions";
import { activateWorld, FROZEN_NOW, withScenarioEnv, type ScenarioEnv } from "./harness";
import { candidatesFromWrites } from "./scenarios";
import { readTokens } from "./readOrder";
import { buildLeague, TARGET, type LeagueOptions } from "../__fixtures__/world/league";

const uuid = vi.hoisted(() => ({ next: 0 }));
vi.mock("node:crypto", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:crypto")>()),
  // Lease owners are random in production; a counter keeps the recorded lifecycle writes reproducible.
  randomUUID: () => `00000000-0000-4000-9000-${String(++uuid.next).padStart(12, "0")}`,
}));
vi.mock("lib/supabase/server", async () => (await import("./harness")).worldServerModule());

type Operation = { method: string; args: unknown[] };
type Scenario = { name: string; world: LeagueOptions; env: ScenarioEnv; resume?: boolean };
type Invocation = { result: unknown; reads: Array<{ request: Operation[]; resultHash: string; failure?: string }>; writes: Array<{ table: string; hash: string }> };
type ComputeOffOracle = {
  version: "forge-load-split-compute-off-oracle-v1"; scenario: string; frozenNow: string;
  invocations: Invocation[]; outputHash: string; candidates: ReturnType<typeof candidatesFromWrites>;
};

const COMPUTE_OFF: ScenarioEnv = { STARTER_BOARD_COMPUTE_ENABLED: "false", VERCEL_GIT_COMMIT_SHA: undefined, GIT_SHA: undefined };
export const COMPUTE_OFF_SCENARIOS: Scenario[] = [
  { name: "compute-off-normal-one-game", world: {}, env: COMPUTE_OFF },
  { name: "compute-off-reserve-pass-on", world: {}, env: { ...COMPUTE_OFF, FORGE_RESERVE_PASS_ENABLED: "true" } },
  { name: "compute-off-goalie-override-multi-candidate", world: { awayGoalieOverride: true, homeThreeGoalies: true, homeForwardOut: true },
    env: { ...COMPUTE_OFF, FORGE_RESERVE_PASS_ENABLED: "true" } },
  // Compute off keeps the top-two starter scenarios; the model still ranks the backup first here.
  { name: "compute-off-goalie-model-reorders-candidates", world: { homeBackToBack: true }, env: { ...COMPUTE_OFF, FORGE_RESERVE_PASS_ENABLED: "true" } },
  // Deadline passes after the home team's rows are written; the next invocation resumes the run and redoes the game.
  { name: "compute-off-resumed-run", world: {}, env: COMPUTE_OFF, resume: true },
];
/** Only the per-goalie input block may reorder (Chef decision e3b2a0beb). */
const GOALIE_REORDER_SCENARIOS = new Set(["compute-off-goalie-model-reorders-candidates"]);

const ORACLE_DIR = join(__dirname, "..", "__fixtures__", "world", "oracle", "compute-off");
const RECORD = process.env.RECORD_FORGE_ORACLE === "1";

const recordReads = (reads: ProjectionInputRead[]) => reads.map((read) => ({ request: read.request as Operation[],
  resultHash: projectionInputHash(read.result ?? null), ...(read.failure ? { failure: read.failure } : {}) }));

/** Check the new success protocol, then compare every pre-existing write with its frozen hash. */
function verifySuccessWrites(writes: Operation[][], runId: string, invocationCutoff: string): Operation[][] {
  // In these one-game fixtures the clock stays fixed throughout the successful invocation.
  const [checkpoint, success] = structuredClone(writes.slice(-3, -1));
  const successRow = success[1].args[0] as { metrics: Record<string, unknown> };
  expect(writes.at(-1)).toStrictEqual([
    { method: "from", args: ["forge_runs"] },
    { method: "update", args: [{ metrics: { ...successRow.metrics, succeeded_observed_at: invocationCutoff } }] },
    { method: "eq", args: ["run_id", runId] },
    { method: "eq", args: ["status", "succeeded"] },
    { method: "eq", args: ["updated_at", invocationCutoff] },
    { method: "is", args: ["metrics->>succeeded_observed_at", null] },
    { method: "select", args: ["run_id"] },
  ]);

  for (const ops of [checkpoint, success]) {
    const row = ops[1].args[0] as { metrics: Record<string, unknown> };
    expect(row.metrics.decision_as_of_by_game).toStrictEqual({ [TARGET.gameId]: invocationCutoff });
    delete row.metrics.decision_as_of_by_game;
  }
  return [...writes.slice(0, -3), checkpoint, success];
}

async function runComputeOff(scenario: Scenario): Promise<ComputeOffOracle> {
  uuid.next = 0;
  const world = buildLeague(scenario.world);
  let runs = 0;
  world.mutable = {
    forge_runs: (row) => ({ run_id: `00000000-0000-4000-8000-${String(++runs).padStart(12, "0")}`,
      created_at: new Date().toISOString(), updated_at: null, ...row }),
  };
  if (scenario.resume) {
    let fired = false;
    world.onWrite = (table, _method, rows) => {
      if (fired || table !== "forge_team_projections" || !rows.some((row) => row.team_id === TARGET.homeTeamId)) return;
      fired = true;
      vi.setSystemTime(Date.now() + 31_000);
    };
  }
  activateWorld(world);
  const { runProjectionV2ForDate } = await import("lib/projections/run-forge-projections");
  const invocations: Invocation[] = [];
  const allWrites: Operation[][] = [];
  await withScenarioEnv(scenario.env, async () => {
    const invoke = async (deadlineMs: number) => {
      // Full slate, no cutoff: the shape of the production compute-off route call.
      const invocationCutoff = new Date().toISOString();
      const run = await captureProjectionInputs(() => runProjectionV2ForDate(TARGET.slateDate, { horizonGames: 1, deadlineMs }));
      const comparedWrites = RECORD || run.result.timedOut ? run.writes
        : verifySuccessWrites(run.writes, run.result.runId, invocationCutoff);
      invocations.push({ result: JSON.parse(JSON.stringify(run.result)), reads: recordReads(run.reads),
        writes: comparedWrites.map((ops) => ({ table: String(ops[0]?.args[0]), hash: projectionInputHash(ops) })) });
      allWrites.push(...run.writes);
    };
    await invoke(Date.now() + (scenario.resume ? 30_000 : 600_000));
    if (scenario.resume) {
      vi.setSystemTime(Date.now() + 120_000);
      await invoke(Date.now() + 600_000);
    }
  });
  return { version: "forge-load-split-compute-off-oracle-v1", scenario: scenario.name, frozenNow: FROZEN_NOW, invocations,
    outputHash: projectionWritesHash(allWrites), candidates: candidatesFromWrites(allWrites) };
}

describe("compute-off writer (uncaptured, resumable path) against its recorded oracle", () => {
  for (const scenario of COMPUTE_OFF_SCENARIOS) {
    it(`${scenario.name}: reads, writes and results match`, async () => {
      const record = await runComputeOff(scenario);
      if (RECORD) {
        if (!existsSync(ORACLE_DIR)) mkdirSync(ORACLE_DIR, { recursive: true });
        writeFileSync(join(ORACLE_DIR, `${scenario.name}.json`), `${JSON.stringify(record, null, 1)}\n`);
        return;
      }
      const oracle: ComputeOffOracle = JSON.parse(readFileSync(join(ORACLE_DIR, `${scenario.name}.json`), "utf8"));
      expect(record.invocations).toHaveLength(oracle.invocations.length);
      record.invocations.forEach((invocation, index) => {
        const expected = oracle.invocations[index];
        expect(invocation.result).toEqual(expected.result);
        expect(invocation.writes).toEqual(expected.writes);
        expect(readTokens(invocation.reads)).toEqual(readTokens(expected.reads));
        if (!GOALIE_REORDER_SCENARIOS.has(scenario.name)) expect(invocation.reads).toEqual(expected.reads);
      });
      if (GOALIE_REORDER_SCENARIOS.has(scenario.name)) {
        expect(record.invocations.map((invocation) => invocation.reads)).not.toEqual(oracle.invocations.map((invocation) => invocation.reads));
      }
      expect(record.outputHash).toBe(oracle.outputHash);
      expect(record.candidates).toEqual(oracle.candidates);
    });
  }

  it.skipIf(RECORD)("the resumed run timed out once, then resumed and finished the game", () => {
    const oracle: ComputeOffOracle = JSON.parse(readFileSync(join(ORACLE_DIR, "compute-off-resumed-run.json"), "utf8"));
    const [first, second] = oracle.invocations.map((invocation) => invocation.result as Record<string, any>);
    expect(first).toMatchObject({ timedOut: true, resume: { resumed: false, completedGames: 0 } });
    expect(second).toMatchObject({ timedOut: false, gamesProcessed: 1, resume: { resumed: true, invocations: 2, completedGames: 1 } });
  });
});
