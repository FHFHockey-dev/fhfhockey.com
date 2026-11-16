#!/bin/zsh
# R3: the bridge's post-capture gate 2 has no operator pins for v5-1118, although the operator lane has built them.
O=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15; B=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-evidence-bridge-2026-11-15
/usr/local/bin/node --input-type=module -e "import('$B/post-capture/check-attestation.mjs').then(m => { console.log(JSON.stringify(m.OPERATOR_PINS)); try { m.checkAttestation({ attestationPath: '/nonexistent', packetDir: '/nonexistent', candidate: 'v5-1118' }); } catch (e) { console.log('v5-1118 refusal:', e.code ?? e.message); } })"
echo "operator-built 1118 pins:"; shasum -a 256 $O/tools/nst-pilot-launcher-1118.py $O/evidence/DEPENDENCY-TREE-BASELINE-1118.json
grep -n '"v5-1118"' -A2 $O/tools/operator-attestation.py
