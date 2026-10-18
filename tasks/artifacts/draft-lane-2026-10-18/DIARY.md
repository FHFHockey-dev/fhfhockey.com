# S-13 Draft Dashboard and personal ranker: lane diary (2026-10-18)

Handoff: `fhfh/06-draft-dashboard-personal-ranker.md`. Checkout `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, HEAD `0de97e77d`. Everything here is local and uncommitted. There were no pushes, deploys, hosted DB calls, provider calls or Yahoo/Fantrax/ESPN account access, and no dev server was started.

Source note: the handoff names `docs/draft-ranker/product-strategy.md`, but no `docs/draft-ranker/` directory exists. The authoritative strategy and plan are at `tasks/TASKS/draft-ranker/` (`product-strategy.md`, `implementation-plan.md`, `decision-record.md`, `progress.md`, `tasks-prd-draft-ranker.md`).

## Status table

| Lane | Existing implementation | Accepted evidence | Source inclusion | Deployed status | Next active slice | Blockers |
|---|---|---|---|---|---|---|
| Personal NHL ranker | **Implemented.** DR-001 to DR-073 and DR-084/085 are closed. Phase 8 (DR-080 to DR-083) is retired to the roadmap. The account-backed top 250 is seeded from verified Yahoo preseason ADP over the canonical FHFH identity registry, with continuous order, assisted placement, homepage pairwise refinement and owner-scoped RLS. | `tasks/TASKS/draft-ranker/progress.md` (goal complete 2026-07-17; PRs #335/#338/#342/#343/#350). Audit G1 (2026-10-17) VERIFIED the RLS, owner scoping and route gating. In this run, 130 draft-lane Vitest files passed. | Per audit G1, `git diff 457435eb HEAD` is empty for every Draft Ranker path, so HEAD = production. | Per progress.md, production runs `DRAFT_RANKER_ROLLOUT_STAGE=authenticated`, with discovery, contributions, public Community Ranking and beta off. Not re-verified live today (no hosted calls allowed). | Only the audit P3 fix: refresh routes now return 400, not 500, for bad `asOf`/`operationId` (done locally, see below). | No product decision is open. Turning on any secondary flag or reviving Phase 8 needs a new PRD and TJ's approval. Stale evidence: DR-010/011/012 reviews and the release manifest cite pre-baseline migration paths (audit G1). |
| Draft Dashboard / Draft Pro | **Largely implemented locally:** recovery/resume/restart/import, multi-CSV, keepers/trades, God View (`GodView.tsx`), DUST, and Yahoo/Fantrax/ESPN live-draft hooks and panels. | `tasks/TASKS/draft-dashboard-yahoo/tasks-prd-draft-dashboard.md` (92 rows), `prd/prd-draft-dash-debug.md`. Audit G8: the outcomes hold, but the counts are stale. Today, 130 files and 790 tests passed (list below). | Per audit G8, prod = HEAD for `components/DraftDashboard`, `lib/draftDashboard` and `useProcessedProjectionsData.tsx`. | Yahoo live draft is **NO-GO for broad rollout** (`live-draft-production-readiness.md`). `YAHOO_LIVE_DRAFT_PROVIDER_VALIDATED=false`, and the maintenance modal stays in place. | The recovery/import parent acceptance checklist below. Its unit layer is covered. The browser and provider layers are pending. | A genuine provider rehearsal (Yahoo/Fantrax/ESPN) needs TJ's scoped approval and a disposable league. ESPN access/rights are unverified. The durable worker substrate (P0.5) is missing. The refund follow-up is out of scope (no billing actions). |

## Changes made (all uncommitted, lane-owned files only)

1. **Audit G1: draft-ranker refresh routes answered 500 on bad input.** In `web/pages/api/v1/db/refresh-draft-ranker-community.ts` and `refresh-draft-ranker-discovery.ts`, `parseAsOf`/`parseOperationId` now throw a local `RefreshInputError`. The catch block answers `400 {success:false, error:<fixed message>, failedRows:1}` before the redacted 500 path, which matches the health route's 400 shape. Dependency failures still return the redacted 500. The regression is 4 new cases in `web/__tests__/pages/api/v1/db/draft-ranker-health.test.ts`.
2. **Audit G8: projected SHA had no hook test.** I added 3 tests to `web/hooks/useProcessedProjectionsData.test.tsx`:
   - a direct `SH_ASSISTS` mapping keeps the provider value 0, not SHP−SHG = 2;
   - with no SHA mapping, the value is derived as 2;
   - every official skater source in `PROJECTION_SOURCES_CONFIG` maps `SH_ASSISTS`.
3. **Audit G8: "session-local" CSV claims.** I amended `tasks/TASKS/draft-dashboard-yahoo/tasks-prd-draft-dashboard.md` (Note plus row 2.0) and added two caveats to `prd/prd-draft-dash-debug.md`:
   - Bookmarking: bookmarks still exclude CSV rows.
   - SHA: the projected path was superseded by provider mapping since `83e3a0bde`.

   The caveats say that an explicit Draft Pro saved draft stores CSV rows, headers and mapping server-side as owner-scoped normalized private imports (`lib/draft-pro/savedDrafts.ts`). No code changed for this item.
4. **"Require full mapping" had no regression test.** I added one to `web/__tests__/components/DraftDashboard/ImportCsvModal.test.tsx`. With unresolved rows, "Enable anyway" unlocks Confirm. Ticking "Require full mapping" withdraws that override, and Confirm stays disabled even after a second override.

I did not touch `lib/draft-pro/server.ts` (Patreon gating), `adminOnlyMiddleware`, `corsProxy`, provider-table migrations, RSO/FORGE files or frozen FORGE docs.

## Recovery/resume/restart/import/CSV parent acceptance checklist (master §8 item 2)

The unit/component layer is mapped to current tests. The browser layer is pending (no dev server was allowed this sprint).

| Criterion | Current unit/component evidence | Browser/provider acceptance |
|---|---|---|
| Interruption / reload / resume | `DraftDashboardRecovery.test.tsx`: decline under StrictMode, failed resume retains both records and retries, malformed or unreadable snapshot retained until a valid replacement. `DraftRetention.test.tsx`: tab and device drafts. | Pending: real tab reload and close/reopen on desktop and mobile. |
| Restart vs reset | `DraftDashboardRecovery.test.tsx`: "Start New Draft" is a cancellable separate confirmation; "Reset Entire Draft" keeps config and imports. | Pending. |
| Import failure / retry | `DraftDashboardRecovery.test.tsx` (failed import keeps previous draft). `KeeperWorkflow.test.tsx`: abandoned read ignored, failed import stays open, duplicate confirm ignored. | Pending. |
| CSV mapping and validation | `csvImportContract.test.ts`, `csvImportValidation.test.ts` (duplicates by canonical ID, missing identity, multi-position), `ImportCsvModal.test.tsx` (missing headers, parser warnings). | Pending: a real provider CSV per source. |
| Require full mapping; ambiguities surfaced, not auto-picked | New `ImportCsvModal.test.tsx` case for the full-mapping gate. Collision-safe Yahoo ties stay unresolved (`yahooMapping.test.ts`). | **Gap:** no test drives the ambiguous-candidate chooser (`ImportCsvModal.tsx` ~L1013-1063 auto-resolves only a single perfect score). Add a test before claiming that criterion. |
| Separate skater / goalie imports | `customProjectionSources.test.ts` (player-type-specific sources, explicit import type with mixed rows), `csvImportValidation.test.ts` (mixed by role). | Pending. |
| Session scope / privacy | `csvImportSession.test.ts` (tab-scoped, no cross-tab leak), `summaryConfiguration.test.ts` (no CSV contents), `savedDrafts.test.ts` (private rows only in the opt-in Draft Pro import store). | Pending. |
| Keepers / order | `keepers.test.ts`, `KeeperWorkflow.test.tsx` (forfeited pick, no-pick keepers, reversed rounds, bulk input), `pickTrades.test.ts`. | Pending. Provider keeper/traded-pick semantics are unvalidated (readiness P1.6). |
| Dual eligibility | `csvImportValidation.test.ts` ("preserves valid multi-position eligibility"), `DraftDashboardRecovery.test.tsx` (Utility reservation). | Pending. |
| Live sync owns the draft | `DraftDashboardRecovery.test.tsx` (roster moves locked), `KeeperWorkflow.test.tsx` (recovery disabled during live sync). | Genuine Yahoo/Fantrax/ESPN interruption recovery is **unverified** and needs approval. |

## Checks run

- `npm test -- __tests__/pages/api/v1/db/draft-ranker-health.test.ts`: passed, 11/11.
- `npm test -- hooks/useProcessedProjectionsData.test.tsx`: passed, 4/4.
- `npx vitest run __tests__/components/DraftDashboard/ImportCsvModal.test.tsx`: passed, 4/4.
- Under the heavy lock, the draft-lane Vitest group passed: 130 files, 790 tests. It covered `components/DraftDashboard`, `__tests__/components/DraftDashboard`, `lib/draftDashboard`, `lib/draft-pro`, `lib/draft-ranker`, `components/DraftRanker`, `__tests__/components/DraftRanker`, `__tests__/pages/api/v1/draft-ranker`, the health test and the hook test. This run came before check 5's new ImportCsvModal case.
- `npx tsc --noEmit`: the first run hit a JS heap out-of-memory error at the 4 GB default (environmental, not a type error). The rerun with `NODE_OPTIONS=--max-old-space-size=8192` exited 2 with exactly 2 errors, both outside this lane: `TS2305` (missing export `persistCapturedGameNormalization` from `lib/supabase/Upserts/nhlRawGamecenter.mjs`) in `pages/api/v1/db/ingest-projection-inputs.ts:27` and in the untracked `pages/api/v1/db/sweep-gamecenter-normalization.ts:5`. That is another session's in-progress gamecenter work. No lane file has a type error.
- `npx prettier --check` on both route files: passed.
- Not run: lint, full Vitest, build, Playwright, and any browser check (pending, since dev servers are off this sprint).

## Remaining decisions for TJ

1. Whether to authorize a controlled provider rehearsal (a disposable Yahoo and/or Fantrax league) for live-draft sync and interruption recovery. ESPN additionally needs an access/source-rights decision.
2. Whether the Draft Pro server-side CSV storage is the intended product boundary. If so, the amended task-doc wording stands. If not, it is a product/privacy change for the account/entitlement owners, not this lane.
3. Re-baselining the ranker's stale migration-path evidence (DR-010/011/012 reviews, release manifest) against the `20260716112908` baseline is a docs-only follow-up. The Chef can assign it.

## Next command

The browser layer of the checklist above, once a dev-server owner is free:

```bash
cd /Users/tim/Code/fhfhockey.com/web && npm run dev:stable
```

Then open `/draft-dashboard` and walk the checklist rows on desktop at 1920×1080 and on mobile.
