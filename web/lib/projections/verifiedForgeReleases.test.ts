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
      ["bf23edfea5b5c9301fcedd2b5c3fa86016ceecd86d1d2d49c0a6d6c687e7ab3b", "eff1b377ae8c831705710758979cc67e9d38846b"],
      ["f87dd7079506915fbdb9602d35c3a97270865ae0f4b8813c4456d6d09e96dc92", "f17bea20d8caa2b6268c318bdb2152d7e2a3b57d"],
      ["ec5bdab6593f58ec19ad9b250fb645aa377616542e98205150e22f085914968c", "c3897d3273ca46ea25a9f2737f09c835e5ec7325"],
      ["abb563452f17dbcd802a5debd8af86425a01775bf2fb9693c9a14fb9f468f454", "c09aa95ace52f8da26ef9ee1b2e635dc0245f201"],
      ["2676c5366cfc08fa7aaec4a1d4369e6f51caf3018bf2fca3f7d358faceb5c746", "d9fcc711e12d2902cd6b646ce38888a43e606f2b"],
      ["9b1821fff8b64983f5e28c572a054cdc7d49f2a320b8e2e18dec514e4ad4c219", "a5816ce6d1eeeba4b7213d1f66c96025f0b5818e"],
      ["ce9cdbc7dc5c9afb0c09580b090ba7fcbfb984f126442361e2a6e06411a99420", "d66408de3a0d1ccea1daaadfce8a3a9ae20cb680"],
      ["dfab4f52f55d0f67bd16d613df000a794e4280611719c5d0e8daedf712479da6", "6c7f78154b49fca56a807a61dd0628b1b861d8ca"],
      ["ee5581d901975dd5701c76ecc58e715b396b449bdb50e05360c571f3f3de710b", "e1ab46318ec9c6797deb94ac1aa23d68f5672f26"],
      ["9944628e4582609bdff1c75ede8958a9bcddbd3be794b4212bdf7a3df3aa4ec0", "5c42cb14fb4e4ef1ff1cdaf64db1c668319b019c"],
      ["a6a3bb7ada63d3876ca01303ecf51b90c29d0d310e2910a04c0ee0140dc5f451", "43e9dcdcf801f862767527cb0edc891f62981c68"],
      ["78655939ef3fcdb47a12c2388644b96a7015f49c2327cac00ddbd8a050dfd6e9", "bb8693f19d5ac35e48a2a04595cf084b1abc27e6"],
      ["ca6534eb2c1c8352ad75a0be0d304abd0ffc524bebc380cd3b4644ed4fed1704", "6c4e00f05d21884e7eb0d2e734abe8c817d92d44"],
      ["5efee60291d0938ca631b6e92c4d0c1fb8f94a27ab0aafd5dc94ad52c5df0b68", "00dc848156931863869c3a0828ef06f45b28bf9d"],
      ["d633c57257cfd34e78e2ed4680bbdb86ccc363374dddf0f6eb48db833c921be4", "cf0cb680ec1e381c3edc4a2d4059534b93c0b2cc"],
      ["cdf87b73d436f83841e0af9d70fa1bd58df13236e2a1abdb74495eb912a43540", "7a13f65c071889f9bff650f10cb61f672ecd6ec7"],
      ["0446100e09f468bc061dbc7049ddc1fddec54237a617d7e63ca4835a66b48223", "e2f8c6bc9fb79894ee61df70bf7377166559f467"],
      ["7ee3612e5965a7cb35b20ef6d65c68808c05c011001cdcc8b9dd15100924eccf", "c2c46ceae3a97aa7cbfa87acf51fbe4edf52dac9"],
      ["af8b8d11e6d4b77f620d4d356b8ee6d504a5e2d4cf9e08bd975e15a1b80e8723", "16971845574240e139212e82a9b17ef12db66e34"],
      ["3611475f4de94896916aaf394dcbb23b004097a85ed6914f743056db6e3b74ad", "24cbe90af57046e1c7ef456102e508abbafa0d3b"],
      ["23af25d3f3f534d5e8ce09de44c916ed8ba778bd080395486ec4dfb2500f5b27", "88cef60ed9e12335fc68b8cf05ea65e57caf51b5"],
      ["6ae6bf1092a3c21e650c862d7d7c5f1c14327d678fd84044ceede48cc8dd7ebb", "65e0291906f9fb3a6933d8db9ace560371dcdee9"],
      ["fbd0b9da0dcf23badd0ee5cca2f6141833c8732452f043e986f96a22e2872c0e", "e1c078506c51c5cd24b1b2ce6091a6ad7388bc83"],
      ["75a49fed27cbbfb6d7c635ba112f1f6f5fc3e132939943a7c56abc3b9b136496", "5e8ba0e28b642fb7e54676cfe5a1de7625e968f2"],
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
