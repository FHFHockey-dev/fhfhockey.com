# Isolated PostgreSQL test facility — 12 real cases passed

**Current result:** after separate authorization, the same pinned runner completed through the supported per-command escalation flow. All **12 real PostgreSQL17.11 cases passed**. Only a new private Unix-socket cluster `/tmp/fhfh-schedule-pg-vdyzvm__` was used, with TCP disabled. The server stopped successfully and that owned tree is absent. See `ESCALATED-EXECUTION-RESULT.json` and `escalated-execution.log`; the original blocked result below remains preserved. No application or production SQL/scheduler/deployment changed.

**Authorized execution update:** one new-cluster `initdb` attempt failed before server startup because its bootstrap process could not create a SysV shared-memory segment (`shmget: Operation not permitted`). The 12 cases and proposed SQL were not run. No retry, alternate shared-memory setting, permission escalation, container or existing database was attempted. The owned `/tmp/fhfh-schedule-pg-n9e0zqj1` tree was removed after the bootstrap child exited; logs and the isolation preflight remain under `execution-evidence/fhfh-schedule-pg-n9e0zqj1/`. See `EXECUTION-RESULT.json` and `authorized-execution.log`.

The installed tooling was sufficient to prepare a standalone synthetic PostgreSQL fixture, but the current security environment blocked its initialization. No persistent server/container or database client connection was started, no software/image was installed and no production credentials/configuration were loaded. The reviewed V2 packet is unchanged. The preparation and failed isolated attempt do not authorize production DDL or activation.

## Existing tools observed

| Tool | Installed path/version | What was checked |
| --- | --- | --- |
| PostgreSQL server | `/opt/homebrew/opt/postgresql@17/bin/postgres`, Homebrew 17.11 | `--version` only |
| initdb / pg_ctl / psql / createdb | Same PostgreSQL 17 bin directory; version outputs for initdb, pg_ctl, psql are 17.11 | File existence, executable bits, version/help output; no cluster/state/connect commands |
| Node PostgreSQL driver | Existing `web/node_modules/pg`, 8.16.3 | Package metadata only; no client instantiated |
| Docker / Colima | Docker 29.6.2; Colima 0.10.3 | CLI `--version` only; no daemon/container/context/image queries |

There is no missing PostgreSQL binary or driver dependency for this approach. **Startup, socket binding and real SQL execution remain unverified**, including macOS sandbox permission to start/bind a new server. Docker/Colima daemon readiness is unverified and unnecessary for the selected direct-binary procedure.

## Exact prepared commands

Safe preparation command, already run; it prints commands and validates local file pins without starting a process or connecting:

```sh
python3 tasks/artifacts/schedule-refresh-recurring-2026-10-15/postgres-preparation/run-fixture.py --plan
```

[commands-not-run.txt](commands-not-run.txt) records the complete explicit `initdb`, `pg_ctl`, `createdb`, `psql` and Node command arguments. The placeholder temporary root and ownership UUID are replaced by newly generated values only on an authorized execution. The actual directory/marker setup and environment sanitation are in [run-fixture.py](run-fixture.py).

**Future command, not run and not currently authorized:**

```sh
python3 tasks/artifacts/schedule-refresh-recurring-2026-10-15/postgres-preparation/run-fixture.py --execute-after-approval
```

The flag is an accidental-start guard, not evidence of human authorization. A later instruction must authorize this isolated synthetic execution; it does not require or grant a production migration, hosted request, recurring schedule, database-repair lease or deployment.

That future procedure will:

