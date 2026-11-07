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
    receiptSha256: "913a1b1b05bfd0a5acdba4326d9c27b0dba8f63bb45c64e60e0ffe718e6556cf",
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
    receiptSha256: "eb09bd4004d5ec738e537c22f10af5a1467a1baf6dd815b696f78f6e993c1abd",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Build-only stamp (C7 R40 V2) and Astra F4, commit 595ab13d9: 193-module closure, 0 findings.",
  },
  {
    closureSha256: "c1f0129aca9b2520cbd922cf81c292661b1499fa50b024f76ca6283d362cc4aa",
    commit: "6fb1812c19ecd182e895b3708296018bc842fcf0",
    receipt: "tasks/artifacts/projection-table-audit-2026-10-26/release-verification/6fb1812c19ecd182e895b3708296018bc842fcf0.json",
    receiptSha256: "afb6fb8cc15a1d636695438c484c2238573c16d9e15d62fab51d0c570a97f2fa",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Release candidate: reserve pass (074694095) and C7 R42 fixes, commit 6fb1812c1: 194-module closure, 0 findings.",
  },
  {
    closureSha256: "87edd78f5dfa96eded8a32927ef184d9266995edf52f395cf5ac6b8565c64f97",
    commit: "5aa9ba5e0e9e86abf515fd7a30db441f6f5b1592",
    receipt: "tasks/artifacts/projection-table-audit-2026-10-26/release-verification/5aa9ba5e0e9e86abf515fd7a30db441f6f5b1592.json",
    receiptSha256: "3c4b840b5b6554eb09952da5bf49e0ec2928b43207855debe57d8d7451d397f0",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Release candidate: week-ahead pipeline projection (08e583311), commit 5aa9ba5e0: 194-module closure, 0 findings.",
  },
  {
    closureSha256: "5644e3fdb1e230e0a063a27b52519cc8e70b88272e92f27ca5aadc8f53d1dea4",
    commit: "02153acbaf1ed02c0c294ba14a75e8af195354f3",
    receipt: "tasks/artifacts/projection-table-audit-2026-10-26/release-verification/02153acbaf1ed02c0c294ba14a75e8af195354f3.json",
    receiptSha256: "f4acf1ad2948f5c051e27765f252c401b8faae28d68676956b6d3a8cf13d3de4",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Release candidate: days-ahead preflight anchoring, commit 02153acba: 194-module closure, 0 findings.",
  },
  {
    closureSha256: "bf23edfea5b5c9301fcedd2b5c3fa86016ceecd86d1d2d49c0a6d6c687e7ab3b",
    commit: "eff1b377ae8c831705710758979cc67e9d38846b",
    receipt: "tasks/artifacts/projection-table-audit-2026-10-26/release-verification/eff1b377ae8c831705710758979cc67e9d38846b.json",
    receiptSha256: "5330c14429613e7bdb9968d86b4cf91686918485d3351baa208d93e55fb619c7",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "P1 release: RSO bridge labelled conservative 0 (bridgeForecastWire.ts), commit eff1b377a: 194-module closure, 0 findings.",
  },
  {
    closureSha256: "f87dd7079506915fbdb9602d35c3a97270865ae0f4b8813c4456d6d09e96dc92",
    commit: "f17bea20d8caa2b6268c318bdb2152d7e2a3b57d",
    receipt: "tasks/artifacts/rso-resume-2026-11-01/release-prep/after402-committed-release.json",
    receiptSha256: "1c433d07b4be3de47548f1db3cd8f88f87de4dbae9e35af618b2656d39318e6d",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Released PR #402 PP/IFTTT producer closure, commit f17bea20d: 195-module closure, 0 findings. This does not grant native forecast-use approval.",
  },
  {
    closureSha256: "ec5bdab6593f58ec19ad9b250fb645aa377616542e98205150e22f085914968c",
    commit: "c3897d3273ca46ea25a9f2737f09c835e5ec7325",
    receipt: "tasks/artifacts/rso-resume-2026-11-01/release-prep/admission/c3897d3273ca46ea25a9f2737f09c835e5ec7325/receipt.json",
    receiptSha256: "94f64cdfaeaeccd0c00ba3bfb7b23d6dbf81044f7b16c045f3cf35b057886998",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "RSO issued-method lineage and retained participation replay, commit c3897d327: 195-module closure, 0 findings.",
  },
  {
    closureSha256: "abb563452f17dbcd802a5debd8af86425a01775bf2fb9693c9a14fb9f468f454",
    commit: "c09aa95ace52f8da26ef9ee1b2e635dc0245f201",
    receipt: "tasks/artifacts/cron-pipeline-repair-2026-11-07/c09aa95ace52f8da26ef9ee1b2e635dc0245f201.json",
    receiptSha256: "e1800c924bf8710e1f0380abdb475d0a49bb694d211998a903a1578516ce675e",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Nov 7 deployed producer: 195-module exact commit closure, 0 findings; matches the stored production invocation stamp. Exclusion proof only, not forecast-quality or native-use approval.",
  },
  {
    closureSha256: "2676c5366cfc08fa7aaec4a1d4369e6f51caf3018bf2fca3f7d358faceb5c746",
    commit: "d9fcc711e12d2902cd6b646ce38888a43e606f2b",
    receipt: "tasks/artifacts/cron-pipeline-repair-2026-11-07/d9fcc711e12d2902cd6b646ce38888a43e606f2b.json",
    receiptSha256: "1ea3060660de250e22700048d77096b2a7015dfcfc97ddf74474da02efe8730f",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Isolated cron repair producer: current-team goalie priors and exact-run calibration proof, 195-module commit closure, 0 findings. Exclusion proof only, not forecast-quality or native-use approval.",
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
