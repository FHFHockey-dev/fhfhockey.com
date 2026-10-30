# F1 receipt: verified producer-closure identity (PROV-GUARD slice 1)

**Base** `octoberBranch` HEAD `82490cd4591758f145cbcfeab6137719c84c57e9` · **Uncommitted** (the orchestrator verifies and commits).

No production or provider reads, migrations, capture activation, deploys, pushes or git mutations. Git use was read-only (`rev-parse`, `archive`, `log`, `status`, `show`), with `GIT_DIR` unset. All tests ran offline.

## What now admits an uncaptured FORGE run

Rule, in `web/lib/projections/externalInputProof.ts` `verifiedRunAttribution`. The run must be **succeeded**, released (a full 40-hex `git_sha`, not `local:`) and finished in **one invocation** (`metrics.resume.invocations = "1"`). Then:

- **Stamped run** (`metrics.producer_identity` present in any form): it is admitted only if the stamp has exactly one invocation entry and that entry is a closure hash in `VERIFIED_FORGE_PRODUCER_CLOSURES`. The SHA never stands in for the stamp, so the next release with an unchanged closure is admitted under its own new SHA.
- **Unstamped run** (it predates stamping): its exact SHA must be in `VERIFIED_FORGE_RELEASES` (still only 538100d41).
- **Run with an input snapshot:** the snapshot alone decides, as before. A verified closure never overrides contradictory capture.

**Always denied:**
- a changed or unverified closure, and an unknown closure (built without one: `[null]`);
- mixed resumes, resumes of the same closure, and resumes that began before stamping;
- a two-entry stamp on a one-invocation row;
- malformed or wrong-version stamps, including a bare hash;
- an unstamped post-stamping SHA;
- an unlisted closure relabelled with the legacy SHA;
- failed or running runs, and local SHAs;
- failed proof or attribution reads, which throw so callers fail closed.

## Producer identity: how the executing artifact is named

