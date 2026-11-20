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
    receipt: "tasks/artifacts/forge-release-reverification-2026-11-16/538100d41ee87e721d2764b694f7bac8c2f2bb34.json",
    receiptSha256: "90225fc62d33bb70333c5d51eff1af42fe81a1a5750e8ff624d01a3cd346e123",
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
    receipt: "tasks/artifacts/forge-release-reverification-2026-11-16/595ab13d9773808057b49cc3ed91d9eaca8ed317.json",
    receiptSha256: "e667e997c25f7a42303306300b615b5c2cd929d8244f798793d2db499288d76f",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Build-only stamp (C7 R40 V2) and Astra F4, commit 595ab13d9: 193-module closure, 0 findings.",
  },
  {
    closureSha256: "c1f0129aca9b2520cbd922cf81c292661b1499fa50b024f76ca6283d362cc4aa",
    commit: "6fb1812c19ecd182e895b3708296018bc842fcf0",
    receipt: "tasks/artifacts/forge-release-reverification-2026-11-16/6fb1812c19ecd182e895b3708296018bc842fcf0.json",
    receiptSha256: "c7cdd13c533a3420fcc446b5ad35b0a90348bf22bcc93426a484d50f94888737",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Release candidate: reserve pass (074694095) and C7 R42 fixes, commit 6fb1812c1: 194-module closure, 0 findings.",
  },
  {
    closureSha256: "87edd78f5dfa96eded8a32927ef184d9266995edf52f395cf5ac6b8565c64f97",
    commit: "5aa9ba5e0e9e86abf515fd7a30db441f6f5b1592",
    receipt: "tasks/artifacts/forge-release-reverification-2026-11-16/5aa9ba5e0e9e86abf515fd7a30db441f6f5b1592.json",
    receiptSha256: "a9af7a57828fa5630ac41de5badd58cc351b1da52dd06c51a6c1c5877a5411e6",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Release candidate: week-ahead pipeline projection (08e583311), commit 5aa9ba5e0: 194-module closure, 0 findings.",
  },
  {
    closureSha256: "5644e3fdb1e230e0a063a27b52519cc8e70b88272e92f27ca5aadc8f53d1dea4",
    commit: "02153acbaf1ed02c0c294ba14a75e8af195354f3",
    receipt: "tasks/artifacts/forge-release-reverification-2026-11-16/02153acbaf1ed02c0c294ba14a75e8af195354f3.json",
    receiptSha256: "27e6438a090393abe5c5e823be405163aefdb491fcbb63756821a6a62ec64f09",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Release candidate: days-ahead preflight anchoring, commit 02153acba: 194-module closure, 0 findings.",
  },
  {
    closureSha256: "bf23edfea5b5c9301fcedd2b5c3fa86016ceecd86d1d2d49c0a6d6c687e7ab3b",
    commit: "eff1b377ae8c831705710758979cc67e9d38846b",
    receipt: "tasks/artifacts/forge-release-reverification-2026-11-16/eff1b377ae8c831705710758979cc67e9d38846b.json",
    receiptSha256: "c838864f1cd71947ca1893a62e83a06b1074878029d115cb44af2c615730d05c",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "P1 release: RSO bridge labelled conservative 0 (bridgeForecastWire.ts), commit eff1b377a: 194-module closure, 0 findings.",
  },
  {
    closureSha256: "f87dd7079506915fbdb9602d35c3a97270865ae0f4b8813c4456d6d09e96dc92",
    commit: "f17bea20d8caa2b6268c318bdb2152d7e2a3b57d",
    receipt: "tasks/artifacts/forge-release-reverification-2026-11-16/f17bea20d8caa2b6268c318bdb2152d7e2a3b57d.json",
    receiptSha256: "2135fa926d39b283545dbaea09632f83d56b4b3e9d589f684c5e9ed635a9370f",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Released PR #402 PP/IFTTT producer closure, commit f17bea20d: 195-module closure, 0 findings. This does not grant native forecast-use approval.",
  },
  {
    closureSha256: "ec5bdab6593f58ec19ad9b250fb645aa377616542e98205150e22f085914968c",
    commit: "c3897d3273ca46ea25a9f2737f09c835e5ec7325",
    receipt: "tasks/artifacts/forge-release-reverification-2026-11-16/c3897d3273ca46ea25a9f2737f09c835e5ec7325.json",
    receiptSha256: "18fe295b0404114b376a28fe695317ba61b47335136a439cd4c9df5c09cc545e",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "RSO issued-method lineage and retained participation replay, commit c3897d327: 195-module closure, 0 findings.",
  },
  {
    closureSha256: "abb563452f17dbcd802a5debd8af86425a01775bf2fb9693c9a14fb9f468f454",
    commit: "c09aa95ace52f8da26ef9ee1b2e635dc0245f201",
    receipt: "tasks/artifacts/forge-release-reverification-2026-11-16/c09aa95ace52f8da26ef9ee1b2e635dc0245f201.json",
    receiptSha256: "63e456a3daefaff918fd6d4a84e6e5e7ef2d20f4fdc5a335f304fa9a4c88b15a",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Nov 7 deployed producer: 195-module exact commit closure, 0 findings; matches the stored production invocation stamp. Exclusion proof only, not forecast-quality or native-use approval.",
  },
  {
    closureSha256: "2676c5366cfc08fa7aaec4a1d4369e6f51caf3018bf2fca3f7d358faceb5c746",
    commit: "d9fcc711e12d2902cd6b646ce38888a43e606f2b",
    receipt: "tasks/artifacts/forge-release-reverification-2026-11-16/d9fcc711e12d2902cd6b646ce38888a43e606f2b.json",
    receiptSha256: "5368ce4be0461c0e7954919182c4e47f1c7272b244dcc0991dd8ea8787b3ec07",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Isolated cron repair producer: current-team goalie priors and exact-run calibration proof, 195-module commit closure, 0 findings. Exclusion proof only, not forecast-quality or native-use approval.",
  },
  {
    closureSha256: "9b1821fff8b64983f5e28c572a054cdc7d49f2a320b8e2e18dec514e4ad4c219",
    commit: "a5816ce6d1eeeba4b7213d1f66c96025f0b5818e",
    receipt: "tasks/artifacts/forge-release-reverification-2026-11-16/a5816ce6d1eeeba4b7213d1f66c96025f0b5818e.json",
    receiptSha256: "32908a3608b9b401d5ef646ad1314aa5fc83d4c38e84e4bdaeb7f3f1ad584d65",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Release #423 producer: 199-module exact commit closure, 0 findings; matches the seven Nov 9-issued h1 runs. Exclusion proof only, not forecast-quality or native-use approval.",
  },
  {
    closureSha256: "ce9cdbc7dc5c9afb0c09580b090ba7fcbfb984f126442361e2a6e06411a99420",
    commit: "d66408de3a0d1ccea1daaadfce8a3a9ae20cb680",
    receipt: "tasks/artifacts/forge-release-reverification-2026-11-16/d66408de3a0d1ccea1daaadfce8a3a9ae20cb680.json",
    receiptSha256: "43b16ddf85cf5ea7016c4209d51cdd28b07b9439cef72891550f000205115487",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Release #425 producer: 199-module exact commit closure, 0 findings; producer modules unchanged in #426. Exclusion proof only, not forecast-quality or native-use approval.",
  },
  {
    closureSha256: "dfab4f52f55d0f67bd16d613df000a794e4280611719c5d0e8daedf712479da6",
    commit: "6c7f78154b49fca56a807a61dd0628b1b861d8ca",
    receipt: "tasks/artifacts/forge-release-reverification-2026-11-16/6c7f78154b49fca56a807a61dd0628b1b861d8ca.json",
    receiptSha256: "e32bb5d5d3179959bb5079b47797b6dab50d4dbe44442de0025a67bce7d66d78",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Goalie Grid and Start Chart coverage-label source candidate: 229-module exact commit closure, 0 findings. Includes the released DRM fixes; released historical dependencies retained. Exclusion proof only, not deployment, probability qualification or native-use approval.",
  },
  {
    closureSha256: "ee5581d901975dd5701c76ecc58e715b396b449bdb50e05360c571f3f3de710b",
    commit: "e1ab46318ec9c6797deb94ac1aa23d68f5672f26",
    receipt: "tasks/artifacts/forge-release-reverification-2026-11-16/e1ab46318ec9c6797deb94ac1aa23d68f5672f26.json",
    receiptSha256: "88f60f0be2d8cd1c1865a622c9180116286c314aaf6c46932b1e8aa7bf43e681",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Producer of the seven Nov 13-issued daily runs (as_of 11-13..11-19): 230-module exact commit closure, 0 findings; matches their stored invocation stamps. Exclusion proof only, not forecast-quality or native-use approval.",
  },
  {
    closureSha256: "9944628e4582609bdff1c75ede8958a9bcddbd3be794b4212bdf7a3df3aa4ec0",
    commit: "5c42cb14fb4e4ef1ff1cdaf64db1c668319b019c",
    receipt: "tasks/artifacts/forge-release-reverification-2026-11-16/5c42cb14fb4e4ef1ff1cdaf64db1c668319b019c.json",
    receiptSha256: "c4f44e16afcba696938cdc16cbfd0cfd62a6e5668856f205a7f16642fb0e5342",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "Release #454 producer (production since 2026-11-16): 239-module exact commit closure, 0 findings with the reviewed pregame-capture transport site. Exclusion proof only, not forecast-quality or native-use approval.",
  },
  {
    closureSha256: "a6a3bb7ada63d3876ca01303ecf51b90c29d0d310e2910a04c0ee0140dc5f451",
    commit: "43e9dcdcf801f862767527cb0edc891f62981c68",
    receipt: "tasks/artifacts/forge-release-reverification-2026-11-16/43e9dcdcf801f862767527cb0edc891f62981c68.json",
    receiptSha256: "15676f4fdfecd85019ecab2afe3fa86998bf0683e9542b407f46199884b737fd",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "2026-11-16 audit release producer (pipeline C2, H1/M5, M4, L2; production build gate; read paths): 239-module exact commit closure, 0 findings. Exclusion proof only, not forecast-quality or native-use approval.",
  },  {
    closureSha256: "78655939ef3fcdb47a12c2388644b96a7015f49c2327cac00ddbd8a050dfd6e9",
    commit: "bb8693f19d5ac35e48a2a04595cf084b1abc27e6",
    receipt: "tasks/artifacts/forge-sandbox-publish-2026-11-19/bb8693f19d5ac35e48a2a04595cf084b1abc27e6.json",
    receiptSha256: "44cdf77b865ffe17e349ea5e039d1436128ab2921bd6bb4e3553b2a43723654e",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "2026-11-19 sandbox publication candidate (forgeEnvScope, pregame publication compute, replay guard): 242-module exact commit closure, 0 findings. Exclusion proof only, not forecast-quality or native-use approval.",
  },
  {
    closureSha256: "ca6534eb2c1c8352ad75a0be0d304abd0ffc524bebc380cd3b4644ed4fed1704",
    commit: "6c4e00f05d21884e7eb0d2e734abe8c817d92d44",
    receipt: "tasks/artifacts/forge-live-release-2026-11-19/6c4e00f05d21884e7eb0d2e734abe8c817d92d44.json",
    receiptSha256: "6622a728d61174bdbb790a099293ad42a38ce5c12c56b5cda769014b6fd81f9c",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "2026-11-19 live pregame release (game-scoped live capture/publish routes, verifier-gated publication, pregame displacement fence): 243-module exact commit closure, 0 findings. Exclusion proof only, not forecast-quality or native-use approval.",
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
