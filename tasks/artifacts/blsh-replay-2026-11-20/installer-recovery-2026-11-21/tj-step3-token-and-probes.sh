#!/bin/bash
# BLSH R2b steps 2b + 3 + probes: TJ runs this in his own terminal, and only after approving steps 2–3 AND adding
# blsh_replay_api to Supabase → Data API → Exposed schemas (keeping every existing entry).
# The script prompts for the project's legacy JWT secret with a hidden terminal prompt (type it from the dashboard's
# revealed value). The secret is read only by one short python process (getpass from /dev/tty), never echoed, and never
# in the clipboard, shell history, env, argv, logs, files or Vercel. Only the 23 h replay-role token is sent to Vercel.
# The token is never printed, written, exported or put in argv: vercel and the probe script get it on stdin, and curl
# reads the Authorization header from a pipe (-H @<(printf ...); printf is a bash builtin).
# What it does:
#   1. notify pgrst 'reload schema'; checks Exposed schemas = the old four + blsh_replay_api, exactly;
#   2. mints ONE token {"role":"blsh_replay_api","iat":now,"exp":now+23h} (HS256, same claims as token_setup.py);
#   3. runs the kit's 9 non-mutating probes plus 4 pgsodium probes, as anon and as the token (token in memory only);
#   4. ONLY IF every probe passed: vercel env add BLSH_REPLAY_API_TOKEN production --sensitive (token on stdin), and
#      checks it exists once. Exit 0 = everything passed; the sandbox stays exposed for the step-4 push decision.
#   5. On ANY failure after the exposure check (mint, probes, vercel): exit non-zero AND clean up, in the packet's order:
#      remove the token if it exists → ask TJ to remove blsh_replay_api from Exposed schemas and wait (bounded) until
#      PostgREST no longer lists it → reset.sql → state probe must equal the step-0 state. Never resets while exposed.
# Exit: 0 pass · 11 env · 12 exposure not exactly old+blsh_replay_api (nothing changed; fix the dashboard) ·
#       20 failure, cleanup verified · 30 failure, token removal failed · 31 failure, still exposed after the wait
#       (sandbox NOT reset; unexpose, then run reset.sql) · 32 failure, reset or post-reset verification failed.
# Usage: bash tj-step3-token-and-probes.sh OUT_DIR   (a new, empty receipts directory)
set -u
H=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-replay-2026-11-20/installer-recovery-2026-11-21
OUT=${1:?OUT_DIR}; [[ -e "$OUT" ]] && { echo "OUT exists: use a new directory"; exit 11; }; mkdir -p "$OUT"
KIT="$HOME/Library/Application Support/Claude/side-session-notes/local_23eb6989-6502-4cc8-afbc-0bc7caafa992/blsh-hosted-kit"
ENVF=/Users/tim/Code/fhfhockey.com/web/.env.local; WEB=/Users/tim/Code/fhfhockey.com/web
VERCEL=/Users/tim/Code/fhfhockey.com/functions/node_modules/.bin/vercel
PG=/Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-pregame-capture-2026-11-14/operator/pgpool.sh
STEP0_FP=4eebb9633ba7e4718a82f12435ea4ecb; UNEXPOSE_WAIT_S=900; POLL_S=10; RELOAD_WAIT_S=3
OLD="The schema must be one of the following: public, storage, graphql_public, analytics"
# Dry run only (local stubs, proof of the failure path): every override is ignored unless BLSH_STEP3_DRYRUN=1, and a dry
# run refuses any REST endpoint that is not 127.0.0.1.
if [[ "${BLSH_STEP3_DRYRUN:-0}" == 1 ]]; then
  ENVF=${DRY_ENVF:?}; WEB=${DRY_WEB:?}; VERCEL=${DRY_VERCEL:?}; PG=${DRY_PG:?}; UNEXPOSE_WAIT_S=${DRY_UNEXPOSE_WAIT_S:-20}; POLL_S=1; RELOAD_WAIT_S=0
