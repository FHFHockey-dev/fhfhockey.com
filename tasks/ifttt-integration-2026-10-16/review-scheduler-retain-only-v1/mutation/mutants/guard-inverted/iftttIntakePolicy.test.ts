import { afterEach, describe, expect, it, vi } from "vitest";
import { iftttIntakeConfiguration, parseIftttIntakePolicy } from "./iftttIntakePolicy";

const scope = { table: "line_source_ifttt_events" as const, sourceGroup: "fixture", sourceKey: "fixture-reporter", sourceAccount: "reporter" };
const policy = { version: "ifttt-intake-v1", id: "synthetic", startsAt: "2026-10-16T12:00:00Z", endsAt: "2026-10-16T13:00:00Z", maxAttempts: 4, maxReceipts: 2, scopes: [scope] };
afterEach(() => vi.unstubAllEnvs());
describe("explicit IFTTT intake contract", () => {
  it("normalizes exact handles and rejects duplicate normalized routes", () => {
    expect(parseIftttIntakePolicy({ ...policy, scopes: [{ ...scope, sourceAccount: "@Reporter" }] }).scopes).toEqual([scope]);
    expect(() => parseIftttIntakePolicy({ ...policy, scopes: [scope, { ...scope, sourceAccount: "@Reporter" }] })).toThrow("Duplicate");
  });
  it.each([
    { maxAttempts: 0 }, { maxReceipts: 0 }, { maxAttempts: 1.5 }, { maxReceipts: Number.MAX_SAFE_INTEGER + 1 },
    { startsAt: "2026-10-16T12:00:00" }, { endsAt: policy.startsAt }, { endsAt: "2026-02-30T13:00:00Z" },
    { scopes: [] }, { scopes: [{ ...scope, sourceKey: "*" }] }, { scopes: [{ ...scope, extra: true }] }, { extra: true },
  ])("rejects incomplete or widening policy %j", (override) => {
    expect(() => parseIftttIntakePolicy({ ...policy, ...override })).toThrow();
  });
  it("preserves legacy default-off only when pilot configuration is absent", () => {
    vi.stubEnv("IFTTT_RECEIPT_VARIANTS_ENABLED", "false"); vi.stubEnv("IFTTT_INTAKE_POLICY", undefined); vi.stubEnv("IFTTT_INTAKE_STOP", undefined);
    expect(iftttIntakeConfiguration(scope)).toEqual({ controlled: false });
    vi.stubEnv("IFTTT_INTAKE_POLICY", ""); expect(() => iftttIntakeConfiguration(scope)).toThrow();
  });
  it.each(["missing-policy", "flag-off", "stop", "bad-stop", "live-mode", "interpretation-off", "outside-scope"])("fails closed for %s", (fault) => {
    vi.stubEnv("IFTTT_RECEIPT_VARIANTS_ENABLED", fault === "flag-off" ? "false" : "true");
    vi.stubEnv("IFTTT_INTAKE_POLICY", fault === "missing-policy" ? undefined : JSON.stringify(policy));
    vi.stubEnv("IFTTT_INTAKE_STOP", fault === "stop" ? "true" : fault === "bad-stop" ? "typo" : "false");
    vi.stubEnv("TWEET_CLAIMS_MODE", fault === "live-mode" ? "live" : "shadow");
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", fault === "interpretation-off" ? "false" : "true");
    expect(() => iftttIntakeConfiguration(fault === "outside-scope" ? { ...scope, sourceKey: "other" } : scope)).toThrow();
  });
});
