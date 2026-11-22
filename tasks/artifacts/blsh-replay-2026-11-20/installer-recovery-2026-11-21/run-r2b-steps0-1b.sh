#!/bin/bash
# BLSH R2b (TJ 12:40 CT, packet APPROVAL-BATCH-R2b.md b5084aa6): step 0 (read-only preflight), step 1 (ONE guarded install of
# install.sql 766aec3b), step 1b (read-only isolation / denial / reachability). Stops before step 2. Never retries.
# On a 1b failure: reset.sql then stop (packet). On an install verdict other than committed_verified: stop, no reset.
# Usage: bash run-r2b-steps0-1b.sh OUT_DIR
set -u
HERE=$(cd "$(dirname "$0")" && pwd -P); OUT=$1; [[ -e "$OUT" ]] && { echo "OUT exists"; exit 12; }; mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd -P)
KIT="$HOME/Library/Application Support/Claude/side-session-notes/local_23eb6989-6502-4cc8-afbc-0bc7caafa992/blsh-hosted-kit"
BATCH="$HERE/../recut-ctxgate-20261121/APPROVAL-BATCH-R2b.md"
PG=/Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-pregame-capture-2026-11-14/operator/pgpool.sh; DB="sslmode=require"
EXPOSED="public,storage,graphql_public,analytics"   # PGRST106 hint read 18:3xZ (non-mutating anon GET)
MASTER=096b78b622a72a8378b8f60c0c7704fc4e2fee41
note() { echo "$(date -u +%H:%M:%SZ) $*" | tee -a "$OUT/steps.log"; }
check() { [[ $(shasum -a 256 "$1" | cut -c1-64) == "$2" ]] || { note "STOP: HASH MISMATCH $1"; exit 10; }; }
check "$BATCH" b5084aa6c21330e73ef92f207b0d0722502b5fe348e411455025790c015a4abf
check "$HERE/artifact/install.sql" 766aec3bfbc3b766c113a5f25e64b35d9fbebf54083c2ef49c54cef84f24519b
check "$HERE/install-guarded.sh" a6cfcac12c4c7c6dbe51df83fa7088b82034d346d63aec51796f2120bf650c81
check "$HERE/state-probe.sql" 9b9317850fb5ca3ab26b97b196df92ed4f71fb5906d446ab4fea2987f05cc9b7
check "$KIT/reset.sql" 8a7634069a27eebc9c4800f7a8fbcf60df37201b2af72ae65a26d36edcf3916e
check "$KIT/isolation-check.sql" 5f01c742b005a5701b798ef21594b1acd71e10f0fa4f0fbca4b2fd96cb79607b
check "$KIT/denial-check.sql" 9b4f7da6ec50b933e51b1c90909e0f65fd0697237261d770859a86520c3a4ced
check "$KIT/reachability.sql" 01348d2680a5cdcb966d54852042b02f99aab0572efcf41e053520698bbe002d
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
ok=1; for f in isolation-check denial-check reachability; do
  v=$(grep -o '"verdict" *: *"[a-z_]*"' "$OUT/$f.json" | head -1); note "$f: $v"; [[ "$v" =~ \"ok\" ]] || ok=0
done
if [[ $ok -ne 1 ]]; then
  note "STOP: a 1b verdict is not ok -> reset.sql (packet rule)"
  "$PG" "$DB" -A -t -f "$KIT/reset.sql" > "$OUT/reset.out" 2>&1; note "reset exit $?"
  "$PG" "$DB" -A -t -q -v app=- -v pid=0 -v bstart=epoch -v astart=epoch -v full=off -f "$HERE/state-probe.sql" > "$OUT/post-reset-probe.json" 2>&1
  exit 13
fi
note "steps 0-1b complete: committed_verified + 3x ok. Next: step 2/3 (exposure, token) and the step-4 push request to TJ."
