# FPI 11.4 — local candidate ready for independent review

**Outcome:** job79 is already correctly absent from the canonical constant. No duplicate canonical application edit was needed. A nine-file, base-relative release patch now couples that retirement and job399 records to the advisory clearance from `e89dfdde5`, with passing offline regression coverage. No live release occurred.

## Exact candidate

- Base: local `origin/master` `6d5664f761132ab479a7febec60548d0fa9ee6ff`, not refreshed from the network.
- Source: `octoberBranch` `84cb1229cd1c1cdd037c43e660d2a181304ada51`.
- Advisory source inspected: `e89dfdde58d2ce848947ab493710237223dcd440`.
- `candidate.patch` SHA-256: `4e0b4db7da44e883dd278f611c787db646b83874af8b9e7d624d4fd5c75389ec`.
- Exact base/candidate bytes and 79-file fixture manifest: `MANIFEST.json`; nine baseline files are saved under `baseline/`. `PACKAGE.json` pins the compressed offline fixture.

The patch contains only:

1. `tasks/TASKS/cron-operations/cron-schedule.md`: job79 inactive plus dated retirement/rollback record; job399 active plus its existing applied/rollback record. Other inventory reconciliations remain out of this isolated patch.
2. `web/lib/cron/nstCoordination.ts` and its test: remove 07:25 slot, retain shared-key concurrency 1 and 600000 ms completion spacing, add retirement/advisory pacing regression.
3. `web/lib/cron/nstBurstPlans.ts` and its test: transfer e89's shared advisory planner, safe interval floor and invalid explicit-interval guards. Preserve the release base's gamelog adapter/diagnostic return shape instead of replacing it with the source branch's smaller return object.
4. `web/lib/cron/nstRateLimitPolicy.ts` and its test: transfer e89's valid-input and 21-second full-job compliance guard. All four windows remain 40/minute, 80/5 minutes, 100/15 minutes, 180/hour; bursts require a complete job below 40 URLs.
5. `web/lib/cron/combinedCronInventory.test.ts` and `web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts`: assert job79 removal/job399 addition; update the one replaced caller category.

The release base already has the full-job `plannedRequestCount` and shared request ledger. `requestBudget.ts` and its tests are byte-identical between base/source; the gamelog route already supplies the full initial queue count. Those files, NST routes/client, and Claude's task 11 routes are not patched. The shared budget remains **same-user local filesystem coordination**, not cross-host/container coordination.

## Verification actually performed

- Node 22.11.0 and existing npm dependencies; no installs or environment-file loading.
- **Negative control reproduced:** retirement alone changes a 20-URL plan from burst 0 ms to 21000 ms. The new test fails for that exact reason (`retirement-only-red.log`).
- **Passed:** 102 tests across 7 files, including shared-window admission, separate local processes, full-job 39/40 boundary, explicit interval rejection, schedule alignment, inventory and static auth/audit coverage (`candidate-tests.log`, `CHECKS.json`). Network connections throw and subprocesses inherit that guard; route source is read statically, not invoked.
- **Passed:** scoped TypeScript, scoped ESLint, whitespace/applicability check and actual application to a disposable baseline fixture with exact output-hash verification (`STATIC-CHECKS.json`). Shared heavy-check lock acquired/released only by this worker.
- Initial packet omission of two existing pacing-test updates and a literal-type assertion issue were corrected; original failures remain in `initial-*` logs. Final 102-test/type/lint receipts are green.
- **Passed:** seven synthetic progress-read selection/projection properties. These are not SQL execution or query-plan evidence.

The isolated document has **56 active pg_cron  / 86 total** and 47 auth route findings (27 cron-only / 11 internal-server), because it starts from the release base and swaps one job for one job. The broader source document's 57/87 and 45 findings include other changes. Do not copy those totals blindly or describe this overlay as a full live inventory reconciliation.

## Progress-read result and remaining gates

See `PROGRESS-READ.md`. The actual query already filters job name and exact JSON scope, orders newest-first and limits two. The saved 14:02Z failure has no retained SQLSTATE, timing or plan; zero NST requests and a resumed rerun are handoff claims, not independently observed runtime here. No new route filter/index fix is justified by that evidence alone. Preserve failed receipts, explicit-scope durability and equal-timestamp ambiguity detection. A narrower JSON projection or a plan-supported partial index is a separate proposal under the route owner's lease; no index/migration was created or applied.

Smallest acceptance sequence: independent review of this pinned patch; reconcile it with the actual release candidate and existing schedule records; preserve the advisory/retirement coupling; rerun focused checks if reconciliation changes bytes. Publishing/deployment and live diagnostics need separate authority. This package does not prove a new scheduled FORGE→RSO→Start Chart completion or a currently healthy production pipeline.

Task accounting for ledger: **FPI 11.4 local preparation complete, independent review/release pending**; progress-read optimization **diagnosis pending actual error/plan evidence**. Canonical source/test/doc paths were clean before and after this task. Only this artifact directory and task diary were written. Canonical registers, unrelated work, credentials/private data, NST/backfills, cron/index state, commits and deployments were untouched.

## Reproduce offline

From the canonical repository, with its existing dependencies and Node 22.11.0:

```sh
python3 tasks/artifacts/fpi-11-4-job79-2026-10-22/prepare.py /tmp/fhfh-job79-review
python3 tasks/artifacts/fpi-11-4-job79-2026-10-22/verify.py /tmp/fhfh-job79-review
python3 tasks/artifacts/fpi-11-4-job79-2026-10-22/verify-static.py
python3 tasks/artifacts/fpi-11-4-job79-2026-10-22/progress-read-fixture.py
```

`prepare.py` refuses to overwrite a fixture directory. It refreshes package manifests/logs in this artifact directory; preserve original receipts first when reproducing independently. No `.git` checkout, worktree, dependency install, network or application endpoint is required.
