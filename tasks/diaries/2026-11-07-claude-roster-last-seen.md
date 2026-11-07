# 2026-11-07 roster last-seen signal (Claude)

## Scope
Non-destructive "last seen on the official NHL roster" stamp on `rosters`, used only to break same-team,
same-name ties in tweet player identity (FLA Schwindt, DAL Hryckowian). `is_current` semantics untouched.
Started by the lineup-ingestion-alert session (local_a60d6104).

## Where
- Branch octoberBranch, base HEAD 040c59341. Nothing committed.
- Files owned: new migration `supabase/migrations/20261107192933_rosters_official_seen_at.sql`,
  `web/lib/sources/playerIdentity.ts`, `lineupSourceIngestion.ts` (type only), `lineSourceProcessing.ts`,
  `tweetInterpretation.ts` (resolveRowIdentity), their tests, plus one row in
  `tasks/TASKS/repository-audit-remediation/migration-authority.json` and the count in
  `web/lib/supabase/supportedBaselineMigration.test.ts` (both also carry x-fallback-gha's uncommitted row 118).

## State
- Read-only prod checks: live RPC = baseline body + `SET search_path pg_catalog, public, extensions, pg_temp`;
  rosters has no stamp column. ~30 pending Schwindt/Hryckowian queue items (FLA cands 8481655/8483878,
  DAL 8484829/8486130).

- Done: migration 20261107192933_rosters_official_seen_at.sql, APPLIED to production 2026-11-07 ~19:29 UTC with
  TJ's approval (renamed from 20261107210000 to match the ledger). Readback OK, 0 rows stamped yet. Authority
  row 119 applied; test counts 119 total / 79 applied / 10 pending; super-goal summary count 119). Reader: fetchRosterEntriesByTeam selects `*`, marks
  `onOfficialRoster: true` when the stamp is within 12 h of the team's newest stamp. Tie-break:
  `breakIdentityTie` in playerIdentity.ts (slot first, then the one listed candidate among slot fits, same known
  team only); used by resolvePlayerIdentity and tweetInterpretation resolveRowIdentity.
- Checks: playerIdentity.test.ts 11/11; tweetInterpretation camp-namesake tests 2/2; supportedBaselineMigration
  21/21; npm run typecheck exit 0; eslint clean. Local PG15: applies twice, stamps listed rows only, team change
  still ends the old row, search_path + grants kept. Broad vitest: 18 failures in 8 unrelated route files
  (cron_job_audit fetch -> 503 in this env; none import the changed files).

- Trainer regression vs HEAD baseline: current 0 fixed / 0 broken; simulated stamps (public NHL current roster,
  scratch copy) 2 fixed / 0 broken. Queue replay (read-only): with simulated stamps FLA Schwindt 15/16 -> Cole,
  DAL Hryckowian 16/16 -> Justin on the live parse path; CAR-filed Schwindt stays in review. Without stamps, no change.
- Hand-over note: side-session-notes/local_a60d6104.../roster-last-seen-2026-11-07.md

## Next
Nightly update-players run stamps the official roster; then web/ release ships reader + tie-break. Commit only on TJ's ask.

## Blockers / approvals
Migration applied. The stamp fills only after the next
nightly update-players run after it is applied (and after web/ release for the reader side).

## Gotchas
- CREATE OR REPLACE resets proconfig: the migration must restate SET search_path.
- Select `*` from rosters so the reader works before and after the column exists.
