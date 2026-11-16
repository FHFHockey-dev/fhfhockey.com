// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createHash, X509Certificate } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertLiveGates, parsePilotArgs, planText, rehearsePilot, runTsaProbe } from "./forge-pregame-capture";
import { tsaProfile, trustFromProfile, type TsaProfile } from "../lib/projections/pregameCapture/tsaProfiles";
import { mintTimeStampResponse, TEST_TSA_POLICY } from "../lib/projections/pregameCapture/__fixtures__/testTsa";
import { u8 } from "../lib/projections/pregameCapture/der";

const fixtureCa = readFileSync(join(__dirname, "..", "lib", "projections", "pregameCapture", "__fixtures__", "tsa", "ca.crt"), "utf8");
/** A profile built on the TEST-ONLY fixture CA, unpinned like a profile before its first probe. */
const testProfile = (): TsaProfile => ({ id: "test-tsa", url: "https://tsa.invalid", anchorsPem: [fixtureCa], policies: [], extraCertsSha256: [],
  anchorSha256: [createHash("sha256").update(u8(new X509Certificate(fixtureCa).raw)).digest("hex")] });
const newOut = () => join(mkdtempSync(join(tmpdir(), "forge-probe-test-")), "out");

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
      "--approval", "tj-approval-1", "--code-version", "a".repeat(40), "--tsa-profile", "test-tsa-pinned",
      "--out", "/nonexistent/forge-pilot-out"]);
    const env = { FORGE_PREGAME_CAPTURE_ENABLED: "true", FORGE_PREGAME_CAPTURE_APPROVAL: "tj-approval-1" };
    const pinned = (id: string) => (id === "test-tsa-pinned" ? { ...testProfile(), policies: [TEST_TSA_POLICY] } : tsaProfile(id));
    expect(() => assertLiveGates(base, env, pinned)).not.toThrow();
    expect(() => assertLiveGates(base, {}, pinned)).toThrow("FORGE_PREGAME_CAPTURE_ENABLED");
    expect(() => assertLiveGates({ ...base, confirmGameId: 2026020301 }, env, pinned)).toThrow("--confirm-game-id");
    expect(() => assertLiveGates(base, { ...env, FORGE_PREGAME_CAPTURE_APPROVAL: "other" }, pinned)).toThrow("--approval");
    expect(() => assertLiveGates({ ...base, codeVersion: "HEAD" }, env, pinned)).toThrow("--code-version");
    expect(() => assertLiveGates({ ...base, out: "/tmp" }, env, pinned)).toThrow("--out");
    expect(() => assertLiveGates({ ...base, tsaProfile: undefined }, env, pinned)).toThrow("--tsa-profile is required");
    // A profile whose policy is not pinned is not usable for a capture.
    expect(() => assertLiveGates({ ...base, tsaProfile: "test-tsa-unpinned" }, env,
      (id) => (id === "test-tsa-unpinned" ? testProfile() : pinned(id)))).toThrow("tsa_profile_policy_unpinned");
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

  it("pins the DigiCert profile: embedded G4 anchor fingerprint, probe-observed policy and cross-signed root; capture refuses an unpinned policy", () => {
    const profile = tsaProfile("digicert-g4-v1");
    expect(profile.url).toBe("http://timestamp.digicert.com");
    expect(profile.policies).toEqual(["2.16.840.1.114412.7.1"]);
    expect(profile.extraCertsSha256).toEqual(["33846b545a49c9be4903c60e01713c1bd4e4ef31ea65cd95d69e62794f30b941"]);
    expect(profile.fallbackAccuracyMicros).toBe(BigInt(60_000_000)); // D3, TJ 2026-11-15
    expect(() => trustFromProfile(profile, "probe")).not.toThrow();
    expect(() => trustFromProfile(profile, "capture")).not.toThrow();
    expect(() => trustFromProfile({ ...profile, policies: [] }, "capture")).toThrow("tsa_profile_policy_unpinned");
    expect(() => trustFromProfile({ ...profile, anchorSha256: ["0".repeat(64)] }, "probe")).toThrow("tsa_profile_anchor_mismatch");
    expect(() => tsaProfile("unknown")).toThrow("Unknown TSA profile");
  });

  it("probe (offline, test TSA): passes, retains request/response/report privately, and proposes the observed pin", async () => {
    const out = newOut();
    const result = await runTsaProbe({ profile: testProfile(), out,
      tsa: { stamp: async (request) => mintTimeStampResponse(request, { genTimeMicros: BigInt(Date.now()) * BigInt(1000) }) } });
    expect(result).toMatchObject({ pass: true, verdict: "pass", profile: "test-tsa" });
    expect(result.proposedPin).toMatchObject({ policy: TEST_TSA_POLICY, accuracyPresent: true });
    expect(result.proposedPin!.chain.length).toBeGreaterThan(0);
    expect(result.inspection).toMatchObject({ status: 0, signedDataVersion: 3, signer: { essVersion: "v2", unsignedAttributesPresent: false, trailingElements: 0 } });
    expect(result.files.sort()).toEqual(["probe-digest.json", "probe-report.json", "probe-request.tsq", "probe-response.tsr"]);
    expect(statSync(out).mode & 0o777).toBe(0o700);
    expect(statSync(join(out, "probe-response.tsr")).mode & 0o777).toBe(0o600);
  });

  it("probe reports each failing property instead of a bare failure", async () => {
    const noAccuracy = await runTsaProbe({ profile: testProfile(), out: newOut(),
      tsa: { stamp: async (request) => mintTimeStampResponse(request, { genTimeMicros: BigInt(Date.now()) * BigInt(1000), accuracyMillis: null }) } });
    expect(noAccuracy).toMatchObject({ pass: false, verdict: "strict_verification_failed:tsa_accuracy_missing" });
    expect(noAccuracy.inspection!.tstInfo.accuracy.present).toBe(false);
    const wrongSigner = await runTsaProbe({ profile: testProfile(), out: newOut(),
      tsa: { stamp: async (request) => mintTimeStampResponse(request, { genTimeMicros: BigInt(Date.now()) * BigInt(1000), signer: "plain" }) } });
    expect(wrongSigner.verdict).toBe("strict_verification_failed:tsa_signer_not_timestamping");
    expect(wrongSigner.inspection!.certificates[0].ekuCritical).toBe(null);
    const down = await runTsaProbe({ profile: testProfile(), out: newOut(), tsa: { stamp: async () => { throw new Error("ECONNREFUSED"); } } });
    expect(down).toMatchObject({ pass: false, verdict: "request_failed:ECONNREFUSED" });
  });

  it("probe refuses to reuse an output directory", async () => {
    const out = newOut();
    await runTsaProbe({ profile: testProfile(), out, tsa: { stamp: async (request) => mintTimeStampResponse(request, { genTimeMicros: BigInt(Date.now()) * BigInt(1000) }) } });
    expect(existsSync(out)).toBe(true);
    await expect(runTsaProbe({ profile: testProfile(), out, tsa: { stamp: async () => Buffer.alloc(0) } })).rejects.toThrow("new directory");
  });
});
