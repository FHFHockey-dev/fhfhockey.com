#!/bin/zsh
# BLSH live pilot, approval line 2: apply the chained re-date migrations 20261120143000 then 20261121210000 to the
# hosted database by the per-file psql method (supabase db push would refuse 20261120143000: it is older than applied
# versions). FAILS CLOSED (exit 7) on every mismatch, with no retry. The apply mode needs TJ's own line-2 approval.
#   --ledger-max <14 digits>                     REQUIRED pin: the hosted ledger's current max version (20261121205959)
#   --precheck                                   read-only: blobs, PRECHECK verdict, ledger rows (default)
#   --apply --confirm 20261121210000             each file and its ledger row commit in one transaction, with a
#                                                PRECHECK readback after each
# Both migrations and PRECHECK-READONLY.sql are read from commit Y's blobs (git cat-file), never the working tree, and
# must match their sha256 pins. Starting state must be apply_20261120143000_first (both ledger rows absent) or
# ready_to_apply (20261120143000's row present, 20261121210000's absent; only the second file is applied).
# PSQL_CMD replaces the pooler wrapper (local rehearsal only). Receipts go to a private 0700 directory (OUTDIR, default
# ~/forge-pilot/blsh-pilot-migrations-<UTC>). Credentials are read by pgpool.sh and never printed or written.
set -u
umask 077
RECEIPT=""
fail() { print -r -- "FAIL: $*" >&2; [[ -n $RECEIPT ]] && print -r -- "FAIL: $*" >> $RECEIPT; exit 7; }
[[ -z ${GIT_DIR:-}${GIT_WORK_TREE:-}${GIT_INDEX_FILE:-}${GIT_OBJECT_DIRECTORY:-} ]] || fail "GIT_DIR/GIT_WORK_TREE/GIT_INDEX_FILE/GIT_OBJECT_DIRECTORY must be unset"
HERE=${0:A:h}
REPO=${BLSH_REPO:-${HERE:h:h:h:h:h}}
Y=1efdfb4364dffa73a9c249f382dbfebe22ebbbd2
V1=20261120143000; N1=blsh_official_pilot_redate_20261121
S1=ce14c532f1b9169e52a310e7a3affb29c27b37a00f0bcf08e022de539e7f0f7b
V2=20261121210000; N2=blsh_official_pilot_redate_20261122
S2=4035c5c9a7bd95fc5d6e3aba1ddb8c7b5bda5e03d9e35eae0b0fc1e5f59cd09e
PRE_PATH=tasks/artifacts/blsh-replay-2026-11-20/live-pilot-20261121/redate-20261123/PRECHECK-READONLY.sql
PRE_SHA=6a3ff5961903f6f0bbda4871c04bd3a0920695509b3d6a0f0be28f68bfb32994
EXPECT_FIRST="apply_20261120143000_first|CHECK ((source_date = '2026-11-20'::date))|5893416fdcb334659cefb8e6873da4b88426f91bfda92bcf1b81cfbb86fba2c1|0"
EXPECT_READY="ready_to_apply|CHECK ((source_date = '2026-11-21'::date))|4efee291f95cab0c761c3b88e423131a2d13d87956daf593fbcc9be05bf61f4d|0"
EXPECT_DONE="already_redated|CHECK ((source_date = '2026-11-22'::date))|03a29fd4ecff446f593cd561a5f6fc0ee4a47b6548e804f6be951c8915311855|0"
PSQL=(${=PSQL_CMD:-${HERE:h:h:h}/forge-pregame-capture-2026-11-14/operator/pgpool.sh})

mode=precheck; confirm=""; pin=""
while (( $# )); do
  case $1 in
    --precheck) mode=precheck ;;
    --apply) mode=apply ;;
    --confirm) shift; confirm=${1:-} ;;
    --ledger-max) shift; pin=${1:-} ;;
    *) fail "unknown argument $1" ;;
  esac
  shift
