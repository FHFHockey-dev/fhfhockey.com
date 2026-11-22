# Reconciling a stranded Rankings publication

A running or ambiguous claim owns the shared writer slot indefinitely. The scheduled date stays consumed after reconciliation. Only the operator exercising a separately approved recovery should change the ledger.

1. Pause the scheduler and manual writers. Record the ledger UUID, status, exact database `updated_at`, season, target, prior cutoff, stage and evidence. Identify the exact invocation and release SHA. Confirm the worker terminated, including retries, and that all related HTTP requests, PostgREST requests and database writes have settled. Elapsed time or an HTTP timeout alone cannot establish quiescence. Leave the lock in place if an outstanding request is uncertain.
2. Read the four all-skater ranking markers and the season composite marker for the target and prior cutoff. Check default floors, row counts, expected and written skater counts, methodology and completion chronology. Compare stored IDs per window and metric and the physical composite IDs with the accepted source cohort and digest. Verify which date the reader serves. A newer completed pair supersedes the target. Record the findings and evidence location in the incident receipt.
3. Mark the claim `complete` only when the intended writes and published pair were independently verified. Use `failed` for a quiescent failed or partial attempt. Reconciliation changes the ledger only. Partial rows and markers need a separately approved forward-only repair with a fresh readback. Keep a verified served pair intact.
4. Execute the following statement using the exact previously observed timestamp and status. Supply the psql variables from the approved incident receipt. `receipt` points to the durable evidence, and `operator` identifies the custodian. Both quiescence values record the independent checks in step 1. A stale timestamp, wrong status, absent evidence or already-resolved attempt causes a refusal. Read back the updated ledger and approval before resuming new dates.

```sql
select public.reconcile_ranking_publication_dispatch(
  :'attempt_id'::uuid,
  :'observed_status',
  :'observed_updated_at'::timestamptz,
  :'resolution',
  jsonb_build_object('operator', :'operator', 'receipt', :'receipt',
                     'writerQuiescent', true, 'databaseQuiescent', true)
);
```

The daily entry point checks the actual Rankings and composite target keys as well as markers. A partial or markerless target is recorded as protected. The caller cannot obtain a new scheduled claim by repeating the same day. Apply the shared-claim migration before deploying callers, and retire or drain every older writer entry point before enabling cadence. The migration builds a partial date index over existing 5v5 all-skater ranking rows. The database owner should qualify build duration, storage and writer lock impact before applying it.
