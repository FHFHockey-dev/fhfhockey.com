// FORGE producer code individually verified to exclude third-party fantasy projection inputs (TJ, 2026-10-26).
// A run without a captured input snapshot is served only when its producer is listed here (see externalInputProof.ts):
//   - VERIFIED_FORGE_PRODUCER_CLOSURES: producer closure hashes the run writer stamps (forgeProducerIdentity.ts). A hash
//     names exact closure content, so every release that leaves the closure unchanged is the same verified producer
//     and any change needs its own verification. Admission and this file stay outside that closure
//     (scripts/forge-producer-closure.ts ADMISSION_MODULES), so listing a hash never changes it.
//   - VERIFIED_FORGE_RELEASES: exact commit SHAs, only for runs that predate stamping.
// Each entry needs its own receipt from `web/scripts/verify-forge-release-sha.ts`, which checks the whole FORGE run
// import closure, including seasonBootstrap, stages, queries, fallbacks and dynamic table sites. There is no range or
// "from this release on" rule.

export type VerifiedForgeRelease = {
  /** Exact full 40-character commit SHA, as the executing deployment records it in `forge_runs.git_sha`. */
  sha: string;
  /** Repository path of the verifier's JSON receipt and that receipt's sha256. */
  receipt: string;
  receiptSha256: string;
  verifierVersion: string;
  /** Hash of the verified import closure (each module's sha256 and path). */
  closureSha256: string;
  note: string;
};

export const VERIFIED_FORGE_RELEASES: readonly VerifiedForgeRelease[] = [
  {
    sha: "538100d41ee87e721d2764b694f7bac8c2f2bb34",
    receipt: "tasks/artifacts/projection-table-audit-2026-10-26/release-verification/538100d41ee87e721d2764b694f7bac8c2f2bb34.json",
    receiptSha256: "c7ce6343bc8ee48a644c4facbd514605401c46ca20e20c65a947b01878372036",
    verifierVersion: "forge-release-sha-verifier-v1",
    closureSha256: "4bf0fce7a4bf1e6ed7b5e8b28b8524836f4b6969adfe57e80ae373b2f847cbbb",
    note: "Production master release #385 (FORGE fantasy-table removal), 192-module closure, 0 findings.",
  },
];

export type VerifiedForgeProducerClosure = {
  /** The producer closure hash (`producerIdentity.closureSha256` in the receipt). */
  closureSha256: string;
  /** A commit whose tree reproduces this closure; the receipt verifies that commit (C7 R42 A1). */
  commit: string;
  receipt: string;
  receiptSha256: string;
  verifierVersion: string;
  note: string;
};

export const VERIFIED_FORGE_PRODUCER_CLOSURES: readonly VerifiedForgeProducerClosure[] = [
  // Not listed: 0e9876…4f8e4f (F1, 5a19f1def): its writer read the hash from an env var, so unbuilt code could stamp it
  // (C7 R40 V2); never deployed. 6613c9…0616: an uncommitted export that no commit reproduces (C7 R42 A1).
  {
    closureSha256: "4c06fd9e2b5a5d880f594cb2668b81eaa0c54553de525a73f477d4eebf909993",
    commit: "595ab13d9773808057b49cc3ed91d9eaca8ed317",
    receipt: "tasks/artifacts/projection-table-audit-2026-10-26/release-verification/595ab13d9773808057b49cc3ed91d9eaca8ed317.json",
    receiptSha256: "8b651750974bdd84b4bfe798580c6716dc4cf423efceca97eb44ba991c8b7f42",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Build-only stamp (C7 R40 V2) and Astra F4, commit 595ab13d9: 193-module closure, 0 findings.",
  },
  {
    closureSha256: "c1f0129aca9b2520cbd922cf81c292661b1499fa50b024f76ca6283d362cc4aa",
    commit: "6fb1812c19ecd182e895b3708296018bc842fcf0",
    receipt: "tasks/artifacts/projection-table-audit-2026-10-26/release-verification/6fb1812c19ecd182e895b3708296018bc842fcf0.json",
    receiptSha256: "0dc6763981cab4344a7cbd79c50cb0318cb67d5e20d1cdaf0d6846aa5699a1f9",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Release candidate: reserve pass (074694095) and C7 R42 fixes, commit 6fb1812c1: 194-module closure, 0 findings.",
  },
  {
    closureSha256: "87edd78f5dfa96eded8a32927ef184d9266995edf52f395cf5ac6b8565c64f97",
    commit: "5aa9ba5e0e9e86abf515fd7a30db441f6f5b1592",
    receipt: "tasks/artifacts/projection-table-audit-2026-10-26/release-verification/5aa9ba5e0e9e86abf515fd7a30db441f6f5b1592.json",
    receiptSha256: "7b50158957045b40ee6044849fa31530e567996060e445c815f9bbf90d27aea8",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Release candidate: week-ahead pipeline projection (08e583311), commit 5aa9ba5e0: 194-module closure, 0 findings.",
  },
  {
    closureSha256: "5644e3fdb1e230e0a063a27b52519cc8e70b88272e92f27ca5aadc8f53d1dea4",
    commit: "02153acbaf1ed02c0c294ba14a75e8af195354f3",
    receipt: "tasks/artifacts/projection-table-audit-2026-10-26/release-verification/02153acbaf1ed02c0c294ba14a75e8af195354f3.json",
    receiptSha256: "e46edefba9d4bddfe4804257f7f9788694dd39c9f859a21d8ecdcdc9da8dcfaf",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Release candidate: days-ahead preflight anchoring, commit 02153acba: 194-module closure, 0 findings.",
  },
];

const FULL_SHA = /^[0-9a-f]{40}$/, SHA256 = /^[0-9a-f]{64}$/;
const verified = new Map(VERIFIED_FORGE_RELEASES.map(release => [release.sha, release]));
const verifiedClosures = new Map(VERIFIED_FORGE_PRODUCER_CLOSURES.map(closure => [closure.closureSha256, closure]));

/** The verified producer closure a stamped hash names exactly. */
export function verifiedForgeProducerClosure(closureSha256: unknown): VerifiedForgeProducerClosure | null {
  return typeof closureSha256 === "string" && SHA256.test(closureSha256) ? verifiedClosures.get(closureSha256) ?? null : null;
}

/** The verified release a recorded SHA names exactly; short, prefixed, `local:`, mixed-case or unlisted SHAs never match. */
export function verifiedForgeRelease(gitSha: unknown): VerifiedForgeRelease | null {
  return typeof gitSha === "string" && FULL_SHA.test(gitSha) ? verified.get(gitSha) ?? null : null;
}
