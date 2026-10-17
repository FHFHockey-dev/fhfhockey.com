# Real isolated PostgreSQL verification — accepted V2

**12/12 real PostgreSQL17.11 cases passed**, command exit0, against accepted `FROZEN-V2.json` SHA256 `2515e4b9e1391484656cf6a0a81d8f74c3ed6589d6309532df95edee2e8ebc41`. The exact proposed SQL SHA256 is `2175a73ba14f776547303721ec06554a65fe6e32b00882a5a18e53c97eff4570`. All 22 accepted packet hashes, six installed executable hashes and three fixture-file hashes matched before/after execution. The peer's V2 engineering acceptance remains unchanged; no implementation correction emerged from this run.

The original sandbox attempt failed at initdb's SysV shared-memory creation and ran zero cases. It remains preserved in [EXECUTION-RESULT.json](postgres-preparation/EXECUTION-RESULT.json). A later explicit instruction authorized use of the supported per-command approval/escalation mechanism for the same bounded runner. That command ran successfully; there was no security-setting change, installation, alternate shared-memory mechanism, Docker/container workaround, existing database or production credential.

The runner created only `/tmp/fhfh-schedule-pg-vdyzvm__`, with separate data/socket directories, mode0700 ownership checks, an allowlisted environment and TCP disabled. It loaded synthetic supporting roles/teams/weeks, the pinned repository table definition and the exact accepted prerequisite SQL into a new `roster_schedule_fixture` database. Three clients verified the database name, actual owned data directory, Unix-socket transport and empty listen_addresses. No provider/production HTTP request occurred.

| Real engine case | Result |
| --- | --- |
| READ COMMITTED delayed older FUT after newer LIVE commit | Passed: whole-scope stale no-op; newer state/clock retained |
| REPEATABLE READ older snapshot after newer commit | Passed: newer state retained; no stale success |
| SERIALIZABLE older snapshot after newer commit | Passed: newer state retained; no stale success |
| Equal-clock conflicting replay | Passed: zero-change stale no-op |
| Mixed stale existing/new-game batch | Passed: no otherwise-new game inserted |
| Shared transaction lock contention | Passed: RPC busy no-op and direct/manual statement rejected |
| Newer recurring commit → older direct/manual ON CONFLICT | Passed: row trigger rejected stale statement |
| Newer direct/manual commit → older recurring RPC | Passed: newer state retained |
| Late stale row in direct/manual batch | Passed: earlier tentative row update rolled back |
| Newer identity stored outside refreshed date range | Passed: stale moved incoming game rejected |
| Missing cached identity | Passed: rejected without schedule changes |
| Anonymous/authenticated RPC and mutation permissions | Passed: denied; service-role fixture used the boundary |

The runner then called `pg_ctl stop` only for its owned data directory, received **server stopped**, and removed only that temporary tree. Its absence was verified separately. The earlier failed attempt's owned tree is also absent. No unrelated data was deleted.

Full structured results, cleanup proof, exact test names and evidence hashes are in [ESCALATED-EXECUTION-RESULT.json](postgres-preparation/ESCALATED-EXECUTION-RESULT.json). [escalated-execution.log](postgres-preparation/escalated-execution.log) records the complete result; per-step startup/schema/case logs and isolation preflight are retained under [execution-evidence/fhfh-schedule-pg-vdyzvm__](postgres-preparation/execution-evidence/fhfh-schedule-pg-vdyzvm__/).

This is real engine verification of the prepared transaction/trigger matrix. It does not prove HTTP acknowledgement behavior, native route/auth/final-audit wrapper outcomes, provider freshness, production role/schema parity, deployed statement cancellation, report delivery or release/activation readiness. Existing model/native test evidence keeps its original scope. No application patch, production DDL, recurring job, credential change, release, build or deployment was applied. The accepted frozen proposal and original rejection evidence remain byte-for-byte preserved.
