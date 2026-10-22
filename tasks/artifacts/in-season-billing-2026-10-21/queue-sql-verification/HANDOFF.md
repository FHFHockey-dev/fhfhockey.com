# Frozen queue SQL — executed PostgreSQL verification

**Passed: 14 check groups against real PostgreSQL 17.11 (Homebrew).** No application, test-source or schema-source files changed. All seven correction hashes matched before and after execution. The temporary server is stopped.

## Target isolation and scope

- New cluster: `/tmp/fhfh-queue-sql-v5pk45ug/data`; private parent mode `0700`.
- Only TCP binding: `127.0.0.1:65447`; private local socket in the same task directory.
- New database: `fhfh_queue_check`; local fixture owner `queue_owner`. No passwords, Stripe keys or other credentials were read/changed. Temporary local trust authentication was confined to this disposable loopback cluster.
- Before creating the database, the harness checked the server's actual host, port, data directory, listen address, empty public schema and absence of the target database. It checked host/port/database before each subsequent fixture query/write.
- Minimal SQL Auth stubs, three NOLOGIN fixture roles and exactly two synthetic user records were used. This is not a new GoTrue/HTTP Auth test.
- Applied the unchanged prerequisite `20260927104934_in_season_access_workspace.sql` and complete frozen `20261021210000_in_season_sandbox_billing.sql` **only to this newly created disposable database**. No retained earlier test database, hosted database or production database was accessed or updated.

## Executed assertions

[RESULTS.json](RESULTS.json) records every check group and exact source hashes. The run verified:

1. Private fresh cluster identity and loopback binding before writes.
2. New target database and empty public schema.
3. Successful execution of the unchanged prerequisite and full frozen billing migration.
4. Empty queue behavior.
5. An unresolved retry retains running status and its snapshot; its active lease cannot be reclaimed.
6. Limits 1 and 20 are respected, urgent work precedes older retries, and future/actively leased/done/cancelled jobs are excluded.
7. Limits 0 and 21 are rejected.
8–11. Four bounded batches execute real listing/claim/snapshot RPCs and rotate failed stop jobs while excluding active leases.
12. The synthetic cutoff job reaches completion; failed stops and the unknown retry remain running; every original `due_at` is unchanged.
13. Anonymous queue access is denied.
14. All seven frozen correction source hashes remain unchanged.

The queue had **36 synthetic jobs**: 25 older retries, six failing stops, one urgent cutoff and four exclusion controls. Batch size was two:

| Invocation | Selected jobs |
|---|---|
| 1 | `stop-01`, `stop-02` |
| 2 | `stop-03`, `stop-04` |
| 3 | `stop-05`, `stop-06` |
| 4 | `cutoff`, `stop-01` |

The actual RPCs issued and fenced the leases. To avoid waiting a minute between batches, only synthetic failed-job `lease_until` values were shifted back 61 seconds after active-lease exclusion was verified. Server time, function definitions and all due dates stayed unchanged. This proves the actual SQL selection and expiry-state behavior, not elapsed-time scheduling or a deployed worker.

Completing `cutoff` here means completing its **synthetic queue job through the real fenced finish RPC**. No Stripe invoice inventory, cancellation, refund, payment or provider operation occurred. A wrong finish token was rejected before the valid token completed the cutoff job.

## Commands and receipts

Commands ran from `/Users/tim/Code/fhfhockey.com` using Node 22.11.0/npm 10.9.0 and the already installed PostgreSQL 17.11 server binaries:

```sh
/opt/homebrew/opt/postgresql@17/bin/initdb -D /tmp/fhfh-queue-sql-v5pk45ug/data -U queue_owner --auth-local=trust --auth-host=trust --encoding=UTF8 --no-locale
/opt/homebrew/opt/postgresql@17/bin/pg_ctl -D /tmp/fhfh-queue-sql-v5pk45ug/data -l /tmp/fhfh-queue-sql-v5pk45ug/postgres.log -o '-h 127.0.0.1 -p 65447 -k /tmp/fhfh-queue-sql-v5pk45ug -c unix_socket_permissions=0700 -c max_connections=10 -c shared_buffers=16MB' -w -t 20 start
node tasks/artifacts/in-season-billing-2026-10-21/queue-sql-verification/VERIFY-QUEUE.cjs
/opt/homebrew/opt/postgresql@17/bin/pg_ctl -D /tmp/fhfh-queue-sql-v5pk45ug/data -m fast -w -t 20 stop
```

[VERIFY-QUEUE.cjs](VERIFY-QUEUE.cjs) contains all exact SQL, RPC calls, isolation guards and assertions. [TARGET.json](TARGET.json) contains only nonsecret local target metadata.

Setup corrections, retained transparently:

- The shell's default `initdb` belonged to client-only libpq 18.3 and lacked its server binary. Switched to the already installed PostgreSQL 17.11 tools; no installation occurred.
- Restricted execution blocked a loopback socket probe and PostgreSQL shared-memory bootstrap. Bounded execution escalation for the approved disposable instance succeeded; no approval rejection remains.
- The first harness run reached five passing check groups, then stopped because a parameterized query contained two statements. Only the artifact harness was corrected by splitting that query. [FAILED-RESULT.json](FAILED-RESULT.json) preserves the failure. After rechecking private cluster identity and zero active target connections, [RESET-DISPOSABLE.cjs](RESET-DISPOSABLE.cjs) removed only this task-created failed test database and its fixture roles. The complete corrected run then started from an empty new database. No application/schema correction was needed.

## Cleanup and frozen files

[CLEANUP.json](CLEANUP.json) confirms shutdown at **2026-10-21 19:58:16 UTC**:

- `pg_ctl status` returned exit 3, “no server running.”
- TCP connection to `127.0.0.1:65447` returned `ECONNREFUSED`.
- No `postmaster.pid` remained.
- Private data was retained; no shared objects or older test databases were deleted.

[SOURCE-HASHES-BEFORE.json](SOURCE-HASHES-BEFORE.json) and [SOURCE-HASHES-AFTER.json](SOURCE-HASHES-AFTER.json) are identical for the seven files in the [frozen correction manifest](../job-isolation-failure-identities/CHANGED-FILES.json). This increment adds only verification artifacts and report/diary updates.

No production/configuration action, external Stripe/provider call, credential change, new sandbox checkout case, commit, push or deployment occurred. Independent review continues against the unchanged source. Real provider adjustment/recovery and active trigger/configuration remain separate release work; monthly public checkout remains disabled.
