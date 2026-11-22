#!/bin/bash
# BLSH hosted replay: non-mutating Data API denial probes, as anon and as the sandbox token. Writes nothing, even if a
# denial unexpectedly failed: the DELETE filter matches no row, the POST target table does not exist, and the rest are reads.
# The only RPC called is the read-only positive control blsh_replay_fixture_v1.
# Usage: printf '%s\n' "$TOKEN" | REST=https://<ref>.supabase.co/rest/v1 APIKEY=<project public key> bash probes-stdin.sh > probes.jsonl
# (Copy of the kit's probes.sh 282a86a6; only change: the token arrives on stdin and reaches curl through a pipe
#  (-H @<(printf ...), printf is a bash builtin), so it is never in any process's argv or environment.)
# Hosted change (Nov 21 20:4xZ): hosted Supabase answers a POST to a nonexistent table with 404 and an empty body {}
#  (no PGRST205), so only the two post-nonexistent-table probes also accept 404 with no error code ('none').
# Neither key nor token is printed. Exit 0 only if every probe matches its expectation.
set -u
: "${REST:?set REST}"; : "${APIKEY:?set APIKEY}"; IFS= read -r TOKEN || true
fails=0
probe() {  # probe NAME WHO EXPECT_HTTP EXPECT_CODE curl-args...
  local name=$1 who=$2 want_http=$3 want_code=$4; shift 4
  local auth=(-H "apikey: $APIKEY")
  local body http
  if [[ $who == token ]]; then
    [[ -n $TOKEN ]] || { printf '{"probe":"%s","who":"token","ok":false,"skipped":"no TOKEN"}\n' "$name"; fails=$((fails + 1)); return; }
    body=$(curl -sS -w '\n%{http_code}' "${auth[@]}" -H @<(printf 'Authorization: Bearer %s\n' "$TOKEN") "$@") || body=$'curl_error\n000'
  else
    body=$(curl -sS -w '\n%{http_code}' "${auth[@]}" "$@") || body=$'curl_error\n000'
  fi
  http=${body##*$'\n'}; body=${body%$'\n'*}
  python3 -I -c '
import json, sys
name, who, http, want_http, want_code, body = sys.argv[1:7]
try: d = json.loads(body)
except Exception: d = {}
code = d.get("code") if isinstance(d, dict) else None
ok = http in want_http.split("|") and (want_code == "-" or (code if code is not None else "none") in want_code.split("|"))
print(json.dumps({"probe": name, "who": who, "http": int(http), "code": code, "ok": ok, "expect": want_http + " " + want_code,
  "hint": (d.get("hint") if isinstance(d, dict) else None), "message": ((d.get("message") or "")[:160] if isinstance(d, dict) else body[:160])}))
sys.exit(0 if ok else 1)' "$name" "$who" "$http" "$want_http" "$want_code" "$body" || fails=$((fails + 1))
}
J=(-H 'Content-Type: application/json')
probe cron-delete-nomatch token 406 PGRST106 -X DELETE -H 'Content-Profile: cron' "$REST/job_run_details?runid=eq.-1"
probe cron-delete-nomatch anon 406 PGRST106 -X DELETE -H 'Content-Profile: cron' "$REST/job_run_details?runid=eq.-1"
probe cron-read token 406 PGRST106 -H 'Accept-Profile: cron' "$REST/job_run_details?limit=1"
probe post-nonexistent-table token 404 'PGRST205|none' -X POST "${J[@]}" -d '{"x":1}' "$REST/blsh_replay_iso_probe_absent"
probe post-nonexistent-table anon 404 'PGRST205|none' -X POST "${J[@]}" -d '{"x":1}' "$REST/blsh_replay_iso_probe_absent"
probe private-schema-read token 406 PGRST106 -H 'Accept-Profile: blsh_replay' "$REST/fixture_files?limit=1"
probe private-schema-read anon 406 PGRST106 -H 'Accept-Profile: blsh_replay' "$REST/fixture_files?limit=1"
probe sandbox-rpc-positive-control token 200 - -X POST "${J[@]}" -H 'Content-Profile: blsh_replay_api' -d '{}' "$REST/rpc/blsh_replay_fixture_v1" -o /dev/null
probe sandbox-rpc anon '401|403' '42501|PGRST301|-' -X POST "${J[@]}" -H 'Content-Profile: blsh_replay_api' -d '{}' "$REST/rpc/blsh_replay_fixture_v1"
printf '{"summary":"probes","failures":%d}\n' "$fails"
exit $(( fails > 0 ))
