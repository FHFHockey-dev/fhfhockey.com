#!/bin/bash
S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/3da3d3bf-4358-48d2-8c64-4147ffd1a7cf/scratchpad; M=$S/mirror/tasks/artifacts/blsh-evidence-bridge-2026-11-15
cd $M
mut() { # name, python replace old new, pattern
  cp $S/convert.orig.mjs convert.mjs
  python3 - "$2" "$3" <<'PY'
import sys
s=open('convert.mjs').read(); old,new=sys.argv[1],sys.argv[2]
assert s.count(old)==1, ('not unique',old)
open('convert.mjs','w').write(s.replace(old,new))
PY
  env -u GIT_DIR TMPDIR=$S/tmp-mut node --test --test-name-pattern="$4" tests/bridge.test.mjs > $S/mut-$1.log 2>&1
  echo "$1: exit=$? $(grep -E '^# (pass|fail)' $S/mut-$1.log | tr '\n' ' ')"
}
mkdir -p $S/tmp-mut
mut drop_checkRuntime '  checkRuntime(runtime, started, nodeSHA256, syntheticAdapterOk);' '' 'negative TLS'
mut drop_mirror 'if (obsName) need(JSON.stringify(observations[obsName]?.tls) === JSON.stringify(t), "tls_observation_inconsistent");' '' 'negative TLS'
mut lt8_to_le8 '< 8 * DAY_MS, "future_incomplete_or_stale_date"' '<= 8 * DAY_MS, "future_incomplete_or_stale_date"' 'stale'
mut drop_8day '&& retrieved - Date.parse(`${date}T00:00:00Z`) < 8 * DAY_MS' '' 'stale'
mut drop_sameday 'need(date < new Date(retrieved).toISOString().slice(0, 10) && ' 'need(' 'stale'
mut drop_tlschain 'verifyTlsChain(Object.fromEntries' 'void (Object.fromEntries' 'negative TLS'
mut drop_tlsverified_null_check 'need(obs.TLSVerified === null, "observation_overclaims_tls");' '' 'negative'
cp $S/convert.orig.mjs convert.mjs
cmp convert.mjs /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-evidence-bridge-2026-11-15/convert.mjs && echo restored_identical