fi
note() { echo "$(date -u +%H:%M:%SZ) $*" | tee -a "$OUT/step2-3.log"; }
[[ $(shasum -a 256 "$H/probes-stdin.sh" | cut -c1-64) == 32e18db4248a81ad3a26f1884e240d93a7e90b9a8c84f30f1bdb149eb6a2e019 ]] || { note "STOP: probes-stdin.sh hash"; exit 11; }
[[ $(shasum -a 256 "$KIT/reset.sql" | cut -c1-64) == 8a7634069a27eebc9c4800f7a8fbcf60df37201b2af72ae65a26d36edcf3916e ]] || { note "STOP: reset.sql hash"; exit 11; }
REST="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "$ENVF" | head -1 | cut -d= -f2- | tr -d '"')/rest/v1"
APIKEY=$(grep -E '^NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=' "$ENVF" | head -1 | cut -d= -f2- | tr -d '"')
if [[ "${BLSH_STEP3_DRYRUN:-0}" == 1 ]]; then [[ "$REST" == http://127.0.0.1:*/rest/v1 ]] || { note "STOP: dry run must target 127.0.0.1"; exit 11; }
else [[ "$REST" == https://*.supabase.co/rest/v1 ]] || { note "STOP: env"; exit 11; }; fi
[[ -n "$APIKEY" ]] || { note "STOP: env"; exit 11; }
exposed() { curl -sS -m 15 "$REST/blsh_no_such_table" -H "apikey: $APIKEY" -H "Accept-Profile: blsh_no_such_schema" | python3 -I -c 'import json,sys;print(json.load(sys.stdin).get("message",""))'; }
token_count() { (cd "$WEB" && "$VERCEL" env ls production 2>/dev/null) | grep -c BLSH_REPLAY_API_TOKEN; }

cleanup() {  # cleanup REASON: undo in the packet's order, then exit non-zero
  local reason=$1; unset TOKEN
  note "FAIL: $reason -> cleanup"
  if [[ $(token_count) != 0 ]]; then
    (cd "$WEB" && "$VERCEL" env rm BLSH_REPLAY_API_TOKEN production --yes) >/dev/null 2>"$OUT/vercel-env-rm.err"
    [[ $(token_count) == 0 ]] && note "token removed from Vercel" || { note "CLEANUP INCOMPLETE: token still in Vercel; remove BLSH_REPLAY_API_TOKEN, then tell Chef"; exit 30; }
  else note "no token in Vercel"; fi
  note "ACTION FOR TJ: remove blsh_replay_api from Supabase → Data API → Exposed schemas now (keep the other four). Waiting up to ${UNEXPOSE_WAIT_S}s."
  local deadline=$((SECONDS + UNEXPOSE_WAIT_S)) h
  while :; do
    h=$(exposed); [[ "$h" == "$OLD" ]] && { note "unexposed: $h"; break; }
    (( SECONDS >= deadline )) && { note "CLEANUP INCOMPLETE: still exposed ($h). Sandbox NOT reset. Unexpose, then tell Chef to run reset.sql."; exit 31; }
    sleep "$POLL_S"
  done
  "$PG" "sslmode=require" -A -t -f "$KIT/reset.sql" > "$OUT/reset.out" 2>&1 || { note "CLEANUP INCOMPLETE: reset.sql failed"; exit 32; }
  "$PG" "sslmode=require" -A -t -q -v app=- -v pid=0 -v bstart=epoch -v astart=epoch -v full=off -f "$H/state-probe.sql" > "$OUT/post-reset-probe.json" 2>&1
  local res prc
  res=$(python3 -I - "$OUT/post-reset-probe.json" "$STEP0_FP" <<'PY'
import json, sys
try:
    t = open(sys.argv[1]).read(); p = json.JSONDecoder().raw_decode(t[t.index("{"):])[0]
except Exception as e:
    print(json.dumps({"cleanupVerified": False, "error": str(e)[:200]})); sys.exit(1)
ok = p["roles"] == p["schemas"] == p["memberships"] == p["tables"] == p["functions"] == 0 and p["lingeringInstallBackends"] == 0 and p["outsideNarrowFingerprint"] == sys.argv[2]
print(json.dumps({"cleanupVerified": ok, "roles": p["roles"], "schemas": p["schemas"], "memberships": p["memberships"], "outsideNarrowFingerprint": p["outsideNarrowFingerprint"]}))
sys.exit(0 if ok else 1)
PY
  ); prc=$?
  note "$res"; [[ $prc -eq 0 ]] || { note "CLEANUP INCOMPLETE: post-reset state differs from step 0"; exit 32; }
  note "FAILED ($reason); cleanup verified: token absent, unexposed, sandbox reset to the step-0 state"; exit 20
}

# 1. Exposure must already be saved in the dashboard: the PGRST106 hint must list blsh_replay_api and nothing new.
"$PG" "sslmode=require" -A -t -q -c "notify pgrst, 'reload schema'" >/dev/null && note "notify pgrst sent"; sleep "$RELOAD_WAIT_S"
hint=$(exposed); note "exposed: $hint"
[[ "$hint" == "$OLD, blsh_replay_api" ]] \
  || { note "STOP: Exposed schemas are not exactly the old list plus blsh_replay_api. Nothing was changed; fix the dashboard (or restore the old four), then tell Chef."; exit 12; }
[[ $(token_count) == 0 ]] || cleanup "BLSH_REPLAY_API_TOKEN already exists in production"

# 2. Mint once. The SIGNING SECRET exists only inside this one python process: getpass reads it from the terminal
# (/dev/tty, no echo), it is never in bash, argv, env, the clipboard, shell history, a log or a file, and python exits
# right after signing. Only the replay-role token (23 h) comes back on stdout, captured into $TOKEN in this script.
TOKEN=$(python3 -I -c '
import base64, getpass, hashlib, hmac, json, time
s = getpass.getpass("Legacy JWT secret (hidden input, not stored): ").strip()
if len(s) < 32: raise SystemExit("that does not look like the JWT secret")
now = int(time.time()); b = lambda r: base64.urlsafe_b64encode(r).rstrip(b"=")
body = b".".join([b(b"{\"alg\":\"HS256\",\"typ\":\"JWT\"}"), b(json.dumps({"role": "blsh_replay_api", "iat": now, "exp": now + 23 * 3600}, separators=(",", ":")).encode())])
sig = hmac.new(s.encode(), body, hashlib.sha256).digest(); s = None
print((body + b"." + b(sig)).decode())') || cleanup "token mint failed"
note "token minted (23 h, role blsh_replay_api); the secret was held only by the minting process"

# 3. Probes (non-mutating), with the token in memory only. Nothing goes to Vercel unless all 13 pass.
printf '%s\n' "$TOKEN" | REST="$REST" APIKEY="$APIKEY" bash "$H/probes-stdin.sh" > "$OUT/probes.jsonl"; kp=$?; note "kit probes exit $kp"
pg_probe() {  # who name curl-args...
  local who=$1 name=$2; shift 2; local r
  if [[ $who == token ]]; then r=$(curl -sS -m 15 -w '\n%{http_code}' -H "apikey: $APIKEY" -H @<(printf 'Authorization: Bearer %s\n' "$TOKEN") "$@")
  else r=$(curl -sS -m 15 -w '\n%{http_code}' -H "apikey: $APIKEY" "$@"); fi
  python3 -I -c '
import json, sys
who, name, raw = sys.argv[1:4]; body, http = raw.rsplit("\n", 1)
try: d = json.loads(body)
except Exception: d = {}
ok = http == "406" and d.get("code") == "PGRST106"
print(json.dumps({"probe": name, "who": who, "http": int(http), "code": d.get("code"), "ok": ok, "expect": "406 PGRST106", "message": (d.get("message") or "")[:160]}))
sys.exit(0 if ok else 1)' "$who" "$name" "$r"
}
pf=0
for who in token anon; do
  pg_probe $who pgsodium-rpc-get_key_by_name -X POST "$REST/rpc/get_key_by_name" -H "Content-Profile: pgsodium" -H "Content-Type: application/json" -d '{"name":"blsh_probe_none"}' >> "$OUT/pgsodium-probes.jsonl" || pf=$((pf+1))
  pg_probe $who pgsodium-read-key -H "Accept-Profile: pgsodium" "$REST/key?select=id&limit=0" >> "$OUT/pgsodium-probes.jsonl" || pf=$((pf+1))
done
note "pgsodium probes failures: $pf"
[[ $kp -eq 0 && $(grep -c '"ok": true' "$OUT/probes.jsonl") -eq 9 && $pf -eq 0 && $(grep -c '"ok": true' "$OUT/pgsodium-probes.jsonl") -eq 4 ]] \
  || cleanup "probes failed (kit exit $kp, pgsodium failures $pf)"

# 4. All 13 probes passed: install the token, then check it exists exactly once.
printf '%s' "$TOKEN" | (cd "$WEB" && "$VERCEL" env add BLSH_REPLAY_API_TOKEN production --sensitive) >/dev/null 2>"$OUT/vercel-env-add.err" \
  || cleanup "vercel env add failed (see vercel-env-add.err)"
unset TOKEN
[[ $(token_count) == 1 ]] || cleanup "token not present exactly once after vercel env add"
note "PASS: 9 kit + 4 pgsodium probes ok; token installed once. Tell Chef: step 2-3 passed (bring the 39a15979 push request)."
exit 0