done
[[ $pin =~ '^[0-9]{14}$' ]] || fail "--ledger-max <14-digit version> is required (expected 20261121205959)"
[[ $pin < $V2 ]] || fail "--ledger-max $pin is not older than $V2"
[[ $mode == precheck || $confirm == $V2 ]] || fail "--apply needs --confirm $V2"
OUTDIR=${OUTDIR:-$HOME/forge-pilot/blsh-pilot-migrations-$(date -u +%Y%m%dT%H%M%SZ)}
mkdir -p $OUTDIR && chmod 700 $OUTDIR || fail "cannot create the receipt directory $OUTDIR"
[[ -z $(ls -A $OUTDIR) ]] || fail "receipt directory $OUTDIR is not empty"
RECEIPT=$OUTDIR/receipt.txt
log() { print -r -- "$*" | tee -a $RECEIPT; }
log "blsh pilot migrations mode=$mode start=$(date -u +%Y-%m-%dT%H:%M:%SZ) commit=$Y ledger_max_pin=$pin"

# 1. Exact bytes from commit Y.
blob() {  # <path in Y> <dest> <sha256>
  git --no-replace-objects -C $REPO cat-file blob "${Y}:$1" > $2 2>/dev/null || fail "cannot read $1 from $Y in $REPO"
  local got=$(shasum -a 256 $2 | cut -d' ' -f1)
  [[ $got == $3 ]] || fail "$1 at $Y has sha256 $got, expected $3"
  log "blob $1 sha256=$got"
}
[[ $(git --no-replace-objects -C $REPO cat-file -t $Y 2>/dev/null) == commit ]] || fail "commit $Y not found in $REPO"
blob supabase/migrations/${V1}_$N1.sql $OUTDIR/$V1.sql $S1
blob supabase/migrations/${V2}_$N2.sql $OUTDIR/$V2.sql $S2
blob $PRE_PATH $OUTDIR/precheck.sql $PRE_SHA

# Each file must be one transaction: exactly one top-level "begin;" and its last line the only "commit;", no other
# transaction-control line and no psql meta-command. The body fed to psql is the file without that last line.
body() {  # <version>
  python3 -I - $OUTDIR/$1.sql $OUTDIR/$1.body.sql <<'PY' || fail "$1 is not a single begin/commit transaction"
import re, sys
raw = open(sys.argv[1], "rb").read()
lines = raw.decode("utf-8").split("\n")
assert lines[-1] == "" and lines[-2] == "commit;", "last line is not commit;"
control = [l for l in lines if re.fullmatch(r"\s*(begin|commit|rollback|abort|end|start\s+transaction|savepoint\b.*|release\b.*|prepare\s+transaction\b.*)\s*(transaction|work)?\s*;\s*", l, re.I)]
assert control == ["begin;", "commit;"], control
assert not any(l.lstrip().startswith("\\") for l in lines), "psql meta-command"
body = raw[: len(raw) - len(b"commit;\n")]
assert body + b"commit;\n" == raw
open(sys.argv[2], "wb").write(body)
PY
}
body $V1; body $V2

if [[ -z ${PSQL_CMD:-} ]]; then
  python3 -I -c "import socket,sys; socket.getaddrinfo(sys.argv[1], 5432)" aws-0-us-east-1.pooler.supabase.com 2>/dev/null \
    || fail "cannot resolve the pooler host"
fi

