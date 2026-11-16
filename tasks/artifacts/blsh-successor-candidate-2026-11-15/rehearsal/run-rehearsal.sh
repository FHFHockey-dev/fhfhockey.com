#!/bin/bash
# Runs every rehearsal scenario under env -i (no credentials, no project), network blocked in-process,
# TMPDIR and all packets in a scratch directory. Writes RESULTS.jsonl beside this script.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
WEB="${REHEARSAL_WEB:?REHEARSAL_WEB must point at the patched export web/}"; export REHEARSAL_DATE="${REHEARSAL_DATE:?REHEARSAL_DATE required}"
SCRATCH="${1:?scratch dir}"
mkdir -p "$SCRATCH/tmp" "$SCRATCH/packets"; chmod 700 "$SCRATCH/packets"
OUT="${RESULTS_OUT:-$HERE/RESULTS.jsonl}"; : > "$OUT"
PINS="${PINS_JSON:-$HERE/expected-pins.json}"; REH="${REHEARSE_TS:-$HERE/rehearse.ts}"; VER="${VERIFY_MJS:-$HERE/verify-packet.mjs}"
run() { # scenario clock outdir
  ( cd "$WEB" && env -i PATH=/usr/local/bin:/usr/bin:/bin HOME="$SCRATCH" TMPDIR="$SCRATCH/tmp" NODE_PATH=. DISABLE_V8_COMPILE_CACHE=1 \
      TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' ${2:+REHEARSAL_CLOCK=$2} ${REHEARSAL_DATE:+REHEARSAL_DATE=$REHEARSAL_DATE} \
      /usr/local/bin/node --require ./node_modules/ts-node/register/transpile-only "$REH" "$1" "$3" 2>/dev/null )
  echo "exit=$?" >&2
}
verify() { /usr/local/bin/node "$VER" "$1" "$PINS" ${2:-} ${VERIFY_FLAGS:-}; }
jedit() { /usr/local/bin/node -e 'const f=process.argv[1],fs=require("fs"),j=JSON.parse(fs.readFileSync(f));(new Function("j",process.argv[2]))(j);fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$1" "$2"; }
treehash() { [ -d "$1" ] && (cd "$1" && find . -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256 | cut -c1-64) || echo absent; }
CLOCK="${CLOCK:?CLOCK required}"
for s in happy schedule_not_final schedule_duplicate_key schedule_empty_day schedule_wrong_season nst_no_rows nst_row_cap denied_permit partial_write interrupted ${EXTRA_SCENARIOS:-}; do
  P="$SCRATCH/packets/$s"
  R=$(run "$s" "$CLOCK" "$P"); [ -z "$R" ] && R="{\"scenario\":\"$s\",\"processKilledOrNoOutput\":true}"
  V='{"verdict":"no_packet"}'; [ -d "$P" ] && V=$(verify "$P" --synthetic-adapter-ok)
  echo "{\"run\":$R,\"readback\":$V,\"tree\":\"$(treehash "$P")\"}" >> "$OUT"
done
# Repeat / resumed attempt into an existing packet (happy, and the interrupted one) must not touch it.
for target in happy interrupted; do
  P="$SCRATCH/packets/$target"; BEFORE=$(treehash "$P")
  R=$(run repeat "$CLOCK" "$P"); AFTER=$(treehash "$P")
  echo "{\"run\":$R,\"repeatInto\":\"$target\",\"treeBefore\":\"$BEFORE\",\"treeAfter\":\"$AFTER\",\"unchanged\":$([ "$BEFORE" = "$AFTER" ] && echo true || echo false)}" >> "$OUT"
done
# Expired evidence. Real clock: 2026-11-11 stays fresh until 2026-11-19T00:00Z, so record what happens now.
R=$(run expired "" "$SCRATCH/packets/expired_real_clock"); echo "{\"case\":\"expired_real_clock\",\"realClockUTC\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"run\":$R}" >> "$OUT"
# Shifted clock at the exact 8-day expiry: must refuse before output.
R=$(run expired 2026-11-19T00:00:00.000Z "$SCRATCH/packets/expired_at_expiry"); echo "{\"case\":\"expired_at_expiry\",\"run\":$R}" >> "$OUT"
# One second before expiry: must be accepted and complete.
P="$SCRATCH/packets/expiry_boundary"; R=$(run expiry_boundary 2026-11-18T23:59:59.000Z "$P")
V='{"verdict":"no_packet"}'; [ -d "$P" ] && V=$(verify "$P" --synthetic-adapter-ok); echo "{\"case\":\"one_second_before_expiry\",\"run\":$R,\"readback\":$V}" >> "$OUT"
# Tampered copies of the complete packet: readback must veto each.
for t in drop_provenance flip_byte extra_file real_pins ${EXTRA_TAMPERS:-}; do
  C="$SCRATCH/packets/tamper_$t"; cp -Rp "$SCRATCH/packets/happy" "$C"; FLAG=--synthetic-adapter-ok
  case $t in
    drop_provenance) rm "$C/individual.TRANSPORT-OBSERVATION.json";;
    flip_byte) chmod 600 "$C/onIce.parser-input.html"; printf 'X' | dd of="$C/onIce.parser-input.html" bs=1 seek=20 conv=notrunc 2>/dev/null;;
    extra_file) (umask 077; echo '{}' > "$C/RETRY.json");;
    real_pins) FLAG="";;
    strip_runtime) rm "$C/RUNTIME.json";;
    runtime_bootstrap_edit) jedit "$C/RUNTIME.json" 'j.launch.bootstrapSHA256="0".repeat(64)';;
    runtime_openssl_flip) jedit "$C/RUNTIME.json" 'j.launch.environmentPresence.OPENSSL_CONF=true';;
    runtime_lifecycle_flip) jedit "$C/RUNTIME.json" 'j.adapterEnvironmentPresence.NST_JOB_LIFECYCLE_ENABLED=true';;
    runtime_extra_key) jedit "$C/RUNTIME.json" 'j.syntheticTestOnly=true';;
    runtime_dispatcher_flip) jedit "$C/RUNTIME.json" 'j.globalDispatcher.sameAsRunnerLoad=false';;
    settled_dispatcher_edit) jedit "$C/operation-4-SETTLED.json" 'j.tls.globalDispatcher.identityUnchanged=false';;
    settled_ca_edit) jedit "$C/operation-3-SETTLED.json" 'j.tls.defaultCACertificatesSHA256="0".repeat(64)';;
    tls_strip) chmod 600 "$C/onIce.TRANSPORT-OBSERVATION.json"; /usr/local/bin/node -e 'const f=process.argv[1],fs=require("fs"),j=JSON.parse(fs.readFileSync(f));delete j.tls;fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$C/onIce.TRANSPORT-OBSERVATION.json";;
  esac
  echo "{\"tamper\":\"$t\",\"readback\":$(verify "$C" $FLAG)}" >> "$OUT"
done
echo "{\"ledgerDirEntries\":$(ls -A "$SCRATCH/tmp" | grep -c fhfhockey-nst-budget)}" >> "$OUT"
echo done
