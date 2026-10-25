import { describe, expect, it } from "vitest";
import { checkInputFieldHealth, type HealthCheckSpecification, type InputHealthRow } from "./dataHealth";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const spec = (): HealthCheckSpecification => ({
  reportId: uuid(1), inputManifestId: uuid(2), policyHash: "a".repeat(64), cohortId: uuid(3),
  checkedAt: "2026-09-02T00:00:00Z", predictionCutoff: "2026-09-01T12:00:00Z", maxAgeMs: 86400000,
  requireAuthenticHistory: false, blockingCodes: ["missing", "null", "malformed", "duplicate", "identity", "units", "strength", "source_mismatch"],
  field: { source: "fixture", table: "player_games", field: "goals_mean", unit: "count", strength: "all", minimum: 0, maximum: null, allowFractional: true },
  supersedes: null,
});
const row = (playerId = 1): InputHealthRow => ({
  identity: { playerId, gameId: 1 }, source: "fixture", table: "player_games", field: "goals_mean", unit: "count", strength: "all",
  value: 0.35, observedAt: "2026-09-01T10:00:00Z", availableAt: "2026-09-01T10:05:00Z", capturedAt: "2026-09-01T10:10:00Z", revisionId: "synthetic-r1",
});

describe("Testing Grounds input health", () => {
  it("distinguishes fractional means and valid zero from missing and null", () => {
    const result = checkInputFieldHealth(spec(), [row(1), { ...row(2), value: 0 }, { ...row(3), value: undefined }, { ...row(4), value: null }]);
    expect(result.counts).toEqual({ inputRows: 4, validNumericRows: 2, validZeroRows: 1, missingRows: 1, nullRows: 1,
      affectedRows: 2, unaffectedRows: 2, automaticallyExcludedRows: 0 });
    expect(result.status).toBe("blocked");
    expect(result.issues.map(issue => issue.code)).toEqual(["missing", "null"]);
  });

  it("does not coerce strings, NaN, infinities, negatives or invalid integer-only values", () => {
    for (const value of ["0", Number.NaN, Infinity, -1, {}, []]) {
      expect(checkInputFieldHealth(spec(), [{ ...row(), value }]).issues.map(issue => issue.code)).toContain("malformed");
    }
    const whole = spec(); whole.field.allowFractional = false;
    expect(checkInputFieldHealth(whole, [row()]).issues.map(issue => issue.code)).toContain("malformed");
  });

  it("reports every duplicate row with a bounded safe sample without silently dropping it", () => {
    const result = checkInputFieldHealth(spec(), Array.from({ length: 12 }, () => row()));
    const duplicate = result.issues.find(issue => issue.code === "duplicate")!;
    expect(duplicate).toMatchObject({ affectedRows: 12, omittedSamples: 2 });
    expect(duplicate.samples).toHaveLength(10);
    expect(result.counts).toMatchObject({ inputRows: 12, affectedRows: 12, automaticallyExcludedRows: 0 });
  });

  it("checks source mapping, IDs, units and strength without reflecting unsafe values", () => {
    const secret = "Bearer private-token; sealed outcome=1";
    const result = checkInputFieldHealth(spec(), [{ ...row(), source: secret, table: secret, field: secret,
      identity: { playerId: secret, gameId: 1 }, value: secret, unit: secret, strength: secret, revisionId: secret }]);
    expect(result.issues.map(issue => issue.code)).toEqual(["malformed", "identity", "units", "strength", "source_mismatch"]);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.issues.every(issue => issue.samples[0].identity === null)).toBe(true);
  });

  it("makes historical uncertainty explicit without claiming authenticity from clocks", () => {
    const result = checkInputFieldHealth(spec(), [{ ...row(), availableAt: null, capturedAt: "2026-09-01T13:00:00Z" }]);
    expect(result).toMatchObject({ status: "checked", historyClassification: "reconstructed_history_diagnostic" });
    expect(result.issues.map(issue => issue.code)).toEqual(["availability_unknown", "later_capture"]);
    expect(result.authenticityLimitation).toContain("not independent proof");
    expect(checkInputFieldHealth({ ...spec(), requireAuthenticHistory: true }, [{ ...row(), availableAt: null }]).status).toBe("blocked");
  });

  it("blocks known future information even when the caller declares no discretionary blockers", () => {
    const result = checkInputFieldHealth({ ...spec(), blockingCodes: [] }, [{ ...row(),
      availableAt: "2026-09-01T12:00:00.000001Z", capturedAt: "2026-09-01T12:00:00.000002Z" }]);
    expect(result.status).toBe("blocked");
    expect(result.issues.find(issue => issue.code === "historically_unavailable")?.severity).toBe("blocker");
  });

  it("uses explicit age policy and rejects malformed or contradictory provenance clocks", () => {
    expect(checkInputFieldHealth({ ...spec(), maxAgeMs: 1000 }, [row()]).issues.map(issue => issue.code)).toContain("stale");
    for (const change of [
      { observedAt: "2026-02-30T10:00:00Z" }, { availableAt: "not a timestamp" },
      { capturedAt: "2026-08-31T10:00:00Z" }, { capturedAt: "2026-09-03T10:00:00Z" },
    ]) expect(checkInputFieldHealth(spec(), [{ ...row(), ...change }]).issues.find(issue => issue.code === "invalid_clock")?.severity).toBe("blocker");
  });

  it("requires new manifest and report identities after repair, preserving the old failure", () => {
    const old = checkInputFieldHealth(spec(), [{ ...row(), value: null }]);
    const saved = JSON.stringify(old);
    const next = { ...spec(), reportId: uuid(4), inputManifestId: uuid(5), supersedes: { reportId: uuid(1), inputManifestId: uuid(2) } };
    expect(checkInputFieldHealth(next, [row()]).status).toBe("checked");
    expect(JSON.stringify(old)).toBe(saved);
    expect(() => checkInputFieldHealth({ ...next, reportId: uuid(1) }, [row()])).toThrow();
    expect(() => checkInputFieldHealth({ ...next, inputManifestId: uuid(2) }, [row()])).toThrow();
  });

  it("returns only a navigation link with no execution query and does no automatic repair", () => {
    const input = row(); const before = JSON.stringify(input);
    const result = checkInputFieldHealth(spec(), [input]);
    expect(result.investigation).toMatchObject({ href: "/db/runner", action: "navigate_only" });
    expect(result.counts.automaticallyExcludedRows).toBe(0);
    expect(JSON.stringify(input)).toBe(before);
    expect(result.status).toBe("checked");
  });

  it("rejects unknown specification fields and inverted field ranges", () => {
    expect(() => checkInputFieldHealth({ ...spec(), repair: "run now" }, [row()])).toThrow();
    expect(() => checkInputFieldHealth({ ...spec(), field: { ...spec().field, minimum: 2, maximum: 1 } }, [row()])).toThrow();
  });
});
