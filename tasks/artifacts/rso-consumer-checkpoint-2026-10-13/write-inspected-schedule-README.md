# One-shot user-run guarded refresh

Independent pre-delivery review accepted corrected script SHA-256 ca244dabfeaeabde90e381981e884d15c55221c558eb14458ed1933a71af65f0. The agent has not run this script or handled authentication. It is pinned to user-supplied inspection hash eab29c8c1413bc553908a01f0f5e6d760565ee58675d336931f7420b174e8b7c, not the older stopped packet. The supplied inspection confirms57games/114planned sides, all approved scope checks, zero writes/deletes and no warnings. Evidence provenance is retained in user-inspection-receipt-eab29c8c.json.

Privately prepare the same existing authentication used for inspection, then run promptly on the Mac:

```sh
python3 /Users/tim/Code/fhfhockey.com/tasks/artifacts/rso-consumer-checkpoint-2026-10-13/write-inspected-schedule.py
```

The first prompt confirms the already verified PUBLIC database URL https://fyhftlxokyjtpndbkfse.supabase.co. The second privately accepts the existing admin/cron bearer without echo, shell history, saved credentials or logged headers. Do not provide your normal password, add credentials to the command, use a recorded/shared terminal, or share them in chat. No new credential or access is created.

This submits exactly one guarded dryRun=false POST to the verified production endpoint using URL query fields. Fixed bounded dates October11–19, game477/2026, NHL20262027, exact57IDs2026020084–2026020140, at most114team sides, one audit. Normal TLS retained; no redirects, retries, automatic inspection or repinning. Bounded mode deletes no records. The route uses one upsert and a separate audit insertion; they are not one transaction.

Successful output should show SCHEDULE_ACKNOWLEDGED, matching scope/hash,114rowsUpserted,0rowsDeleted and finalAudit.status=persisted. Share only the final sanitized JSON. Acknowledgement is not database readback; the coordinator verifies exact records/audit separately.

If REFRESH_SOURCE_CHANGED or another pre-write guard rejection appears, STOP and return that output. The route can record one failure audit even when it writes no schedule rows; do not automatically retry and create another audit. A later same-scope inspection/review is coordinated separately; ordinary PRE/LIVE progress needs no repeat approval of the same identities/dates/row bound, but never bypass the content hash.

If it reports UNKNOWN, times out, returns malformed/non-JSON content, or shows an audit failure/missing audit, STOP and return the sanitized result. The schedule write may have succeeded before an audit or transport failure; do not claim rollback, rerun the write or rerun inspection as a substitute for exact database/audit readback. The script has no write fallback or retry. Do not change or pass a different hash.
