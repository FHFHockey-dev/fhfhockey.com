#!/bin/bash
# Duplicate-install and rerun-path check for the pinned BLSH install.sql on one disposable PG 15 cluster
# (loopback, trust auth, deleted afterwards). Sibling of run-fault-tests.sh; it changes none of the pinned files.
# Proves: (1) a second raw install over a committed sandbox refuses (blsh_replay_already_installed) and changes nothing;
#         (2) the guarded installer refuses before installing (exit 11) and changes nothing;
#         (3) reset.sql returns the cluster to the pre-install fingerprints;
#         (4) a reinstall after reset reproduces the reference sandbox fingerprint; a second reset is clean again.
# Usage: LC_ALL=C bash run-duplicate-install-check.sh EMPTY_OUT_DIR
set -u
HERE=$(cd "$(dirname "$0")" && pwd -P); OUT=$1; mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd -P)
B=${PG_BIN:-/opt/homebrew/opt/postgresql@15/bin}; PSQL="$B/psql"; PGP=55793
SQL="$HERE/artifact/install.sql"; RESET="$HERE/artifact/reset.sql"; EXPECTED="$HERE/receipts/fault-tests/EXPECTED.json"
[[ $(shasum -a 256 "$SQL" | cut -c1-64) == 766aec3bfbc3b766c113a5f25e64b35d9fbebf54083c2ef49c54cef84f24519b ]] || { echo "install.sql pin mismatch"; exit 10; }
[[ $(shasum -a 256 "$RESET" | cut -c1-64) == 8a7634069a27eebc9c4800f7a8fbcf60df37201b2af72ae65a26d36edcf3916e ]] || { echo "reset.sql pin mismatch"; exit 10; }
"$B/postgres" --version > "$OUT/postgres-version.txt"
W=$(mktemp -d); trap '"$B/pg_ctl" -D "$W/data" -m fast -w stop >/dev/null 2>&1; rm -rf "$W"' EXIT
"$B/initdb" -U postgres -A trust -D "$W/data" >/dev/null || exit 1
"$B/pg_ctl" -D "$W/data" -o "-p $PGP -k '' -c listen_addresses=127.0.0.1 -c log_statement=ddl" -l "$W/server.log" -w start >/dev/null || exit 1
DB="host=127.0.0.1 port=$PGP user=postgres dbname=postgres sslmode=disable"
# Same Supabase-shaped setup as run-fault-tests.sh start_cluster().
"$PSQL" "$DB" -X -q -v ON_ERROR_STOP=1 <<'EOF' || exit 1
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role authenticator login noinherit; grant anon, authenticated, service_role to authenticator;
create schema cron; create table cron.job(jobid bigserial primary key, jobname text); create table cron.job_run_details(runid bigserial primary key, note text);
revoke all on schema cron from public; grant delete on cron.job_run_details to public;
grant usage, create on schema public to public;
create table public.games(id bigint primary key); create table public.blsh_capture_runs(id bigint primary key);
create table public.blsh_capture_control(singleton boolean primary key default true, enabled boolean not null default false);
insert into public.blsh_capture_control values (true, false);
EOF
probe() {  # probe NAME -> $OUT/NAME.json (state-probe.sql, full outside fingerprint on)
  "$PSQL" "$DB" -X -A -t -q -v ON_ERROR_STOP=1 -v app=none -v pid=0 -v bstart=epoch -v astart=epoch -v full=on -f "$HERE/state-probe.sql" \
    | python3 -I -c 'import json,sys; o={}; [o.update(json.loads(l)) for l in sys.stdin if l.strip().startswith("{")]; o.pop("at",None); json.dump(o,sys.stdout,indent=1,sort_keys=True)' > "$OUT/$1.json"
}
step() { echo "$1" >> "$OUT/steps.log"; }

probe p0-pre
"$PSQL" "$DB" -X -q -v ON_ERROR_STOP=1 -f "$SQL" > "$OUT/install-1.out" 2>&1; echo $? > "$OUT/install-1.exit"; probe p1-installed; step "install-1 exit $(cat "$OUT/install-1.exit")"
"$PSQL" "$DB" -X -q -v ON_ERROR_STOP=1 -f "$SQL" > "$OUT/install-2-duplicate.out" 2>&1; echo $? > "$OUT/install-2-duplicate.exit"; probe p2-after-duplicate; step "install-2 (duplicate) exit $(cat "$OUT/install-2-duplicate.exit")"
INSTALL_DB="$DB" PROBE_DB="$DB" EXPECTED="$EXPECTED" OUT="$OUT/guarded-over-committed" MAX_ATTEMPTS=1 FULL=on PSQL="$PSQL" \
  bash "$HERE/install-guarded.sh" > "$OUT/guarded-over-committed.stdout" 2>&1; echo $? > "$OUT/guarded-over-committed.exit"; probe p3-after-guarded; step "guarded over committed exit $(cat "$OUT/guarded-over-committed.exit")"
