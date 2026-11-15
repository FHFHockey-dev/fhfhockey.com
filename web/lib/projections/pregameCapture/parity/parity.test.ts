// @vitest-environment node
/**
 * Offline parity for the FORGE load/compute split. Every scenario runs the production writer on its captured
 * path against the fixture world with a frozen clock. Set RECORD_FORGE_ORACLE=1 only to record the oracle,
 * which was done once on the unmodified writer; the oracle files must never be re-recorded to fit a change.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { projectionInputHash } from "lib/projections/inputCapture";
import { oracleRecord, runWriterScenario, SCENARIOS, type OracleRecord } from "./scenarios";
import type { World } from "../__fixtures__/world/store";

vi.mock("lib/supabase/server", async () => (await import("./harness")).worldServerModule());
vi.mock("lib/projections/inputCapture", async (importOriginal) => {
  const original = await importOriginal<typeof import("lib/projections/inputCapture")>();
  const { writerCaptures } = await import("./harness");
  return { ...original, captureProjectionInputs: async (work: any, options: any) => {
    const result = await original.captureProjectionInputs(work, options);
    writerCaptures.push({ reads: result.reads, writes: result.writes });
    return result;
  } };
});
vi.mock("lib/projections/gameRevisions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("lib/projections/gameRevisions")>()),
  saveForgeInputSnapshot: async () => "fixture-snapshot",
  publishForgeGameRevisions: async () => 1,
}));

const ORACLE_DIR = join(__dirname, "..", "__fixtures__", "world", "oracle");
const RECORD = process.env.RECORD_FORGE_ORACLE === "1";
const loadOracle = (name: string): OracleRecord => JSON.parse(readFileSync(join(ORACLE_DIR, `${name}.json`), "utf8"));
/** Result hashes of an empty page in each shape the readers receive. */
const EMPTY_RESULT_HASHES = new Set([null, 0].flatMap((count) => [[], null].flatMap((data) => [200].map((status) =>
  projectionInputHash({ data, error: null, count, status }))))
  .concat([projectionInputHash({ data: [], error: null, count: null, status: 200 }), projectionInputHash({ data: null, error: null, count: null, status: 200 })]));

describe("FORGE writer against the recorded oracle", () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.name}: reads and writes match exactly`, async () => {
      const run = await runWriterScenario(scenario);
      const record = oracleRecord(scenario.name, run.reads, run.writes);
      if (RECORD) {
        if (!existsSync(ORACLE_DIR)) mkdirSync(ORACLE_DIR, { recursive: true });
        writeFileSync(join(ORACLE_DIR, `${scenario.name}.json`), `${JSON.stringify(record, null, 1)}\n`);
        return;
      }
      const oracle = loadOracle(scenario.name);
      expect(record.reads.length).toBe(oracle.reads.length);
      expect(record.reads).toEqual(oracle.reads);
      expect(record.writes).toEqual(oracle.writes);
      expect(record.outputHash).toBe(oracle.outputHash);
      expect(record.candidates).toEqual(oracle.candidates);
    });
  }
});

/** Relations the fixture leaves empty on purpose; every other read relation must return rows in some scenario. */
const INTENTIONALLY_EMPTY: Record<string, string> = {
  market_prices_daily: "markets feed output flags only, never projections",
  prop_market_prices_daily: "markets feed output flags only, never projections",
  pbp_plays: "the target game is pregame: no plays may exist",
  nst_team_stats: "fallback read only when nst_team_all has no row",
  player_forecast_goalie_start_observations: "goalie confirmations are covered by the roster-event override",
  player_forecast_observation_conflicts: "no conflicts in the fixture",
  player_forecast_conflict_resolutions: "no conflicts in the fixture",
};

describe("fixture world coverage", () => {
  it("every read relation returns rows in at least one scenario", () => {
    const seen = new Map<string, boolean>();
    for (const scenario of SCENARIOS) {
      const oracle = loadOracle(scenario.name);
      for (const read of oracle.reads) {
        const relation = String(read.request[0].args[0]);
        seen.set(relation, seen.get(relation) === true || !EMPTY_RESULT_HASHES.has(read.resultHash));
      }
    }
    const empty = [...seen].filter(([relation, nonEmpty]) => !nonEmpty && !(relation in INTENTIONALLY_EMPTY)).map(([relation]) => relation);
    expect(empty).toEqual([]);
  });

  // Write parity can only see a mis-wired input when that input moves the output.
  const PERTURB: Record<string, (row: Record<string, any>) => void> = {
    wgo_skater_stats: (row) => { row.toi_per_game *= 1.3; row.es_toi_per_game *= 1.3; row.pp_toi_per_game *= 1.6; row.pp_toi *= 1.6; },
    player_stats_unified: (row) => { row.nst_shots_per_60 *= 1.5; row.nst_ixg_per_60 *= 1.5; row.nst_oi_xgf_per_60 *= 1.4; },
    sustainability_trend_bands: (row) => { row.value += 6; },
    nhl_team_data: (row) => { row.xga *= 1.4; row.xga_per_game *= 1.4; row.xgf *= 0.7; row.xgf_per_game *= 0.7; },
    wgo_team_stats: (row) => { row.save_pct_5v5 -= 0.03; row.shooting_plus_save_pct_5v5 -= 0.04; },
    nst_team_all: (row) => { row.xga *= 1.6; },
    forge_team_game_strength: (row) => { row.shots_es += 8; row.toi_pp_seconds += 200; },
    forge_goalie_game: (row) => { row.goals_allowed += 2; row.saves -= 2; },
    goalie_start_projections: (row) => { row.start_probability = 1 - row.start_probability; },
    lineCombinations: (row) => { row.forwards = [...row.forwards].reverse(); },
    skatersGameStats: (row) => { row.shots += 3; },
  };
  for (const [relation, perturb] of Object.entries(PERTURB)) {
    it(`perturbing ${relation} changes the writer output`, async () => {
      const scenario = SCENARIOS.find((item) => item.name === (relation === "skatersGameStats" ? "season-bootstrap" : "normal-one-game"))!;
      const baseline = loadOracle(scenario.name).outputHash;
      const run = await runWriterScenario(scenario, (world: World) => {
        const rows = world.tables[relation] ?? [];
        expect(rows.length).toBeGreaterThan(0);
        rows.forEach(perturb);
      });
      expect(oracleRecord(scenario.name, run.reads, run.writes).outputHash).not.toBe(baseline);
    });
  }
});
