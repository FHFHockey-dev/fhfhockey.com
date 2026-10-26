import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { VERIFIED_FORGE_RELEASES, verifiedForgeRelease } from "./verifiedForgeReleases";

const repoRoot = resolve(__dirname, "../../..");

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
      // Made by the verifier as it stands: changing the script means re-verifying every listed release.
      expect(receipt.verifierSha256).toBe(createHash("sha256").update(readFileSync(resolve(__dirname, "../../scripts/verify-forge-release-sha.ts"), "utf8")).digest("hex"));
      // The closure really is the FORGE run path, fallbacks and bootstrap included.
      expect(receipt.closure.modules).toEqual(expect.arrayContaining(["lib/projections/run-forge-projections.ts",
        "lib/projections/seasonBootstrap.ts", "lib/projections/stages/skater-stage.ts", "lib/projections/queries/skater-queries.ts"]));
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
