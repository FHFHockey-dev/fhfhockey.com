#!/bin/bash
# DRESS REHEARSAL of POST-CAPTURE.md, offline, in scratch only. Never the network, credentials, the real fixed output
# paths or the bridge folder (all guarded below). Every step runs the same CLI as the real run; the differences are
# labelled "REAL RUN:". The candidate is an explicit argument, never inferred:
#   v5       the 2026-11-17 slot (approved inputs in approved/v5/).
#   v5-1118  the PARKED 2026-11-18 fallback (approved/v5-1118/): same source date, so the evaluation's UTC date limit
#            (source date + 7 days) binds; the rehearsal shows the deadline check and the real gate refusing the next day.
# Legs:
#   Leg A (v5 only): the applied tree's rehearse.ts happy packet (synthetic adapter): each stop the real run must NOT hit.
#   Leg B: a candidate packet (real candidate bytes, real 2026-10-01 NST page, hand-written TLS/RUNTIME facts) through
#          convert, acquisition, frames, deadline, assemble, prepare_packet and propose, ending in a candidate proposal.
# Usage: bash dress-rehearsal.sh <new scratch dir> v5|v5-1118     (exit 0 = every step gave its expected result)
set -u -o pipefail
SCR="${1:?usage: dress-rehearsal.sh <new scratch dir> v5|v5-1118}"; CAND="${2:-}"
case "$CAND" in v5|v5-1118) ;; *) echo "refuse: candidate must be given explicitly: v5 or v5-1118"; exit 2;; esac
PC="$(cd "$(dirname "$0")" && pwd)"; B="$(dirname "$PC")"; R="$(cd "$B/../../.." && pwd)"; WEB="$R/web"
NODE=/usr/local/bin/node; PY=/opt/anaconda3/bin/python3 # the interpreter the bridge suite uses; /usr/bin/python3 lacks bs4 (nst_lineage.py)
IN="$B/approved/$CAND"; PREP="$R/tasks/artifacts/blsh-native-packet-preparation-2026-11-08"
LINEAGE="$($NODE -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).lineage.path)' "$PREP/SOURCE-PINS.json")"
INTAKE="$($NODE -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).intake.path)' "$PREP/SOURCE-PINS.json")"
APPROVED_NODE=daa77e22e1b8778361b392461e9921a6d292d0382ebf4ae872a0081f02f01fef
AS="/Users/tim/Library/Application Support"
FIXED=("$AS/fhfh-blsh-native-20261117T140500Z" "$AS/fhfh-blsh-native-20261118T140500Z" "$AS/fhfh-blsh-boxscores-20261111" "$AS/fhfh-blsh-boxscores-20261001")
CLEAN=(env -i PATH=/usr/bin:/bin HOME="$SCR/home" TMPDIR="$SCR/tmp/")
RI() { "${CLEAN[@]}" $NODE "$PC/rehearsal-inputs.mjs" "$CAND" "$@"; }
if [ "$CAND" = v5 ]; then PLANNED=2026-10-02T13:00:00.000Z; else PLANNED=2026-10-08T20:00:00.000Z; fi

