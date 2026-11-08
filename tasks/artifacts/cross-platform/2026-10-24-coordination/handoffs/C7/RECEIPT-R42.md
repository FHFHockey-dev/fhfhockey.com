# C7 review R42: `595ab13d9` (FORGE: build-only producer stamp, served run proof, team/goalie/prediction admission)

**Verdict: accept with limits.**
- **V2 is closed for env labels:** no env var, `.env` file or shell value can make unbuilt code stamp a closure, and `local:*` code versions deny.
- V3 serves non-private diagnostics.
- F4 gates teams and goalies exactly like skaters and keeps unknown goalie values null.
- Predictions withhold only contradicted runs, as TJ chose.
- **The allowlisted closure `4c06fd9e` reproduces from the commit with 0 findings.**
- **Limits:**
  - **A1 (low-medium):** a second allowlisted closure, `6613c9ef`, came from an uncommitted worktree and can't be reproduced from Git.
  - **A2 (low):** a failed proof read silently downgrades a contradicted run to unproven, so it's admitted while the flag is off.
  - Other notes: A3–A6.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no production reads.
- I reviewed the **commit** (`git archive 595ab13d9` at `/private/tmp/c7-r42`), not the working tree.
- Tests ran under the outbound network-deny preload with `TZ=UTC`, and with `FORGE_PRODUCER_CLOSURE_SHA256`, `FORGE_CODE_VERSION` and `GAME_PREDICTIONS_REQUIRE_FORGE_PROOF` unset.
- I did **not** run a production `next build` (AGENTS.md: only when no narrower check can do). The bundle-literal evidence is the author's (`V2-V3-BUILD-RECEIPT.md`); I checked the build config by reading the code.
- Evidence is in `r42-evidence/`.

## Tests

