# Hosted FORGE capture dispatch

The migration installs empty private dispatch tables and service-only begin and finish functions. Registration and activation are separate owner actions. The example SQL uses psql variables for the approved dates, exact 40-character deployed Git SHA, game ID and scheduled start with time zone.

## Preflight

- Confirm the existing custody migration and the dispatch migration on the intended database. Confirm that the Cron execution role owns the private dispatch functions and has `pg_read_all_stats` visibility. Check `pg_cron`, `pg_net`, Supabase Vault and `extensions.hmac(bytea, bytea, text)`. If the installed pg_net exposes `pg_net.max_timeout_ms`, it must permit 420,000 ms.
- Provision a dedicated value of at least 32 printable ASCII characters in Vault as `forge_pregame_dispatch_secret`. Supply the same value in the production Vercel environment as `FORGE_PREGAME_DISPATCH_SECRET`. The dispatch request carries a signature of its UUID. The shared value stays in the environment and Vault.
- Verify the approved deployment and production environment for `https://fhfhockey.com/api/v1/db/forge-pregame-capture`, including a 420-second effective duration, `FORGE_PREGAME_CAPTURE_ENABLED=true` and the exact `VERCEL_GIT_COMMIT_SHA`. Confirm the normal server-only Supabase credentials and the pinned DigiCert witness profile.
- Before enabling, confirm that there is no other approved runner for the cohort, no active dispatch approval and no unresolved dispatch slot.

## Register dormant

Use the dispatch migration owner role. The transaction leaves the minute tick inactive at commit. If the job already exists, inspect its owner, command and active flag before any change.

```sql
begin;

select cron.schedule(
  'forge-pregame-hosted-dispatch',
  '* * * * *',
  'select forge_pregame_capture.hosted_tick_v1()'
)
where not exists (select 1 from cron.job where jobname = 'forge-pregame-hosted-dispatch');

select cron.alter_job(jobid, active := false)
from cron.job
where jobname = 'forge-pregame-hosted-dispatch' and username = current_user;

commit;
```

## Activate the approved canary

Use the NHL slate date, exact game ID, exact official scheduled start and exact deployed SHA approved for the canary. Both teams must still report the same pregame status and a normal schedule. If a previously observed start is earlier than the official time, the endpoint withholds the capture.

```sql
begin;

insert into forge_pregame_capture.hosted_slates
  (slate_date, expected_code_version, canary_game_id, canary_scheduled_start)
values (:'canary_date'::date, :'candidate_sha', :'canary_game_id'::bigint, :'canary_start'::timestamptz);

with opened as (
  update forge_pregame_capture.hosted_slates
  set enabled = true, approved_at = clock_timestamp()
  where slate_date = :'canary_date'::date
    and canary_game_id = :'canary_game_id'::bigint
    and expected_code_version = :'candidate_sha'
    and stop_reason is null
    and canary_scheduled_start > clock_timestamp() + interval '66 minutes 2 seconds'
  returning slate_date
)
select cron.alter_job(j.jobid, active := true)
from cron.job j cross join opened
where j.jobname = 'forge-pregame-hosted-dispatch' and j.username = current_user;

commit;
```

Confirm the expected one active job and one canary approval from `cron.job` and `forge_pregame_capture.hosted_slates`. The job first becomes due about 76 minutes before the approved start. The latest dispatch boundary is 66 minutes 2 seconds before the earliest observed start.

## Expand after approved canary readback

After independent qualification of the committed canary and approval of the exact date range on the same candidate, expand the canary to an inclusive ET range beginning at its slate date and ending at `range_end`. The approved range spans at most 366 calendar dates. The existing minute job discovers eligible future games and advances across dates automatically.

```sql
update forge_pregame_capture.hosted_slates s
set canary_game_id = null, canary_scheduled_start = null,
    last_slate_date = :'range_end'::date, approved_at = clock_timestamp()
where s.slate_date = :'canary_date'::date and s.expected_code_version = :'candidate_sha'
  and s.enabled and s.stop_reason is null and s.canary_game_id = :'canary_game_id'::bigint
  and exists (
    select 1 from forge_pregame_capture.hosted_games g
    where g.game_id = s.canary_game_id and g.approval_date = s.slate_date
      and g.state = 'finished' and g.outcome = 'qualified'
      and g.expected_code_version = s.expected_code_version
  )
returning s.slate_date, s.last_slate_date, s.expected_code_version;
```

One slot is shared across all approved dates. Closely spaced games are moved earlier to reserve serial capacity. A blocked or delayed game that misses its latest start gets an explicit private dispatch reason. `hosted_games` is the dispatch journal. Qualification comes from the existing committed custody and witness. A known outcome wins over any new launch.

## Stop and reconcile

```sql
begin;

select cron.alter_job(jobid, active := false)
from cron.job
where jobname = 'forge-pregame-hosted-dispatch' and username = current_user;

update forge_pregame_capture.hosted_slates set enabled = false where enabled;

commit;
```

An unconfirmed delivery blocks the slot after its one-minute delivery window, bounded by the latest dispatch time. An unconfirmed begun request blocks the slot after seven minutes. It also stops the approved range across dates and records enrolled, unstarted siblings as `never_dispatched`. A range with future dates latched as stopped sends no later requests. Never infer committed capture from an HTTP status or retry a fenced dispatch.

Use the existing owner custody readback for the exact game. Where separately authorized, settle any orphaned claim through the existing custody procedure first. After inspection, use the owner-only dispatch reconciliation for that game.

```sql
select forge_pregame_capture.hosted_reconcile_v1(:'game_id'::bigint);
```

An authoritative custody outcome releases the slot. For a verified absent claim, reconciliation also waits through the original or current T−60 boundary, whichever is later, plus two minutes. An orphaned claim continues to hold the slot until custody has a terminal outcome. Recovery preserves the original approval's stop latch. Any future dispatch range needs fresh approval after reconciliation.

Run the connected local check from the repository root with `LC_ALL=C /usr/local/bin/python3 -I supabase/tests/forge_pregame_hosted_dispatch.py --with-route`. It exercises locking, roles, load gates, range rollover and HMAC signing. It delivers the signed queue fixture to the Next.js handler and checks that a second database connection can verify the saved packet and timestamp. Hockey inputs, Vault, the HTTP transport and the timestamp authority are fixtures.

For hosted acceptance, Chef needs one approved game, start and deployed SHA. From a separate readback session, verify the committed claim, packet hashes, stored witness token and its upper time bound by T−60. Record the game, candidate, outcome and readback before authorizing a date range.
