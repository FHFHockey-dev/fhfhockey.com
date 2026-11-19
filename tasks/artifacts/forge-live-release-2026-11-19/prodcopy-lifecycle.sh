#!/bin/zsh
# Prod-schema copy lifecycle with the REAL verifier package installed (local disposable DB only).
set -u
cd "$1"   # repo root (scratch clone)
L=tasks/artifacts/forge-live-release-2026-11-19; W=tasks/artifacts/forge-witness-verifier-2026-11-19
P=(env LC_ALL=en_US.UTF-8 /opt/homebrew/opt/postgresql@15/bin/psql -h /tmp/fpd.v5ww -p 55871 -U postgres -d prodcopy -X -At -q)
G=2026020358; R=$(printf 'a%.0s' {1..40}); WRONG=$(printf 'b%.0s' {1..40})
q() { $P -v ON_ERROR_STOP=1 -c "$1" 2>&1 | sed 's/^/  /'; }
TOKEN() { python3 -I -c 'import base64,hashlib,hmac,json,os,time
b=lambda x: base64.urlsafe_b64encode(x).rstrip(b"=")
n=int(time.time()); body=b(json.dumps({"alg":"HS256","typ":"JWT"}).encode())+b"."+b(json.dumps({"role":"forge_witness_api","iat":n,"exp":n+3*3600}).encode())
print((body+b"."+b(hmac.new(os.urandom(32),body,hashlib.sha256).digest())).decode())'; }
echo "0 installed: verifier $(shasum -a 256 $W/forge-witness-verifier.sql | cut -c1-12) (real), forge_witness_api schema=$($P -c "select to_regnamespace('forge_witness_api') is not null")"
echo "1 rollback refuses while a run is open:"; $P -f $L/rollback.sql 2>&1 | grep -E "ERROR" | sed 's/^/  /'
echo "2 stop open run:"; $P -v game=$G -v reason=lifecycle-reset -f $L/stop.sql 2>&1 | tail -1 | sed 's/^/  jobs left /'
echo "3 rollback after stop:"; $P -v ON_ERROR_STOP=1 -f $L/rollback.sql >/dev/null 2>&1 && echo "  ok; live objects: $($P -c "select count(*) from pg_proc where proname like 'live_%' or proname like 'forge_live_%'")"
echo "4 apply live migration on top of publication + REAL verifier:"; $P -v ON_ERROR_STOP=1 -f supabase/migrations/20261119230000_forge_live_pregame_run.sql >/dev/null 2>&1 && echo "  applied ($(shasum -a 256 supabase/migrations/20261119230000_forge_live_pregame_run.sql | cut -c1-12))"
echo "5 approve+arm live (408 guard) and arm the verifier:"
$P -v ON_ERROR_STOP=1 -v game=$G -v player=8478402 -v release=$R -v approver=prodcopy-rehearsal -v capture_at='45 1 20 11 *' -v publish_at='5 2 20 11 *' -v close_at='1 3 20 11 *' -f $L/approve-and-arm.sql >/dev/null 2>&1 && echo "  live jobs $($P -c "select count(*) from cron.job where jobname like 'forge-live-%'")"
echo "  arm verifier without a credential: $($P -v ON_ERROR_STOP=1 -v game=$G -v schedule='50 1 20 11 *' -f $W/arm-witness-verify.sql 2>&1 | grep -oE 'witness_arm_preflight_failed' | head -1)"
TOKEN | $P -v ON_ERROR_STOP=1 -f $W/set-witness-credential.sql 2>&1 | sed 's/^/  set credential (stdin): /'
$P -v ON_ERROR_STOP=1 -v game=$G -v schedule='50 1 20 11 *' -f $W/arm-witness-verify.sql >/dev/null 2>&1 && echo "  verifier job $($P -c "select count(*) from cron.job where jobname = 'forge-witness-verify-$G'"), target $($P -c "select count(*) from forge_witness.targets where game_id = $G")"
echo "6 fences (each rolled back):"
t() { echo "  $1: $($P -c "begin; $2; rollback;" 2>&1 | grep -v -E '^(BEGIN|ROLLBACK)$' | tr '\n' ' ')"; }
t "publish fire before capture" "select forge_pregame_capture.live_fire_v1($G, 'publish')"
t "close before puck drop keeps run open" "select forge_pregame_capture.live_close_v1($G); select case when terminal_at is null then 'open' else outcome end from forge_pregame_capture.live_runs where game_id = $G"
t "capture fire, then second fire" "select forge_pregame_capture.live_fire_v1($G, 'capture'); select forge_pregame_capture.live_fire_v1($G, 'capture')"
t "capture begin wrong release (service_role)" "set local role service_role; select public.forge_live_capture_begin_v1('$WRONG')->>'status'"
t "capture begin right release (service_role)" "set local role service_role; select public.forge_live_capture_begin_v1('$R')->>'status'"
t "publish begin with no claim (service_role)" "set local role service_role; select public.forge_live_publish_begin_v1('$R')->>'status'"
t "verifier cron fire, then again (max 1)" "select forge_witness_ops.fire_v1($G, 1); select forge_witness_ops.fire_v1($G, 1); select count(*) from cron.job where jobname = 'forge-witness-verify-$G'"
t "verifier fire sends both headers, credential not in command" "select forge_witness_ops.fire_v1($G, 1); select string_agg(k, ',' order by k) from net.requests q, jsonb_object_keys(q.headers) k where q.id = (select max(id) from net.requests); select count(*) from cron.job where command ilike '%eyJ%'"
t "service_role reads the witness credential" "set local role service_role; select forge_witness.credential_v1()"
t "service_role reads the credentials table" "set local role service_role; select count(*) from forge_witness.credentials"
t "revoked credential: fire refuses" "select forge_witness.revoke_credential_v1(); select forge_witness_ops.fire_v1($G, 1)"
t "gate for an unknown claim (service_role)" "set local role service_role; select forge_witness.publication_gate_v1(gen_random_uuid(), 'a', 'b', 'c')->>'reason'"
t "require_accepted_v1 for an unknown claim" "set local role service_role; select forge_witness.require_accepted_v1(gen_random_uuid(), 'a', 'b', 'c')"
t "service_role on verifier receipts" "set local role service_role; select count(*) from forge_witness.verdicts"
t "service_role on verifier API" "set local role service_role; select forge_witness_api.pending_v1()"
t "stop, then capture fire and begin" "select forge_pregame_capture.live_stop_v1($G, 'fence'); select forge_pregame_capture.live_fire_v1($G, 'capture'); set local role service_role; select public.forge_live_capture_begin_v1('$R')->>'status'; reset role; select count(*) from cron.job where jobname like 'forge-live-%'"
t "schedule moved, capture begin" "update public.games set \"startTime\" = \"startTime\" + interval '5 minutes' where id = $G; set local role service_role; select public.forge_live_capture_begin_v1('$R')->>'status'"
echo "7 job 408 active: $($P -c 'select active from cron.job where jobid = 408')"
echo "7b revoke credential: $($P -f $W/revoke-witness-credential.sql 2>&1 | tail -1)"
echo "8 disarm both:"; $P -f $L/disarm.sql 2>&1 | tail -1 | sed 's/^/  live jobs /'; $P -f $W/disarm-witness-verify.sql 2>&1 | tail -1 | sed 's/^/  verifier jobs /'
echo "9 rollback refuses while open, succeeds after stop, re-apply:"
$P -f $L/rollback.sql 2>&1 | grep -oE "live_run_open" | sed 's/^/  refused: /'
$P -v game=$G -v reason=lifecycle-end -f $L/stop.sql >/dev/null 2>&1
$P -v ON_ERROR_STOP=1 -f $L/rollback.sql >/dev/null 2>&1 && echo "  rolled back"
$P -v ON_ERROR_STOP=1 -f supabase/migrations/20261119230000_forge_live_pregame_run.sql >/dev/null 2>&1 && echo "  re-applied; verifier receipts kept: targets $($P -c 'select count(*) from forge_witness.targets')"
echo "10 job 408 active: $($P -c 'select active from cron.job where jobid = 408')"
