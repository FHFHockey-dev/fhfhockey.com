#!/bin/bash
# Reviewer recheck: mutate convert.mjs in the scratch mirror only; restore and cmp at the end.
S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/3da3d3bf-4358-48d2-8c64-4147ffd1a7cf/scratchpad; M=$S/mirror4/tasks/artifacts/blsh-evidence-bridge-2026-11-15
cd $M; mkdir -p $S/tmp-mut4
mut() {
  cp $S/convert4.orig.mjs convert.mjs
  python3 - "$2" "$3" <<'PY'
import sys
s=open('convert.mjs').read(); old,new=sys.argv[1],sys.argv[2]
assert s.count(old)==1, ('not unique',old)
open('convert.mjs','w').write(s.replace(old,new))
PY
  env -u GIT_DIR TMPDIR=$S/tmp-mut4 node --test --test-name-pattern="$4" tests/bridge.test.mjs > $S/mut4-$1.log 2>&1
  echo "$1: exit=$? $(grep -E '^# (pass|fail)' $S/mut4-$1.log | tr '\n' ' ') first_error=$(grep -m1 -E "^  error:" $S/mut4-$1.log | cut -c1-120)"
}
mut lt8_to_le8 '< 8 * DAY_MS;' '<= 8 * DAY_MS;' 'negative TLS'
mut drop_mirror_fn 'if (obsName) need(JSON.stringify(observations[obsName]?.tls) === JSON.stringify(t), "tls_observation_inconsistent");' '' 'negative TLS'
mut drop_overclaim_fn 'need(obs.TLSVerified === null, "observation_overclaims_tls"); return true;' 'return true;' 'negative TLS'
mut drop_overclaim_callsite '    checkObservationClaims(obs);' '' 'negative'
mut drop_approved_gate '  if (!syntheticAdapterOk) {' '  if (false) {' 'approved inputs'
mut drop_ca_recheck 'need(HEX64.test(caStoreSHA256 ?? "") && t.defaultCACertificatesSHA256 === caStoreSHA256, "tls_ca_store_changed");' '' 'negative TLS|frames production'
mut drop_tls_exact_keys 'need(sameKeys(t, TLS_KEYS), "tls_observation_shape");' '' 'negative TLS|frames production'
cp $S/convert4.orig.mjs convert.mjs
cmp convert.mjs /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-evidence-bridge-2026-11-15/convert.mjs && echo restored_identical
