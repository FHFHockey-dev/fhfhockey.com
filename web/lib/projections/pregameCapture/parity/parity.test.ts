// @vitest-environment node
/**
 * Offline parity for the FORGE load/compute split. Every scenario runs the production writer on its captured
 * path against the fixture world with a frozen clock. Set RECORD_FORGE_ORACLE=1 only to record the oracle,
 * which was done once on the unmodified writer; the oracle files must never be re-recorded to fit a change.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { oracleRecord, runWriterScenario, SCENARIOS, type OracleRecord } from "./scenarios";

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
