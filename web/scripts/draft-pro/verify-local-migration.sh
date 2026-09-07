#!/usr/bin/env bash

# Replays Draft Pro work against the committed schema baseline in a disposable,
# loopback-only Postgres 15 container. It never targets the repository's
# Supabase CLI instance or any remote database.
set -euo pipefail

readonly IMAGE="public.ecr.aws/supabase/postgres:15.8.1.085"
readonly BASELINE="supabase/migrations/20260716112908_production_schema_baseline.sql"
readonly CONTAINER="draft-pro-w12-${RANDOM}${RANDOM}"
readonly PASSWORD="draft_pro_w12_local_only"

if [[ $# -gt 1 ]]; then
  echo "Usage: $0 [supabase/migrations/draft_pro_migration.sql]" >&2
  exit 64
fi

if [[ ! -f "$BASELINE" ]]; then
  echo "Missing committed baseline: $BASELINE" >&2
  exit 66
fi

migration="${1:-}"
if [[ -n "$migration" ]]; then
  case "$migration" in
    supabase/migrations/*.sql) ;;
    *)
      echo "Migration must be a committed file under supabase/migrations/." >&2
      exit 64
      ;;
  esac
  git ls-files --error-unmatch -- "$migration" >/dev/null
fi

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run --detach --rm --name "$CONTAINER" \
  --env "POSTGRES_PASSWORD=$PASSWORD" \
  --publish 127.0.0.1::5432 \
  "$IMAGE" >/dev/null

for _ in $(seq 1 30); do
  if docker logs "$CONTAINER" 2>&1 | grep -Fq "PostgreSQL init process complete; ready for start up." \
    && docker exec "$CONTAINER" pg_isready --username postgres --dbname postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec "$CONTAINER" pg_isready --username postgres --dbname postgres >/dev/null 2>&1; then
  echo "Disposable Draft Pro database did not become ready." >&2
  exit 1
fi

port_binding="$(docker port "$CONTAINER" 5432/tcp)"
if [[ "$port_binding" != 127.0.0.1:* ]] || [[ "$port_binding" == "127.0.0.1:54322" ]]; then
  echo "Refusing unexpected database binding: $port_binding" >&2
  exit 1
fi

psql_in_container() {
  docker exec -i "$CONTAINER" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres "$@"
}

psql_in_container < "$BASELINE" >/dev/null
psql_in_container --tuples-only --no-align --command "
  select 'baseline=' || current_database() || ':' || current_user ||
         '; auth_users=' || (to_regclass('auth.users') is not null)::text ||
         '; entitlements=' || (to_regclass('public.user_entitlements') is not null)::text;
"

if [[ -n "$migration" ]]; then
  psql_in_container < "$migration" >/dev/null
  psql_in_container --tuples-only --no-align --command "
    select 'migration=' || '$migration' ||
           '; public_tables=' || count(*)
    from pg_catalog.pg_class
    where relnamespace = 'public'::regnamespace and relkind = 'r';
  "
fi

echo "isolation=container:${CONTAINER}; binding:${port_binding}; cleanup=automatic"