| Piece | File | What it does |
|---|---|---|
| Closure walk + identity | `web/scripts/forge-producer-closure.ts` (new; the scanner moved here from the verifier, so both use one implementation) | Import closure from the six FORGE entrypoints. Identity = sha256 over sorted `"<module sha256>  <path>"` lines (UTF-8 source). `--print` gives the hash; `--json` gives modules and findings |
| Build-time inlining | `web/next.config.js` (now exports `(phase) => config`) | Only in `PHASE_PRODUCTION_BUILD`, it runs the walker under ts-node (about 0.7 s) and sets `env.FORGE_PRODUCER_CLOSURE_SHA256`. Next replaces `process.env.FORGE_PRODUCER_CLOSURE_SHA256` with that literal when bundling, so a runtime env var of that name can't relabel the build. On failure it sets `""`: runs stamp `[null]` and are denied. Dev and other phases inject nothing |
| Stamp | `web/lib/projections/forgeProducerIdentity.ts` (new, inside the closure) | `{ version: "forge-producer-closure-v1", invocations: [hash \| null, …] }`, one entry per invocation in order. A resume appends; an unreadable earlier stamp becomes `null` |
| Writer | `web/lib/projections/queries/run-lifecycle-queries.ts` | Stamps beside `git_sha` on **every** metrics write. `finalizeRun` and `writeClaimedRun` replace metrics wholesale, so a stamp written only at insert would be lost. The writes are: `insertRunningRun`, the resume takeover (appends), `writeClaimedRun` (the claim's identity) and `finalizeRun` (single invocation). No migration |
| Allowlist | `web/lib/projections/verifiedForgeReleases.ts` | `VERIFIED_FORGE_PRODUCER_CLOSURES` (one entry) plus the existing `VERIFIED_FORGE_RELEASES` (538100d41, pre-stamping) |
| Verifier | `web/scripts/verify-forge-release-sha.ts` | `<full-sha>` (git archive) or `--worktree` (in place). The receipt now carries `producerIdentity.closureSha256` and `closureWalkerSha256`. It fails if an admission module is inside the closure |

### Design change, from evidence: admission had to leave the closure

The working-tree scan showed `externalInputProof.ts` and `verifiedForgeReleases.ts` **inside** the producer closure, via `run-rolling-forge-pipeline` → `run-projection-accuracy` → `apiHelpers` → `externalInputProof`. Listing a closure hash would have changed that hash, which is the same self-reference as F1.

The fix:
- `requireLatestExternalInputProvenRunId` moved from `apiHelpers.ts` into `externalInputProof.ts`. `apiHelpers.ts` is back to its pre-guard content, and `/forge/players` and `/projections/players` import from the new location.
- The verifier now enforces `ADMISSION_MODULES` (finding `admission_module_in_closure`).
- `requireLatestSucceededRunId` is unchanged, as `run-projection-accuracy` requires.

## Verification receipts (deterministic, in `tasks/artifacts/projection-table-audit-2026-10-26/release-verification/`)

| Target | Result | Closure identity | Receipt sha256 |
|---|---|---|---|
| Working tree on 82490cd45, the **first stamping producer** (listed) | VERIFIED, 193 modules, 0 findings, 21 dynamic sites | `0e9876269d5dd645c7c7f7ec02373fda81d7021f9e8b3b11bad9342a4d4f8e4f` | `d61a4665d3b89be72634e0206cb24ceddb98458d886559cf0d5f08845a27105e` |
| `538100d41…` (legacy, listed by SHA) | VERIFIED, 192 modules, 0 findings | `4bf0fce7…cbbb` (unchanged by the refactor) | `0197d657a9c127a38b7b7c8d2296d2d9e6b6e2ae1ba7a8d489dd9112a25d17c8` |
| `bd337d97a…` (pre-removal) | NOT VERIFIED, 16 findings (`seasonBootstrap` provider config) | `1c3c91ac…a258` | `25c6eb545e734fcdf0463244e5aa6dad80113a40fae1387fcaa1f76c193a3cf3` |

**The listed identity is valid only if the release ships these exact closure files.** The working-tree receipt lists uncommitted closure files:
- `apiHelpers.ts`, `run-lifecycle-queries.ts` and `forgeProducerIdentity.ts` (this slice);
- **`web/lib/rosterScheduleOptimizer/planningTypes.ts`**, modified by another lane (RSO-MANUAL; FORGE imports it for types).

If the integrated commit differs in any closure module, its runs stamp a different, unlisted hash and are denied, which fails safe. To list it:
1. Run `NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/verify-forge-release-sha.ts <final full SHA>` (or `--worktree`).
2. Add its `producerIdentity.closureSha256` and receipt hash to `VERIFIED_FORGE_PRODUCER_CLOSURES`.

That file is outside the closure, so this doesn't change the identity.

## Tests

Focused suites, run offline with the socket/fetch blocker: **17 files, 524 passed, 1 skipped**, in both **UTC** and **America/New_York** (`f1-focused-UTC.log`, `f1-focused-America_New_York.log`).

| Required case | Test |
|---|---|
| The next release with an unchanged closure is admitted | `externalInputProof.test.ts`: "admits the next release, an unlisted SHA…". `forgeProducerIdentity.test.ts`: identity is the same for a later tree whose closure is unchanged |
| A changed closure is denied | `externalInputProof.test.ts`: "denies a changed (unverified) closure". `forgeProducerIdentity.test.ts`: a module edit or a new import changes the identity |
| Contradictory capture is denied despite the allowlist | `externalInputProof.test.ts`: "denies contradictory capture even when the run is stamped with the verified closure" |
| A mixed resume is denied | `externalInputProof.test.ts`: mixed, same-closure and pre-stamping resumes, and two entries on a one-invocation row. `forgeProducerIdentity.test.ts`: resumes append |
| A query failure is denied | `externalInputProof.test.ts`: attribution read failure and snapshot read failure both reject |
| A stamp can't be forged by relabelling a SHA | `externalInputProof.test.ts`: unlisted or unknown closure on the legacy SHA denied; malformed, wrong-version or bare-hash stamps denied even on the legacy SHA |
| An env label alone doesn't count | `forgeProducerIdentity.test.ts`: `next.config.js` production phase computes the identity from source while a planted runtime `FORGE_PRODUCER_CLOSURE_SHA256` is ignored; dev phase injects nothing; malformed values give `null` |
| A post-stamping SHA with no stamp is denied | `externalInputProof.test.ts` |
| The writer stamps | `releasedRunFence.test.ts`: insert carries the build's closure, or `[null]` |
| Receipts are bound | `verifiedForgeReleases.test.ts`: receipt hash, verified with no findings, identity match, current verifier and walker hashes, and admission modules not in the closure |

## Checks

| Check | Result |
|---|---|
| Focused vitest, UTC and America/New_York (17 files) | **passed**: 524 passed, 1 skipped (pre-existing), each time zone |
| Whole-project `tsc --noEmit` (12 GB heap), under `/private/tmp/fhfh-heavy.lock` (noclobber; acquired 15:58:52Z, released) | **passed**: exit 0, no diagnostics |
| eslint on the 18 changed source and test files, including `next.config.js` | **passed**: exit 0 |
| Verifier: working tree, 538100d41, bd337d97a | as tabled; closure identity re-computed after checks, still `0e9876…4f` |

## Not verified, and residual assumptions

- **No `next build` was run.** It's expensive and not required, so it's unconfirmed in this project's real bundle that Next inlined `env.FORGE_PRODUCER_CLOSURE_SHA256` into the API-route chunk. That is documented Next behaviour for the `env` config key. A local `npm run build`, and grepping `.next/server` for the hash, would confirm it if TJ wants proof before release.
- Vercel builds must have `ts-node` and `typescript` (devDependencies, which Vercel installs by default) for the build-time walk. Without them the identity is `""`, so runs are denied, never mis-admitted.
- The identity covers source modules only, not `node_modules` or runtime env flags. The pundit read path itself must be absent from the closure, which the verifier checks.
- The closure includes type-only imports (conservative), so type edits in closure files, such as `planningTypes.ts`, also need re-verification.
- `next.config.js` now exports a function. Next supports this; no other repository code imports it.

## File list (for the orchestrator to commit)

sha256, git status, path:

- `ad2e6d1e13e3c2d3246ca9e02d07dc2adbf26ed445bd209e5a2acef062afcd09`   M web/next.config.js
- `e33ccacb21dca88ef2d163dab5f16ec0c50bb817373b9ab000c2ac8e29df5bad`  ?? web/scripts/forge-producer-closure.ts
- `14d7e4f92f707ec520d233d62f0adfd27a8caaaa3dfb759b3af3ccd7626d0f15`   M web/scripts/verify-forge-release-sha.ts
- `6c5b0d4c0d6e2ec4c3a188500ea0ced0f3b11706959f7d3f1bd976682aedcc3a`  ?? web/lib/projections/forgeProducerIdentity.ts
- `19101c30aa737248843304ecc4ddce5054f720b3e2caedf4ceece9d8f00f441c`  ?? web/lib/projections/forgeProducerIdentity.test.ts
- `7c37395436487755052b7f64cbf5a3537a5fab7f872b11ac88172bf03f46fc9b`   M web/lib/projections/queries/run-lifecycle-queries.ts
- `2c9f9597429c6d3e0c4aaf63865507c5a048ae27df93a91df241c466b8eb2102`   M web/lib/projections/releasedRunFence.test.ts
- `67fe57ee6a2443e88d71219df3b6c7ca2811c1154b28fcaeed08838f22c4fa44`   M web/lib/projections/externalInputProof.ts
- `86ffc799e48f324db316eb3b880139d03808ad8e6e6181fab6f6950bf1dc028e`   M web/lib/projections/externalInputProof.fixtures.ts
- `5331a6b123e48cb8ad2504725e4b64583b307c0a280bb235873f3108cfd3d6c6`   M web/lib/projections/externalInputProof.test.ts
- `7d10697f12451205eeea8147b3cc0428d8bfac7829d8d7e473ef8190dbe11478`   M web/lib/projections/verifiedForgeReleases.ts
- `97595103e632f86ef60d5803a58d5852105cf6500a235668daf6d9b9729a328b`   M web/lib/projections/verifiedForgeReleases.test.ts
- `b5ce713fac1e74cc64b8483ef9a9e21ba39cfa9e29dc50636c5a769b62ebcb41`   M web/lib/projections/apiHelpers.ts
- `16e1036d86395b04a06480713e6553323be3ca5548e85a36d0f57027de6437d9`   M web/lib/projections/apiHelpers.runAdmission.test.ts
- `6f783e025bc8f2e0b53ffd809ffb19bc2334f0c0acb11d7707778d930c1b497e`   M web/pages/api/v1/forge/players.ts
- `7910543edb9be63168e6d878720579c14309bd30db1da194ffdb28cedea64a1b`   M web/__tests__/pages/api/v1/forge/players.test.ts
- `07b0aec75692df877d0542c6185a0152944bdcf9ae026e8ea65c19d28a72a1bb`   M web/pages/api/v1/projections/players.ts
- `c3a822b580e7e37316d5be1a2bac79cfa0fb7386b77eb7d90ca6ae1570575cbc`   M web/__tests__/pages/api/v1/projections/explicitRunAdmission.test.ts
- `d61a4665d3b89be72634e0206cb24ceddb98458d886559cf0d5f08845a27105e`  ?? tasks/artifacts/projection-table-audit-2026-10-26/release-verification/closure-0e9876269d5dd645c7c7f7ec02373fda81d7021f9e8b3b11bad9342a4d4f8e4f.json
- `0197d657a9c127a38b7b7c8d2296d2d9e6b6e2ae1ba7a8d489dd9112a25d17c8`   M tasks/artifacts/projection-table-audit-2026-10-26/release-verification/538100d41ee87e721d2764b694f7bac8c2f2bb34.json
- `25c6eb545e734fcdf0463244e5aa6dad80113a40fae1387fcaa1f76c193a3cf3`  ?? tasks/artifacts/projection-table-audit-2026-10-26/release-verification/bd337d97aefd959832b3466037d163f320a23d99.json

**Not mine; left untouched:** `web/lib/rosterScheduleOptimizer/planningTypes.ts` (RSO-MANUAL), Social Share and Tuesday Trends, Player Cards, team logos, `web/next-env.d.ts`.
