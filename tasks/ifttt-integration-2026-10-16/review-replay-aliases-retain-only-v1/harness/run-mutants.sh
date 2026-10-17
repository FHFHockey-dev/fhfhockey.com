#!/bin/zsh
# Run from web/: zsh <this> [TESTS=...] [OUT=<subdir of evidence/>]
# Runs the selected tests (default: the LIVE route test) once per mutant; writes evidence/<OUT>/<mutant>.{log,json}.
set -u
here=${0:A:h}
out=$here/../evidence/${OUT:-mutation}
mkdir -p $out
for mutant in $(python3 -I -c 'import json,sys; print(" ".join(json.load(open(sys.argv[1]))))' $here/../mutants/mutants-manifest.json); do
  MUTANT=$mutant npx vitest --run --config $here/vitest.review.config.mjs --reporter=verbose --reporter=json \
    --outputFile.json=$out/$mutant.json > $out/$mutant.log 2>&1
  echo "exit $?" >> $out/$mutant.log
done
