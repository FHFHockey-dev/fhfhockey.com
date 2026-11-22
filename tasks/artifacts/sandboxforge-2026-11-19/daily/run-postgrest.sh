#!/usr/bin/env bash
set -euo pipefail
umask 077
export LC_ALL=C

candidate=f886ddac731ae825a12fab915848d2b5fd7d9b8c
reader=web/lib/projections/queries/skater-queries.ts
migration=supabase/migrations/20261021182129_forge_latest_rolling_rows.sql

fail() { printf '%s\n' "$*" >&2; exit 1; }
[[ $# == 2 ]] || fail "Usage: bash $0 CANDIDATE_CHECKOUT EMPTY_RESULT_DIRECTORY"
script_dir=$(cd -- "$(dirname -- "$0")" && pwd -P)
checkout=$(cd -- "$1" && pwd -P)
patch_file="$script_dir/rolling-lookback.patch"
mkdir -p -- "$2"
out=$(cd -- "$2" && pwd -P)
[[ -z $(ls -A -- "$out") ]] || fail "Result directory already contains files: $out"

if [[ -e "$checkout/.git" ]]; then
  [[ $(git -C "$checkout" rev-parse HEAD) == "$candidate" ]] || fail "Use a disposable checkout of $candidate"
fi
verify_blob() {
  [[ $(git hash-object "$checkout/$1") == "$2" ]] || fail "Candidate blob differs for $1"
}
verify_blob "$reader" ea3a3438b10f17a8fb474b31b45453006ba4ea89
verify_blob "$migration" ad4973807bd6c7896dc0ba8474e3950fd8bfcac0
verify_blob web/package-lock.json 33057759dd474487cfa16b9808777fcae1788930
[[ -x "$checkout/web/node_modules/.bin/vite-node" ]] || fail "Install candidate web lockfile dependencies first"
[[ $(node --version) == "v$(cat "$checkout/web/.nvmrc")" ]] || fail "Use Node $(cat "$checkout/web/.nvmrc")"

if [[ -z ${PG_BIN_DIR:-} ]]; then
  for pg_bin in /usr/lib/postgresql/15/bin /opt/homebrew/opt/postgresql@15/bin /usr/local/opt/postgresql@15/bin; do
    if [[ -x "$pg_bin/postgres" ]]; then PG_BIN_DIR=$pg_bin; break; fi
  done
  if [[ -z ${PG_BIN_DIR:-} ]]; then PG_BIN_DIR=$(dirname "$(command -v postgres)"); fi
fi
[[ -x "$PG_BIN_DIR/postgres" ]] || fail 'Set PG_BIN_DIR to the absolute PostgreSQL 15 bin directory'
postgrest=${POSTGREST_BIN:-$(command -v postgrest || true)}
[[ -x "$postgrest" ]] || fail 'Set POSTGREST_BIN to the absolute PostgREST 16.6 binary path'
pg_version=$("$PG_BIN_DIR/postgres" --version)
postgrest_version=$("$postgrest" --version)
[[ "$pg_version" =~ PostgreSQL\)\ 15\. ]] || fail "Expected PostgreSQL 15, got $pg_version"
[[ "$postgrest_version" =~ (^|[[:space:]])16\.6([[:space:]]|$) ]] || fail "Expected PostgREST 16.6, got $postgrest_version"
printf 'candidate=%s\nnode=%s\npostgres=%s\npostgrest=%s\n' "$candidate" "$(node --version)" "$pg_version" "$postgrest_version" > "$out/versions.txt"

pg_os_user=
if [[ $(id -u) == 0 ]]; then
  pg_os_user=${PG_OS_USER:-postgres}
  command -v runuser >/dev/null || fail 'PostgreSQL needs a nonroot account and runuser'
  pg_os_uid=$(id -u "$pg_os_user") || fail 'PG_OS_USER must name an existing nonroot account'
  [[ $pg_os_uid != 0 ]] || fail 'PG_OS_USER must name a nonroot account'
fi
pg_run() {
  if [[ -n $pg_os_user ]]; then runuser -u "$pg_os_user" -- "$@"; else "$@"; fi
}
runtime=$(mktemp -d /tmp/sfdaily.XXXXXX)
harness="$checkout/web/.sandboxforge-daily-postgrest.ts"
harness_added=false
patched=false
pg_started=false
postgrest_pid=
cleanup() {
  local status=$?
  trap - EXIT
  set +e
  if [[ -n "$postgrest_pid" ]]; then
    kill "$postgrest_pid" 2>/dev/null
    wait "$postgrest_pid" 2>/dev/null
  fi
  if $pg_started; then
    pg_run "$PG_BIN_DIR/pg_ctl" -D "$runtime/data" -m fast -w stop >> "$out/postgres-control.log" 2>&1
    if [[ $? != 0 ]]; then status=1; fi
  fi
  if [[ -f "$runtime/postgresql.log" ]]; then cat "$runtime/postgresql.log" > "$out/postgresql.log"; fi
  if $patched; then
    git -C "$checkout" apply --reverse --include="$reader" "$patch_file" 2>> "$out/cleanup.log"
    if [[ $? != 0 ]]; then status=1; fi
  fi
  if $harness_added; then rm -f -- "$harness"; fi
  rm -r -- "$runtime"
  if [[ $status != 0 ]]; then printf 'Daily scenario failed. Preserved logs in %s\n' "$out" >&2; fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if [[ -n $pg_os_user ]]; then chown "$pg_os_user" "$runtime"; fi
(set -o noclobber; cat "$script_dir/daily-postgrest.ts" > "$harness")
harness_added=true
git -C "$checkout" apply --check --include="$reader" "$patch_file"

run_harness() {
  (cd -- "$checkout/web" && ./node_modules/.bin/vite-node --config vitest.config.mts "$(basename "$harness")" -- "$@")
}
run_harness schema > "$out/fixture.sql" 2> "$out/fixture.log"
pg_run "$PG_BIN_DIR/initdb" -D "$runtime/data" -U postgres -A trust --no-sync > "$out/initdb.log" 2>&1
pg_started=true
pg_run "$PG_BIN_DIR/pg_ctl" -D "$runtime/data" -l "$runtime/postgresql.log" -w -o \
  "-p 5432 -k $runtime -c listen_addresses= -c unix_socket_permissions=0700 -c log_statement=all" start > "$out/postgres-control.log" 2>&1
psql=("$PG_BIN_DIR/psql" -X -h "$runtime" -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1)
"${psql[@]}" -f "$out/fixture.sql" -f "$checkout/$migration" > "$out/schema-and-migration.log" 2>&1
"${psql[@]}" -Atc 'select json_agg(fixture order by player_id, strength_state) from (select player_id, game_id, game_date, season, strength_state from public.rolling_player_game_metrics) fixture;' > "$out/fixture-readback.json"

port=$(python3 - <<'PY'
import socket
with socket.socket() as server:
    server.bind(('127.0.0.1', 0))
    print(server.getsockname()[1])
PY
)
endpoint="http://127.0.0.1:$port"
# This cluster exists only for the fixture, so its anonymous PostgREST role is the synthetic service role.
env -i PATH="$PATH" LC_ALL=C \
  PGRST_DB_URI="postgresql://daily_authenticator@/postgres?host=$runtime&port=5432" \
  PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=service_role \
  PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT="$port" PGRST_LOG_LEVEL=info \
  "$postgrest" > "$out/postgrest.log" 2>&1 &
postgrest_pid=$!
ready=false
for ((attempt=0; attempt<40; attempt++)); do
  kill -0 "$postgrest_pid" 2>/dev/null || fail 'PostgREST exited during startup'
  if curl --noproxy '*' --fail --silent --max-time 1 "$endpoint/rolling_player_game_metrics?select=player_id&limit=1" > "$out/health.json"; then
    ready=true
    break
  fi
  sleep 0.25
done
$ready || fail 'PostgREST failed to serve the fixture table'

run_harness candidate "$endpoint" > "$out/candidate.jsonl" 2> "$out/candidate.log"
git -C "$checkout" apply --include="$reader" "$patch_file"
patched=true
run_harness fixed "$endpoint" > "$out/fixed.jsonl" 2> "$out/fixed.log"
printf 'Validated 18 candidate and 18 fixed reader cases. Evidence in %s\n' "$out"
