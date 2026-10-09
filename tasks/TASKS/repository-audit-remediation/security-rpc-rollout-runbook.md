# Security RPC rollout runbook

Prepared: 2026-08-19  
Target project: `fyhftlxokyjtpndbkfse` (`fhfhockey.com`)  
Authority: AUDIT-TASK-001 and AUDIT-TASK-002

## Scope and authorization boundary

This runbook covers exactly two independently deployable ACL-only migrations:

| Task | Migration | SHA-256 |
| --- | --- | --- |
| AUDIT-TASK-001 | `supabase/migrations/20260820013120_revoke_execute_sql_browser_roles.sql` | `fb2d6df0e1ea360bb49cc27db443f5924d18654698a25c0f712016703ac4415b` |
| AUDIT-TASK-002 | `supabase/migrations/20260820013124_revoke_truncate_rolling_metrics_browser_roles.sql` | `f037ac34a8a698d828ce4bb05210f7ca8964e4891c284f8cc5502a6fc4c3ce2c` |

Applying either migration is a production mutation and requires explicit authorization naming the migration. Authorization for one does not imply authorization for the other, later migrations, a general migration push, or any RPC invocation.

The routines must never be called during preflight or verification. Do not print environment values, use a browser-role request as a probe, run unrelated migrations, or inspect application data.

## Read-only preflight receipts

The 2026-08-19 catalog check found:

- `public.execute_sql(text)` is SECURITY DEFINER, owned by `postgres`, has pinned search path `pg_catalog, public, extensions, pg_temp`, and grants EXECUTE to `PUBLIC`, `anon`, `authenticated`, `postgres`, and `service_role`.
- `public.truncate_rolling_player_game_metrics()` is SECURITY DEFINER, owned by `postgres`, has pinned search path `public`, and grants EXECUTE to `anon`, `authenticated`, `postgres`, and `service_role`.
- The deployed migration ledger ends at `20260815023132_espn_fantasy_private_beta`; neither migration listed above is applied.

A resumed read-only check on 2026-08-26 produced the same ACL and migration-ledger state. PostgreSQL rendered the arbitrary-SQL routine identity as `public.execute_sql(sql_statement text)`; its callable type signature remains `public.execute_sql(text)`. Neither routine was invoked.

The latest read-only check on 2026-08-29 confirms both routines still grant effective EXECUTE to `anon` and `authenticated`, with `service_role` also retained. The Production ledger now contains 45 versions through `20260829161013`, but neither ACL migration in this runbook is present. The two Production-only ESPN versions `20260829133258` and `20260829133637` lack active source files and are tracked as a separate source-retention discrepancy. No routine was invoked or database state changed during this check.

Immediately before an authorized rollout, repeat the following catalog-only query and stop if the signatures, owner, SECURITY DEFINER state, search path, or grantee set differs:

```sql
select
  p.oid::regprocedure::text as function_identity,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  p.prosecdef as security_definer,
  p.proconfig as configuration,
  pg_get_userbyid(p.proowner) as owner_name,
  coalesce(grantee_role.rolname, 'PUBLIC') as grantee,
  privilege.privilege_type,
  privilege.is_grantable
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(
  coalesce(p.proacl, acldefault('f', p.proowner))
) privilege
left join pg_roles grantee_role on grantee_role.oid = privilege.grantee
where n.nspname = 'public'
  and p.proname in (
    'execute_sql',
    'truncate_rolling_player_game_metrics'
  )
order by function_identity, grantee;
```

Also confirm the exact source hash above and verify that the target version is still absent from the deployed migration ledger. Source presence or migration-authority classification is not deployment authorization.

## Authorized application sequence

Apply one exact migration through the repository's normal migration mechanism. Do not paste or adapt its statements into a broader batch. A successful application must be followed immediately by the post-check before the second migration is considered.

Expected post-state for each affected signature:

