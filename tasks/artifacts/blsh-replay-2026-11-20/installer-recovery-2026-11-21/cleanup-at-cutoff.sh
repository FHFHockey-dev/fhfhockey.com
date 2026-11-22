#!/bin/bash
# TJ 1:20 CT: "If approval to proceed hasn't arrived by that cutoff, clean up and verify it." Cutoff 22:30Z (4:30 pm CT).
# At the cutoff: if $OUT/PROCEED-APPROVED exists (Chef writes it only on TJ's explicit step-2+ approval), do nothing.
# Otherwise: reset.sql (the sandbox is unexposed, no token, no cron), then verify the post-reset probe = step-0 state.
set -u
HERE=$(cd "$(dirname "$0")" && pwd -P); OUT=$1
KIT="$HOME/Library/Application Support/Claude/side-session-notes/local_23eb6989-6502-4cc8-afbc-0bc7caafa992/blsh-hosted-kit"
PG=/Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-pregame-capture-2026-11-14/operator/pgpool.sh; DB="sslmode=require"
note() { echo "$(date -u +%H:%M:%SZ) $*" | tee -a "$OUT/cutoff.log"; }
[[ $(shasum -a 256 "$KIT/reset.sql" | cut -c1-64) == 8a7634069a27eebc9c4800f7a8fbcf60df37201b2af72ae65a26d36edcf3916e ]] || { note "STOP: reset.sql hash mismatch"; exit 10; }
note "armed: waiting for 22:30Z"
while [[ $(date -u +%H%M) < 2230 ]]; do [[ -e "$OUT/PROCEED-APPROVED" || -e "$OUT/CLEANED" ]] && break; sleep 30; done
[[ -e "$OUT/PROCEED-APPROVED" ]] && { note "PROCEED-APPROVED present: no cutoff cleanup"; exit 0; }
[[ -e "$OUT/CLEANED" ]] && { note "already cleaned by Chef"; exit 0; }
note "cutoff reached without approval: reset.sql"
"$PG" "$DB" -A -t -f "$KIT/reset.sql" > "$OUT/cutoff-reset.out" 2>&1; note "reset exit $?"
"$PG" "$DB" -A -t -q -v app=- -v pid=0 -v bstart=epoch -v astart=epoch -v full=off -f "$HERE/state-probe.sql" > "$OUT/cutoff-post-reset-probe.json" 2>&1
python3 -I - "$OUT/cutoff-post-reset-probe.json" <<'PY' | tee -a "$OUT/cutoff.log"
import json, sys
t = open(sys.argv[1]).read(); p = json.JSONDecoder().raw_decode(t[t.index("{"):])[0]
ok = p["roles"] == p["schemas"] == p["memberships"] == p["tables"] == p["functions"] == 0 and p["lingeringInstallBackends"] == 0 and p["outsideNarrowFingerprint"] == "4eebb9633ba7e4718a82f12435ea4ecb"
print(json.dumps({"cleanupVerified": ok, "roles": p["roles"], "schemas": p["schemas"], "memberships": p["memberships"], "outsideNarrowFingerprint": p["outsideNarrowFingerprint"]}))
PY
touch "$OUT/CLEANED"
