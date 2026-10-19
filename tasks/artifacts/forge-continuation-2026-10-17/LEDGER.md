# FORGE continuation — evidence ledger, 2026-10-17

Owner prompt: `fhfh/01-forge-forecast-serving.md`. Checked 2026-10-17 at about 17:30 UTC on `octoberBranch` `448231ec` (clean before this work). No hosted reads or writes, provider requests, deployments or activations were made in this pass.

## 1. Source drift

The nine producer files pinned by the private Oct 16 output-preparation preflight hash identically on `octoberBranch`. That covers `baselineGeneration.ts`, `goalieBaselineRates.ts`, `baselineRates.ts`, `baselineSourceLineage.ts`, `modeledSkaterParticipation.ts`, `modeledGoalieParticipation.ts`, `contributionStore.ts`, `nativeBaselineCadence.ts` and `sourceSnapshot.ts`. There is no source drift since that preflight.

## 2. Operation reconciliation (from durable receipts only)

Private root: `/Users/tim/Documents/FHFH-private/forge-rso-completion-20261016-v1/`. The newest file anywhere under the private root, the repo artifacts, `/private/tmp` or `~/Documents/Codex` is from 2026-10-16 09:32 UTC. Nothing was recorded after the interruption.

| Operation | Receipt | Classification |
|---|---|---|
| Compatibility materialization (closure `0018bcbf…`, clock `08:48:28.198Z`) | `native-cadence-materialization-execution-v1`; GET-only recovery `native-cadence-readonly-reconciliation-execution-v1` (209 GETs, 0 writes) | **Acknowledged and verified.** Development-compatibility scope only. Do not repeat. |
| Daily materialization dry run | `daily-materialization-dry-run-20261016-v1/receipt.json`: `dry_run`, 0 network | Complete (dry) |
| **Daily materialization execution**, run `0faf9c98-30c6-4bab-a76d-3dd1952259c4` | `daily-materialization-execution-20261016-v1/receipt.json`: `status: closed`, 423 requests, 3 inserts (all 201), ledger of 846 lines with no failures; closure `de9e317f-6f5c-4e0a-ad98-c6866e80cafc` at `2026-10-16T09:29:54.363Z`; cadence scope `27a0a920…` | **Acknowledged and closed.** Do not repeat. |
| Hosted catalog head presence | `daily-acquisition-contract-20261016-v1/head-presence.json` at 09:30:56Z: `native_forecast_catalog_heads` and `cas_native_forecast_catalog_head` are both **absent** | Head DDL not applied |
| Daily output preparation (morning slot due `2026-10-16T12:00:00Z`) | `daily-output-preparation-20261016-v1/preflight.json`: `preflight_only`, `due: false` at 09:32:33Z; no `issued-output/` directory | **Never dispatched** |
| Noon driver | No automation, launchd job, crontab, process or receipt found. The only active Codex heartbeat (`forge-finite-experiment-dispatch`) belongs to the separate walk-forward pilot and expired 2026-10-16 14:05Z | **Never armed** |
| T−15 news slots (`2026-10-17T00:45Z`, `01:45Z`) | None | Never dispatched |

**Unrecoverable for Oct 16.** Every retained native source expires at `2026-10-16T17:22:59.471Z`, `2026-10-17T02:44:24.131Z` or `2026-10-17T04:30:03.926Z`, so all have expired. The preparation logic (old and new) refuses to renew an original expiry, and late issuance or backdating is not allowed. The Oct 16 retained scope can no longer be issued or published. A current forecast needs a **new** acquisition with a new cutoff (see §6).

## 3. Checklist (`tasks/artifacts/forge-rso-completion-2026-10-15/checklist.md`)

The current file shows 7/20 leaves checked: 1.2, 2.1, 2.2, 2.3, 2.5, 2.6 and 3.1, each with its receipts in that file. This pass checks no additional leaf.

