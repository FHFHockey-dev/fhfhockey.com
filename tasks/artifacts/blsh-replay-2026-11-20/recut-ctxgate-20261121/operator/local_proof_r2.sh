#!/usr/bin/env bash
# Recut R' copy of local_proof.sh (2026-11-21). Differences from the original, nothing else:
#   * it must run on a real UTC day OTHER than 2026-11-20 (2026-11-21..2026-11-26), proving R''s replay-only context date gate;
#   * it arms with hosted-r2/arm-replay-get-dated.sql and arm-replay-get-repeat-dated.sql (run_date = today, schedules computed
#     from now) and first proves on this disposable Postgres that they refuse bad dates and schedules, and that the pinned
#     originals refuse today; the operator readback uses hosted-r2/readback_export_dated.py (replayCaptureDay = today);
#   * the decoy live context key keeps its private half (in RUN, 0600) so a correctly signed live grant can be sent to the LIVE
#     context route, which must still refuse it as outside_approved_date with no writes;
#   * after the unchanged 24-check proof.json, negatives.json gates those controls plus the receipt's unapproved/mismatched grants.
# Usage: bash local_proof_r2.sh ENVELOPE.tar.gz EMPTY_RUN_DIR   (POSTGREST_BIN must point at PostgREST 16.6)
# Stand-in for the live project: Supabase-like roles, the real BLSH migrations in public with the live switch OFF, plus the
# sandbox from install.sql (generated from the Drive envelope). PostgREST exposes public + blsh_replay_api, as the proposed
# Exposed-schemas change would. The isolated Next server (sandbox-exec: loopback only) has a canary service-role key and NST
# key, a decoy live context public key, and the sandbox token. Then:
#   GET 1 (expect a complete replay), GET 2 (expect nothing new), the denial matrix, isolation-check.sql, and a byte
#   comparison of every schema outside the sandbox before and after.
set -euo pipefail
umask 077
export LC_ALL=C LANG=C
fail() { printf 'FAIL %s\n' "$*" >&2; exit 1; }
[[ $# == 2 ]] || fail "usage: bash $0 ENVELOPE.tar.gz EMPTY_RUN_DIR"
HOSTED=$(cd -- "$(dirname -- "$0")" && pwd -P)
ROOT=$(cd -- "$HOSTED/../../../.." && pwd -P)
V6="$ROOT/tasks/artifacts/blsh-pilot-readiness-2026-11-14/sandbox-2026-11-19/harness"
WEB="$ROOT/web"
ENVELOPE=$(cd -- "$(dirname -- "$1")" && pwd -P)/$(basename -- "$1")
mkdir -p -- "$2"; RUN=$(cd -- "$2" && pwd -P)
[[ -z $(ls -A -- "$RUN") ]] || fail "run dir not empty"
case "$RUN/" in "$ROOT"/*) fail "run dir must be outside the checkout";; esac
RUN_DATE=$(date -u +%F)
[[ $RUN_DATE > 2026-11-20 && $RUN_DATE < 2026-11-27 ]] || fail "R' proof runs on a real UTC day other than the slate's day + 1 (2026-11-21..2026-11-26)"
[[ $(date -u +%H%M) < 2320 ]] || fail "too close to 00:00Z: both stages, the repeat and the rerun must stay on one real UTC day"
OPS="$ROOT/tasks/artifacts/blsh-replay-2026-11-20/hosted-r2"
POSTGREST_BIN=${POSTGREST_BIN:?set POSTGREST_BIN}
PSQL=${PSQL_BIN:-/opt/homebrew/opt/libpq/bin/psql}
PGDUMP=${PG_DUMP_BIN:-/opt/homebrew/opt/postgresql@15/bin/pg_dump}
NODE=$(command -v node)
PG_PORT=55491; PGRST_PORT=55492; FRONT_PORT=55493; NEXT_PORT=3197
for p in $PG_PORT $PGRST_PORT $FRONT_PORT $NEXT_PORT; do if (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null; then fail "port $p busy"; fi; done
CRON_SECRET=$(openssl rand -hex 24)
SHA=$(git -C "$ROOT" rev-parse HEAD)
DEPLOYMENT_ID=dpl_blsh_replay_local_proof
exec > >(tee -a "$RUN/run.log") 2>&1
pids=()
cleanup() {
  local status=$?; trap - EXIT; set +e
  for pid in ${pids[@]+"${pids[@]}"}; do kill "$pid" 2>/dev/null; done
  sleep 1
  [[ -f "$RUN/postgres.pid" ]] && kill -INT "$(cat "$RUN/postgres.pid")" 2>/dev/null
  for _ in $(seq 20); do (exec 3<>"/dev/tcp/127.0.0.1/$NEXT_PORT") 2>/dev/null || break; sleep 0.5; done
  if (exec 3<>"/dev/tcp/127.0.0.1/$NEXT_PORT") 2>/dev/null; then echo "WARNING: port $NEXT_PORT still open; env files left in $RUN/envfiles"; exit 1; fi
  for f in .env.development .env.production .env.test; do [[ -f "$RUN/envfiles/$f" ]] && mv "$RUN/envfiles/$f" "$WEB/$f"; done
  echo "cleanup done (exit $status)"; exit $status
}
trap cleanup EXIT

echo "== generate the sandbox SQL from the envelope (refused unless sha256 f2525c71...)"
python3 -I "$HOSTED/sandbox_sql.py" "$ENVELOPE" "$RUN/sql" | tee "$RUN/sandbox-sql.json"

echo "== production stand-in: PG15, Supabase-like roles, the real BLSH migrations in public (live switch stays off)"
mkdir -p "$RUN/noop-pilot"; echo "select 1;" > "$RUN/noop-pilot/INSTALL.sql"; echo "select 1;" > "$RUN/noop-pilot/ARM.sql"
echo "+0.000" > "$RUN/clock.rc"
printf '{"pgPort":%s,"clockFile":"%s","releaseSha":"%s","deploymentId":"%s","pilotDir":"%s","contextSeed":"%s"}\n' $PG_PORT "$RUN/clock.rc" "$SHA" "$DEPLOYMENT_ID" \
  "$RUN/noop-pilot" "$ROOT/tasks/artifacts/blsh-pilot-readiness-2026-11-14/sandbox-2026-11-19/fixtures/context-seed-2026-11-20.sql" > "$RUN/bootstrap-config.json"
python3 -I "$V6/bootstrap.py" "$RUN" "$RUN/bootstrap-config.json" > "$RUN/bootstrap.out"
source "$RUN/secrets.env"
SQL() { "$PSQL" -X -A -t -q -h 127.0.0.1 -p $PG_PORT -U postgres -d postgres -c "$1"; }
[[ $(SQL "select public.blsh_capture_enabled_v1()") == f ]] || fail "live switch must be off in the stand-in"
echo "== cron, pg_net and Vault stand-ins (as FORGE's check_sandbox.py), with one unrelated WGO job"
SQL "create schema cron; create table cron.job(jobid bigserial primary key, jobname text unique, schedule text, command text, active boolean default true, username text default current_user);
  create table cron.job_run_details(runid bigserial, jobid bigint, status text, return_message text, start_time timestamptz, end_time timestamptz, command text);
  create function cron.schedule(n text, s text, c text) returns bigint language sql as \$\$insert into cron.job(jobname,schedule,command) values(n,s,c) returning jobid\$\$;
  create function cron.unschedule(j bigint) returns boolean language sql as \$\$delete from cron.job where jobid=j returning true\$\$;
  create schema net; create table net.requests(id bigserial primary key, url text, headers jsonb, timeout_ms int);
  create table net._http_response(id bigint, status_code int, content text, timed_out boolean, error_msg text, created timestamptz default now());
  create function net.http_get(url text, params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
    returns bigint language sql as \$\$insert into net.requests(url,headers,timeout_ms) values(url,headers,timeout_milliseconds) returning id\$\$;
  create schema vault; create table vault.decrypted_secrets(name text, decrypted_secret text);
  insert into vault.decrypted_secrets values ('cron_secret', '$CRON_SECRET');
  select cron.schedule('update-all-wgo-skaters', '30 7 * * *', 'select 1');
  create schema fhfh_internal; revoke all on schema fhfh_internal from public, anon, authenticated, service_role;
  create function fhfh_internal.require_cron_request_headers() returns jsonb language plpgsql security definer set search_path = '' as \$\$
  declare secret_count bigint; secret_value text;
  begin
    select pg_catalog.count(*), pg_catalog.min(ds.decrypted_secret) into secret_count, secret_value from vault.decrypted_secrets as ds where ds.name = 'cron_secret';
    if secret_count <> 1 or secret_value is null or pg_catalog.btrim(secret_value) = '' then raise exception 'Canonical cron authorization is unavailable.'; end if;
    return pg_catalog.jsonb_build_object('Authorization', pg_catalog.concat('Bearer ', secret_value));
  end; \$\$;
  revoke all on function fhfh_internal.require_cron_request_headers() from public, anon, authenticated, service_role;" >/dev/null
OUTSIDE() { "$PGDUMP" -h 127.0.0.1 -p $PG_PORT -U postgres -d postgres --no-owner -N blsh_replay -N blsh_replay_api -N cron -N net -N vault -N fhfh_internal | grep -v '^-- Dumped\|^\\restrict\|^\\unrestrict' | shasum -a 256 | cut -c1-64; }
ROLES() { SQL "select string_agg(r.rolname || ':' || coalesce((select string_agg(g.rolname, ',' order by g.rolname) from pg_auth_members m join pg_roles g on g.oid = m.roleid where m.member = r.oid), ''), ';' order by r.rolname) from pg_roles r where r.rolname not like 'pg\\_%'"; }
PRE_INSTALL=$(OUTSIDE); ROLES_BEFORE=$(ROLES); echo "outside-sandbox dump before install: $PRE_INSTALL"

echo "== install the sandbox (one transaction), then the isolation check"
"$PSQL" -X -q -h 127.0.0.1 -p $PG_PORT -U postgres -d postgres -f "$RUN/sql/install.sql" > "$RUN/install.out" 2>&1 || { cat "$RUN/install.out"; fail "install"; }
"$PSQL" -X -A -t -q -h 127.0.0.1 -p $PG_PORT -U postgres -d postgres -f "$HOSTED/isolation-check.sql" | tee "$RUN/isolation-check.json"
python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1])); assert d["verdict"]=="ok", d' "$RUN/isolation-check.json" || fail "isolation check"
BEFORE=$(OUTSIDE); ROLES_INSTALLED=$(ROLES); echo "outside-sandbox dump after install: $BEFORE"
[[ $BEFORE == "$PRE_INSTALL" ]] || fail "install changed something outside the sandbox"

TOKEN=$(python3 -I - "$PGRST_JWT_SECRET" <<'PY'
import base64, hashlib, hmac, json, sys, time
b64 = lambda raw: base64.urlsafe_b64encode(raw).rstrip(b"=")
now = int(time.time()); body = b".".join([b64(b'{"alg":"HS256","typ":"JWT"}'), b64(json.dumps({"role": "blsh_replay_api", "iat": now, "exp": now + 43200}).encode())])
print((body + b"." + b64(hmac.new(sys.argv[1].encode(), body, hashlib.sha256).digest())).decode())
PY
)

echo "== PostgREST 16.6 (db-schemas public,blsh_replay_api)"
cat > "$RUN/postgrest.conf" <<EOF
db-uri = "postgres://authenticator:$AUTH_PW@127.0.0.1:$PG_PORT/postgres"
db-schemas = "public,blsh_replay_api"
db-anon-role = "anon"
jwt-secret = "$PGRST_JWT_SECRET"
server-host = "127.0.0.1"
server-port = $PGRST_PORT
log-level = "warn"
EOF
PGRST_PID=
postgrest_with() {  # postgrest_with "public,blsh_replay_api" | "public"   (the Exposed-schemas setting)
  if [[ -n $PGRST_PID ]]; then kill $PGRST_PID; for _ in $(seq 50); do (exec 3<>"/dev/tcp/127.0.0.1/$PGRST_PORT") 2>/dev/null || break; sleep 0.1; done; fi
  sed -i '' "s/^db-schemas = .*/db-schemas = \"$1\"/" "$RUN/postgrest.conf"
  "$POSTGREST_BIN" "$RUN/postgrest.conf" >> "$RUN/postgrest.log" 2>&1 & PGRST_PID=$!; pids+=($PGRST_PID)
  for _ in $(seq 50); do curl -fsS "http://127.0.0.1:$PGRST_PORT/" >/dev/null 2>&1 && break; sleep 0.2; done
  echo "exposed schemas: $1"
}
postgrest_with "public,blsh_replay_api"

echo "== loopback TLS front: Supabase host -> PostgREST; NHL/NST hosts logged and refused (empty fixture dir)"
mkdir -p "$RUN/tls" "$RUN/no-fixtures" "$RUN/storage"
OPENSSL=${OPENSSL_BIN:-/opt/homebrew/opt/openssl@3/bin/openssl}
( cd "$RUN/tls"
  "$OPENSSL" req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.pem -days 2 -subj "/CN=BLSH Replay Proof Root (local only)" -addext "basicConstraints=critical,CA:true" -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null
  "$OPENSSL" req -newkey rsa:2048 -nodes -keyout leaf.key -out leaf.csr -subj "/CN=blsh-replay-proof" 2>/dev/null
  printf 'subjectAltName=DNS:fyhftlxokyjtpndbkfse.supabase.co,DNS:api-web.nhle.com,DNS:data.naturalstattrick.com\nbasicConstraints=CA:false\nextendedKeyUsage=serverAuth\n' > leaf.ext
  "$OPENSSL" x509 -req -in leaf.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out leaf.pem -days 2 -extfile leaf.ext 2>/dev/null
  cat leaf.pem ca.pem > chain.pem )
printf '{"port":%s,"postgrestPort":%s,"pg":{"host":"127.0.0.1","port":%s,"user":"postgres","database":"postgres"},"cert":"%s","key":"%s","fixturesDir":"%s","storeDir":"%s","hits":"%s","serviceKey":"none","webDir":"%s"}\n' \
  $FRONT_PORT $PGRST_PORT $PG_PORT "$RUN/tls/chain.pem" "$RUN/tls/leaf.key" "$RUN/no-fixtures" "$RUN/storage" "$RUN/front-hits.jsonl" "$WEB" > "$RUN/front.json"
"$NODE" "$V6/fixtures.mjs" "$RUN/front.json" > "$RUN/front.log" 2>&1 & pids+=($!)
for _ in $(seq 50); do grep -q listening "$RUN/front.log" && break; sleep 0.2; done
: > "$RUN/front-hits.jsonl"

echo "== isolated Next dev (loopback-only egress, canary credentials, decoy live context key, sandbox token)"
DECOY_PUB=$("$NODE" -e 'const {generateKeyPairSync}=require("crypto");const k=generateKeyPairSync("ed25519");require("fs").writeFileSync(process.argv[1],k.privateKey.export({type:"pkcs8",format:"pem"}),{mode:0o600,flag:"wx"});process.stdout.write(k.publicKey.export({type:"spki",format:"pem"}).toString().trim())' "$RUN/decoy-live-context.key")
SERVICE_CANARY="service-role-canary-$(openssl rand -hex 8)"; NST_CANARY="nst-key-canary-$(openssl rand -hex 8)"
PROFILE='(version 1)(allow default)(deny network-outbound)(allow network-outbound (remote ip "localhost:*"))(allow network-outbound (remote unix-socket))'
mkdir -p "$RUN/envfiles" "$RUN/tmp"
for f in .env.development .env.production .env.test; do [[ -f "$WEB/$f" ]] && mv "$WEB/$f" "$RUN/envfiles/$f"; done
( cd "$WEB" && exec sandbox-exec -p "$PROFILE" /usr/bin/env -i PATH="$(dirname "$NODE"):/usr/bin:/bin" HOME="$RUN" TMPDIR="$RUN/tmp/" LC_ALL=C LANG=C TZ=UTC \
    NODE_OPTIONS="--require $V6/netpreload.cjs" NODE_EXTRA_CA_CERTS="$RUN/tls/ca.pem" BLSH_SANDBOX_FRONT_PORT=$FRONT_PORT \
    NEXT_TELEMETRY_DISABLED=1 PLAYWRIGHT_ISOLATED_NEXT=1 CMS_URL=http://127.0.0.1:9 CRON_SECRET="$CRON_SECRET" \
    NEXT_PUBLIC_SUPABASE_URL=https://fyhftlxokyjtpndbkfse.supabase.co NEXT_PUBLIC_SUPABASE_PUBLIC_KEY="$ANON_JWT" \
    SUPABASE_SERVICE_ROLE_KEY="$SERVICE_CANARY" NST_KEY="$NST_CANARY" BLSH_REQUEST_CONTEXT_APPROVAL_PUBLIC_KEY="$DECOY_PUB" BLSH_REPLAY_API_TOKEN="$TOKEN" \
    VERCEL_ENV=production VERCEL_REGION=iad1 VERCEL_DEPLOYMENT_ID=$DEPLOYMENT_ID VERCEL_GIT_COMMIT_SHA=$SHA \
    "$NODE" node_modules/next/dist/bin/next dev -H 127.0.0.1 -p $NEXT_PORT ) > "$RUN/next.log" 2>&1 & pids+=($!)
for _ in $(seq 150); do grep -q "Ready in" "$RUN/next.log" && break; sleep 0.4; done
grep -q "Ready in" "$RUN/next.log" || fail "next dev did not start"

counts() { SQL "select json_build_object('nativeRuns',(select count(*) from blsh_replay.blsh_capture_runs),'nativeObjects',(select count(*) from blsh_replay.blsh_capture_objects),
  'contextRuns',(select count(*) from blsh_replay.blsh_context_runs),'contextObjects',(select count(*) from blsh_replay.blsh_context_objects),
  'storage',(select count(*) from blsh_replay.storage_objects),'receipts',(select count(*) from blsh_replay.receipts),
  'liveRuns',(select count(*) from public.blsh_capture_runs),'liveContextRuns',(select count(*) from public.blsh_context_runs),'liveStorage',(select count(*) from storage.objects))"; }
fire() {  # fire LABEL JOBNAME: run the job's own command twice (the second must be already_fired), then act as pg_net for its GET
  local command first second id url auth start code
  command=$(SQL "select command from cron.job where jobname='$2'")
  [[ -n $command && $command != *Bearer* && $command != *"$CRON_SECRET"* && $command != *"?"* ]] || fail "job command $2: $command"
  first=$(SQL "$command"); second=$(SQL "$command")
  [[ $first == "fired "* && $second == already_fired && -z $(SQL "select 1 from cron.job where jobname='$2'") ]] || fail "fire $2: $first / $second"
  id=${first#fired }
  url=$(SQL "select url from net.requests where id=$id"); auth=$(SQL "select headers->>'Authorization' from net.requests where id=$id")
  [[ $url == https://fhfhockey.com/api/v1/db/blsh-replay-* && $auth == "Bearer $CRON_SECRET" && $(SQL "select timeout_ms from net.requests where id=$id") == 240000 ]] || fail "request $id: $url"
  start=$(python3 -c 'import time;print(time.time())')
  code=$(curl -sS -o "$RUN/response-$1.json" -w '%{http_code}' --max-time 310 -H "Authorization: $auth" "http://127.0.0.1:$NEXT_PORT${url#https://fhfhockey.com}")
  echo "insert into net._http_response(id,status_code,content,timed_out) values (:id, :code, :'body', false);" \
    | "$PSQL" -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $PG_PORT -U postgres -d postgres -v id="$id" -v code="$code" -v body="$(cat "$RUN/response-$1.json")"
  printf '{"label":"%s","job":"%s","requestId":%s,"fired":"%s","second":"%s","http":%s,"wallSeconds":%.2f,"counts":%s}\n' "$1" "$2" "$id" "$first" "$second" "$code" \
    "$(python3 -c "import time;print(time.time()-$start)")" "$(counts)" | tee -a "$RUN/gets.jsonl"
}
readback() {
  "$PSQL" -X -A -t -q -h 127.0.0.1 -p $PG_PORT -U postgres -d postgres -f "$HOSTED/readback-replay-get.sql" > "$RUN/readback-$1.json"
  python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1])); print(json.dumps({"requests":[{k:r[k] for k in ("jobName","statusCode")} for r in d["requests"]],"sandbox":d["sandbox"],"jobs":len(d["jobs"]),"otherCronJobs":d["otherCronJobs"]}))' "$RUN/readback-$1.json"
}
sched() { python3 -I -c 'import datetime as d,sys; t=d.datetime.now(d.timezone.utc)+d.timedelta(minutes=int(sys.argv[1])); print(f"{t.minute} {t.hour} {t.day} {t.month} *")' "$1"; }
ARMV() { local file=$1; shift; "$PSQL" -X -q -h 127.0.0.1 -p $PG_PORT -U postgres -d postgres "$@" -f "$file"; }
ARM() { ARMV "$OPS/${1%.sql}-dated.sql" -v run_date="$RUN_DATE" -v schedule_native="$(sched 5)" -v schedule_context="$(sched 8)"; }
JOBS() { SQL "select count(*) from cron.job where jobname like 'blsh-replay-%'"; }
refuse() {  # refuse LABEL EXPECTED_ERROR FILE psql-vars...: the arm must fail with that error and leave no job or table behind
  local label=$1 want=$2 out state; shift 2
  state=$(SQL "select (select count(*) from cron.job)::text || ':' || coalesce(to_regclass('blsh_replay.replay_get_requests')::text, '-') || ':' || (select count(*) from net.requests)::text")
  if out=$(ARMV "$@" 2>&1); then fail "sql refusal $label: accepted"; fi
  [[ $out == *"$want"* && $(JOBS) == 0 && $(SQL "select (select count(*) from cron.job)::text || ':' || coalesce(to_regclass('blsh_replay.replay_get_requests')::text, '-') || ':' || (select count(*) from net.requests)::text") == "$state" ]] || fail "sql refusal $label: $out"
  printf '{"case":"%s","refused":"%s"}\n' "$label" "$want" | tee -a "$RUN/sql-refusals.jsonl"
}
echo "baseline counts: $(counts)"
echo "== dated arm SQL on this disposable Postgres: refusals first (each rolls back), and the pinned originals refuse today"
TODAY_D=$(date -u +%-d); TODAY_M=$(date -u +%-m); TOMORROW=$(date -u -v+1d +%F); YESTERDAY=$(date -u -v-1d +%F)
refuse original-arm-pinned-to-20261120 replay_get_preflight_failed "$HOSTED/arm-replay-get.sql" -v schedule_native="$(sched 5)" -v schedule_context="$(sched 8)"
refuse run-date-yesterday replay_get_run_date_invalid "$OPS/arm-replay-get-dated.sql" -v run_date="$YESTERDAY" -v schedule_native="$(sched 5)" -v schedule_context="$(sched 8)"
refuse run-date-tomorrow replay_get_run_date_invalid "$OPS/arm-replay-get-dated.sql" -v run_date="$TOMORROW" -v schedule_native="$(sched 5)" -v schedule_context="$(sched 8)"
refuse run-date-slate-day-plus-one replay_get_run_date_invalid "$OPS/arm-replay-get-dated.sql" -v run_date=2026-11-20 -v schedule_native="$(sched 5)" -v schedule_context="$(sched 8)"
refuse run-date-impossible replay_get_run_date_invalid "$OPS/arm-replay-get-dated.sql" -v run_date=2026-11-31 -v schedule_native="$(sched 5)" -v schedule_context="$(sched 8)"
refuse run-date-malformed replay_get_run_date_invalid "$OPS/arm-replay-get-dated.sql" -v run_date="$RUN_DATE'; drop table x; --" -v schedule_native="$(sched 5)" -v schedule_context="$(sched 8)"
refuse schedule-other-day replay_get_schedule_invalid "$OPS/arm-replay-get-dated.sql" -v run_date="$RUN_DATE" -v schedule_native="$(sched 5 | awk '{print $1, $2, $3+1, $4, $5}')" -v schedule_context="$(sched 8)"
refuse schedule-past replay_get_schedule_invalid "$OPS/arm-replay-get-dated.sql" -v run_date="$RUN_DATE" -v schedule_native="$(sched -10)" -v schedule_context="$(sched 8)"
refuse schedule-context-too-soon replay_get_schedule_invalid "$OPS/arm-replay-get-dated.sql" -v run_date="$RUN_DATE" -v schedule_native="$(sched 5)" -v schedule_context="$(sched 6)"
refuse schedule-context-after-2350 replay_get_schedule_invalid "$OPS/arm-replay-get-dated.sql" -v run_date="$RUN_DATE" -v schedule_native="$(sched 5)" -v schedule_context="55 23 $TODAY_D $TODAY_M *"
refuse schedule-wildcard replay_get_schedule_invalid "$OPS/arm-replay-get-dated.sql" -v run_date="$RUN_DATE" -v schedule_native='*/5 * * * *' -v schedule_context="$(sched 8)"
refuse repeat-before-first-arm replay_repeat_preflight_failed "$OPS/arm-replay-get-repeat-dated.sql" -v run_date="$RUN_DATE" -v schedule_native="$(sched 5)" -v schedule_context="$(sched 8)"
echo "== arm the one-shot job, fire it (twice: the second must be already_fired), dispatch its pg_net GET, read back"
ARM arm-replay-get.sql > "$RUN/arm.out"
fire native-1 blsh-replay-native-20261119; fire context-1 blsh-replay-context-20261119; readback get-1
echo "== the repeat (the same GET again): arm-replay-get-repeat.sql"
refuse original-repeat-pinned-to-20261120 replay_repeat_preflight_failed "$HOSTED/arm-replay-get-repeat.sql" -v schedule_native="$(sched 5)" -v schedule_context="$(sched 8)"
ARM arm-replay-get-repeat.sql > "$RUN/arm-repeat.out"
fire native-2 blsh-replay-native-20261119-repeat; fire context-2 blsh-replay-context-20261119-repeat; readback get-2
if ARM arm-replay-get.sql > /dev/null 2>&1; then fail "arm preflight accepted a sandbox that already ran"; fi
echo "arm preflight refuses a second first-arm (expected)"

echo "== denial matrix (sandbox token, anon, no token)"
REST="http://127.0.0.1:$PGRST_PORT"
probe() { printf '{"probe":"%s","http":%s}\n' "$1" "$(curl -sS -o /dev/null -w '%{http_code}' "${@:2}")" | tee -a "$RUN/denials.jsonl"; }
T=(-H "apikey: $ANON_JWT" -H "Authorization: Bearer $TOKEN")
probe token-public-claim-rpc "${T[@]}" -H 'Content-Type: application/json' -d '{"p_pipeline":"native-v6","p_source_date":"2026-11-19","p_deployment":{}}' "$REST/rpc/blsh_capture_claim_v1"
probe token-public-enabled-rpc "${T[@]}" -H 'Content-Type: application/json' -d '{}' "$REST/rpc/blsh_capture_enabled_v1"
probe token-read-public-runs "${T[@]}" "$REST/blsh_capture_runs"
probe token-write-public-runs "${T[@]}" -H 'Content-Type: application/json' -d '{"pipeline":"native-v6","source_date":"2026-11-18"}' "$REST/blsh_capture_runs"
probe token-write-public-games "${T[@]}" -H 'Content-Type: application/json' -d '{"id":1}' "$REST/games"
probe token-private-profile "${T[@]}" -H 'Accept-Profile: blsh_replay' "$REST/fixture_files"
probe token-sandbox-fixture-positive "${T[@]}" -H 'Content-Profile: blsh_replay_api' -H 'Content-Type: application/json' -d '{}' "$REST/rpc/blsh_replay_fixture_v1"
probe anon-sandbox-fixture -H "apikey: $ANON_JWT" -H "Authorization: Bearer $ANON_JWT" -H 'Content-Profile: blsh_replay_api' -H 'Content-Type: application/json' -d '{}' "$REST/rpc/blsh_replay_fixture_v1"
probe nobody-sandbox-fixture -H 'Content-Profile: blsh_replay_api' -H 'Content-Type: application/json' -d '{}' "$REST/rpc/blsh_replay_fixture_v1"
AFTER=$(OUTSIDE); echo "outside-sandbox dump after: $AFTER"

echo "== operator readback: read-only export of the sandbox packets, then stage 1 + stage 2 + context reader (offline)"
SQL "select blsh_replay.export_v1('2026-11-19')" > "$RUN/export.json"
python3 -I "$OPS/readback_export_dated.py" "$RUN/export.json" "$RUN/readback" "$DEPLOYMENT_ID" "$SHA" "$RUN_DATE"
( cd "$WEB" && "$NODE" node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"Node16","moduleResolution":"Node16"}' "$V6/readback.ts" \
    "$RUN/readback/native" "$RUN/readback/pins.json" "$RUN/readback/context" "$RUN/readback/context-pins.json" ) > "$RUN/operator-readback.json"
( cd "$WEB" && "$NODE" "$HOSTED/tls_rule_check.mjs" "$RUN/readback/native" ) > "$RUN/tls-rule-check.json"; cat "$RUN/tls-rule-check.json"

python3 -I - "$RUN" "$BEFORE" "$AFTER" <<'PY' | tee "$RUN/proof.json"
import json, sys, pathlib
run, before, after = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
gets = [json.loads(l) for l in (run / "gets.jsonl").read_text().splitlines()]
hits = [json.loads(l) for l in (run / "front-hits.jsonl").read_text().splitlines() if l.strip()]
denials = {d["probe"]: d["http"] for d in map(json.loads, (run / "denials.jsonl").read_text().splitlines())}
load = lambda name: json.loads((run / f"response-{name}.json").read_text())
R = {k: load(k) for k in ("native-1", "context-1", "native-2", "context-2")}
n1, c1, n2, c2 = (R[k]["receipt"] for k in ("native-1", "context-1", "native-2", "context-2"))
op = json.loads((run / "operator-readback.json").read_text())
tls = json.loads((run / "tls-rule-check.json").read_text())
rb = json.loads((run / "readback-get-2.json").read_text())
first, repeat = gets[1]["counts"], gets[3]["counts"]
checks = {
  "all_four_gets_http_200": [g["http"] for g in gets[:4]] == [200, 200, 200, 200],
  "cron_fired_once_each": all(g["fired"].startswith("fired ") and g["second"] == "already_fired" for g in gets[:4]),
  "routes_report_sha": all(R[k]["sha"] and R[k]["deploymentId"] for k in R),
  "native_complete": n1["native"]["http"] == 200 and n1["native"]["body"].get("state") == "packet_complete_pending_review" and n1["summary"]["native"]["objects"] == 20,
  "context_tampered_403": c1["context"]["tamperedGrant"] == {"http": 403, "body": {"state": "refused", "reason": "approval_invalid"}},
  # With a live key present (the decoy here) the live route refuses the test grant (403); with no live key, as on Nov 18, it skips (200 disabled).
  "live_route_rejects_test_grant": c1["context"]["liveRouteWithTestGrant"] in ({"http": 403, "body": {"state": "refused", "reason": "approval_invalid"}},
    {"http": 200, "body": {"state": "skipped", "reason": "disabled"}}),
  "context_complete": c1["context"]["grant"]["http"] == 200 and c1["context"]["grant"]["body"].get("state") == "packet_complete_pending_review" and c1["summary"]["context"]["objects"] == 8,
  "context_reader_ok": c1["readers"].get("context", {}).get("ok") is True,
  "receipts_written_once": n1["receiptWritten"] is True and c1["receiptWritten"] is True and n2["receiptWritten"] is False and c2["receiptWritten"] is False,
  "repeat_native_already_claimed": n2["native"]["body"] == {"success": True, "skipped": "already_claimed", "sourceDate": "2026-11-19"},
  "repeat_context_already_claimed": c2["context"]["grant"]["body"].get("reason") == "already_claimed",
  "repeat_counts_unchanged": first == repeat and first["receipts"] == 2,
  "readback_four_requests_200": [r["statusCode"] for r in rb["requests"]] == [200, 200, 200, 200],
  "other_cron_jobs_untouched": rb["otherCronJobs"] == 1 and rb["jobs"] == [],
  "readback_labels_partial": rb["fixtureLabels"]["fixtureStatus"] == "PARTIAL" and len(rb["fixtureLabels"]["asOfUnverified"]) == 6
    and rb["fixtureLabels"]["variants"] == {"originalSealed": False, "reconstructed": True, "postCutoffRepaired": False},
  "only_supabase_outbound": all(r["nonSandboxOutbound"] == [] for r in (n1, c1, n2, c2)),
  "no_nhl_or_nst_at_network": not any(h["host"] in ("api-web.nhle.com", "data.naturalstattrick.com") for h in hits),
  "no_live_rows": all(g["counts"]["liveRuns"] == 0 and g["counts"]["liveContextRuns"] == 0 and g["counts"]["liveStorage"] == 0 for g in gets),
  "outside_sandbox_bytes_identical": before == after,
  "denials": denials["token-public-claim-rpc"] in (401, 403, 404) and denials["token-public-enabled-rpc"] in (401, 403, 404)
    and denials["token-read-public-runs"] in (401, 403) and denials["token-write-public-runs"] in (401, 403) and denials["token-write-public-games"] in (401, 403)
    and denials["token-private-profile"] == 406 and denials["token-sandbox-fixture-positive"] == 200
    and denials["anon-sandbox-fixture"] in (401, 403, 404) and denials["nobody-sandbox-fixture"] in (401, 403, 404),
  "within_production_limits": n1["timings"]["total"] < 240_000 and c1["timings"]["total"] < 240_000,
  "operator_stage1_rejects_replay_outside_window": op["stage1"] == {"ok": False, "error": "capture_ingress_window_unconfirmed"},
  "stage2_tls_rule_rejects_replay_fixture": tls["stage2TlsRule"] == "rejected" and tls["reason"] == "tls_peer_unauthorized",
  "operator_context_reader_ok": op["context"]["ok"] is True,
}
print(json.dumps({"verdict": "ok" if all(checks.values()) else "FAIL", "checks": checks, "timingsMs": {"native": n1["timings"], "context": c1["timings"]}, "repeatTimingsMs": {"native": n2["timings"], "context": c2["timings"]},
  "denials": denials, "frontHitsByHost": {h: sum(1 for x in hits if x["host"] == h) for h in sorted({x["host"] for x in hits})},
  "operatorStage1": op.get("stage1"), "stage2TlsRule": tls, "contextReader": c1["readers"].get("context", {}).get("ok"),
  "outsideSandboxDump": {"before": before, "after": after}, "counts": gets}, indent=1))
PY
python3 -I -c 'import json,sys; assert json.load(open(sys.argv[1]))["verdict"]=="ok"' "$RUN/proof.json" || fail "proof checks"

echo "== negative controls on a real UTC day other than 2026-11-20 (live route, replay grants, SQL fuses)"
NATIVE_RUN=$(SQL "select run_id from blsh_replay.blsh_capture_runs"); NATIVE_MANIFEST=$(SQL "select manifest_sha256 from blsh_replay.blsh_capture_runs")
"$NODE" -e 'const {createPrivateKey,sign}=require("crypto");const fs=require("fs");const [key,d,run,man,dep,sha]=process.argv.slice(1);
const a={sourceDate:d,nativeRunId:run,nativeManifestSHA256:man,deploymentId:dep,gitCommitSha:sha};
const bytes=new TextEncoder().encode(JSON.stringify(["fhfh.blsh.request-context-approval.v1",a.sourceDate,a.nativeRunId,a.nativeManifestSHA256,a.deploymentId,a.gitCommitSha]));
process.stdout.write(JSON.stringify({approval:a,signature:sign(null,bytes,createPrivateKey(fs.readFileSync(key))).toString("base64")}))' \
  "$RUN/decoy-live-context.key" 2026-11-19 "$NATIVE_RUN" "$NATIVE_MANIFEST" "$DEPLOYMENT_ID" "$SHA" > "$RUN/live-grant.json"
LIVE_BEFORE=$(counts); LIVE_HITS_BEFORE=$(wc -l < "$RUN/front-hits.jsonl")
LIVE_CODE=$(curl -sS -o "$RUN/response-live-context.json" -w '%{http_code}' --max-time 60 -X POST -H "Authorization: Bearer $CRON_SECRET" \
  -H 'Content-Type: application/json' --data-binary @"$RUN/live-grant.json" "http://127.0.0.1:$NEXT_PORT/api/v1/db/blsh-request-context")
LIVE_AFTER=$(counts); LIVE_HITS_AFTER=$(wc -l < "$RUN/front-hits.jsonl")
python3 -I - "$RUN" "$LIVE_CODE" "$LIVE_BEFORE" "$LIVE_AFTER" "$LIVE_HITS_BEFORE" "$LIVE_HITS_AFTER" "$RUN_DATE" <<'PY2' | tee "$RUN/negatives.json"
import json, sys, pathlib
run, code, before, after, hits_before, hits_after, run_date = pathlib.Path(sys.argv[1]), int(sys.argv[2]), json.loads(sys.argv[3]), json.loads(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6]), sys.argv[7]
live = json.loads((run / "response-live-context.json").read_text())
c1 = json.loads((run / "response-context-1.json").read_text())["receipt"]
op = json.loads((run / "operator-readback.json").read_text())
refusals = [json.loads(l) for l in (run / "sql-refusals.jsonl").read_text().splitlines()]
checks = {
  "real_utc_day_is_not_20261120": run_date != "2026-11-20",
  "live_route_signed_grant_outside_approved_date": code == 200 and live == {"state": "skipped", "reason": "outside_approved_date"},
  "live_route_no_writes_no_io": before == after and hits_before == hits_after,
  "replay_unapproved_key_refused": c1["context"]["unapprovedGrant"] == {"http": 403, "body": {"state": "refused", "reason": "approval_invalid"}},
  "replay_mismatched_date_refused": c1["context"]["mismatchedDateGrant"] == {"http": 200, "body": {"state": "skipped", "reason": "outside_approved_date"}},
  "replay_tampered_refused": c1["context"]["tamperedGrant"] == {"http": 403, "body": {"state": "refused", "reason": "approval_invalid"}},
  "replay_receipt_logical_day": c1["logicalIngressDay"] == "2026-11-20",
  "replay_reader_pinned_to_real_day": c1["readers"]["context"]["receipt"].get("replayCaptureDay") == run_date
    and op["context"]["receipt"].get("replayCaptureDay") == run_date,
  "native_and_context_on_real_day": c1["readers"]["context"]["receipt"]["claimedAtUTC"].startswith(run_date)
    and c1["readers"]["context"]["receipt"]["nativeRetrievedAtUTC"]["individual"].startswith(run_date),
  "stage1_reader_rejects_replay": op["stage1"] == {"ok": False, "error": "capture_ingress_window_unconfirmed"},
  "sql_refusals_all_13": len(refusals) == 13,
}
print(json.dumps({"verdict": "ok" if all(checks.values()) else "FAIL", "checks": checks, "runDate": run_date, "liveRoute": {"http": code, "body": live},
  "countsBefore": before, "countsAfter": after, "sqlRefusals": refusals}, indent=1))
