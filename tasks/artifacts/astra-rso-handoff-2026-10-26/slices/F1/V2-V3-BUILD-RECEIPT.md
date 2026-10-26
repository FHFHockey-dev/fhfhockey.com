# F1 follow-up receipt: V2 build-only stamp, V3 proof diagnostics, real-bundle proof

**Base** HEAD `c5829aa9e01a19155cb915fd11168080f82b47f3` · **Uncommitted.**

No production or provider reads, migrations, capture activation, deploys, Vercel or remote builds, pushes or git mutations. The single local build ran in a `/private/tmp` export, never in `web/.next`.

## V2: a stamp only a production build can make (C7 R40 V2)

**What changed:**
- `web/lib/projections/forgeProducerIdentity.ts` now reads the bundler constant `__FORGE_PRODUCER_CLOSURE_SHA256__` with a `typeof` check, instead of `process.env`. No env var, `.env` file or shell can define it, so unbuilt code (ts-node, vitest, `scripts/run-forge-local.ts`, `next dev`) always stamps `null`, and readers deny `null`.
- Each invocation also records `FORGE_CODE_VERSION` in `code_versions`. Because that is an env label, it is only ever used to **deny**.
- `web/next.config.js`, in `PHASE_PRODUCTION_BUILD` only, adds a webpack `DefinePlugin` for `__FORGE_PRODUCER_CLOSURE_SHA256__` to **server** compilers. The `env` injection is gone, so the client gets nothing.
- `web/lib/projections/externalInputProof.ts` refuses attribution when any `code_versions` entry is `local:*`, whatever SHA or closure the row claims. That includes a legacy-SHA (538100d41) row carrying such a stamp.
- `local:` / null `git_sha` was already refused by the full-SHA rule.

**Tests:**
- `forgeProducerIdentity.test.ts`: env vars alone (`FORGE_PRODUCER_CLOSURE_SHA256`, and even one named `__FORGE_PRODUCER_CLOSURE_SHA256__`) yield `null`. `code_versions` is recorded and appended on resume. The `next.config.js` production phase defines the constant for server compilers only, computed from source while a planted env value is ignored; client and dev phases define nothing.
- `releasedRunFence.test.ts`: the writer stamps `[null]` plus `local:` under env labels.
- `externalInputProof.test.ts`: a local code version is denied (both on a stamped run and on a legacy-SHA row); what unbuilt code stamps is never admitted, even with the verified hash in its env.

## V3: what admitted a served run, with its run id

`runProofDiagnostics(runId, proof)` returns `{ runId, basis: captured_snapshot | verified_producer_closure | verified_release, releaseSha, closureSha256 }`. It is served in:

| Surface | Field |
|---|---|
| `/api/v1/forge/players` | `diagnostics.runProof` (latest or fallback run) |
| `/api/v1/projections/players`, `/goalies`, `/teams` | `runProof` |
| `/api/v1/start-chart` (legacy run) | `projectionRun.proof` |
| Served-forecast ledger job | `bridgeRunProofs` |

**RSO bridge: not done here.** `forgeDailyBridge.ts` has moved to the FORGE-RESERVE lane. I had added `runProofs` to the bridge result before the lease change; that edit is **reverted to HEAD** (only my lines were in the diff). Exposing it to RSO needs `forgeDailyBridge.ts` to return the proofs it already computes, and `rosterScheduleData/planning.ts` (RSO-MANUAL) to carry them into the evidence. That needs sequencing.

## Step 3: inlining proven in a real production bundle

Run by `run-build2.sh`, under `/private/tmp/fhfh-heavy.lock` (noclobber, acquired 16:17:06Z, released):
1. `git archive HEAD web` into `/private/tmp/prov-guard-build`, then overlay **only this lane's 19 files**, so no other lane's work-in-progress is included.
2. Remove the `.env*` files, so the build reads no env file. Symlink `node_modules`.
3. Run `next build --experimental-build-mode=compile`, offline (socket/fetch blocker), with inert `NEXT_PUBLIC_*`/`CMS_URL` and a planted `FORGE_PRODUCER_CLOSURE_SHA256` plus `__FORGE_PRODUCER_CLOSURE_SHA256__` env value of `f×64`.

