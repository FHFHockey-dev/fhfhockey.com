import { describe, expect, it } from "vitest";
import { decodeResearchToi, fixedKernelSensitivity, inspectSkaterParticipationFrame,
  type SkaterResearchRow } from "./nativeSkaterParticipationResearch";

const row = (gameId: number, labels: Partial<SkaterResearchRow> = {}): SkaterResearchRow =>
  ({ gameId, dress: null, credit: null, positiveMinutes: null, ...labels });

describe("disconnected skater participation frame", () => {
  it("retains unknown credit, including a nondressed row", () => {
    const result = inspectSkaterParticipationFrame([1, 2], [row(1), row(2, { dress: false })]);
    expect(result.observed.credit).toEqual({ yes: 0, no: 0, unknown: 2 });
    expect(result.feasibleRows[1].cells).toEqual(["000", "010"]);
    expect(result.frameRates?.credit).toEqual({ lower: { numerator: "0", denominator: "1" }, upper: { numerator: "1", denominator: "1" } });
    expect(result.targetParticipation).toBeNull();
  });
  it("derives compatible credit and dress from an explicitly supplied positive-minute label", () => {
    const result = inspectSkaterParticipationFrame([1, 2], [row(1, { positiveMinutes: true }), row(2)]);
    expect(result.feasibleRows[0].cells).toEqual(["111"]);
    expect(result.frameRates?.credit?.lower).toEqual({ numerator: "1", denominator: "2" });
    // Inference does not rewrite which labels were actually observed.
    expect(result.observed.credit.unknown).toBe(2);
  });
  it("does not convert zero minutes into noncredit", () => {
    const result = inspectSkaterParticipationFrame([1], [row(1, { positiveMinutes: false, dress: true })]);
    expect(result.feasibleRows[0].cells).toEqual(["100", "110"]);
  });
  it("withholds every bound on an impossible cell instead of dropping it", () => {
    const result = inspectSkaterParticipationFrame([1, 2], [row(1), row(2, { credit: false, positiveMinutes: true })]);
    expect(result.status).toBe("invalid");
    expect(result.frameRates).toBeNull();
    expect(result.findings).toContainEqual({ code: "incompatible_joint_labels", gameId: 2 });
  });
  it.each([
    { ids: [], rows: [] },
    { ids: [1, 1], rows: [row(1), row(1)] },
    { ids: [1, 2], rows: [row(1)] },
    { ids: [1], rows: [row(2)] },
    { ids: [1, 2], rows: [row(1), row(1)] },
    { ids: [Number.MAX_SAFE_INTEGER + 1], rows: [row(Number.MAX_SAFE_INTEGER + 1)] },
  ])("rejects incomplete/invalid denominator identities: $ids", ({ ids, rows }) => {
    expect(inspectSkaterParticipationFrame(ids, rows).frameRates).toBeNull();
  });
  it("rejects undefined labels rather than silently treating them as unknown", () => {
    expect(inspectSkaterParticipationFrame([1], [row(1, { credit: undefined })]).findings)
      .toContainEqual({ code: "invalid_label", gameId: 1 });
  });
  it("keeps a completely labelled finite-frame rate distinct from a forecast", () => {
    const result = inspectSkaterParticipationFrame([1], [row(1, { dress: true, credit: true, positiveMinutes: false })]);
    expect(result.completeJointRows).toBe(1);
    expect(result.expectedHitsGivenGamePlayed).toBeNull();
    expect(result.qualificationEligible).toBe(false);
  });
});

describe("research TOI decoding and fixed-kernel arithmetic", () => {
  it.each([["00:00", 0], ["19:47", 1187], ["60:00", 3600], [null, null], ["", null],
    ["1:60", null], ["1:2", null], [-1, null], ["1.5", null], ["00:01", 1]])("decodes %s lexically", (input, expected) => {
    expect(decodeResearchToi(input)).toBe(expected);
  });
  it("multiplies exact bounds without adding independent dress/minute factors", () => {
    expect(fixedKernelSensitivity({ lower: { numerator: "2", denominator: "3" }, upper: { numerator: "1", denominator: "1" } },
      { numerator: "1", denominator: "4" })).toEqual({ lower: { numerator: "1", denominator: "6" }, upper: { numerator: "1", denominator: "4" } });
  });
  it("rejects inverted probabilities and zero denominators", () => {
    expect(() => fixedKernelSensitivity({ lower: { numerator: "1", denominator: "1" }, upper: { numerator: "0", denominator: "1" } },
      { numerator: "1", denominator: "4" })).toThrow();
    expect(() => fixedKernelSensitivity({ lower: { numerator: "0", denominator: "1" }, upper: { numerator: "1", denominator: "1" } },
      { numerator: "1", denominator: "0" })).toThrow();
  });
});
