#!/bin/bash
# R2c handoff cutoff (TJ: "If the handoff hasn't passed by 4:20 pm CT, I reset and verify"). Cutoff 22:20Z.
# Does nothing if $OUT/PROCEED-APPROVED (written by Chef only after the step-3 script exits 0) or $OUT/CLEANED exists.
# Otherwise, in the packet's order: token removed if present → if blsh_replay_api is STILL EXPOSED: do NOT reset, alert, exit 3
# → reset.sql → post-reset probe must equal step 0 (outsideNarrow 4eebb963…).
set -u
HERE=$(cd "$(dirname "$0")" && pwd -P); OUT=$1
KIT="$HOME/Library/Application Support/Claude/side-session-notes/local_23eb6989-6502-4cc8-afbc-0bc7caafa992/blsh-hosted-kit"
PG=/Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-pregame-capture-2026-11-14/operator/pgpool.sh; DB="sslmode=require"
WEB=/Users/tim/Code/fhfhockey.com/web; VERCEL=/Users/tim/Code/fhfhockey.com/functions/node_modules/.bin/vercel
OLD="The schema must be one of the following: public, storage, graphql_public, analytics"
note() { echo "$(date -u +%H:%M:%SZ) $*" | tee -a "$OUT/cutoff.log"; }
[[ $(shasum -a 256 "$KIT/reset.sql" | cut -c1-64) == 8a7634069a27eebc9c4800f7a8fbcf60df37201b2af72ae65a26d36edcf3916e ]] || { note "STOP: reset.sql hash"; exit 10; }
note "armed: waiting for 22:20Z"
while [[ $(date -u +%H%M) < 2220 ]]; do [[ -e "$OUT/PROCEED-APPROVED" || -e "$OUT/CLEANED" ]] && break; sleep 30; done
[[ -e "$OUT/PROCEED-APPROVED" ]] && { note "PROCEED-APPROVED present: no cutoff cleanup"; exit 0; }
[[ -e "$OUT/CLEANED" ]] && { note "already cleaned"; exit 0; }
note "cutoff reached without a passed handoff"
if (cd "$WEB" && "$VERCEL" env ls production 2>/dev/null) | grep -q BLSH_REPLAY_API_TOKEN; then
  (cd "$WEB" && "$VERCEL" env rm BLSH_REPLAY_API_TOKEN production --yes) >/dev/null 2>&1
  (cd "$WEB" && "$VERCEL" env ls production 2>/dev/null) | grep -q BLSH_REPLAY_API_TOKEN && { note "ALERT: token removal failed"; exit 4; } || note "token removed"
fi
U=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "$WEB/.env.local" | cut -d= -f2- | tr -d '"'); K=$(grep -E '^NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=' "$WEB/.env.local" | cut -d= -f2- | tr -d '"')
h=$(curl -sS -m 15 "$U/rest/v1/x" -H "apikey: $K" -H 'Accept-Profile: blsh_no_such_schema' | python3 -I -c 'import json,sys;print(json.load(sys.stdin).get("message",""))')
[[ "$h" == "$OLD" ]] || { note "ALERT: blsh_replay_api still exposed ($h). NOT resetting; TJ must unexpose first."; exit 3; }
"$PG" "$DB" -A -t -f "$KIT/reset.sql" > "$OUT/cutoff-reset.out" 2>&1; note "reset exit $?"
"$PG" "$DB" -A -t -q -v app=- -v pid=0 -v bstart=epoch -v astart=epoch -v full=off -f "$HERE/state-probe.sql" > "$OUT/cutoff-post-reset-probe.json" 2>&1
python3 -I - "$OUT/cutoff-post-reset-probe.json" <<'PY' | tee -a "$OUT/cutoff.log"
import json, sys
t = open(sys.argv[1]).read(); p = json.JSONDecoder().raw_decode(t[t.index("{"):])[0]
ok = p["roles"] == p["schemas"] == p["memberships"] == p["tables"] == p["functions"] == 0 and p["lingeringInstallBackends"] == 0 and p["outsideNarrowFingerprint"] == "4eebb9633ba7e4718a82f12435ea4ecb"
print(json.dumps({"cleanupVerified": ok, "roles": p["roles"], "schemas": p["schemas"], "memberships": p["memberships"], "outsideNarrowFingerprint": p["outsideNarrowFingerprint"]}))
PY
touch "$OUT/CLEANED"
