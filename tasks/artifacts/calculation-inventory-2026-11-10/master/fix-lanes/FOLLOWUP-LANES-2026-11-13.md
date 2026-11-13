# Follow-up lanes, 2026-11-13: briefs for TJ to start from the desktop app

These are code items that must land before their production steps can run. Start each as its own session (one writer per file set). Each brief stands alone; paste it as the session prompt.

**Common rules for every lane:**
- Work only in the canonical checkout `/Users/tim/Code/fhfhockey.com` on `octoberBranch`.
- Touch only the named files plus their tests. Commit with explicit pathspecs. No `git add -A`; never add `tasks/` broadly; no LLM attribution.
- No production reads or writes, migrations applied, deploys or pushes without TJ's pop-up approval. Never set GIT_DIR. Never print secrets.
- Tests:
  - `env -u GIT_DIR npm test -- <file>` from `web/`;
  - `npm run typecheck` (read the exit code);
  - ESLint on changed files;
  - the CSS Modules pure check after any `.module.scss` edit.
- Each fix needs a regression test that fails on the old code (rule 11).
- Keep a diary in `tasks/diaries/`.
- For independent sub-work, start new sessions with start_session (not Agent subagents); use subagents only for read-only research you synthesize yourself.
- Ask TJ every question with an AskUserQuestion pop-up, recommended option first.
- Report SHAs, checks and remaining production steps to the Chef session.

## Lane F1: CTPI v2 production writer
- **Why:** L12 fixed CTPI as v2 (pooled components) in `web/lib/teamRatings/recentTeamFormV2*.ts` (status `candidate_unapproved`). Only `scripts/audit-ctpi-*.ts` calls it. The production writer `/api/v1/db/update-team-ctpi-daily` (pg_cron, 10:10Z) still computes v1 (`ctpi.ts`, `ctpi-formula-v1`). Issued v1 rows are history (rule 21).
- **Do:**
  - Add a versioned v2 write path: a new version tag; v1 rows untouched. Readers select by version and label it.
  - Write, but do not apply, the "CTPI v2 publication" migration L12 asked for. Read `fix-lanes/L12.md` (rows on CTPI, lines ~21 and ~35) and the L12 diary first.
- **Done:** writer and readers updated with tests; migration file and authority row (pending); a list of production steps (apply the migration, then backfill dates).

## Lane F2: SOS v2 wiring
- **Why:** `computeDescriptiveSos` (`web/lib/teamRatings/strengthOfScheduleContract.ts:3,61`) has the v2 fix but no non-test caller. `/api/v1/db/update-team-sos` (pg_cron 365, 09:12Z) is unchanged: it still counts `gameDate <= currentDate` as past, and makes NHL API calls (32 club schedules plus standings GETs).
- **Do:** route the writer and its readers through the v2 contract, with a versioned output and v1 history kept. Keep NHL API usage at or below today's.
- **Done:** tests (including the past/future boundary); a production recompute plan with bounds.

## Lane F3: Lines 5v5 switch (decision 137)
- **Why:** L8's disjoint 5v5 units (`web/components/LineCombinations/fiveOnFiveUnits.ts`) sit behind the code constant `LINES_FIVE_ON_FIVE_ENABLED=false` (line 12; read at `utilities.ts:215`; pinned in `__test__/fiveOnFiveUnits.test.ts:115`).
- **Depends on:** the `team_unit_toi` rebuild (queue 8). Its dry run is planned after the 2026-11-13 pipeline check.
- **Do:** flip the constant, update the pinned test, and check the Lines page against the rebuilt snapshot (local dev with `PLAYWRIGHT_ISOLATED_NEXT=1`).
- **Done:** a commit ready for a release, plus a short visual check note.

## Lane F4: game finality from a stored game state (rule 19; L2 W2-3 D7)
- **Why:** `isFinishedPlayerStatsSourceGame` (`web/lib/underlying-stats/playerStatsLandingServer.ts:849`) treats an earlier UTC date, or start + 8 h, as final. A late game can therefore read as final mid-game. No table stores a game state: `games` has id, seasonId, type, date, startTime and team ids only.
- **Do:**
  - Design a stored finality source, for example a `games.game_state` column filled by the schedule ingester (`update-games`), and write the migration (not applied).
  - Switch the landing and detail readers to it, with the date/time heuristic only as a labelled fallback when the state is unknown. Rule 19 says finality comes from a game state, and changing the basis is a versioned contract shared by consumers; list every consumer you change.
- **Done:** migration (pending) plus ingester and reader changes with tests; a rollout order (apply the migration, backfill the state, then release the readers).

## Lane F5: CTPI v2 validation and approval change (TJ "Start a validation lane", 2026-11-13)
- **Why:**
  - Release #433 ships only v2 candidate rows (`recent-team-form-v2-candidate-2`, `candidate_unapproved`); 1,102 have been issued for 2026-27 (10-07 → 11-13).
  - Readers default to v2 and serve only approved rows (`isTrustedCtpiPayload`, `web/lib/trends/ctpiVersions.ts`), and v1 is frozen (migration 144). **Recent Team Form serves no rows** until v2 is validated and approved (W1-4).
- **Do:**
  1. **Held-out study, no production writes.** Compare v1 and v2 as predictors of next-N-games goal differential per game and points% (rule 11).
     - Compute earlier-season v2 offline with `web/scripts/audit-ctpi-*.ts` or a local script.
     - Production reads are bounded and read-only under read hygiene. No NST or NHL calls.
     - Write the report to `master/production/ctpi-v2-validation-2026-11-13/REPORT.md`.
  2. **If v2 is at least as good:** write the successor change. The writer issues `approved` from a stated date; stored candidate rows are never relabelled (rule 21).
     - Files: `web/lib/trends/ctpiVersions.ts`, `web/lib/trends/recentTeamFormV2*.ts`, `web/pages/api/v1/db/update-team-ctpi-daily.ts` and their tests.
     - Add regression tests. Commit; don't release.
  3. **If v2 is worse:** report why and propose options.
  4. List the production steps (the approval date and any re-issue) for TJ.
- **Context:**
  - F1 notes: `~/Library/Application Support/Claude/side-session-notes/local_78a99adf-5ef6-4703-8c93-35994d6c995d/F1-ctpi-v2-production-steps.md`.
  - Lane brief: `fix-lanes/L12.md`.
  - Game-prediction features stay pinned to v1.
- **Done:** the report, plus either a verified commit or a reasoned no-go. Report to the Chef session `local_016832c1-5630-43a9-9b8f-59627cb65bda` with SendMessage. The common rules at the top of this file apply.
