#!/bin/zsh
# RECHECK-12 C1/C2: the fixed bridge check on an attestation written by the operator's own tool.
#   zsh attestation-fixed.sh <new scratch dir>     (refuses on a slot date: the operator rehearsal has a date guard)
set -u; S=${1:?scratch}; mkdir -p $S/fakepkt; AR=/Users/tim/Code/fhfhockey.com/tasks/artifacts; PC=$AR/blsh-evidence-bridge-2026-11-15/post-capture
N=(env -i PATH=/usr/bin:/bin /usr/local/bin/node); P=(/usr/bin/python3 -I)
zsh $AR/blsh-pilot-operator-2026-11-15/tools/dress-rehearsal.sh $S/oprh 1117 > $S/oprh.out 2>&1; grep failures $S/oprh.out
ATT=$S/oprh/attestation/OPERATOR-ATTESTATION.json
print "1 as written (stub argv0):"; $N $PC/check-attestation.mjs --candidate v5 --attestation $ATT --packet $S/fakepkt
$P -c "import json; a=json.load(open('$ATT')); e=json.loads(a['launcher']['execLine']); e['argv0']='/usr/local/bin/node'; e['cwd']='/Users/tim/Code/fhfhockey.com/web'; a['launcher']['execLine']=json.dumps(e); open('$S/real.json','w').write(json.dumps(a))"
print "2 argv0/cwd set to real:"; $N $PC/check-attestation.mjs --candidate v5 --attestation $S/real.json --packet $S/fakepkt
$P -c "import json; a=json.load(open('$S/real.json')); a['launcher']['g3Line']=json.loads(a['launcher']['g3Line'])['stdout']; open('$S/bare.json','w').write(json.dumps(a))"
print "3 old bare G3 line:"; $N $PC/check-attestation.mjs --candidate v5 --attestation $S/bare.json --packet $S/fakepkt
$P -c "import json; a=json.load(open('$S/real.json')); e=json.loads(a['launcher']['execLine']); e['atUTC']='2026-11-17T14:05:50.000001Z'; a['launcher']['execLine']=json.dumps(e); open('$S/late.json','w').write(json.dumps(a))"
print "4 exec out of window:"; $N $PC/check-attestation.mjs --candidate v5 --attestation $S/late.json --packet $S/fakepkt
print "5 step 2b on file 2:"; /usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I $AR/blsh-pilot-operator-2026-11-15/tools/operator-attestation.py check --candidate v5-1117 $S/real.json
