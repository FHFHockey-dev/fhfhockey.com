// @vitest-environment node
import { describe, it, vi } from "vitest";
import { useWorld, withScenarioEnv, writerCaptures } from "./harness";

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
  saveForgeInputSnapshot: async () => "snapshot-1",
  publishForgeGameRevisions: async () => 1,
}));

describe("explore", () => {
  it("runs", async () => {
    const { buildLeague } = await import("../__fixtures__/world/league");
    useWorld(buildLeague(JSON.parse(process.env.EXPLORE_OPTS ?? "{}")));
    const { runProjectionV2ForDate } = await import("lib/projections/run-forge-projections");
    try {
      await withScenarioEnv(JSON.parse(process.env.EXPLORE_ENV ?? "{}"), () => runProjectionV2ForDate("2026-11-14", { gameIds: [2026020250], horizonGames: 1, ...(process.env.EXPLORE_CUTOFF ? { decisionAsOf: process.env.EXPLORE_CUTOFF } : {}) }));
    } catch (error) { console.log("ERR", error); }
    for (const c of writerCaptures) {
      for (const r of c.reads) console.log("R", JSON.stringify(r.request).slice(0, 260), "=>", JSON.stringify(r.result).slice(0, 120));
      for (const w of c.writes) console.log("W", JSON.stringify(w).slice(0, 200));
    }
  });
});
