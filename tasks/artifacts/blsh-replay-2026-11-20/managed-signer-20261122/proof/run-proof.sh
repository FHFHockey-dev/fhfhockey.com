#!/usr/bin/env bash
# PROOF-ONLY runner. Exports Y with `git archive` into /private/tmp (no worktree, no checkout, no git mutation), links the
# canonical web/node_modules read-only, copies the harness in, and runs it with Vitest. Never sets GIT_DIR.
set -euo pipefail
Y=1efdfb4364dffa73a9c249f382dbfebe22ebbbd2
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../../../.." && pwd)"
LIVE="$REPO/tasks/artifacts/blsh-replay-2026-11-20/live-pilot-20261121/redate-20261123"
WORK="${BLSH_SIGNER_WORK:-/private/tmp/blsh-signer-proof}"
rm -rf "$WORK/y" "$WORK/out"; mkdir -p "$WORK/y" "$WORK/out"
git -C "$REPO" archive "$Y" web supabase | tar -x -C "$WORK/y"
ln -sfn "$REPO/web/node_modules" "$WORK/y/web/node_modules"
cp "$HERE/harness/managedSigner.proof.test.ts" "$WORK/y/web/lib/blsh/nativeCaptureV6/"
# Vite only serves files under the project root, so the signer, mock and SQL are copied in beside the harness.
mkdir -p "$WORK/y/web/lib/blsh/nativeCaptureV6/__managed_signer__"
cp -R "$HERE/signer" "$HERE/harness" "$HERE/sql" "$WORK/y/web/lib/blsh/nativeCaptureV6/__managed_signer__/"
( cd "$LIVE" && shasum -a 256 INSTALL.sql ARM.sql SCHEDULE-ONCE.sql CANCEL-OFFICIAL-ONCE.sql ) > "$WORK/out/live-sql-pins.txt"
cd "$WORK/y/web"
env -u GIT_DIR BLSH_SIGNER_PROOF_DIR="$WORK/y/web/lib/blsh/nativeCaptureV6/__managed_signer__" BLSH_SIGNER_PROOF_OUT="$WORK/out" BLSH_SIGNER_LIVE_SQL_DIR="$LIVE" \
  ./node_modules/.bin/vitest run lib/blsh/nativeCaptureV6/managedSigner.proof.test.ts --reporter=verbose 2>&1 | tee "$WORK/out/vitest.txt"
exit "${PIPESTATUS[0]}"
