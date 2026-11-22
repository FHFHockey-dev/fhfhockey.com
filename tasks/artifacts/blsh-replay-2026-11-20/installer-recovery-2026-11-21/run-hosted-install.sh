#!/bin/bash
# TJ-approved (Nov 21, "Approve after 18:20Z"): ONE guarded hosted install of install.sql 766aec3b…, then read-only checks,
# reset, and a post-reset probe. No build, deploy, token, schema exposure, cron or arming. Never retries.
# Usage: EXPOSED='public,storage,graphql_public,analytics' bash run-hosted-install.sh OUT_DIR
set -u
HERE=$(cd "$(dirname "$0")" && pwd -P); OUT=$1; [[ -e "$OUT" ]] && { echo "OUT exists"; exit 12; }; mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd -P)
: "${EXPOSED:?exact current Exposed-schemas list}"
KIT="$HOME/Library/Application Support/Claude/side-session-notes/local_23eb6989-6502-4cc8-afbc-0bc7caafa992/blsh-hosted-kit"
PG=${PG_WRAP:-/Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-pregame-capture-2026-11-14/operator/pgpool.sh}   # PG_WRAP only for the local rehearsal
DB=${DB_CONNINFO:-sslmode=require}   # pgpool.sh supplies host/user/password from web/.env.local via env; nothing is printed
note() { echo "$(date -u +%H:%M:%SZ) $*" | tee -a "$OUT/steps.log"; }
# Pinned bytes.
check() { [[ $(shasum -a 256 "$1" | cut -c1-64) == "$2" ]] || { note "HASH MISMATCH $1"; exit 10; }; }
check "$HERE/artifact/install.sql" 766aec3bfbc3b766c113a5f25e64b35d9fbebf54083c2ef49c54cef84f24519b
check "$KIT/reset.sql" 8a7634069a27eebc9c4800f7a8fbcf60df37201b2af72ae65a26d36edcf3916e
check "$KIT/isolation-check.sql" 5f01c742b005a5701b798ef21594b1acd71e10f0fa4f0fbca4b2fd96cb79607b
check "$KIT/denial-check.sql" 9b4f7da6ec50b933e51b1c90909e0f65fd0697237261d770859a86520c3a4ced
check "$KIT/reachability.sql" 01348d2680a5cdcb966d54852042b02f99aab0572efcf41e053520698bbe002d
note "hashes ok"
# 1. Preflight (read-only): no open transaction older than 1 h, no idle-in-transaction install leftovers.
"$PG" "$DB" -X -A -t -q -c "set default_transaction_read_only=on;" -c "select json_build_object('openXactsOlderThan1h', (select count(*) from pg_stat_activity where xact_start < now() - interval '1 hour' and pid <> pg_backend_pid()), 'cronBlshReplayJobs', (select count(*) from cron.job where jobname like 'blsh-replay-%'))" > "$OUT/preflight.json" || { note "preflight query failed"; exit 11; }
cat "$OUT/preflight.json" | tee -a "$OUT/steps.log"
grep -q '"openXactsOlderThan1h" : 0, "cronBlshReplayJobs" : 0' "$OUT/preflight.json" || { note "STOP: preflight not clean"; exit 11; }
# 2. Guarded install, exactly once (install-guarded.sh also probes before and refuses a non-clean start).
note "install start"
HOSTED=1 MAX_ATTEMPTS=1 LINGER_WAIT_S=180 FULL=off PSQL="$PG" INSTALL_DB="$DB" PROBE_DB="$DB" \
  EXPECTED="$HERE/receipts/fault-tests/EXPECTED.json" OUT="$OUT/guarded" bash "$HERE/install-guarded.sh" > "$OUT/guarded.stdout" 2>&1; rc=$?
note "install-guarded exit $rc: $(cat "$OUT/guarded/FINAL.json" 2>/dev/null)"
[[ $rc -eq 0 ]] || { note "STOP: verdict not committed_verified; no checks, no reset, no retry"; exit $rc; }
# 3. Read-only checks.
"$PG" "$DB" -X -A -t -f "$KIT/isolation-check.sql" > "$OUT/isolation-check.json" 2>&1; note "isolation-check: $(head -c 300 "$OUT/isolation-check.json")"
"$PG" "$DB" -X -A -t -f "$KIT/denial-check.sql" > "$OUT/denial-check.json" 2>&1; note "denial-check: $(head -c 300 "$OUT/denial-check.json")"
"$PG" "$DB" -X -A -t -v exposed="$EXPOSED,blsh_replay_api" -f "$KIT/reachability.sql" > "$OUT/reachability.json" 2>&1; note "reachability: $(head -c 300 "$OUT/reachability.json")"
# 4. Reset, then the post-reset probe must equal the pre-install probe.
"$PG" "$DB" -X -A -t -f "$KIT/reset.sql" > "$OUT/reset.out" 2>&1; rrc=$?; note "reset exit $rrc"
"$PG" "$DB" -X -A -t -q -v app=- -v pid=0 -v bstart=epoch -v astart=epoch -v full=off -f "$HERE/state-probe.sql" > "$OUT/post-reset-probe.json" 2>&1
python3 -I - "$OUT/guarded/pre.json" "$OUT/post-reset-probe.json" <<'PY' | tee -a "$OUT/steps.log"
import json, sys
pre = json.load(open(sys.argv[1])); post = json.loads(open(sys.argv[2]).read())
ok = post["roles"] == post["schemas"] == post["memberships"] == post["tables"] == post["functions"] == 0 and post["outsideNarrowFingerprint"] == pre["outsideNarrowFingerprint"]
print(json.dumps({"postResetEqualsPreInstall": ok, "roles": post["roles"], "schemas": post["schemas"], "memberships": post["memberships"]}))
PY
note "done"