case "$SCR" in "$B"*|"$AS"*|"$R/web"*) echo "refuse: scratch must be outside the bridge folder, web/ and Application Support"; exit 2;; esac
[ -e "$SCR" ] && { echo "refuse: $SCR exists (use a new scratch dir)"; exit 2; }
mkdir -p "$SCR/home" "$SCR/tmp" && chmod 700 "$SCR"
state() { for p in "${FIXED[@]}"; do [ -e "$p" ] && echo "exists $p" || echo "absent $p"; done; }
bridge() { (cd "$B" && find . -type f ! -name .DS_Store -exec shasum -a 256 {} + | sort -k2); }
state > "$SCR/fixed-before.txt"; bridge > "$SCR/bridge-before.txt"
PASS=0; FAIL=0
LOG="$SCR/REHEARSAL.log"
note() { echo "$*" | tee -a "$LOG"; }
# expect <label> <want exit> <node predicate over the parsed stdout as `j`> -- command...
expect() {
  local label="$1" want="$2" pred="$3"; shift 4
  local out code; out="$("$@" 2>"$SCR/tmp/stderr.txt")"; code=$?
  local last; last="$(printf '%s\n' "$out" | tail -n 1)"
  if [ "$code" = "$want" ] && $NODE -e "const s=process.argv[1]; let j; try { j=JSON.parse(s); } catch { j=JSON.parse(s.trim().split('\\n').pop()); } process.exit(($pred)?0:1)" "$out" 2>/dev/null; then
    PASS=$((PASS+1)); note "PASS $label: $(printf '%s' "$last" | cut -c1-260)"
  else
    FAIL=$((FAIL+1)); note "FAIL $label (exit $code, want $want): $(printf '%s' "$last" | cut -c1-400) $(tail -c 400 "$SCR/tmp/stderr.txt")"
  fi
  printf '%s\n' "$out" > "$SCR/out-$(printf '%s' "$label" | cut -d' ' -f1).json"
}
finish() {
  state > "$SCR/fixed-after.txt"; bridge > "$SCR/bridge-after.txt"
  if cmp -s "$SCR/fixed-before.txt" "$SCR/fixed-after.txt"; then PASS=$((PASS+1)); note "PASS guard: real fixed paths unchanged ($(tr '\n' ';' < "$SCR/fixed-after.txt"))"
  else FAIL=$((FAIL+1)); note "FAIL guard: a real fixed path changed"; diff "$SCR/fixed-before.txt" "$SCR/fixed-after.txt" | tee -a "$LOG"; fi
  if cmp -s "$SCR/bridge-before.txt" "$SCR/bridge-after.txt"; then PASS=$((PASS+1)); note "PASS guard: bridge folder unchanged"
  else FAIL=$((FAIL+1)); note "FAIL guard: bridge folder changed"; diff "$SCR/bridge-before.txt" "$SCR/bridge-after.txt" | tee -a "$LOG"; fi
  note "RESULT candidate=$CAND pass=$PASS fail=$FAIL"; [ "$FAIL" = 0 ]
}
trap 'finish; exit $?' EXIT
note "== candidate $CAND (inputs $IN)"

if [ "$CAND" = v5 ]; then
note "== Leg A: applied-tree rehearse.ts happy packet (synthetic adapter; must never become evidence)"
A="$SCR/A"; mkdir -p "$A"
expect "A1 rehearse.ts happy (network blocked, applied tree)" 0 'j.ok===true && j.networkAttempts===0 && j.state==="packet_complete_pending_review"' -- \
  bash -c "cd '$WEB' && exec ${CLEAN[*]} NODE_PATH=. DISABLE_V8_COMPILE_CACHE=1 TS_NODE_COMPILER_OPTIONS='{\"module\":\"commonjs\",\"moduleResolution\":\"node\"}' REHEARSAL_DATE=2026-11-11 REHEARSAL_CLOCK=2026-11-13T01:00:00.000Z $NODE --require ./node_modules/ts-node/register/transpile-only '$R/tasks/artifacts/blsh-successor-candidate-2026-11-15/rehearsal/rehearse.ts' happy '$A/packet'"
# REAL RUN: the same verifier line must give exit 0, complete_pending_review, evidenceClass not diagnostic.
expect "A2 verify-packet (v5) refuses the synthetic packet" 2 'j.verdict==="vetoed" && j.reasons.includes("runtime_not_launched_by_bootstrap") && j.reasons.includes("source_not_frozen_candidate:adapter")' -- \
  "${CLEAN[@]}" $NODE "$IN/verify-packet.mjs" "$A/packet" "$IN/expected-pins.json"
expect "A3 convert with approved inputs refuses it" 2 'j.ok===false && /^packet_vetoed/.test(j.refusal)' -- \
  "${CLEAN[@]}" $NODE "$B/convert.mjs" --candidate v5 --packet "$A/packet" --pins "$IN/expected-pins.json" --verifier "$IN/verify-packet.mjs" --node-sha256 $APPROVED_NODE --lineage "$LINEAGE" --out "$A/conv-approved"
expect "A4 convert --synthetic-adapter-ok gives only the diagnostic class" 0 'j.ok===true && j.evidenceClass==="diagnostic_only_synthetic_adapter"' -- \
  "${CLEAN[@]}" $NODE "$B/convert.mjs" --packet "$A/packet" --pins "$IN/expected-pins.json" --verifier "$IN/verify-packet.mjs" --node-sha256 $APPROVED_NODE --lineage "$LINEAGE" --out "$A/conv-diag" --synthetic-adapter-ok
