#!/bin/bash
S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7; R=/Users/tim/Code/fhfhockey.com; L=$R/tasks/artifacts/luna-review-integration-2026-10-23; C=$S/cli2; mkdir -p $C; cd $R/web
base=(env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=$S TMPDIR=$S/tmp NODE_OPTIONS=--require=$L/network-guard.cjs)
VN=(node node_modules/vite-node/vite-node.mjs --config $S/vitest.c7.mjs scripts/review-ifttt-luna.ts)
cli() { name=$1; shift; "$@" > $C/$name.stdout 2> $C/$name.stderr; echo "$name exit=$? stdout=$(cat $C/$name.stdout) stderr=$(tr '\n' ' ' < $C/$name.stderr | cut -c1-300)"; }
cli K1-default "${base[@]}" "${VN[@]}" --input $L/EXAMPLE-PACKET.json --output $C/k1.json --ledger $C/absent-ledger.json
cli K2-dispatch-killswitch "${base[@]}" OPENAI_API_KEY=sk-SENTINEL-C7 "${VN[@]}" --dispatch --input $L/EXAMPLE-PACKET.json --output $C/k2.json --ledger $C/absent-ledger.json
cli K3-dispatch-enabled-no-ledger "${base[@]}" OPENAI_API_KEY=sk-SENTINEL-C7 IFTTT_LUNA_REVIEW_ENABLED=true IFTTT_LUNA_REVIEW_STOP=false "${VN[@]}" --dispatch --input $L/EXAMPLE-PACKET.json --output $C/k3.json --ledger $C/absent-ledger.json
cli K3b-dispatch-missing-ledger-flag "${base[@]}" "${VN[@]}" --dispatch --input $L/EXAMPLE-PACKET.json --output $C/k3b.json
echo keep > $C/k4.json; cli K4-existing-output "${base[@]}" "${VN[@]}" --input $L/EXAMPLE-PACKET.json --output $C/k4.json; echo "k4 content after: $(cat $C/k4.json)"
cli K5-input-eq-output "${base[@]}" "${VN[@]}" --input $C/k1.json --output $C/k1.json
cd $R && cli K6-repo-root-cwd "${base[@]}" node web/node_modules/vite-node/vite-node.mjs --config $S/vitest.c7.mjs web/scripts/review-ifttt-luna.ts --input $L/EXAMPLE-PACKET.json --output $C/k6.json
ls -la $C | grep -v -e stdout -e stderr
for f in k1 k2 k3 k6; do [ -f $C/$f.json ] && echo "== $f $(wc -c < $C/$f.json)B" && python3 -I -c "import json,sys;t=open(sys.argv[1]).read();d=json.loads(t) if t else {};print({k:d.get(k) for k in ['status','attempts','holds','requestIds','canPublish','canWriteAliases','canChangeStatus','canExecuteReplacement']}, 'decisionReview=', (d.get('decisionReview') or {}).get('status'), (d.get('decisionReview') or {}).get('reason'))" $C/$f.json; done
grep -l SENTINEL $C/* || echo "no sentinel leak"
cmp $L/CLI-DISABLED-RESULT.json $C/k1.json && echo "K1 byte-identical to owner CLI-DISABLED-RESULT.json"
