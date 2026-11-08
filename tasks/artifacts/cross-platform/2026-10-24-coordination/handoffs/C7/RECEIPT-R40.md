# C7 review R40: `cd73cbd69` (FORGE proof guard: exact verified-release fallback when capture is absent)

**Verdict: accept with limits.**
- **(a)** The fallback logic is correct and fails closed.
- **(c)** The receipt's integrity holds, and I reproduced it independently.
- **(b)** Two things should change before the F1 producer-closure identity slice builds on this: **V1**, a committed test depends on an untracked file, and **V2**, attribution trusts `git_sha`, which is an env label a local run can carry.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no product edits, no Git mutations, no `GIT_DIR`, no production reads.
- I reviewed the **commit** (`git archive cd73cbd69`, release `538100d41` archived separately, at `/private/tmp/c7-r40b`), not the working tree, which PROV-GUARD is editing.
- Tests ran under the outbound network-deny preload with `TZ=UTC`.
- I also read the Astra audit's F1 (`tasks/artifacts/astra-audit-2026-10-26/RSO-Post-Astra-Audit-REPORT.md` §5).
- Evidence is in `r40-evidence/`.

## Tests

| Run | Result |
| --- | --- |
| **Commit**: `externalInputProof`, `verifiedForgeReleases`, `apiHelpers.runAdmission`, `forgeDailyBridge` | **122/124** in run 1 (`head-run1.*`). Both failures were `ENOENT` because my `web`-only snapshot had no `tasks/` tree. |
| Same, with the commit's own `tasks/artifacts/projection-table-audit-2026-10-26` added | `verifiedForgeReleases` **3/4.** "keeps the pre-removal release's receipt as a failed verification" still fails with `ENOENT` for `…/bd337d97aefd959832b3466037d163f320a23d99.json`. That receipt is **untracked** (`git status`: `??`) and not in the commit. **This is V1.** |
| **Parent mirror** (`3795abb43` source, with the commit's tests and fixture) | **100/120**, and `verifiedForgeReleases.test.ts` can't load. The failures: 17 in proof (every new SHA, invocation, status and contradiction case, plus 2 changed existing cases for the new `basis` field), 1 in apiHelpers, 2 in the bridge. |
| **My controls** (`r40Proof.test.ts`) | **14/14** |
| **Closure reproduction** (`r40-closure.ts`: the committed `scanForgeClosure` run on my own archive of `538100d41`, writing only to `/private/tmp`) | 192 modules, `modulesSha256 4bf0fce7…cbbb`, 0 findings, 21 dynamic sites, 1 guard regex. **Identical** to the allowlist entry and the receipt. |

## (a) Correctness of the exact-SHA fallback

| Rule | Evidence | Result |
| --- | --- | --- |
| **Only runs without a snapshot are attributed** | `loadExternalInputProof` reads snapshots first and reads `forge_runs` only for ids **with no** snapshot row. `externalInputProofByRun` falls back only when `snapshots.length === 0`. | Holds |
| **Contradictory capture still denies** | A run with any snapshot is judged only by `every(snapshotProvesExternalInputExclusion)`. These all deny even with the verified SHA: an unlabelled snapshot (committed test); one proving plus one non-proving snapshot; and a snapshot whose `payload.runId` names another run (my controls). | Holds |
| **Exact SHA** | `verifiedForgeRelease` requires `/^[0-9a-f]{40}$/` plus an exact `Map` hit. Short, prefix, suffix, upper-case, space-padded, `local:` and `local:unknown`, null, a number, the pre-removal `bd337d97a`, and an unlisted newer SHA are all rejected (committed tests). | Holds |
| **Succeeded** | `row.status === "succeeded"`, strictly. `running`, `failed`, `"succeeded "`, `"SUCCEEDED"` and undefined are rejected (committed tests plus my controls). | Holds |
| **`invocations === "1"`** | `metrics->resume->>invocations` gives text. At `538100d41` the resumable claim writes `invocations: 1` on a new run, adds one on each resume, and `writeClaimedRun` carries it into the final metrics (`run-lifecycle-queries.ts:334, 369, 419`). A resumed run is ≥2. A missing resume record is null and denied. Number `1`, `"01"`, `" 1"`, `"1.0"`, `"0"` and undefined are all rejected (my controls). | Holds (strict, fails closed) |
| **One attribution row** | Two rows for one `run_id`, or a row for another id, deny (committed test plus my control). | Holds |
| **Failed reads** | A failed or non-array snapshot or `forge_runs` read **throws** (control), and every caller treats that as unproven. | Holds |
| **The metrics' exclusion claim is never read** | `RUN_ATTRIBUTION_COLUMNS` selects `git_sha`, `status`, `resume.invocations` and the rolling contract, never `external_fantasy_input_contract` (control). | Holds |

## (c) Receipt integrity

- `sha256(538100d41…json)` at the commit is **`4382282d…7fc9`**, which equals `receiptSha256`. The working-tree copy is byte-identical.
- The receipt's `verifierSha256` `a7fe43be…50f3` equals the sha256 of the committed `web/scripts/verify-forge-release-sha.ts`; the working-tree script is identical.
- `closure.modulesSha256` and `moduleCount` (192) equal the allowlist's `closureSha256`, and **I reproduced both from an independent archive**.
- `findings: []`, `verified: true`, tree `d694f513…`.

## (b) What should change before the F1 identity slice builds on it

| # | Severity | Finding |
| --- | --- | --- |
| **V1** | **Low-medium (must fix)** | **The committed test reads an untracked file.** `verifiedForgeReleases.test.ts` "keeps the pre-removal release's receipt as a failed verification" reads `release-verification/bd337d97aefd959832b3466037d163f320a23d99.json`. That file exists only in the working tree (`??`), not in `cd73cbd69`, so the suite fails on any clean checkout, including CI and the release candidate. Commit the negative receipt (and its hash), or drop that case. |
| **V2** | **Medium (design input for the slice)** | **Attribution trusts `forge_runs.git_sha`, an env label.** It's stamped from `VERCEL_GIT_COMMIT_SHA \|\| GIT_SHA \|\| "local:unknown"` (`run-lifecycle-queries.ts:249`). The local runner (`web/scripts/run-forge-local.ts`) goes through the same writer and pins only `FORGE_CODE_VERSION = local:<hash>`, not `git_sha`. So a local or non-Vercel invocation whose shell has `GIT_SHA` (or `VERCEL_GIT_COMMIT_SHA`) set to `538100d41…` would write a succeeded, single-invocation run from **any working tree**. That run would pass both `excludeOffReleaseRuns` and this fallback. The audit's F1 fix warns against exactly this ("let an arbitrary env label stand in for the executed artifact"). It needs an env value and a deliberate local write to production, so it isn't a live exposure, but the slice should bind admission to an identity a local run can't claim. At minimum, refuse attribution when the run's stamped code version is `local:*` (it isn't currently selected or checked). Better, use a deployment-attested identity. Note also that the verifier's roots don't include `scripts/run-forge-local.ts`, which is correct for production, but that means "verified release" says nothing about local runs carrying the same SHA. |
| **V3** | Low | **The proof's `basis` and `releaseSha` aren't surfaced.** They're added to `ExternalInputProof`, but no consumer exposes them (Start Chart spreads the proof into `input_provenance` only for eligibility). The audit's acceptance list asks for "selected-run attribution in diagnostic evidence". Expose `basis` and `releaseSha` with the served run id before the slice adds a second basis. |
| **V4** | Info (the audit's F1, unchanged) | **The allowlist can't admit its own deployment.** A deploy of `cd73cbd69` or later records its own SHA, which isn't listed, so its uncaptured runs are unproven, and availability depends on older `538100d41` runs within the lookback (the bridge's 7 days). This commit doesn't create that problem (it's structural); the identity slice must solve it without trusting a range. The pinned verifier hash in the test means any verifier change requires re-verifying every listed release, which is right, but plan for it in the slice. |
| **V5** | Info | `invocations === "1"` makes every pre-resumable-writer run and every resumed run unproven: correct and fail-closed. Expect the uncaptured-run admission rate to depend on how often production runs finish in one invocation (unknown without a read). |