An earlier attempt failed on the unset `CMS_URL` rewrite. A second was stopped when the lease changed, because it overlaid the worktree's closure (other lanes' work-in-progress).

| Check | Result |
|---|---|
| `next build` | exit 0 |
| Export closure (computed in the export) | `6613c9ef43129584230e5c6f70adc2691b3af501edcc8574d297d23b10920616`. **VERIFIED** with `verify-forge-release-sha.ts --tree`: 193 modules, 0 findings |
| Hash literal in server output | `chunks/33514.js` (module 76459 = `forgeProducerIdentity`: `function(){let a="6613c9ef…";return e.test(a)?a:null}()`; the `typeof` was compiled away), plus `pages/api/v1/projections/players.js`, `forge/players.js`, `runs/latest.js` |
| Writer reads it | `chunks/92662.js` (`run-lifecycle-queries`) binds `i=c(76459)` and calls `(0,i.QX)` (`producerIdentityStamp`) in `insert({…git_sha:w(),metrics:{…,producer_identity:c}})`, the resume update and `writeClaimedRun` |
| FORGE run routes load both chunks | `run-projection-v2.js`, `run-rolling-forge-pipeline.js`, `api/internal/starter-board.js`, `drain-starter-board.js` |
| `__FORGE_PRODUCER_CLOSURE_SHA256__` left in server output | none |
| Planted env value anywhere in `.next` | none |
| Hash in client output (`.next/static`) | none |

## Step 4: allowlist

