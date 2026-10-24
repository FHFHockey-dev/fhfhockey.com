#!/bin/bash
# Waits for the shared heavy lock (never steals), takes it with noclobber, runs whole-project tsc in the snapshot, releases only its own lock.
S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/622ce9ac-39ba-4f02-ab8f-0330e32934fd/scratchpad/c2; LOCK=/private/tmp/fhfh-heavy.lock
ME="C2 claude d396b1e2 tsc $(date -u +%FT%TZ)"
until ( set -o noclobber; echo "$ME" > $LOCK ) 2>/dev/null; do sleep 20; done
echo "lock taken $(date -u +%FT%TZ): $(cat $LOCK)"
cd /private/tmp/fhfh-c2-isolated/web
NODE_OPTIONS=--max-old-space-size=8192 node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json > $S/full-tsc.log 2>&1; rc=$?
echo "tsc exit=$rc $(date -u +%FT%TZ)"; grep -c "error TS" $S/full-tsc.log; grep "error TS" $S/full-tsc.log | head -20
[ "$(cat $LOCK)" = "$ME" ] && rm -f $LOCK && echo "lock released $(date -u +%FT%TZ)"
