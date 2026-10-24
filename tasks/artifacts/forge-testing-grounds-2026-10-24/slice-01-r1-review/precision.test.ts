import { describe, expect, it } from "../../../../web/node_modules/vitest/dist/index.js";
import { projectOperationalProgress, workStageSchema, operationalSnapshotSchema } from "../../../../web/lib/forge-testing-grounds/operationalProgress";

const stage = () => ({
  stageId: "22222222-2222-4222-8222-222222222221", kind: "evaluation_tasks", status: "running",
  startedAt: "2026-09-05T11:59:00Z", heartbeatAt: "2026-09-05T12:00:00Z", finishedAt: null,
  denominator: { eligible: 1, excludedBeforeStage: 0, manifestHash: "a".repeat(64), eligibilityRuleHash: "b".repeat(64) },
  counts: { successful: 0, skipped: 0, failed: 0, pending: 1 },
});
const snapshot = (s: unknown = stage()) => ({
  version: "forge-testing-grounds-progress-v1", runId: "22222222-2222-4222-8222-222222222222", state: "running",
  revision: 1, recordedAt: "2026-09-05T12:00:00Z", stages: [s],
});
const early = "2026-09-05T12:00:00.000000000000000000000000000001Z";
const late = "2026-09-05T12:00:00.000000000000000000000000000002Z";

describe("Focused independent precision controls [R1-review]", () => {
  it("preserves declared order across unequal fractional lengths and second carries", () => {
    for (const [before, after] of [
      [early, late],
      ["2026-09-05T12:00:00.1Z", "2026-09-05T12:00:00.100000000000000000000000000001Z"],
      ["2026-09-05T12:00:00.099999999999999999999999999999Z", "2026-09-05T12:00:00.1Z"],
      ["2026-09-05T12:00:00.999999999999999999999999999999Z", "2026-09-05T12:00:01Z"],
    ]) {
      expect(workStageSchema.safeParse({ ...stage(), startedAt: before, heartbeatAt: after }).success).toBe(true);
      expect(workStageSchema.safeParse({ ...stage(), startedAt: after, heartbeatAt: before }).success).toBe(false);
    }
    expect(workStageSchema.safeParse({ ...stage(), startedAt: early, heartbeatAt: early.replace("Z", "000Z") }).success).toBe(true);
  });
  it("enforces all stage orderings and every stage event against the saved snapshot at 30 digits", () => {
    for (const s of [
      { ...stage(), startedAt: late, heartbeatAt: early },
      { ...stage(), status: "cancelled", startedAt: late, heartbeatAt: null, finishedAt: early },
      { ...stage(), status: "cancelled", startedAt: early, heartbeatAt: late, finishedAt: early },
    ]) expect(workStageSchema.safeParse(s).success).toBe(false);
    for (const s of [
      { ...stage(), startedAt: late, heartbeatAt: null },
      { ...stage(), heartbeatAt: late },
      { ...stage(), status: "cancelled", heartbeatAt: null, finishedAt: late },
    ]) expect(operationalSnapshotSchema.safeParse({ ...snapshot(s), recordedAt: early }).success).toBe(false);
  });
  it("preserves minute precision and UTC equality across offset, day, year and epoch boundaries", () => {
    for (const [a, b] of [
      ["2026-01-01T00:15+00:30", "2025-12-31T23:45Z"],
      ["2025-12-31T23:45-0030", "2026-01-01T00:15:00.000000Z"],
      ["1969-12-31T19:00:00.123456789012345678901234567890-0500", "1970-01-01T00:00:00.12345678901234567890123456789Z"],
      ["2026-09-05T17:45:00.000000000000000000000000000001+05:45", early],
    ]) {
      const value = { ...snapshot({ ...stage(), startedAt: a, heartbeatAt: b }), recordedAt: b };
      const p = projectOperationalProgress(value, { now: a, staleAfterMs: 1 }).stages[0];
      expect(p).toMatchObject({ elapsedMs: 0, heartbeatAgeMs: 0, heartbeatStatus: "recent" });
      expect(p.startedAt).toBe(a); expect(p.heartbeatAt).toBe(b);
    }
  });
  it("rejects a monitoring clock before the snapshot while accepting equal and later fractional instants", () => {
    const value = { ...snapshot(), stages: [], recordedAt: late };
    expect(() => projectOperationalProgress(value, { now: early, staleAfterMs: 1 })).toThrow("precedes");
    expect(projectOperationalProgress(value, { now: late, staleAfterMs: 1 }).recordedAt).toBe(late);
    expect(projectOperationalProgress(value, { now: late.replace("002Z", "003Z"), staleAfterMs: 1 }).recordedAt).toBe(late);
  });
  it("uses strict greater-than threshold arithmetic even when display precision rounds away the difference", () => {
    const beat = "2026-09-05T12:00:00.000000000000000000000000000001Z";
    const value = { ...snapshot({ ...stage(), heartbeatAt: beat }), recordedAt: beat };
    for (const [now, status] of [
      ["2026-09-05T12:00:00.001000000000000000000000000000Z", "recent"],
      ["2026-09-05T12:00:00.001000000000000000000000000001Z", "recent"],
      ["2026-09-05T12:00:00.001000000000000000000000000002Z", "stale"],
    ]) {
      const p = projectOperationalProgress(value, { now, staleAfterMs: 1 }).stages[0];
      expect(p.heartbeatStatus).toBe(status);
      expect(p.heartbeatAgeMs).toBeCloseTo(1, 12);
    }
  });
  it("continues rejecting malformed timestamps and invalid threshold policies without reflecting payloads", () => {
    for (const invalid of ["garbage", "2026-02-30T12:00:00Z", "2026-09-05T12:00:00.Z", "2026-09-05T12:00:00.0001"]) {
      expect(workStageSchema.safeParse({ ...stage(), startedAt: invalid }).success).toBe(false);
      expect(() => projectOperationalProgress(snapshot(), { now: invalid, staleAfterMs: 1 })).toThrow();
    }
    for (const staleAfterMs of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => projectOperationalProgress(snapshot(), { now: "2026-09-05T12:00:00Z", staleAfterMs })).toThrow();
    }
  });
});
