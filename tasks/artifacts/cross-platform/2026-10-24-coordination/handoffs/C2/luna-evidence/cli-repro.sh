#!/bin/bash
# usage: cli-repro.sh <before|after> <webdir>
S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/622ce9ac-39ba-4f02-ab8f-0330e32934fd/scratchpad/c2; L=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-review-integration-2026-10-23
tag=$1; W=$2; C=$S/cli-$tag; rm -rf $C; mkdir -p $C; cd $W
base=(env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=$S TMPDIR=$S/tmp NODE_OPTIONS=--require=$S/network-guard.cjs)
VN=(node node_modules/vite-node/vite-node.mjs --config $S/vn-$tag.mjs scripts/review-ifttt-luna.ts)
cli() { name=$1; shift; "$@" > $C/$name.stdout 2> $C/$name.stderr; echo "$tag $name exit=$? stdout=$(cat $C/$name.stdout) stderr=$(tr '\n' ' ' < $C/$name.stderr | cut -c1-200)"; }
cli K1-default "${base[@]}" "${VN[@]}" --input $L/EXAMPLE-PACKET.json --output $C/k1.json --ledger $C/absent-ledger.json
cli K2-dispatch-killswitch "${base[@]}" OPENAI_API_KEY=sk-SENTINEL-C2 "${VN[@]}" --dispatch --input $L/EXAMPLE-PACKET.json --output $C/k2.json --ledger $C/absent-ledger.json
cli K3-dispatch-enabled-no-ledger "${base[@]}" OPENAI_API_KEY=sk-SENTINEL-C2 IFTTT_LUNA_REVIEW_ENABLED=true IFTTT_LUNA_REVIEW_STOP=false "${VN[@]}" --dispatch --input $L/EXAMPLE-PACKET.json --output $C/k3.json --ledger $C/absent-ledger.json
for f in k1 k2 k3; do python3 -I -c "import json,sys;d=json.load(open(sys.argv[1]));print(sys.argv[2], {k:d.get(k) for k in ['status','attempts','holds','requestIds','canPublish','canWriteAliases','canChangeStatus','canExecuteReplacement']}, 'decisionReview=', (d.get('decisionReview') or {}).get('status'), (d.get('decisionReview') or {}).get('reason'))" $C/$f.json $f; done
ls $C | grep -E "ledger|lock" || echo "no ledger or lock created"
grep -l SENTINEL $C/* || echo "no sentinel leak"
cmp $L/CLI-DISABLED-RESULT.json $C/k1.json && echo "K1 byte-identical to owner CLI-DISABLED-RESULT.json"
