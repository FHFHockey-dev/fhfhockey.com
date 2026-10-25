import { describe, expect, it } from "vitest";
import { operationalSnapshotSchema, projectOperationalProgress, workStageSchema, type OperationalSnapshot, type WorkStage } from "./operationalProgress";

const start = "2026-09-01T12:00:00Z", heartbeat = "2026-09-01T12:01:00Z", now = "2026-09-01T12:02:00Z";
const stageId = "00000000-0000-4000-8000-000000000001";
const stage = (): WorkStage => ({
  stageId, kind: "player_game_predictions", status: "running", startedAt: start, finishedAt: null, heartbeatAt: heartbeat,
  denominator: { manifestHash: "a".repeat(64), eligibilityRuleHash: "b".repeat(64), eligible: 10, excludedBeforeStage: 3 },
  counts: { successful: 3, skipped: 1, failed: 1, pending: 5 },
});
const snapshot = (): OperationalSnapshot => ({ version: "forge-testing-grounds-progress-v1",
  runId: "00000000-0000-4000-8000-000000000002", state: "running", revision: 4, recordedAt: heartbeat, stages: [stage()] });
const project = (value: unknown) => projectOperationalProgress(value, { now, staleAfterMs: 90_000 });

describe("Testing Grounds operational progress", () => {
  it("uses only accepted terminal units and the declared eligible denominator", () => {
    const result = project(snapshot());
    expect(result.overallPercent).toBeNull();
    expect(result.stages[0]).toMatchObject({ completed: 5, percent: 50, unit: "player-games", elapsedMs: 120_000,
      heartbeatAgeMs: 60_000, heartbeatStatus: "recent", counts: { successful: 3, skipped: 1, failed: 1, pending: 5 } });
    // Preflight exclusions are visible but do not inflate stage work completion.
    expect(result.stages[0]).toHaveProperty("denominator.excludedBeforeStage", 3);
  });

  it("does not manufacture a fitting percentage or counters", () => {
    const fitting: WorkStage = { stageId, kind: "fitting", status: "running", startedAt: start, finishedAt: null, heartbeatAt: null };
    const result = project({ ...snapshot(), stages: [fitting] }).stages[0];
    expect(result).toMatchObject({ percent: null, completed: null, unit: null, elapsedMs: 120_000, heartbeatStatus: "not_received" });
    expect(result).not.toHaveProperty("counts");
  });

  it("preserves pending future outcomes as incomplete evaluation tasks", () => {
    const value = stage();
    if (value.kind === "fitting") throw new Error("Fixture is counted work.");
    const result = project({ ...snapshot(), stages: [{ ...value, kind: "evaluation_tasks",
      counts: { successful: 0, skipped: 0, failed: 0, pending: 10 } }] }).stages[0];
    expect(result).toMatchObject({ completed: 0, percent: 0, unit: "evaluation tasks", counts: { failed: 0, pending: 10 } });
  });

  it("rejects double counts, missing units, negative counts and invented totals", () => {
    const value = stage();
    if (value.kind === "fitting") throw new Error("Fixture is counted work.");
    for (const counts of [
      { ...value.counts, successful: 4 }, { ...value.counts, pending: 4 },
      { ...value.counts, failed: -1, pending: 7 }, { ...value.counts, successful: 3.5, pending: 4.5 },
    ]) expect(() => project({ ...snapshot(), stages: [{ ...value, counts }] })).toThrow();
  });

  it("has no percentage for an empty denominator", () => {
    const value = stage();
    if (value.kind === "fitting") throw new Error("Fixture is counted work.");
    expect(project({ ...snapshot(), stages: [{ ...value, denominator: { ...value.denominator, eligible: 0 },
      counts: { successful: 0, skipped: 0, failed: 0, pending: 0 } }] }).stages[0].percent).toBeNull();
  });

  it("reports heartbeat staleness without changing the saved run status", () => {
    const result = projectOperationalProgress(snapshot(), { now: "2026-09-01T12:03:00Z", staleAfterMs: 90_000 });
    expect(result.state).toBe("running");
    expect(result.stages[0]).toMatchObject({ status: "running", heartbeatStatus: "stale" });
  });

  it("retains completed work through cancellation and freezes terminal elapsed time", () => {
    const result = project({ ...snapshot(), state: "cancelled", stages: [{ ...stage(), status: "cancelled", finishedAt: heartbeat }] });
    expect(result.stages[0]).toMatchObject({ completed: 5, percent: 50, elapsedMs: 60_000, heartbeatStatus: "inactive" });
    expect(project({ ...snapshot(), state: "cancellation_requested", stages: [{ ...stage(), status: "cancellation_requested" }] }).state)
      .toBe("cancellation_requested");
  });

  it("rejects scores, arbitrary logs and sealed payloads at every envelope level", () => {
    for (const value of [
      { ...snapshot(), result: { auc: 0.9 } }, { ...snapshot(), log: "sealed outcome" },
      { ...snapshot(), stages: [{ ...stage(), outcome: 1 }] },
    ]) expect(() => project(value)).toThrow();
    const result = JSON.stringify(project(snapshot()));
    expect(result).not.toMatch(/auc|accuracy|outcome|resultPayload/);
  });

  it("rejects impossible clocks, duplicate stages and premature completion", () => {
    const base = snapshot();
    for (const value of [
      { ...base, stages: [stage(), stage()] },
      { ...base, stages: [{ ...stage(), heartbeatAt: "2026-09-01T12:03:00Z" }] },
      { ...base, stages: [{ ...stage(), startedAt: null }] },
      { ...base, stages: [{ ...stage(), status: "completed", finishedAt: heartbeat }] },
      { ...base, state: "completed_awaiting_reveal" },
    ]) expect(operationalSnapshotSchema.safeParse(value).success).toBe(false);
    expect(() => projectOperationalProgress(base, { now: start, staleAfterMs: 1 })).toThrow("precedes");
  });

  it("restores identical counters from persisted JSON without releasing results", () => {
    const value = snapshot(), counted = stage();
    if (counted.kind === "fitting") throw new Error("Fixture is counted work.");
    value.state = "completed_awaiting_reveal";
    value.stages = [{ ...counted, status: "completed", finishedAt: heartbeat,
      counts: { successful: 10, skipped: 0, failed: 0, pending: 0 } }];
    expect(project(JSON.parse(JSON.stringify(value)))).toEqual(project(value));
    expect(project(value)).not.toHaveProperty("results");
  });

  it("rejects every backwards stage clock without losing submillisecond precision", () => {
    const earlier = "2026-09-01T12:00:00.000001Z", later = "2026-09-01T12:00:00.000002Z";
    for (const value of [
      { ...stage(), startedAt: later, heartbeatAt: earlier },
      { ...stage(), status: "cancelled", startedAt: later, heartbeatAt: null, finishedAt: earlier },
      { ...stage(), status: "cancelled", startedAt: earlier, heartbeatAt: later, finishedAt: earlier },
    ]) expect(workStageSchema.safeParse(value).success).toBe(false);
  });

  it("rejects each event after its saved snapshot and a monitoring clock before it", () => {
    const earlier = "2026-09-01T12:00:00.000001Z", later = "2026-09-01T12:00:00.000002Z";
    const base = { ...snapshot(), recordedAt: earlier };
    for (const value of [
      { ...stage(), startedAt: later, heartbeatAt: later },
      { ...stage(), startedAt: start, heartbeatAt: later },
      { ...stage(), status: "cancelled", startedAt: start, heartbeatAt: null, finishedAt: later },
    ]) expect(operationalSnapshotSchema.safeParse({ ...base, stages: [value] }).success).toBe(false);
    expect(() => projectOperationalProgress({ ...base, recordedAt: later, stages: [] }, { now: earlier, staleAfterMs: 1 })).toThrow("precedes");
  });

  it("retains precision beyond six decimal places, including insignificant trailing zeros", () => {
    const earlier = "2026-09-01T12:00:00.123456789012345678901Z";
    const later = "2026-09-01T12:00:00.123456789012345678902Z";
    expect(workStageSchema.safeParse({ ...stage(), startedAt: later, heartbeatAt: earlier }).success).toBe(false);
    expect(workStageSchema.safeParse({ ...stage(), startedAt: earlier, heartbeatAt: later }).success).toBe(true);
    const equal = "2026-09-01T12:00:00.123456789012345678901000Z";
    expect(workStageSchema.safeParse({ ...stage(), startedAt: equal, heartbeatAt: earlier }).success).toBe(true);
  });

  it("normalizes timezone offsets while preserving fractional equality and order", () => {
    const at = "2026-09-01T12:00:00.000001Z";
    const equal = "2026-09-01T17:30:00.000001+05:30";
    const value = { ...snapshot(), recordedAt: at, stages: [{ ...stage(), startedAt: equal,
      heartbeatAt: "2026-09-01T08:00:00.000001-0400" }] };
    expect(projectOperationalProgress(value, { now: equal, staleAfterMs: 1 }).stages[0])
      .toMatchObject({ elapsedMs: 0, heartbeatAgeMs: 0, heartbeatStatus: "recent" });
    expect(operationalSnapshotSchema.safeParse({ ...value, recordedAt: "2026-09-01T17:30:00.000000+0530" }).success).toBe(false);
  });

  it("preserves minute precision and equality across dates and pre-epoch timestamps", () => {
    for (const [from, to] of [["2026-09-01T12:00Z", "2026-09-01T12:00:00.0000+0000"],
      ["1969-12-31T23:59:59.999999Z", "1970-01-01T00:59:59.999999+01:00"]]) {
      const value = { ...snapshot(), recordedAt: to, stages: [{ ...stage(), startedAt: from, heartbeatAt: to }] };
      expect(projectOperationalProgress(value, { now: to, staleAfterMs: 1 }).stages[0])
        .toMatchObject({ elapsedMs: 0, heartbeatAgeMs: 0, heartbeatStatus: "recent" });
    }
  });

  it("uses exact precision at the stale-heartbeat threshold, independently of display rounding", () => {
    const beat = "2026-09-01T12:00:00.123456789012345678901Z";
    const value = { ...snapshot(), recordedAt: beat, stages: [{ ...stage(), startedAt: start, heartbeatAt: beat }] };
    for (const [clock, expected] of [
      ["2026-09-01T12:00:00.124456789012345678901Z", "recent"],
      ["2026-09-01T12:00:00.124456789012345678902Z", "stale"],
    ]) expect(projectOperationalProgress(value, { now: clock, staleAfterMs: 1 }).stages[0].heartbeatStatus).toBe(expected);
  });

  it("reports nonzero submillisecond elapsed and heartbeat age for display", () => {
    const value = { ...snapshot(), recordedAt: "2026-09-01T12:00:00.000003Z",
      stages: [{ ...stage(), startedAt: "2026-09-01T12:00:00.000001Z", heartbeatAt: "2026-09-01T12:00:00.000002Z" }] };
    const result = projectOperationalProgress(value, { now: value.recordedAt, staleAfterMs: 1 }).stages[0];
    expect(result.elapsedMs).toBeCloseTo(0.002, 10);
    expect(result.heartbeatAgeMs).toBeCloseTo(0.001, 10);
  });
});
