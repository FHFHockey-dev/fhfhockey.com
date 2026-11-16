// Fixtures follow the 2026-11-16 audit's saved production results (tasks/artifacts/forge-projection-audit-2026-11-16/
// blind/sql/041.csv, 042.csv, 070.csv, 087.csv). Run ids are synthetic.
import { describe, expect, it } from "vitest";

import {
  assessForgeServingHealth,
  assessForgeServingPipeline,
  type ForgeServingRunRow,
  type ForgeServingStageState,
  withForgeServingSubject,
} from "./forgeServingHealth";

const SHA_1109 = "a5816ce6d1eeeba4b7213d1f66c96025f0b5818e";
const CLOSURE_1109 = "9b1821fff8b64983f5e28c572a054cdc7d49f2a320b8e2e18dec514e4ad4c219"; // listed
const SHA_1113 = "e1ab46318ec9c6797deb94ac1aa23d68f5672f26";
const CLOSURE_1113 = "ee5581d901975dd5701c76ecc58e715b396b449bdb50e05360c571f3f3de710b"; // listed by #455 on 11-16
/** Stands in for ee5581d9 as it was until #455: not in VERIFIED_FORGE_PRODUCER_CLOSURES. */
const UNLISTED = "f".repeat(64);

function run(runId: string, createdAt: string, overrides: Partial<ForgeServingRunRow> & { closure?: string | null } = {}): ForgeServingRunRow {
  const { closure = CLOSURE_1109, ...rest } = overrides;
  return { run_id: runId, status: "succeeded", git_sha: SHA_1109, created_at: createdAt, invocations: "1",
    producer_identity: { version: "forge-producer-closure-v1", invocations: [closure], code_versions: [null] },
    rolling_player_history_contract: "full_selected_scope_through_end_date_v1", execution_mode: "full_slate",
    scope_key: "h1:full", ...rest };
}
const STAGES = ["core_entity_freshness", "upstream_skater_sources", "contextual_builders", "rolling_player_recompute",
  "projection_input_ingest", "projection_relationship_build", "projection_derived_build", "projection_execution"];
function stages(through: string, last?: Partial<ForgeServingStageState>): Map<string, ForgeServingStageState> {
  const map = new Map<string, ForgeServingStageState>();
  for (const stage of STAGES) {
    if (stage === through && last) { map.set(stage, { status: "running", lastError: null, leaseExpiresAt: null, updatedAt: null, ...last }); break; }
    map.set(stage, { status: "complete", lastError: null, leaseExpiresAt: null, updatedAt: "2026-11-13T10:20:00Z" });
    if (stage === through) break;
  }
  return map;
}
const complete = () => stages("projection_execution");

