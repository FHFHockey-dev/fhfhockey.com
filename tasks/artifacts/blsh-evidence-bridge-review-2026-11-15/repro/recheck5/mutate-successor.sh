#!/bin/sh
# RECHECK-5 mutants of tests/fixtures.mjs successorSources(), each run against test 14 only, in a scratch mirror.
# Usage: sh mutate-successor.sh <scratchDir>   (GIT_DIR unset; the canonical bridge folder is never written)
set -u
S=$1; R=/Users/tim/Code/fhfhockey.com
run() { # name, perl substitution
  M=$S/mut5-$1; rm -rf "$M"; mkdir -p "$M/tasks/artifacts" "$S/mut5tmp-$1"
  cp -R $R/tasks/artifacts/blsh-evidence-bridge-2026-11-15 "$M/tasks/artifacts/"
  for d in blsh-native-packet-preparation-2026-11-08 blsh-pilot-readiness-2026-11-14 blsh-successor-candidate-2026-11-15; do ln -s $R/tasks/artifacts/$d "$M/tasks/artifacts/$d"; done
  ln -s $R/web "$M/web"; printf 'gitdir: %s/.git\n' $R > "$M/.git"
  F="$M/tasks/artifacts/blsh-evidence-bridge-2026-11-15/tests/fixtures.mjs"
  perl -0pi -e "$2" "$F"
  if cmp -s "$F" $R/tasks/artifacts/blsh-evidence-bridge-2026-11-15/tests/fixtures.mjs; then echo "$1: MUTATION_NOT_APPLIED"; return; fi
  B="$M/tasks/artifacts/blsh-evidence-bridge-2026-11-15"
  (cd "$B" && env -u GIT_DIR TMPDIR="$S/mut5tmp-$1" BRIDGE_PINS="$B/approved/v5/expected-pins.json" \
    node --test --test-name-pattern="fidelity: REAL" tests/bridge.test.mjs > "$S/mut5-$1.log" 2>&1)
  echo "$1: exit=$? $(grep -E '^# (pass|fail)' "$S/mut5-$1.log" | tr '\n' ' ') $(grep -m1 -oE 'successor_tree_[a-z_:]+|Missing expected exception[^\"]*' "$S/mut5-$1.log")"
}
run third_state_accepted 's/else throw new Error\(`successor_tree_unrecognised: forward=\$\{forward\} reverse=\$\{reverse\}`\);/else state = "already_v5";/'
run role_check_dropped 's/for \(const \[role, file\] of Object\.entries\(V5_ROLE_FILES\)\)/for (const [role, file] of [])/'
