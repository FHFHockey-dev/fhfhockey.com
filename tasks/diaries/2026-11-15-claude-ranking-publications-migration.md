# 2026-11-15 Claude: ranking_publications migration (side session)

## Scope
Database side of the Rankings completion marker (plan: tasks/artifacts/rankings-acceptance-2026-11-14/COMPLETION-MARKER-PLAN.md).
Local only: no hosted apply, no commits, no pushes, no production reads. The parent session owns web/lib/rankings/* and the update-* routes.

## Where
octoberBranch, uncommitted. Files:
- supabase/migrations/20261115210000_ranking_publications.sql (new)
- supabase/tests/ranking_publications.py, supabase/tests/ranking_publications_rollback.sql (new)
- tasks/TASKS/repository-audit-remediation/migration-authority.json (row 152, pending)
- web/lib/supabase/supportedBaselineMigration.test.ts (151 -> 152 rows, pending 6 -> 7)
- Scope exception: tasks/TASKS/super-goal/super-goal-final-summary.md line 985, "151" -> "152" source-authorized records (the test builds that sentence from the row count).

## Decisions
- Revoke also from service_role before the grant (route_runner_tables pattern): Supabase default privileges grant ALL to service_role, so without it service_role would keep delete/truncate/references/trigger.
- complete check: added `db_written_rows is not null` and `written_entities is not null` inside the same named constraint. Without them a NULL count makes the equality NULL and the CHECK passes.

## State / checks
- Proof: `LC_ALL=C /usr/local/bin/python3 -I supabase/tests/ranking_publications.py` -> 40/40 PASS, exit 0 (local PostgreSQL 15, port 55547, non-superuser owner, Supabase-style default ALL grants).
- Migration sha256 ee5e4ee8a93d9c3d36abc50c277bb0a6f5b2ed3d86375304e7487212c06d6090 (authority row 152, pending).
- `npm test -- lib/supabase/supportedBaselineMigration.test.ts` -> 21/21 passed, exit 0.

## Next
Done locally. Hosted apply needs TJ's separate pop-up approval (not this lane). Any edit to the migration means re-hashing row 152.

## Gotchas
- The summary sentence in super-goal-final-summary.md:985 is asserted from the authority row count, so every new row must bump it.
- zsh: `echo =====` fails (= expansion); quote it.
