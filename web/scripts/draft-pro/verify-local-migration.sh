#!/usr/bin/env bash

# Replays Draft Pro work against the committed schema baseline in a disposable,
# loopback-only Postgres 15 container. It never targets the repository's
# Supabase CLI instance or any remote database.
set -euo pipefail

readonly IMAGE="public.ecr.aws/supabase/postgres:15.8.1.085"
readonly STORAGE_IMAGE="public.ecr.aws/supabase/storage-api:v1.69.0"
readonly BASELINE="supabase/migrations/20260716112908_production_schema_baseline.sql"
readonly RLS_PROBES="web/scripts/draft-pro/foundation-rls-probes.sql"
readonly CONTAINER="draft-pro-w12-${RANDOM}${RANDOM}"
readonly PASSWORD="draft_pro_w12_local_only"
readonly STORAGE_MIGRATIONS_DIRECTORY="$(mktemp -d)"
readonly STORAGE_MIGRATIONS_CONTAINER="${CONTAINER}-storage-schema"

if [[ $# -gt 3 ]]; then
  echo "Usage: $0 [foundation migration] [follow-on migration] [transaction migration]" >&2
  exit 64
fi

if [[ ! -f "$BASELINE" ]]; then
  echo "Missing committed baseline: $BASELINE" >&2
  exit 66
fi

migrations=("$@")
for migration in "${migrations[@]}"; do
if [[ -n "$migration" ]]; then
  if [[ "$migration" == *:* ]]; then
    case "$migration" in
      [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*:supabase/migrations/*.sql) ;;
      *)
        echo "Git migration must use <commit>:supabase/migrations/<file>.sql." >&2
        exit 64
        ;;
    esac
    git cat-file -e "$migration"
  else
    case "$migration" in
      supabase/migrations/*.sql) ;;
      *)
        echo "Migration must be a committed file under supabase/migrations/." >&2
        exit 64
        ;;
    esac
    git ls-files --error-unmatch -- "$migration" >/dev/null
  fi
fi
done

extra_probe="${DRAFT_PRO_EXTRA_PROBE:-}"
if [[ -n "$extra_probe" ]]; then
  case "$extra_probe" in
    [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*:web/scripts/draft-pro/*.sql) ;;
    *) echo "DRAFT_PRO_EXTRA_PROBE must use <commit>:web/scripts/draft-pro/<file>.sql." >&2; exit 64 ;;
  esac
  git cat-file -e "$extra_probe"
fi

cleanup() {
  docker rm -f "$STORAGE_MIGRATIONS_CONTAINER" >/dev/null 2>&1 || true
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$STORAGE_MIGRATIONS_DIRECTORY"
}
trap cleanup EXIT

docker run --detach --rm --name "$CONTAINER" \
  --env "POSTGRES_PASSWORD=$PASSWORD" \
  --publish 127.0.0.1::5432 \
  "$IMAGE" >/dev/null

for _ in $(seq 1 30); do
  init_log="$(docker logs "$CONTAINER" 2>&1)"
  if grep -Fq "PostgreSQL init process complete; ready for start up." <<< "$init_log" \
    && docker exec "$CONTAINER" pg_isready --username postgres --dbname postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

init_log="$(docker logs "$CONTAINER" 2>&1)"
if ! grep -Fq "PostgreSQL init process complete; ready for start up." <<< "$init_log" \
  || ! docker exec "$CONTAINER" pg_isready --username postgres --dbname postgres >/dev/null 2>&1; then
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

psql_storage_migration() {
  docker exec --env "PGPASSWORD=$PASSWORD" -i "$CONTAINER" \
    psql --set ON_ERROR_STOP=1 --host 127.0.0.1 --username supabase_admin --dbname postgres "$@"
}

# The database image contains the historic storage schema. Apply the current
# Storage service's additive bucket migrations before testing application SQL.
docker create --name "$STORAGE_MIGRATIONS_CONTAINER" "$STORAGE_IMAGE" >/dev/null
for storage_migration in 0008-add-public-to-buckets.sql 0013-add-bucket-custom-limits.sql 0014-use-bytes-for-max-size.sql; do
  docker cp "$STORAGE_MIGRATIONS_CONTAINER:/app/migrations/tenant/$storage_migration" \
    "$STORAGE_MIGRATIONS_DIRECTORY/$storage_migration"
  psql_storage_migration < "$STORAGE_MIGRATIONS_DIRECTORY/$storage_migration" >/dev/null
done
docker rm "$STORAGE_MIGRATIONS_CONTAINER" >/dev/null

psql_in_container < "$BASELINE" >/dev/null
psql_in_container --tuples-only --no-align --command "
  select 'baseline=' || current_database() || ':' || current_user ||
         '; auth_users=' || (to_regclass('auth.users') is not null)::text ||
         '; entitlements=' || (to_regclass('public.user_entitlements') is not null)::text;
"

if [[ ${#migrations[@]} -gt 0 ]]; then
  for migration in "${migrations[@]}"; do
  if [[ "$migration" == *:* ]]; then
    git show "$migration" | psql_in_container >/dev/null
  else
    psql_in_container < "$migration" >/dev/null
  fi
  echo "migration=$migration"
  done
  psql_in_container --tuples-only --no-align --command "
    select 'public_tables=' || count(*)
    from pg_catalog.pg_class
    where relnamespace = 'public'::regnamespace and relkind = 'r';
  "
  psql_in_container < "$RLS_PROBES"
  if [[ ${#migrations[@]} -ge 2 ]]; then
    web/scripts/draft-pro/stripe-concurrency-probes.sh "$CONTAINER"
  fi
  if [[ -n "$extra_probe" ]]; then
    git show "$extra_probe" | psql_in_container
    echo "probe=$extra_probe"
  fi
fi

echo "isolation=container:${CONTAINER}; binding:${port_binding}; cleanup=automatic"