- `postgres`: EXECUTE retained through ownership/ACL.
- `service_role`: explicit EXECUTE retained.
- `PUBLIC`: no EXECUTE.
- `anon`: no EXECUTE.
- `authenticated`: no EXECUTE.

Repeat the catalog query above and verify the applied migration version appears exactly once. This proves ACL state without executing the routine.

## Stop and rollback rules

Stop without changing anything further if:

- a function signature, owner, SECURITY DEFINER flag, or search path differs;
- a previously unknown non-browser grantee or evidenced consumer appears;
- the migration version is already present but the ACL does not match;
- the migration mechanism would also apply any unapproved migration;
- the post-check cannot be performed truthfully.

Do not restore `PUBLIC`, `anon`, or `authenticated` access as a generic rollback. If an evidenced privileged non-browser consumer fails, prepare a new, separately reviewed forward migration granting EXECUTE only to that exact operator role. Never edit an applied migration.

## Operator receipt

Record one receipt per migration:

| Field | Value |
| --- | --- |
| Task and migration | Pending |
| Explicit authorization reference | Pending |
| Target project ID | `fyhftlxokyjtpndbkfse` |
| Preflight timestamp and ACL summary | Pending |
| Verified source SHA-256 | Pending |
| Apply mechanism and result | Pending |
| Applied-ledger version observed | Pending |
| Post-check timestamp and ACL summary | Pending |
| RPC invoked during verification | Must remain `No` |
| Unexpected consumer or rollback action | Pending / None |

Until every applicable Pending field has authoritative evidence, AUDIT-TASK-001.4 or AUDIT-TASK-002.4 remains incomplete.

## Task #1 owner-review update — 2026-10-02

Task #1 reuses AUDIT-TASK-001's exact existing migration above; no new migration
or application change is needed. AUDIT-TASK-002 is outside this request. Production
application remains unauthorized. The unchanged Task #1 migration hash was
rechecked as `fb2d6df0e1ea360bb49cc27db443f5924d18654698a25c0f712016703ac4415b`.

### Current evidence and dependencies

The latest audit evidence was located through thread
`01a0f9ad-676d-7352-9510-0110534e10f7`, with local receipts under
`/tmp/fhfh-pipeline-audit-20261001/` (`acl-query.json` and the audit report).
This update uses the existing finding rather than repeating the pipeline audit.
A fresh read-only catalog check at **2026-10-02 00:22:35 UTC** confirmed:

- Exactly one `public.execute_sql` overload: `(sql_statement text) RETURNS void`.
- Owner `postgres`: BYPASSRLS true, superuser false; SECURITY DEFINER true.
- Search path `pg_catalog, public, extensions, pg_temp`; body remains
  `BEGIN EXECUTE sql_statement; END;` without caller authorization or allowlist.
- EXECUTE ACL `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`;
  effective EXECUTE true for `anon`, `authenticated`, and `service_role`.
- Version `20260820013120` is absent from `supabase_migrations.schema_migrations`.
- No catalog dependencies referencing the routine, no other function/procedure
  bodies containing `execute_sql`, and no `cron.job.command` containing that name.
  A role-membership check found no memberships for `anon` or `authenticated`;
  `service_role` is a member of `pgsodium_keyholder`.

These are catalog observations, not evidence of public Internet exploitability.
Production exposed schemas, gateway restrictions, JWT-role mapping and actual RPC
reachability remain unverified. No RPC was invoked. Text/catalog searches cannot
prove the absence of dynamic SQL, off-repository scripts or externally scheduled
HTTP callers.

