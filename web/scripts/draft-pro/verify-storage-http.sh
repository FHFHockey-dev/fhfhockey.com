#!/usr/bin/env bash
# Local-only Storage HTTP acceptance for Draft Pro private imports.
set -euo pipefail

readonly PG_IMAGE="public.ecr.aws/supabase/postgres:15.8.1.085"
readonly STORAGE_IMAGE="public.ecr.aws/supabase/storage-api:v1.69.0"
readonly BASELINE="supabase/migrations/20260716112908_production_schema_baseline.sql"
readonly ROOT="draft-pro-storage-${RANDOM}${RANDOM}"
readonly DB_CONTAINER="${ROOT}-db"
readonly API_CONTAINER="${ROOT}-api"
readonly NETWORK="${ROOT}-net"
readonly PASSWORD="draft_pro_storage_local_only"
readonly STORAGE_JWT_SECRET="draft-pro-storage-http-local-secret"
readonly WORK="$(mktemp -d)"
schema_container=""

cleanup() {
  [[ -z "$schema_container" ]] || docker rm -f "$schema_container" >/dev/null 2>&1 || true
  docker rm -f "$API_CONTAINER" "$DB_CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

[[ -f "$BASELINE" ]] || { echo "Missing baseline: $BASELINE" >&2; exit 66; }

jwt() {
  local role="$1" subject="${2:-}"
  JWT_ROLE="$role" JWT_SUBJECT="$subject" TOKEN_SIGNING_KEY="$STORAGE_JWT_SECRET" node - <<'NODE'
const crypto = require("crypto");
const enc = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const header = enc({ alg: "HS256", typ: "JWT" });
const payload = enc({ role: process.env.JWT_ROLE, ...(process.env.JWT_SUBJECT ? { sub: process.env.JWT_SUBJECT } : {}), exp: Math.floor(Date.now() / 1000) + 3600 });
const signature = crypto.createHmac("sha256", process.env.TOKEN_SIGNING_KEY).update(`${header}.${payload}`).digest("base64url");
process.stdout.write(`${header}.${payload}.${signature}`);
NODE
}

docker network create "$NETWORK" >/dev/null
docker run --detach --rm --name "$DB_CONTAINER" --network "$NETWORK" --network-alias db \
  --env "POSTGRES_PASSWORD=$PASSWORD" "$PG_IMAGE" >/dev/null

for _ in $(seq 1 30); do
  docker exec "$DB_CONTAINER" pg_isready --username postgres --dbname postgres >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$DB_CONTAINER" pg_isready --username postgres --dbname postgres >/dev/null

psql_pg() { docker exec -i "$DB_CONTAINER" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres "$@"; }
psql_storage() { docker exec --env "PGPASSWORD=$PASSWORD" -i "$DB_CONTAINER" psql --set ON_ERROR_STOP=1 --host 127.0.0.1 --username supabase_admin --dbname postgres "$@"; }

schema_container="${ROOT}-schema"
docker create --name "$schema_container" "$STORAGE_IMAGE" >/dev/null
for migration in 0008-add-public-to-buckets.sql 0013-add-bucket-custom-limits.sql 0014-use-bytes-for-max-size.sql; do
  docker cp "$schema_container:/app/migrations/tenant/$migration" "$WORK/$migration"
  psql_storage < "$WORK/$migration" >/dev/null
done
docker rm "$schema_container" >/dev/null
schema_container=""
psql_pg < "$BASELINE" >/dev/null
psql_pg < supabase/migrations/20260907143356_draft_pro_foundation.sql >/dev/null
psql_pg < supabase/migrations/20260907145602_draft_pro_stripe_fulfillment.sql >/dev/null
psql_pg < supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql >/dev/null
psql_pg <<'SQL' >/dev/null
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000031', 'authenticated', 'authenticated', 'storage-a@example.invalid', '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000032', 'authenticated', 'authenticated', 'storage-b@example.invalid', '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;
SQL

bucket_config="$(psql_pg --tuples-only --no-align --command "select public::text || '|' || file_size_limit::text || '|' || array_to_string(allowed_mime_types, ',') from storage.buckets where id='draft-pro-private-imports'")"
[[ "$bucket_config" == 'false|10485760|text/csv,application/json' ]] || { echo "Migrated private bucket config was unexpected: $bucket_config" >&2; exit 1; }

anon_key="$(jwt anon)"
service_key="$(jwt service_role)"
user_a="$(jwt authenticated 00000000-0000-4000-8000-000000000031)"
user_b="$(jwt authenticated 00000000-0000-4000-8000-000000000032)"
storage_dir="$WORK/files"
mkdir -p "$storage_dir"
docker run --detach --rm --name "$API_CONTAINER" --network "$NETWORK" \
  --env "DATABASE_URL=postgres://supabase_admin:$PASSWORD@db:5432/postgres" \
  --env "AUTH_JWT_SECRET=$STORAGE_JWT_SECRET" --env "ANON_KEY=$anon_key" --env "SERVICE_KEY=$service_key" \
  --env "STORAGE_BACKEND=file" --env "STORAGE_FILE_BACKEND_PATH=/var/lib/storage" \
  --env "REGION=local" --env "FILE_SIZE_LIMIT=10485760" --volume "$storage_dir:/var/lib/storage" \
  --publish 127.0.0.1::5000 "$STORAGE_IMAGE" >/dev/null

for _ in $(seq 1 30); do
  api_port="$(docker port "$API_CONTAINER" 5000/tcp 2>/dev/null || true)"
  [[ "$api_port" == 127.0.0.1:* ]] && curl --silent --fail "http://${api_port}/status" >/dev/null 2>&1 && break
  sleep 1
done
[[ "${api_port:-}" == 127.0.0.1:* ]] || { docker logs "$API_CONTAINER" >&2; exit 1; }
base="http://${api_port}"

status() {
  local token="$1" method="$2" path="$3" data="${4:-}"
  if [[ -n "$data" ]]; then
    curl --silent --output "$WORK/body" --write-out '%{http_code}' -X "$method" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' --data-binary "$data" "$base$path"
  else
    curl --silent --output "$WORK/body" --write-out '%{http_code}' -X "$method" -H "Authorization: Bearer $token" "$base$path"
  fi
}
expect_no_access() { local result; result="$(status "$1" "$2" "$3" "${4:-}")"; [[ ! "$result" =~ ^2 ]] || { echo "Expected no access for $2 $3, got $result" >&2; cat "$WORK/body" >&2; exit 1; }; }
expect_empty_list() { local result; result="$(status "$1" POST "/object/list/draft-pro-private-imports" '{"prefix":""}')"; [[ "$result" == 200 && "$(cat "$WORK/body")" == '[]' ]] || { echo "Expected private list to be empty, got $result" >&2; cat "$WORK/body" >&2; exit 1; }; }

object='draft-pro-imports/normalized.json'
payload='{"players":["fixture"]}'
upload_status="$(status "$service_key" POST "/object/draft-pro-private-imports/$object" "$payload")"
[[ "$upload_status" =~ ^(200|201)$ ]] || { echo "Service upload failed: $upload_status" >&2; cat "$WORK/body" >&2; exit 1; }
download_status="$(status "$service_key" GET "/object/draft-pro-private-imports/$object")"
[[ "$download_status" == 200 && "$(cat "$WORK/body")" == "$payload" ]] || { echo "Service roundtrip failed" >&2; exit 1; }

for token in "$anon_key" "$user_a" "$user_b"; do
  expect_no_access "$token" GET "/object/draft-pro-private-imports/$object"
  expect_empty_list "$token"
  expect_no_access "$token" POST "/object/draft-pro-private-imports/blocked.json" "$payload"
done

delete_payload="{\"prefixes\":[\"$object\",\"draft-pro-imports/missing-0.json\",\"draft-pro-imports/missing-1.json\"]}"
for _ in 1 2; do
  delete_status="$(status "$service_key" DELETE "/object/draft-pro-private-imports" "$delete_payload")"
  [[ "$delete_status" =~ ^(200|204)$ ]] || { echo "Idempotent batch delete failed: $delete_status" >&2; cat "$WORK/body" >&2; exit 1; }
done
deleted_status="$(status "$service_key" GET "/object/draft-pro-private-imports/$object")"
[[ ! "$deleted_status" =~ ^2 ]] || { echo "Deleted object remained readable" >&2; exit 1; }

echo "storage_http=passed; api=${api_port}; users=anon,user-a,user-b; cleanup=idempotent-missing-paths"
