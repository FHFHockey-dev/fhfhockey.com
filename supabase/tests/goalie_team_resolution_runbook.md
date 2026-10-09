# Goalie unified team repair — production applied October 2, 2026

## Scope and evidence

Project: `fyhftlxokyjtpndbkfse`. Preparation was read-only; the owner-approved
production rollout and independent postflight are recorded in the closure below.

The October 2 09:05 UTC refresh failure preceded the Task 1 ACL change at
12:36 UTC. It is a team-join duplication, not evidence of an ACL failure.
Job 272/run 175963 failed on `(8478872, 2026-10-01)`; the retained
materialization lacks that key. Website and downstream projection effects
have not been demonstrated.

Read-only rechecks on October 2 confirmed:

- WGO has one row for that key, season 20262027, UTA, game 2026020013, home.
- That game has matching date/season and home local team 68.
- The unified view emits two rows (local teams 59 and 68); the full duplicate-key
  check returned only this key.
- All 31 eligible WGO rows with supplied abbreviations matched their game,
  date, season and home/road team abbreviation. The other 10,056 eligible rows
  have neither abbreviation nor game ID.
- UTA alias 2025–2099 targets 68. ARI alias 2000–2024 targets 59 despite
  local Arizona being 53. This alias is unsuitable for global identity replacement.
- The unique index remains on `internal_stats.goalie_stats_unified(player_id,date)`.

The candidate changes only the unified view's team resolver and diagnostic,
with a private, security-invoker function. It preserves PHX/ARI and Utah HC/
Mammoth records and player IDs; it never groups by `franchise_key`, merges
records, edits aliases, or assumes local IDs are official NHL IDs.
Game/date/season and supplied home/road determine the team. Only ambiguous
abbreviations consult season aliases; missing, overlapping or conflicting
mappings raise errors rather than multiply rows or choose an arbitrary ID.
An unknown home/road can resolve only if exactly one game participant matches.
Without a game, a unique abbreviation retains existing mapping behavior;
a repeated abbreviation requires exactly one valid season alias.

The 10,056 legacy rows lacking source identity retain their existing
`players_team_id_fallback`. This is **not proof of season-correct identity
for those rows**. Correcting that historical debt needs separately scoped
evidence and approval; the new resolver never uses current player team.
Historical Utah HC and PHX/ARI tests are synthetic regression cases using
observed local team records, not claims of populated historical WGO game IDs.

## Local verification

From repository root, with installed PostgreSQL 17:

```sh
python3 supabase/tests/run_goalie_team_resolution.py
```

The runner creates its own temporary, socket-only cluster/database, rejects
host authentication, removes PG connection environment variables, and stops
and removes its cluster in a finally block. No install/download or existing
database is used. On macOS the sandbox may require approval for PostgreSQL
shared memory. `GOALIE_PG_BIN` can point to an already installed compatible bin directory.

The test reconstructs the nearest baseline WGO/NST/source tables and exact
captured production unified view (MD5 `34db6b958ee0d820179611188eaeb269`).
It demonstrates the original unique-index failure and corrected ordinary and
concurrent refreshes; one result per resolver input; 2026 failure identity;
historical HC, ARI and PHX; Boston and away-team controls; first/last alias
seasons and gaps; missing/overlap/conflict/invalid-game errors; all 305 view
column names/order/types; unchanged other values, OIDs, ACLs, invoker security
and dependent definitions; reader execution; and definition rollback.

Passed on PostgreSQL 17.11. Independent supplemental tests also passed:
definition drift rolls back the entire migration without leaving the function;
a resolver exception during concurrent refresh preserves retained rows; all
three reader roles execute the view; function metadata has invoker security,
stable volatility, empty search path and no PUBLIC execute. The original-version
transaction below and its replay refusal passed against a disposable local
migration ledger. These are executed local checks, not hosted apply/refresh evidence.

Production was observed read-only as PostgreSQL 15.1. No PostgreSQL 15 runtime
was found in the installed Homebrew/Postgres.app locations, Homebrew download
cache, or cached PostgreSQL images in the existing Colima context. PostgreSQL
15 execution was unverified during preparation; no runtime was installed/downloaded
and no existing container was changed. Production-scale timing and authenticated
production transport were unverified during preparation; approved production
execution is recorded below. Application builds/tests were not run: this change
has no TypeScript or application build surface. Hosted refresh was not run during
preparation; the one approved production refresh is recorded below.

