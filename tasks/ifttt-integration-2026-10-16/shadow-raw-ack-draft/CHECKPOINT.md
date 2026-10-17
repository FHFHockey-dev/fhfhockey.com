# Unwired atomic shadow acknowledgment draft

This is separate, **unreviewed and unwired** work prepared while the 95-file job-ack/compatibility candidate is held. No held path or prior output was edited. This draft is not part of that review or any earlier acceptance.

The installed CLI generated `supabase/migrations/20261016073503_tweet_claim_shadow_raw_ack.sql` inside this task-local directory with:

```
SUPABASE_TELEMETRY_DISABLED=1 supabase --workdir ../tasks/ifttt-integration-2026-10-16/shadow-raw-ack-draft migration new tweet_claim_shadow_raw_ack
```

It is outside the repository's active migration trees. No production SQL, migration history, remote schema or deployment was touched. The missing web-local CLI binary was not installed; the existing `/opt/homebrew/bin/supabase` was used after reading its help.

The draft adds one service-role-only invoker RPC, empty search path, two allowlisted raw tables, bounded 64 KiB payload / 256 observation IDs. It reuses `tweet_pipeline_jobs.payload` for an exact retained acknowledgment rather than creating infrastructure. It locks the current job then raw receipt, requires a current owner and server-clock lease, compares original raw payload, tweet identity and receipt clock against retained observations in committed scopes, rejects missing/duplicate/omitted evidence, and atomically updates the raw status/marker plus completed job/receipt. A repeated exact call returns the existing receipt; conflicting or incomplete old completion holds. It does not alter observations, qualification, outbox/native consumer records, forecasts or delivery state.

**19/19 owner contract tests passed** against actual raw table and job/claim definitions plus registry SQL in a disposable PG17 cluster. Cases cover both raw tables; job-write failure rolling back the prior raw update; committed reply loss; concurrent repeats; replaced/expired owner; payload and clock/source conflicts; missing, duplicate, empty or omitted observations; prior completion without protocol receipt; post-commit raw conflict; anon/authenticated denial. TCP disabled; service-role execution; network-denial setup inherited; cluster stopped/removed. Evidence: `evidence/results.json`, `evidence/run.log`. These use directly seeded synthetic retained observations, not full parser/qualification integration or authentic intake.

Next: after the held job-ack candidate is released, connect an explicitly enabled shadow-only wrapper to the actual registry hook, carry complete receipt observation identities, and implement bounded exact raw/job acknowledgment readback after uncertain RPC replies. Preserve default-off operation. Add actual claim → scope commit → raw/job RPC tests, including raw/job rollback and process restart. Review a new pin before acceptance. The existing raw hook is unchanged and still has the separate-write gap today.

This RPC's guarantees assume the existing service-role writer boundary. It does not protect against arbitrary direct job/raw table edits or prove deployed schema/ACL/history/fences. No native dispatch, external exactly-once guarantee, integrated full52, live replay, historical correction, activation or operational approval is implied. Authentic future evaluation remains unopened and inactive.