# Safe: a diagnostic conversion is refused before any write or request (test 20). Never run this CLI on an approved conversion here.
expect "A5 acquire-boxscores CLI refuses a diagnostic conversion before any write/request" 2 'j.ok===false && j.refusal==="conversion_not_approved"' -- \
  bash -c "cd '$WEB' && exec /usr/bin/env -i PATH=/usr/bin:/bin HOME='$SCR/home' TMPDIR='$SCR/tmp/' $NODE '$B/acquire-boxscores.mjs' --conversion '$A/conv-diag'"
else
note "== Leg A skipped for v5-1118: the canonical tree holds v5; the fallback's own rehearse.ts run is fallback-1118/rehearsal/RESULTS.jsonl"
fi

note "== Leg B: $CAND candidate packet (real candidate bytes, real 2026-10-01 page, hand-written facts) to a candidate proposal"
S="$SCR/B"; mkdir -p "$S" && chmod 700 "$S"
expect "B0 rehearsal inputs (request, context, candidate packet, attestations)" 0 "j.ok===true && j.candidate===\"$CAND\"" -- RI inputs "$S"
expect "B1 verify-packet ($CAND pins, no flag)" 0 'j.verdict==="complete_pending_review" && j.evidenceClass!=="diagnostic_only_synthetic_adapter"' -- \
  "${CLEAN[@]}" $NODE "$IN/verify-packet.mjs" "$S/packet-candidate" "$IN/expected-pins.json"
# Gate 2: attestations written by the operator lane's own operator-attestation.py from launcher-shaped files (RECHECK-11 C1).
OPC="$([ "$CAND" = v5 ] && echo v5-1117 || echo v5-1118)"; OTHER="$([ "$CAND" = v5 ] && echo v5-1118 || echo v5)"
OPTOOL="$R/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/operator-attestation.py"
CA() { "${CLEAN[@]}" $NODE "$PC/check-attestation.mjs" --candidate "$1" --attestation "$S/attestation-$2/OPERATOR-ATTESTATION.json" --packet "$S/packet-candidate"; }
OPCHECK() { /usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I "$OPTOOL" check --candidate "$OPC" "$S/attestation-$1/OPERATOR-ATTESTATION.json"; }
expect "B2 attestation check (step 2, launcher-shaped attestation)" 0 "j.ok===true && j.operatorCandidate===\"$OPC\" && j.g3BothMatch===true && j.launcherDyldKeysPresent===false" -- CA "$CAND" ok
expect "B2op operator-attestation.py check (step 2b)" 0 'j.conversion==="accept" && j.reasons.length===0' -- OPCHECK ok
expect "B2a stop: T+0 G3 not match (bothMatch false)" 2 'j.refusal==="g3_both_match_not_true"' -- CA "$CAND" bad-g3
expect "B2b stop: DYLD/DEVELOPER_DIR in the operator shell" 2 'j.refusal==="launcher_dyld_keys_present_not_false"' -- CA "$CAND" bad-dyld
expect "B2c stop: the launcher's own G3 run exited 1" 2 'j.refusal==="launcher_g3_line_not_wrapper_exit_0"' -- CA "$CAND" g3-wrapper-exit-1
expect "B2d stop: g3Line as a raw G3 line (the old fixture shape)" 2 'j.refusal==="launcher_g3_line_not_wrapper_exit_0"' -- CA "$CAND" raw-g3line
expect "B2e stop: exec argv0 not the real node" 2 'j.refusal==="launcher_argv0_not_real_node"' -- CA "$CAND" stub-argv0
expect "B2f stop: exec cwd not the canonical web/" 2 'j.refusal==="launcher_cwd_not_canonical_web"' -- CA "$CAND" fake-cwd
expect "B2g stop: exec outside the slot's 14:05:00-14:05:50Z window" 2 '/^launcher_exec_time_outside_2026-11-1[78]_window$/.test(j.refusal)' -- CA "$CAND" late-exec
expect "B2h stop: attestation checked as the other candidate ($OTHER)" 2 'j.refusal==="attestation_candidate_mismatch"' -- CA "$OTHER" ok
expect "B2i step 2b also rejects a bad attestation" 1 'j.conversion==="reject" && j.reasons.includes("stored_bothMatch_not_true")' -- OPCHECK bad-g3
expect "B3 convert with the approved inputs (--candidate $CAND)" 0 'j.ok===true && j.evidenceClass==="candidate_pending_independent_review" && j.date==="2026-10-01"' -- \
  "${CLEAN[@]}" $NODE "$B/convert.mjs" --candidate "$CAND" --packet "$S/packet-candidate" --pins "$IN/expected-pins.json" --verifier "$IN/verify-packet.mjs" --node-sha256 $APPROVED_NODE --lineage "$LINEAGE" --out "$S/conversion"
