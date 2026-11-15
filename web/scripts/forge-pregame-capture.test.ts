// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assertLiveGates, parsePilotArgs, planText, rehearsePilot } from "./forge-pregame-capture";

describe("forge-pregame-capture pilot script", () => {
  it("defaults to a plan that needs no environment, credentials or network", () => {
    const options = parsePilotArgs([]);
    expect(options.mode).toBe("plan");
    expect(planText(options)).toContain("plan only");
  });

  it("refuses ambiguous modes and unknown arguments", () => {
    expect(() => parsePilotArgs(["--rehearse", "--execute"])).toThrow("Choose one mode");
    expect(() => parsePilotArgs(["--live"])).toThrow("Unknown argument");
  });

  it("refuses a live capture unless every gate holds", () => {
    const base = parsePilotArgs(["--execute", "--game-id", "2026020300", "--confirm-game-id", "2026020300", "--slate-date", "2026-11-16",
      "--approval", "tj-approval-1", "--code-version", "a".repeat(40), "--tsa-url", "https://tsa.invalid", "--tsa-anchor", "/dev/null",
      "--out", "/nonexistent/forge-pilot-out"]);
    const env = { FORGE_PREGAME_CAPTURE_ENABLED: "true", FORGE_PREGAME_CAPTURE_APPROVAL: "tj-approval-1" };
    expect(() => assertLiveGates(base, env)).not.toThrow();
    expect(() => assertLiveGates(base, {})).toThrow("FORGE_PREGAME_CAPTURE_ENABLED");
    expect(() => assertLiveGates({ ...base, confirmGameId: 2026020301 }, env)).toThrow("--confirm-game-id");
    expect(() => assertLiveGates(base, { ...env, FORGE_PREGAME_CAPTURE_APPROVAL: "other" })).toThrow("--approval");
    expect(() => assertLiveGates({ ...base, codeVersion: "HEAD" }, env)).toThrow("--code-version");
    expect(() => assertLiveGates({ ...base, out: "/tmp" }, env)).toThrow("--out");
    expect(() => assertLiveGates({ ...base, tsaAnchor: undefined }, env)).toThrow("--tsa-anchor");
  });

  it("rehearses offline end to end: one exact game, no forecast writes, late and ambiguous captures refused, verified by T−60", async () => {
    const result = await rehearsePilot();
    const byName = Object.fromEntries(result.cases.map((c) => [c.name, c]));
    expect(result.networkAttempts).toBe(0);
    expect(byName["qualified-one-game"]).toMatchObject({ outcome: "qualified", saveCalls: 1 });
    expect(byName["qualified-one-game"].checks).toMatchObject({
      oneExactGame: true, readsOnlyAllowlisted: true, packetHasNoOutputs: true, packetCoversCandidates: true,
      noWritesReachedInputSources: true, noForecastOrRevisionSurface: true, independentlyReverified: true, ackAtOrBeforeTminus60: true,
    });
    expect(byName["late-start-refused"]).toMatchObject({ outcome: "never_dispatched", reason: "claim_refused:late_start", saveCalls: 0 });
    expect(byName["ambiguous-save-committed-then-settled"]).toMatchObject({ outcome: "qualified", saveCalls: 1 });
    expect(byName["ambiguous-save-not-committed-fenced"]).toMatchObject({ outcome: "save_unknown", saveCalls: 1 });
    expect(byName["ambiguous-claim-left-for-sweeper"]).toMatchObject({ outcome: null, reason: "claim_ambiguous_left_for_sweeper", saveCalls: 0 });
    expect(byName["commit-after-cutoff-not-qualified"]).toMatchObject({ outcome: "saved_without_valid_witness" });
    expect(byName["commit-after-cutoff-not-qualified"].reason).toContain("ack_after_deadline");
    expect(byName["token-in-time-final-readback-late"]).toMatchObject({ outcome: "saved_without_valid_witness", saveCalls: 1 });
    expect(byName["token-in-time-final-readback-late"].reason).toBe("final_readback_after_deadline");
    for (const c of result.cases) expect(Object.values(c.checks).every(Boolean), c.name).toBe(true);
    expect(result.ok).toBe(true);
  }, 120_000);
});