"$PSQL" "$DB" -X -q -v ON_ERROR_STOP=1 -f "$RESET" > "$OUT/reset-1.out" 2>&1; echo $? > "$OUT/reset-1.exit"; probe p4-after-reset; step "reset-1 exit $(cat "$OUT/reset-1.exit")"
"$PSQL" "$DB" -X -q -v ON_ERROR_STOP=1 -f "$SQL" > "$OUT/install-3-rerun.out" 2>&1; echo $? > "$OUT/install-3-rerun.exit"; probe p5-reinstalled; step "install-3 (rerun) exit $(cat "$OUT/install-3-rerun.exit")"
"$PSQL" "$DB" -X -q -v ON_ERROR_STOP=1 -f "$RESET" > "$OUT/reset-2.out" 2>&1; echo $? > "$OUT/reset-2.exit"; probe p6-after-reset-2; step "reset-2 exit $(cat "$OUT/reset-2.exit")"
grep -c "statement: create role blsh_replay_owner" "$W/server.log" > "$OUT/server-install-txns.txt"

python3 -I - "$OUT" "$EXPECTED" <<'PY' | tee "$OUT/RESULT.json"
import json, os, sys
o, exp = sys.argv[1], json.load(open(sys.argv[2]))
J = lambda n: json.load(open(os.path.join(o, n + ".json")))
R = lambda n: open(os.path.join(o, n)).read().strip()
p0, p1, p2, p3, p4, p5, p6 = (J(n) for n in ["p0-pre", "p1-installed", "p2-after-duplicate", "p3-after-guarded", "p4-after-reset", "p5-reinstalled", "p6-after-reset-2"])
g = json.load(open(os.path.join(o, "guarded-over-committed", "FINAL.json")))
same = lambda a, b: {k: v for k, v in a.items() if k != "lingeringDetail"} == {k: v for k, v in b.items() if k != "lingeringDetail"}
outside = lambda a, b: a["outsideNarrowFingerprint"] == b["outsideNarrowFingerprint"] and a.get("outsideFullFingerprint") == b.get("outsideFullFingerprint")
checks = {
  "install1_exit0": R("install-1.exit") == "0",
  "install1_matches_reference": p1["sandboxFingerprint"] == exp["sandboxFingerprint"],
  "duplicate_refused_nonzero": R("install-2-duplicate.exit") != "0",
  "duplicate_reason_already_installed": "blsh_replay_already_installed" in R("install-2-duplicate.out"),
  "duplicate_changed_nothing": same(p1, p2),
  "guarded_refused_not_clean_exit11": R("guarded-over-committed.exit") == "11" and g.get("verdict") == "not_clean_before_install",
  "guarded_made_no_attempt": not os.path.exists(os.path.join(o, "guarded-over-committed", "attempt-1")),
  "guarded_changed_nothing": same(p1, p3),
  "reset1_exit0": R("reset-1.exit") == "0",
  "reset1_back_to_pre": p4["roles"] == 0 and p4["schemas"] == 0 and p4["memberships"] == 0 and outside(p0, p4),
  "rerun_exit0_and_reference": R("install-3-rerun.exit") == "0" and p5["sandboxFingerprint"] == exp["sandboxFingerprint"] and same(p1, p5),
  "reset2_back_to_pre": R("reset-2.exit") == "0" and p6["roles"] == 0 and p6["schemas"] == 0 and outside(p0, p6),
  "outside_unchanged_while_installed": outside(p0, p1) and outside(p0, p2) and outside(p0, p3) and outside(p0, p5),
  "server_install_txn_starts_2": R("server-install-txns.txt") == "2",
}
print(json.dumps({"checks": checks, "passed": sum(checks.values()), "total": len(checks), "allPass": all(checks.values()),
  "referenceSandboxFingerprint": exp["sandboxFingerprint"], "outsideFullFingerprintPre": p0.get("outsideFullFingerprint")}, indent=1))
sys.exit(0 if all(checks.values()) else 1)
PY
