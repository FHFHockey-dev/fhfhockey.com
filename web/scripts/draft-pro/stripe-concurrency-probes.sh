#!/usr/bin/env bash
set -euo pipefail

container="${1:-}"
if [[ "$container" != draft-pro-w12-* ]]; then
  echo "Expected a disposable draft-pro-w12 container." >&2
  exit 64
fi

readonly user_id="00000000-0000-4000-8000-000000000031"
readonly output_directory="$(mktemp -d)"
cleanup() { rm -rf "$output_directory"; }
trap cleanup EXIT

psql_command() {
  docker exec "$container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres "$@"
}

wait_for_holder() {
  local application_name="$1"
  for _ in $(seq 1 20); do
    if [[ "$(psql_command --tuples-only --no-align --command "select count(*) from pg_stat_activity where application_name='$application_name' and query like 'select pg_sleep(%'")" == "1" ]]; then
      return
    fi
    sleep 0.05
  done
  echo "Lock holder $application_name did not reach its post-lock wait." >&2
  exit 1
}

psql_command --command "insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values ('$user_id','authenticated','authenticated','stripe-concurrency@example.invalid','{}','{}')" >/dev/null

docker exec --env PGAPPNAME=draft-pro-begin-lock "$container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres \
  --command "begin" --command "select pg_advisory_xact_lock(hashtext('draft-pro-checkout:$user_id:draft_pro_2026_27'))" \
  --command "select pg_sleep(2)" --command "commit" >/dev/null &
lock_pid=$!
wait_for_holder draft-pro-begin-lock
psql_command --tuples-only --no-align --command "select purchase_id from public.begin_draft_pro_stripe_checkout_attempt('$user_id')" >"$output_directory/begin-1" &
begin_one_pid=$!
psql_command --tuples-only --no-align --command "select purchase_id from public.begin_draft_pro_stripe_checkout_attempt('$user_id')" >"$output_directory/begin-2" &
begin_two_pid=$!
wait "$lock_pid"
wait "$begin_one_pid"
wait "$begin_two_pid"

purchase_one="$(tail -n 1 "$output_directory/begin-1")"
purchase_two="$(tail -n 1 "$output_directory/begin-2")"
if [[ ! "$purchase_one" =~ ^[0-9a-f-]{36}$ ]] || [[ "$purchase_one" != "$purchase_two" ]]; then
  echo "Concurrent begin calls returned different purchase IDs." >&2
  exit 1
fi
pending_count="$(psql_command --tuples-only --no-align --command "select count(*) from public.draft_pro_purchases where user_id='$user_id' and status='pending'")"
if [[ "$pending_count" != "1" ]]; then
  echo "Concurrent begin calls created $pending_count pending attempts." >&2
  exit 1
fi
echo "concurrent_begin=passed"
psql_command --command "select public.attach_draft_pro_stripe_checkout_session('$purchase_one','cs_concurrent',now()+interval '1 hour')" >/dev/null

docker exec --env PGAPPNAME=draft-pro-event-lock "$container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres \
  --command "begin" --command "select 1 from public.draft_pro_purchases where id='$purchase_one' for update" \
  --command "select pg_sleep(2)" --command "commit" >/dev/null &
lock_pid=$!
wait_for_holder draft-pro-event-lock
event_sql="select processed from public.record_draft_pro_stripe_event('evt_concurrent','checkout.session.completed',now(),'cs_concurrent','pi_concurrent','$user_id','$purchase_one','paid',false,null,null,'{}'::jsonb)"
psql_command --tuples-only --no-align --command "$event_sql" >"$output_directory/event-1" &
event_one_pid=$!
psql_command --tuples-only --no-align --command "$event_sql" >"$output_directory/event-2" &
event_two_pid=$!
wait "$lock_pid"
wait "$event_one_pid"
wait "$event_two_pid"

event_results="$(sort "$output_directory/event-1" "$output_directory/event-2" | tr '\n' ',')"
if [[ "$event_results" != "f,t," ]]; then
  echo "Concurrent duplicate event results were not one processed and one duplicate: $event_results" >&2
  exit 1
fi
event_assertion="$(psql_command --tuples-only --no-align --command "
  select case when
    (select count(*) from public.draft_pro_provider_events where provider='stripe' and provider_event_id='evt_concurrent') = 1
    and (select count(*) from public.user_entitlements where source_provider='stripe' and source_reference='draft_pro_purchase:$purchase_one' and entitlement_status='active') = 1
    and (select count(*) from public.draft_pro_purchases where id='$purchase_one' and status='active') = 1
  then 'concurrent_event=passed' else 'concurrent_event=failed' end")"
if [[ "$event_assertion" != "concurrent_event=passed" ]]; then
  echo "$event_assertion" >&2
  exit 1
fi
echo "$event_assertion"
