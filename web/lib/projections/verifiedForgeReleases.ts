// FORGE releases individually verified to exclude third-party fantasy projection inputs (TJ, 2026-10-26).
// A run without a captured input snapshot is served only when its recorded `forge_runs.git_sha` is one of these exact
// commits and that attribution can be trusted (see externalInputProof.ts). Each entry needs its own receipt from
// `web/scripts/verify-forge-release-sha.ts`, which checks that commit's whole FORGE run import closure, including
// seasonBootstrap, stages, queries, fallbacks and dynamic table sites. There is no range or "from this release on" rule:
// a newer release stays unproven until it is verified and listed here.

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
    receiptSha256: "4382282d8564a3e10465c02f7062d336b9d6a7d17cb4bb2eeccdda1ff96d7fc9",
    verifierVersion: "forge-release-sha-verifier-v1",
    closureSha256: "4bf0fce7a4bf1e6ed7b5e8b28b8524836f4b6969adfe57e80ae373b2f847cbbb",
    note: "Production master release #385 (FORGE fantasy-table removal), 192-module closure, 0 findings.",
  },
];

const FULL_SHA = /^[0-9a-f]{40}$/;
const verified = new Map(VERIFIED_FORGE_RELEASES.map(release => [release.sha, release]));

/** The verified release a recorded SHA names exactly; short, prefixed, `local:`, mixed-case or unlisted SHAs never match. */
export function verifiedForgeRelease(gitSha: unknown): VerifiedForgeRelease | null {
  return typeof gitSha === "string" && FULL_SHA.test(gitSha) ? verified.get(gitSha) ?? null : null;
}
