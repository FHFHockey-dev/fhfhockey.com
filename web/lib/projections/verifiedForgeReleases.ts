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
    receiptSha256: "0197d657a9c127a38b7b7c8d2296d2d9e6b6e2ae1ba7a8d489dd9112a25d17c8",
    verifierVersion: "forge-release-sha-verifier-v1",
    closureSha256: "4bf0fce7a4bf1e6ed7b5e8b28b8524836f4b6969adfe57e80ae373b2f847cbbb",
    note: "Production master release #385 (FORGE fantasy-table removal), 192-module closure, 0 findings.",
  },
];

export type VerifiedForgeProducerClosure = {
  /** The producer closure hash (`producerIdentity.closureSha256` in the receipt). */
  closureSha256: string;
  receipt: string;
  receiptSha256: string;
  verifierVersion: string;
  note: string;
};

export const VERIFIED_FORGE_PRODUCER_CLOSURES: readonly VerifiedForgeProducerClosure[] = [
  {
    closureSha256: "0e9876269d5dd645c7c7f7ec02373fda81d7021f9e8b3b11bad9342a4d4f8e4f",
    receipt: "tasks/artifacts/projection-table-audit-2026-10-26/release-verification/closure-0e9876269d5dd645c7c7f7ec02373fda81d7021f9e8b3b11bad9342a4d4f8e4f.json",
    receiptSha256: "d61a4665d3b89be72634e0206cb24ceddb98458d886559cf0d5f08845a27105e",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "First stamping producer (PROV-GUARD F1 worktree on 82490cd45), 193-module closure, 0 findings. Admits a release "
      + "only if it ships exactly this closure; re-verify the final integrated commit if any closure module differs.",
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