# 2. Read-only state: PRECHECK verdict line and the ledger.
precheck() {  # <label>  -> sets $verdict
  local out rc
  out=$(perl -e 'alarm shift; exec @ARGV' 60 ${PSQL[@]} -X -At -q -v ON_ERROR_STOP=1 -f $OUTDIR/precheck.sql 2>&1); rc=$?
  print -r -- "$out" > $OUTDIR/precheck-$1.out
  (( rc == 0 )) && [[ $(print -r -- "$out" | wc -l | tr -d ' ') == 1 ]] || fail "PRECHECK ($1) did not answer one line (psql exit $rc): $(print -r -- "$out" | tail -2)"
  verdict=$out
  log "precheck $1 $(date -u +%H:%M:%SZ): $verdict"
}
ledger() {  # <label>  -> sets $l1 $l2 $lmax
  local out rc
  out=$(perl -e 'alarm shift; exec @ARGV' 60 ${PSQL[@]} -X -At -q -F '|' -v ON_ERROR_STOP=1 -c "begin transaction read only;
    set local statement_timeout = '10s';
    select count(*) filter (where version = '$V1'), count(*) filter (where version = '$V2'), coalesce(max(version), '')
    from supabase_migrations.schema_migrations; rollback;" 2>&1); rc=$?
  (( rc == 0 )) && [[ $out =~ '^[0-9]+\|[0-9]+\|[0-9]{14}$' ]] || fail "ledger query ($1) did not answer cleanly (psql exit $rc): $(print -r -- "$out" | tail -2)"
  IFS='|' read l1 l2 lmax <<< "$out"
  log "ledger $1: $V1=$l1 $V2=$l2 max=$lmax"
}

precheck before; ledger before
if [[ $verdict == $EXPECT_FIRST ]]; then
  (( l1 == 0 && l2 == 0 )) || fail "state apply_20261120143000_first needs both ledger rows absent ($V1=$l1 $V2=$l2)"
  start=first
elif [[ $verdict == $EXPECT_READY ]]; then
  (( l1 == 1 && l2 == 0 )) || fail "state ready_to_apply needs $V1's ledger row present and $V2's absent ($V1=$l1 $V2=$l2)"
  start=ready
else
  fail "PRECHECK verdict is not apply_20261120143000_first or ready_to_apply: $verdict"
fi
[[ $lmax == $pin ]] || fail "ledger max is $lmax, pinned $pin"
log "start state: $start"
if [[ $mode == precheck ]]; then
  log "precheck ok; nothing changed ($OUTDIR)"
  exit 0
fi

# 3. One transaction per file: the file's own begin, its body, a ledger guard, the ledger row, one commit.
apply_one() {  # <version> <name>
  local rc
  {
    print -r -- '\set ON_ERROR_STOP on'
    print -r -- "set statement_timeout = '60s';"
    print -r -- "set idle_in_transaction_session_timeout = '60s';"
    print -r -- "\\i '$OUTDIR/$1.body.sql'"
    print -r -- "do \$ledger\$ begin
  if exists (select 1 from supabase_migrations.schema_migrations where version = '$1') then raise exception 'ledger_version_exists'; end if;
  if (select max(version) from supabase_migrations.schema_migrations) is distinct from '$pin' then raise exception 'ledger_max_moved'; end if;
end \$ledger\$;"
    print -r -- "insert into supabase_migrations.schema_migrations (version, name) values ('$1', '$2');"
    print -r -- "select 'applied_at', clock_timestamp();"
    print -r -- "commit;"
  } > $OUTDIR/apply-$1.sql
  log "apply $1 start $(date -u +%H:%M:%SZ)"
  perl -e 'alarm shift; exec @ARGV' 180 ${PSQL[@]} -X -v ON_ERROR_STOP=1 -f $OUTDIR/apply-$1.sql > $OUTDIR/apply-$1.out 2>&1
  rc=$?
  log "apply $1 psql exit $rc; last lines: $(tail -3 $OUTDIR/apply-$1.out | tr '\n' ' ')"
  (( rc == 0 )) && [[ $(grep -cx 'COMMIT' $OUTDIR/apply-$1.out) == 1 ]] && ! grep -q 'WARNING' $OUTDIR/apply-$1.out \
    || fail "$1 did not commit cleanly (psql exit $rc); see apply-$1.out"
}

if [[ $start == first ]]; then
  apply_one $V1 $N1
  precheck after-$V1; ledger after-$V1
  [[ $verdict == $EXPECT_READY ]] && (( l1 == 1 && l2 == 0 )) && [[ $lmax == $pin ]] \
    || fail "readback after $V1 differs (verdict=$verdict $V1=$l1 $V2=$l2 max=$lmax); stop, do not retry"
fi
apply_one $V2 $N2
precheck after-$V2; ledger after-$V2
[[ $verdict == $EXPECT_DONE ]] && (( l1 == 1 && l2 == 1 )) && [[ $lmax == $V2 ]] \
  || fail "readback after $V2 differs (verdict=$verdict $V1=$l1 $V2=$l2 max=$lmax); stop, do not retry"
log "applied and read back: $verdict end=$(date -u +%Y-%m-%dT%H:%M:%SZ) ($OUTDIR)"
