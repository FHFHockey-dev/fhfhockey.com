#!/usr/bin/env bash
# Usage: bash fxtwitter-test.sh /absolute/path/to/schema-only-db-schema.sql [--run local_command [args...]]
# Creates a new socket-only PostgreSQL instance; ignores ambient connection credentials.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../../.." && pwd)
schema=${1:?supply a schema-only export of the hosted Luna schemas and the two public intake tables}
pgbin=${FX_TEST_PGBIN:-/opt/homebrew/opt/postgresql@15/bin}
tmp=$(mktemp -d /tmp/lunafx.XXXXXXXX)
cleanup() {
  if [[ -e "$tmp/data/postmaster.pid" ]]; then "$pgbin/pg_ctl" -D "$tmp/data" -m immediate -w stop >/dev/null; fi
  rm -rf "$tmp"
}
trap cleanup EXIT
unset PGHOSTADDR PGSERVICE PGSERVICEFILE PGPASSWORD PGPASSFILE PGOPTIONS PGPORT PGDATABASE PGUSER PGHOST
"$pgbin/initdb" -U fx_owner -A trust --no-locale -E UTF8 -D "$tmp/data" >/dev/null
"$pgbin/pg_ctl" -D "$tmp/data" -o "-c listen_addresses='' -k $tmp" -l "$tmp/postgres.log" -w start >/dev/null
psql_local=("$pgbin/psql" -X -h "$tmp" -U fx_owner -d postgres -v ON_ERROR_STOP=1 -q)
"${psql_local[@]}" -c 'create role anon; create role authenticated; create role service_role bypassrls'
# pg_dump -t omitted the existing table trigger function. Load just that function
# verbatim from its owning migration. transaction_timeout is pg_dump 18 boilerplate.
sed -n '/^create or replace function public.tweet_intake_providers_touch()/,/^\$\$;/p' "$root/supabase/migrations/20261106200000_tweet_intake_providers.sql" | "${psql_local[@]}"
sed '/^SET transaction_timeout = 0;$/d' "$schema" | "${psql_local[@]}" >/dev/null
"${psql_local[@]}" -f "$root/supabase/migrations/20261121205959_luna_fxtwitter_receipts.sql"
"${psql_local[@]}" -f "$root/supabase/migrations/20261122001000_luna_fxtwitter_empty_rollover.sql"
if [[ ${2:-} == --run ]]; then
  shift 2
  export PGHOST="$tmp" PGUSER=fx_owner PGPORT=5432 PGDATABASE=postgres
  "$@"
else
  "${psql_local[@]}" -f "$here/fxtwitter.test.sql"
fi
