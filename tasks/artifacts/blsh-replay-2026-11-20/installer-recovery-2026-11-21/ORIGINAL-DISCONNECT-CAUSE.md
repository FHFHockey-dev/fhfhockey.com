# BLSH hosted install, Nov 20: the original disconnect

This file covers only the original hosted failure. The fault-injection retry proof is in [FAULT-TEST-RECEIPTS.md](FAULT-TEST-RECEIPTS.md).

## What ran

| Item | Value |
|---|---|
| Artifact | `install.sql`, sha256 `766aec3bfbc3b766c113a5f25e64b35d9fbebf54083c2ef49c54cef84f24519b`, 376,877 B, 1,319 lines |
| Recovered from | `~/Library/Application Support/Claude/side-session-notes/local_23eb6989-…/blsh-hosted-kit/install.sql`, the file the hosted operator ran. Its `MANIFEST.sha256` line 6 pins the same hash. |
| Copy here | [artifact/install.sql](artifact/install.sql) (see [artifact/SHA256SUMS](artifact/SHA256SUMS)) |
| Pins | `APPROVAL-BATCH.md` at `99fb9638a`: install.sql `766aec3b…` for candidate `cda345c4f`; TJ approval text in `../TJ-INSTRUCTIONS.md` |
| Client output | [artifact/install.out](artifact/install.out) (sha256 `b38c2fe4…87f6`): `psql:install.sql:1232: server closed the connection unexpectedly … error: connection to server was lost` |
| Path | psql (Mac), then Supavisor session pooler (`aws-0-us-east-1`, port 5432, TLS), then Postgres 15.1. One `begin … commit` transaction. |

## What the retained hosted logs show (read-only, Nov 21 ~16:50Z)

- **Postgres DDL:** logged from `create role blsh_replay_owner` at 20:38:15.079Z through `alter table blsh_replay.nst_gamelog_as_counts_oi add primary key` at 20:38:17.309Z, about 30 ms apart. Inserts are not logged at this log level.
- **No server-side fault:** between 20:38 and 20:51Z there is no FATAL, terminate, "unexpected EOF", "could not receive data" or out-of-memory line for this session. The only "Connection reset by peer" (20:37:40.65Z) came before the install began, on another session.
- **Supavisor:** the install client authenticated at about 20:38:14.97Z. No error or close is recorded for that session. The next entries from the operator's IP are the 20:50:35–36Z check connections.
- **Line 1232:** an insert row. It is query no. 418–419 in the local replays of the same file. At the logged pace, it was reached seconds after 20:38:17Z, not at about 20:48Z as the earlier diary note said.
- **Server-side timeouts:** `statement_timeout` = 120 s, `idle_in_transaction_session_timeout` = 0, `idle_session_timeout` = 0, `tcp_keepalives_idle` = 7200. None of them can end a session 2–15 s in.

## Conclusion

The cause can't be determined from the retained logs. Neither Postgres nor Supavisor recorded a fault, and nothing server-side could end the session that early. The likely cause is a drop on the client-to-pooler network path, on the Mac side or between the Mac and the pooler. That is consistent with how that Mac session stalled afterwards. It is not proven.

## Outcome (separate from the cause)

The outcome is rolled back, with nothing left behind.
- **Nov 20, 20:50:34–36Z:** the isolation, denial and reachability checks all failed with `role "blsh_replay_api" does not exist`.
- **Nov 21, 17:01Z:** a read-only probe found 0 roles, 0 schemas, 0 memberships, 0 tables and 0 functions ([receipts/hosted-readonly-probe-20261121.json](receipts/hosted-readonly-probe-20261121.json)).
- **Nov 21, 17:03Z:** production has no open transaction older than 1 h and none idle in transaction ([receipts/hosted-readonly-open-xacts-20261121.json](receipts/hosted-readonly-open-xacts-20261121.json)).
