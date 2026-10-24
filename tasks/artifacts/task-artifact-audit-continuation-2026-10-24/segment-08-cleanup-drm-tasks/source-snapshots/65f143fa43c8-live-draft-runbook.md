# Yahoo live-draft private-beta runbook

Status: implementation-ready only. The feature is not production-qualified. Keep the rollout gate closed until the migration, durable worker, and controlled Yahoo rehearsal are verified in the target environment.

## Runtime contract

The poller is a long-running Node 22 process started from `web/` with `npm run worker:yahoo-live-draft`. It must run under a supervisor that restarts on failure, emits stdout/stderr JSON, and supports graceful `SIGTERM`. Multiple replicas are safe because database leases remain the concurrency boundary. A request-only Vercel function or ordinary Vercel Cron schedule is not a substitute for this sub-minute process.

Required server secrets:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Public identifier, required by app and worker. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-only database/RPC access. Secret; worker and server only. |
| `YAHOO_CONSUMER_KEY` / `YAHOO_CONSUMER_SECRET` | Yahoo OAuth and token refresh. Server secrets. `YFPY_*` remains a temporary discovery fallback. |
| `YAHOO_REDIRECT_URI` | Exact registered callback URL ending in `/api/v1/account/yahoo/callback`; HTTPS except localhost development. Server configuration. |
| `YAHOO_LIVE_DRAFT_SEASON` | Four-digit Yahoo season, for example `2026`. Server configuration. |
| `YAHOO_LIVE_DRAFT_TARGET_SEASON_ID` | Matching FHFH season ID, for example `20262027`. Server configuration. |
| `YAHOO_LIVE_DRAFT_OBSERVABILITY_SECRET` | HMAC secret for session/account/request references. Secret; required for telemetry and rehearsal. |
| `YAHOO_LIVE_DRAFT_WORKER_INSTANCE_ID` | Non-secret stable replica label. |

Rollout and validation controls:

| Variable | Safe value before validation |
| --- | --- |
| `YAHOO_LIVE_DRAFT_ENABLED` | `false` |
| `YAHOO_LIVE_DRAFT_ROLLOUT_STAGE` | `off`; use `staff` or `allowlist` only for an authorized rehearsal. |
| `YAHOO_LIVE_DRAFT_STAFF_USER_IDS` / `YAHOO_LIVE_DRAFT_BETA_USER_IDS` | Explicit UUID allowlists. |
| `YAHOO_LIVE_DRAFT_PROVIDER_VALIDATED` | `false`; required for `authenticated` rollout. |
| `YAHOO_LIVE_DRAFT_RESPONSE_FORMAT` | `standard_json`; `json_f` is compatibility-only. |
| `YAHOO_LIVE_DRAFT_COMPARE_FORMATS` | `false`; enable only for a bounded rehearsal. |
| `YAHOO_LIVE_DRAFT_FIVE_SECOND_BURST` | `false`; do not enable without favorable provider evidence. |

Use separate, stable Yahoo application registrations for production, staging/test, and localhost development, each with only its exact callback URI registered. Do not register arbitrary preview-deployment hosts. Before any rehearsal, the operator must confirm that each application has the intended Yahoo Fantasy read access and that the expected request volume is acceptable; do not add an invented Fantasy scope or `openid` as part of this rollout.

## Preflight

1. Apply `20260824152127_yahoo_live_draft_production_hardening.sql` through the normal reviewed migration workflow. Do not run the worker before this migration exists in the target environment.
2. Regenerate Supabase types from that environment and verify no semantic drift from the checked-in types.
3. Verify RLS, forced RLS, grants, owner foreign keys, Realtime publication of only `yahoo_draft_sessions` and `yahoo_draft_picks`, and service-only RPC execution.
4. Deploy the supervised worker with the same release artifact and secret source as the web application. Start with one replica and `YAHOO_LIVE_DRAFT_FIVE_SECOND_BURST=false`.
5. Keep `YAHOO_LIVE_DRAFT_PROVIDER_VALIDATED=false`. Set rollout to an explicit staff/allowlist cohort only.
6. Confirm the worker produces cycles and that due-poll lag remains bounded:

```sql
select
  count(*) filter (where status in ('predraft', 'active')) as live_sessions,
  count(*) filter (
    where status in ('predraft', 'active')
      and next_poll_at < clock_timestamp() - interval '20 seconds'
  ) as stale_due_sessions,
  max(clock_timestamp() - next_poll_at) filter (
    where status in ('predraft', 'active')
  ) as maximum_due_lag
from public.yahoo_draft_sessions;
```

The short-retention observation store supports requests/minute, 401 refreshes, 429s, latency, failures, and lease backlog without raw identifiers:

