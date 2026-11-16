#!/bin/zsh
# R1: git apply --check on the canonical checkout (check only), then apply in a scratch export and hash.
# Usage: zsh r1-candidate-apply.sh <new scratch dir>
set -u; unset GIT_DIR
S=${1:?scratch}; REPO=/Users/tim/Code/fhfhockey.com; P=$REPO/tasks/artifacts/blsh-successor-candidate-2026-11-15/fallback-1118/FALLBACK.patch
[[ -e $S ]] && { echo "scratch exists"; exit 2; }; mkdir -p $S
shasum -a 256 $P
(cd $REPO && git apply --check $P && echo "apply-check on HEAD $(git rev-parse --short HEAD): OK (nothing applied)")
(cd $REPO && git diff --quiet 348a122d6 HEAD -- web/scripts/blsh web/lib/buyLowSellHigh web/lib/nst web/lib/cron/nstRateLimitPolicy.ts web/package.json web/package-lock.json && echo "no drift 348a122d6..HEAD in pinned areas")
(cd $REPO && git archive HEAD web/scripts/blsh) | tar -x -C $S
(cd $S && git apply $P) && shasum -a 256 $S/web/scripts/blsh/nativeProcessCaptureBootstrap.ts   # expect 849009ee...
diff <(cd $REPO && git show HEAD:web/scripts/blsh/nativeProcessCaptureBootstrap.ts) $S/web/scripts/blsh/nativeProcessCaptureBootstrap.ts  # expect SLOT + OUTPUT only