| Evidenced caller | Privilege boundary | Expected impact |
| --- | --- | --- |
| `web/pages/api/v1/db/upsert-csv.ts:432` | `adminOnly` checks the user/cron boundary and attaches the server service-role client, including for authenticated admins | Retained; the RPC uses service_role, not the user's authenticated client |
| `web/scripts/cron-audit-runner.ts:262` | Creates its client with `SUPABASE_SERVICE_ROLE_KEY` | Retained |
| `web/scripts/sql-refresh-validation.ts:22` | `loadSqlRefreshConfiguration` requires `SUPABASE_SERVICE_ROLE_KEY` | Retained |
| `web/scripts/sql-refresh-team-power-validation.ts:21` | Same required service-role configuration | Retained |
| `web/lib/cron/sqlRpcExecution.ts:114` | Generic injected-client helper; the three scripts above are the located production-source callers | Role is determined by caller; all located callers use service_role |
| Generated types, migrations and tests | Definitions/contracts rather than runtime callers | No source change needed |

No browser-role consumer was found in the bounded source scan of `web/`,
`functions/`, `supabase/`, `migrations/`, and `sql/`. The retired `webhooks/`
directory is absent. Credential values were neither read nor printed. Client
configuration was inspected statically; maintenance scripts and endpoints were
not executed. Unknown consumers using browser roles will be denied by design;
their existence would require an explicit replacement, not restoration of public
SQL execution. The service-role capability remains powerful and unchanged.

### Exact proposed SQL and safe verification

The intended mechanism is **psql with `--single-transaction` and
`ON_ERROR_STOP=1`**, using the prepared
[`task1-execute-sql-approved-apply.psql`](task1-execute-sql-approved-apply.psql).
It imports only the existing migration, asserts the effective privilege
postconditions, and inserts version `20260820013120`, its name and both statements
into the existing Supabase migration ledger **in the same transaction**. A ledger
lock (with a five-second timeout) serializes other ledger writers; an existing target version aborts rather
than being overwritten. A SQL error aborts the transaction, so ACL changes and
ledger insertion commit together or neither commits. Connection loss requires a
catalog/ledger recheck before any retry because the commit outcome may be unknown.
No automatic retry is prepared. No general `db push` or MCP-generated timestamp
is used. The wrapper has been prepared and statically reviewed, **not executed**.

Production ledger column metadata was checked read-only: `version text NOT NULL`,
`name text`, and `statements text[]` support this exact insert; other columns are
nullable. The owner-approved connection must have function-owner-equivalent ACL
authority and ledger lock/insert permission. This has not been exercised. After
explicit approval and fresh catalog/hash/connection preflight, the operator runs
from repository root (the connection service must already exist and be verified
to target `fyhftlxokyjtpndbkfse`; do not create credentials or print connection
secrets):

```sh
psql -X --single-transaction -v ON_ERROR_STOP=1 \
  --dbname="service=${TASK1_APPROVED_PG_SERVICE:?Select a verified existing production libpq service}" \
  -f tasks/TASKS/repository-audit-remediation/task1-execute-sql-approved-apply.psql
```

The service name is an operator-selected existing libpq service, not a literal
placeholder to execute. If no approved connection is available, stop for the
owner to provide/select existing access; do not fall back to another database or
silently substitute a different apply mechanism.

```sql
revoke execute on function public.execute_sql(text)
from public, anon, authenticated;

grant execute on function public.execute_sql(text)
to service_role;
```

This is the minimum privilege reduction compatible with the evidenced callers.
It preserves definition, owner, search path and service/operator access. A missing
`(text)` signature raises an error; it is not silently skipped. Before applying,
recheck the full definition and the grantee set against the receipt above and
stop on drift. Capture the following catalog-only result both before and after;
require exactly one row. No supplied SQL is executed by this query:

```sql
select now() as checked_at,
  p.oid::regprocedure::text as identity,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as returns,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer, p.proconfig as configuration,
  md5(pg_get_functiondef(p.oid)) as definition_fingerprint,
  p.proacl::text as raw_acl,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute,
  has_function_privilege('postgres', p.oid, 'EXECUTE') as owner_execute,
  exists (
    select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) as public_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'execute_sql'
  and p.oid = to_regprocedure('public.execute_sql(text)');

select version, name from supabase_migrations.schema_migrations
where version = '20260820013120';
```

