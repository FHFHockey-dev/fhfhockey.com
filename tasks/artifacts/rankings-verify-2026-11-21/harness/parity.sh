#!/bin/bash
set -e
OUT=/Users/tim/Code/fhfhockey.com/tasks/artifacts/rankings-verify-2026-11-21/local
mkdir -p $OUT
run() { (cd /private/tmp/claude-501/-Users-tim--claude-spares-spare-7FNh7m/0acd08a2-5cea-41a5-bfab-e9586180e364/scratchpad/exp-$1/web && node --env-file=/Users/tim/Code/fhfhockey.com/web/.env.local runner.cjs $1 $OUT/round$2-$1.json); }
run 83750b4 1; run f47905d 1
run f47905d 2; run 83750b4 2
run 83750b4 3; run f47905d 3
echo DONE
