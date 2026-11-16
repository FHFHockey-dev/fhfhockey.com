# Rankings offline correctness re-status (Claude) — 2026-11-14

## Scope
Re-status 11-08 audit R01, R03–R07 at deployed `89da739cb` (Rankings code byte-identical at local HEAD), offline only; reproduce every surviving defect with a Vitest test under `web/lib/rankings/__acceptance__/`; trace table/matrix/snapshot/comparison rank parity. No non-test source edits, no DB/app/provider access, no git mutations.

## Where
- octoberBranch, HEAD `9a312597e` (Rankings paths identical to `89da739cb` per Chef).
- Claim: CLAUDE-TO-CODEX.md `CLAUDE-RANKINGS-CORRECTNESS-CLAIM-20261114`.
- Tests: `web/lib/rankings/__acceptance__/`; report: `tasks/artifacts/rankings-acceptance-2026-11-14/offline-correctness/REPORT.md`.

## State
- Source traced. Preliminary: R01 default season fixed (`""` + /api/v1/season); WAR fallback and metadata still 20252026 / June static. R03 30-date/200-game fallback horizon still present (interactive path). R04 skater parsers unified; team snapshot/comparison abbreviation-only; goalie invalid token silently empty. R05 matched coverage, stints, QS null-handling fixed; projection age unchecked; no per-metric exposure gate. R06 power season bounds and 5v5 fixed. R07 composite cohort ranks depend on sample_confidence filter, which snapshot omits.
- Vitest setup points Supabase at `unit-tests.supabase.invalid`; shell has no SUPABASE env. Tests also mock `lib/supabase/server` and stub fetch.

## Checkpoint 20:30
- 4 test files + 2 harness files in `web/lib/rankings/__acceptance__/`; `npm test -- --run lib/rankings/__acceptance__/` = 15/15 pass (13 DEFECT PRESENT, 2 FIXED-CHECK). Output: `offline-correctness/vitest-output.txt`.
- REPORT written with status table, divergences D1-D6, fixes F1-F12, DB-packet questions.
- Gotcha: a stray `cat > file` with no heredoc hung a Bash call on stdin; run vitest with `< /dev/null`.

## Checkpoint 20:35 (advisor review)
- "Table" in the audit = Metric Explorer (`/contextual-rankings`); the Rankings-tab table is the matrix payload. Report and test names relabelled; D2 downgraded to cross-tab.
- R01 resolver traced (latest started season / 503); R04 off-page fixed (explicit selection wins).
- Existing suites + acceptance: 14 files / 225 tests pass. Scoped ESLint clean. Full typecheck run in background.

## Checkpoint 20:50 (Chef live findings)
- Added `chef-live-findings.acceptance.test.ts`: WRITER-POPULATION (entity writer drops >30-date skater; composite path keeps him), TEAM-FILTER-SOURCE (team view never reads all-skater publication; composites null), SNAPSHOT-UNPUBLISHED-SCAN (missing id rebuilds every matrix page). 5 files / 18 pass. Fake gained `.or` / `.abortSignal`.
- First full typecheck caught 2 TS2339 in my tests (union `reason`); fixed with a narrow cast. Second typecheck running.
- Fixes added to REPORT: W1 (writer, 2 files incl. 2-line rankingQueries signature), F13 (reader-derived team pools), F14 (page-for-selected snapshot).

## Checkpoint 2026-11-15 (fixes, Chef-cleared single fix owner)
- Claim CLAUDE-RANKINGS-ACCEPTANCE-FIX-CLAIM-20261115 (+ W1 addendum, TJ pop-up). Base HEAD 711ca63b5; Rankings files unchanged since 9a312597e.
- Implemented F14, F13, F1, F4, F5, F6, W1 in playerMatrix/snapshot/comparison/entityMetricRankingReader/goalieMatrix/rankingQueries (signature only)/entityMetricRankingWriter + snapshot.test, entityMetricRankingWriter.test. Each test flipped first and confirmed failing.
- Verified: acceptance 18/18; rankings+page+components 512/512; route tests 59/59; eslint clean; full typecheck exit 0 (after fixing a closure-narrowing error and making new composite fields optional).
- FIXES.patch written (tracked diff + --no-index for new acceptance files). Uncommitted. Production still 740 until an approved republish.
- Gotcha: the writer now needs the coverage loader mocked in unit tests, or it reaches for the network (.invalid host).

## Checkpoint 2026-11-15 round 2 (F11, F7, F9, F15)
- F11: calculator `window` input -> omitted min_gp uses defaultMinGpForWindow; callers rankingQueries/reader/deploymentTiers pass window; playerMatrix composite sample same floor. Writers pass explicit min_gp. Updated playerMatrix.test table + rankingQueries MCM test (explicit min_gp 1).
- F7: GOALIE_PROJECTION_MAX_AGE_DAYS=7 vs team's latest game; stale -> context only, warning, no Start Share, no "high".
- F9: unit-TOI publication capped at as_of ?? power date; teamMatrix.test policy case updated (trade-off: post-season corrections hidden without explicit as_of).
- F15: `.or("unit_type.eq.power_play,unit_number.eq.1")` on the unit-TOI page read; identity proven on writer-shaped fixture; teamMatrix.test fake gained `or` (before null-key guard).
- Verified: acceptance 20/20; 575/575 across rankings/page/components/route tests; eslint clean; typecheck exit 0. FIXES.patch regenerated (15 tracked files +477/-161 plus 7 new acceptance files).

## Checkpoint 2026-11-15 round 3 (repro split, F9 amendment)
- Moved the 6 remaining DEFECT PRESENT tests to `tasks/artifacts/rankings-acceptance-2026-11-14/offline-correctness/repros/` (own vitest config, harness copies, absolute-path supabase mock). `__acceptance__/` now holds only FIXED/FIXED-CHECK (15).
- Gotchas: (1) cutting tests at the first "  });" substring splits them; use line-anchored ends. (2) `open(p,"w").write(edit(open(p).read()))` truncates before reading; recovered from FIXES.patch. (3) vi.mock by alias does not bind from outside web/; use the absolute module path.
- F9 amended: cap unit-TOI at the power date only in-season (power < regularSeasonEndDate); completed seasons use the latest publication; as_of still wins. New completed-season test (2025-26 shape).
- Verified: acceptance 15/15, repros 6/6, suites 570/570, eslint clean; typecheck exit 0 after move and after amendment. FIXES.patch regenerated (22 files, tracked +491/-162).

## Next
Chef review; fix claims come back one at a time. Retire this diary after fixes land.

## Blockers
None.
