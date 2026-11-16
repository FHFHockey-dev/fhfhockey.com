#!/bin/zsh
# RECHECK-11 C1: the bridge's check-attestation.mjs against an attestation written by the operator's own tool.
#   zsh attestation-shape.sh <new scratch dir>
# Uses the operator dress rehearsal (offline; never reads .env.local; refuse-only real launcher outside the slot) to
# produce OPERATOR-ATTESTATION.json from the real launcher's log format, then runs the bridge check on it, and on a
# scratch copy whose only change unwraps the launcher's g3 line.
set -u; S=${1:?scratch}; mkdir -p $S; R=/Users/tim/Code/fhfhockey.com/tasks/artifacts
zsh $R/blsh-pilot-operator-2026-11-15/tools/dress-rehearsal.sh $S/oprh 1117 > $S/oprh.out 2>&1; grep failures $S/oprh.out
ATT=$S/oprh/attestation/OPERATOR-ATTESTATION.json; mkdir -p $S/fakepkt
/usr/bin/python3 -I -c "import json; a=json.load(open('$ATT')); print('launcher.g3Line keys:', sorted(json.loads(a['launcher']['g3Line'])))"
env -i PATH=/usr/bin:/bin /usr/local/bin/node $R/blsh-evidence-bridge-2026-11-15/post-capture/check-attestation.mjs --candidate v5 --attestation $ATT --packet $S/fakepkt
mkdir -p $S/ca; cp $R/blsh-evidence-bridge-2026-11-15/post-capture/check-attestation.mjs $S/ca/
/usr/bin/python3 -I - $S/ca/check-attestation.mjs <<'PY'
import sys; p=sys.argv[1]; s=open(p).read()
old='let g3l; try { g3l = JSON.parse(l.g3Line); }'
new='let g3l; try { const w = JSON.parse(l.g3Line); g3l = w.launcher === "g3" && w.exitCode === 0 ? JSON.parse(w.stdout) : null; }'
assert s.count(old)==1; open(p,'w').write(s.replace(old,new))
PY
env -i PATH=/usr/bin:/bin /usr/local/bin/node $S/ca/check-attestation.mjs --candidate v5 --attestation $ATT --packet $S/fakepkt
