import { describe, expect, it } from "../../../../web/node_modules/vitest/dist/index.js";
import { projectOperationalProgress, workStageSchema, operationalSnapshotSchema } from "../../../../web/lib/forge-testing-grounds/operationalProgress";
import { checkInputFieldHealth } from "../../../../web/lib/forge-testing-grounds/dataHealth";

const uuid = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
const T = "2026-09-05T12:00:00Z";
const stage = () => ({
  stageId: uuid(1), kind: "historical_games", status: "running",
  startedAt: "2026-09-05T11:59:00Z", heartbeatAt: T, finishedAt: null,
  denominator: { eligible: 7, excludedBeforeStage: 4, manifestHash: "b".repeat(64), eligibilityRuleHash: "c".repeat(64) },
  counts: { successful: 2, skipped: 1, failed: 1, pending: 3 },
});
const snapshot = (s: unknown = stage()) => ({
  version: "forge-testing-grounds-progress-v1", runId: uuid(2), state: "running", revision: 1,
  recordedAt: T, stages: [s],
});
const project = (s: unknown) => projectOperationalProgress(s, { now: T, staleAfterMs: 60_000 });
const specification = () => ({
  reportId: uuid(3), inputManifestId: uuid(4), cohortId: uuid(5), policyHash: "d".repeat(64),
  checkedAt: "2026-09-05T13:00:00Z", predictionCutoff: T, maxAgeMs: 60_000,
  requireAuthenticHistory: false, blockingCodes: ["missing", "null", "malformed", "duplicate", "identity", "units", "strength", "source_mismatch"],
  field: { source: "review_fixture", table: "inputs", field: "shots_mean", unit: "count", strength: "all", minimum: 0, maximum: 20, allowFractional: true },
  supersedes: null,
});
const row = (n = 1) => ({
  identity: { playerId: n, gameId: 700 }, source: "review_fixture", table: "inputs", field: "shots_mean",
  unit: "count", strength: "all", value: 0.625,
  observedAt: "2026-09-05T11:59:30Z", availableAt: "2026-09-05T11:59:31Z", capturedAt: "2026-09-05T11:59:32Z", revisionId: "independent-synthetic-v1",
});
const issueCodes = (report: ReturnType<typeof checkInputFieldHealth>) => report.issues.map(i => i.code);

