# Fresh inspection and one confirmed write

Independent review ACCEPT for script SHA-256 43129788749954e27f6b5ca5bee4b18fd4c4350af1b578a5553b87daf208d14b. The agent has not run this script or handled credentials.

```sh
python3 /Users/tim/Code/fhfhockey.com/tasks/artifacts/rso-consumer-checkpoint-2026-10-13/inspect-confirm-write-schedule.py
```

Privately confirm the public database URL and provide the same existing bearer used for inspection. The script makes one read-only inspection of the fixed approved scope: game key477/Yahoo2026/NHL20262027, October11–19, exact57game IDs2026020084–2026020140,114team sides. It requires successful strict scope checks, zero planned deletions, zero actual writes, and no warnings. Only allowlisted inspection facts are printed.

Review that output. Type the displayed WRITE114/hash-prefix phrase exactly within120seconds to authorize one write using the full inspected hash. Cancellation, scope mismatch or expired confirmation submits no write. There is no retry, reinspection loop, redirect or credential file. Maximum write scope remains114schedule upserts plus one separate audit; no delete.

Share only the sanitized JSON. SCHEDULE_ACKNOWLEDGED with114upserts/0deletes and a persisted audit still requires exact database readback. On REFRESH_SOURCE_CHANGED, UNKNOWN, transport failure or failed/missing audit, stop without retrying. A failure audit may persist even when no schedule write is attempted; an uncertain response may follow a completed schedule write. Do not infer rollback or silently repin the hash.

The prior eab29c8c write was rejected. Read-only reconciliation found114rows/57games, no rows fetched or updated after October9, and one persisted failure audit at2026-10-14T00:05:57.819529UTC for the exact rejected hash. The guard failed before upsert. Neither inspection output nor audit retained normalized source bodies or a field diff, so the exact changed source field cannot be recovered from those receipts. Prior separately captured PRE/LIVE transitions show this is possible during normal game progress; they do not prove the cause of this particular rejection.

No application source, guard semantics, deployed settings or database state changed during script preparation.