## Reviewed original-version apply transaction

The Supabase `apply_migration` connector auto-selects its version; its raw
`execute_sql` connector directs DDL to `apply_migration`. Do not use raw connector
SQL to bypass that guidance or silently substitute a generated version.
For the approved original version `20261002140500`, use the complete reviewed
transaction through the SQL Editor on project `fyhftlxokyjtpndbkfse`, or an
approved administrative libpq/psql connection to that exact project. The SQL
payload and psql procedure were tested locally; neither production transport
has been executed or verified as part of this preparation.

The prepared file is `/tmp/goalie-reviewed-original-version-apply.sql`, SHA-256
`9e7ea2eb1b5ac691f3271a17ba3a25d1dd6ce41c0d10d526e7c2fe03d6988832`.
It embeds candidate SHA-256
`a7beadc4c08f93dbcc4240f67be9c8d54f1cbcc5e37242230a5be6884fdbc872`.
Because `/tmp` is temporary, this preparation-only command regenerates the
identical reviewed file from the repository root without connecting to a database:

```sh
python3 - <<'PY'
from pathlib import Path
import hashlib
migration = Path('supabase/migrations/20261002140500_resolve_goalie_unified_game_team.sql').read_bytes()
assert hashlib.sha256(migration).hexdigest() == 'a7beadc4c08f93dbcc4240f67be9c8d54f1cbcc5e37242230a5be6884fdbc872'
migration = migration.decode('utf-8')
sql = """-- REVIEW PREPARATION ONLY: never run against production without explicit approval.
-- Target fyhftlxokyjtpndbkfse; exact local migration version 20261002140500.
-- Candidate SHA256 a7beadc4c08f93dbcc4240f67be9c8d54f1cbcc5e37242230a5be6884fdbc872.
-- Execute complete file through project SQL Editor or approved administrative libpq/psql.
-- psql -X -v ON_ERROR_STOP=1 -f /tmp/goalie-reviewed-original-version-apply.sql
-- Use approved credential handling; validate target connection and runbook preflight first.
-- This file performs NO refresh. Separately approved refresh is a separate command.
BEGIN;
SET LOCAL search_path TO public, extensions;
SET LOCAL lock_timeout = '5s';
LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261002140500') THEN
  RAISE EXCEPTION 'Goalie migration version already recorded; stop without replay'; END IF;
 IF to_regprocedure('internal_stats.resolve_goalie_game_team(text,integer,date,bigint,text)') IS NOT NULL THEN
  RAISE EXCEPTION 'Goalie resolver name already occupied; stop without replacement'; END IF;
END $$;
""" + migration + """
-- Evaluate full view inside the transaction, before recording/committing receipt.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.vw_goalie_stats_unified GROUP BY player_id,date HAVING count(*)>1)
 OR (SELECT count(*) FROM public.vw_goalie_stats_unified)<>(SELECT count(*) FROM public.vw_goalie_stats_unified_source)
 OR (SELECT count(*) FROM public.vw_goalie_stats_unified WHERE player_id=8478872 AND date='2026-10-01'
     AND season_id=20262027 AND team_id=68 AND team_id_source='wgo_game_team')<>1 THEN
  RAISE EXCEPTION 'Goalie production view postcondition failed; transaction must roll back'; END IF;
END $$;
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)
VALUES ('20261002140500','resolve_goalie_unified_game_team',ARRAY[$goalie_reviewed_sql$""" + migration + """$goalie_reviewed_sql$]);
COMMIT;
"""
assert hashlib.sha256(sql.encode()).hexdigest() == '9e7ea2eb1b5ac691f3271a17ba3a25d1dd6ce41c0d10d526e7c2fe03d6988832'
Path('/tmp/goalie-reviewed-original-version-apply.sql').write_text(sql)
PY
```