Expected after application: anon/authenticated/PUBLIC EXECUTE **false**;
service_role/postgres EXECUTE **true**; identity, definition fingerprint,
SECURITY DEFINER, owner and configuration unchanged; exact migration version
recorded once. Raw ACL should contain only owner and service_role EXECUTE for the
currently observed grantee set. Effective privilege checks also catch unexpected
inherited access. Stop if any postcondition fails; do not probe the RPC.

### Verification and recovery

- Extended the nearest migration test to freeze the entire two-statement ACL-only
  scope, including its exact signature. Focused run passed **1/1** (18 skipped).
- The combined four-file Vitest run passed **32/33**: all 14 caller/helper tests
  and 18/19 migration-authority tests passed. The failure is the existing registry
  mismatch for five unrelated active migrations (`20260919005608`,
  `20260919005622`, `20260919005852`, `20260923184653`, `20260927104934`). Those files
  and registry were unchanged by this task; this is not a fully passing authority
  suite and remains separate owner reconciliation work.
  Specifically, directory enumeration finds **76 SQL files** while
  `migration-authority.json` lists **71**; none of its source files is missing.
  The failure occurs at the initial filename equality check, before that test's
  per-record hash loop. Task #1 is already registered at order 43 with the exact
  verified hash and an `unknown` deployment marker; the fresh production ledger
  establishes that it is unapplied. The stale 71-file authority expectation
  limits confidence in repository-wide migration inventory and rules out treating
  the full authority suite as green. It does not invalidate the directly verified
  Task #1 bytes/catalog finding or cause this single-file wrapper to apply any of
  the five unregistered migrations. Classifying those files needs their owners'
  receipts and is outside this ACL-only fix.
- Added `supabase/tests/execute_sql_acl.sql`: psql-only, rollback-only fixture for
  a fresh local database named `task1_execute_sql_acl_test` and fresh roles. It
  imports the exact migration twice, checks effective and PUBLIC privileges,
  preserves definition/ownership/configuration and an unrelated function's ACL,
  and never invokes either fixture routine. Runtime execution is **blocked**:
  Docker has no daemon socket and no PostgreSQL server binary is installed here.
  Do not substitute a shared database. With a provisioned empty local database,
  use `psql -X -v ON_ERROR_STOP=1 -d task1_execute_sql_acl_test -f supabase/tests/execute_sql_acl.sql`
  from repository root, using a local superuser and an explicitly local connection.
- `git diff --check` passed. No application TypeScript changed; no full type/lint
  suite, build, deployment, RPC invocation or production write was performed.

Before commit, an application failure should roll back the entire ACL transaction
and its ledger entry; verify the observed state instead of assuming success or
retrying blindly. After commit, retain the restrictive ACLs. If a legitimate
operator job reports permission denied, first identify its actual database role
and correct a misconfigured service client. This change should not break the
known service-role paths. If a previously unknown operator role truly needs
access, prepare a separate forward migration granting EXECUTE only to that exact
reviewed non-browser role, without grant option; obtain action-time approval and
repeat effective privilege checks. Do not restore the captured raw ACL wholesale,
grant PUBLIC/anon/authenticated, edit the applied migration, or run historical
repairs as recovery. An application-level regression can be paused or rolled back
while keeping the database denial in place.

**Next approval:** authorize applying only migration `20260820013120` with the
frozen hash above to project `fyhftlxokyjtpndbkfse`, including atomic ledger
recording and catalog-only post-verification. That approval does not authorize
any other migration, job invocation, backfill, deployment or recovery grant.
Before that action, rerun exact preflight and verify the approved psql connection
and privileges; the isolated runtime fixture should be run when a local server is
available, or its unverified status explicitly accepted by the owner. Task #1 is
review-ready locally; deployed remediation remains pending.

