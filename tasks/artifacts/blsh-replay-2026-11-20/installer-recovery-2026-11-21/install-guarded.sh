#!/bin/bash
# BLSH replay sandbox installer with disconnect classification. Never retries on an ambiguous state.
#
# Env:
#   INSTALL_DB     psql connection string for the install session (hosted: postgres via session pooler, sslmode=require)
#   PROBE_DB       connection string for the fresh-connection state probe (hosted: same as INSTALL_DB)
#   EXPECTED       path to EXPECTED.json (reference sandboxFingerprint from a clean disposable install of the same bytes)
#   OUT            empty output directory for receipts
#   MAX_ATTEMPTS   default 1. A further attempt is made ONLY after a rolled_back_clean verdict.
#   LINGER_WAIT_S  default 120: how long to wait for the failed install's backend to disappear before classifying
#   FULL           on|off (default off): also compare the full outside-sandbox catalog fingerprint (disposable clusters)
#   PSQL           psql binary (default psql)
#   PRE_CLASSIFY_HOOK  TEST-ONLY: a command run after a failed attempt and before the probe (fault tests use it to
#                      create ambiguous states). Must never be set for a hosted run; the script refuses it with HOSTED=1.
# Exit: 0 committed_verified · 3 rolled_back_clean (no attempts left) · 4 ambiguous (STOP) · 10 artifact mismatch ·
#       11 not clean before install · 12 bad invocation
set -u
HERE=$(cd "$(dirname "$0")" && pwd -P)
SQL="$HERE/artifact/install.sql"; PROBE="$HERE/state-probe.sql"
PIN=766aec3bfbc3b766c113a5f25e64b35d9fbebf54083c2ef49c54cef84f24519b
: "${INSTALL_DB:?}" "${PROBE_DB:?}" "${EXPECTED:?}" "${OUT:?}"
MAX_ATTEMPTS=${MAX_ATTEMPTS:-1}; LINGER_WAIT_S=${LINGER_WAIT_S:-120}; FULL=${FULL:-off}; PSQL=${PSQL:-psql}
if [[ "${HOSTED:-0}" == 1 && -n "${PRE_CLASSIFY_HOOK:-}" ]]; then echo "PRE_CLASSIFY_HOOK is test-only" >&2; exit 12; fi
mkdir -p "$OUT"
now() { python3 -I -c 'import datetime;print(datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")[:-4]+"Z")'; }
final() { echo "$2" > "$OUT/FINAL.json"; cat "$OUT/FINAL.json"; exit "$1"; }

have=$(shasum -a 256 "$SQL" | cut -c1-64)
[[ "$have" == "$PIN" ]] || final 10 "{\"verdict\":\"artifact_mismatch\",\"have\":\"$have\",\"pin\":\"$PIN\"}"

probe() {  # probe APP OUTFILE [PID BSTART ASTART] -> 0 if the probe ran
  PGAPPNAME=blsh-installer-probe "$PSQL" "$PROBE_DB" -X -A -t -q -v ON_ERROR_STOP=1 -v app="$1" -v pid="${3:-0}" -v bstart="${4:-epoch}" -v astart="${5:-epoch}" \
    -v full="$FULL" -f "$PROBE" > "$2.raw" 2>"$2.err" || return 1
  python3 -I - "$2.raw" "$2" <<'PY' || return 1
import json, sys
objs = [json.loads(l) for l in open(sys.argv[1]) if l.strip().startswith("{")]
out = {}
for o in objs: out.update(o)
json.dump(out, open(sys.argv[2], "w"), indent=1, sort_keys=True)
PY
}

probe "none" "$OUT/pre.json" || final 4 '{"verdict":"ambiguous_probe_failed","phase":"pre"}'
python3 -I - "$OUT/pre.json" <<'PY' || final 11 "{\"verdict\":\"not_clean_before_install\",\"pre\":$(cat "$OUT/pre.json")}"
import json, sys
p = json.load(open(sys.argv[1]))
sys.exit(0 if p["roles"] == 0 and p["schemas"] == 0 and p["memberships"] == 0 else 1)
PY

nonce=$(python3 -I -c 'import secrets;print(secrets.token_hex(4))')
for ((i = 1; i <= MAX_ATTEMPTS; i++)); do
  A="$OUT/attempt-$i"; mkdir -p "$A"; app="blsh-install-$nonce-a$i"
  started=$(now)
  # Same session: first a read-only line naming this backend (pid + backend_start), then the pinned bytes unchanged.
  PGAPPNAME="$app" "$PSQL" "$INSTALL_DB" -X -q -A -t -v ON_ERROR_STOP=1 \
    -c "select format('INSTALL_BACKEND %s %s', pg_backend_pid(), (select backend_start from pg_stat_activity where pid = pg_backend_pid()))" \
    -f "$SQL" > "$A/install.out" 2>&1; rc=$?
  read -r bpid bstart < <(sed -n 's/^INSTALL_BACKEND \([0-9]*\) \(.*\)$/\1 \2/p' "$A/install.out" | head -1 | sed 's/ /|/' | tr '|' ' ')
  bpid=${bpid:-0}; bstart=${bstart:-epoch}
  ended=$(now)
  # The attempt's own cause record: written once, from this attempt's psql output only.
  python3 -I - "$A/install.out" "$A/cause.json" "$rc" "$started" "$ended" "$app" <<'PY'