- **Listed:** `6613c9ef…0616` (receipt `closure-6613…json`, sha256 `367a4cc0…b8c6`), the identity of HEAD plus this lane's files.
- **Unlisted:**
  - `0e9876…` (F1, `5a19f1def`): its writer read `process.env`, so an env label could forge it. It was never deployed.
  - `4c06fd…` (worktree with other lanes' uncommitted closure edits).
- The 538100d41 and bd337d97a receipts were regenerated because the verifier changed (`--tree`); the closures are unchanged. The 538100d41 entry is now `c7ce6343…2036`.

**Integration note:** FORGE-RESERVE (`run-lifecycle-queries.ts` `forge_reserve_projections`, `run-forge-projections.ts`, `goalie-stage.ts`, new `reserveProjections.ts`) and RSO-MANUAL (`rsoUsePolicy.ts`) currently have uncommitted edits to producer-closure files. Whatever commit integrates them stamps a **different** hash, which fails safe by denying. List it by running `verify-forge-release-sha.ts <final full SHA>` and adding that `producerIdentity.closureSha256`. The allowlist sits outside the closure, so this is a one-line follow-up. The `run-lifecycle-queries.ts` edit is FORGE-RESERVE's, not mine.

## Checks

| Check | Result |
|---|---|
| Focused vitest (14 files: proof, allowlist, identity, apiHelpers, run fence, resume, module-imports, forge/players, projections/*, start-chart, ledger) in UTC and America/New_York | **passed**: 334, 1 skipped, in each |
| Whole-project tsc, **HEAD + this lane's files** (the export), under the heavy lock | **passed**: exit 0 |
| Whole-project tsc, **working tree**, under the heavy lock | exit 2, with one error in `web/lib/rosterScheduleData/bridgeForecastWire.ts:90`, which is **another lane's uncommitted edit** (FORGE-RESERVE; not mine, untouched) |
| eslint on this lane's changed files | **passed**: exit 0 |
| Production `next build` in the clean export | exit 0; inlining proven as tabled above |

## Files (this lane, uncommitted)

sha256, path (the bridge files were reverted to HEAD):

- `45d31d338d7b3b1ab83ff0acd195bbf3c1b06146dfb67fcb38ab3e61489674ec`  web/next.config.js
- `2da61a46b89df70669c454f08fbefd3a0803655a92226f0c8020aad9b9d3c456`  web/scripts/verify-forge-release-sha.ts
- `04827fe65985045df96861dd550908d19d12daeba37c28bf32d67858a1249720`  web/lib/projections/forgeProducerIdentity.ts
- `e7a82e251eadce07df936f9a59268bf7dc21c8576f02b1edc0e3202ce489bb5b`  web/lib/projections/forgeProducerIdentity.test.ts
- `606a7eb68d86bbde2d4d3953b68ecffcefc9a20fd1fb1487e20d93e44ea68c72`  web/lib/projections/externalInputProof.ts
- `86ffc799e48f324db316eb3b880139d03808ad8e6e6181fab6f6950bf1dc028e`  web/lib/projections/externalInputProof.fixtures.ts
- `bdad549c5a81b803b8fc00336da84f384d4961b202ffc73f265ee2e226993903`  web/lib/projections/externalInputProof.test.ts
- `515140ff01895ba9c010120e5bcdff9f1724f1b31c0c01e2122a0e57048b4bdf`  web/lib/projections/verifiedForgeReleases.ts
- `97595103e632f86ef60d5803a58d5852105cf6500a235668daf6d9b9729a328b`  web/lib/projections/verifiedForgeReleases.test.ts
- `dc62d685b38c5137b2710c18a0b329565cecd090d7cd7de7d11ddb6e2a93c865`  web/lib/projections/releasedRunFence.test.ts
- `6e82e20488b8f19cb841587f8b188071ea0dacd00fde60a698e2873b15a2699c`  web/pages/api/v1/forge/players.ts
- `72e701f3c297a5f78afd1c708a092fd3386891e6474f9ee71b3ecca19fadd5c1`  web/__tests__/pages/api/v1/forge/players.test.ts
- `899c3af8dec949f605d16963513c88d19b25cb9ddb6ba9b99473ac91de38bfe7`  web/pages/api/v1/projections/players.ts
- `4126ed5a4d6a6540bc6eb7bf52d0ec49f7070e81c87719471c6e3754aaf55f25`  web/__tests__/pages/api/v1/projections/players.test.ts
- `cdd289ec85cea99a4a646f430a93b1d80634e6afb2f71b96b41eb7420ef0d4aa`  web/__tests__/pages/api/v1/projections/explicitRunAdmission.test.ts
- `b5bbe2e5b3a64f8368dc409ad11207420af36811c0342e9cbfd49220c3d3f98e`  web/pages/api/v1/start-chart.ts
- `9601527da7de26fd44f555af069edd1225eef29695bab3f603c5f298083b5b67`  web/__tests__/pages/api/v1/start-chart.test.ts
- `078c65c01ab2020f8b09aa227653cc27ff2b339878657ab4f77ee7478ad4e291`  web/pages/api/v1/db/forge-served-forecast-snapshot.ts
- `6bdb2c3708b9da204a27f87bfbc13de3766956ecba438ca25e036921583fc983`  web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts
- `367a4cc0493f545fe72f0c4da7b0e5f1857fe8c4073c15cf3ae824ed2426b8c6`  tasks/artifacts/projection-table-audit-2026-10-26/release-verification/closure-6613c9ef43129584230e5c6f70adc2691b3af501edcc8574d297d23b10920616.json
- `c7ce6343bc8ee48a644c4facbd514605401c46ca20e20c65a947b01878372036`  tasks/artifacts/projection-table-audit-2026-10-26/release-verification/538100d41ee87e721d2764b694f7bac8c2f2bb34.json
- `014006353ec248c06c0c5b575d3aabb9dfde5436134c01aee6ff530bbb6959c0`  tasks/artifacts/projection-table-audit-2026-10-26/release-verification/bd337d97aefd959832b3466037d163f320a23d99.json

F4 has started on its granted files (`projections/teams.ts` and `projections/goalies.ts`, and their tests). They aren't part of this receipt.