| Leaf | State after this pass |
|---|---|
| 1.1 reconcile implementation and pins | Open. Pins re-verified (§1); release-universe coverage inventory not done |
| 1.3 daily-points through production | Open. Blocked on a fresh acquisition and publication (§6) |
| 1.4 all targets | Open. Owned-five participation gap is preserved (`pipeline/owned-five-final.md`) |
| 1.5 horizon coverage accounting | Open |
| 1.6 recurring refresh path | Open. **Advanced locally:** output preparation is now a checked-in, tested CLI stage (§4) instead of a private script. Head DDL and scheduler binding are still pending |
| 1.7 history integrity | Open. The new stage keeps original clocks and expiries, and reviews come back pending |
| 1.8 approved production batch | Open. Needs approval (§6) |
| 2.4 owned-roster-first optimization | Open (RSO owner) |
| 2.7 published-feed readback | Open. Nothing current is published |
| 2.8 release | Open |
| 3.2–3.4 research | Open. Separate, and protected outcomes stay sealed |

## 4. Change made (local, uncommitted)

| File | Change |
|---|---|
| `web/lib/player-forecasts/nativeCadenceOutputPreparation.ts` (new) | `prepareNativeCadenceOutputs(command, proof, now, newId)`. This is the private `prepare.ts` logic made generic: there are no hard-coded paths, and the reviewed plan, proof and clock are all injected. |
| `web/scripts/native-baseline-cadence.ts` | New offline `prepare` stage: `materialize → prepare → (independent review) → publish`. It refuses `--execute-target`, needs an exact closed proof hash, writes `publication-plan.json`, `cadence-command.json` and `receipt.json` with exclusive create, and never builds a DB client. |
| `web/lib/player-forecasts/nativeBaselinePublication.test.ts` | Three focused tests (described below) |

The stage refuses to issue before the slot's due time or before the closure, and refuses expired original sources or participation. It also refuses reproduced forecasts that differ from the reviewed plan apart from issuance, a mismatched input manifest or closure scope, and an unclosed proof.

What the three tests cover:
- **Reissue round trip:** means are unchanged and the review comes back pending. `validateCadenceCommand` rejects the plan while the review is pending and accepts it after a simulated approval.
- **Refusals:** early, expired, tampered, scope-mismatch and unclosed-proof inputs are each rejected.
- **CLI:** the stage runs offline with zero network calls, refuses to overwrite an existing output directory, and refuses an execution target.

Usage, from `web/`:

```sh
NODE_PATH="$PWD" NODE_OPTIONS=--max-old-space-size=8192 ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/native-baseline-cadence.ts prepare --input PRIVATE_PREPARATION_COMMAND --input-sha256 SHA --proof PRIVATE_CLOSED_STAGE --proof-sha256 SHA --out NEW_PRIVATE_DIRECTORY
```

The command (`native-output-preparation-v1`) carries:
- `slotKey`, `dueAt`
- the materialization identity: `runId`, `sourceKey`, `date`, `closureScopeHash`
- `games`, `requiredAcquisitionScopes`
- `reviewedPlan`: the earlier reviewed rows over the same inputs, including the selected participation bundles.

## 5. Verification

