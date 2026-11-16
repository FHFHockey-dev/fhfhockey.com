#!/bin/bash
# TEST-ONLY end-to-end rehearsal for 2026-11-11: this lane's reader (fake DB, real wrapper + export) feeding the bridge's REAL
# CLIs: convert -> frames -> deadline-check -> assemble -> prepare_packet -> propose -> real gate (synthetic review).
# Offline: no network, no credentials, no live paths. Writes only under <new scratch dir>.
#   bash tests/e2e.sh <new scratch dir>
set -u -o pipefail
SCR="${1:?usage: e2e.sh <new scratch dir>}"
HERE="$(cd "$(dirname "$0")" && pwd)"; A="$(dirname "$HERE")"; R=/Users/tim/Code/fhfhockey.com
B="$R/tasks/artifacts/blsh-evidence-bridge-2026-11-15"; PC="$B/post-capture"; V5="$B/approved/v5"; WEB="$R/web"
PREP="$R/tasks/artifacts/blsh-native-packet-preparation-2026-11-08"
NODE=/usr/local/bin/node; PY=/opt/anaconda3/bin/python3
LINEAGE="$($NODE -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).lineage.path)' "$PREP/SOURCE-PINS.json")"
INTAKE="$($NODE -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).intake.path)' "$PREP/SOURCE-PINS.json")"
APPROVED_NODE=daa77e22e1b8778361b392461e9921a6d292d0382ebf4ae872a0081f02f01fef
E=2026-11-17T16:00:00.000Z
AS="/Users/tim/Library/Application Support"
FIXED=("$AS/fhfh-blsh-native-20261117T140500Z" "$AS/fhfh-blsh-boxscores-20261111" "$AS/fhfh-blsh-postcapture-20261117" "/private/tmp/fhfh-heavy.lock" "$A/locks")
CLEAN=(env -i PATH=/usr/bin:/bin HOME="$SCR/home" TMPDIR="$SCR/tmp/")

case "$SCR" in "$A"*|"$B"*|"$AS"*|"$R/web"*) echo "refuse: scratch must be outside the lanes, web/ and Application Support"; exit 2;; esac
[ -e "$SCR" ] && { echo "refuse: $SCR exists"; exit 2; }
mkdir -p "$SCR/home" "$SCR/tmp" "$SCR/work" && chmod 700 "$SCR"
state() { for p in "${FIXED[@]}"; do [ -e "$p" ] && echo "exists $p" || echo "absent $p"; done; }
tree() { (cd "$1" && find . -type f ! -name .DS_Store -exec shasum -a 256 {} + | sort -k2); }
state > "$SCR/fixed-before.txt"; tree "$B" > "$SCR/bridge-before.txt"; tree "$A" > "$SCR/reader-before.txt"
PASS=0; FAIL=0; LOG="$SCR/E2E.log"
note() { echo "$*" | tee -a "$LOG"; }
expect() {
  local label="$1" want="$2" pred="$3"; shift 4
  local out code; out="$("$@" 2>"$SCR/tmp/stderr.txt")"; code=$?
  local last; last="$(printf '%s\n' "$out" | tail -n 1)"
  if [ "$code" = "$want" ] && $NODE -e "const s=process.argv[1]; let j; try { j=JSON.parse(s); } catch { j=JSON.parse(s.trim().split('\\n').pop()); } process.exit(($pred)?0:1)" "$out" 2>/dev/null; then
    PASS=$((PASS+1)); note "PASS $label: $(printf '%s' "$last" | cut -c1-300)"
  else
    FAIL=$((FAIL+1)); note "FAIL $label (exit $code, want $want): $(printf '%s' "$last" | cut -c1-500) $(tail -c 600 "$SCR/tmp/stderr.txt")"
  fi
  printf '%s\n' "$out" > "$SCR/out-$(printf '%s' "$label" | cut -d' ' -f1).json"
}
finish() {
  state > "$SCR/fixed-after.txt"; tree "$B" > "$SCR/bridge-after.txt"; tree "$A" > "$SCR/reader-after.txt"
  for g in fixed bridge reader; do
    if cmp -s "$SCR/$g-before.txt" "$SCR/$g-after.txt"; then PASS=$((PASS+1)); note "PASS guard: $g unchanged"
    else FAIL=$((FAIL+1)); note "FAIL guard: $g changed"; diff "$SCR/$g-before.txt" "$SCR/$g-after.txt" | tee -a "$LOG"; fi
  done
  note "RESULT pass=$PASS fail=$FAIL"; [ "$FAIL" = 0 ]
}
trap 'finish; exit $?' EXIT
W="$SCR/work"

expect "E1 fake-DB fixture captures (offline_fixture)" 0 'j["cap-full"].rows.wgo===7199 && j["cap-no-nst-1111"].state==="OFFLINE_CAPTURE_SIMULATION_COMPLETE"' -- \
  "${CLEAN[@]}" $PY -I -B "$HERE/make_capture.py" "$SCR"
