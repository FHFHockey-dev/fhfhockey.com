#!/bin/bash
# Dummy-run proof for tj-step3-token-and-probes.sh failure handling (TJ 1:35 CT). Local stubs only: a PostgREST stand-in on
# 127.0.0.1, a fake vercel CLI and a fake psql wrapper that record calls. Nothing reaches Supabase or Vercel.
# Scenarios: A failed denial probe + TJ unexposes → exit 20, no token, reset, cleanup verified
#            B failed pgsodium probe + TJ never unexposes → exit 31, no token, NO reset
#            C all 13 probes pass → exit 0, token added once, no reset
#            D probes pass, vercel env add fails → exit 20, token absent, reset, cleanup verified
# Usage: LC_ALL=C bash dryrun-step3.sh OUT_DIR
set -u
H=$(cd "$(dirname "$0")" && pwd -P); R=$1; mkdir -p "$R"; R=$(cd "$R" && pwd -P); PORT=55811
cat > "$R/stub.py" <<'PY'
import http.server, json, os, sys
STATE, MODE = sys.argv[2], sys.argv[3]
OLD = "The schema must be one of the following: public, storage, graphql_public, analytics"
class H(http.server.BaseHTTPRequestHandler):
    def _r(self, code, obj):
        b = json.dumps(obj).encode(); self.send_response(code); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def _do(self):
        n = int(self.headers.get("Content-Length") or 0); n and self.rfile.read(n)
        prof = self.headers.get("Accept-Profile") or self.headers.get("Content-Profile") or ""
        tok = (self.headers.get("Authorization") or "").startswith("Bearer ")
        p = self.path
        if prof == "blsh_no_such_schema":
            msg = OLD if os.path.exists(os.path.join(STATE, "unexposed")) else OLD + ", blsh_replay_api"
            return self._r(406, {"code": "PGRST106", "message": msg})
        if prof == "pgsodium":
            if MODE == "pgsodium_token_200" and tok: return self._r(200, [])
            return self._r(406, {"code": "PGRST106", "message": "stub"})
        if prof in ("cron", "blsh_replay"): return self._r(406, {"code": "PGRST106", "message": "stub"})
        if "blsh_replay_iso_probe_absent" in p: return self._r(404, {"code": "PGRST205", "message": "stub"}) if tok else self._r(404, {})  # hosted: anon gets 404 {}
        if "rpc/blsh_replay_fixture_v1" in p:
            if tok or MODE == "anon_rpc_200": return self._r(200, {})
            return self._r(401, {"code": "42501", "message": "stub"})
        return self._r(500, {"code": "stub_unhandled", "message": p})
    do_GET = do_POST = do_DELETE = _do
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
PY
run() {  # run NAME MODE UNEXPOSE_AFTER_S(-1 never) VERCEL_ADD_FAILS(0/1) WANT_EXIT [PRE_TOKEN 0/1]
  local name=$1 mode=$2 un=$3 addfail=$4 want=$5 S="$R/$1"; mkdir -p "$S/state" "$S/web"; [[ ${6:-0} == 1 ]] && touch "$S/state/token"
  printf 'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:%s\nNEXT_PUBLIC_SUPABASE_PUBLIC_KEY=pub-key-not-secret\n' $PORT > "$S/env"
  cat > "$S/vercel" <<EOF
#!/bin/bash
echo "vercel \$*" >> "$S/calls.log"
case "\$1 \$2" in
  "env ls") [[ -e "$S/state/token" ]] && echo "BLSH_REPLAY_API_TOKEN  Encrypted  Production"; exit 0;;
  "env add") v=\$(cat); [[ $addfail == 1 ]] && { echo "vercel-add-stub-fail" >&2; exit 1; }
             python3 -I -c 'import sys;t=sys.argv[1];print("added-token-shape parts=%d len=%d" % (len(t.split(".")), len(t)))' "\$v" >> "$S/calls.log"; touch "$S/state/token";;
  "env rm") rm -f "$S/state/token";;
esac
EOF
  cat > "$S/pg" <<EOF
