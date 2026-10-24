# Draft Ranker homepage — release omission

The requested hide exists on `octoberBranch`, but is absent from the cached release ref `origin/master`. The release manifest explicitly excluded the homepage and its regression test. This demonstrates a release inclusion gap; a fresh production deployment/alias SHA is still needed to attribute the currently served page definitively.

## Exact source and history evidence

- `web/pages/index.tsx:196` currently renders the switcher only when `draftRankerHomepageEnabled && isOffseason`. Its fallback at line 248 renders Transaction Trends with ownership during the season.
- Canonical-history commit `cc3be5c09f062ea855adc0676293c134156f6b14` (2026-10-19, “Record 10-19 session work after a fixture-test mishap”) adds the condition and the in-season test at `web/__tests__/index.test.tsx:153`. The older preserved recovery-history commit `eeb4af4a4` also contains these bytes; it is not needed for release.
- The two-path diff of `cc3be5c09^..cc3be5c09` is exactly one condition change and one 16-line regression test. Do not cherry-pick the entire mixed-scope commit.
- `tasks/artifacts/release-r5-2026-10-19/MANIFEST.md:185` (F3) explicitly says `web/pages/index.tsx` and `web/__tests__/index.test.tsx` were left out because they were outside A-02/A-06. `tasks/codex-sprint-2026-10-19/inventory/UNRELEASED-PATH-LEDGER.md:54,440` also records both as unreleased.
- The latest homepage commit in cached `origin/master` is still `3f6dd9593` (2026-10-10). That commit pauses the separate Draft Dashboard promotion; it does not add the Draft Ranker offseason condition.

| Locally available ref | Exact SHA | Homepage gate |
| --- | --- | --- |
| `master` | `457435eb3010c5b3dd92d2e1a46d9c75d851780a` | Feature flags only |
| `origin/master` | `6d5664f761132ab479a7febec60548d0fa9ee6ff` (R23) | Feature flags only |
| `origin/octoberBranch` | `81575246c6c3b554d1669000f7e3c0e6e3fcd357` | Feature flags AND offseason |
| `octoberBranch` / starting HEAD | `16bada8670d3d1f536cdae928f69b5294bc12e81` | Feature flags AND offseason |

No fetch was performed. `origin/*` means local remote-tracking evidence, not a live deployment or fresh remote lookup. The homepage Git blob on both master refs is `7f56c4470c34e071866116eae963ae014bedcf8b`; on both october refs it is `e7e495d0e213a691c57a8e0322b53324e4485278`. Test blobs respectively are `b6f3dad71b206a78cb4cef84b5b9563afcc60d32` and `49217e212b9b3ef2781c3d9421a5a420668ce01f`.

## Homepage entry points and seasonal behavior

1. `web/pages/index.tsx:195-254`: one responsive homepage switcher. Its first/default tab is **Draft Ranker**, containing `HomepageDraftRanker`; the other tab is Transaction Trends. There is no separate mobile variant of this module.
2. `web/components/HomePage/HomepageDraftRanker.tsx:253-289`: the module displays **Personal Draft Ranker** for both signed-in and signed-out users. Authentication chooses its contents; it does not hide the title. Its signed-in states link to `/draft-rankings` at lines 105, 172, and 192. Signed-out actions link to sign-in/sign-up. The homepage parent gate removes the entire module and all these entry points during the season.
3. `web/components/Layout/NavbarItems/NavbarItemsData.ts:88-94,199`: desktop Tools and mobile Tools navigation retain **Draft Dashboard** (`/draft-dashboard`). This is a separate tool, not Draft Ranker. Header, mobile navigation, footer, and account UserMenu contain no additional Draft Ranker link.
4. `web/pages/index.tsx:58,181`: the separate Draft Dashboard homepage promo is already disabled by `SHOW_DRAFT_DASHBOARD_PROMO = false` in both release and october source.
5. `/draft-rankings` remains a direct/bookmarked route in `web/pages/draft-rankings/index.tsx`; the request is to hide the homepage promotion, not disable private saved rankings or backend APIs.

The homepage derives `draftRankerHomepageEnabled` from the server-only `DRAFT_RANKER_ENABLED` AND `DRAFT_RANKER_HOMEPAGE_ENABLED` flags (`web/pages/index.tsx:696`, `web/lib/draft-ranker/api.ts:95-116`). No flag values or credentials were read.

`getServerSideProps` calls `checkIsOffseason` (`web/pages/index.tsx:502`). `web/hooks/useOffseason.ts:57-74` compares the current time against the fetched season's `startDate` and `endDate`, returning false on lookup errors. There is no hardcoded October cutoff or ranker-specific calendar. `web/utils/fetchCurrentSeason.ts` uses the internal season contract with NHL fallback; `web/lib/NHL/server/index.ts:232-314` resolves started seasons from the seasons table, with NHL fallback. No current season rows or endpoints were queried. Nothing in the inspected local evidence demonstrates a wrong season value; the released gate ignores this value entirely.

## Why the public text fetch was inconclusive

The parent reports that its 15:37 UTC fetch of `https://fhfhockey.com/` contained the October 22 slate and Draft Dashboard navigation, but no Draft Ranker text. That is compatible with the bug: `web/components/ClientOnly/ClientOnly.tsx:16-23` renders nothing until its mount effect runs. The whole switcher is inside `ClientOnly`, even in old release source. Server-readable text therefore cannot prove the hydrated module is hidden. It also cannot establish cache causality.

