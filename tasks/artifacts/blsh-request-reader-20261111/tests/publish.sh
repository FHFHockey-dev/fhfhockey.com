#!/bin/bash
# Publishes one green run_all.sh result into the artifact folder, then re-derives the scope and SHA256SUMS in the same
# step, so the sums always describe the published receipt/log (RECHECK-11 A2). Offline.
#   bash tests/publish.sh <scratch dir of a finished run_all.sh>
set -eu -o pipefail
SCR="${1:?usage: publish.sh <run_all scratch dir>}"
HERE="$(cd "$(dirname "$0")" && pwd)"; A="$(dirname "$HERE")"; PY=/opt/anaconda3/bin/python3
env -i PATH=/usr/bin:/bin $PY -I -B -c "
import json,sys; sys.path.insert(0,'$A'); import make_scope
r=json.load(open('$SCR/TESTS-RECEIPT.json'))
assert r['failed']==0 and r['passed']>0, 'receipt not green'
assert r['pins']==make_scope.local_pins(), 'receipt pins differ from the files now in the folder'"
cp "$SCR/TESTS-RECEIPT.json" "$A/TESTS-RECEIPT.json"; cp "$SCR/TESTS.log" "$A/TESTS.log"
(cd "$A" && env -i PATH=/usr/bin:/bin $PY -I -B make_scope.py >/dev/null)
(cd "$A" && rm -f SHA256SUMS && find . -type f ! -name 'SHA256SUMS*' ! -name .DS_Store ! -path './locks/*' | sed 's#^\./##' | LC_ALL=C sort | xargs shasum -a 256 > SHA256SUMS.tmp && mv SHA256SUMS.tmp SHA256SUMS)
(cd "$A" && shasum -a 256 -c SHA256SUMS >/dev/null)
echo "{\"ok\":true,\"scopeSHA256\":\"$(shasum -a 256 "$A/LIVE-READ-SCOPE.json" | cut -d' ' -f1)\",\"sumsSHA256\":\"$(shasum -a 256 "$A/SHA256SUMS" | cut -d' ' -f1)\",\"files\":$(wc -l < "$A/SHA256SUMS" | tr -d ' ')}"