PY2
python3 -I -c 'import json,sys; assert json.load(open(sys.argv[1]))["verdict"]=="ok"' "$RUN/negatives.json" || fail "negative controls"

echo "== rerun path (a failed hosted run): disarm, unexpose, reset, reinstall, isolation, re-expose, arm, fire again"
"$PSQL" -X -q -h 127.0.0.1 -p $PG_PORT -U postgres -d postgres -f "$HOSTED/disarm-replay-get.sql" > "$RUN/disarm.out"
postgrest_with "public"
"$PSQL" -X -q -h 127.0.0.1 -p $PG_PORT -U postgres -d postgres -f "$RUN/sql/reset.sql" > "$RUN/reset-1.out"
[[ -z $(SQL "select 1 from pg_namespace where nspname like 'blsh_replay%' union all select 1 from pg_roles where rolname like 'blsh_replay%'") ]] || fail "reset left sandbox objects"
[[ $(ROLES) == "$ROLES_BEFORE" ]] || fail "reset left role or membership changes"
[[ $(OUTSIDE) == "$PRE_INSTALL" ]] || fail "outside-sandbox bytes changed by the cycle"
[[ $(SQL "select string_agg(jobname, ',') from cron.job") == update-all-wgo-skaters ]] || fail "cron stand-in changed"
"$PSQL" -X -q -h 127.0.0.1 -p $PG_PORT -U postgres -d postgres -f "$RUN/sql/install.sql" > "$RUN/install-2.out" 2>&1 || { cat "$RUN/install-2.out"; fail "reinstall"; }
[[ $("$PSQL" -X -A -t -q -h 127.0.0.1 -p $PG_PORT -U postgres -d postgres -f "$HOSTED/isolation-check.sql" | python3 -I -c 'import json,sys; print(json.load(sys.stdin)["verdict"])') == ok ]] || fail "isolation after reinstall"
postgrest_with "public,blsh_replay_api"
ARM arm-replay-get.sql > "$RUN/arm-rerun.out"
fire native-rerun blsh-replay-native-20261119; fire context-rerun blsh-replay-context-20261119; readback get-rerun
python3 -I -c 'import json,sys; n=json.load(open(sys.argv[1]))["receipt"]; c=json.load(open(sys.argv[2]))["receipt"]; b=json.load(open(sys.argv[3]))["receipt"]
assert n["native"]["body"].get("state")=="packet_complete_pending_review" and c["context"]["grant"]["body"].get("state")=="packet_complete_pending_review" and n["receiptWritten"] is True and c["receiptWritten"] is True, (n, c)
assert n["summary"]["native"]["runId"] != b["summary"]["native"]["runId"]
print(json.dumps({"rerun":"complete","nativeRunId":n["summary"]["native"]["runId"],"nativeMs":n["timings"]["total"],"contextMs":c["timings"]["total"]}))' "$RUN/response-native-rerun.json" "$RUN/response-context-rerun.json" "$RUN/response-native-1.json" | tee "$RUN/rerun.json" || fail "rerun"
echo "== retire: disarm, unexpose, reset"
"$PSQL" -X -q -h 127.0.0.1 -p $PG_PORT -U postgres -d postgres -f "$HOSTED/disarm-replay-get.sql" > /dev/null
postgrest_with "public"
"$PSQL" -X -q -h 127.0.0.1 -p $PG_PORT -U postgres -d postgres -f "$RUN/sql/reset.sql" > "$RUN/reset-2.out"
[[ $(ROLES) == "$ROLES_BEFORE" && $(OUTSIDE) == "$PRE_INSTALL" && -z $(SQL "select 1 from pg_namespace where nspname like 'blsh_replay%'") ]] || fail "final reset"
echo "final reset: no sandbox schemas or roles; roles, memberships and outside-sandbox bytes equal the pre-install state"
echo "== PASS (local hosted-replay proof)"
