// C7 R44 controls (reviewer-only; not in the repo).
import { describe, expect, it } from "vitest";
import { classifyExternalInputProofRows, externalInputProofByRun, verifiedRunAttribution } from "../externalInputProof";
import { unprovenSnapshotRow } from "../externalInputProof.fixtures";
import { FORGE_PRODUCER_IDENTITY_VERSION } from "../forgeProducerIdentity";
import { VERIFIED_FORGE_PRODUCER_CLOSURES } from "../verifiedForgeReleases";

const V = VERIFIED_FORGE_PRODUCER_CLOSURES.at(-1)!.closureSha256, V0 = VERIFIED_FORGE_PRODUCER_CLOSURES[0].closureSha256;
const stamp = (invocations: Array<string | null>, codeVersions: Array<string | null> = invocations.map(() => null)) =>
  ({ version: FORGE_PRODUCER_IDENTITY_VERSION, invocations, code_versions: codeVersions });
const row = (invocations: string | null, producer: unknown, extra: Record<string, unknown> = {}) => ({ run_id: "run", git_sha: "f".repeat(40),
  status: "succeeded", invocations, rolling_player_history_contract: null, producer_identity: producer, ...extra });

describe("C7 R44 resumed-run admission", () => {
  it.each([["1", [V]], ["2", [V, V]], ["5", [V, V, V, V, V]]] as const)("admits %s invocations of the same verified closure", (n, entries) => {
    expect(verifiedRunAttribution(row(n, stamp([...entries])))).toMatchObject({ basis: "verified_producer_closure", closureSha256: V });
  });
  it.each([
    ["a dropped stamp (2 invocations, 1 entry)", "2", stamp([V])],
    ["a padded stamp (1 invocation, 2 entries)", "1", stamp([V, V])],
    ["no resume record", null, stamp([V])],
    ["a non-numeric count", "two", stamp([V, V])],
    ["a padded count string", " 2", stamp([V, V])],
    ["an unknown earlier invocation", "2", stamp([null, V])],
    ["an unknown later invocation", "2", stamp([V, null])],
    ["two different verified closures", "2", stamp([V0, V])],
    ["a verified then unverified closure", "2", stamp([V, "1".repeat(64)])],
    ["a local code version on a resume", "2", stamp([V, V], [null, "local:abc"])],
    ["code_versions shorter than invocations", "2", { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [V, V], code_versions: [null] }],
    ["a pre-V2 stamp shape", "2", { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [V, V] }],
  ])("denies %s", (_label, n, producer) => {
    expect(verifiedRunAttribution(row(n as string | null, producer))).toBeNull();
  });
  it("still needs a single invocation for an unstamped legacy exact-SHA run", () => {
    const legacy = (n: string) => row(n, null, { git_sha: "538100d41ee87e721d2764b694f7bac8c2f2bb34" });
    expect(verifiedRunAttribution(legacy("1"))).toMatchObject({ basis: "verified_release" });
    expect(verifiedRunAttribution(legacy("2"))).toBeNull();
  });
  it("captured evidence still wins over a resumed verified stamp", () => {
    expect(externalInputProofByRun([unprovenSnapshotRow("run")], ["run"], [row("2", stamp([V, V]))]).has("run")).toBe(false);
  });
  it("OBSERVED (N1): classification still treats only single-invocation stamps as verified producers", () => {
    const status = classifyExternalInputProofRows([unprovenSnapshotRow("run")], ["run"], [row("2", stamp([V, V]))]).get("run")?.status;
    expect(status).toBe("unproven");
  });
});
