# FORGE serving release plan (proposal only)

Nothing here has been run against production, Vercel, GitHub or the hosted database. Every step below is a **separate** approval.
- None of them may run on 2026-10-20 between 07:00 and 13:00 ET (the scheduled FORGE window).
- None may run while another session holds the files involved.

## 0. Preconditions before a candidate can be built

| # | Item | Owner | Status at 2026-10-17T21:54Z |
|---|---|---|---|
| P1 | Fix **B1**: stop the shared provenance builder stamping the external-fantasy marker (`REVIEW.md`) | FORGE | Open |
| P2 | Decide **B2**: ship the 2 witness-writer files, and approve a schedule-refresh run that covers the served window | RSO/schedule owner; TJ for the schedule | Open |
| P3 | Fix **B3**: a test set that runs on master | FORGE + RSO | Open |
| P4 | Commit the 7 uncommitted slice files and their tests, so the bytes are frozen and in a commit (see §5) | RSO matrix and consumer-test sessions | Open |
| P5 | The 2026-10-20 run outcome: `forge-continuation-2026-10-17/LEDGER.md` §13. Needs a published head ID, revision and receipt, plus the local readback result: sizes, `incomplete_refresh`, `forecast_view_too_large` | FORGE | Pending (Monday) |
| P6 | Recommended before activation: N1 (Start Chart bound and hash strip), N2 (FORGE view catalog cap), N3 (FORGE cache header) | Start Chart / FORGE | Open |

After P1–P4 change bytes, regenerate `SLICE.md` and `slice.json` pins for the changed paths. Every other pin stays valid only if its blob is unchanged.

## 1. Exact path set

Build the candidate the way the 2026-10-16 release was built: start from production `457435eb`, overlay exact blobs, make a detached candidate commit. **Do not merge octoberBranch into master.**

1. **Runtime: the 70 paths in `SLICE.md`**, at their pinned blobs. Re-pin `calibrationEligibility.ts` after the P1 fix.
2. **B2 additions (if P2 = ship):**
   - `web/lib/rosterScheduleData/source.ts` (`9f7bab6dc5`)
   - `web/pages/api/v1/db/update-roster-optimizer-schedule.ts` (`3968b43d00`)
   - the current `__tests__/pages/api/v1/db/update-roster-optimizer-schedule.test.ts`
3. **Tests:**
   - the 43 current test files listed in `SLICE.md`, **minus** `lib/projections/nativeInputEligibility.test.ts` (it belongs with the projection stages)
   - plus the B3-repaired versions of `lib/rosterScheduleData/planning.test.ts`, `lib/player-forecasts/gameExpectations.test.ts`, the catalog-head boundary test, `lib/projections/apiHelpers.test.ts` and `lib/projections/runProjectionV2.test.ts`
4. **Optional:** `web/pages/forge/forecasts.tsx`, `web/styles/ForgeForecasts.module.scss` and `__tests__/pages/forge/forecasts.test.tsx`. Include them only if a FORGE UI should ship.
5. **Not included:**
   - `tasks/`
   - the catalog-head migration file: already applied in hosted; recording it on master is the separate U3 decision
   - `provider.ts`/`rosterPlanning.ts`: optional RSO companion; separate review
   - every path listed under "out of slice" in `SLICE.md`

## 2. The single verification pass (run once, after P1–P4, with scope frozen)

Run it in an exported candidate directory, never in the canonical `web/`: `cleanDistDir` wipes `web/.next`, which TJ's dev server uses. Do not use `.next-player-forecasts` or port 3105. Do not run it while another heavy `tsc` or build is running.

1. **Export without touching refs or the index:**
   ```bash
   mkdir -p /private/tmp/fhf-forge-serving/candidate && git -C /Users/tim/Code/fhfhockey.com archive 457435eb | tar -x -C /private/tmp/fhf-forge-serving/candidate
   ```
   - Write each path with `git cat-file blob <pinned blob>`, then re-hash it against `slice.json` (sha256).
   - Symlink `web/node_modules` from the canonical checkout.
   - Use no `.env*` files.