describe("Independent operational boundary controls", () => {
  it("uses the eligible stage denominator, keeps exclusions separate, and labels work versus success", () => {
    const p = project(snapshot()).stages[0];
    expect(p).toMatchObject({ unit: "games", completed: 4, counts: { successful: 2, skipped: 1, failed: 1, pending: 3 } });
    expect(p.percent).toBeCloseTo(400 / 7, 12);
    expect(project(snapshot()).overallPercent).toBeNull();
    expect(p.progressMeaning).toContain("Terminal work units");
  });
  it("rejects unknown counted totals and provides no percent for unknown-total fitting or zero work", () => {
    for (const eligible of [null, undefined, "7"]) expect(() => project(snapshot({ ...stage(), denominator: { ...stage().denominator, eligible } }))).toThrow();
    const fitting = { stageId: uuid(1), kind: "fitting", status: "running", startedAt: T, heartbeatAt: null, finishedAt: null };
    expect(project(snapshot(fitting)).stages[0]).toMatchObject({ percent: null, completed: null, unit: null });
    expect(() => project(snapshot({ ...fitting, percent: 70 }))).toThrow();
    expect(project(snapshot({ ...stage(), denominator: { ...stage().denominator, eligible: 0 }, counts: { successful: 0, skipped: 0, failed: 0, pending: 0 } })).stages[0].percent).toBeNull();
  });
  it("rejects nonfinite, negative, fractional, overflow and contradictory counters/denominators", () => {
    for (const value of [NaN, Infinity, -Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, "2", null]) {
      expect(() => project(snapshot({ ...stage(), counts: { ...stage().counts, successful: value } }))).toThrow();
      expect(() => project(snapshot({ ...stage(), denominator: { ...stage().denominator, eligible: value } }))).toThrow();
    }
    for (const pending of [2, 4]) expect(() => project(snapshot({ ...stage(), counts: { ...stage().counts, pending } }))).toThrow();
    expect(() => project(snapshot({ ...stage(), denominator: { ...stage().denominator, eligible: Number.MAX_SAFE_INTEGER }, counts: { successful: Number.MAX_SAFE_INTEGER, skipped: 1, failed: 0, pending: 0 } }))).toThrow();
  });
  it("handles the largest safe denominator without reporting 100 percent while one unit is pending", () => {
    const p = project(snapshot({ ...stage(), denominator: { ...stage().denominator, eligible: Number.MAX_SAFE_INTEGER }, counts: { successful: Number.MAX_SAFE_INTEGER - 1, skipped: 0, failed: 0, pending: 1 } })).stages[0];
    expect(p.percent).toBeLessThan(100);
  });
  it("does not promote all processed failures to success or reject unavailable future outcomes as failed", () => {
    const failed = { ...stage(), status: "failed", finishedAt: T, counts: { successful: 0, skipped: 2, failed: 5, pending: 0 } };
    expect(project({ ...snapshot(failed), state: "failed" }).stages[0]).toMatchObject({ percent: 100, status: "failed", counts: { successful: 0, skipped: 2, failed: 5, pending: 0 } });
    expect(() => project({ ...snapshot({ ...failed, status: "completed" }), state: "completed_awaiting_reveal" })).toThrow();
    const pending = { ...stage(), kind: "evaluation_tasks", counts: { successful: 0, skipped: 0, failed: 0, pending: 7 } };
    expect(project(snapshot(pending)).stages[0]).toMatchObject({ completed: 0, percent: 0, counts: { failed: 0, pending: 7 } });
    expect(() => project({ ...snapshot(pending), state: "completed_revealed" })).toThrow();
  });
  it("does not deduplicate retry identities that this aggregate schema does not represent", () => {
    const aggregate = { ...stage(), counts: { successful: 2, skipped: 0, failed: 0, pending: 5 } };
    expect(project(snapshot(aggregate)).stages[0].completed).toBe(2);
    expect(() => project(snapshot({ ...aggregate, acceptedWorkIds: ["same", "same"] }))).toThrow();
    expect(operationalSnapshotSchema.safeParse({ ...snapshot(), stages: [stage(), stage()] }).success).toBe(false);
    // Count/manifest membership and uniqueness require the absent acceptance store.
  });
  it("rejects outcome/performance/operational-text additions at all serialized levels", () => {
    const secret = "SYNTHETIC_SEALED_GOALS_11";
    for (const value of [
      { ...snapshot(), scores: { rmse: 0.1 } }, { ...snapshot(), message: secret },
      snapshot({ ...stage(), result: secret }), snapshot({ ...stage(), counts: { ...stage().counts, accuracy: 1 } }),
      snapshot({ ...stage(), denominator: { ...stage().denominator, outcomes: secret } }),
    ]) expect(() => project(value)).toThrow();
    expect(JSON.stringify(project(snapshot()))).not.toMatch(/SYNTHETIC_SEALED|rmse|accuracy|scores|outcomes/);
  });
  it("preserves stale/cancellation distinctions and rejects malformed clocks and impossible stage combinations", () => {
    const cancel = { ...stage(), status: "cancellation_requested", heartbeatAt: "2026-09-05T11:59:00Z" };
    const p = projectOperationalProgress({ ...snapshot(cancel), state: "cancellation_requested" }, { now: "2026-09-05T12:02:00Z", staleAfterMs: 60_000 });
    expect(p).toMatchObject({ state: "cancellation_requested", stages: [{ status: "cancellation_requested", heartbeatStatus: "stale", completed: 4 }] });
    for (const change of [{ status: "queued" }, { finishedAt: T }, { heartbeatAt: "bad" }, { heartbeatAt: "2026-09-05T12:00:01Z" }]) expect(() => project(snapshot({ ...stage(), ...change }))).toThrow();
    for (const invalid of [null, {}, [], "bad", { ...snapshot(), revision: Infinity }]) expect(() => project(invalid)).toThrow();
  });
  it("rejects a heartbeat preceding its stage start at supported microsecond timestamp precision [R1]", () => {
    const s = { ...stage(), startedAt: "2026-09-05T11:59:00.000002Z", heartbeatAt: "2026-09-05T11:59:00.000001Z" };
    expect(workStageSchema.safeParse(s).success).toBe(false);
  });
  it("rejects a stage event later than the saved snapshot at supported microsecond precision [R1]", () => {
    const s = { ...stage(), heartbeatAt: "2026-09-05T12:00:00.000002Z" };
    const value = { ...snapshot(s), recordedAt: "2026-09-05T12:00:00.000001Z" };
    expect(operationalSnapshotSchema.safeParse(value).success).toBe(false);
  });
});

