// C7 R42 controls (reviewer-only; not in the repo).
import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyExternalInputProofRows, verifiedRunAttribution } from "../externalInputProof";
import { provenSnapshotRow } from "../externalInputProof.fixtures";
import { FORGE_PRODUCER_IDENTITY_VERSION, producerIdentityStamp } from "../forgeProducerIdentity";
import { VERIFIED_FORGE_PRODUCER_CLOSURES } from "../verifiedForgeReleases";

const VERIFIED = VERIFIED_FORGE_PRODUCER_CLOSURES[0].closureSha256;
const row = (overrides: Record<string, unknown> = {}) => ({ run_id: "run", git_sha: "f".repeat(40), status: "succeeded", invocations: "1",
  rolling_player_history_contract: null, producer_identity: { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [VERIFIED], code_versions: [null] }, ...overrides });

afterEach(() => { vi.unstubAllEnvs(); delete (globalThis as any).__FORGE_PRODUCER_CLOSURE_SHA256__; });

describe("C7 R42 V2", () => {
  it("unbuilt code ignores the old env var and FORGE_CODE_VERSION alone cannot add a closure", () => {
    vi.stubEnv("FORGE_PRODUCER_CLOSURE_SHA256", VERIFIED); vi.stubEnv("FORGE_CODE_VERSION", VERIFIED);
    expect(producerIdentityStamp().invocations).toEqual([null]);
  });
  it("OBSERVED: a runtime global named like the bundler constant is read by unbuilt code (needs code or a NODE_OPTIONS preload, not an env value)", () => {
    (globalThis as any).__FORGE_PRODUCER_CLOSURE_SHA256__ = VERIFIED;
    expect(producerIdentityStamp().invocations).toEqual([VERIFIED]);
  });
  it("OBSERVED: a stamp in the pre-V2 format (no code_versions) with a verified closure is admitted", () => {
    expect(verifiedRunAttribution(row({ producer_identity: { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [VERIFIED] } })))
      .toMatchObject({ basis: "verified_producer_closure" });
  });
  it.each([["local:abc"], ["local:"]])("denies a %s code version even with a verified closure and full SHA", version => {
    expect(verifiedRunAttribution(row({ producer_identity: { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [VERIFIED], code_versions: [version] } }))).toBeNull();
  });
  it("a code_versions array of the wrong length is malformed and denies", () => {
    expect(verifiedRunAttribution(row({ producer_identity: { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [VERIFIED], code_versions: [] } }))).toBeNull();
  });
});

describe("C7 R42 F4 classification", () => {
  it("OBSERVED: verified-code capture with a malformed receipt (claim present) classifies as contradicted", () => {
    const snapshot = { ...provenSnapshotRow("r"), captured_reads: { ...provenSnapshotRow("r").captured_reads!, readCount: 0 } };
    expect(classifyExternalInputProofRows([snapshot], ["r"], [row({ run_id: "r" })]).get("r")?.status).toBe("contradicted");
  });
  it("unverified-code capture without the claim is unproven, not contradicted", () => {
    const snapshot = { ...provenSnapshotRow("r"), external_fantasy_input_contract: null };
    expect(classifyExternalInputProofRows([snapshot], ["r"], [row({ run_id: "r", producer_identity: null, git_sha: "1".repeat(40) })]).get("r")?.status).toBe("unproven");
  });
});
