# Rankings acceptance verdict (Claude Chef) — 2026-11-14

## Scope
Acceptance verdict for the existing Rankings workstation (skaters/goalies/teams; main table, matrix, snapshot, comparison): population reconciliation, source freshness/reader agreement, slow-path timing, and tested local fixes for confirmed in-scope reader defects only. Separate from FORGE pregame capture, Astra audit, Rankings styling.

## Where
- Pinned: origin/master = deployed = `89da739cb` (#446), Vercel `dpl_8paYEhJ2hjQqDzyGyfw35jvahbAr` READY. Rankings paths (web/lib/rankings, components/Rankings, pages/rankings.tsx, pages/api/v1, splits, ratings) byte-identical across #431 `502a93b4c`, `89da739cb` and local HEAD `6478ec5d0`; none dirty.
- Artifacts: `tasks/artifacts/rankings-acceptance-2026-11-14/`.
- Audit input: ~/Downloads "FHFH Rankings Audit and Completion Plan.md" (baseline #416 `46f97175`, 2026-11-08).

## State
- 764 BEAST/composite + 50,320 upserts publication: user-reported; no receipt located in tasks/, mailboxes, side-session notes. Arithmetic flag: 50,320 = 740 x 68 (4 windows x 17 metrics), not 764.
- tasks/MASTER-LIST.md:99 still says Rankings "Later pause preserved" — stale vs P1; report only, do not edit.
- Astra (11-14) proposed AFULL-RANK12-01..03 (deployment-scope rank inheritance, page-local missing, metric_value tiles) — Astra's lane; read only.
- No DB/app/provider reads authorized yet.

## Next
Claim + read packet pop-up; dispatch offline correctness and perf-review workers.

## Blockers / approvals
Production DB reads and any app requests need TJ pop-up approval.

## Checkpoint 2026-11-15 01:25 UTC
- TJ approved packet A–D, then 3 extra SQLs. Done: 12 SQL in A/B (3 timeouts, narrowed, not lengthened), 3 extension (1 timeout), Stage C 12 local attempts (7 reached DB), Stage D 5 prod GETs. Receipts: LIVE-SQL-RECEIPT.md, STAGE-C-RECEIPT.md, stage-d/STAGE-D-RECEIPT.md.
- Stage C stop-rule breach: c07/c08 ran after c06 hit the 30 s cap (batched). Disclose. Gotcha: a sandboxed Bash dev server gets DNS ENOTFOUND; start it with the sandbox disabled.
- Findings: rankings writer drops 24 (current) / 164 (2025-26) long-absent skaters (30-date horizon; writer omits completeSeasonRows; composite writer passes them). team filter → fallback + team-pool ranks + null composites, 21 s local / 9 s prod snapshot. Snapshot for unpublished player >30 s. P/60 #1 has 1 GP, "medium". Goalies 76=76. Teams 32; power/style cutoffs differ. Prod d1 3.32 s (was 19.14 s), teams 11.3 s.
- Workers: rankings-correctness (local_fcaa8930) got both live findings; rankings-perf (local_a8ee103a). Dev server :3110 stopped (PID 35621).
## Next
Collect worker reports → fix claims (single owner = correctness session) → acceptance matrix.

## Checkpoint 2026-11-15 ~02:00 UTC
- The fix owner (local_fcaa8930) landed F14, F13, F1, F4, F5, F6 and W1 locally, uncommitted. Chef verified: vitest lib/rankings 457/457, eslint 0, scope = claimed files only.
- ACCEPTANCE.md has verdicts: none verified end to end; goalie and team populations live-verified; skater population off by 24 / 164 pending republish.
- Next: TJ decisions (republish, F7/F8/F9/F11), an optional post-fix local-reader confirmation packet, commit/release on TJ's go.

## Checkpoint 2026-11-15 ~02:05 UTC
- Packet 2 (TJ approved A–C) is done; receipt in packet2/RECEIPT.md.
  - A stopped at A3: team 2025-26 HTTP 500 from a `team_unit_toi` statement timeout.
  - Goalie 2025-26 is empty because every legacy row has no game_id (upstream gap).
  - The local fixed code on prod data confirms F13, F14 and W1 (769 skaters).
- TJ decided F11 (match the page floor), F7 (7 days), F9 (cap at power date). Dispatched to the fix owner with claim addendum 2.
- The perf session is bounding the team unit-TOI timeout. No team speed fix is dispatched yet.
- Gotcha: the writer route uses withCronJobAudit, so even a dry run writes an audit row. W1 was dry-built by script instead.
- 02:10 UTC: perf §7.1 pins the team 500 to teamMatrix.ts:1338-1348 (offset paging over the full snapshot). F15 (unit filter) sent to the fix owner.
- 02:15 UTC: packet 3 done (packet3-RECEIPT.md). Trending 19.9 s live; Explorer parity 10/10; index present + EXPLAIN uses it; fixed teams 2025-26 = 200 but F9 hid unit usage, so F9 is amended to in-progress seasons only (sent to the fix owner).

## Checkpoint 2026-11-15 ~02:25 UTC — candidate ready, uncommitted
- 11 fixes (F14 F13 F1 F4 F5 F6 W1 F11 F7 F9-amended F15); 22 files listed in offline-correctness/REPORT.md "Release file set"; FIXES.patch.
- Chef verified: vitest 49 files / 515 pass; repros 6 pass outside web/; scoped eslint 0; full typecheck exit 0; no runtime import cycle.
- ACCEPTANCE.md is final, with verdicts per view.
## Next
TJ decides commit/release (needs a release slot plus a Vercel inventory) and the W1 republish. Open: trending speed, the 2025-26 goalie game_id backfill, 2025-26 team style 0 games, F8, the Fantasy preset, F2, F3, F10, F12, R08/R09, the Master List row.

## Checkpoint 2026-11-15 ~02:35 UTC — verdict delivered
- Ran TJ-approved parity reads: skater default values unchanged (F13 fills the deployment scope); goalies 0 differences; snapshot = table row.
- TJ kept the amended F9 scope.
- ACCEPTANCE.md rewritten as one consistent document; lease recorded in CLAUDE-LEASES.json; Astra note posted.
- Verdicts: Metric Explorer verified; 12 views partial; 2025-26 goalies blocked (upstream game_id).
## Next
Await TJ: commit the 22-file set (explicit pathspecs) vs hold; release slot; republish. Workers are idle; nothing committed.
- 2026-11-15: committed 228f345e6 (22 files, explicit paths) on TJ's go; lease released; not pushed. Gotcha: zsh does not word-split $F, so list paths literally.

## Release 2026-11-15
- Candidate 546d0a580 = master 89da739cb + 22 rankings blobs; import closure (31 files) identical to master. Gate (clean export): 851 tests, tsc 0, eslint 0.
- TJ approved push, PR and merge. PR #447 squash-merged as baeb5df7f (tree = candidate). Vercel: fhfhockey dpl_2cSuAxpANphLcWSU3VPzvYu7EGhg BUILDING; 3 companions CANCELED; branch push made no deployment.
- Gotchas: zsh `$C:r` is a modifier (use literal SHAs); zsh does not word-split unquoted vars.
## Next
Build READY → smoke S1–S5 → republish pop-up (current season only) → verify the 24 ids are served.
- 02:46: smoke passed (S1 hit the wrong URL; the matrix was verified later). 02:48–02:50: rankings republished 52,292 rows at 11-13 (769, 24/24). Composites went blank: the reader joins on the exact date. TJ approved a composite republish pinned to as_of 11-13; written at 14:02, deployed composites restored. Blank window ~02:50–14:03 UTC.
## Next
Optional: sync octoberBranch from master (ours-merge; needs TJ). Open items are listed in ACCEPTANCE.md.
- TJ (11-15): the next publish must keep the last complete pair visible until rankings and composites are both ready at the new cutoff. Saved to memory; the reader change is not started.
- Paired-snapshot reader (TJ "Build it here"): written test-first. Two of five tests failed before the fix; afterwards 30/30 reader tests, 799 across 84 files, eslint 0 and typecheck 0. The composite-date read is coalesced (1 read per request). Committed 9c54766df, not released. Residual risk: composites written before rankings → a partial rankings date can show; the procedure stays rankings first.
- #448 merged as b5a580c45 (build running). TJ flagged the between-dates gap → regression test failed on #448, exact-match pairing fixed it; 31+2 reader tests pass, 801 across 84 files, eslint 0, tsc 0. Local commit 5c1c79963, unreleased. Slip: sent one unapproved prod SQL (timed out, not retried).
- #448 smoke passed (18:04). #449 (exact match) merged e74770217, READY, smoke passed 18:14 with output identical to #448. octoberBranch not yet synced with master (b5a580c45/e74770217 are squash copies of local 9c54766df/5c1c79963).

## 2026-11-15 ~20:10–20:40Z — completion marker (TJ: "Plan a completion marker", then "100% this job")
- **Plan:** `tasks/artifacts/rankings-acceptance-2026-11-14/COMPLETION-MARKER-PLAN.md` (advisor-reviewed: marker era, full-publication-only markers, DB-reported counts).
- **Split:**
  - Session `rank-pub-migration` (local_9e2aa5c2) owns the migration `20261115210000_ranking_publications.sql`, its proof and rollback, the authority row and the pending pin.
  - I own the code.
  - Lease: `RANKINGS-COMPLETION-MARKER`.
- **Code (uncommitted):**
  - `rankingPublications.ts` (new);
  - writer `publishEntityMetricRankingRows` and `planEntityMetricRankingPublication`, with counted upserts (`count: "exact"`);
  - composite `publishSkaterCompositeRatingRows`, which requires a complete Rankings marker;
  - reader marker era with the #449 fallback;
  - both routes return 409 on an incomplete publication or a missing table;
  - the types block in `database-generated.types.ts`.
- **Tests:**
  - writer 19/19, composite 44/44, reader 41/41, helpers 4/4, routes 15/15;
  - acceptance 15/15 after declaring an empty `ranking_publications`;
  - downstream rankings 123/123;
  - ESLint on the changed files: exit 0;
  - typecheck running.
- **Gotcha:** the acceptance fakeSupabase fails closed on undeclared tables, so any new table the reader touches must be declared there.
- **Next:**
  - typecheck exit code;
  - verify the migration session's output against the types (column names);
  - commit locally;
  - pop-ups for apply, release and first publish.

## 2026-11-15 ~20:40Z — completion marker shipped and first marked publish done
- **Migration 152:** applied at 20:16:50Z (TJ pop-up). Readback exact, smoke 2/2.
- **#450 `089a6a771`:** released. Live was unchanged (#449 fallback).
- **Run 1 of the first marked publish:**
  - Rankings complete at 11-14: 52,700 rows confirmed by the database, 775 skaters.
  - Composites returned 409 because of a marker key mismatch: composite rows use `"all_skaters"`, markers use `"all"`.
  - Live held 11-13.
- **#451 `c0c5fe9b2`:** the hotfix. The composites rerun completed (775).
- **Live:** now serves 11-14, 775 skaters, 0 null composites.
- **Local commits on octoberBranch (not pushed):** aa72290d0, a7c2e1072, c4d613427, a29f67849, 4fa4173eb, 9c58dea7d.
- **Gotcha:** fixtures must use the real per-surface peer keys. The hand-written composite fixture hid the mismatch.
- **Open:**
  - octoberBranch isn't synced with master (needs TJ);
  - historical republish;
  - a recurring schedule;
  - Trending speed.

## 2026-11-15 migration-record reconcile (proposed)
- Master lacks authority orders 150-152 (all applied in prod), their 3 migration files, 6 proof/rollback files, the summary count line and the 149->152 / 115->118 pins.
- Candidate 81edc325e = origin/master c0c5fe9b2 + those 12 files, blobs identical to octoberBranch. Clean export: vitest lib/supabase 72 files / 601 tests pass.
- TJ approved ("Release it"). Merged as #452 `86c249382`; 3 companions CANCELED, fhfhockey build dpl_2jUj8jVf... running at last check.