1. Verify `FROZEN-V2.json` SHA-256 `2515e4b9e1391484656cf6a0a81d8f74c3ed6589d6309532df95edee2e8ebc41`, all 22 packet pins and the actual schedule-table migration pin. It uses the frozen SQL; it will not silently test an edited successor.
2. Allocate a new mode-0700 `/tmp/fhfh-schedule-pg-*` root with a UUID ownership marker, separate `data/` and `socket/` paths, and the explicit PostgreSQL 17 binaries. It never supplies a preexisting data directory or inherits `PGDATA`.
3. Initialize a new cluster as synthetic `fixture_owner`, local trust within that inaccessible private socket directory, host authentication rejected. Start with **TCP disabled** (`listen_addresses=''`) and socket permissions 0700. The socket's port-number suffix is 65439; no TCP port is opened and no existing local server is used.
4. Use an allowlisted environment, `/dev/null` password/service/history files, `psql -X -w` and explicit host/port/user/database. No `.env`, `.pgpass`, `.pg_service.conf`, `.psqlrc`, production URL or production role credential is needed. Node's password value is a synthetic constant used only to suppress password-file discovery.
5. Create only synthetic supporting roles, two teams and four Yahoo weeks from [bootstrap.sql](bootstrap.sql). Load the pinned **real table migration** into this new cluster, then the frozen proposed prerequisite SQL. No production table contents are copied.
6. Run [cases.cjs](cases.cjs) using three clients. Every client verifies the new database name, actual data directory, Unix-socket transport and empty TCP listen setting before using the fixture. The runner uses the existing local `pg` package; no installation or network provider is involved.
7. Stop only the explicitly owned data directory and remove it only after confirmed stop/no PID. Preserve bounded synthetic logs under `postgres-preparation/execution-evidence/<owned-cluster-name>/` after a future run.

## Prepared real PostgreSQL cases — NOT RUN

The 12 prepared cases exercise the actual SQL rather than the earlier transaction model:

- READ COMMITTED: keep an earlier capture/transaction pending, apply newer LIVE from a second session, then submit delayed FUT. Expect a stale no-op and unchanged complete state/clock.
- REPEATABLE READ and SERIALIZABLE: establish the earlier snapshot before the newer commit. Require preserved newer state; accept an explicit stale no-op or PostgreSQL serialization failure `40001`, never a stale successful write.
- Equal-clock conflicting replay: zero applied rows, unchanged newer payload.
- Mixed stale/new-game batch: the stale identity prevents inserting the otherwise-new game.
- Held shared transaction lock: RPC returns `skipped_busy`; legacy direct statement fails `RS002`; no cache changes.
- Recurring newer → legacy/manual older direct `INSERT ... ON CONFLICT`: expect `RS001` and preserved state.
- Legacy/manual newer → recurring older: expect stale no-op.
- Legacy batch with an earlier successful row and later stale row: verify statement rollback preserves both baseline rows.
- An existing identity outside the new date range still prevents a stale moved-into-range update.
- A missing cached identity causes rejection with no changes.
- Anonymous/authenticated roles cannot call the clock/commit RPC or mutate cache; synthetic `service_role` can use the reviewed boundary.

These tests do not establish HTTP transport acknowledgement, the native auth/audit wrapper, final-audit durability, report delivery, provider response shape, production role parity or hosted cancellation/timeout behavior. The existing offline V2 tests cover lost/partial acknowledgement at their mocked boundary; native wrapper integration remains a separate prerequisite. The fixed fixture's NHL IDs/dates/teams are synthetic test values, not production reads or new freshness claims.

## Cleanup and bounds

The server is prepared with 12 connections, 16 MiB shared buffers, 1 MiB work memory, 16 MiB maintenance work memory, 32–64 MiB WAL targets, 10-second **server-level** statement/idle-transaction timeouts and a one-second lock timeout. These are isolated fixture settings, not changes to production or measured RSS/disk guarantees. Each subprocess has a deadline; no retry loop or container-image download exists.

The normal cleanup command is generated only for that new cluster:

```sh
/opt/homebrew/opt/postgresql@17/bin/pg_ctl -D /tmp/fhfh-schedule-pg-NEW-UNIQUE/data -m fast -w -t 10 stop
```

On uncertain start/stop, the launcher **preserves** the exact new directory and reports it. Do not remove it while a postmaster may still be using it, and do not use a generic `pg_ctl stop`, `brew services`, Docker/Colima stop or process-wide kill command. After confirmed shutdown, cleanup checks its UUID ownership marker and temporary-root prefix before removing only that tree. Logs stay separate. An interrupted launch must be reconciled using its printed owned path; this task created no such cluster to clean up.

Preparation verification passed: Python AST parse, Node `--check`, read-only tooling version/help, plan generation and frozen-input/executable/fixture hash verification. The initial sandbox attempt failed at `initdb` with zero cases run. The later explicitly authorized supported per-command escalation completed **12/12 real PostgreSQL cases**, then stopped and removed only its owned cluster. Both attempts' evidence is preserved separately.