The transaction sets its local search path and a five-second lock timeout,
serializes ledger writes, refuses an existing version receipt or occupied
function name, applies only the reviewed candidate, and evaluates the full
corrected view before commit. It requires zero duplicate player/date groups,
equal source/view counts and exactly one target row with team 68 and
`wgo_game_team`. Any exception aborts the transaction. It inserts exactly one
receipt into `supabase_migrations.schema_migrations` with version
`20261002140500`, name `resolve_goalie_unified_game_team`, and the exact candidate
SQL in `statements`. Definition and receipt commit atomically. There is no refresh
or cron mutation in this transaction.

After explicit approval and connection/hash/preflight checks, submit the entire
file in the project SQL Editor, or use the approved libpq connection with:

```sh
psql -X -v ON_ERROR_STOP=1 -f /tmp/goalie-reviewed-original-version-apply.sql
```

The command assumes the approved connection is already configured; it must not
print, invent or obtain credentials. On any failure, stop without retry and
inspect the transaction/ledger state read-only. Do not bulk-push migrations.

## Proposed production operations — only after explicit approval

Apply only `20261002140500_resolve_goalie_unified_game_team.sql` and its
original-version ledger receipt using the reviewed transaction above. Do not
bulk-push the dirty migration tree, replay the baseline, reapply Task 1
`20260820013120`, invoke `public.execute_sql`, or use this runbook as authorization.
The migration itself contains no refresh and no cron mutation.

1. Recheck file SHA-256 hashes, applied migration ledger, exact view MD5,
   security options/grants, the unique index and job 272's existing command.
   Confirm the function name is unused. Capture original view definition,
   column/type contract, grants and retained materialization freshness.
   Run separately:

   ```sql
   SELECT md5(pg_get_viewdef('public.vw_goalie_stats_unified'::regclass,true));
   SELECT * FROM public.team_franchise_alias WHERE abbrev='UTA';
   SELECT abbreviation,array_agg(id) FROM public.teams
     GROUP BY abbreviation HAVING count(*)>1;
   SELECT indexname,indexdef FROM pg_indexes
     WHERE schemaname='internal_stats' AND tablename='goalie_stats_unified';
   SELECT jobid,jobname,schedule,command,active FROM cron.job WHERE jobid=272;
   ```

2. Apply the reviewed original-version transaction above. Its full-view
   postconditions run before the candidate and ledger receipt commit.
   After commit, confirm exactly one ledger row for version `20261002140500`,
   matching name and candidate SQL; compare column/type, grants/security and
   dependents, then evaluate the corrected view read-only before any refresh.
   Do not proceed on any resolver exception, duplicate or count discrepancy.

   ```sql
   SELECT player_id,date,count(*) FROM public.vw_goalie_stats_unified
     GROUP BY player_id,date HAVING count(*)>1;
   SELECT count(*) FROM public.vw_goalie_stats_unified;
   SELECT count(*) FROM public.vw_goalie_stats_unified_source;
   SELECT player_id,date,season_id,team_id,team_id_source
     FROM public.vw_goalie_stats_unified
     WHERE player_id=8478872 AND date='2026-10-01';
   ```

   Expect zero duplicate groups, equal source/view counts, and exactly one
   target row with team 68 and source `wgo_game_team`. Compare all preexisting
   nonidentity values excluding volatile generation timestamps. Reconfirm
   no new populated source prerequisites conflict; local fixtures do not
   prove the entire changing hosted dataset will refresh.

3. If separately approved as part of this repair, run exactly one:

   ```sql
   REFRESH MATERIALIZED VIEW CONCURRENTLY internal_stats.goalie_stats_unified;
   ```

   Run outside a transaction. Do not retry automatically. It is a complete
   materialized-view refresh, not a row-only patch; review timing/load and
   avoid overlapping the 09:05 UTC scheduled job. Do not change cron.
   An exception leaves the retained materialization intact.

4. Check target key/team/source/freshness through the public wrapper and
   internal materialization; duplicate groups must be empty and the existing
   unique index valid. Inspect next scheduled refresh result read-only;
   do not trigger a second refresh. Report website/projection effects only
   if independently observed.

## Rollback

Before applying, save the actual prior view definition. For the captured,
MD5-matching contract, a reviewable rollback file can be prepared locally:

