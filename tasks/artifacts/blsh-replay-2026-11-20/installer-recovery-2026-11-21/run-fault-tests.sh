#!/bin/bash
# Fault tests for the pinned BLSH install.sql on disposable PG 15 clusters (loopback, trust auth, deleted afterwards).
# Usage: bash run-fault-tests.sh EMPTY_OUT_DIR
set -u
HERE=$(cd "$(dirname "$0")" && pwd -P); OUT=$1; mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd -P)
B=${PG_BIN:-/opt/homebrew/opt/postgresql@15/bin}; export PSQL="$B/psql"
PGP=55791; PXP=55792; MARK='values (670035, 9910035'   # install.sql line 1232, where the hosted attempt lost its connection
[[ $(grep -c -F "$MARK" "$HERE/artifact/install.sql") == 1 ]] || { echo "marker not unique"; exit 1; }
"$B/postgres" --version > "$OUT/postgres-version.txt"

start_cluster() {  # start_cluster DIR
  "$B/initdb" -U postgres -A trust -D "$1/data" >/dev/null || exit 1
  "$B/pg_ctl" -D "$1/data" -o "-p $PGP -k '' -c listen_addresses=127.0.0.1 -c log_statement=ddl -c log_connections=on -c log_disconnections=on" -l "$1/server.log" -w start >/dev/null || { cat "$1/server.log"; exit 1; }
  "$PSQL" -X -q -h 127.0.0.1 -p $PGP -U postgres -d postgres -v ON_ERROR_STOP=1 <<'EOF'
-- Supabase-shaped roles and the two inherited grants mirrored by local-copy.sh.
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role authenticator login noinherit; grant anon, authenticated, service_role to authenticator;
create schema cron; create table cron.job(jobid bigserial primary key, jobname text); create table cron.job_run_details(runid bigserial primary key, note text);
revoke all on schema cron from public; grant delete on cron.job_run_details to public;
grant usage, create on schema public to public;
create table public.games(id bigint primary key); create table public.blsh_capture_runs(id bigint primary key);
create table public.blsh_capture_control(singleton boolean primary key default true, enabled boolean not null default false);
insert into public.blsh_capture_control values (true, false);
EOF
}
stop_cluster() { "$B/pg_ctl" -D "$1/data" -m fast -w stop >/dev/null 2>&1; }
DIRECT="host=127.0.0.1 port=$PGP user=postgres dbname=postgres sslmode=disable"
VIA_PROXY="host=127.0.0.1 port=$PXP user=postgres dbname=postgres sslmode=disable"

# 1. Reference installs on two fresh clusters: the expected committed fingerprint, and proof it is cluster-independent.
for r in 1 2; do
  W=$(mktemp -d); start_cluster "$W"
  "$PSQL" "$DIRECT" -X -q -v ON_ERROR_STOP=1 -f "$HERE/artifact/install.sql" > "$OUT/reference-$r-install.out" 2>&1; echo "$?" > "$OUT/reference-$r-exit.txt"
  "$PSQL" "$DIRECT" -X -A -t -q -v ON_ERROR_STOP=1 -v app=none -v pid=0 -v bstart=epoch -v astart=epoch -v full=off -f "$HERE/state-probe.sql" > "$OUT/reference-$r.json"
  stop_cluster "$W"; rm -rf "$W"
done
cp "$OUT/reference-1.json" "$OUT/EXPECTED.json"; export EXPECTED="$OUT/EXPECTED.json"