```sql
select
  count(*) as requests,
  count(*) filter (where http_status = 429) as rate_limited,
  count(*) filter (where http_status = 401 or token_refresh_attempted) as auth_refresh_events,
  percentile_cont(0.5) within group (order by request_duration_ms)
    filter (where request_duration_ms is not null) as median_provider_ms,
  max(due_poll_lag_ms) as maximum_due_lag_ms,
  count(*) filter (where outcome = 'failed') as failures
from public.yahoo_draft_poll_observations
where created_at >= clock_timestamp() - interval '1 minute';
```

## Controlled Yahoo rehearsal

Use a consenting private test league. Do not automate or intercept the Yahoo draft room. Obtain the FHFH session UUID through a private service/admin query and pass it only as local CLI input. The harness writes its HMAC reference, never the raw UUID.

1. Connect Yahoo through the normal UI. Credentials remain in server-side token storage; never paste tokens into a terminal or artifact.
2. Start the worker and the FHFH live session. Mark the predraft checkpoint:

```sh
npm run rehearse:yahoo-live-draft -- mark --session-id "$PRIVATE_SESSION_ID" --kind predraft
```

3. With comparison mode bounded to the rehearsal, verify `standard_json` and `json_f` hashes agree. Disable comparison after the sample.
4. For each committed Yahoo pick, mark the closest observable commit time:

```sh
npm run rehearse:yahoo-live-draft -- mark --session-id "$PRIVATE_SESSION_ID" --kind pick --pick-number 1
```

5. Close all FHFH browser tabs and mark `browser_closed`. Confirm worker observations and picks continue. Reopen and mark `browser_opened`; verify authoritative GET catches up without multiplying provider calls.
6. Exercise a normal pause/resume with `pause` and `resume` markers. Exercise one ordinary timeout/auto-pick with `timeout_autopick --pick-number N`.
7. Stop the worker under the supervisor, mark `worker_stopped`, wait long enough to observe due-poll lag, restart it, and mark `worker_restarted`. Confirm lease recovery without duplicate or missing picks.
8. Only when Yahoo permits a safe commissioner correction, mark `correction`; verify two matching provider observations are required and convergence occurs within two normal polls.
9. Run keepers as a separate configuration and mark `keeper`. Until semantics are proven, do not infer keeper or traded-pick ownership silently.
10. Generate a sanitized report:

```sh
npm run rehearse:yahoo-live-draft -- report --session-id "$PRIVATE_SESSION_ID" --out /private/tmp/yahoo-rehearsal.jsonl
```

The marker and report files default to `/private/tmp`, are created mode `0600`, and may contain snapshot hashes and operational timing. They must not be committed. Delete them according to the approved rehearsal-artifact retention period.

## Go/no-go

Broad enablement requires all of these product targets in a real rehearsal: median pick visibility at most 5 seconds, p95 at most 12 seconds, ordinary staleness at most 20 seconds, zero duplicate active picks, zero missing completed picks, 100% pick representation, correction convergence within two normal polls, at least 99% verified mapping coverage with visible placeholders for the remainder, zero uncontrolled 429s, refresh recovery without user action, zero cross-user disclosure, and automatic worker recovery.

Any duplicate, missing completed pick, disclosure, or lost crash recovery blocks release. A p95 above 30 seconds must not be marketed as live. Staleness above 20 seconds requires a warning; around 60 seconds requires a prominent manual-fallback recommendation.

## Alerts and response

- Worker unavailable: alert on due lag over 20 seconds and worker heartbeat/cycle absence; keep last known-good picks and recommend manual fallback around 60 seconds.
- Yahoo 429: honor `Retry-After` plus jitter; do not manually hammer the provider.
- Yahoo timeout/5xx/malformed response: retain the prior snapshot, back off, and inspect sanitized observations.
- Reauthentication required: reconnect Yahoo; do not expose provider error bodies or credentials.
- Regressive snapshot: retain current picks unless a second bounded response has the same hash.
- Identity unresolved: retain the pick with a stable placeholder; reconciliation is independent of provider snapshot changes.

## Stop, rollback, and cleanup

1. Set `YAHOO_LIVE_DRAFT_ROLLOUT_STAGE=off` and `YAHOO_LIVE_DRAFT_ENABLED=false` first. This leaves the normal manual dashboard available.
2. Stop worker replicas gracefully. Users can use “Stop & continue manually,” which preserves the last confirmed snapshot.
3. Do not roll back by deleting sessions or picks. The schema migration is additive; leave it installed unless a separately reviewed forward migration is necessary.
4. Revert the application artifact only after the gates are off. Reconnect flows and manual drafting remain independent.
5. Run service-only idempotent cleanup on schedule:

```sql
select public.cleanup_yahoo_oauth_transactions();
select public.cleanup_yahoo_draft_poll_observations();
```

OAuth transactions are eligible for prompt cleanup after expiry/consumption. Poll observations default to 30 days. Completed sessions and current pick materializations have no automatic deletion in this change; define product/legal retention before broad rollout. Provider payloads are not archived.