describe("assessForgeServingHealth", () => {
  it("is ok when readers serve a full-slate run created today", () => {
    const health = assessForgeServingHealth({ date: "2026-11-09", now: new Date("2026-11-09T13:01:00Z"), seasonState: "in_season",
      runs: [run("run-1109", "2026-11-09T10:16:00Z")], stages: complete() });
    expect(health).toMatchObject({ status: "ok", problems: [], servedRun: { runId: "run-1109", createdOn: "2026-11-09", servable: true } });
  });

  it("is critical on 11-13: today's run is withheld for an unlisted closure while the 11-09 run still covers the date", () => {
    const health = assessForgeServingHealth({ date: "2026-11-13", now: new Date("2026-11-13T13:01:20Z"), seasonState: "in_season",
      runs: [run("1109-as-of-1113", "2026-11-09T10:30:00Z"),
        run("1113-as-of-1113", "2026-11-13T10:20:00Z", { git_sha: SHA_1113, closure: UNLISTED })],
      stages: complete() });
    expect(health.status).toBe("critical");
    expect(health.servedRun?.runId).toBe("1109-as-of-1113");
    expect(health.todayRuns).toMatchObject([{ runId: "1113-as-of-1113", servable: false, closureSha256: UNLISTED }]);
    expect(health.problems[0]).toContain(`producer closure ${UNLISTED} is not in VERIFIED_FORGE_PRODUCER_CLOSURES`);
    expect(health.problems).toContain("Readers fall back to run 1109-as-, created 11-09 05:30 ET (4 days old).");
  });

  it("is critical when the withheld run is the only one for the date (11-16 before #455)", () => {
    const health = assessForgeServingHealth({ date: "2026-11-16", now: new Date("2026-11-16T13:01:00Z"), seasonState: "in_season",
      runs: [run("1113-as-of-1116", "2026-11-13T10:33:00Z", { git_sha: SHA_1113, closure: UNLISTED })],
      stages: stages("projection_execution", { status: "running", updatedAt: "2026-11-16T10:20:34Z", leaseExpiresAt: "2026-11-16T10:25:34Z" }) });
    expect(health.status).toBe("critical");
    expect(health.servedRun).toBeNull();
    expect(health.problems).toEqual([
      "No full-slate FORGE run for 2026-11-16 was created today.",
      expect.stringContaining("stuck: projection_execution has been running since 11-16 05:20 ET with an expired lease"),
      "Readers have no servable FORGE run for 2026-11-16: Start Chart, RSO and the forecast pages show nothing for it.",
      `The newest earlier run, 1113-as- (created 11-13 05:33 ET), is withheld: producer closure ${UNLISTED} is not in `
        + "VERIFIED_FORGE_PRODUCER_CLOSURES (lib/projections/verifiedForgeReleases.ts).",
    ]);
  });

  it("warns on 11-16 after #455: the pipeline is stuck and readers serve the 3-day-old listed run", () => {
    const health = assessForgeServingHealth({ date: "2026-11-16", now: new Date("2026-11-16T13:01:00Z"), seasonState: "in_season",
      runs: [run("1113-as-of-1116", "2026-11-13T10:33:00Z", { git_sha: SHA_1113, closure: CLOSURE_1113 })],
      stages: stages("projection_execution", { status: "running", updatedAt: "2026-11-16T10:20:34Z", leaseExpiresAt: "2026-11-16T10:25:34Z" }) });
    expect(health.status).toBe("warning");
    expect(health.pipeline).toMatchObject({ state: "stuck", stage: "projection_execution" });
    expect(health.problems).toContain("Readers fall back to run 1113-as-, created 11-13 05:33 ET (3 days old).");
  });

  it("is critical for a production run stamped local:unknown (H2), naming the reason", () => {
    const health = assessForgeServingHealth({ date: "2026-11-02", now: new Date("2026-11-02T13:01:00Z"), seasonState: "in_season",
      runs: [run("older", "2026-10-29T10:20:00Z"), run("local", "2026-11-02T10:15:00Z", { git_sha: "local:unknown" })],
      stages: complete() });
    expect(health.status).toBe("critical");
    expect(health.problems[0]).toContain("git_sha is 'local:unknown', so every reader drops it");
  });

  it("names a failed early stage and that projection_execution was never reached (11-15)", () => {
    const pipeline = new Map<string, ForgeServingStageState>([...stages("rolling_player_recompute"),
      ["projection_input_ingest", { status: "failed", lastError: "stage_failed:attempt-2", leaseExpiresAt: null, updatedAt: "2026-11-15T10:31:23Z" }]]);
    const health = assessForgeServingHealth({ date: "2026-11-15", now: new Date("2026-11-15T13:01:00Z"), seasonState: "in_season",
      runs: [run("1113-as-of-1115", "2026-11-13T10:31:00Z", { git_sha: SHA_1113, closure: CLOSURE_1113 })], stages: pipeline });
    expect(health.status).toBe("warning");
    expect(health.problems).toContain("The rolling pipeline failed at projection_input_ingest (stage_failed:attempt-2, 11-15 05:31 ET); "
      + "projection_execution was not reached.");
  });

  it("reports a pipeline that has not started, a handoff, a live run and a stalled stage", () => {
    const now = new Date("2026-11-16T13:01:00Z");
    expect(assessForgeServingPipeline("2026-11-16", new Map(), now).state).toBe("not_started");
    expect(assessForgeServingPipeline("2026-11-16", stages("contextual_builders",
      { status: "failed", lastError: "stage_handoff", updatedAt: "2026-11-16T10:10:00Z" }), now).state).toBe("handed_off");
    expect(assessForgeServingPipeline("2026-11-16", stages("projection_execution",
      { status: "running", leaseExpiresAt: "2026-11-16T13:05:00Z" }), now)).toMatchObject({ state: "running", stage: "projection_execution" });
    const gap = stages("projection_execution");
    gap.delete("projection_derived_build");
    expect(assessForgeServingPipeline("2026-11-16", gap, now)).toMatchObject({ state: "stalled", stage: "projection_derived_build" });
    expect(assessForgeServingPipeline("2026-11-16", null, now).state).toBe("unknown");
  });

  it("reports every applicable reason for a run still running today", () => {
    const health = assessForgeServingHealth({ date: "2026-11-16", now: new Date("2026-11-16T13:01:00Z"), seasonState: "in_season",
      runs: [run("older", "2026-11-13T10:33:00Z", { git_sha: SHA_1113, closure: CLOSURE_1113 }),
        run("today", "2026-11-16T10:20:34Z", { status: "running", git_sha: SHA_1113, closure: UNLISTED })],
      stages: stages("projection_execution", { status: "running", leaseExpiresAt: "2026-11-16T13:30:00Z" }) });
    expect(health.status).toBe("warning");
    expect(health.problems).toEqual([
      "Today's run today (created 11-16 05:20 ET) is running, not succeeded.",
      expect.stringContaining("still running projection_execution"),
      "Readers fall back to run older, created 11-13 05:33 ET (3 days old).",
    ]);
  });

  it("does not count a single-game rerun created today as today's slate", () => {
    const health = assessForgeServingHealth({ date: "2026-11-13", now: new Date("2026-11-13T13:01:00Z"), seasonState: "in_season",
      runs: [run("full", "2026-11-09T10:30:00Z"),
        run("one-game", "2026-11-13T01:40:00Z", { execution_mode: "selected_games", scope_key: "h1:2026020308" })],
      stages: complete() });
    expect(health.status).toBe("warning");
    expect(health.servedRun?.runId).toBe("full");
    expect(health.problems).toContain("No full-slate FORGE run for 2026-11-13 was created today.");
  });

  it("accepts a run proven by a captured snapshot even without a listed closure", () => {
    const health = assessForgeServingHealth({ date: "2026-11-13", now: new Date("2026-11-13T13:01:00Z"), seasonState: "in_season",
      runs: [run("captured", "2026-11-13T10:20:00Z", { closure: UNLISTED })], stages: complete(),
      provenRunIds: new Set(["captured"]) });
    expect(health).toMatchObject({ status: "ok", problems: [] });
  });

  it("warns that a newer run today is withheld while an earlier one today is served", () => {
    const health = assessForgeServingHealth({ date: "2026-11-13", now: new Date("2026-11-13T18:00:00Z"), seasonState: "in_season",
      runs: [run("morning", "2026-11-13T10:20:00Z"), run("redeploy", "2026-11-13T15:00:00Z", { closure: UNLISTED })], stages: complete() });
    expect(health.status).toBe("warning");
    expect(health.servedRun?.runId).toBe("morning");
    expect(health.problems).toHaveLength(1);
  });

  it("only warns when the pipeline finished and no run exists at all (a day with no games)", () => {
    const health = assessForgeServingHealth({ date: "2026-12-25", now: new Date("2026-12-25T13:01:00Z"), seasonState: "in_season",
      runs: [], stages: complete() });
    expect(health.status).toBe("warning");
    expect(health.problems).toContain("No FORGE run exists for 2026-12-25 although the pipeline finished; expected only on a day with no games.");
  });

  it("is not applicable off season and unknown when the runs could not be read", () => {
    const base = { date: "2026-07-01", now: new Date("2026-07-01T13:00:00Z"), stages: null };
    expect(assessForgeServingHealth({ ...base, seasonState: "off_season", runs: [] }).status).toBe("not_applicable");
    expect(assessForgeServingHealth({ ...base, seasonState: "in_season", runs: null, notes: ["FORGE runs read timed out."] }))
      .toMatchObject({ status: "unknown", notes: ["FORGE runs read timed out."] });
  });
});

