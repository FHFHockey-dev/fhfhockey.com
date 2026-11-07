// C3 (c): run-projection-accuracy?projectionOffsetDays=0
// "Latest succeeded projection run is excluded from calibration because native input provenance is missing or legacy."
// Offline only: Supabase, preflight, run lookup and auth are mocked; run metadata is fabricated.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireLatestSucceededRunId: vi.fn(),
  preflight: vi.fn(),
  server: {} as Record<string, unknown>,
  runMetrics: null as unknown,
}));
vi.mock("lib/supabase", () => ({ default: { from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) })) } }));
vi.mock("lib/supabase/server", () => ({ default: mocks.server }));
vi.mock("lib/projections/apiHelpers", () => ({ requireLatestSucceededRunId: mocks.requireLatestSucceededRunId }));
vi.mock("pages/api/v1/db/run-projection-v2", () => ({ runProjectionPreflightChecks: mocks.preflight }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: unknown) => handler }));

import handler from "pages/api/v1/db/run-projection-accuracy";
import { buildForgeInputProvenance, evaluateForgeCalibrationEligibility } from "lib/projections/calibrationEligibility";

const repo = "/Users/tim/Code/fhfhockey.com";

/** Every table read is empty; forge_runs.maybeSingle returns the fabricated run metadata. */
function installDb() {
  const writes: string[] = [];
  const builder = (table: string): any => new Proxy({}, {
    get(_target, prop) {
      if (prop === "then") return (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], count: 0, error: null }).then(resolve);
      if (prop === "maybeSingle") return () => Promise.resolve({ data: table === "forge_runs" ? { metrics: mocks.runMetrics } : null, error: null });
      if (prop === "upsert" || prop === "insert" || prop === "delete") return () => { writes.push(table); return builder(table); };
      return () => builder(table);
    },
  });
  mocks.server.from = vi.fn(builder);
  mocks.server.rpc = vi.fn(async (name: string) => { writes.push(`rpc:${name}`); return { data: null, error: null }; });
  return writes;
}

async function run() {
  const res: any = { statusCode: 200, body: null, setHeader: vi.fn(), status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } };
  await handler({ method: "POST", query: { projectionOffsetDays: "0", date: "2026-10-24", ignoreOffSeason: "true" } } as any, res);
  return res;
}

const EMAIL = "Latest succeeded projection run is excluded from calibration because native input provenance is missing or legacy.";

describe("C3 (c) released run-projection-accuracy (sha256 8091e93c) and calibrationEligibility (9b93cc5c)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.preflight.mockResolvedValue({ asOfDate: "2026-10-24", bypassed: false, status: "PASS", gates: [] });
    mocks.requireLatestSucceededRunId.mockResolvedValue("fabricated-run-2026-10-24");
  });

  it("reproduces the email for the provenance every production FORGE writer stamps today", async () => {
    mocks.runMetrics = { input_provenance: buildForgeInputProvenance() };
    const writes = installDb();
    const res = await run();
    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe(EMAIL);
    expect(res.body.calibrationEligibility).toMatchObject({
      eligible: false, reason: "missing_or_legacy_external_fantasy_exclusion_contract",
      observedContract: "full_selected_scope_through_end_date_v1", observedExternalFantasyContract: null,
    });
    expect(writes.filter(table => table !== "cron_job_audit")).toEqual([]);
  });

  it("reproduces the email for a pre-July legacy run with no provenance at all", async () => {
    mocks.runMetrics = {};
    const writes = installDb();
    const res = await run();
    expect(res.statusCode).toBe(422);
    expect(res.body.calibrationEligibility.reason).toBe("missing_or_legacy_rolling_history_contract");
    expect(writes.filter(table => table !== "cron_job_audit")).toEqual([]);
  });

  it("control: only an explicitly opted-in exclusion label passes this gate", async () => {
    mocks.runMetrics = { input_provenance: buildForgeInputProvenance({ externalFantasyInputsExcluded: true }) };
    installDb();
    const res = await run();
    expect(res.body?.error).not.toBe(EMAIL);
    expect(res.statusCode).not.toBe(422);
  });

  it("persistence: no production source opts in, so every new run stays ineligible until FORGE stops blending external priors", () => {
    const writer = readFileSync(`${repo}/web/lib/projections/run-forge-projections.ts`, "utf8");
    const calls = writer.match(/buildForgeInputProvenance\([^)]*\)/g) ?? [];
    expect(calls).toEqual(["buildForgeInputProvenance()", "buildForgeInputProvenance()", "buildForgeInputProvenance()"]);
    expect(writer).not.toContain("externalFantasyInputsExcluded");
    expect(evaluateForgeCalibrationEligibility({ input_provenance: buildForgeInputProvenance() }).eligible).toBe(false);
  });

  it("intent: the gate's own test records that stages still blend external fantasy priors", () => {
    const helperTest = readFileSync(`${repo}/web/lib/projections/apiHelpers.test.ts`, "utf8");
    expect(helperTest).toContain("stages still blend external fantasy priors; that provenance must stay ineligible.");
  });
});
