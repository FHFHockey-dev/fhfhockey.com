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

[[ -d web/node_modules ]] || { echo "web/node_modules is required (reuse an existing workspace install)." >&2; exit 66; }
docker network create "$NET" >/dev/null
docker run -d --rm --name "$DB" --network "$NET" --network-alias db -e "POSTGRES_PASSWORD=$PASSWORD" "$PG_IMAGE" >/dev/null
for _ in $(seq 1 45); do docker exec "$DB" pg_isready -U postgres -d postgres >/dev/null 2>&1 && break; sleep 1; done
docker exec "$DB" pg_isready -U postgres -d postgres >/dev/null
pg() { docker exec -i "$DB" psql -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }
pg_storage() { docker exec -e "PGPASSWORD=$PASSWORD" -i "$DB" psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U supabase_admin -d postgres "$@"; }

schema_container="$ROOT-storage-schema"; docker create --name "$schema_container" "$STORAGE_IMAGE" >/dev/null
for migration in 0008-add-public-to-buckets.sql 0013-add-bucket-custom-limits.sql 0014-use-bytes-for-max-size.sql; do docker cp "$schema_container:/app/migrations/tenant/$migration" "$WORK/$migration"; pg_storage < "$WORK/$migration" >/dev/null; done
docker rm "$schema_container" >/dev/null; schema_container=""
pg < supabase/migrations/20260716112908_production_schema_baseline.sql >/dev/null
pg < supabase/migrations/20260907143356_draft_pro_foundation.sql >/dev/null
pg < supabase/migrations/20260907145602_draft_pro_stripe_fulfillment.sql >/dev/null
pg < supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql >/dev/null
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
const h=enc({alg:'HS256',typ:'JWT'}), p=enc({aud:'authenticated',role:process.env.TOKEN_ROLE,sub:process.env.TOKEN_SUBJECT,email:process.env.TOKEN_EMAIL,exp:Math.floor(Date.now()/1000)+3600});
process.stdout.write(`${h}.${p}.${crypto.createHmac('sha256',process.env.TOKEN_SECRET).update(`${h}.${p}`).digest('base64url')}`);
NODE
}
anon_key="$(token anon)"; service_key="$(token service_role)"; user_a="$(token authenticated 00000000-0000-4000-8000-000000000041 route-a@example.invalid)"; user_b="$(token authenticated 00000000-0000-4000-8000-000000000042 route-b@example.invalid)"
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

next_port="$((41000 + RANDOM % 1000))"
(cd web && PLAYER_FORECAST_ISOLATED_NEXT=1 NEXT_PUBLIC_SUPABASE_URL="$gateway" NEXT_PUBLIC_SUPABASE_PUBLIC_KEY="$anon_key" SUPABASE_SERVICE_ROLE_KEY="$service_key" DRAFT_PRO_SAVED_DRAFTS_ENABLED=true DRAFT_PRO_PRIVATE_IMPORTS_ENABLED=true NEXT_TELEMETRY_DISABLED=1 ./node_modules/.bin/next dev -H 127.0.0.1 -p "$next_port") >"$WORK/next.log" 2>&1 &
next_pid=$!
for _ in $(seq 1 60); do [[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$next_port/api/v1/account/draft-pro/drafts")" == 401 ]] && break; sleep 1; done

NEXT_URL="http://127.0.0.1:$next_port" USER_A="$user_a" USER_B="$user_b" node - <<'NODE'
const assert=require('assert/strict'); const base=process.env.NEXT_URL, a=process.env.USER_A,b=process.env.USER_B;
const call=async(path,token,method='GET',body,headers={})=>{const r=await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,...headers,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,json:await r.json()}};
const snapshot={settings:{league:'fixture'},picks:[{playerId:11,round:1}],keepers:[],trades:[],team:{id:3},sourceWeights:{a:1},importMappings:{fixture:true},favorites:[11,'12'],notes:[{id:'n1',text:'route fixture'}],tiers:{one:[11]},recommendationPreferences:{mode:'fixture'}};
(async()=>{const attempt='22222222-2222-4222-8222-222222222222'; const begin=await call('/api/v1/account/draft-pro/private-imports',a,'POST',{draftId:null,expectedVersion:null,attemptKey:attempt,name:'normalized',mapping:{sourceId:'fixture',headers:[{original:'Player',standardized:'player',selected:true}]},declaredMaxBytes:1024});assert.equal(begin.status,201);const u=begin.json.data.upload;const rows=Buffer.from(JSON.stringify([{player:'fixture',rank:1}]));const response=await fetch(base+`/api/v1/account/draft-pro/private-imports/${u.upload_id}/chunks/0`,{method:'PUT',headers:{Authorization:`Bearer ${a}`,'x-draft-pro-upload-prefix':u.storage_prefix,'content-type':'application/octet-stream'},body:rows});const put={status:response.status,json:await response.json()};assert.equal(put.status,201,JSON.stringify(put.json));const staged=await call(`/api/v1/account/draft-pro/private-imports/${u.upload_id}/stage`,a,'POST',{chunkPaths:[put.json.data.path]});assert.equal(staged.status,201);const saved=await call('/api/v1/account/draft-pro/drafts',a,'POST',{name:'Route fixture',snapshot,attemptKey:attempt});assert.equal(saved.status,201);const id=saved.json.data.id;const restored=await call(`/api/v1/account/draft-pro/drafts/${id}`,a);assert.equal(restored.status,200);assert.deepEqual(restored.json.data.snapshot,snapshot);assert.equal(restored.json.data.privateImports.length,1);const forbidden=await call(`/api/v1/account/draft-pro/drafts/${id}`,b);assert.notEqual(forbidden.status,200);const stale=await call(`/api/v1/account/draft-pro/drafts/${id}`,a,'PUT',{name:'new',snapshot,expectedVersion:99,attemptKey:'33333333-3333-4333-8333-333333333333'});assert.equal(stale.status,409);console.log(`routes=passed; draft=${id}; imports=${restored.json.data.privateImports.length}; conflict=${stale.status}`);})().catch(e=>{console.error(e);process.exit(1)});
NODE

(cd web && { ./node_modules/.bin/tsc --module commonjs --target es2022 --baseUrl . --esModuleInterop --skipLibCheck --noEmitOnError false --outDir "$WORK/runner" scripts/draft-pro/verify-saved-drafts-routes-runner.ts >/dev/null 2>&1 || true; } && NODE_PATH="$WORK/runner:.:node_modules" NEXT_URL="http://127.0.0.1:$next_port" SUPABASE_GATEWAY="$gateway" USER_A="$user_a" USER_B="$user_b" SERVICE_KEY="$service_key" node "$WORK/runner/scripts/draft-pro/verify-saved-drafts-routes-runner.js")

echo "saved_drafts_routes=passed; auth=gotrue; rest=postgrest; storage=storage-api; cleanup=automatic"