describe("withForgeServingSubject", () => {
  const health = (status: "ok" | "warning" | "critical" | "unknown" | "not_applicable") =>
    ({ status, date: "2026-11-13" }) as Parameters<typeof withForgeServingSubject>[1];
  it("never leaves an all-clear when the check itself could not read in season", () => {
    expect(withForgeServingSubject("✅ Daily Cron Report — 40/40 jobs ok", health("unknown")))
      .toBe("⚠️ Daily Cron Report — 40/40 jobs ok · FORGE check failed for 2026-11-13");
    expect(withForgeServingSubject("✅ Daily Cron Report — 40/40 jobs ok", health("not_applicable")))
      .toBe("✅ Daily Cron Report — 40/40 jobs ok");
  });
  it("always shows a critical verdict and downgrades an all-clear on a warning", () => {
    expect(withForgeServingSubject("✅ Daily Cron Report — 40/40 jobs ok", health("critical")))
      .toBe("❌ Daily Cron Report — 40/40 jobs ok · FORGE not served for 2026-11-13");
    expect(withForgeServingSubject("✅ Daily Cron Report — 40/40 jobs ok", health("warning")))
      .toBe("⚠️ Daily Cron Report — 40/40 jobs ok · FORGE stale for 2026-11-13");
    expect(withForgeServingSubject("❌ Daily Cron Report — 2 failing, 0 missing", health("warning")))
      .toBe("❌ Daily Cron Report — 2 failing, 0 missing · FORGE stale for 2026-11-13");
    expect(withForgeServingSubject("✅ Daily Cron Report — 40/40 jobs ok", health("ok"))).toBe("✅ Daily Cron Report — 40/40 jobs ok");
    expect(withForgeServingSubject("✅ x", null)).toBe("✅ x");
  });
});