import json, re, sys
text = open(sys.argv[1], errors="replace").read()
lost = bool(re.search(r"connection to server was lost|server closed the connection unexpectedly|could not receive data|SSL SYSCALL", text))
line = re.findall(r"psql:[^:]*install\.sql:(\d+):", text)
json.dump({"attempt_app": sys.argv[6], "installBackend": (re.findall(r"^INSTALL_BACKEND (.*)$", text, re.M) or [None])[0], "psql_exit": int(sys.argv[3]), "startedAt": sys.argv[4], "endedAt": sys.argv[5],
           "connectionLost": lost, "failedAtLine": int(line[-1]) if line else None, "psqlStderrTail": text[-600:]},
          open(sys.argv[2], "w"), indent=1)
PY
  if [[ $rc -ne 0 && -n "${PRE_CLASSIFY_HOOK:-}" ]]; then bash -c "$PRE_CLASSIFY_HOOK" > "$A/test-hook.out" 2>&1; fi
  # Reconnect on a fresh connection; wait (bounded) until the attempt's backend is gone, so the state is final.
  deadline=$((SECONDS + LINGER_WAIT_S)); probed=0
  while :; do
    # Identity is the backend pid + backend_start only (application_name is not visible through Supavisor), same as hosted.
    if probe "-" "$A/post.json" "$bpid" "$bstart" "$started"; then
      probed=1
      lg=$(python3 -I -c 'import json,sys;print(json.load(open(sys.argv[1]))["lingeringInstallBackends"])' "$A/post.json")
      [[ "$lg" == 0 ]] && break
    fi
    (( SECONDS >= deadline )) && break
    sleep 3
  done
  verdict=$(python3 -I - "$OUT/pre.json" "$A/post.json" "$EXPECTED" "$probed" "$rc" <<'PY'
import json, os, sys
pre_p, post_p, exp_p, probed, rc = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] == "1", int(sys.argv[5])
if not probed or not os.path.exists(post_p):
    print(json.dumps({"verdict": "ambiguous_probe_failed", "reason": "fresh-connection probe never succeeded"})); sys.exit()
pre, post, exp = json.load(open(pre_p)), json.load(open(post_p)), json.load(open(exp_p))
if post["lingeringInstallBackends"] != 0:
    print(json.dumps({"verdict": "ambiguous_lingering", "reason": "the attempt's backend is still alive; its transaction outcome is not final", "detail": post.get("lingeringDetail")})); sys.exit()
same_outside = post["outsideNarrowFingerprint"] == pre["outsideNarrowFingerprint"] and \
               post.get("outsideFullFingerprint") == pre.get("outsideFullFingerprint")
nothing = post["roles"] == 0 and post["schemas"] == 0 and post["memberships"] == 0 and post["tables"] == 0 and post["functions"] == 0
if nothing and same_outside:
    print(json.dumps({"verdict": "rolled_back_clean", "psqlExit": rc})); sys.exit()
if post["sandboxFingerprint"] == exp["sandboxFingerprint"] and same_outside:
    print(json.dumps({"verdict": "committed_verified", "psqlExit": rc, "sandboxFingerprint": post["sandboxFingerprint"]})); sys.exit()
diff = sorted(k for k in exp.get("parts", {}) if post.get("parts", {}).get(k) != exp["parts"][k])
print(json.dumps({"verdict": "ambiguous_state", "reason": "neither clean nor the exact reference install", "roles": post["roles"],
                  "schemas": post["schemas"], "memberships": post["memberships"], "sameOutside": same_outside, "differingParts": diff}))
PY
)
  echo "$verdict" > "$A/verdict.json"
  case "$verdict" in
    *'"committed_verified"'*)
      final 0 "{\"verdict\":\"committed_verified\",\"attempts\":$i,\"note\":\"if psql_exit was non-zero the trailing notify pgrst was not sent; exposing the schema reloads PostgREST\"}" ;;
    *'"rolled_back_clean"'*)
      if (( i < MAX_ATTEMPTS )); then continue; fi
      final 3 "{\"verdict\":\"rolled_back_clean\",\"attempts\":$i,\"note\":\"state equals pre-install; any further attempt needs its own approval\"}" ;;
    *)
      final 4 "{\"verdict\":\"STOP\",\"attempts\":$i,\"detail\":$verdict,\"note\":\"ambiguous: no retry; operator must inspect\"}" ;;
  esac
done
