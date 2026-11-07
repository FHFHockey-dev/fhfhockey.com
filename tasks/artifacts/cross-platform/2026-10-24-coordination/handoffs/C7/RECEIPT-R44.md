# C7 review R44 (pre-release): `b9206fe31` (FORGE proof admits resumed runs of one verified closure); glance at `ad079935e`

**Verdict on `b9206fe31`: accept.**
- A resumed run is admitted only when **every** invocation stamped the **same verified, non-null** closure, the stamp count **exactly equals** `metrics.resume.invocations`, `code_versions` matches it in length, and nothing is `local:*`.
- Unstamped legacy exact-SHA runs still need one invocation.
- Allowing null code versions is sound: only the local runner sets `FORGE_CODE_VERSION`.
- No guarantee from R40–R43 is weakened.
- **Nothing in this commit must change before release.**

**But the release candidate `efb36e908` as assembled has two test-integrity defects, P1 and P2.** Its `web/` tree is **byte-identical** to `b9206fe31`'s (tree `1ad87b0a…`) and its producer closure is the verified `c1f0129a`, so **runtime is as reviewed**. But it copies only `web/`, so on the candidate:
- **P1:** `verifiedForgeReleases.test.ts` fails 4/8, because no `release-verification` receipts are in the tree.
- **P2:** `supportedBaselineMigration.test.ts` fails "keeps only the reviewed baseline…" (it expects 101 authority rows; the candidate carries 99, plus 99 migration files).

