# FORGE reserve pass (plan B′) — diary

- Scope: give every current-roster NHL player a FORGE "if he dresses" line (skaters) / "if he starts" line (goalies) for RSO, without changing lineup rows, team totals, Start Chart, accuracy or game revisions.
- Where: octoberBranch, canonical checkout, uncommitted (orchestrator commits). Plan source: tasks/artifacts/forge-week-coverage-2026-10-26/DIAGNOSIS.md (B′). Receipt: tasks/artifacts/forge-week-coverage-2026-10-26/RESERVE-PASS-RECEIPT.md.
- TJ decisions (pop-ups 2026-10-26):
  - Marker: separate reserve table, bound to player/team/game/run/model version, explicitly conditional; goalie start distinct; same run admission; dedupe with lineup.
  - Payload: full horizon coverage; raise budget only after measuring; never silently truncate or bias to early games; name incomplete scope.
  - Participation: nullable; no hard-coded priors; distinct evidence states; optimizer counts a labelled 0; goalie start policy separate.
- Done (local, uncommitted):
  - Migration (local only): supabase/migrations/20261027090000_forge_reserve_projections.sql.
  - Producer: lib/projections/reserveProjections.ts; skater-stage + goalie-stage reserve passes; persistence-stage writer; audited-source list. All behind FORGE_RESERVE_PASS_ENABLED (default off). The clearRunGameRows edit was reverted: the file is held by the orchestrator, and the edit made an unreviewed dynamic site.
  - Bridge: forgeDailyBridge reads reserve rows (flag on), per-game evidence state, labelled conservative 0 + conditionalStats; goalie start_unknown; all-or-nothing reserve withholding; bridgeForecastWire 9th element (reserve code). Expanded budget 4 MB → 6 MB after measurement.
- Checks: affected vitest set 169 files pass in America/New_York; in UTC 167/169, the 2 failures (planning perf timeout + another lane's file mid-edit) pass on isolated rerun. eslint clean on changed files. Whole-project tsc under the lock: 0 errors in my files (3 errors are in another lane's game-predictions files). verify-forge-release-sha --worktree: VERIFIED, 0 findings (closure c1f0129a…).
- Gotchas: migration must be applied BEFORE turning the flag on (writes, resume deletes, bridge read). The skater UI shows no "if dresses" value yet (RSO-lane files). Workspace/backup snapshot is unpacked: real ceiling is the 8 MiB backup check, not 10 MB.
- Count-0 settled: the orchestrator accepted TJ's verbatim answer. A candidate test proves a strong reserve stays a candidate with value 0 (16 once confirmed). Final tsc exit 0; 65 files / 1,728 tests pass in both time zones. Next: the orchestrator verifies in a clean HEAD overlay and commits.
- 2026-10-26 (orchestrator round 3): expanded budget split, 4 MB with the pass off (unchanged) and 6 MB on, with a test. Fixture moved to forgeReservePayload.fixture.ts. Offline Playwright measurement in measure/mobile: Pixel 7 at 4x throttle decodes in 35 ms, save/reopen takes 207 ms, heap about 21 MB. A physical phone, the full RSO page and the real save API are recorded as unmeasured activation gates. Closure re-verified on HEAD 595ab13d9 (0 findings). 169 files / 4,627 tests pass in UTC and NY; tsc exit 0.