Guidance checked: [Supabase function privileges](https://supabase.com/docs/guides/database/functions#function-privileges)
and [anon SECURITY DEFINER advisor](https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0028_anon_security_definer_function_executable).
The changelog Markdown fetch was unavailable; the HTML changelog was checked
instead. No reviewed change required altering this existing ACL proposal.

### Completion decision after owner-requested verification pass

**At this checkpoint Task #1 was prepared for review, but runtime verification
was not complete to Chef's satisfaction. This is superseded by the passing local
execution receipt below.** A bounded installed-runner inventory found Homebrew
`libpq` client tools (`initdb`/`pg_ctl` exist, but `postgres` does not), no
Postgres.app, no active Docker daemon, and an existing **stopped** Colima/Lima VM.
With `LIMA_HOME=/Users/tim/.colima/_lima`, `limactl list` confirmed the existing
`colima` instance is Stopped (aarch64, vz, 2 CPUs, 4 GiB). No instance was started,
no software/image was installed or downloaded, and no infrastructure changed.

The smallest next setup step is for the owner to start the existing default
Colima instance (`colima start`), or explicitly authorize that local runtime
startup. After startup, inspect Docker's cached images once. If a PostgreSQL
image is already cached, use a disposable isolated container/database to run the
ACL fixture and actual wrapper. If no suitable image is cached, stop and request
approval for that exact image download; do not create a cloud database. The
startup command is an owner action, not a command executed in this task; its
effect on existing local VM configuration belongs to that setup approval.

Still unexecuted: fixture assertions, actual wrapper first-run/second-run
behavior (second run must reject the existing ledger receipt without changing
state), and a safely forced validation/ledger failure proving ACL and ledger
rollback together. Also compare function definition and effective operator/browser
privileges before/after each case. Use fixture-only roles and a dummy migration
ledger; never invoke the real production function. Static review and psql's
documented transaction semantics do not substitute for these runtime cases.

One explicitly requested focused read-only reviewer inspected the migration,
wrapper, fixture, added assertion and this Task #1 section. It found **no concrete
blocking security defects**, confirmed the atomicity/scope design, and called out
that the current fixture tests the ACL SQL rather than executing the wrapper.
Chef reviewed that conclusion against the files and retains the runtime blocker.
The reviewer was requested as GPT-6.1/low under the task's GPT-6.1/Medium assignment;
independent actual model/effort metadata was not exposed by the available runtime,
so those settings are not claimed as independently verified. No broad suite was
rerun and no unrelated registry entry was changed. Task #2 was not started.

The five missing registry entries remain exactly the ones listed above. The
wrapper imports one explicit file and writes one explicit version; it neither
reads the registry nor enumerates migration directories, so those missing
registrations are not dependencies of this application mechanism. Task #1's
existing registry record, independently rechecked source hash and absent deployed
version establish its scoped identity; repository-wide authority remains a warning.

**Next decision is local runner setup, not production application.** The narrow
production approval described above remains a separate, later action-time gate
after runtime verification or an explicit owner decision accepting its absence.

### Authorized isolated execution — current readiness

The owner subsequently approved starting the existing Colima VM and using a
cached PostgreSQL image. **Task #1 preparation and scoped verification are now
complete to Chef's satisfaction; production remediation remains unapplied and
requires separate action-time approval.** The focused review found no blocking
defects; its previously outstanding runtime cases now passed.

Executed only in disposable container `task1-acl-verification-20261002`, using
cached `public.ecr.aws/supabase/postgres:15.8.1.085` (`af083ef64d04`), with networking
disabled, no published ports, and temporary PostgreSQL storage. No image or
software download, production call, or invocation of any `execute_sql` routine
occurred. Test routines raise an exception if ever called; checks inspect catalog
metadata and grants. The durable [verification receipt](task1-local-verification.json)
includes actual psql outputs, before/after snapshots and cleanup; raw local command
logs and the test harness remain under `/tmp/task1-acl-verification/`.

| Isolated case | Actual result |
| --- | --- |
| Existing ACL fixture, including two exact migration imports | Passed; anon/authenticated/PUBLIC denied; owner/service retained; definitions/configuration and sentinel ACL preserved |
| Fixture rollback cleanup | Passed; fixture roles and routines absent afterward |
| Actual prepared wrapper, first run | Exit 0; anon/authenticated/PUBLIC changed true→false; service_role/postgres stayed true; definition unchanged; one exact version/name/two-statement ledger receipt |
| Actual wrapper, second run | Expected exit 3 on existing receipt; ACL, definition and ledger identical afterward |
| Forced safe validation failure | Gave fixture anon inherited service-role access; wrapper detected effective access and exited 3; full pre/post snapshot identical, zero ledger rows; test membership then removed |
| Forced safe ledger failure | Fixture ledger CHECK constraint rejected the target version after ACL statements; expected exit 3; full pre/post snapshot identical, zero ledger rows |

The wrapper's repeated application is intentionally fail-closed, while the
underlying ACL statements are idempotent. Both failure tests exercised the real
wrapper with `--single-transaction` and `ON_ERROR_STOP=1`, proving its local
transaction behavior rather than inferring it from documentation.

Cleanup removed only the labeled disposable container and its own volumes/data.
Starting Colima had automatically resumed an unrelated 11-container Supabase
stack. Their databases were not queried and no container/configuration changes
were made to them; Colima was **left running** to avoid stopping unrelated
workloads. The Docker context was restored
from Colima's automatically selected context to its original `default`. No
unrelated resource was stopped or removed.

The five-file registry mismatch is still an unrelated repository-wide warning;
the exact single-file wrapper does not depend on that registry. No broad suites
were rerun. Remaining production uncertainties are off-repository/dynamic
consumers, production API reachability, and the approved operator connection and
its privileges; local isolated tests do not prove those. Immediately before any
approved apply, recheck the exact source hash, function/ACL metadata, absent
ledger version and target connection. Approval scope remains only migration
`20260820013120` on `fyhftlxokyjtpndbkfse`, its atomic ledger lock/insertion, and
catalog-only post-verification. Recovery retains browser denial; unexpected
operator access needs a separately reviewed narrowly scoped grant.

### Action-time approval and fresh preflight — application blocked

The owner explicitly approved applying only migration `20260820013120` to
production project `fyhftlxokyjtpndbkfse`, using the reviewed atomic mechanism
with ledger recording and catalog-only pre/post checks. This approval remains
valid for a safe continuation of that exact action; no repeat migration approval
is requested here.

At **2026-10-02 01:45:21 UTC**, a fresh read-only connector catalog query to that
exact project found the same single `(sql_statement text) RETURNS void` function,
postgres ownership/BYPASSRLS, SECURITY DEFINER, pinned search path, unguarded body,
and exact PUBLIC/postgres/anon/authenticated/service_role EXECUTE ACL as reviewed.
Effective anon/authenticated/service execution remained true; the target ledger
version was absent. Browser roles still had no role memberships; service_role
retained only the previously observed pgsodium_keyholder membership. The local
migration hash was rechecked and matched the frozen hash above.

**No transaction was attempted.** The reviewed psql mechanism cannot currently
connect through an existing approved connection: `PGSERVICE`, `PGSERVICEFILE`,
`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `DATABASE_URL`,
`POSTGRES_URL`, `SUPABASE_DB_URL`, and `TASK1_APPROVED_PG_SERVICE` were not set in
the execution environment, and `/Users/tim/.pg_service.conf` and `.pgpass` were
absent. Only presence/absence was inspected; no credential values were exposed
or new credentials created. Read-only connector access is available, but it does
not provide the authenticated psql connection required by the approved wrapper.
No unreviewed connector apply method, generated ledger version, or credential
workaround was substituted.

The precise next setup action is for the owner to select/configure an **existing
authorized production libpq service**, authenticate locally if required, and
identify its service name through `TASK1_APPROVED_PG_SERVICE`. Do not send a
password/token in chat. Once access is available, verify the exact target and
repeat fresh catalog/hash/ledger preflight, then continue the already-approved
single transaction. If credentials or the mechanism need a material change,
stop for that separate setup decision. Production remediation remains pending;
no rollback was needed because no mutation occurred. Task #1 stays open.

### Connection handoff and locally tested SQL-only adapter

The connection-presence check still found no configured libpq service, connection
environment or user service/password files. The smallest original-route handoff
is: **select an existing authorized production libpq service and authenticate
locally, then set `TASK1_APPROVED_PG_SERVICE` to its service name in the execution
environment.** No password/token should be sent in chat, and no new credential
or persistent access change is requested. A local password/MFA window belongs to
the owner. If no existing service is available, stop for a separate connection
setup decision rather than reading passwords from project files.

To offer a bounded alternative without credential changes, prepared
[`task1-execute-sql-transport-adapter.sql`](task1-execute-sql-transport-adapter.sql).
It is the original wrapper with only psql `\\set` removed, the exact `\\ir` migration
expanded byte-for-byte, and explicit SQL BEGIN/COMMIT added. It preserves the
five-second lock timeout, ledger lock, duplicate-version rejection, exact two
ACL statements, effective privilege assertion and exact ledger receipt. No new
framework or migration version is introduced; the original psql wrapper is unchanged.

Executed this adapter as **one psql `-c` SQL batch** against a separate disposable,
network-disabled container using the cached PostgreSQL image. All four cases
passed: successful deny/retain/unchanged-definition/exact-ledger postconditions;
repeat rejection with unchanged snapshot; safe forced validation failure with
full rollback; safe forced ledger failure with full rollback. Single-command psql
errors exit 1, unlike the original file-mode exit 3; the initial test-harness
expectation was corrected, then the bounded cases passed. An executor reconnect
was needed once. Neither event caused a production write. Both disposable
containers used for the attempt and corrected run were removed; unrelated
containers and VM/context settings were untouched by this adapter pass.

The [adapter verification receipt](task1-transport-adapter-verification.json)
contains source hashes, complete local command/results and cleanup. This proves
local SQL semantics, **not Management API HTTP transaction/ledger equivalence**.
The connector's `execute_sql` uses Management API database/query rather than
calling the dangerous database helper, but that transport's full-batch and error
handling has not been exercised by these tests. `apply_migration` cannot select
the original version and is not a drop-in substitute. Parent must review the
adapter and that transport limitation before proposing any alternate production
execution; no alternate production payload was run and no silent substitution
is authorized by this preparation. The original approval is retained for the
original tested mechanism. Task #1 remains pending connection or transport decision.

Before this bounded work, the usage tool reported Codex weekly **59% remaining**
and reserve **97% remaining**, differing from the parent's earlier 20% report.
No assumption about an unavailable pool was used to broaden scope. Only local
adapter cases were run; no broad suites, additional audit or reviewer delegation
occurred in this pass.

### Final-review candidate: one server-side statement

Prepared [`task1-execute-sql-single-statement.sql`](task1-execute-sql-single-statement.sql),
SHA-256 **`f358159118b11739da576fde18215d74c93615924ff5acefc1d7f144a4c56607`**.
It contains one DO block with the original five-second local lock timeout, ledger
lock and duplicate-version check, exact REVOKE/GRANT semantics, effective privilege
validation, and original-version/name/two-statement ledger insertion. There is no
internal COMMIT, exception suppression or helper-function invocation. PostgreSQL's
single-statement transaction provides atomicity without relying on a transport
splitting or preserving a multi-statement session. The original migration hash
remains `fb2d6df0e1ea360bb49cc27db443f5924d18654698a25c0f712016703ac4415b`.

All four isolated local cases passed again using this exact DO payload: expected
grant/receipt success with unchanged definition, safe repeat rejection with
unchanged state, forced effective-privilege validation failure rollback, and
forced ledger failure rollback. Tests used only the cached image and a disposable
network-disabled container, which was removed afterward. Evidence, source hashes,
full command outputs and cleanup are in
[`task1-single-statement-verification.json`](task1-single-statement-verification.json).
No broad suite, software download or unrelated workload modification occurred.

A harmless Management API probe consisting of one DO block that only checked
`current_user` against postgres/supabase_admin succeeded with result `[]`; a
separate metadata SELECT reported execution/session roles both **postgres**.
This establishes intact-statement acceptance for a no-write block, not permission
to apply a privilege-changing block through that tool. GRANT/REVOKE are DDL for
the tool's routing guidance; no DCL or DO-wrapper exemption is assumed.
**Do not apply this adapter through the raw execute_sql connector.**

Opened the project's [SQL editor](https://supabase.com/dashboard/project/fyhftlxokyjtpndbkfse/sql)
through `open_in_codex`; the result was **queued**, not confirmation of an
authenticated session. No browser inspection tool or installed agent-browser/
playwright CLI is available here to verify the user's session. No SQL was entered,
saved or run in the editor. The secure user handoff is to open that project editor
and sign in normally if requested, then confirm the correct project is visible;
do not send credentials. A reviewed SQL-editor execution or the existing tested
libpq wrapper remains the candidate application route. Parent final review and
fresh exact-target/catalog/hash/ledger preflight must precede execution; this pass
made no production permission or ledger change.

### Production closure — Task #1 complete

**Task #1 / AUDIT-TASK-001 is finished, including deployed verification.** This
supersedes the earlier pending-connection/application checkpoints. After the
owner's explicit action-time approval and fresh role/catalog/ledger preflight,
the parent applied the exact reviewed single DO through the authenticated
Supabase SQL-editor UI for `fyhftlxokyjtpndbkfse` at approximately
**2026-10-02 12:36:45 UTC**. The original migration hash and final adapter hash
above were independently rechecked locally and still match. Parent observed
Success and 7/7 verification checks true at **12:36:59.425888 UTC**.

This task independently queried only catalog/ledger metadata at
**2026-10-02 12:44:35.992233 UTC**, confirming:

- Exactly one `public.execute_sql(sql_statement text) RETURNS void` function.
- EXECUTE false for **PUBLIC, anon, authenticated**; true for **postgres,
  service_role**; raw ACL `{postgres=X/postgres,service_role=X/postgres}`.
- Owner postgres, SECURITY DEFINER, pinned search path and signature unchanged;
  definition fingerprint **`56aee99ea2e334a51b76ab93729d5cce`** matches preflight.
- Exactly one version **20260820013120** ledger row named
  `revoke_execute_sql_browser_roles`, containing exactly the two reviewed statements.

The parent reported that the initial exact Run button locator matched no button
because the UI showed Run selected. Before using that fresh locator it checked
the catalog and ledger, which remained unchanged/version absent; there was no
blind mutation retry. This child performed no production mutation. No routine
invocation, other migration or production change was part of this action.

The existing [scoped receipt](task1-single-statement-verification.json) now includes
parent application evidence and this task's independent verification. Parent
provided Library evidence IDs: screenshot
`libfile_29d07bd519308191b1e61cc9c47e304d`, JSON receipt
`libfile_4ae4e2fc64e081919754578c3a740522`.

No rollback is needed; retain the restrictive ACL. Any future operator grant
requires separate reviewed approval, never restoration of PUBLIC/browser grants.
AUDIT-TASK-001.4 alone is marked complete. AUDIT-TASK-002, migration-registry
reconciliation and all broader repository remediation gates remain unchanged.
No commits, pushes, builds, deployments or thread archival occurred here.