2. **Static checks**, from `candidate/web`:
   ```bash
   NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental false
   ```
   ```bash
   npx eslint <the runtime paths>
   ```
   Expected: tsc exit 0 (this review's scoped run was clean); eslint 0 errors (6 known hook-dependency warnings).
3. **Focused Vitest, one run.** The set is every test in the candidate that reaches a slice file: 114 files on the 70-file candidate. Regenerate the list with the reverse-import walk used here (`fullgraph.js` method, `SLICE.md` §derivation).
   ```bash
   npx vitest run --maxWorkers=4 <focused list>
   ```
4. **One isolated local production build**, in the candidate directory only, with the offline guard from `checkpoint-production-release-2026-10-16/` (`run-offline-build.py`, `offline-build-guard.cjs`) and `PLAYWRIGHT_ISOLATED_NEXT=1`.
   - It is justified because two pages change: `/start-chart` and the `/roster-schedule-optimizer` tree.
   - It covers the worker bundle (`new URL("./candidateMetrics.worker.ts", import.meta.url)`) and prerender/SSR, which tests cannot.
   - Never run it on 2026-10-20 07:00–13:00 ET.

**Expected baseline failures in step 3.** These appear on a clean production export too, under the same export method:
- `scripts/qualify-native-players-offline.test.ts`: 9 (the 8 identities from the 10-16 receipt plus "writes a new reproducible receipt without changing or overwriting original inputs")
- `lib/projections/nativeGoalLedgerAudit.test.ts`: 1
- `lib/projections/nativeIntervalReconciliation.test.ts`: 1
- `lib/projections/researchGoalBaseline.test.ts`: 1

**Pass:** the candidate's failures are a subset of those 12 identities. **Any other failure stops the release.** Today these are the 37 new identities (33 + 1 + 1 + 2) that P1/P3 must remove.

## 3. Activation: three separate approvals

### A1. Release the candidate to production `master`

1. **Before:**
   - Inventory all four Vercel projects (root, branch trigger, ignored-build behaviour) and confirm previews are still disabled, together with TJ (standing rule).
   - Confirm 0 existing deployments for the candidate SHA.
2. **Push:** one ordinary fast-forward of `master` to the candidate commit, with TJ present.
3. **Expected entries:**

   | Project | Expected |
   |---|---|
   | `fhfhockey` (root `web`) | 1 production web build |
   | `fhfhockey.com` | 1 CANCELED (`ignoreCommand: exit 0`) |
   | `cms-fhfhockey` | 1 ignored/CANCELED |
   | `functions-fhfhockey` | 1 ignored/CANCELED |

4. **Behaviour with the head ID unset:**
   - `/start-chart` switches to `forecast_source=game_expectations` and shows no projections.
   - The RSO page ships its new UI plus the transport decode.
   - Legacy FORGE revisions are rejected everywhere (after P1).
   - With no head and no valid legacy pins, the FORGE API returns empty catalogs.
5. **Smoke:** ≤3 sequential read-only GETs, concurrency 1. Stop at the first failure.
   1. `/roster-schedule-optimizer`: HTML 200
   2. `/api/v1/roster-schedule-optimizer/data?seasonId=20262027&startDate=<today>&endDate=<today+6>&timeZone=America/New_York`: 200, and `data.version === "planning-data-transport-v1"` (proves the page/route contract)
   3. `/start-chart`: HTML 200
6. **Rollback:** Vercel **Instant Rollback** to `dpl_6ccUfnYgqnueRsNEbSESqZmSbzPu` (`457435eb`, READY). This needs no build.
   - `master` stays ahead, so the next push redeploys it.
   - Reverting `master` itself is a separate approval.
7. **Then:** sync octoberBranch from the released commit, as its own approved push.

### A2. Set `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID` in Vercel Production

**Preconditions:**
- A1 is live.
- P5 passed (Monday local readback clean).
- A current publication exists. Each daily selection expires at the earlier of issuance + 12 h and the first bound game − 1 ms (about 22:59:59.999Z). Without a scheduled daily publish, every production surface fails closed every evening until the next manual publish. So decide the scheduler binding (FORGE LEDGER §6 step 7) first, or accept that window explicitly.
- The B2 schedule refresh has run within 36 h.
- Read, in a read-only way, which `PLAYER_FORECAST_*` pins production already has:
  - a valid head replaces them all
  - an invalid head clears them all
  - an unset head leaves them in effect

**Change:** set the head UUID for project `fhfhockey`, Production only. Vercel applies env changes only to new deployments, so this needs **1 redeploy (1 production web build)** of the A1 deployment, at the same SHA.
- Inspect the existing deployment status first.
- Do not trigger duplicate builds.

**Rollback (no build):** Instant Rollback to the A1 deployment. Its environment snapshot lacks the variable.
- Alternative: remove the variable and redeploy (1 build).
- Emergency without Vercel: stop publishing; the selection expires and every consumer withholds values.

### A3. Production readback: ≤5 sequential read-only requests

Run concurrency 1, after a same-day publish and before the selection expires. Stop at the first non-200 or failed check. Make no retries and no cron or refresh calls.

| # | Request | Checks |
|---|---|---|
| 1 | `GET /api/v1/forge/forecasts?seasonId=20262027&startDate=<today>&endDate=<today+59>&mode=next_n&games=20&timeZone=UTC` | `baselineChecksum` and participation revisions match the publication receipt; no `expiresAt` ≤ read time; body < 4,000,000 B (record it); no `forecast_view_too_large` (N2); totals non-null where the horizon is complete (B2) |
| 2 | `GET /api/v1/start-chart?date=<today>&forecast_source=game_expectations` | Same IDs and hashes; `gameExpectations.expiresAt` ≤ first puck drop; basis `expected`; body size recorded (N1) |
| 3 | `GET /api/v1/roster-schedule-optimizer/data?seasonId=20262027&startDate=<today>&endDate=<today+8>&timeZone=America/New_York` | Transport v1; `participationRevisionIds` and `baselineChecksum` match; no `incomplete_refresh` (B2) |
| 4 | `GET /start-chart` (HTML only, not a browser load) | 200 |
| 5 | Reserve: `GET /roster-schedule-optimizer` (HTML only) | 200. Spend this only if 1–4 passed |

**On every JSON body:** grep for `/Users/`, `FHFH-private`, `Documents/` and `research` (payload-authored `limitations`); expect 0 hits.

**Rollback:** reads need none. If any check fails, apply the A2 rollback.

## 4. Must land together

| Group | Paths | Why |
|---|---|---|
| RSO contract | `data.ts` + the 30-file RSO page tree + `eligibility.ts` + `workspace.ts` route | The transport payload is unreadable by the production page. The new page calls the new eligibility route and the preservation mode |
| Provenance gates | `consumerRevisionAdmission.ts`, `start-chart.ts`, `calibrationEligibility.ts` (**with the P1 fix**) | The new readers trust a marker the production pipeline would forge |
| Schedule coverage | `planningInputs.ts`/`canonicalSchedule.ts` + `source.ts` + `update-roster-optimizer-schedule.ts` + an approved schedule run | The readers require witnesses only the new writer produces |
| Schedule fingerprint | `issuedContext.ts` + `planningInputs.ts` | Both carry the same ISO normalization; both are in the slice |

## 5. Dependency and conflict notes (canonical checkout, 2026-10-17 ~21:55Z)

**Inside the slice, uncommitted.** Freeze and commit before the candidate:
- RSO candidate-comparison work (RSO acceptance-matrix session): `CandidateBrowser.tsx`, `CandidateCard.tsx`, `hooks/useCandidateMetrics.ts`, `hooks/candidateMetrics.worker.ts`, `lib/rosterScheduleOptimizer/candidatePlanMetrics.ts`. Tests: `CandidateBrowser.integration.test.tsx`, `CandidateCard.test.tsx`, `useCandidateMetrics.test.tsx`, `candidatePlanMetrics.test.ts`.
- Consumer-test fixes and workspace snapshot alignment: `lib/in-season/workspaceSchema.ts`, `lib/player-forecasts/currentSeasonSogContribution.ts`. Tests: `workspaceSchema.test.ts`, `planning.test.ts` (RSO), `planningReproducibility.test.ts`, `__tests__/pages/api/v1/start-chart.test.ts`, `__tests__/fixtures/consumerGameRevision.ts`.

**Outside the slice, being edited by other sessions.** None blocks the slice; ordering notes follow.
- **Security** (`corsProxy.ts` + test, `adminOnlyMiddleware.ts` + test, `cors.test.ts`): independent. `adminOnlyMiddleware.ts` is in the import closure (Start Chart → `lib/NHL/server` → update-player route), and the slice typechecks and tests with its production bytes. Either can land first.
- **Shift-charts / projections** (`relationshipPlayerPosition.ts` + test, `runProjectionV2.test.ts`, `shift-charts.ts`): `runProjectionV2.test.ts` is also a B3 target. Sequence the edits: one owner at a time.
- **Audit Patch 01** (`pages/_app.tsx`): it changed during this review (`f71c934e` → `780e2df1`). It is in every page bundle, but has no coupling to the slice. Independent.
- **Ops** (`cron-report.test.ts`, `combinedCronInventory.test.ts`, sustainability rebuilds, `withCronJobAudit.ts` R1): independent. R1 can ship before or after.
- **IFTTT** (`iftttIntakePolicy.ts`, `lineSourceIftttReceiver.ts` + test): out of slice. The production `update-line-sources`/`update-lines-ccc` crons import slice `sourceSnapshot.ts`/`contributions.ts`/`issuedContext.ts`; their production tests pass in the candidate.
- **FORGE v2** (fresh means, rolling participation, Yahoo universe; new untracked files `nativeDailyMeansCapture.ts`, `rollingParticipationFrame.ts`, `rollingWindowParticipation.ts`, `yahooUniverse*.ts`, `scripts/forge-daily-universe.ts`): not imported by the slice today.
  - A new participation dataset or method must change `nativeCatalogHead.ts` (pin keys and datasets), both participation stores, the `contributions.ts` model versions, `workspaceSchema.ts`, `planningDataTransport.ts` and `startChartContract.ts`. That means a new review of those hubs.
  - Universe growth hits N1, N2 and the goalie store's 500-entry cap.
- **Hosted database:** the catalog-head table and RPC exist in hosted (ledger `20261017183611`), and the slice needs nothing else from the database. Recording the migration on master is U3 (ledger `NEXT-RELEASE-PLAN.md` §3).
