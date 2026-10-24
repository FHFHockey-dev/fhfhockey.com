#!/bin/bash
set -o noclobber
if ! echo "C7 luna-r1 full tsc pid $$ $(date -u +%FT%TZ)" > /private/tmp/fhfh-heavy.lock 2>/dev/null; then echo "LOCK BUSY: $(cat /private/tmp/fhfh-heavy.lock)"; exit 75; fi
echo "lock taken $(date -u +%FT%TZ)"
cd /private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7/luna-r1/web && env -u GIT_DIR NODE_OPTIONS=--max-old-space-size=8192 node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.json > /private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7/luna-r1/out/full-tsc-after.log 2>&1; code=$?
grep -q "C7 luna-r1 full tsc pid $$" /private/tmp/fhfh-heavy.lock && rm -f /private/tmp/fhfh-heavy.lock
echo "tsc exit=$code errors=$(grep -c 'error TS' /private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7/luna-r1/out/full-tsc-after.log) lock released $(date -u +%FT%TZ)"