#!/bin/bash
echo "pg \$*" >> "$S/calls.log"
case "\$*" in
  *reset.sql*) echo RESET >> "$S/calls.log"; touch "$S/state/reset"; echo COMMIT;;
  *state-probe.sql*) if [[ -e "$S/state/reset" ]]; then echo '{"roles":0,"schemas":0,"memberships":0,"tables":0,"functions":0,"lingeringInstallBackends":0,"outsideNarrowFingerprint":"4eebb9633ba7e4718a82f12435ea4ecb"}';
                     else echo '{"roles":2,"schemas":2,"memberships":2,"tables":13,"functions":39,"lingeringInstallBackends":0,"outsideNarrowFingerprint":"4eebb9633ba7e4718a82f12435ea4ecb"}'; fi;;
esac
EOF
  chmod +x "$S/vercel" "$S/pg"
  python3 -I "$R/stub.py" $PORT "$S/state" "$mode" & local sp=$!; sleep 0.6
  [[ $un -ge 0 ]] && ( sleep "$un"; touch "$S/state/unexposed" ) &
  # The hidden prompt needs a terminal: script(1) gives the run a pty; the dummy secret is typed on it.
  # Type the dummy secret only after the hidden prompt is up (as a person would), and keep stdin open until the run ends.
  ( sleep 2; printf 'DUMMY-signing-secret-0123456789abcdefghij\n'; sleep 40 ) | BLSH_STEP3_DRYRUN=1 DRY_ENVF="$S/env" DRY_WEB="$S/web" DRY_VERCEL="$S/vercel" DRY_PG="$S/pg" DRY_UNEXPOSE_WAIT_S=8 \
    script -q /dev/null bash -c 'bash "$1" "$2"; echo $? > "$3"' _ "$H/tj-step3-token-and-probes.sh" "$S/out" "$S/exit.txt" > "$S/console.txt" 2>&1
  kill $sp 2>/dev/null; wait $sp 2>/dev/null
  python3 -I - "$S" "$name" "$want" <<'PY' | tee -a "$R/summary.jsonl"
import json, os, sys
s, name, want = sys.argv[1], sys.argv[2], int(sys.argv[3])
log = open(os.path.join(s, "out", "step2-3.log")).read(); calls = open(os.path.join(s, "calls.log")).read() if os.path.exists(os.path.join(s, "calls.log")) else ""
last = [l for l in log.splitlines() if l.strip()][-1]
rc = int(open(os.path.join(s, "exit.txt")).read().strip())
r = {"scenario": name, "wantExit": want, "exit": rc, "ok": rc == want,
     "tokenAddedEver": "added-token-shape" in calls, "tokenPresentAtEnd": os.path.exists(os.path.join(s, "state", "token")),
     "resetRan": "RESET" in calls, "vercelCalls": [l for l in calls.splitlines() if l.startswith("vercel env ") and " ls " not in l],
     "lastLog": last[-170:]}
print(json.dumps(r))
PY
}
: > "$R/summary.jsonl"
run A-denial-probe-fails anon_rpc_200 2 0 20
run B-pgsodium-fails-never-unexposed pgsodium_token_200 -1 0 31
run C-all-pass none -1 0 0
run D-vercel-add-fails none 2 1 20
run E-token-present-then-fail none 2 0 20 1
python3 -I - "$R/summary.jsonl" <<'PY' | tee "$R/RESULT.json"
import json, sys
rows = [json.loads(l) for l in open(sys.argv[1])]
want = {"A-denial-probe-fails": dict(tokenAddedEver=False, tokenPresentAtEnd=False, resetRan=True),
        "B-pgsodium-fails-never-unexposed": dict(tokenAddedEver=False, tokenPresentAtEnd=False, resetRan=False),
        "C-all-pass": dict(tokenAddedEver=True, tokenPresentAtEnd=True, resetRan=False),
        "D-vercel-add-fails": dict(tokenAddedEver=False, tokenPresentAtEnd=False, resetRan=True),
        "E-token-present-then-fail": dict(tokenAddedEver=False, tokenPresentAtEnd=False, resetRan=True)}
checks = {r["scenario"]: r["ok"] and all(r[k] == v for k, v in want[r["scenario"]].items()) for r in rows}
checks["E-token-removed-via-vercel-env-rm"] = any("vercel env rm BLSH_REPLAY_API_TOKEN production --yes" in c for r in rows if r["scenario"].startswith("E-") for c in r["vercelCalls"])
print(json.dumps({"checks": checks, "allPass": all(checks.values()) and len(checks) == 6}, indent=1))
PY
