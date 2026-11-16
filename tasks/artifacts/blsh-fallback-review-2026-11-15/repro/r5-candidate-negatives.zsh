#!/bin/zsh
# R5: explicit-candidate negatives on the bridge CLIs. Needs a finished bridge rehearsal scratch:
#   bash .../blsh-evidence-bridge-2026-11-15/post-capture/dress-rehearsal.sh <scratch> v5-1118
# Usage: zsh r5-candidate-negatives.zsh <that scratch> <new scratch for outputs>. Every case must refuse (exit 2), writing nothing.
unset GIT_DIR; S=${1:?rehearsal scratch}/B; N=${2:?new scratch}; [[ -e $N ]] && { echo "exists"; exit 2; }; mkdir -p $N/home $N/tmp
B=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-evidence-bridge-2026-11-15; AN=daa77e22e1b8778361b392461e9921a6d292d0382ebf4ae872a0081f02f01fef
LINEAGE=$(/usr/local/bin/node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).lineage.path)' /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-native-packet-preparation-2026-11-08/SOURCE-PINS.json)
CL=(env -i PATH=/usr/bin:/bin HOME=$N/home TMPDIR=$N/tmp/)
run() { echo "== $1"; shift; "${CL[@]}" /usr/local/bin/node "$@" 2>&1 | cut -c1-300; echo "exit ${pipestatus[1]}"; }
run "N1 fallback packet, --candidate v5, v5 pins" $B/convert.mjs --candidate v5 --packet $S/packet-candidate --pins $B/approved/v5/expected-pins.json --verifier $B/approved/v5/verify-packet.mjs --node-sha256 $AN --lineage $LINEAGE --out $N/c1
run "N2 fallback packet, --candidate v5, v5-1118 pins" $B/convert.mjs --candidate v5 --packet $S/packet-candidate --pins $B/approved/v5-1118/expected-pins.json --verifier $B/approved/v5-1118/verify-packet.mjs --node-sha256 $AN --lineage $LINEAGE --out $N/c2
run "N3 fallback packet, --candidate v5-1118, v5 pins" $B/convert.mjs --candidate v5-1118 --packet $S/packet-candidate --pins $B/approved/v5/expected-pins.json --verifier $B/approved/v5/verify-packet.mjs --node-sha256 $AN --lineage $LINEAGE --out $N/c3
run "N4 no --candidate (real conversion)" $B/convert.mjs --packet $S/packet-candidate --pins $B/approved/v5-1118/expected-pins.json --verifier $B/approved/v5-1118/verify-packet.mjs --node-sha256 $AN --lineage $LINEAGE --out $N/c4
run "N5 assemble --candidate v5 on v5-1118 conversion" $B/assemble.mjs --candidate v5 --request $S/request.json --context $S/context.json --conversion $S/conversion --frames $S/frames --out $N/a5
run "N6 assemble without --candidate" $B/assemble.mjs --request $S/request.json --context $S/context.json --conversion $S/conversion --frames $S/frames --out $N/a6
run "N7 check-attestation without --candidate" $B/post-capture/check-attestation.mjs --attestation $S/attestation/OPERATOR-ATTESTATION.json --packet $S/packet-candidate
echo "outputs created: $(ls $N | grep -v -e home -e tmp | wc -l | tr -d ' ')"