FIX="$SCR/cap-full/SIMULATED-REQUEST.json"
expect "E2 candidate packet for 2026-11-11 (real v5 bytes, real 10-01 page, hand-written TLS/RUNTIME)" 0 'j.ok===true && j.wgoRows===288 && j.games===8' -- \
  "${CLEAN[@]}" $NODE "$HERE/e2e_inputs.mjs" packet "$SCR" "$FIX"
expect "E3 verify-packet (v5)" 0 'j.verdict==="complete_pending_review"' -- "${CLEAN[@]}" $NODE "$V5/verify-packet.mjs" "$SCR/packet" "$V5/expected-pins.json"
expect "E4 convert with the approved inputs" 0 'j.ok===true && j.evidenceClass==="candidate_pending_independent_review" && j.date==="2026-11-11"' -- \
  "${CLEAN[@]}" $NODE "$B/convert.mjs" --candidate v5 --packet "$SCR/packet" --pins "$V5/expected-pins.json" --verifier "$V5/verify-packet.mjs" --node-sha256 $APPROVED_NODE --lineage "$LINEAGE" --out "$W/conversion"
expect "E5 reader: run_live_read.run() offline (fake psycopg2.connect) + real export" 0 'j.rc===0 && j.state==="REQUEST_AND_CONTEXT_EXPORTED" && j.rows.wgo===7199 && j.queriesDispatched===28 && j.export.ok===true && j.export.nativeDateCoverage.wgoRows===288 && j.credentialValueInOutputs===false' -- \
  "${CLEAN[@]}" $PY -I -B "$HERE/e2e_read.py" "$SCR" "$W/conversion" "$W"
expect "E6 hand-built acquisition (E2E)" 0 'j.ok===true' -- "${CLEAN[@]}" $NODE "$HERE/e2e_inputs.mjs" acquisition "$SCR" "$FIX" "$W/conversion" "$W/acquisition"
expect "E7 frames CLI (production)" 0 'j.ok===true && j.frames>0' -- "${CLEAN[@]}" $NODE "$B/frames.mjs" --conversion "$W/conversion" --acquisition "$W/acquisition" --out "$W/frames"
expect "E8 deadline check at E" 0 'j.ok===true && j.bindingRule==="capture_age" && j.requestAsOfUTC==="2026-11-17T14:20:00.000000+00:00"' -- \
  "${CLEAN[@]}" $NODE "$PC/deadline-check.mjs" --request "$W/request.json" --conversion "$W/conversion" --frames "$W/frames" --evaluated-at $E
expect "E8a deadline check before the request capture refuses" 2 'j.refusal==="evaluation_precedes_source_request"' -- \
  "${CLEAN[@]}" $NODE "$PC/deadline-check.mjs" --request "$W/request.json" --conversion "$W/conversion" --frames "$W/frames" --evaluated-at 2026-11-17T14:19:00.000Z
expect "E9 assemble CLI on the reader's request + context" 0 'j.ok===true && j.proposedEntries>0' -- \
  "${CLEAN[@]}" $NODE "$B/assemble.mjs" --candidate v5 --request "$W/request.json" --context "$W/context.json" --conversion "$W/conversion" --frames "$W/frames" --out "$W/assembly"
expect "E9a assembly report: native date 2026-11-11 only, candidate class" 0 'j.nativeDates.join()==="2026-11-11" && j.evidenceClasses.join()==="candidate_pending_independent_review" && j.proposedEntries>0' -- \
  cat "$W/assembly/ASSEMBLY.json"
expect "E10 prepare_packet.py" 0 'j.proposedWitnesses>0' -- \
  env -i PATH=/usr/local/bin:/usr/bin:/bin HOME="$SCR/home" TMPDIR="$SCR/tmp/" PYTHONDONTWRITEBYTECODE=1 $PY -I "$PREP/prepare_packet.py" --request "$W/request.json" --context "$W/context.json" \
    --receipt-manifest "$W/assembly/native-inputs.json" --producer-allowlist "$W/assembly/producer-allowlist.json" \
    --intake-source "$INTAKE" --lineage-source "$LINEAGE" --evaluated-at $E --out "$W/prepared"
expect "E11 propose-policy CLI" 0 'j.status==="PROPOSAL_ONLY_not_installable_until_independent_review" && j.acceptance.reviewSHA256===null' -- \
  "${CLEAN[@]}" $NODE "$B/propose-policy.mjs" --prepared "$W/prepared" --assembly "$W/assembly"
cp "$SCR/out-E11.json" "$W/PROPOSAL.E2E.json"
expect "E12 real gate on time (synthetic review): 11-11 rows qualify; CLOSED policy admits 0" 0 'j.individualQualified>0 && j.onIceQualified>0 && j.closedPolicyQualified===0' -- \
  "${CLEAN[@]}" $NODE "$PC/rehearsal-inputs.mjs" v5 gate "$W/prepared" "$W/PROPOSAL.E2E.json" $E
expect "E12a real gate on 2026-11-19: event age 8 d, no current-use rows" 0 'j.individualQualified===0 && j.onIceQualified===0' -- \
  "${CLEAN[@]}" $NODE "$PC/rehearsal-inputs.mjs" v5 gate "$W/prepared" "$W/PROPOSAL.E2E.json" 2026-11-19T00:00:01.000Z