```sh
python3 - <<'PY'
from pathlib import Path
source = Path('supabase/tests/goalie_unified_prior_view.sql').read_text()
source = source.replace('CREATE VIEW public.vw_goalie_stats_unified',
                        'CREATE OR REPLACE VIEW public.vw_goalie_stats_unified', 1)
Path('/tmp/goalie-unified-rollback.sql').write_text(
    'BEGIN;\n' + source +
    '\nDROP FUNCTION internal_stats.resolve_goalie_game_team(text,integer,date,bigint,text);\nCOMMIT;\n')
PY
```

An apply failure before commit rolls back both the candidate and its receipt.
After a committed apply, rollback requires separate owner approval; the initial
apply/refresh approval does not authorize rollback execution. Apply the reviewed
rollback transaction through the same project SQL Editor or approved libpq
connection. Keep the original migration receipt as the application audit record;
do not delete or rewrite the ledger entry or silently replay the migration.
The rollback restores the prior view/grants/security and removes only the new
function without CASCADE. Do not refresh the restored
buggy view. If a refresh already succeeded, definition rollback deliberately
retains that refreshed data; it does not recreate the earlier stale data.
The unchanged scheduled job would again encounter the original duplication;
any cron pause or further action requires separate authorization.

Approval wording: “Approve the reviewed original-version transaction
`/tmp/goalie-reviewed-original-version-apply.sql` (SHA-256
`9e7ea2eb1b5ac691f3271a17ba3a25d1dd6ce41c0d10d526e7c2fe03d6988832`)
on project `fyhftlxokyjtpndbkfse` through its SQL Editor or an approved
administrative libpq connection: apply only migration
`20261002140500_resolve_goalie_unified_game_team.sql` (SHA-256
`a7beadc4c08f93dbcc4240f67be9c8d54f1cbcc5e37242230a5be6884fdbc872`)
and atomically record its original version `20261002140500`, the listed
read-only preflight/postflight validation, and then one separate concurrent
refresh of `internal_stats.goalie_stats_unified` after those checks pass.
No alias/history edits, backfills, cron changes, Task 1 reapplication,
deployments, other migrations, automatic retries, or rollback execution.”


## Production closure — October 2, 2026

The owner explicitly approved the exact reviewed transaction and original-version
ledger insertion, the listed read-only validations, and one separate concurrent
refresh on project `fyhftlxokyjtpndbkfse`. The parent performed the production
operations through the authenticated project SQL Editor. This reviewer performed
only read-only production queries and local documentation/evidence updates.

All human-readable times below are America/New_York (Eastern Daylight Time).
The parent reported one execution of the byte/hash-verified apply transaction
at approximately **11:27:55 am**, with SQL Editor success. Its 11:29:06 am
catalog check confirmed original version `20261002140500`, name
`resolve_goalie_unified_game_team`, one statement and statement MD5
`327a9d622d2726aa20cbfd6a35bc21f4`. The parent reported successful
post-apply gates at 11:29:33 am, including equal counts, no duplicates, the
correct target and unchanged legacy checksum. Its optimized full-value check
returned unchanged nonidentity checksum
`884755471d733ed557fde548ac219c7d`; this full-value result is parent-reported
and was not rerun by the independent reviewer.

The parent then reported exactly one successful concurrent refresh. Both
materialized freshness bounds are **11:30:31.664103 am**,
`2026-10-02T15:30:31.664103Z`. No second refresh or rollback was performed
by this reviewer.

Independent read-only postflight at **11:35:13.960895 am**,
`2026-10-02T15:35:13.960895Z`, confirmed on PostgreSQL 15.1:

- Exactly one original-version receipt with the expected name, one statement
  and candidate SQL MD5. The corrected view MD5 is
  `f1ef2a5453bea831fc7e5834d46d969a`.
- Source, corrected view, internal materialization and public wrapper each
  contain **10,087 rows**. View and materialization duplicate groups are empty.
- Player `8478872`, date `2026-10-01`, season `20262027` appears exactly once
  with team **68** and source `wgo_game_team`. Public and internal target
  records, including freshness, are identical.
- All **305 column names/order/types**, all four existing object OIDs/owners/
  ACLs/security options, and the other view definitions match the captured
  preflight. All three existing indexes are unchanged, valid and ready;
  the player/date index remains unique.
