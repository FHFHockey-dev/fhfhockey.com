// C7 R41 controls (reviewer-only; not in the repo).
import { afterEach, describe, expect, it } from "vitest";
import { externalInputProofByRun, verifiedRunAttribution } from "../externalInputProof";
import { provenSnapshotRow, unprovenSnapshotRow } from "../externalInputProof.fixtures";
import { FORGE_PRODUCER_IDENTITY_VERSION, producerIdentityStamp } from "../forgeProducerIdentity";

const VERIFIED = "0e9876269d5dd645c7c7f7ec02373fda81d7021f9e8b3b11bad9342a4d4f8e4f";
const OTHER = "1".repeat(64);
const SHA = "f".repeat(40);
const row = (overrides: Record<string, unknown> = {}) => ({ run_id: "run", git_sha: SHA, status: "succeeded", invocations: "1",
  rolling_player_history_contract: null, producer_identity: { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [VERIFIED] }, ...overrides });

afterEach(() => { delete process.env.FORGE_PRODUCER_CLOSURE_SHA256; });

describe("C7 R41 producer-closure admission", () => {
  it("admits a single verified stamp on any released full SHA (the SHA is not trusted, the closure is)", () => {
    expect(verifiedRunAttribution(row())).toMatchObject({ basis: "verified_producer_closure", closureSha256: VERIFIED, releaseSha: SHA });
  });
  it.each([
    ["a resume appended a second (even identical) closure", { producer_identity: { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [VERIFIED, VERIFIED] } }],
    ["a resume with an unknown earlier invocation", { producer_identity: { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [null, VERIFIED] } }],
    ["resume count 2 with one stamp", { invocations: "2" }],
    ["an unknown (null) closure", { producer_identity: { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [null] } }],
    ["an unverified closure", { producer_identity: { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [OTHER] } }],
    ["an upper-case closure", { producer_identity: { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [VERIFIED.toUpperCase()] } }],
    ["another stamp version", { producer_identity: { version: "forge-producer-closure-v0", invocations: [VERIFIED] } }],
    ["an empty stamp", { producer_identity: { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [] } }],
    ["a malformed stamp on the verified exact SHA (no fallback to the SHA)", { git_sha: "538100d41ee87e721d2764b694f7bac8c2f2bb34", producer_identity: { bad: true } }],
    ["a local SHA", { git_sha: "local:unknown" }],
    ["a short SHA", { git_sha: "538100d41" }],
    ["a failed run", { status: "failed" }],
  ])("denies %s", (_label, overrides) => {
    expect(verifiedRunAttribution(row(overrides))).toBeNull();
  });
  it("captured evidence still wins: a non-proving snapshot denies a verified stamp", () => {
    expect(externalInputProofByRun([unprovenSnapshotRow("run")], ["run"], [row()]).has("run")).toBe(false);
    expect(externalInputProofByRun([provenSnapshotRow("run")], ["run"], [row({ producer_identity: { bad: true } })]).get("run")?.basis).toBe("captured_snapshot");
  });
  it("OPEN (V2): unbuilt code stamps whatever the runtime env says, so an env label plus a full GIT_SHA admits", () => {
    process.env.FORGE_PRODUCER_CLOSURE_SHA256 = VERIFIED;
    const stamp = producerIdentityStamp();
    expect(stamp.invocations).toEqual([VERIFIED]);
    expect(verifiedRunAttribution(row({ producer_identity: stamp }))).toMatchObject({ basis: "verified_producer_closure" });
  });
});
