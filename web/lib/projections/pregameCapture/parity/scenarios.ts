/**
 * Parity scenarios and the oracle format. The oracle was recorded by driving the unmodified writer
 * (`runProjectionV2ForDate`, captured path) against the fixture world with a frozen clock.
 */
import { projectionInputHash, type ProjectionInputRead } from "lib/projections/inputCapture";
import { projectionWritesHash } from "lib/projections/gameRevisions";
import { buildLeague, TARGET, type LeagueOptions } from "../__fixtures__/world/league";
import type { World } from "../__fixtures__/world/store";
import { FROZEN_NOW, activateWorld, withScenarioEnv, writerCaptures, type ScenarioEnv } from "./harness";

type Operation = { method: string; args: unknown[] };

export type Scenario = {
  name: string;
  world: LeagueOptions;
  env: ScenarioEnv;
  /** Omitted only for season bootstrap, which the writer applies to live runs without an explicit cutoff. */
  decisionAsOf?: string;
};

export const CUTOFF = "2026-11-14T19:55:00.000Z";

export const SCENARIOS: Scenario[] = [
  { name: "normal-one-game", world: {}, env: {}, decisionAsOf: CUTOFF },
  { name: "skater-pool-recovery", world: { thinHomePool: true }, env: {}, decisionAsOf: CUTOFF },
  { name: "season-bootstrap", world: { seasonOpening: true, awayGoalieOverride: true },
    env: { STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED: "true" } },
  { name: "reserve-pass-on", world: {}, env: { FORGE_RESERVE_PASS_ENABLED: "true" }, decisionAsOf: CUTOFF },
  { name: "target-pbp-pregame", world: { targetPbpPregameRow: true }, env: {}, decisionAsOf: CUTOFF },
  { name: "goalie-override-multi-candidate", world: { awayGoalieOverride: true, homeThreeGoalies: true, homeForwardOut: true },
    env: { FORGE_RESERVE_PASS_ENABLED: "true" }, decisionAsOf: CUTOFF },
  { name: "opponent-shots-gate", world: { awayNoLineup: true }, env: {}, decisionAsOf: CUTOFF },
  { name: "goalie-model-reorders-candidates", world: { homeBackToBack: true }, env: { FORGE_RESERVE_PASS_ENABLED: "true" }, decisionAsOf: CUTOFF },
  { name: "lineup-evidence-gate", world: { homeLineupEvidence: true }, env: { FORGE_RESERVE_PASS_ENABLED: "true" }, decisionAsOf: CUTOFF },
];

export type CandidateSets = {
  skaters: Record<string, number[]>;
  goalies: Record<string, number[]>;
  reserves: Record<string, number[]>;
};

export type OracleRecord = {
  version: "forge-load-split-oracle-v1";
  scenario: string;
  frozenNow: string;
  reads: Array<{ request: Operation[]; resultHash: string; failure?: string }>;
  writes: Array<{ table: string; hash: string }>;
  outputHash: string;
  candidates: CandidateSets;
};

const byTeam = (rows: Array<{ team: number; id: number }>) => {
  const out: Record<string, number[]> = {};
  for (const { team, id } of rows) (out[String(team)] ??= []).push(id);
  for (const ids of Object.values(out)) ids.sort((a, b) => a - b);
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => Number(a) - Number(b)));
};

const rowsOf = (writes: Operation[][], table: string): any[] => writes
  .filter((ops) => ops[0]?.args[0] === table)
  .flatMap((ops) => {
    const write = ops.find((op) => op.method === "upsert" || op.method === "insert");
    return Array.isArray(write?.args[0]) ? write!.args[0] as any[] : write ? [write.args[0]] : [];
  });

/** Candidate sets visible in the writer's output: lineup rows, reserve rows and each team's goalie candidates. */
export function candidatesFromWrites(writes: Operation[][]): CandidateSets {
  const reserves = rowsOf(writes, "forge_reserve_projections");
  return {
    skaters: byTeam(rowsOf(writes, "forge_player_projections").map((row) => ({ team: row.team_id, id: row.player_id }))),
    goalies: byTeam(rowsOf(writes, "forge_goalie_projections").flatMap((row) =>
      ((row.uncertainty?.goalie_candidates?.rows ?? []) as Array<{ goalie_id: number }>).map((c) => ({ team: row.team_id, id: c.goalie_id })))),
    reserves: byTeam(reserves.map((row) => ({ team: row.team_id, id: row.player_id }))),
  };
}

export function oracleRecord(scenario: string, reads: ProjectionInputRead[], writes: Operation[][]): OracleRecord {
  return {
    version: "forge-load-split-oracle-v1",
    scenario,
    frozenNow: FROZEN_NOW,
    reads: reads.map((read) => ({ request: read.request as Operation[], resultHash: projectionInputHash(read.result ?? null),
      ...(read.failure ? { failure: read.failure } : {}) })),
    writes: writes.map((ops) => ({ table: String(ops[0]?.args[0]), hash: projectionInputHash(ops) })),
    outputHash: projectionWritesHash(writes),
    candidates: candidatesFromWrites(writes),
  };
}

/** Runs the production writer on the captured path for one scenario and returns its own capture. */
export async function runWriterScenario(scenario: Scenario, mutate?: (world: World) => void) {
  const world = buildLeague(scenario.world);
  mutate?.(world);
  activateWorld(world);
  const { runProjectionV2ForDate } = await import("lib/projections/run-forge-projections");
  writerCaptures.length = 0;
  const result = await withScenarioEnv(scenario.env, () => runProjectionV2ForDate(TARGET.slateDate, {
    gameIds: [TARGET.gameId], horizonGames: 1, ...(scenario.decisionAsOf ? { decisionAsOf: scenario.decisionAsOf } : {}),
  }));
  if (writerCaptures.length !== 1) throw new Error(`expected one writer capture, saw ${writerCaptures.length}`);
  return { result, ...writerCaptures[0] };
}