- Resolver security is invoker, volatility stable, search path empty, PUBLIC
  execute false, and execute permission true for anon/authenticated/service_role.
- Legacy checksum `7e6c4e5b760fc0001f36d89ba174e2c1` is unchanged.
- Job **272** remains active with schedule `05 9 * * *` and command
  `REFRESH MATERIALIZED VIEW internal_stats.goalie_stats_unified;`.
  No goalie refresh was active at the independent observation.

The closure receipt below is durable documentation of the observed state and
the parent's execution report. The full independent catalog/data response was
also saved locally to `/tmp/goalie-production-closure-independent.json`.
No production SQL was executed through `public.execute_sql` by this reviewer;
no alias/history edits, backfills, cron changes, Task 1 reapplication,
deployments or other migrations were performed by this reviewer.

```json
{
  "project": "fyhftlxokyjtpndbkfse",
  "owner_approval": "Exact original-version transaction, listed read-only validation, and one separate concurrent refresh; no rollback/retry/other mutation",
  "apply_file_sha256": "9e7ea2eb1b5ac691f3271a17ba3a25d1dd6ce41c0d10d526e7c2fe03d6988832",
  "migration_sha256": "a7beadc4c08f93dbcc4240f67be9c8d54f1cbcc5e37242230a5be6884fdbc872",
  "parent_reported_apply_at_approx_utc": "2026-10-02T15:27:55Z",
  "independent_observed_at_utc": "2026-10-02T15:35:13.960895+00:00",
  "server_version": "15.1 (Ubuntu 15.1-1.pgdg20.04+1)",
  "ledger": [
    {
      "name": "resolve_goalie_unified_game_team",
      "version": "20261002140500",
      "statement_md5": "327a9d622d2726aa20cbfd6a35bc21f4",
      "statement_count": 1
    }
  ],
  "post_view_md5": "f1ef2a5453bea831fc7e5834d46d969a",
  "contract_columns": 305,
  "counts": {
    "source": 10087,
    "view": 10087,
    "internal": 10087,
    "public": 10087
  },
  "target": {
    "date": "2026-10-01",
    "team_id": 68,
    "player_id": 8478872,
    "season_id": 20262027,
    "team_id_source": "wgo_game_team",
    "materialized_at": "2026-10-02T15:30:31.664103+00:00"
  },
  "freshness": {
    "maximum": "2026-10-02T15:30:31.664103+00:00",
    "minimum": "2026-10-02T15:30:31.664103+00:00"
  },
  "duplicate_groups": {
    "view": 0,
    "internal": 0
  },
  "legacy_checksum": "7e6c4e5b760fc0001f36d89ba174e2c1",
  "parent_reported_full_nonidentity_checksum": "884755471d733ed557fde548ac219c7d",
  "resolver": {
    "roles": [
      {
        "role": "anon",
        "execute": true
      },
      {
        "role": "authenticated",
        "execute": true
      },
      {
        "role": "service_role",
        "execute": true
      }
    ],
    "settings": [
      "search_path=\"\""
    ],
    "volatility": "s",
    "public_execute": false,
    "security_definer": false
  },
  "cron": {
    "jobid": 272,
    "active": true,
    "command": "REFRESH MATERIALIZED VIEW internal_stats.goalie_stats_unified;",
    "jobname": "daily-refresh-goalie-unified-matview",
    "schedule": "05 9 * * *"
  },
  "checks": {
    "column_contract": "passed",
    "existing_oids_owners_acls_options": "passed",
    "other_view_definitions": "passed",
    "indexes_unchanged_valid_ready": "passed",
    "public_internal_targets_identical": "passed",
    "legacy_checksum_unchanged": "passed",
    "no_active_refresh": "passed"
  },
  "worker_production_mutations": 0,
  "parent_reported_refresh_count": 1
}
```

The isolated regression suite remains PostgreSQL 17.11 evidence; the approved
production apply and independent postflight now provide PostgreSQL 15.1
acceptance evidence. Production-scale profiling was not performed. The 10,056
legacy fallback rows remain historically unverified; unchanged checksum does
not establish season-correct identity. Website/projection effects and the next
scheduled cron outcome were not verified. Rollback or further production
changes still require separate owner approval.
