#!/bin/bash
# Runs every rehearsal scenario under env -i (no credentials, no project), network blocked in-process,
# TMPDIR and all packets in a scratch directory. Writes RESULTS.jsonl beside this script.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
WEB="$(cd "$HERE/../../../../web" && pwd)"
SCRATCH="${1:?scratch dir}"
mkdir -p "$SCRATCH/tmp" "$SCRATCH/packets"; chmod 700 "$SCRATCH/packets"
OUT="$HERE/RESULTS.jsonl"; : > "$OUT"
PINS="$HERE/expected-pins.json"
run() { # scenario clock outdir
  ( cd "$WEB" && env -i PATH=/usr/local/bin:/usr/bin:/bin HOME="$SCRATCH" TMPDIR="$SCRATCH/tmp" NODE_PATH=. DISABLE_V8_COMPILE_CACHE=1 \
      TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' ${2:+REHEARSAL_CLOCK=$2} ${REHEARSAL_DATE:+REHEARSAL_DATE=$REHEARSAL_DATE} \
      /usr/local/bin/node --require ./node_modules/ts-node/register/transpile-only "$HERE/rehearse.ts" "$1" "$3" 2>/dev/null )
  echo "exit=$?" >&2
}
verify() { /usr/local/bin/node "$HERE/verify-packet.mjs" "$1" "$PINS" ${2:-}; }
treehash() { [ -d "$1" ] && (cd "$1" && find . -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256 | cut -c1-64) || echo absent; }
CLOCK=2026-11-09T01:00:00.000Z
for s in happy schedule_not_final schedule_duplicate_key schedule_empty_day schedule_wrong_season nst_no_rows nst_row_cap denied_permit partial_write interrupted; do
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
# Expired evidence: real clock (Nov 7 is now >= 8 days old). Must refuse before creating any output.
R=$(run expired "" "$SCRATCH/packets/expired"); echo "{\"run\":$R}" >> "$OUT"
# Tampered copies of the complete packet: readback must veto each.
for t in drop_provenance flip_byte extra_file real_pins; do
  C="$SCRATCH/packets/tamper_$t"; cp -Rp "$SCRATCH/packets/happy" "$C"; FLAG=--synthetic-adapter-ok
  case $t in
    drop_provenance) rm "$C/individual.TRANSPORT-OBSERVATION.json";;
    flip_byte) chmod 600 "$C/onIce.parser-input.html"; printf 'X' | dd of="$C/onIce.parser-input.html" bs=1 seek=20 conv=notrunc 2>/dev/null;;
    extra_file) (umask 077; echo '{}' > "$C/RETRY.json");;
    real_pins) FLAG="";;
  esac
  echo "{\"tamper\":\"$t\",\"readback\":$(verify "$C" $FLAG)}" >> "$OUT"
done
echo "{\"ledgerDirEntries\":$(ls -A "$SCRATCH/tmp" | grep -c fhfhockey-nst-budget)}" >> "$OUT"
echo done