| Run | Result |
| --- | --- |
| **Commit**: 14 suites (route tests for start-chart, ledger, forge goalies and players, explicit admission, projections goalies and players; prediction featureBuilder, publicPredictions, workflow; projection externalInputProof, forgeProducerIdentity, releasedRunFence, verifiedForgeReleases) | **368/369** plus 1 skip already in start-chart, with `workflow.test.ts` **22/22** after adding `supabase/` to my snapshot. Run 1 couldn't load `workflow.test.ts` (`ENOENT` on a migration file), a reviewer setup error kept as `*-run1.*`. |
| **Parent mirror** (`c0ebd63f7` source, with the commit's tests, fixture, snapshot and receipts) | **275/368**, and `workflow` **19/22.** Every new V2, V3 and F4 case fails: local-code-version denial, the env-label stamp, classification (7), forge/goalies (18 of 18), explicit admission (30), projections/goalies (3), prediction contradicted/unproven handling (5), and snapshot reuse (3). |
| **My controls** (`r42Controls.test.ts`) | **8/8.** Three of them record observed residual behaviour (A3, A4, A5). |
| **Closure reproduction** | The committed `scripts/forge-producer-closure.ts --json` on my archive of `595ab13d9` gives **`4c06fd9e2b5a5d880f594cb2668b81eaa0c54553de525a73f477d4eebf909993`**, **193 modules, 0 findings**. The admission modules aren't in it. |

**Receipt hashes** (all equal the allowlist):

| Receipt | sha256 |
| --- | --- |
| `538100d41…json` | `c7ce6343…2036` |
| `closure-4c06fd9e…json` | `75779f58…97a5` |
| `closure-6613c9ef…json` | `367a4cc0…b8c6` |

- The receipts' `verifierSha256` (`2da61a46…`) equals the committed verifier.
- `closureWalkerSha256` (`e33ccacb…`) equals `forge-producer-closure.ts`.
- `0e987626` is de-listed, with the reason given in the code.

## V2: can anything unbuilt yield an admitted stamp?

| Path | Evidence | Result |
| --- | --- | --- |
| **Env var, `.env` file or shell** | `currentProducerClosureSha256()` reads only the bundler constant `__FORGE_PRODUCER_CLOSURE_SHA256__` (`typeof` guard), never `process.env`. **Control:** `FORGE_PRODUCER_CLOSURE_SHA256` and `FORGE_CODE_VERSION` set to the verified hash still stamp `[null]`. A null closure denies. | Closed |
| **DefinePlugin scope** | `next.config.js` returns the plain config unless `phase === PHASE_PRODUCTION_BUILD`. It then wraps `webpack` and pushes `DefinePlugin` only when `options.isServer` (the node and edge server compilations), so it's never in client bundles. `next dev`, `ts-node` (the local runner), Vitest and scripts never define it. | Holds (by code; bundle evidence from the author) |
| **`local:*` code version** | `verifiedRunAttribution` returns null when any `code_versions` entry starts with `local:`, **before** checking the closure, so stamped legacy-SHA rows are covered too (committed tests). **Controls:** `local:abc` and `local:` deny; a `code_versions` array of the wrong length is malformed and denies. | Holds |
| **Relabelled SHA, resume** | Unchanged from R41: the SHA is only required to be a full released SHA, never trusted for a stamped run; resumes add a second entry and deny. `requireExternalInputProvenRun` also refuses explicit runs that aren't `succeeded`, or whose SHA is null or `local:*`. | Holds |

| # | Severity | Residual |
| --- | --- | --- |
| **A3** | Low | **A runtime global with the constant's name is read by unbuilt code.** `typeof __FORGE_PRODUCER_CLOSURE_SHA256__` resolves a global property, so a `ts-node` run with a preloaded global (`NODE_OPTIONS=--require x.js` setting `globalThis.__FORGE_PRODUCER_CLOSURE_SHA256__`), plus a full `GIT_SHA`, stamps the verified closure (my control). That takes deliberate code, not an env value, and anyone able to do it could write `forge_runs` directly. Hardening, if wanted: also deny when no `VERCEL_GIT_COMMIT_SHA` was present at stamping time, or record a build-time-defined `buildId` beside the closure. |
| **A4** | Low / info | **Pre-V2 stamps are still admitted.** A stamp without `code_versions` parses with null versions and is admitted if its closure is verified (my control). Only `5a19f1def`-era writers (env-based, never deployed) write that shape. Requiring `code_versions` for closure admission would close it at no cost. |
| **A5** | Info | **The `local:*` check needs a stamp.** A genuinely unstamped row (no `producer_identity`) on the exact SHA `538100d41` can't carry a code version, so it can't be checked: the commit's "legacy-SHA rows included" means stamped legacy rows. After deploy every new run is stamped, so this applies only to historical rows. |

## Allowlist

| # | Severity | Finding |
| --- | --- | --- |
| **A1** | **Low-medium** | **`6613c9ef…0616` is allowlisted but not reproducible from Git.** Its note and the build receipt say "HEAD `c5829aa9e` plus PROV-GUARD's files", **uncommitted**, verified with `--tree`. No commit has that tree, so no reviewer or later audit can recompute it. `4c06fd9e` is the closure of the actual commit, and it reproduces. Since `6613c9ef` was never deployed and is superseded, de-list it, by the same reasoning the commit applied to `0e987626`. Otherwise every allowlisted identity should be backed by a commit whose tree reproduces it. |

## V3: is `runProof` served without leaking anything private?

- `runProofDiagnostics` returns only `{ runId, basis, releaseSha, closureSha256 }`.
- It's served by `/forge/players`, `/forge/goalies`, `/projections/{players,teams,goalies}`, Start Chart (`proof` on the legacy run) and the ledger (`bridgeRunProofs`, filtered to the runs it used).
- These are run identifiers, a public commit SHA and a code hash: no user, account, league or input data. Public predictions add `forgeInputProvenance` (`runId` and status per side), which is equally non-private.
- **Holds.**

## F4: teams, goalies, `forge/goalies` and predictions

| Question | Evidence | Result |
| --- | --- | --- |
| **Do they admit exactly like skaters?** | `/projections/{teams,goalies,players}` all use `requireExternalInputProvenRun` (explicit) or `requireLatestExternalInputProvenRun` (latest; labelled 404 `external_input_provenance_unproven`). `/forge/goalies` uses the same, and its fallback now searches 30 released succeeded runs, keeps only **proven** ones, then checks they have goalie rows for the horizon. | Holds |
| **Is an explicit run checked before any row read?** | `requireExternalInputProvenRun` reads only `forge_runs(run_id,status,git_sha)` and the proof. It returns 404 when there's no run, 422 `run_not_succeeded_release` for failed, running, null or `local:` runs, and 422 `external_input_provenance_unproven` for unproven ones. The callers read rows only afterwards ("refuses an explicit request for an unproven, failed or running run before reading its rows", which fails on the parent). | Holds |
| **Does unknown stay null (`forge/goalies` ~`:456-461`)?** | `starter_probability`, `proj_shots_against`, `proj_saves`, `proj_goals_allowed` and `proj_shutout_prob` all become `?? null`, where they were `?? 0`. The UI consumers (`GoalieRiskCard`, `GoalieContextPanel`, dashboard normalisers and invariants) already handle null. | Holds. **A6 (info):** `normalizeLikelyStarterWinProbabilities` still weights by `starter_probability ?? 0`, only in its fallback when both win probabilities are present and zero. |
| **Prediction classification** | `classifyExternalInputProofRows`: **proven** means proof; **contradicted** means captured **and** the producer is verified (the snapshot's code version is a verified release, or there's a single verified closure stamp) but no proof; **unproven** is everything else. The committed table covers all 7 cases. | Holds (A2, A7) |
| **Reuse re-check** | `existingFeatureSnapshotId` re-classifies the stored snapshot's home and away FORGE runs **now**, and rebuilds when either isn't admissible (contradicted always; unproven only with the flag on). Covered by workflow tests that fail on the parent. | Holds |
| **Only contradicted output is withheld (flag off)** | `forgeProjectionAdmissible` is `proven \|\| (unproven && !flag)`. The feature builder drops only contradicted team-projection rows; the public payload keeps unproven predictions, labels every one, and counts `withheldForForgeProvenance`. The flag reads exactly `"true"`, so it's off by default. | Holds |

| # | Severity | Finding |
| --- | --- | --- |
| **A2** | Low | **A failed proof read hides contradiction.** The feature builder, public predictions and snapshot reuse all run `classifyExternalInputProof(...).catch(() => new Map())`, so a failed read makes **every** run "unproven". With the flag off, a **contradicted** run's team projection is then used, its stored snapshot reused, and its prediction shown, labelled "unproven". That's fail-open for the one class TJ chose to withhold. Suggest: on a read failure, don't reuse the stored snapshot (rebuild or skip), and label the prediction's provenance `unknown` rather than `unproven`. |
| **A7** | Info | **"Contradicted" covers more than a withheld claim.** Any non-proving capture by verified code counts, including a snapshot that **has** the claim but a malformed receipt (`readCount 0`, my control) or a `runId` mismatch. That fails safe (it's withheld), but the label overstates it as contamination. Consider distinguishing `claim_withheld` from `malformed_capture`. |