Homepage response policy is `s-maxage=60, stale-while-revalidate=120` (`web/pages/index.tsx:321-325`); this is configuration evidence only. No cache diagnosis or production browser verification is claimed.

## Deliverable and verification

- `hide-ranker.patch`: minimal existing gate/test change, extracted from `cc3be5c09`; excludes the unrelated `moment-timezone` import difference between master and octoberBranch. No application source/test was changed in this investigation.
- `git apply --check --reverse tasks/artifacts/draft-ranker-homepage-investigation-2026-10-22/hide-ranker.patch`: **passed**, confirming the isolated patch is already present locally.
- Installed Node **22.11.0**, npm **10.9.0**.
- From `web/`: `NODE_OPTIONS='--require=/Users/tim/Code/fhfhockey.com/tasks/artifacts/draft-ranker-homepage-investigation-2026-10-22/offline-network-guard.cjs' npm test -- --run __tests__/index.test.tsx components/HomePage/HomepageDraftRanker.test.tsx`: **passed**, 2 files / 9 tests. Output: `verification.log`. Network guard rejects fetch and Node HTTP/HTTPS/net/TLS client calls.
- Homepage tests cover enabled + in-season hiding (no tablist/title/module, ownership trends present), enabled + offseason tab switching, and disabled feature fallback. Component tests cover its account-dependent content. Homepage tests mock `ClientOnly` to expose the post-mount children; they do not constitute real browser hydration proof.
- Scoped working-tree diff and `git diff --check` for homepage/test: **passed / unchanged**. Concurrent application/P07 work preserved.
- Build, lint/typecheck, browser, production API/cron/DB, and deployment checks: **not run**. No application modification justified additional checks. No commits, ref updates, pushes, deployments, credential reads, dependency installation, or external requests were performed by this worker.

## Remaining evidence and parent action

Confirm the deployment currently aliased to `fhfhockey.com`, its ready status, project/environment, and exact source SHA. If it serves R23 (`6d5664f76`) or the same homepage blob, the release omission conclusively explains the user's visible ranker. If it serves newer corrected source, capture only the sanitized homepage `isOffseason` / `draftRankerHomepageEnabled` props and rendered post-mount module state before diagnosing season data or client state. No new production API calls are needed for this worker's conclusion.

Add the isolated gate/test to the next explicitly authorized release candidate. The existing local fix alone cannot change production. Deployment is pending parent release authorization/workflow, not attempted, denied, or of uncertain outcome. No local implementation blocker remains.

## Follow-up: existing local R23 records and patch applicability

Checked existing task/artifact/diary Markdown, JSON, text and log records for `6d5664f76` / R23. No dedicated R23 provider deployment receipt was found in those locations. A `scratchpad` release workspace mentioned in older notes is absent from the canonical checkout. No live service call or external history lookup was made.

| Evidence | What it establishes | What it does not establish |
| --- | --- | --- |
| Git commit `6d5664f761132ab479a7febec60548d0fa9ee6ff` | R23 candidate source; committed **2026-10-22 14:46:49 UTC** | Build completion time, deployment ID, domain alias |
| `tasks/TASKS/forge-projections/tasks-forge-projection-audit-streamlining-2026-10-21.md:82` | Existing task record says the live runner claim bug was fixed in R23 `6d5664f76`; subsequent recompute completed **15:11:51 UTC**, with verification recorded at 15:15 UTC | Raw deployment receipt or current domain-to-SHA binding; recompute time is not deployment time |
| `tasks/diaries/2026-10-21-claude-forge-streamlining.md:35`, recorded by `16bada8670d3d1f536cdae928f69b5294bc12e81` at **15:23:21 UTC** | Historical working note says “R23 `6d5664f76` live” and octoberBranch synced | Independent acceptance/provider proof; diary is a resume aid, not acceptance evidence |

The known request target is `fhfhockey.com`; no inspected R23 record binds that domain to a deployment ID/SHA or records an exact deployment timestamp. Local records support the historical R23-live account, while current alias verification remains missing. The R21/R22 deployment IDs elsewhere in the diary are not R23 evidence. The model-release inventory also uses “R23” for an unrelated proposed F5 tranche; that numbering is not a completed deployment receipt.

**Offline patch check passed against both exact refs:** `master` at `457435eb3010c5b3dd92d2e1a46d9c75d851780a` and `origin/master` at `6d5664f761132ab479a7febec60548d0fa9ee6ff`. For each, only the two affected files were exported into temporary `/tmp/draft-ranker-patch-check.*` fixtures, preserving Git file modes. `git apply --check --verbose` and actual application inside each disposable fixture both exited 0, with a one-line hunk offset and no rejects. The fixture retained the release's `moment-timezone` import, acquired the seasonal condition, and produced a test file byte-identical to the canonical regression test. Temporary fixtures were deleted automatically. Canonical app files and Git state remained untouched. Details and hashes: `patch-applicability.log`.

| Handoff row | Status | Exact scope and next owner action | Acceptance still required |
| --- | --- | --- | --- |
| Draft Ranker seasonal homepage hide — **RELEASE NEEDED** | Locally implemented and offline verified; absent from cached master/R23 | Parent ledger owner records the item; release owner includes only `hide-ranker.patch` (`web/pages/index.tsx`, `web/__tests__/index.test.tsx`) in an explicitly authorized candidate | Record exact production project/environment/candidate SHA and successful deployment/domain receipt, then bounded approved post-mount verification that in-season ranker is absent and ownership trends remain. No release action attempted by this worker. |
