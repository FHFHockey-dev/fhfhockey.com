#!/bin/bash
# BLSH R2c (resume 1:55 CT; R‴ c922514df on b37a0180; same strict gate as the R2b rerun) — derived from R2b RERUN (TJ 12:45 CT: once, accept ONLY pgsodium USAGE via PUBLIC; prove no indirect reach) — based on (TJ 12:40 CT, packet APPROVAL-BATCH-R2b.md b5084aa6): step 0 (read-only preflight), step 1 (ONE guarded install of
# install.sql 766aec3b), step 1b (read-only isolation / denial / reachability). Stops before step 2. Never retries.
# On a 1b failure: reset.sql then stop (packet). On an install verdict other than committed_verified: stop, no reset.
# Usage: bash run-r2b-steps0-1b.sh OUT_DIR
set -u
HERE=$(cd "$(dirname "$0")" && pwd -P); OUT=$1; [[ -e "$OUT" ]] && { echo "OUT exists"; exit 12; }; mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd -P)
KIT="$HOME/Library/Application Support/Claude/side-session-notes/local_23eb6989-6502-4cc8-afbc-0bc7caafa992/blsh-hosted-kit"
BATCH="$HERE/../recut-ctxgate-20261121/APPROVAL-BATCH-R2c.md"
PG=/Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-pregame-capture-2026-11-14/operator/pgpool.sh; DB="sslmode=require"
EXPOSED="public,storage,graphql_public,analytics"   # PGRST106 hint read 18:3xZ (non-mutating anon GET)
MASTER=b37a0180d106412ede28cf7b6e5d73c89ffdae7e
note() { echo "$(date -u +%H:%M:%SZ) $*" | tee -a "$OUT/steps.log"; }
check() { [[ $(shasum -a 256 "$1" | cut -c1-64) == "$2" ]] || { note "STOP: HASH MISMATCH $1"; exit 10; }; }
check "$BATCH" 96566418a2eaf62cea12019f9eae16a7fbf0cf6252fb146ed3e398984a5024e1
check "$HERE/artifact/install.sql" 766aec3bfbc3b766c113a5f25e64b35d9fbebf54083c2ef49c54cef84f24519b
check "$HERE/install-guarded.sh" a6cfcac12c4c7c6dbe51df83fa7088b82034d346d63aec51796f2120bf650c81
check "$HERE/state-probe.sql" 9b9317850fb5ca3ab26b97b196df92ed4f71fb5906d446ab4fea2987f05cc9b7
check "$KIT/reset.sql" 8a7634069a27eebc9c4800f7a8fbcf60df37201b2af72ae65a26d36edcf3916e
check "$KIT/isolation-check.sql" 5f01c742b005a5701b798ef21594b1acd71e10f0fa4f0fbca4b2fd96cb79607b
check "$KIT/denial-check.sql" 9b4f7da6ec50b933e51b1c90909e0f65fd0697237261d770859a86520c3a4ced
check "$KIT/reachability.sql" 01348d2680a5cdcb966d54852042b02f99aab0572efcf41e053520698bbe002d
check "$HERE/pgsodium-indirect-check.sql" ad1a02747ffad10acc0c1c52d2d40e13ec5f12d65bbee762dd3495bbc9ec1343
note "hashes ok"

# Step 0 (read-only).
[[ $(date -u +%H%M) < 2220 ]] || { note "STOP: past 22:20Z"; exit 11; }
have=$(git -C /Users/tim/Code/fhfhockey.com ls-remote origin refs/heads/master | cut -f1)
[[ "$have" == "$MASTER" ]] || { note "STOP: origin/master $have != $MASTER (R″ void)"; exit 11; }
note "master ok $have"
"$PG" "$DB" -A -t -q > "$OUT/step0.json" 2> "$OUT/step0.err" <<'SQL' || { note "STOP: step0 query failed"; exit 11; }
begin transaction read only;
set local statement_timeout = '20s';
select json_build_object(
  'utc', now() at time zone 'UTC',
  'openXactsOlderThan1h', (select count(*) from pg_stat_activity where xact_start < now() - interval '1 hour' and pid <> pg_backend_pid()),
  'blshReplayJobs', (select count(*) from cron.job where jobname like 'blsh-replay-%'),
  'forgeLiveJobs', (select count(*) from cron.job where jobname like 'forge-live-%'),
  'job408Active', (select active from cron.job where jobid = 408),
  'redateMigrationApplied', (select count(*) from supabase_migrations.schema_migrations where version = '20261120143000'),
  'captureEnabled', (select enabled from public.blsh_capture_control where singleton),
  'blshJobs', (select string_agg(format('%s|%s|%s|%s', jobid, jobname, schedule, active), ';' order by jobid) from cron.job where jobid in (404,405,406,407)),
  'vaultCronSecretRows', (select count(*) from vault.secrets where name = 'cron_secret'));
