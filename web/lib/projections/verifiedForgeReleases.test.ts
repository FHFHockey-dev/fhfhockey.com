import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { VERIFIED_FORGE_PRODUCER_CLOSURES, VERIFIED_FORGE_RELEASES, verifiedForgeProducerClosure, verifiedForgeRelease } from "./verifiedForgeReleases";

const repoRoot = resolve(__dirname, "../../..");
const fileSha256 = (path: string) => createHash("sha256").update(readFileSync(path, "utf8")).digest("hex");
/** Made by the verifier as it stands: changing either script means re-verifying every listed entry. */
const currentVerifier = () => ({ verifierSha256: fileSha256(resolve(__dirname, "../../scripts/verify-forge-release-sha.ts")),
  closureWalkerSha256: fileSha256(resolve(__dirname, "../../scripts/forge-producer-closure.ts")) });

describe("verified FORGE releases", () => {
  it("lists only the individually verified production release 538100d41, by its full SHA", () => {
    expect(VERIFIED_FORGE_RELEASES.map(release => release.sha)).toEqual(["538100d41ee87e721d2764b694f7bac8c2f2bb34"]);
  });

  it.each(VERIFIED_FORGE_RELEASES.map(release => [release.sha, release] as const))(
    "binds %s to its own passing verifier receipt", (sha, release) => {
      expect(sha).toMatch(/^[0-9a-f]{40}$/);
      const text = readFileSync(resolve(repoRoot, release.receipt), "utf8");
      expect(createHash("sha256").update(text).digest("hex")).toBe(release.receiptSha256);
      const receipt = JSON.parse(text);
      expect(receipt).toMatchObject({ version: release.verifierVersion, sha, verified: true, findings: [],
        closure: { modulesSha256: release.closureSha256 } });
      expect(receipt).toMatchObject(currentVerifier());
      // The closure really is the FORGE run path, fallbacks and bootstrap included.
      expect(receipt.closure.modules).toEqual(expect.arrayContaining(["lib/projections/run-forge-projections.ts",
        "lib/projections/seasonBootstrap.ts", "lib/projections/stages/skater-stage.ts", "lib/projections/queries/skater-queries.ts"]));
    });

  it.each(VERIFIED_FORGE_PRODUCER_CLOSURES.map(closure => [closure.closureSha256, closure] as const))(
    "binds producer closure %s to its own passing verifier receipt", (closureSha256, closure) => {
      expect(closureSha256).toMatch(/^[0-9a-f]{64}$/);
      const text = readFileSync(resolve(repoRoot, closure.receipt), "utf8");
      expect(createHash("sha256").update(text).digest("hex")).toBe(closure.receiptSha256);
      const receipt = JSON.parse(text);
      // Commit-backed: the receipt verifies an archived commit whose tree reproduces this closure, never an uncommitted
      // worktree or export (C7 R42 A1).
      expect(closure.commit).toMatch(/^[0-9a-f]{40}$/);
      expect(receipt).toMatchObject({ version: closure.verifierVersion, sha: closure.commit, verified: true, findings: [],
        ...currentVerifier(), producerIdentity: { version: "forge-producer-closure-v1", closureSha256 },
        closure: { modulesSha256: closureSha256 } });
      expect(receipt.source).toBeUndefined();
      expect(receipt.commit).toMatchObject({ tree: expect.stringMatching(/^[0-9a-f]{40}$/) });
      expect(receipt.closure.modules).toEqual(expect.arrayContaining(["lib/projections/forgeProducerIdentity.ts",
        "lib/projections/queries/run-lifecycle-queries.ts", "lib/projections/seasonBootstrap.ts"]));
      // Admission stays outside what it admits.
      expect(receipt.closure.modules).not.toContain("lib/projections/verifiedForgeReleases.ts");
      expect(receipt.closure.modules).not.toContain("lib/projections/externalInputProof.ts");
    });

  it("lists each commit-backed producer closure, the release candidate's included", () => {
    expect(VERIFIED_FORGE_PRODUCER_CLOSURES.map(closure => [closure.closureSha256, closure.commit])).toEqual([
      ["4c06fd9e2b5a5d880f594cb2668b81eaa0c54553de525a73f477d4eebf909993", "595ab13d9773808057b49cc3ed91d9eaca8ed317"],
      ["c1f0129aca9b2520cbd922cf81c292661b1499fa50b024f76ca6283d362cc4aa", "6fb1812c19ecd182e895b3708296018bc842fcf0"],
      ["87edd78f5dfa96eded8a32927ef184d9266995edf52f395cf5ac6b8565c64f97", "5aa9ba5e0e9e86abf515fd7a30db441f6f5b1592"],
      ["5644e3fdb1e230e0a063a27b52519cc8e70b88272e92f27ca5aadc8f53d1dea4", "02153acbaf1ed02c0c294ba14a75e8af195354f3"],
    ]);
  });

  it("matches only an exact closure hash", () => {
    const closure = VERIFIED_FORGE_PRODUCER_CLOSURES[0].closureSha256;
    expect(verifiedForgeProducerClosure(closure)?.closureSha256).toBe(closure);
    for (const near of [closure.slice(0, 63), `${closure}0`, closure.toUpperCase(), "1".repeat(64), VERIFIED_FORGE_RELEASES[0].sha, null]) {
      expect(verifiedForgeProducerClosure(near), String(near)).toBeNull();
    }
  });

  it("matches only the exact full SHA", () => {
    const sha = VERIFIED_FORGE_RELEASES[0].sha;
    expect(verifiedForgeRelease(sha)?.sha).toBe(sha);
    for (const near of [sha.slice(0, 9), sha.slice(0, 39), `${sha}0`, sha.toUpperCase(), ` ${sha}`, `local:${sha}`, "local:unknown",
      "bd337d97aefd959832b3466037d163f320a23d99", null, undefined, 538100]) {
      expect(verifiedForgeRelease(near), String(near)).toBeNull();
    }
  });

  it("keeps the pre-removal release's receipt as a failed verification", () => {
    const receipt = JSON.parse(readFileSync(resolve(repoRoot,
      "tasks/artifacts/projection-table-audit-2026-10-26/release-verification/bd337d97aefd959832b3466037d163f320a23d99.json"), "utf8"));
    expect(receipt.verified).toBe(false);
    expect(receipt.findings).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "provider_config_import",
      file: "lib/projections/seasonBootstrap.ts" })]));
  });
});