These don't affect runtime, and CI runs only the rankings e2e, so nothing automated will catch them. But `master`'s own unit suite would be red, and the allowlist's receipts couldn't be audited from `master`. **I recommend re-cutting the candidate** to also carry `tasks/artifacts/projection-table-audit-2026-10-26/release-verification/`, the authority JSON (`tasks/TASKS/repository-audit-remediation/migration-authority.json`), and the two pending migration files (unapplied, so behind their flags they're inert). Otherwise, ship knowing these tests are red on `master`. Whether that's acceptable is TJ's call; it isn't a safety issue.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no production reads.
- I used `git archive` snapshots at `/private/tmp/c7-r44` of `b9206fe31`, its parent `ad079935e`, and the candidate `efb36e908`.
- Tests ran under the outbound network-deny preload with `TZ=UTC`, and with `FORGE_CODE_VERSION`, `FORGE_RESERVE_PASS_ENABLED` and `GAME_PREDICTIONS_REQUIRE_FORGE_PROOF` unset.
- Evidence is in `r44-evidence/`.

## Tests

| Run | Result |
| --- | --- |
| **`b9206fe31`**: proof, allowlist, producer identity, released-run fence, apiHelpers admission, bridge, forge players and goalies, explicit admission, featureBuilder, publicPredictions, workflow | **374/374** |
| **Parent** (`ad079935e` source, with the commit's proof test) | **66/68.** "admits 2 (and 3) invocations that all stamped the verified closure" fail, which is the new behaviour. |
| **My controls** (`r44Resume.test.ts`) | **18/18** (below) |
| **Closure** (the committed scanner) | `b9206fe31` and `efb36e908` both give **`c1f0129a…cc4aa`**, 194 modules, **0 findings**. The receipt `6fb1812c1….json` sha256 is **`0dc67639…a1f9`**, equal to the allowlist; it declares `sha 6fb1812c1…`, `verified`, 0 findings, closure `c1f0129a`, 194 modules, and no `source`. Together with R43 (which found `c1f0129a` at `6fb1812c1`), **R43 X1 is closed** by `7b9770e4b`. |
| **Release candidate `efb36e908`**: `externalInputProof`, `verifiedForgeReleases` | Proof **68/68**; allowlist **4/8**. The 4 receipt tests fail with `ENOENT`: no receipts in the candidate tree (`git ls-tree efb36e908 …/release-verification/` is empty). **P1.** |
| **Release candidate**: `supportedBaselineMigration.test.ts`, with its own `supabase/` and authority JSON | "keeps only the reviewed baseline and supported post-baseline deltas active" fails: **"expected … to have a length of 101 but got 99". P2.** A second failure (`ENOENT super-goal-final-summary.md`) is **my extraction**, since I archived only one `tasks/TASKS` folder. |

## Resumed-run admission (`externalInputProof.ts`, `verifiedRunAttribution`)

| Question | Evidence | Result |
| --- | --- | --- |
| **Can unverified, mixed or unknown code be admitted?** | No. `closure = invocations[0]` must be non-null; `invocations.every(entry => entry === closure)`; and `verifiedForgeProducerClosure(closure)`. **Controls deny:** `[null, V]`, `[V, null]`, `[V0, V]` (two different **verified** closures), and `[V, unverified]`. | Holds |
| **Is the stamp count bound to `resume.invocations`?** | `String(stamp.invocations.length) !== row.invocations` gives null, and `row.invocations` is the text `metrics->resume->>invocations`. **Controls deny:** a dropped stamp (2 vs 1), a padded stamp (1 vs 2), no resume record (null), `"two"` and `" 2"`. `parseProducerIdentity` also requires `code_versions.length === invocations.length`; a shorter `code_versions` denies. **Writer:** `claimResumableRun` appends the stamp **and** increments `resume.invocations` in the **same** update, and an unreadable prior stamp becomes a `[null]` entry, which then denies. | Holds |
| **Does `local:*` deny?** | Any `code_versions` entry starting with `local:` denies, including on a later invocation of a resume (control `[null, "local:abc"]`). | Holds |
| **Legacy unstamped exact-SHA runs** | `row.invocations === "1" ? verifiedForgeRelease(git_sha) : null`. **Control:** `538100d41` with 1 invocation is admitted; with 2 it's denied. | Holds |
| **Is it acceptable to allow null `code_versions`?** | **Source check:** the only assignment of `FORGE_CODE_VERSION` in `web/`, `functions/`, `webhooks/` and `.github/` is `scripts/run-forge-local.ts:410`, set to `local:<hash>`. The deployed writer only reads it (`run-forge-projections.ts:482`, `forgeProducerIdentity.ts:41`). So deployed builds stamp null, and the local runner stamps `local:` (denied). Independently, unbuilt code stamps a **null closure**, which denies, so the code version is defence in depth. I can't see whether a Vercel env var `FORGE_CODE_VERSION` is set (no production reads), but a set value would be a non-`local:` label and still couldn't admit anything without a build-defined verified closure. | Acceptable |
| **Earlier guarantees (R40–R43)** | **Contradicting capture still wins** (control: a resumed verified stamp plus a non-proving snapshot is denied). The `code_versions` array is still required (A4; control with the pre-V2 shape and 2 invocations denies). A null closure denies. `local:*` denies. The SHA is never trusted for a stamped run. Explicit-run admission, the fallbacks, `runProof`, and the prediction classes `claim_withheld`/`malformed_capture`/`proof_unavailable` are unchanged (the suites above pass). | No regression |

| # | Severity | Note |
| --- | --- | --- |
| **N1** | Info (no exposure while capture is off) | **Prediction classification still treats only single-invocation stamps as verified producers** (`classifyExternalInputProofRows`, `verifiedProducer`: `stamp?.invocations.length === 1`). A **captured, resumed** run whose stamps are all the verified closure but whose snapshot withholds the claim classifies as `unproven` (my control), not `claim_withheld`. With the proof flag off, predictions built from it would then be **shown** labelled unproven rather than withheld. Production capture is off, so no captured runs exist today. Align `verifiedProducer` with the new rule (same length, all equal, verified) before capture is turned on. |

## ad079935e: migration authority (tests and docs)

- **Two entries added:** order 100, `20261026200000_rso_yahoo_past_lineups.sql`, sha256 `bec40282…`; and order 101, `20261027090000_forge_reserve_projections.sql`, sha256 `1ca5816e…`. Both are `deploymentState: "pending"`, and both hashes **match** the files at the commit.
- The reserve migration now includes `revoke all … from public, anon, authenticated` before its grants (`a02159b64`), **closing R43 M1**.
- The baseline-migration test counts change from 99 to 101 and from 5 to 7.
- No product code changes.
- **Accept.** Note **P2**: the release candidate copies `web/` (with this test) but **not** these two migration files or the updated authority JSON.
