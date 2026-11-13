# Diary: follow-up lane F1, CTPI v2 production writer (Claude, 2026-11-13)

## Scope
Brief: `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/FOLLOWUP-LANES-2026-11-13.md` Lane F1.
- Versioned v2 write path in `/api/v1/db/update-team-ctpi-daily`; v1 rows untouched (rule 21). Readers select by version and label it.
- Write (not apply) the "CTPI v2 publication" migration + pending authority row; keep `supportedBaselineMigration.test.ts` green.
- Code only. No production reads/writes, migrations applied, deploys, pushes.

## Where
octoberBranch, sole checkout. Files actually live in `web/lib/trends/` (brief said `lib/teamRatings/`).
Owned: `web/pages/api/v1/db/update-team-ctpi-daily.ts`, `web/lib/trends/{ctpi,recentTeamFormV2*}.ts`, CTPI readers (`pages/api/v1/trends/team-ctpi.ts`, CTPI blocks of `pages/api/v1/start-chart.ts`, `lib/game-predictions/featureBuilder.ts`), their tests, new migration, its authority row.

## Findings so far
- Writer computes v1 (`computeCtpi`, `ctpi-formula-v1`), payload status `legacy_unapproved` since 5740289cc (08-29); earlier rows carry no status. Readers trust only `approved` + exact v1 versions, so no production row is trusted today: CTPI is dormant on every reader.
- Table PK `(season_id, team, date)`: v2 rows for the same date would overwrite v1. Needs a version column in the key.
- Order 56 `recent_team_form_nullable_components` is `unknown` (likely not applied); v2 components can be null, so the new migration repeats the drop-not-null (idempotent).
- OWNER-DECISIONS (W1-4 direction): "keep the newer candidate gated until it is validated". So v2 is written with `candidate_unapproved`, readers select by version and label it, but do not serve untrusted rows.
- v2 snapshot is strict pre-game (`date < snapshotDate`); v1 used `<=`.

## Next
Read Start Chart / featureBuilder CTPI blocks; implement writer + readers + migration; failing-first tests.

## Blockers
None.

## Checkpoint 1 (2026-11-13) — writer, readers, migration written (uncommitted)
- New `web/lib/trends/ctpiVersions.ts`: version contracts (1 frozen, 2 candidate), writer/served version 2, `isTrustedCtpiPayload(value, version)`.
- Writer issues v2 only: strict pre-game snapshots, replay plan (rewrites only changed dates), upsert on `season_id,team,date,ctpi_version`, first run = today only, max 31 dates per run (explicit span → 400; automatic catch-up clamps with a warning), `start`/`end` params.
- Readers: team-ctpi selects `payload->>formulaVersion` of the requested version (`?version=1|2`, default 2) and labels `source.ctpiVersion/label/sourceCutoff`; components nullable. Start Chart selects served version and labels sourceStatus.ctpi. featureBuilder pins v1 (model input contract) so v2 rows can't crowd its 100-row window. normalizers keep null components.
- Readers filter by payload formula version, not the new column, so they work before and after the migration.
- Migration `20261113160000_team_ctpi_daily_v2_publication.sql` + rollback + proof `supabase/tests/f1_ctpi_v2_publication.py`: RESULT OK on local PG15. Authority order 144 pending; test counts 144/9 pending; super-goal summary count 143→144 (test pins it). Authority test 21/21.
- Writer test: 10/10 pass; on HEAD writer 8/10 fail (2 ported invariants pass), incl. decision-20 pooling (HEAD gives TOR special teams +0.55, v2 -0.55).

## Checkpoint 2 (2026-11-13) — reader tests, wider suites
- Failing-on-HEAD (swap check, restored by cmp): team-ctpi 4/5 fail on HEAD reader; Start Chart 2 CTPI tests fail on HEAD; featureBuilder v1-pin test fails on HEAD; normalizer null test fails on HEAD.
- Start Chart fixture `trustedTeamFormColumns` now means approved v2 (served version); "unapproved" test uses a candidate v2 row.
- `scripts/audit-ctpi-formula.ts` (only script reading the table): legacy audit reads v1 rows only; replay check reads issued v2 rows.
- Suites: 13 affected files 337 pass; game-predictions + nst callerLifecycle + forge-dashboard + lib/trends 27 files 317 pass. ESLint changed files exit 0.
- Mailbox claim skipped: FOLLOWUP common rules don't require it and CLAUDE-TO-CODEX.md holds F2's uncommitted claim.
- Production steps written to the shared notes folder (`F1-ctpi-v2-production-steps.md`).
- Approval-time reader tickets (not live): placeholder.tsx selectTopDriver/LUCKY with null v2 components (F2 holds the file); game model adopting v2 (L22); regenerate DB types after apply.

## Checkpoint 3 (2026-11-13) — commits
- 197612873: migration + proof + rollback + authority row 144 (pending) + test counts + summary count.
- Code commit follows (writer, ctpiVersions, readers, Start Chart contract label, normalizer, audit script, tests, this diary).
- Start Chart contract type `sourceStatus.ctpi` gained `ctpiVersion`/`label` (null when unknown); test fails on HEAD contract.
- Final checks: typecheck EXIT 0 (whole tree); ESLint changed files exit 0; 40 test files / 706 tests pass; proof RESULT OK.
- Next: report to Chef; production steps in the notes folder (`F1-ctpi-v2-production-steps.md`). Diary stays until the migration is applied and backfill done.
