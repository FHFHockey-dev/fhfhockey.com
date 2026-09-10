#!/usr/bin/env bash
# Exercises an overlapping pending-session race and stale-version conflict
# against verify-local-migration's disposable DB.
set -euo pipefail

readonly CONTAINER="${1:?Usage: $0 <disposable-postgres-container>}"
readonly USER_ID='00000000-0000-4000-8000-000000000041'
readonly RACE_DIR="$(mktemp -d)"
readonly RELEASE_FIFO="$RACE_DIR/release-first-transaction"
first_pid=""
second_pid=""

cleanup() {
  [[ -z "$first_pid" ]] || kill "$first_pid" >/dev/null 2>&1 || true
  [[ -z "$second_pid" ]] || kill "$second_pid" >/dev/null 2>&1 || true
  wait "$first_pid" >/dev/null 2>&1 || true
  wait "$second_pid" >/dev/null 2>&1 || true
  rm -rf "$RACE_DIR"
}
trap cleanup EXIT

query() {
  docker exec -i "$CONTAINER" psql --quiet --set ON_ERROR_STOP=1 --tuples-only --no-align --username postgres --dbname postgres --command "$1"
}

query "insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values ('$USER_ID', 'authenticated', 'authenticated', 'draft-race@example.invalid', '{}'::jsonb, '{}'::jsonb);" >/dev/null
draft_id="$(query "insert into public.draft_pro_drafts (user_id, name, snapshot, snapshot_bytes) values ('$USER_ID', 'Race original', '{\"writer\":\"initial\"}'::jsonb, 20) returning id;")"

mkfifo "$RELEASE_FIFO"
docker exec --env PGAPPNAME=draft-pro-saved-race-a -i "$CONTAINER" \
  psql --quiet --set ON_ERROR_STOP=1 --tuples-only --no-align --username postgres --dbname postgres \
  < <(printf 'BEGIN;\nselect status || '\''|'\'' || save_session_id::text from public.begin_draft_pro_save_session('\''%s'\'', '\''%s'\'', 0, '\''race-a'\'');\n' "$USER_ID" "$draft_id"; cat "$RELEASE_FIFO"; printf 'COMMIT;\n') \
  > "$RACE_DIR/first.out" &
first_pid=$!

for _ in $(seq 1 50); do
  begin_a="$(awk '/^ready\|/{print; exit}' "$RACE_DIR/first.out")"
  [[ -n "$begin_a" ]] && break
  kill -0 "$first_pid" >/dev/null 2>&1 || { cat "$RACE_DIR/first.out" >&2; exit 1; }
  sleep 0.1
done
[[ "${begin_a:-}" == ready\|* ]] || { echo 'First save session did not become ready while transaction remained open' >&2; exit 1; }

docker exec --env PGAPPNAME=draft-pro-saved-race-b -i "$CONTAINER" \
  psql --quiet --set ON_ERROR_STOP=1 --tuples-only --no-align --username postgres --dbname postgres \
  --command "select status || '|' || coalesce(save_session_id::text, '') from public.begin_draft_pro_save_session('$USER_ID', '$draft_id', 0, 'race-b');" \
  > "$RACE_DIR/second.out" &
second_pid=$!

blocked=false
for _ in $(seq 1 50); do
  if [[ "$(query "select exists (select 1 from pg_stat_activity as waiting join pg_stat_activity as holding on holding.application_name='draft-pro-saved-race-a' where waiting.application_name='draft-pro-saved-race-b' and waiting.wait_event_type='Lock' and holding.pid=any(pg_blocking_pids(waiting.pid)));")" == t ]]; then
    blocked=true
    break
  fi
  kill -0 "$second_pid" >/dev/null 2>&1 || { cat "$RACE_DIR/second.out" >&2; exit 1; }
  sleep 0.1
done
[[ "$blocked" == true ]] || { echo 'Second save caller was not observed waiting on the first transaction lock' >&2; exit 1; }

printf '\n' > "$RELEASE_FIFO"
wait "$first_pid"
wait "$second_pid"
begin_b="$(awk '/^busy\|/{print; exit}' "$RACE_DIR/second.out")"
[[ "${begin_b:-}" == busy\|* ]] || { echo "Expected second save to become busy after lock release: ${begin_b:-missing}" >&2; exit 1; }

save_a="$(query "select status || '|' || lock_version::text from public.commit_draft_pro_save_session('$USER_ID', '${begin_a#*|}', 'Race winner', '{\"writer\":\"one\"}'::jsonb, 16, '{}'::uuid[]);")"
stale_b="$(query "select status || '|' || current_version::text from public.begin_draft_pro_save_session('$USER_ID', '$draft_id', 0, 'race-b');")"
snapshot="$(query "select lock_version::text || '|' || (snapshot->>'writer') from public.draft_pro_drafts where id='$draft_id';")"

[[ "$save_a" == 'saved|1' && "$stale_b" == 'conflict|1' && "$snapshot" == '1|one' ]] || {
  echo "Saved Drafts race failed: save=$save_a stale=$stale_b snapshot=$snapshot" >&2
  exit 1
}

echo 'saved_drafts_race=passed; overlap=observed-lock-wait; result=winner-saved-stale-conflict; snapshot=winner-only'
