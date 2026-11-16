#!/bin/bash
# Runs every offline suite and writes TESTS.log + TESTS-RECEIPT.json into the SCRATCH dir only, so a rerun never changes
# the artifact folder (RECHECK-11 A2). Publishing them (with the scope and SHA256SUMS) is the separate tests/publish.sh.
# No network, no credentials. Scratch outside the artifact folder.   bash tests/run_all.sh <new scratch dir>
set -u -o pipefail
SCR="${1:?usage: run_all.sh <new scratch dir>}"
HERE="$(cd "$(dirname "$0")" && pwd)"; A="$(dirname "$HERE")"
NODE=/usr/local/bin/node; PY=/opt/anaconda3/bin/python3
case "$SCR" in "$A"*) echo "refuse: scratch inside the artifact folder"; exit 2;; esac
[ -e "$SCR" ] && { echo "refuse: $SCR exists"; exit 2; }
mkdir -p "$SCR/py" "$SCR/caps" && chmod 700 "$SCR"
LOG="$SCR/TESTS.log"; : > "$LOG"
{ echo "# blsh-request-reader-20261111 offline tests  $(date -u +%Y-%m-%dT%H:%M:%SZ)"; echo; } >> "$LOG"
echo "## 1. Python (core, ReadOnlySession, wrapper gates)" >> "$LOG"
env -i PATH=/usr/bin:/bin READER_TEST_SCRATCH="$SCR/py" $PY -I -B "$HERE/test_reader.py" >> "$LOG" 2>&1; PY_RC=$?
PY_RAN=$(grep -E '^Ran [0-9]+ tests' "$LOG" | awk '{print $2}'); PY_FAILED=$([ $PY_RC = 0 ] && echo 0 || echo 1)
echo; echo "## 2. Node export" >> "$LOG"
env -i PATH=/usr/bin:/bin $PY -I -B "$HERE/make_capture.py" "$SCR/caps" >> "$LOG" 2>&1
env -i PATH=/usr/bin:/bin READER_CAPTURES="$SCR/caps" $NODE --test "$HERE/test_export.cjs" > "$SCR/node.log" 2>&1; NODE_RC=$?
grep -E '^(ok|not ok) |^# (tests|pass|fail) ' "$SCR/node.log" >> "$LOG"
N_PASS=$(grep -E '^# pass ' "$SCR/node.log" | awk '{print $3}'); N_FAIL=$(grep -E '^# fail ' "$SCR/node.log" | awk '{print $3}')
echo >> "$LOG"; echo "## 3. End to end (fake read -> bridge CLIs -> real gate)" >> "$LOG"
bash "$HERE/e2e.sh" "$SCR/e2e" > "$SCR/e2e.out" 2>&1; E_RC=$?
cut -c1-400 "$SCR/e2e.out" >> "$LOG"
E_PASS=$(grep -c '^PASS ' "$SCR/e2e.out"); E_FAIL=$(grep -c '^FAIL ' "$SCR/e2e.out")
PASSED=$(( (PY_FAILED==0 ? PY_RAN : 0) + N_PASS + E_PASS )); FAILED=$(( (PY_FAILED==0 ? 0 : 1) + N_FAIL + E_FAIL + (PY_RC|NODE_RC|E_RC ? 1 : 0) ))
echo >> "$LOG"; echo "TOTAL python=$PY_RAN (rc $PY_RC) node=$N_PASS/$((N_PASS+N_FAIL)) e2e=$E_PASS/$((E_PASS+E_FAIL)) passed=$PASSED failed=$FAILED" >> "$LOG"
env -i PATH=/usr/bin:/bin $PY -I -B -c "
import json,sys; sys.path.insert(0,'$A'); import make_scope
r={'version':'fhfh.blsh.request-reader-tests-receipt.v1','passed':$PASSED,'failed':$FAILED,
   'suites':{'python':{'ran':${PY_RAN:-0},'rc':$PY_RC},'node':{'pass':${N_PASS:-0},'fail':${N_FAIL:-0}},'e2e':{'pass':$E_PASS,'fail':$E_FAIL}},
   'pins':make_scope.local_pins()}
open('$SCR/TESTS-RECEIPT.json','w').write(json.dumps(r,indent=2,sort_keys=True)+'\n'); print(json.dumps({k:r[k] for k in ('passed','failed','suites')}))"
[ "$FAILED" = 0 ]