describe("Independent input-health boundary controls", () => {
  it("keeps zero, fractional, absent and explicit null observations separate without coercion", () => {
    const absent: Record<string, unknown> = { ...row(3) }; delete absent.value;
    const r = checkInputFieldHealth(specification(), [{ ...row(1), value: 0 }, row(2), absent, { ...row(4), value: null }]);
    expect(r.counts).toMatchObject({ inputRows: 4, validNumericRows: 2, validZeroRows: 1, missingRows: 1, nullRows: 1, affectedRows: 2, automaticallyExcludedRows: 0 });
    expect(issueCodes(r)).toEqual(["missing", "null"]);
  });
  it("rejects invalid values against explicit bounds and whole-number policy", () => {
    for (const value of [NaN, Infinity, -Infinity, -0.5, 20.001, Number.MAX_VALUE, "0", true, {}, []]) {
      const r = checkInputFieldHealth(specification(), [{ ...row(), value }]);
      expect(issueCodes(r)).toContain("malformed"); expect(r.status).toBe("blocked");
      expect(r.counts.validNumericRows).toBe(0);
    }
    const integral = { ...specification(), field: { ...specification().field, allowFractional: false, maximum: null } };
    for (const value of [0.625, Number.MAX_SAFE_INTEGER + 1]) expect(issueCodes(checkInputFieldHealth(integral, [{ ...row(), value }]))).toContain("malformed");
  });
  it("counts all duplicate rows and overlapping defects without exclusions or aggregate double counting", () => {
    const bad = Array.from({ length: 13 }, () => ({ ...row(), value: null, unit: "wrong" }));
    const r = checkInputFieldHealth(specification(), bad);
    expect(r.counts).toMatchObject({ inputRows: 13, nullRows: 13, affectedRows: 13, unaffectedRows: 0, automaticallyExcludedRows: 0 });
    for (const issue of r.issues) {
      expect(issue.affectedRows).toBe(13); expect(issue.samples).toHaveLength(10); expect(issue.omittedSamples).toBe(3);
    }
    expect(issueCodes(r)).toEqual(["null", "duplicate", "units"]);
  });
  it("uses declared blocking severity and retains affected report cohort/field without claiming membership validation", () => {
    const spec = { ...specification(), blockingCodes: [] };
    const r = checkInputFieldHealth(spec, [{ ...row(), value: null }]);
    expect(r).toMatchObject({ status: "checked", specification: { cohortId: spec.cohortId, policyHash: spec.policyHash, field: spec.field } });
    expect(r.issues[0]).toMatchObject({ code: "null", severity: "warning", affectedRows: 1 });
    expect(checkInputFieldHealth({ ...spec, blockingCodes: ["null"] }, [{ ...row(), value: null }]).status).toBe("blocked");
    // The schema has no expected membership/eligible count, so [] is only zero supplied rows.
    expect(checkInputFieldHealth(specification(), []).counts.inputRows).toBe(0);
  });
  it("blocks future knowledge and invalid clocks independently of discretionary severity", () => {
    const spec = { ...specification(), blockingCodes: [] };
    const future = { ...row(), availableAt: "2026-09-05T12:00:00.000001Z", capturedAt: "2026-09-05T12:00:00.000002Z" };
    expect(checkInputFieldHealth(spec, [future]).issues.find(i => i.code === "historically_unavailable")?.severity).toBe("blocker");
    for (const change of [{ observedAt: "2026-02-30T00:00:00Z" }, { availableAt: "invalid" }, { capturedAt: "2026-09-06T00:00:00Z" }, { capturedAt: "2026-09-05T11:59:29Z" }]) {
      expect(checkInputFieldHealth(spec, [{ ...row(), ...change }]).issues.find(i => i.code === "invalid_clock")?.severity).toBe("blocker");
    }
  });
  it("honors freshness inclusivity and submillisecond cutoff ordering with equivalent offsets", () => {
    const spec = { ...specification(), maxAgeMs: 30_000 };
    expect(issueCodes(checkInputFieldHealth(spec, [row()]))).not.toContain("stale");
    expect(issueCodes(checkInputFieldHealth({ ...spec, maxAgeMs: 29_999 }, [row()]))).toContain("stale");
    const atCutoff = { ...row(), observedAt: "2026-09-05T08:00:00-04:00", availableAt: "2026-09-05T12:00:00.000000Z", capturedAt: T };
    expect(issueCodes(checkInputFieldHealth(spec, [atCutoff]))).not.toContain("historically_unavailable");
  });
  it("makes unknown history/capture/revision explicit and escalates it for authentic-history policy", () => {
    const uncertain = { ...row(), availableAt: null, capturedAt: "2026-09-05T12:30:00Z", revisionId: "" };
    const relaxed = checkInputFieldHealth(specification(), [uncertain]);
    expect(relaxed.historyClassification).toBe("reconstructed_history_diagnostic");
    expect(issueCodes(relaxed)).toEqual(["missing_revision", "availability_unknown", "later_capture"]);
    expect(relaxed.status).toBe("checked");
    const strict = checkInputFieldHealth({ ...specification(), requireAuthenticHistory: true }, [uncertain]);
    expect(strict.status).toBe("blocked"); expect(strict.issues.every(i => i.severity === "blocker")).toBe(true);
  });
  it("does not reflect hostile raw fields or values in samples, guidance or serialized reports", () => {
    const secret = "SYNTHETIC_SEALED_ANSWER_TOKEN";
    const r = checkInputFieldHealth(specification(), [{ ...row(), identity: { playerId: secret, gameId: 7 }, value: { score: secret }, source: secret,
      table: secret, field: secret, unit: secret, strength: secret, observedAt: secret, availableAt: secret, capturedAt: secret, revisionId: secret }]);
    expect(JSON.stringify(r)).not.toContain(secret);
    expect(r.issues.every(i => i.samples.every(s => s.identity === null))).toBe(true);
    const harmless = checkInputFieldHealth(specification(), [{ ...row(), value: secret }]);
    expect(harmless.issues[0].samples[0]).toEqual({ rowIndex: 0, identity: { playerId: 1, gameId: 700 }, observedShape: "string" });
  });
  it("rejects malformed specifications and nonarray collections, while malformed source rows stay diagnosed", () => {
    for (const value of [null, {}, { ...specification(), result: 9 }, { ...specification(), maxAgeMs: NaN }, { ...specification(), blockingCodes: ["invented"] },
      { ...specification(), field: { ...specification().field, minimum: 2, maximum: 1 } }]) expect(() => checkInputFieldHealth(value, [row()])).toThrow();
    for (const rows of [null, {}, "rows"]) expect(() => checkInputFieldHealth(specification(), rows as never)).toThrow("array");
    const malformed = checkInputFieldHealth(specification(), [null, 7, "row", []] as never);
    expect(malformed.counts.affectedRows).toBe(4); expect(malformed.status).toBe("blocked");
  });
  it("copies report inputs/safe identities and requires distinct recheck IDs without repairing or mutating originals", () => {
    const spec = specification(), input = row(); input.value = 0;
    const original = checkInputFieldHealth(spec, [input]); const saved = JSON.stringify(original);
    spec.field.source = "later_source"; input.identity.playerId = 5;
    expect(JSON.stringify(original)).toBe(saved);
    const next = { ...specification(), reportId: uuid(20), inputManifestId: uuid(21), supersedes: { reportId: uuid(3), inputManifestId: uuid(4) } };
    expect(checkInputFieldHealth(next, [row()]).investigation).toMatchObject({ href: "/db/runner", action: "navigate_only" });
    expect(() => checkInputFieldHealth({ ...next, reportId: uuid(3) }, [row()])).toThrow();
    expect(() => checkInputFieldHealth({ ...next, inputManifestId: uuid(4) }, [row()])).toThrow();
    expect(JSON.stringify(original)).toBe(saved);
  });
});