# 2. Fault cases. Each gets a fresh cluster; the install goes through the fault proxy, the probe reconnects directly.
run_case() {  # run_case NAME PROXY_MODE MAX_ATTEMPTS EXPECT_EXIT EXPECT_INSTALL_TXNS [HOOK]
  local name=$1 mode=$2 max=$3 want=$4 want_txn=$5 hook=${6:-}
  local C="$OUT/$name"; mkdir -p "$C"; W=$(mktemp -d); start_cluster "$W"
  "$B/psql" "$DIRECT" -X -A -t -c "select 1" >/dev/null
  PROXY_HOLD_S=${PROXY_HOLD_S:-40} python3 -I "$HERE/fault_proxy.py" $PXP $PGP "$mode" "$MARK" "$C/proxy-events.jsonl" & ppid=$!; sleep 0.5
  export CLUSTER_DIR="$W" CASE_OUT="$C/run" DIRECT
  INSTALL_DB="$VIA_PROXY" PROBE_DB="$DIRECT" OUT="$C/run" MAX_ATTEMPTS=$max LINGER_WAIT_S=${LINGER:-20} FULL=on \
    PRE_CLASSIFY_HOOK="$hook" bash "$HERE/install-guarded.sh" > "$C/stdout.txt" 2>&1; rc=$?
  kill $ppid 2>/dev/null; wait $ppid 2>/dev/null
  stop_cluster "$W"
  # Independent server-side evidence: how many install transactions started (the installer's first DDL statement).
  local txns; txns=$(grep -c "statement: create role blsh_replay_owner" "$W/server.log")
  grep -E "could not receive data|unexpected EOF|connection reset|terminating|disconnection:" "$W/server.log" | sed -E 's/^[0-9-]+ [0-9:.]+ [A-Z]+ \[[0-9]+\] //' | sort | uniq -c > "$C/server-disconnect-lines.txt"
  cp "$W/server.log" "$C/server.log"; rm -rf "$W"
  python3 -I - "$C" "$name" "$rc" "$want" "$txns" "$want_txn" <<'PY' | tee -a "$OUT/summary.jsonl"
import json, os, sys
c, name, rc, want, txns, want_txn = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6])
final = json.load(open(os.path.join(c, "run", "FINAL.json")))
attempts = sorted(d for d in os.listdir(os.path.join(c, "run")) if d.startswith("attempt-"))
causes = {a: json.load(open(os.path.join(c, "run", a, "cause.json"))) for a in attempts}
verdicts = {a: json.load(open(os.path.join(c, "run", a, "verdict.json"))) for a in attempts if os.path.exists(os.path.join(c, "run", a, "verdict.json"))}
print(json.dumps({"case": name, "pass": rc == want and txns == want_txn, "exit": rc, "expectExit": want,
  "installTxnsSeenByServer": txns, "expectInstallTxns": want_txn, "final": final["verdict"],
  "attempts": {a: {"psqlExit": causes[a]["psql_exit"], "connectionLost": causes[a]["connectionLost"], "failedAtLine": causes[a]["failedAtLine"],
                   "verdict": verdicts.get(a, {}).get("verdict")} for a in attempts}}))
PY
}
: > "$OUT/summary.jsonl"
run_case A-cut-before-commit          cut-before        1 3 1
run_case B-lost-commit-reply          drop-commit-reply 1 0 1
run_case D-cut-then-one-clean-retry   cut-before        2 0 2
run_case E-lost-reply-no-retry        drop-commit-reply 2 0 1
PROXY_HOLD_S=40 LINGER=8 run_case F-backend-held-open-stops cut-client-keep-server 2 4 1
PROXY_HOLD_S=40 LINGER=8 run_case J-pooler-rollback-backend-reused cut-client-pool-reuse 1 3 1
run_case G-partial-state-stops        cut-before        2 4 1 '"$PSQL" "$DIRECT" -X -q -c "create role blsh_replay_api nologin"'
run_case H-committed-but-drifted-stops drop-commit-reply 2 4 1 '"$PSQL" "$DIRECT" -X -q -c "revoke execute on function blsh_replay_api.blsh_replay_fixture_v1() from blsh_replay_api"'
LINGER=6 run_case I-server-unreachable-stops cut-before 2 4 1 '"$(dirname "$PSQL")/pg_ctl" -D "$CLUSTER_DIR/data" -m fast -w stop'
python3 -I - "$OUT" <<'PY'
import json, sys
rows = [json.loads(l) for l in open(sys.argv[1] + "/summary.jsonl")]
r1, r2 = (json.load(open(f"{sys.argv[1]}/reference-{i}.json")) for i in (1, 2))
out = {"referenceExit": [open(f"{sys.argv[1]}/reference-{i}-exit.txt").read().strip() for i in (1, 2)],
       "referenceFingerprintStable": r1["sandboxFingerprint"] == r2["sandboxFingerprint"],
       "referenceSandboxFingerprint": r1["sandboxFingerprint"], "referenceTables": r1["tables"], "referenceFunctions": r1["functions"],
       "cases": len(rows), "passed": sum(r["pass"] for r in rows)}
out["allPass"] = out["passed"] == out["cases"] and out["referenceFingerprintStable"] and out["referenceExit"] == ["0", "0"]
json.dump(out, open(sys.argv[1] + "/RESULT.json", "w"), indent=1); print(json.dumps(out))
PY