| Check | Result |
|---|---|
| `npm test -- --run lib/player-forecasts/nativeBaselinePublication.test.ts` | **Passed** 67/67 (64 existing + 3 new; rerun after review fixes) |
| Mutation check: removed the expiry guard | New test failed, as it should. Guard restored and the file re-ran 67/67 |
| `npx eslint` on the 3 changed files | **Passed**, no output |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental false` | **Passed**, exit 0 |
| Independent review | See §7 |
| Consumer readback (FORGE, RSO, Start Chart API/UI) | **Not run.** Nothing current exists to read back, and a local dev server would read the production database |

The new tests use synthetic native-skater fixtures only. Goalie and participation reissue paths reuse the same builders but are not covered by a new test.

## 6. Pending hosted approvals (in order; each is a separate yes)

The cadence decision on record: `schedule/cadence/native-approval-package.md` says you approved 08:00 America/New_York with DST and T−15 revisions, and did **not** approve live activation. That file is a secondary record; I did not find the original decision message.

1. **Head DDL.** Apply the reviewed `native_forecast_catalog_heads` table and `cas_native_forecast_catalog_head` RPC from `tasks/artifacts/forge-rso-completion-2026-10-15/pipeline/native-catalog-head-review.sql` (sha256 `4149d89d…`).
   - Its independent review (`native-catalog-head-independent-review.json`) found no remaining blockers against local PG17.
   - Scope: one migration, plus a read-only presence check after.
   - Rollback: drop the table and function. Nothing selects through it until step 5.
   - Now added as `supabase/migrations/20261017175221_native_forecast_catalog_heads.sql` and verified locally (§8). **Not applied to the hosted database.**
2. **Fresh acquisition for one target New York date** (choose the date).
   - Provider GETs only: NHL roster, boxscore, landing and schedule; plus the existing Yahoo read for team `477.l.125593.t.10`.
   - Use the same bounded collector as Oct 16 (`native-source-capture-proposal.md`). It retained 120 responses / 1.57 MB for 19 players, and 29 club rosters for the 69-player daily scope.
   - No Yahoo transactions.
   - The acquisition-contract builder is still a private script (`daily-acquisition-contract-20261016-v1/prepare-retained-preflight.ts`) and would run as a new dated copy.
3. **Materialize execute.** The existing `materialize` stage writes to `player_forecast_source_observations` only.
   - Oct 16 actuals: 423 requests, 3 inserts, about 89 MB download.
   - Bounds: 1,320 requests, 180 s, 64 MiB upload.
4. **Offline `prepare`, then independent review.** No hosted effect. Six native validation reviews and nine participation `reviewRef`s need a real reviewer.
5. **Publish and catalog-head CAS.** The existing `publish` stage, after step 1: journaled inserts plus one CAS.
   - It must complete before the original source expiry. That is the reason the same-day timing matters.
   - Rollback: CAS back to the prior head, or leave it unselected; originals are immutable.
6. **Consumer readback.** Up to 5 sequential read-only requests (FORGE next-20, Start Chart API, RSO, Start Chart UI), comparing IDs, hashes and coverage against the publication receipt.
7. **Scheduler binding** for 08:00 New York and T−15 is a separate later activation, and is not requested here.

## 7. Independent review

A read-only reviewer subagent compared the port with the private `prepare.ts` and found **no blocking bugs**. Row identities, clocks, review/policy handling, participation and the CLI's no-network/no-overwrite guarantees match.

Fixed after review, then re-verified (67/67 tests, lint clean, `tsc` exit 0):
- **Medium:** the top-level `proof.manifest` was not bound to the hashed report/closure. It is now required to equal `report.payload.manifest`, `closure.inputRevision` and `closure.expectedItems` (new test: forged manifest → `materialization_manifest_unbound`).
- **Medium:** acquisition scope was not checked against the closure. `requiredAcquisitionScopes[sourceKey]` must now match `closure.acquisitionScopeHash` and `inputCutoffAt` (new test → `acquisition_scope_mismatch`).
- **Low:**
  - The bundle-manifest expiry is now checked.
  - Participation comparison strips only `issuedAt`, so a changed `released` flag is caught.
  - Report rows must match `dataset`.
  - A policy row shared by several bundles is included once.

Not changed:
- The reviewer's "missing `--out`" note: the CLI already requires `--out` before any stage runs.

Remaining test gaps:
- No goalie, participation-bundle or prior-appearance input in the new tests.
- The tests share one id counter.

## 8. Catalog-head migration (local only)

- **File:** `supabase/migrations/20261017175221_native_forecast_catalog_heads.sql` (sha256 `ca0b5bcd641c442c18ca0d58f7a766e697072d2d424f89261320c161132a87ca`).
- **Body:** byte-identical to the reviewed `native-catalog-head-review.sql` (`4149d89d…`) from `BEGIN` on. The only differences are the header comment and two added lines, `SET lock_timeout = '5s'` and `SET statement_timeout = '30s'`, matching neighbouring migrations.
- **Harness:** `catalog-head-migration-pg-verify.py` is the reviewed harness with only its SQL path changed. It ran against a new throwaway PostgreSQL 17 cluster (Unix socket, TCP disabled) and **passed all 6 cases**:
  - initial service-role CAS
  - revision/previous-hash conflicts leave the head unchanged
  - exact advance
  - wrong season/expired/wrong kind/missing or null expiry and season are rejected
  - two concurrent initial callers produce exactly one winner
  - anon/authenticated have no read or execute, and service_role cannot update directly
- **Receipts:** `catalog-head-migration-pg-result-v1.json` and `-log-v1.txt`. Cluster stopped and removed; 0 hosted requests.
- **Caller:** `web/lib/player-forecasts/nativeCatalogHead.ts` uses the same RPC name and parameter names (`p_head_id` … `p_payload_hash`).
- **Applying it to hosted** is still approval step 1 in §6.
  - Use a single targeted apply of this one migration, not a bulk `supabase db push`. Hosted migration-version drift is unresolved (register row 17: three versions have no local file).
  - Follow it with a read-only presence check.

## 9. Steps 3, 4 and acquisition binding (2026-10-17, local only)

### Step 4: expiry, replacement, partial refresh

Reran the existing named consumer tests on current code. All **passed**: 38 tests.

| File | Tests | Result |
|---|---|---|
| `__tests__/pages/start-chart.test.tsx` | source deadline, expiry timer, already-expired | 4 passed |
| `RosterScheduleOptimizer.test.tsx` | held-open revalidation, saved snapshot, expired-catalog recovery, roster reload, scope refresh with late response | 9 passed |
| `__tests__/pages/forge/forecasts.test.tsx` | expiry | 4 passed |
| `__tests__/pages/api/v1/start-chart.test.ts` | expiry, stale, replacement, partial | 10 passed |
| `lib/rosterScheduleData/planning.test.ts` | expiry, catalog, stale, partial | 11 passed |

**Added:** an exact-boundary test for serving-side catalog admission (`nativeCatalogHead.ts`). The catalog is admitted at expiry − 1 ms and fails closed (pins emptied) at expiry and at expiry + 1 ms. A clock before issuance is also rejected. Mutation check: changing `<=` to `<` makes the test fail.

### Step 3: expected-key coverage (engineering replay; **not current coverage**)

`coverage-reconciliation.py` enumerates the contract's 69 players (62 skaters, 7 goalies) × each player's next 20 scheduled team games × the required targets:
- skaters: G, A, PPP, SOG, HIT, BLK, PIM
- goalies: SV, GA, SA, minutes, W, SO (SV% and GAA are derived from these)

It classifies each key against the pinned ability sources and participation receipts. Counts are in `coverage-summary-v1.json`; per-key detail stays private (`coverage-reconciliation-20261017-v1/keys.json`). No network, database or producer calls.

- **9,520 expected keys, each classified exactly once.** No source-time team binding differs from the contract team.

| Group | Generated | Missing | Excluded |
|---|---|---|---|
| Owned 19 | 1,920 | 700 | — |
| Candidates 50 | 5,400 | 300 | 1,200 |

- The 700 owned missing keys are exactly the known owned-five gap (5 players × 7 targets × 20 games). Two reasons: 560 `unknown_eligibility_or_occurrence`, and 140 that also have a `known_current_roster_conflict`. This matches `pipeline/owned-five-final.md`.
- Candidates: 300 missing have no pinned ability source; 1,200 are excluded for having no participation receipt for that game.
- Goalie start receipts: 100 present, 40 missing (two goalies × 20 games). Start probability stays separate from appearance.
- **As of 2026-10-17T18:25Z every key with a clock is expired.** Participation receipts expire at the first game (`2026-10-17T01:00Z`) even for later games.

### Acquisition-contract builder

The private `prepare-retained-preflight.ts` is mostly specific to the retained scope. It patches an older compatibility request, adds two missing club rosters, and asserts the exact 69 Yahoo mappings. Checking it in unchanged would not make a fresh daily run reproducible.

Checked in instead, the reusable binding step:
- `nativeAcquisitionScopeHash(request)` is exported from `nativeInputMaterialization.ts`. The materializer's two inline copies now call it, with identical behaviour.
- `bindNativeCadenceMaterialization(request, {runId, sourceKey, date, seasonId, games})` in `nativeBaselineCadence.ts`. It sets the run identity and returns `requiredAcquisitionScopes` and `closureScopeHash`.
  - New test: the materialized closure carries exactly the bound scope hashes, the input is not mutated, and a different game list changes the closure scope.

**Still a gap:** assembling a fresh request from new captures has no checked-in path. That covers the roster/boxscore/landing/schedule receipts, Yahoo mapping, participation inputs and native selection. The Oct 16 chain used several private one-off scripts. This is real design work, not a port.

### Regression I caused and fixed

The catalog-head migration in `4ce7e1f5f` broke `lib/supabase/supportedBaselineMigration.test.ts`. That test pins the migrations folder to `tasks/TASKS/repository-audit-remediation/migration-authority.json`, and it passes 19/19 with the migration removed.

Fixed following the existing convention:
- the migration is registered as order 83, `pending`, with an explicit rollout gate
- the test counts went from 82 to 83 records and from 2 to 3 pending
- the count sentence in `tasks/TASKS/super-goal/super-goal-final-summary.md` was updated

It passes 19/19 again.

### Pre-existing failures on octoberBranch (not caused by this work)

The files below were last changed by `7f094c8e6` and do not import any new code:
- **`lib/rosterScheduleOptimizer/planningReproducibility.test.ts`:** 10 failures. Five are in the 2026-10-16 release baseline; five are new on octoberBranch.
- **`lib/rosterScheduleOptimizer/planning.test.ts`:** 2 failures (snapshot schema rejects `powerPlayRole`).
- **`__tests__/pages/api/v1/start-chart.test.ts`:** 2 failures, including "matches crowded-day RSO selection to Start Chart ranks". That is the shared FORGE→Start Chart basis check.
- **`lib/player-forecasts/currentSeasonSogContribution.test.ts`:** 1 failure.

These belong to the RSO and Start Chart owners (`fhfh/02`, `fhfh/03`), and they matter for shared-basis acceptance.

### Verification for this section

| Check | Result |
|---|---|
| `nativeBaselinePublication.test.ts` | 69/69 passed |
| `lib/player-forecasts` + migration test | 992 passed, 1 failed (the pre-existing SOG test above) |
| ESLint on the changed files | Clean |
| `tsc --noEmit` (8 GiB heap) | Exit 0 |

## 10. Expired Oct 16 consumer readback (approved; 2026-10-17 ~18:33Z)

**Setup.**
- A local `next dev` on `127.0.0.1:3105`, building into `PLAYER_FORECAST_ISOLATED_NEXT=1` (`.next-player-forecasts`).
- The four Oct 16 release pins from `consumer-browser-v3/final-combined-pins.json` were set in the process environment only. No file or hosted configuration changed.
- It read the hosted database through the normal server client.
- Exactly **5 application requests**, sequential, all GET. No writes.
- Bodies, receipts and server log are in private `consumer-expired-readback-20261017-v1/`.

| # | Request | Result |
|---|---|---|
| 1 | FORGE next-20: `/api/v1/forge/forecasts?seasonId=20262027&startDate=2026-10-17&endDate=2026-12-15&mode=next_n&games=20&timeZone=UTC` | 200, 1,159,441 B |
| 2 | Start Chart API: `/api/v1/start-chart?date=2026-10-17&forecast_source=game_expectations` | 200, 5,456 B |
| 3 | RSO shared inputs: `/api/v1/roster-schedule-optimizer/data?seasonId=20262027&startDate=2026-10-17&endDate=2026-10-25&timeZone=America/New_York` | 200, 462,892 B |
| 4 | Start Chart UI: `/start-chart` | 200 |
| 5 | The UI's own call to request 2's URL | 200 |

**Result: every consumer failed closed. No expired Oct 16 value was served.**
- **FORGE:** 1,065 players.
  - `sources`, `participation`, `models` and `revisions` catalogs are all empty, and `baselineChecksum` is null.
  - Every player has null expected appearances/starts and `horizonComplete: false`.
  - Revision reason: `no_issued_revision`.
- **Start Chart API:** 0 players and 0 projections; serving mode `partial`, reason `game_expectation_coverage`, overall status `degraded`.
- **RSO data:** 0 forecasts, 0 baseline sources and 0 participation sources; `issuedRevisionIds` is empty.
  - Per-game exclusions read `incomplete_refresh` / `serving_disabled`.
- **Start Chart UI:** "No player projections found."; Model, Run and Published time are all shown as Unavailable, and Input as "Unverified".

**Limitation.** The responses don't distinguish *why* the pinned releases were not admitted. Expiry is the expected reason, since every source expired by 2026-10-17T04:30Z, but the payloads don't name it. This proves non-admission of these releases. It does not prove an expiry-specific rejection path. That path is covered by the exact-boundary unit test in §9.

**Incident during setup (no hosted reads).** My first attempt started the server through the preview tool with the default `.next` build folder.
- That auto-opened `/` and, because `next.config.js` has `cleanDistDir`, **wiped `web/.next`, which your already-running dev server on port 3000 (PID 20004) uses**.
- Both servers then fought over the folder: `GET /` returned 404 in a fast-refresh reload loop until I stopped it.
- Only 404 pages were served, so there was no hosted data read.
- Your port-3000 server was left running and untouched. It may need a restart to rebuild cleanly.

## 11. Catalog-head migration applied to hosted (approval step 1; 2026-10-17)

**Approval.** The user's message authorized me to apply "B" (the catalog-head migration) myself through the connected Supabase tool. It was applied once, via `apply_migration`, to project `fyhftlxokyjtpndbkfse` (`fhfhockey.com`, Postgres 15, ACTIVE_HEALTHY).

**Read-only preflight:**
- table and RPC absent
- `player_forecast_source_observations` present
- roles anon/authenticated/service_role present
- latest ledger version was `20261016152305`, the already-recorded Oct 16 RPC revocation

The local harness had run as a superuser on Postgres 17, so I also confirmed that the function owner `postgres` has BYPASSRLS (it is not a superuser). The security-definer CAS can therefore write to the force-RLS table.

**Applied body.** The reviewed body, without `BEGIN;`/`COMMIT;` (the tool runs its own transaction), with `SET` changed to `SET LOCAL` so the timeouts can't persist on a pooled connection.

**Read-only post-apply check:**

| Check | Result |
|---|---|
| Table and RPC | Present |
| RLS | Enabled and forced; 0 policies, 0 rows |
| Table grants | Only `service_role:SELECT` |
| RPC EXECUTE | anon false, authenticated false, service_role true |
| Function | Owner `postgres`, SECURITY DEFINER, `search_path=public, pg_temp` |
| Session `lock_timeout` | Back to 0 (no leak) |
| Ledger | Version `20261017183611`, name `native_forecast_catalog_heads` |

**Local alignment.**
- The migration file was renamed to `supabase/migrations/20261017183611_native_forecast_catalog_heads.sql` to match the hosted ledger version, and its timeouts changed to `SET LOCAL`. Its body equals the applied body apart from `BEGIN`/`COMMIT`.
- The authority row now reads `applied` with the ledger receipt. Test counts changed: applied 51→52, pending 3→2. The summary sentence is updated.
- `supportedBaselineMigration.test.ts` passes 19/19.
- The `-pg-verify.py` harness and result in this folder reference the earlier filename (`20261017175221_…`). Those are historical receipts for the pre-rename body; the only textual difference is `SET` versus `SET LOCAL`.

**Not done.** No head row, catalog selection, CAS call, publication, scheduler binding or activation. Approval step 1 in §6 is complete; steps 2–7 remain gated.

## 12. v1 daily pipeline built (2026-10-17; uncommitted)

**What it is.** PRD `tasks/prd-forge-daily-pipeline.md`; task list `tasks/tasks-prd-forge-daily-pipeline.md`; runbook `LIVE-RUNBOOK-20261020.md`. Driver: `web/scripts/forge-daily.ts` (`capture` / `inputs` / `outputs` / `review`). Library: `web/lib/player-forecasts/nativeDailyPipeline.ts`, plus the daily mode in `nativeCadenceOutputPreparation.ts`.

**What it refreshes and what stays frozen:**
- **Fresh:** club rosters, the schedule, frozen-window scope evidence and all participation inputs.
- **Frozen:** the Oct 16 native means are re-issued with their approved candidate hashes, a disclosed new expiry and their original cutoffs.

**Verification:**

| Check | Result |
|---|---|
| Focused tests | 77/77 passed |
| ESLint | Clean |
| `tsc` | Exit 0 |
| Target-date replay at Oct 20 clocks | Passed (see the runbook) |
| Independent review | Pass 1 found 3 blocking issues (all fixed); pass 2 found nothing blocking |

**Defects the dry-runs and the review caught, all fixed:**
- a participation row over 8 MiB
- the 500-entry bundle cap
- review-row clocks
- **every receipt null after 24 h**, because the history scope evidence was stale; fixed by re-observing the frozen window
- an Oct 16-clock dry-run that could not see clock rules

**Not in v1:**
- a fresh Yahoo universe or injury read
- fresh native means (v2, after the Oct 28 readout)
- a rolling-window participation method (a method change for owner approval)
- unit tests for the CLI gates

## 13. Live run 2026-10-19 (scheduled task `forge-daily-live-20261020`; Chef, ~11:50–12:06Z)

**Outcome: not published.** Every stage through review passed. The publish dry run came back `held` (`native_target_scope_mismatch`), so no publish execute, no catalog-head CAS, no head ID and no readback.

All paths below are under `P=/Users/tim/Documents/FHFH-private/forge-rso-completion-20261016-v1/daily-20261019-v1/`.

**Pre-checks.** Started 11:50:48Z, well before the 20:00Z cutoff. HEAD was `865cbbf12`, which contains the driver `0de97e77d`. The frozen v2-ownership files equal HEAD; the only dirty file was the unrelated `tasks/sprint-2026-10-18/CHEF-REGISTER-2026-10-19.md`.

| # | Step | Result |
|---|---|---|
| 1 | Head check (1 SQL read, Supabase MCP) | `native_forecast_catalog_heads` exists with 0 rows; the CAS RPC is present |
| 2 | Capture (`capture/`) | The plan-only run matched: 27 club rosters, Sep 29 and Oct 6 weeks, 8 future weeks from Oct 19. Execute made 37 GETs, all 200, about 1.19 MB, 11:51:24–11:52:04Z, api-web.nhle.com only, no Yahoo |
| 3 | Inputs (`inputs/`) | `inputs_bound`. Cutoff 11:52:04.734Z; 1,260 participation inputs; 477 parents (524 dropped); 4 games; all gates passed |
| 4 | Materialize dry (`materialize-dry/`) | 205 rows (1 parent, 120 http receipts, 81 player, 3 participation inputs) plus report and closure; manifest 1,341 items, revision `ebfda674…` |
| 4 | Materialize execute (`materialize/`) | **`closed`.** 427 requests, 6 insert attempts, 17.9 MB up, 86.9 MB down, about 95 s (≤1,320 and ≤180 s). Closure at 11:53:48.782Z. This is the only hosted write of the run: inserts into `player_forecast_source_observations` |
| 5 | Outputs (`outputs/`), run at 12:00:32Z | Issued 12:00:33.671Z. 104 rows; 81 native inputs; 584 native sources; 1,260 entries, **100 null** (gate 100). Expiry 2026-10-19T22:59:59.999Z. planHash `7ecf13a5…cc02` |
| 6 | Independent review (`review-decision.json`) | **Approve** (reviewer `forge-daily-independent-reviewer-agent-2026-10-19`, reviewRef `…:c46ce31c…3fb2`, reviewedAt 12:03:57Z), with 7 findings |
| 7 | Review applied (`reviewed/`) | `reviewed_pending_publish`; reviewedPlanHash `08c5e4e2…6bba`; head ID drawn `779f3aef-3b5e-427e-80a9-f01b995bf89a` (unused) |
| 7 | Publish dry (`publish-dry/`) | **`held`: `native_target_scope_mismatch`.** 0 network requests. Not executed |
| 8 | Readback | Not run (nothing selected to read) |

**What the reviewer found** (all pass):
- **Means and cutoffs.** All 584 sources are identical to the reviewed Oct 16 rows; only issuedAt and expiresAt differ.
- **Re-issue disclosure.** Present on all 6 review rows.
- **Participation.** Identical to the Oct 20 replay. Nulls break down as:
  - 60 `unknown_eligibility_or_occurrence`: 9711, 10012, 10043
  - 20 `stale_eligible_history`: 10448
  - 20 for Fiala 9572: `known_current_roster_conflict` + `no_eligible_history`
- **Expiry.** Uniform.
- **Ledger.** Clean.
- **Rows.** 104 rows, unique IDs, every hash recomputes.
- **Injury limit to name (disclosed limit).** Spurgeon (9431), Yahoo O (Upper Body) on Oct 16, receives p=1 on all 20 receipts with `knownConflict=null`.

**Why it held.** `publishObservedNativeBaselineCadence` (`web/lib/player-forecasts/nativeBaselineCadence.ts:91-95`) requires every seasonal-rate source to bind to a participation or game target with the same player, team and `rosterRevision`. The 9 means-only players have 75 sources and no targets at all: 8769, 9392, 9806, 9936, 10134, 10590, 10637 (9 sources each) and 9682, 10622 (6 each). The season, game-clock, required-game and issuance checks all pass. The Oct 20 replay's `cadenceValidation: 104` ran only `validateCadenceCommand`, never this slot-scope check, so the gap was untested until today. It is deterministic, so a retry would hold the same way.

**Publish decision (Chef): do not publish.** Two ways around it exist, and neither is authorized:
- Passing the gate would need an edit to a frozen run file. They stay frozen until 2026-10-20 17:00Z.
- The other way is hand-dropping the means-only sources from an already-reviewed plan. That would change the plan hash, need a new review, and remove 9 players from what the review approved.

**Revisit (recommended)** after the freeze lifts:
1. Make `outputs` emit seasonal sources only for players who have participation targets, or emit explicit game-bound targets for means-only players. This needs a decision on whether means-only players are served at all.
2. Extend `daily-dry-run.ts` to run the publish dry run (`publishObservedNativeBaselineCadence`, dryRun) against the reviewed command, so the replay exercises this gate.
3. Re-run a dated live run.

The method window still accepts cutoffs until 2026-10-27 04:00Z.

**Hosted footprint today:** 1 read-only SQL, 37 NHL GETs, and the closed materialize inserts above. No publish, no CAS, no Yahoo, no readback requests, no Vercel, no git commit or push.

**Limits (unchanged):**
- Means are frozen at their Oct 16 cutoffs.
- Fiala's (9572) carried conflict withholds his 20 receipts.
- Injury coverage gap: 11 IR/O players are unknown, not withheld (Spurgeon named above).
- 11 of 69 players have means only. 9 of them are in the bundles and caused the hold.
- No Yahoo read in v1.
- The run date moved from 2026-10-20 to 2026-10-19.
