#!/usr/bin/env bash
# Disposable, loopback-only acceptance of the Saved Drafts Next routes.
set -euo pipefail

readonly PG_IMAGE="public.ecr.aws/supabase/postgres:15.8.1.085"
readonly REST_IMAGE="public.ecr.aws/supabase/postgrest:v12.0.2"
readonly AUTH_IMAGE="public.ecr.aws/supabase/gotrue:v2.195.0"
readonly STORAGE_IMAGE="public.ecr.aws/supabase/storage-api:v1.69.0"
readonly ROOT="draft-pro-routes-${RANDOM}${RANDOM}"
readonly DB="$ROOT-db" REST="$ROOT-rest" AUTH="$ROOT-auth" STORAGE="$ROOT-storage" NET="$ROOT-net"
readonly PASSWORD="draft_pro_routes_local_only" JWT_SECRET="draft-pro-routes-local-only-jwt-secret"
readonly WORK="$(mktemp -d)"
next_pid="" gateway_pid="" schema_container=""
cleanup() {
  [[ -z "$next_pid" ]] || kill "$next_pid" >/dev/null 2>&1 || true
  [[ -z "$gateway_pid" ]] || kill "$gateway_pid" >/dev/null 2>&1 || true
  [[ -z "$schema_container" ]] || docker rm -f "$schema_container" >/dev/null 2>&1 || true
  docker rm -f "$STORAGE" "$AUTH" "$REST" "$DB" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT
close_owned_port() {
  node - "$1" <<'NODE'
const net=require('net'); const socket=net.connect(Number(process.argv[2]), '127.0.0.1');
socket.once('connect',()=>process.exit(1)); socket.once('error',()=>process.exit(0));
NODE
}
finish() {
  kill "$next_pid" "$gateway_pid" >/dev/null 2>&1 || true
  wait "$next_pid" "$gateway_pid" 2>/dev/null || true
  next_pid=""; gateway_pid=""
  docker rm -f "$STORAGE" "$AUTH" "$REST" "$DB" >/dev/null
  docker network rm "$NET" >/dev/null
  for _ in $(seq 1 10); do
    ! docker container inspect "$STORAGE" "$AUTH" "$REST" "$DB" >/dev/null 2>&1 && ! docker network inspect "$NET" >/dev/null 2>&1 && close_owned_port "$next_port" && close_owned_port "$gateway_port" && break
    sleep 0.1
  done
  ! docker container inspect "$STORAGE" "$AUTH" "$REST" "$DB" >/dev/null 2>&1
  ! docker network inspect "$NET" >/dev/null 2>&1
  close_owned_port "$next_port"
  close_owned_port "$gateway_port"
  rm -rf "$WORK"
  trap - EXIT
  echo "saved_drafts_routes=passed; auth=gotrue; rest=postgrest; storage=storage-api; cleanup=verified"
}

[[ -d web/node_modules ]] || { echo "web/node_modules is required (reuse an existing workspace install)." >&2; exit 66; }
docker network create "$NET" >/dev/null
docker run -d --rm --name "$DB" --network "$NET" --network-alias db -e "POSTGRES_PASSWORD=$PASSWORD" "$PG_IMAGE" >/dev/null
for _ in $(seq 1 45); do docker exec "$DB" pg_isready -U postgres -d postgres >/dev/null 2>&1 && break; sleep 1; done
docker exec "$DB" pg_isready -U postgres -d postgres >/dev/null
pg() { docker exec -i "$DB" psql -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }
pg_storage() { docker exec -e "PGPASSWORD=$PASSWORD" -i "$DB" psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U supabase_admin -d postgres "$@"; }
for _ in $(seq 1 45); do pg_storage -c 'select 1' >/dev/null 2>&1 && break; sleep 1; done
pg_storage -c 'select 1' >/dev/null

schema_container="$ROOT-storage-schema"; docker create --name "$schema_container" "$STORAGE_IMAGE" >/dev/null
for migration in 0008-add-public-to-buckets.sql 0013-add-bucket-custom-limits.sql 0014-use-bytes-for-max-size.sql; do docker cp "$schema_container:/app/migrations/tenant/$migration" "$WORK/$migration"; pg_storage < "$WORK/$migration" >/dev/null; done
docker rm "$schema_container" >/dev/null; schema_container=""
pg < supabase/migrations/20260716112908_production_schema_baseline.sql >/dev/null
pg < supabase/migrations/20260907143356_draft_pro_foundation.sql >/dev/null
pg < supabase/migrations/20260907145602_draft_pro_stripe_fulfillment.sql >/dev/null
pg < supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql >/dev/null
if [[ "${DRAFT_PRO_REPORTS_ONLY:-false}" == true || "${DRAFT_PRO_REPORTS_BROWSER_ONLY:-false}" == true ]]; then
  pg < supabase/migrations/20260829161013_add_roster_optimizer_team_game_schedule.sql >/dev/null
fi
pg_storage <<SQL >/dev/null
alter role authenticator password '$PASSWORD';
alter role supabase_auth_admin password '$PASSWORD';
alter table auth.users add column if not exists email_change_token_new varchar(255), add column if not exists email_change_token_current varchar(255), add column if not exists reauthentication_token varchar(255), add column if not exists phone_change text, add column if not exists phone_change_token varchar(255);
SQL
pg <<'SQL' >/dev/null
insert into auth.users (instance_id,id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000','00000000-0000-4000-8000-000000000041','authenticated','authenticated','route-a@example.invalid','{}','{}'),
       ('00000000-0000-0000-0000-000000000000','00000000-0000-4000-8000-000000000042','authenticated','authenticated','route-b@example.invalid','{}','{}')
on conflict (id) do nothing;
update auth.users set confirmation_token='', recovery_token='', email_change='', email_change_token_new='', email_change_token_current='', reauthentication_token='', phone_change='', phone_change_token='', created_at=now(), updated_at=now() where id in ('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000042');
insert into public.user_entitlements (user_id,source_provider,entitlement_key,entitlement_status,source_reference,effective_from,effective_to)
values ('00000000-0000-4000-8000-000000000041','stripe','draft_pro','active','route-a',now()-interval '1 day','2027-07-01T04:00:00Z'),
       ('00000000-0000-4000-8000-000000000042','stripe','draft_pro','active','route-b',now()-interval '1 day','2027-07-01T04:00:00Z');
SQL

token() { TOKEN_ROLE="$1" TOKEN_SUBJECT="${2:-}" TOKEN_EMAIL="${3:-}" TOKEN_SECRET="$JWT_SECRET" node - <<'NODE'
const crypto=require('crypto'); const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const h=enc({alg:'HS256',typ:'JWT'}), p=enc({aud:'authenticated',role:process.env.TOKEN_ROLE,sub:process.env.TOKEN_SUBJECT,email:process.env.TOKEN_EMAIL,jti:process.env.TOKEN_JTI,exp:Math.floor(Date.now()/1000)+3600});
process.stdout.write(`${h}.${p}.${crypto.createHmac('sha256',process.env.TOKEN_SECRET).update(`${h}.${p}`).digest('base64url')}`);
NODE
}
anon_key="$(token anon)"; service_key="$(token service_role)"; user_a="$(TOKEN_JTI=device-a token authenticated 00000000-0000-4000-8000-000000000041 route-a@example.invalid)"; user_a_second="$(TOKEN_JTI=device-b token authenticated 00000000-0000-4000-8000-000000000041 route-a@example.invalid)"; user_b="$(token authenticated 00000000-0000-4000-8000-000000000042 route-b@example.invalid)"
storage_files="$WORK/storage"; mkdir -p "$storage_files"
docker run -d --name "$REST" --network "$NET" --publish 127.0.0.1::3000 -e "PGRST_DB_URI=postgres://authenticator:$PASSWORD@db:5432/postgres" -e "PGRST_DB_SCHEMAS=public,storage" -e "PGRST_DB_ANON_ROLE=anon" -e "PGRST_JWT_SECRET=$JWT_SECRET" "$REST_IMAGE" >/dev/null
docker run -d --name "$AUTH" --network "$NET" --publish 127.0.0.1::9999 -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=9999 -e "GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:$PASSWORD@db:5432/postgres" -e GOTRUE_DB_DRIVER=postgres -e "GOTRUE_JWT_SECRET=$JWT_SECRET" -e GOTRUE_SITE_URL=http://localhost -e API_EXTERNAL_URL=http://localhost -e GOTRUE_INSTANCE_ID=00000000-0000-0000-0000-000000000000 -e GOTRUE_DISABLE_SIGNUP=true "$AUTH_IMAGE" >/dev/null
docker run -d --name "$STORAGE" --network "$NET" --publish 127.0.0.1::5000 -e "DATABASE_URL=postgres://supabase_admin:$PASSWORD@db:5432/postgres" -e "AUTH_JWT_SECRET=$JWT_SECRET" -e "ANON_KEY=$anon_key" -e "SERVICE_KEY=$service_key" -e STORAGE_BACKEND=file -e STORAGE_FILE_BACKEND_PATH=/var/lib/storage -e REGION=local -v "$storage_files:/var/lib/storage" "$STORAGE_IMAGE" >/dev/null
for container in "$REST" "$AUTH" "$STORAGE"; do
  if ! docker container inspect "$container" >/dev/null 2>&1; then
    docker logs "$container" >&2 || true
    exit 1
  fi
done
rest_port="$(docker port "$REST" 3000/tcp | sed 's/.*://')"
auth_port="$(docker port "$AUTH" 9999/tcp | sed 's/.*://')"
storage_port="$(docker port "$STORAGE" 5000/tcp | sed 's/.*://')"
# A deliberately tiny local-only gateway gives all three real Supabase APIs one base URL.
REST_PORT="$rest_port" AUTH_PORT="$auth_port" STORAGE_PORT="$storage_port" GATEWAY_FILE="$WORK/gateway-port" node - <<'NODE' >/dev/null 2>&1 &
const http=require('http'),fs=require('fs'); const targets={auth:'127.0.0.1:'+process.env.AUTH_PORT,rest:'127.0.0.1:'+process.env.REST_PORT,storage:'127.0.0.1:'+process.env.STORAGE_PORT};
http.createServer((req,res)=>{const key=req.url.startsWith('/auth/v1')?'auth':req.url.startsWith('/rest/v1')?'rest':req.url.startsWith('/storage/v1')?'storage':null;if(!key){res.writeHead(404);return res.end();}const upstream=http.request({host:targets[key].split(':')[0],port:targets[key].split(':')[1],path:req.url.replace(/^\/(auth|rest|storage)\/v1/,''),method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});upstream.on('error',e=>{res.writeHead(502);res.end(e.message)});req.pipe(upstream)}).listen(0,'127.0.0.1',function(){fs.writeFileSync(process.env.GATEWAY_FILE,String(this.address().port))});
NODE
gateway_pid=$!
for _ in $(seq 1 30); do [[ -s "$WORK/gateway-port" ]] && break; sleep 1; done
gateway_port="$(cat "$WORK/gateway-port")"; gateway="http://127.0.0.1:$gateway_port"
for _ in $(seq 1 45); do curl -sf -H "Authorization: Bearer $user_a" "$gateway/auth/v1/user" >/dev/null && curl -sf "$gateway/rest/v1/" >/dev/null && curl -sf "$gateway/storage/v1/status" >/dev/null && break; sleep 1; done
curl -sf -H "Authorization: Bearer $user_a" "$gateway/auth/v1/user" >/dev/null

next_port="$(node -e 'const net=require("net");const s=net.createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"
(cd web && exec env PLAYER_FORECAST_ISOLATED_NEXT=1 NEXT_PUBLIC_SUPABASE_URL="$gateway" NEXT_PUBLIC_SUPABASE_PUBLIC_KEY="$anon_key" SUPABASE_SERVICE_ROLE_KEY="$service_key" DRAFT_PRO_SAVED_DRAFTS_ENABLED=true DRAFT_PRO_PRIVATE_IMPORTS_ENABLED=true DRAFT_PRO_SCENARIOS_ENABLED=true DRAFT_PRO_REPORTS_ENABLED="${DRAFT_PRO_REPORTS_ENABLED:-${DRAFT_PRO_REPORTS_ONLY:-false}}" NEXT_TELEMETRY_DISABLED=1 ./node_modules/.bin/next dev -H 127.0.0.1 -p "$next_port") >"$WORK/next.log" 2>&1 &
next_pid=$!
for _ in $(seq 1 60); do
  kill -0 "$next_pid" >/dev/null 2>&1 || { cat "$WORK/next.log" >&2; exit 1; }
  [[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$next_port/api/v1/account/draft-pro/drafts")" == 401 ]] && break
  sleep 1
done
kill -0 "$next_pid" >/dev/null 2>&1
[[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$next_port/api/v1/account/draft-pro/drafts")" == 401 ]]
export NEXT_URL="http://127.0.0.1:$next_port" SUPABASE_GATEWAY="$gateway" USER_A="$user_a" USER_A_SECOND="$user_a_second" USER_B="$user_b" SERVICE_KEY="$service_key"
if [[ "${DRAFT_PRO_SCENARIOS_BROWSER_ONLY:-false}" == true ]]; then
  (cd web && NODE_PATH=.:node_modules ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/draft-pro/verify-scenarios-browser-runner.ts)
  finish
  exit 0
fi
if [[ "${DRAFT_PRO_REPORTS_ONLY:-false}" == true ]]; then
  (cd web && NODE_PATH=.:node_modules ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/draft-pro/verify-reports-routes-runner.ts)
  finish
  exit 0
fi
if [[ "${DRAFT_PRO_REPORTS_BROWSER_ONLY:-false}" == true ]]; then
  (cd web && NODE_PATH=.:node_modules ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/draft-pro/verify-reports-browser-runner.ts)
  finish
  exit 0
fi
if [[ "${DRAFT_PRO_SCENARIOS_ONLY:-false}" == true ]]; then
  (cd web && NODE_PATH=.:node_modules ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/draft-pro/verify-scenarios-routes-runner.ts)
  finish
  exit 0
fi
if [[ "${DRAFT_PRO_BROWSER_ONLY:-false}" != true ]]; then
  (cd web && NODE_PATH=.:node_modules ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/draft-pro/verify-saved-drafts-routes-runner.ts)
fi
if ! (cd web && NODE_PATH=.:node_modules ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/draft-pro/verify-saved-drafts-browser-runner.ts); then
  cat "$WORK/next.log" >&2
  exit 1
fi

finish