rollback;
SQL
cat "$OUT/step0.json" | tee -a "$OUT/steps.log"
python3 -I - "$OUT/step0.json" <<'PY' || { note "STOP: step 0 not clean"; exit 11; }
import json, sys
s = json.loads(next(l for l in open(sys.argv[1]) if l.strip().startswith("{")))
want_jobs = "404|blsh-native-capture|5 12 * * *|t;405|blsh-native-capture-backup|20 12 * * *|t;406|blsh-native-capture-watchdog|50 12 * * *|t;407|blsh-native-capture-watchdog-assert|52 12 * * *|t"
ok = (s["openXactsOlderThan1h"] == 0 and s["blshReplayJobs"] == 0 and s["forgeLiveJobs"] == 0 and s["job408Active"] is False
      and s["redateMigrationApplied"] == 0 and s["captureEnabled"] is False and s["blshJobs"] == want_jobs and s["vaultCronSecretRows"] == 1)
print(json.dumps({"step0": "ok" if ok else "fail"})); sys.exit(0 if ok else 1)
PY

# Step 1: one guarded install (its own pre-probe refuses any non-clean start).
note "install start"
HOSTED=1 MAX_ATTEMPTS=1 LINGER_WAIT_S=180 FULL=off PSQL="$PG" INSTALL_DB="$DB" PROBE_DB="$DB" \
  EXPECTED="$HERE/receipts/fault-tests/EXPECTED.json" OUT="$OUT/guarded" bash "$HERE/install-guarded.sh" > "$OUT/guarded.stdout" 2>&1; rc=$?
note "install-guarded exit $rc: $(cat "$OUT/guarded/FINAL.json" 2>/dev/null)"
[[ $rc -eq 0 ]] || { note "STOP: verdict not committed_verified; no checks, no reset, no retry"; exit $rc; }

# Step 1b (read-only).
"$PG" "$DB" -A -t -f "$KIT/isolation-check.sql" > "$OUT/isolation-check.json" 2>&1
"$PG" "$DB" -A -t -f "$KIT/denial-check.sql" > "$OUT/denial-check.json" 2>&1
"$PG" "$DB" -A -t -v exposed="$EXPOSED,blsh_replay_api" -f "$KIT/reachability.sql" > "$OUT/reachability.json" 2>&1
"$PG" "$DB" -A -t -v exposed="$EXPOSED,blsh_replay_api" -f "$HERE/pgsodium-indirect-check.sql" > "$OUT/pgsodium-indirect.json" 2>&1
python3 -I - "$OUT" > "$OUT/gate.json" <<'PYG'; ok=$?; cat "$OUT/gate.json" | tee -a "$OUT/steps.log"
import json, sys, os
o = sys.argv[1]
def J(n):
    t = open(os.path.join(o, n)).read(); return json.JSONDecoder().raw_decode(t[t.index("{"):])[0]  # psql may print BEGIN/SET/ROLLBACK tags around the JSON
iso, den, rea, pgs = J("isolation-check.json"), J("denial-check.json"), J("reachability.json"), J("pgsodium-indirect.json")
roles = ("blsh_replay_api", "blsh_replay_owner")
ep = {e["role"]: e for e in rea.get("effectivePrivileges", [])}
wu = rea.get("whyUnexercisable", {})
accepted_only_pgsodium = rea.get("verdict") == "ok" or (
    rea.get("verdict") == "needs_review"
    and sorted(rea.get("reasons", [])) == sorted("net_vault_pgsodium_usage:" + r for r in roles)
    and all(ep[r]["net_usage"] is False and ep[r]["vault_usage"] is False and ep[r]["pgsodium_usage"] is True for r in roles)
    and all(wu["canLogin"][r] is False and wu["cronUsage"][r] is False for r in roles)
    and wu["sandboxFunctionsWithDdlOrDynamicSqlOrExtOrPublicRefs"] == 0 and wu["apiCallableFunctionsWithDdlOrDynamicSqlOrCronNetVaultPgsodium"] == 0)
checks = {"isolation_ok": iso.get("verdict") == "ok", "denial_ok": den.get("verdict") == "ok",
          "reachability_only_pgsodium_via_public": accepted_only_pgsodium, "pgsodium_indirect_ok": pgs.get("verdict") == "ok"}
print(json.dumps({"gate": "ok" if all(checks.values()) else "stop", "checks": checks, "reasons": rea.get("reasons")}))
sys.exit(0 if all(checks.values()) else 1)
PYG
[[ $ok -eq 0 ]] && ok=1 || ok=0
if [[ $ok -ne 1 ]]; then
  note "STOP: 1b gate failed (anything beyond pgsodium-via-PUBLIC, or inconclusive) -> reset.sql (packet rule)"
  "$PG" "$DB" -A -t -f "$KIT/reset.sql" > "$OUT/reset.out" 2>&1; note "reset exit $?"
  "$PG" "$DB" -A -t -q -v app=- -v pid=0 -v bstart=epoch -v astart=epoch -v full=off -f "$HERE/state-probe.sql" > "$OUT/post-reset-probe.json" 2>&1
  exit 13
fi
note "steps 0-1b complete: committed_verified + 3x ok. Next: step 2/3 (exposure, token) and the step-4 push request to TJ."
