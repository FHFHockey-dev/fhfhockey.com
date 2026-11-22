# BLSH install.sql: disconnect fault tests on disposable Postgres (Nov 21, 17:17Z; 11:17 am CT)

The original hosted cause is not part of this proof; see [ORIGINAL-DISCONNECT-CAUSE.md](ORIGINAL-DISCONNECT-CAUSE.md).

Each case ran the unchanged pinned bytes (`install.sql`, sha256 `766aec3b…519b`, checked by the installer before every run).
- **Cluster:** a fresh PostgreSQL 15.19 cluster on loopback with trust auth, deleted afterwards. It has the Supabase-shaped roles and the two inherited grants.
- **Install connection:** through [fault_proxy.py](fault_proxy.py).
- **Probe:** after the attempt, [state-probe.sql](state-probe.sql) reconnected directly on a fresh connection.

Rerun with:

```bash
LC_ALL=C bash run-fault-tests.sh receipts/fault-tests
```

## How the installer decides ([install-guarded.sh](install-guarded.sh))

1. **Pre-checks.** The pinned hash must match, and a pre-probe must find no sandbox roles, schemas or memberships.
2. **Install.** One psql session first records its own backend (`INSTALL_BACKEND <pid> <backend_start>`), then runs the pinned file. Through Supavisor, `application_name` reads `Supavisor`, so the pid and start time are the identity.
3. **Reconnect.** On a fresh connection, wait (bounded) until that exact backend is no longer inside a transaction that began at or after the attempt started. Supavisor reuses backends in session mode, so a live but idle backend is not lingering.
4. **Classify.**
   - `rolled_back_clean`: nothing in the sandbox, and the catalog outside it is unchanged (narrow and full fingerprints).
   - `committed_verified`: the sandbox fingerprint equals the reference install exactly (roles, memberships, schemas, relations, columns, functions, constraints, triggers, policies, indexes and table content), and the catalog outside is unchanged.
   - Anything else is ambiguous: `ambiguous_lingering`, `ambiguous_state` or `ambiguous_probe_failed`. It means STOP, exit 4.
5. **Retry rule.** A further attempt happens only after `rolled_back_clean` and only if `MAX_ATTEMPTS` allows it. Ambiguous never retries.

Each attempt writes its own `cause.json` (psql exit, line, stderr, backend) and `verdict.json`. The retry evidence is in a separate `attempt-2/`.

## Results: 9/9 cases pass, plus 2 reference installs

**Reference installs:** both exited 0, with sandbox fingerprint `4399436c2a2f4a1a69e4953d74df1651` on two separate clusters (stable across clusters). Each has 13 tables and 39 functions.

The "Server saw" column counts install transactions, independently, from the Postgres statement log (`create role blsh_replay_owner`).

| Case | Fault | Attempt 1 | Verdict | Exit | Server saw |
|---|---|---|---|---|---|
| A | Connection reset before line 1232 is sent (no COMMIT) | psql 2, line 1232, same message as hosted | `rolled_back_clean`; outside fingerprints equal before and after | 3 (no auto retry at MAX 1) | 1 |
| B | COMMIT forwarded, server commits, reply dropped, client reset | psql 2, line 1318 (`commit;`) | `committed_verified`; fingerprint equals the reference | 0 | 1 |
| D | Same as A, MAX 2 | A as above; attempt 2 psql 0 | `rolled_back_clean`, then `committed_verified` | 0 | 2 |
| E | Same as B, MAX 2 | psql 2, line 1318 | `committed_verified`, no retry | 0 | 1 |
| F | Client reset at 1232, but the pooler keeps the backend open (idle in transaction, uncommitted) | psql 2, line 1232 | `ambiguous_lingering`, with the state looking clean (0 roles) because the transaction is uncommitted, then STOP | 4 | 1 |
| J | Client reset at 1232; the pooler rolls the backend back and keeps it idle for reuse | psql 2, line 1232 | `rolled_back_clean`; a live but idle backend is not lingering | 3 | 1 |
| G | A, then an out-of-band partial state (one role) | psql 2, line 1232 | `ambiguous_state`, STOP (MAX 2, no retry) | 4 | 1 |
| H | B, then drift (one EXECUTE revoked) | psql 2, line 1318 | `ambiguous_state` (`functions` differs), STOP | 4 | 1 |
| I | A, then the server goes down before the reconnect | psql 2, line 1232 | `ambiguous_probe_failed`, STOP | 4 | 1 |

Case F matters most. It shows that "nothing visible" is not the same as "rolled back" while the original backend is alive. The guard waits for that exact backend to end, and stops if it doesn't.

## Files and hashes

| File | sha256 |
|---|---|
| `artifact/install.sql` | `766aec3bfbc3b766c113a5f25e64b35d9fbebf54083c2ef49c54cef84f24519b` |
| `fault_proxy.py` | `912754568847e7d6150cc8275a887dd4bffc52bac4355c1fa1af6924c32709dc` |
| `state-probe.sql` | `9b9317850fb5ca3ab26b97b196df92ed4f71fb5906d446ab4fea2987f05cc9b7` |
| `install-guarded.sh` | `a6cfcac12c4c7c6dbe51df83fa7088b82034d346d63aec51796f2120bf650c81` |
| `run-fault-tests.sh` | `d702696093745e182b94b0ea21b60a88be2b26033aef0083d5d29ab8e34b74fa` |
| `receipts/fault-tests/RESULT.json` | `4e709838ad6f84598bd25d8a59ce5f476282ddb6bbaeee3f756f920ef007ec7d` |
| `receipts/fault-tests/summary.jsonl` | `eb6adca378c7223fa6f6c5487dc622b8c800c77ed4a691d2a8e2b7bb10296312` |
| `receipts/fault-tests/EXPECTED.json` | `2a16b9fd0aa22072f4395db938a2f073889db4d7a3f6d4ccd37502f23ea9c4c7` |

Per-case folders under `receipts/fault-tests/` hold `proxy-events.jsonl`, `server.log`, `server-disconnect-lines.txt`, and `run/{pre.json, attempt-N/{install.out, cause.json, post.json, verdict.json}, FINAL.json}`.

## Limits

- **Local only.** This is local PG 15.19 through a loopback proxy, without TLS or Supavisor. Hosted is PG 15.1 behind Supavisor.
- **Hosted fingerprint parity is unproven.** Hosted event triggers act only on cron/graphql/net/pgsodium DDL, and the only global default ACL is postgres/functions. The sandbox's functions are created as `blsh_replay_owner`, so none of these should touch the sandbox. Still, `committed_verified` on hosted compares against the local reference. A mismatch therefore stops safely; it never retries.
- **The trailing `notify pgrst`.** After a lost COMMIT reply it is never sent. Exposing `blsh_replay_api` in the dashboard reloads PostgREST anyway.