# REAL RUN: the acquire-boxscores.mjs CLI line in POST-CAPTURE.md step 5 (6 real GETs, fixed path). Here: the SAME tool via
# its function API against a loopback TLS server with a throwaway cert; non-loopback connects throw.
mkdir -p "$S/cert" && chmod 700 "$S/cert"
/usr/bin/openssl req -x509 -newkey rsa:2048 -nodes -keyout "$S/cert/key.pem" -out "$S/cert/cert.pem" -days 2 -subj /CN=api-web.nhle.com -addext subjectAltName=DNS:api-web.nhle.com >/dev/null 2>&1
RI harness-spec "$S" "$S/conversion" "$S/acq-loopback" "$S/cert" "$S/harness-spec.json"
HARNESS=(env -i PATH=/usr/local/bin:/usr/bin:/bin HOME="$SCR/home" TMPDIR="$SCR/tmp/" $NODE "$B/tests/acquire-harness.mjs" "$S/harness-spec.json")
if [ "$CAND" = v5 ]; then
expect "B4 acquisition: real tool, loopback only, one GET per game" 0 'j.ok===true && j.requests===j.requestCount && j.refusedNonLoopback===0 && j.execArgv.length===0 && Object.values(j.served).every(n=>n===1)' -- "${HARNESS[@]}"
expect "B5 frames CLI refuses the loopback output (test transport, non-fixed path)" 2 'j.refusal==="acquisition_runtime_missing_or_shape"' -- \
  "${CLEAN[@]}" $NODE "$B/frames.mjs" --conversion "$S/conversion" --acquisition "$S/acq-loopback" --out "$S/frames-loopback"
else
# REAL RUN BLOCKER (fallback): the reviewed tool aa8a9cb7 pins the v5 pins file, so it refuses every v5-1118 conversion.
expect "B4 acquisition: the reviewed tool refuses the fallback conversion (0 requests)" 0 'j.ok===false && j.refusal==="conversion_not_approved" && j.requestCount===0 && j.refusedNonLoopback===0' -- "${HARNESS[@]}"
# STAGED either-pins tool (proposed/acquire-boxscores.mjs; not live until reviewed, listed and approved): serves the fallback.
RI harness-spec "$S" "$S/conversion" "$S/acq-loopback-staged" "$S/cert" "$S/harness-spec-staged.json" "$PC/proposed/acquire-boxscores.mjs"
expect "B4s acquisition: the STAGED either-pins tool serves the fallback, loopback only, one GET per game" 0 'j.ok===true && j.requests===j.requestCount && j.refusedNonLoopback===0 && j.execArgv.length===0 && Object.values(j.served).every(n=>n===1)' -- \
  env -i PATH=/usr/local/bin:/usr/bin:/bin HOME="$SCR/home" TMPDIR="$SCR/tmp/" $NODE "$B/tests/acquire-harness.mjs" "$S/harness-spec-staged.json"
expect "B5 frames CLI refuses the loopback output (test transport, non-fixed path)" 2 'j.refusal==="acquisition_runtime_missing_or_shape"' -- \
  "${CLEAN[@]}" $NODE "$B/frames.mjs" --conversion "$S/conversion" --acquisition "$S/acq-loopback-staged" --out "$S/frames-loopback"
fi
# REAL RUN: the operator's untouched fixed-path directory. Here: hand-built with the real tool bytes (custody limit).
expect "B6 hand-built acquisition directory (REHEARSAL)" 0 'j.ok===true' -- RI acquisition "$S" "$S/conversion" "$S/acquisition"
expect "B7 frames CLI (production)" 0 'j.ok===true && j.frames>0' -- \
  "${CLEAN[@]}" $NODE "$B/frames.mjs" --conversion "$S/conversion" --acquisition "$S/acquisition" --out "$S/frames"
