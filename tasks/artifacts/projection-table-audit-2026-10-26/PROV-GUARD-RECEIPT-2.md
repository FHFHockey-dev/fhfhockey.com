# PROV-GUARD step 2 receipt: verified-release attribution for uncaptured runs

**Base** `octoberBranch` HEAD `3795abb437a48fd649a48356908df8367a6abe9c` (step-1 guard committed as `9eb4f0d36`). **Not committed.** No production, DB or network calls; no capture activation; no deployment. Git use was read-only (`rev-parse`, `archive`, `log`), with `GIT_DIR` unset.

## Rule now enforced (`web/lib/projections/externalInputProof.ts`)

1. **The run has an input snapshot** (`forge-run-inputs-v1`): the snapshot decides, exactly as in step 1. A verified release never overrides captured evidence: a snapshot without the claim stays unproven.
2. **The run has no snapshot** (production today): it is proven only when its `forge_runs` row has all of the following:
   - `git_sha` is an **exact, full, lowercase 40-hex SHA** listed in `VERIFIED_FORGE_RELEASES`;
   - `status = 'succeeded'`;
   - `metrics.resume.invocations = 1`, meaning one invocation did all the work.

   It must also be the only row for that `run_id`.
3. **Everything else is rejected:** short, prefix, suffixed, upper-case or `local:` SHAs, `local:unknown`, null, unlisted and newer releases, pre-removal releases, resumed runs, runs with no resume record, and unfinished or failed runs.

The allowlist has no range rule: every release needs its own receipt.

Only the snapshot-less ids get the extra read, which selects only small columns (`run_id, git_sha, status, metrics->resume->>invocations, metrics->input_provenance->>rolling_player_history_contract`), in chunks of 100. The consumers' call sites are unchanged: the RSO bridge, ledger, Start Chart, `/forge/players`, `/projections/players` and `apiHelpers` all go through `loadExternalInputProof`. The proof's `basis` field (`captured_snapshot` or `verified_release`) records which path admitted a run.

## Attribution proof: how `forge_runs.git_sha` is set

| Writer path (source) | `git_sha` value | Can a later invocation do the run's work? | Accepted by SHA? |
|---|---|---|---|
| **Production daily path.** `run-projection-v2` never passes `decisionAsOf`, so with capture off `runProjectionV2ForDate` takes `claimResumableRun` (`run-forge-projections.ts:517–523`) → `insertRunningRun` (`queries/run-lifecycle-queries.ts:252–264`) | `currentRunGitSha()` = `VERCEL_GIT_COMMIT_SHA \|\| GIT_SHA \|\| "local:unknown"` (`:249–250`), stamped **once, at insert** | **Yes.** A resume (`:330–348`) and `writeClaimedRun` (`:422–431`) update only `metrics` and `status`, never `git_sha`. A paused run is adopted by any deployment on the same release side: the check `isOffReleaseGitSha(row.git_sha) !== offRelease` at `:311–313` compares the release side, not the SHA. Each claim bumps `resume.invocations` (`:334`), and the final metrics keep it. No other run update writes `git_sha` either (`:122`, `:520`) | Only when `resume.invocations = 1` |
| `createRun` (non-resumable; `decisionAsOf` given) `:270–286` | `currentRunGitSha()` | No resume, but nothing in the row shows the path, so it can't be told apart | **No** (no resume record). Production doesn't use this path |
| Captured compute path: `begin_forge_game_run` (`run-forge-projections.ts:482,500–502`; `supabase/migrations/20260916014510_starter_board_news_queue.sql:139`) | `FORGE_CODE_VERSION ?? VERCEL_GIT_COMMIT_SHA ?? GIT_SHA`, which can be overridden by an env var | No | **No.** It has a snapshot (rule 1) and no resume record |
| Local attempts (`begin_forge_local_run`, `scripts/run-forge-local.ts`) | `local:…` | n/a | **No** (not a full SHA; also fenced by `excludeOffReleaseRuns`) |

So the attribution comes from the executing deployment: `VERCEL_GIT_COMMIT_SHA` is the Vercel system variable for the commit of the deployment that runs the function. It is not today's deployed code. An instant rollback to an older deployment stamps that deployment's own older SHA, which is unlisted and therefore rejected.

