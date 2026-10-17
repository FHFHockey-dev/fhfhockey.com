#!/bin/zsh
# Run from web/: zsh <this>. Writes ../evidence/mutation/<mutant>.{log,json} and ../evidence/mutation-summary.json.
set -u
here=${0:A:h}
out=$here/../evidence/mutation
mkdir -p $out
node $here/build-mutants.mjs || exit 1
for mutant in $(node -e 'console.log(Object.keys(require(process.argv[1])).join(" "))' $here/mutants-manifest.json); do
  MUTANT=$mutant npx vitest --run --config $here/vitest.mutation.config.mjs --reporter=verbose --reporter=json \
    --outputFile.json=$out/$mutant.json > $out/$mutant.log 2>&1
  echo "exit $?" >> $out/$mutant.log
done
node $here/summarize.mjs
