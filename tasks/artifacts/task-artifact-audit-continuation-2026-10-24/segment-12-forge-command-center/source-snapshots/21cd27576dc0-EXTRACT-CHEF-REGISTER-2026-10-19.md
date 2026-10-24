51: 
52: ## Earmarked for later (polish, not today's critical path)
53: 
54: - S-2 and S-3 of R6, and the B2 writers.
55: - D-6: the native catalog expiry at first puck drop.
56: - A-09: policy beyond the flag.
57: - Patch 06 (v2 gates A-13 to A-18): the decisions it leaves open, an exact `--approval-ref`, and re-running means assemble.
58: - The HTML-fallback migration (order 86), if it slips. Its apply preflight must compare the hosted RPC body with `20261011115124`.
59: - RSO ranking observations.
60: - A-21: ESPN odds return 403, so a source decision is needed.
61: - `featureBuilder` 82-game items.
62: - A-07 sweep: the summary refresh still has to finish for today's normalised games.
63: - FORGE v1 means-only hold (option a): apply the 7-patch set after 2026-10-20 17:00Z, then schedule a dated re-run.
64: - Layers 2 and 3 of game-type isolation (queues partitioned per type, and type-filtered gates).
65: - History hygiene: C2 npm cache. The local backup branch `chef/backup-octoberBranch-20261019` should be removed once that's confirmed.
66: 
67: ## Results log
68: 
69: - 05:15Z: resume verification above. Report files hashed for change detection: LEDGER `241206f2…`, production-plans `290a78ee…`.
70: - ~05:25Z: **Vercel inventory** (CLI 64.5.0, read-only). All 4 projects (`fhfhockey` root web, `fhfhockey.com`, `cms-fhfhockey` root cms, `functions-fhfhockey` root functions) have `previewDeploymentsDisabled: true` and production branch `master`. The latest deployments are the 10-16 release of `457435eb`: `dpl_6ccUfnYgqnueRsNEbSESqZmSbzPu` READY (web) plus 3 CANCELED. There have been none since. For a push to `master`, expect 1 web build and 3 canceled entries. The Vercel MCP connector returns 403, so use the CLI.
71: - ~05:25Z: **Workers dispatched** (in-process agents; model `opus` with effort `medium` requested at spawn; the runtime returns no effort readback):
72:   - W1: v2 patch 03 re-review. Writes `forge-v2-integration-2026-10-18/REVIEW-PATCH03-2026-10-19.md`.
73:   - W2: R2 byte manifest. Writes `tasks/artifacts/release-r2-2026-10-19/`.
74:   - W3: Q-08 production reads. Writes `super-goal-audit-2026-10-17/PROD-READS-2026-10-19.md`. Hard stop 13:00Z; ≤20 SQL, ≤8 Vercel GETs, 1 log query.
75: - ~05:35Z: **W1 done: patch 03 accepted** (`forge-v2-integration-2026-10-18/REVIEW-PATCH03-2026-10-19.md`).
76:   - B1 and B2 are fixed. All 4 patches apply in order to `317f8f57e`, `base-blobs.txt` has no drift, and the 21 focused files pass (981 tests).
77:   - Chef spot-check: patch 03's sha256 starts `806ef0ec`, matching the diary, and its error codes are present.
78:   - Open:
79:     - TJ confirms the 6 pinned definition hashes against the 10-16 approval record. The reviewer could not read FHFH-private.
80:     - The offline replay was not re-run.
81:     - N1–N4 remain non-blocking.
82:     - README shows the stale 03 and receipt hashes.
83:   - At apply time, after 2026-10-20 17:00Z: re-check base blobs, then run the Vitest list and a full tsc under the lock.
84: - ~05:30Z: **W2 done: R2 manifest** (`tasks/artifacts/release-r2-2026-10-19/`): 58 `web/` paths at HEAD bytes in units P1-a, P1-b, SEC-1 and SEC-2 C05–C09, all slicing cleanly. Chef re-checked all 58 blobs against git (0 mismatches) and reviewed the P-G, P-H, rebuild-score and apiErrorResponse diffs.
85:   - P1-a also needs `rebuild-score.ts` and its test, because the signature changed.
86:   - C15 goalie-power is left for R3: it is outside the approved C05–C09 scope, and its redaction can't be split from the paging change.
87:   - Migrations: R2 ships none. 84 is safe before or after the deploy. 85 needs a read-only parity check of the hosted routine bodies before its `create or replace`.
88: - ~05:35Z: **R2 candidate `fa950fd297678ebd25c5f13e4802338478a451a3`** (tree `ea2de335`, parent `457435eb`; 58 files, +1900/−301). Built with a temp index plus `commit-tree`; no ref, index or branch moved. Exported to the Chef scratchpad `r2/candidate`, with `node_modules` symlinked.
89:   - Focused Vitest: 24 files, 367 passed, 0 failed.
90:   - ESLint on the 58 files: 0 errors (3 existing `<img>` warnings in `rankings.tsx`).
91: - ~05:40Z: **R2 gate passed.**
92:   - Full tsc (12 GB, under the lock): exit 0, 0 errors.
93:   - Full Vitest (`--maxWorkers=4`, under the lock): 8,181 tests, 8,150 passed, 20 failed, 11 skipped.
94:     - 16 of the 20 failures are among the 17 baseline identities in `checkpoint-production-release-2026-10-16/final-unit-and-baseline-reconciliation.json`. One RSO baseline test now passes.
95:     - The other 4 fail only on `git rev-parse HEAD`, because the export has no `.git`. Re-run with read-only `GIT_DIR` they pass 4/4.
96:     - Result: the candidate's failures are a subset of the baseline, so the gate passes.
97:   - Local `next build` not run. The only page change is the `rankings.tsx` fetcher, which tsc and lint cover. A failed Vercel build would leave `dpl_6ccU…` serving.
98: - ~05:30Z: **W3 done: Q-08 production reads** (`super-goal-audit-2026-10-17/PROD-READS-2026-10-19.md`). 36 confirmed, 9 contradicted, 19 inconclusive, 22 skipped. All 4 P1s are confirmed live.
99:   - New finds: CTPI stale since 06-15; ESPN odds ingest failed 42 times in 14 days; no FORGE run has succeeded since 09-29; `dpl_e5bYjw8` (10-13) is in ERROR.
100:   - Budget: 20 SQL calls, 1 log call, 8 Vercel GETs; no credentials read.
101:   - Chef has not yet reconciled the results into the ledger.
102: - ~05:29–05:35Z: **Migrations 84 and 85 applied** (TJ: "Migrations: apply", then "both are approved").
103:   - 84 → ledger `20261019052934`. Preflight and post-check: browser roles now SELECT only, write policies dropped, service_role unchanged.
104:   - 85 → ledger `20261019053348`. Preflight parity: all 3 private routine bodies (md5 and length), arguments and defaults, grants, trigger, indexes, FKs and schema usage were identical to hosted. The post-check is unchanged, so the apply was a semantic no-op.
105:   - Session timeouts did not leak.
