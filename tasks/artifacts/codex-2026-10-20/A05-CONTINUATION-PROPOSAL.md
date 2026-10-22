# A-05 — PROPOSED continuation slots; not applied

Keep job 278 at 08:15 UTC. Propose six additional daily slots at 08:20, 08:25, 08:30, 08:35, 08:40 and 08:45 UTC, invoking the same approved command with `continueDailyWindow=true`. Query parameters take precedence over the request body (`update-rolling-player-averages.ts:getRequestParam`), so the proposal works with either GET or POST without copying credentials into this report.

The checked-in cron inventory describes GET; the handoff diary describes POST `{}`. Neither proves the current hosted command. The proposal clones the hosted command privately, validates its identity/scope, and refuses an unfamiliar shape. Do not run it until TJ approves the exact production schedule change and Claude reviews the active command without printing its credentials.

```sql
-- PROPOSED ONLY. Not a migration. Not executed. Operational approval required.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $proposal$
DECLARE
  base cron.job%ROWTYPE;
  endpoint constant text := 'https://fhfhockey.com/api/v1/db/update-rolling-player-averages';
  continuation text;
  minute integer;
  slot_name text;
BEGIN
  SELECT * INTO STRICT base FROM cron.job WHERE jobid = 278;
  IF base.jobname IS DISTINCT FROM 'update-rolling-player-averages'
     OR base.schedule IS DISTINCT FROM '15 8 * * *' OR NOT base.active
     OR base.command !~ 'net\.http_(get|post)\s*\('
     OR position(quote_literal(endpoint) IN base.command) = 0
     OR (length(base.command) - length(replace(base.command, endpoint, ''))) <> length(endpoint)
     OR base.command ~* '(fullRefresh|disableRuntimeBudget|startDate|endDate|resumeFrom|continueDailyWindow|playerIds|seasonId)'
  THEN
    RAISE EXCEPTION 'Base job differs from reviewed implicit daily command; stop for owner review';
  END IF;
  continuation := replace(base.command, endpoint, endpoint || '?continueDailyWindow=true');
  FOREACH minute IN ARRAY ARRAY[20,25,30,35,40,45] LOOP
    slot_name := 'rolling-daily-continue-08' || minute::text;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = slot_name) THEN
      RAISE EXCEPTION 'Continuation slot already exists; inspect instead of duplicating';
    END IF;
    PERFORM cron.schedule(slot_name, minute::text || ' 8 * * *', continuation);
  END LOOP;
END
$proposal$;
-- Approval and validation precede executing this whole transaction.
COMMIT;
```

Resource ceiling proposed: six additional invocations/day, default 180-second claim budget and existing route cap; six calls at a 240-second platform cap would allow up to 24 additional function-minutes/day before platform details/overhead. Actual CPU, duration, requests, downstream DB cost and remaining work are unknown. Completed windows return without recomputation by source contract; the handoff's roughly one-second timing was not rerun here.

Five-minute spacing is intended to separate normal invocations. It is not a distributed lock: delayed pg_net dispatch, a late DB acknowledgment or another writer can still overlap. Before application verify cron timezone is UTC, active job method/scope/auth, the current 240-second limit, no duplicate slots/competing rolling invocation, and same-window cursor audit identity. Do not weaken the runtime budget, enable full refresh, or call the endpoint to test this proposal. Keep 207 `partial`/`continued` receipts. No scheduler, production or endpoint action performed; SQL reviewed statically only.