**Residual assumptions (static code can't prove them):**
- Production exposes Vercel system env vars, so `VERCEL_GIT_COMMIT_SHA` is present and wins over a manually set `GIT_SHA`.
- The two released runs the approved read found (`git_sha` 538100d41) were stamped that way. A full 40-character value in that read would confirm it.

**Release risk:** a production run that paused at its deadline and resumed has `invocations > 1`, so it is still withheld. The bounded read didn't report `metrics->resume->>invocations` for those two runs. One more read-only query would show whether they will be served (columns: `run_id, git_sha, status, metrics->resume->>invocations` for those run ids, two rows). It is not run; that's for TJ to approve.

**Out-of-lease follow-up:** have the writer refuse to resume a run whose `git_sha` differs from the current deployment's, or stamp each invocation's SHA in `resume`. Resumed runs could then be attributed too.

## Release verification (`web/scripts/verify-forge-release-sha.ts`)

```bash
cd web && NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/verify-forge-release-sha.ts <full-sha>
```

**What it does:**
- Requires a full SHA, and `git rev-parse --verify <sha>^{commit}` must return it unchanged.
- Runs `git archive <sha> web` into `/private/tmp/forge-release-verify-<sha>/` and parses that tree's own `tsconfig.json`.
- Follows the import closure from the FORGE run roots: `run-forge-projections.ts`, `starterBoardQueue.ts`, `run-projection-v2.ts`, `run-rolling-forge-pipeline.ts` (its data-loading steps included), `drain-starter-board.ts` and `api/internal/starter-board.ts`. It follows static, re-export, `require` and literal dynamic imports, type imports included.
- Requires `seasonBootstrap.ts`, all three stages, `skater-queries.ts`, `run-lifecycle-queries.ts` and `dailyBoardEvidence.ts` to be in the closure.

**What fails it:**
- any import of, or name for, `projectionSourcesConfig` / `PROJECTION_SOURCES_CONFIG`;
- any `PROJECTIONS_*` / `projections_*` string or template literal;
- a non-literal `.from()` / `.rpc()` site whose resolved literal values include such a name;
- an unresolvable non-literal site that isn't in the reviewed list;
- a dynamic import, or an unresolvable local import.

To resolve sites it follows constants (also imported ones), `as const` loops, ternaries and same-file helper callers. It writes a deterministic JSON receipt with no timestamps.

| SHA | Result | Closure | Dynamic sites | Receipt sha256 |
|---|---|---|---|---|
| `538100d41ee87e721d2764b694f7bac8c2f2bb34` (master #385, production) | **VERIFIED**, 0 findings | 192 modules, `modulesSha256 4bf0fce7a4bf1e6ed7b5e8b28b8524836f4b6969adfe57e80ae373b2f847cbbb` | 21: 11 resolved automatically to native tables, 7 sites (10 call lines) reviewed and recorded in `REVIEWED_DYNAMIC_SITES` | `4382282d8564a3e10465c02f7062d336b9d6a7d17cb4bb2eeccdda1ff96d7fc9` |
| `bd337d97aefd959832b3466037d163f320a23d99` (pre-removal #384) | **NOT VERIFIED**, 16 findings: `seasonBootstrap.ts` imports and uses `PROJECTION_SOURCES_CONFIG`, plus `source.tableName` at :190 and the nine `PROJECTIONS_20262027_*` names | 195 modules | 22 | `458002e81ee0c9c9fdccf520a335641354b9017d8ced7b0c25b6cde26fa974bb` |

The 538100d41 closure includes the writer's own guard regex `/^projections_/i` (`run-forge-projections.ts:425`). It is recorded as a guard, not a reference.

**Lineage note:** master is squash-merged, so `7007a0527` is not an ancestor of 538100d41. Verification inspects the release tree itself, not its history.

`VERIFIED_FORGE_RELEASES` (`web/lib/projections/verifiedForgeReleases.ts`) has exactly one entry: 538100d41 by full SHA, with the receipt path, receipt sha256, verifier version and closure hash. `verifiedForgeReleases.test.ts` checks four things:
- the receipt file's hash;
- `verified: true` with no findings;
- the closure hash, and that the receipt was produced by the current verifier script (so changing the verifier forces re-verification);
- exact-only SHA matching.

## Tests (step 2)

On a `git archive HEAD` tree with only the new tests, fixtures and allowlist overlaid, **20 fail** (`head2-baseline.log`). Most fail because the new API doesn't exist yet. The substantive gap is that HEAD rejects every snapshot-less run, which is what blanks production.

| Case | Where | Result |
|---|---|---|
| Allowlisted exact SHA, single invocation, accepted | `externalInputProof.test.ts`, `apiHelpers.runAdmission.test.ts`, `forgeDailyBridge.test.ts` (end to end through the RSO loader) | pass |
| Unlisted or newer SHA rejected | `externalInputProof.test.ts` | pass |
| Short, prefix, suffix, upper-case, `local:`, `local:unknown` or null SHA rejected | `externalInputProof.test.ts`, `verifiedForgeReleases.test.ts` | pass |
| Pre-removal `bd337d97a` rejected, both as a run and as a failed receipt | `externalInputProof.test.ts`, `verifiedForgeReleases.test.ts` | pass |
| Resumed, resume-less, running or failed run of the listed SHA rejected | `externalInputProof.test.ts`, `apiHelpers.runAdmission.test.ts`, `forgeDailyBridge.test.ts` | pass |
| Captured proof still accepted; an unproven snapshot never rescued by the SHA | `externalInputProof.test.ts` | pass |

## Checks

| Check | Scope | Result |
|---|---|---|
| Vitest (offline, TZ=UTC), under the heavy lock | `lib/projections lib/player-forecasts lib/rosterScheduleData lib/rosterScheduleOptimizer __tests__/pages/api/v1 tests/api lib/dashboard lib/cron` | **passed**: 335 files, 5497 passed, 1 skipped (pre-existing) |
| Focused re-run after the hashing fix | `verifiedForgeReleases.test.ts`, `externalInputProof.test.ts` | **passed**: 32/32 |
| Whole-project tsc (`--max-old-space-size=12288`), under the heavy lock | `web/` `tsc --noEmit` | **passed**: exit 0, no diagnostics. The first locked run failed on 3 `Buffer`/`BinaryLike` typings in my new files; they were fixed by hashing UTF-8 text, and the receipts were regenerated (the closure hash is unchanged) |
| eslint | the 8 step-2 source and test files | **passed**: exit 0 |
| Verifier run | 538100d41 (pass), bd337d97a (fail as expected) | as tabled above |

## Hashes (sha256, working tree at receipt time)

- `4001a93214c2bfdf49d008e8eab88cd0acb7d43f8cd4d61660817a761ca9cbfe`  web/lib/projections/externalInputProof.ts
- `6fcf19721d797fb6033d58088c071c51fcee981425685db0d7f5552668a998a2`  web/lib/projections/externalInputProof.fixtures.ts
- `3d99de98e39e32058797e39e52b2d566adbb07bbbf3fbb81b15f54cad0cf0c2d`  web/lib/projections/externalInputProof.test.ts
- `8e926eac2abc05c0a983ab9c8f2c461668d861e4fe543e13c0a61103b32d385a`  web/lib/projections/verifiedForgeReleases.ts
- `a4b4e46981c71afe634c96d41370385a17dba9580020487e19e1e4f20d6ad437`  web/lib/projections/verifiedForgeReleases.test.ts
- `a7fe43be9ef2668fbe2dd5f1c93f9b2b8696870277f463208af40b05dd5650f3`  web/scripts/verify-forge-release-sha.ts
- `713c4e009a2e0d1c4c55ac1878602536c3364e80ab1a508f617a265675ad64b8`  web/lib/projections/apiHelpers.runAdmission.test.ts
- `f96946c3859cdeaa64aeb8985ac93e87b76fed88a605d3ce775fa6ae9953d2d3`  web/lib/rosterScheduleData/forgeDailyBridge.test.ts
- `4382282d8564a3e10465c02f7062d336b9d6a7d17cb4bb2eeccdda1ff96d7fc9`  tasks/artifacts/projection-table-audit-2026-10-26/release-verification/538100d41ee87e721d2764b694f7bac8c2f2bb34.json
- `458002e81ee0c9c9fdccf520a335641354b9017d8ced7b0c25b6cde26fa974bb`  tasks/artifacts/projection-table-audit-2026-10-26/release-verification/bd337d97aefd959832b3466037d163f320a23d99.json

## Paused state (orchestrator pause notice, TJ instruction, 2026-10-26)

Step 2 is **complete**: its code, tests, verifier run, locked checks and this receipt are done. Nothing is half-edited, and no background job or heavy lock is held (the lock file is absent). Nothing was committed, deleted, reset, pushed or deployed, and capture was not activated.

**Exact file state** against HEAD `3795abb437a48fd649a48356908df8367a6abe9c`:
- **Modified, uncommitted:**
  - `web/lib/projections/externalInputProof.ts`
  - `externalInputProof.fixtures.ts`
  - `externalInputProof.test.ts`
  - `apiHelpers.runAdmission.test.ts`
  - `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`
- **New, untracked:**
  - `web/lib/projections/verifiedForgeReleases.ts`
  - `web/lib/projections/verifiedForgeReleases.test.ts`
  - `web/scripts/verify-forge-release-sha.ts`
  - `tasks/artifacts/projection-table-audit-2026-10-26/release-verification/{538100d41…,bd337d97a…}.json`
- **Also untracked in this folder from step 1:** `REPORT.md`, `TRACE-NOTES.md`, `PROD-READ-PLAN.md` and `PROV-GUARD-RECEIPT.md`, plus this receipt and the diary `tasks/diaries/2026-10-26-claude-prov-guard.md`.
- `web/next-env.d.ts` is modified, but not by this lane.
- The hashes above match these files at receipt time.

**Unfinished or open, not started (out of scope or awaiting approval):**
1. A TJ-approved read of `metrics->resume->>invocations` for the two released runs. Until it runs, it's unknown whether production output will be served under the single-invocation rule.
2. Teams, goalies and game predictions (`projections/goalies.ts`, `projections/teams.ts`, `forge/goalies.ts`) were not touched. TJ has sent that scope to an independent Astra audit.
3. Writer-side attribution fix (refuse cross-SHA resume, or stamp each invocation's SHA). Not started; outside the lease.
4. `consumerRevisionAdmission.ts` could reuse `validCapturedReadReceipt`. Not started; outside the lease.
