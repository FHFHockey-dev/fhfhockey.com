#!/bin/bash
# Reviewer recheck-2: mutate scratch mirror5 only; restore + cmp at the end.
S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/3da3d3bf-4358-48d2-8c64-4147ffd1a7cf/scratchpad; M=$S/mirror5/tasks/artifacts/blsh-evidence-bridge-2026-11-15
cd $M; mkdir -p $S/tmp-mut5
mut() {
  cp $S/convert5.orig.mjs convert.mjs
  python3 - "$2" "$3" <<'PY'
import sys
s=open('convert.mjs').read(); old,new=sys.argv[1],sys.argv[2]
assert s.count(old)==1, ('not unique',old)
open('convert.mjs','w').write(s.replace(old,new))
PY
  env -u GIT_DIR TMPDIR=$S/tmp-mut5 node --test --test-name-pattern="$4" tests/bridge.test.mjs > $S/mut5-$1.log 2>&1
  echo "$1: exit=$? $(grep -E '^# (pass|fail)' $S/mut5-$1.log | tr '\n' ' ') $(grep -m1 -E "^  error:" $S/mut5-$1.log | cut -c1-100)"
}
mut drop_overclaim_callsite '    checkObservationClaims(obs);' '' 'call sites'
mut drop_mirror_check 'if (obsName) need(JSON.stringify(observations[obsName]?.tls) === JSON.stringify(t), "tls_observation_inconsistent");' '' 'call sites'
cp $S/convert5.orig.mjs convert.mjs
cmp convert.mjs /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-evidence-bridge-2026-11-15/convert.mjs && echo restored_identical