DL() { "${CLEAN[@]}" $NODE "$PC/deadline-check.mjs" --request "$S/request.json" --conversion "$S/conversion" --frames "$S/frames" --evaluated-at "$1"; }
if [ "$CAND" = v5 ]; then BIND=capture_age; LATE_CODE=capture_age_exceeded; else BIND=event_age; LATE_CODE=event_age_exceeded; fi
expect "B8 deadline check, planned evaluation ($PLANNED)" 0 "j.ok===true && j.bindingRule===\"$BIND\"" -- DL "$PLANNED"
DEADLINE="$($NODE -e 'const s=require("fs").readFileSync(process.argv[1],"utf8").trim(); console.log(JSON.parse(s.split("\n").pop()).deadlineUTC)' "$SCR/out-B8.json")"
LATE="$($NODE -e 'console.log(new Date(Date.parse(process.argv[1])+1).toISOString())' "$DEADLINE")"
expect "B8a deadline check at exactly the deadline ($DEADLINE)" 0 'j.ok===true && j.marginMinutes===0' -- DL "$DEADLINE"
expect "B8b deadline check 1 ms late ($LATE) refuses" 2 "j.refusal===\"$LATE_CODE\"" -- DL "$LATE"
if [ "$CAND" = v5-1118 ]; then
# The rehearsal's 10-08 / 10-09 stand for 2026-11-18 / 2026-11-19 (same offsets from the source date).
expect "B8c fallback: an evaluation on the next UTC day (the 11-19 case) refuses" 2 'j.refusal==="event_age_exceeded" && j.eventAgeDeadlineUTC==="2026-10-08T23:59:59.999Z"' -- DL 2026-10-09T09:00:00.000Z
else
expect "B8c deadline check 8 days after the native date refuses" 2 'j.refusal==="capture_age_exceeded" || j.refusal==="event_age_exceeded"' -- DL 2026-10-09T00:00:00.000Z
fi
expect "B9 assemble CLI (--candidate $CAND)" 0 'j.ok===true && j.proposedEntries>0' -- \
  "${CLEAN[@]}" $NODE "$B/assemble.mjs" --candidate "$CAND" --request "$S/request.json" --context "$S/context.json" --conversion "$S/conversion" --frames "$S/frames" --out "$S/assembly"
# prepare_packet.py runs the pinned gate replay with `node` from PATH, so /usr/local/bin (the pinned node) comes first.
expect "B10 prepare_packet.py (evaluated-at = planned evaluation)" 0 'j.proposedWitnesses>0' -- \
  env -i PATH=/usr/local/bin:/usr/bin:/bin HOME="$SCR/home" TMPDIR="$SCR/tmp/" PYTHONDONTWRITEBYTECODE=1 $PY -I "$PREP/prepare_packet.py" --request "$S/request.json" --context "$S/context.json" \
    --receipt-manifest "$S/assembly/native-inputs.json" --producer-allowlist "$S/assembly/producer-allowlist.json" \
    --intake-source "$INTAKE" --lineage-source "$LINEAGE" --evaluated-at "$PLANNED" --out "$S/prepared"
expect "B11 propose-policy CLI: candidate proposal, reviewSHA256 null" 0 'j.status==="PROPOSAL_ONLY_not_installable_until_independent_review" && j.acceptance.reviewSHA256===null' -- \
  "${CLEAN[@]}" $NODE "$B/propose-policy.mjs" --prepared "$S/prepared" --assembly "$S/assembly"
cp "$SCR/out-B11.json" "$S/PROPOSAL.REHEARSAL.json"
# The real gate (test-only filled review): on time vs late. The CLOSED policy admits 0 either way.
G() { RI gate "$S/prepared" "$S/PROPOSAL.REHEARSAL.json" "$1"; }
expect "B12 real gate at the planned evaluation (synthetic review)" 0 'j.individualQualified>0 && j.onIceQualified>0 && j.closedPolicyQualified===0' -- G "$PLANNED"
expect "B12a real gate exactly at the deadline: still current" 0 'j.individualQualified===234 && j.onIceQualified===234' -- G "$DEADLINE"
if [ "$CAND" = v5 ]; then
# deadline-check uses ONE global earliest time, so its deadline is the earliest group's gate deadline (conservative).
expect "B12b real gate 1 ms after the deadline: the earliest group drops out" 0 'j.individualQualified===0' -- G "$LATE"
expect "B12c real gate 1 h after the deadline: no current-use rows" 0 'j.individualQualified===0 && j.onIceQualified===0 && j.closedPolicyQualified===0' -- \
  G "$($NODE -e 'console.log(new Date(Date.parse(process.argv[1])+3600000).toISOString())' "$DEADLINE")"
else
# The date rule applies to every row at once: at the next UTC midnight both groups lose current use.
expect "B12b real gate at the next UTC midnight (the 11-19 case): no current-use rows" 0 'j.individualQualified===0 && j.onIceQualified===0 && j.closedPolicyQualified===0' -- G "$LATE"
fi
