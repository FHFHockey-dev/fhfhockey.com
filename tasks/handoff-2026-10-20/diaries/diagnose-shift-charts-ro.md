> Compiled 2026-10-20 from the session transcript by the orchestrator's helper; not written by the session itself.

# Diary: diagnose-shift-charts-ro (local_a597f542-31fa-4672-90ed-3af5a4e0c309)
Session title: "Diagnose shift-charts roster-scope 500 (game 2026010007)". About 998 messages over several Chef-relayed rounds. Status when read: idle, last turn done.

## 1. Scope
- Started by Chef (local_4317ea20) to unblock finding A-01: no succeeded `forge_runs` since 2026-09-29 because `update-shift-charts` could not finish and `run-projection-v2` returned 422. Task IDs: A-01 (parent), plus its own rounds below.
- Rounds, in order: (1) 500 "Invalid relationship roster scope for game 2026010007" (type 01 preseason); (2) TJ's rule: preseason shift charts viewable, but out of the queue once the regular season starts; (3) R3 catch-up failed on 2026020001 (roster spots only under an older PBP hash); (4) 2026020002 "Shift source fingerprint does not match"; (5) skip-and-continue isolation; (6) HTML shift fallback plus migration 86; (7) "option A": relationships from stored snapshots.

## 2. Where
- Branch octoberBranch; the session itself committed nothing. Notes dir: `tasks/artifacts/shift-charts-scope-2026-10-19/` (DIAGNOSIS.md, R3-ROSTER-HASH.md, PROPOSED-gamecenter-renormalization-vs-R3.patch, R4-SHIFT-FINGERPRINT.md, SKIP-ISOLATION.md, HTML-SHIFT-FALLBACK.md, HTML-FALLBACK-BLOCKER.md, HTML-FALLBACK-BUILD.md, OPTION-A-STORED-SNAPSHOTS.md, html-fallback-migration-pg-verify.py and result json).
- Code: `web/lib/projections/relationshipMaterialization.ts`, `web/pages/api/v1/db/shift-charts.ts`, `web/lib/projections/ingest/shifts.ts`, `rawSnapshotPersistence.ts`, `web/lib/supabase/Upserts/nhlRawGamecenter.mjs` (+ `.d.ts`), migration `supabase/migrations/20261019172842_accept_html_report_projection_shift_snapshots.sql` (authority order 86), tests incl. new `shifts.storedSnapshot.test.ts` and `shifts.htmlFallback.test.ts`.

## 3. State
- Findings: the queue took preseason first and stopped at the first error (R3 fix: type 02/03 always; preseason only until a regular-season game has a status row; rosterless preseason game skipped as `preseason_without_roster_spots`; other types fail closed). The 422 root cause was the stuck relationship queue starving the derived build (`selectPendingProjectionDerivedDates`), not shift coverage (Chef's read: coverage 1.00). `/shiftChart` reads NHL APIs live, so preseason games stay viewable.
- R3 roster-hash cause: `ingest-projection-inputs` re-captured PBP without rewriting roster spots (needed the unreleased `normalize_gamecenter` step 0de97e77d and the sweep route 317f8f57e). The session built a patch against R3.
- Fingerprint cause: NHL corrected shift data after ingest; shift-charts compares live NHL shifts with `shift_source_hash`. Recovery was an ingest re-run (Chef did it 09-29..10-18).
- Skip isolation (`shift_feed_unavailable`, `projection_inputs_stale`, bounded scan so skips do not eat `maxGames`): 63 tests, ESLint, full tsc exit 0.
- HTML fallback (only when JSON total is 0 and game final; provenance `source:"htmlreports"`, shown as `shiftSource`; strict player matching; rows get `gameId` and `typeCode:517`): 17 files/253 tests; disposable PostgreSQL 17.11 harness 31/31 (JSON capture identical before/after, signature and grants unchanged).
- Option A (stored PBP and shift snapshots by `pbp_raw_payload_id`/`shift_raw_payload_id`, checked for id, game, endpoint, hash; no NHL calls): 18 files/261 tests, ESLint on 6 files, full tsc pass. RPC raw-snapshot-stale guard kept, recorded as skip `projection_raw_snapshot_stale`.
- RELEASED: R2 fa950fd29 (Pettersson namesake), R3 7294e3847, R4 ad93e2887 (normalise step plus sweep), R5 bb21d5942 (skip isolation, option A, HTML fallback code with flag off). `shift-charts.ts`, `shifts.ts`, `relationshipMaterialization.ts` equal origin/master (b630e0767).
- Hosted DB: Chef applied `20261011115124` (ledger 20261019172738) and migration 86 (ledger 20261019172842, body md5 prefix 4750518d) at TJ's request. The migration file is on octoberBranch (5ae65fc13) but not in origin/master.
- Chef's catch-up with option A (register): calls 2-4 returned 200, 0 skipped, queue drained (games 0002-0136, `shiftSource` json-api from stored snapshots, including 0006-0053 whose live feed is empty).

## 4. Next
- Stated: nothing pending; session ended after fixing the comment at `shifts.ts:471-473` to cite migration 20261019172842.

## 5. Blocked / needs TJ
- Turning on `PROJECTION_SHIFT_HTML_FALLBACK_ENABLED=true` is TJ/Chef's decision (default off; hosted RPC already accepts `htmlreports`).
- Unreleased follow-ups: layers 2 and 3 of game-type isolation (queues per type, type-filtered gates) are earmarked, not built.

## 6. Insights
- A relayed approval did not clear the auto-mode safety check on a `migration-authority.json` edit; the session waited for TJ's own approval typed in that session.
- Stale NHL feeds: JSON shiftcharts is empty for 2026020006-0053 while HTML reports (TV/TH) exist; 4 games (0057, 0094, 0101, 0123) have clock/duration mismatches and have no projection inputs (derived build skips them as `projection_inputs_unavailable`).
- Gamecenter HTML games re-normalise once after release; stored shift `type_code` goes null to 517. No shift reader filters on `type_code`.
- Do not edit `migration-authority.json`, `supportedBaselineMigration.test.ts` (21/21) or the summary line from this lane; Chef owns them (IFTTT SQL planned for later orders shifted accordingly).
