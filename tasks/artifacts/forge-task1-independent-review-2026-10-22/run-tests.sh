#!/bin/sh
set -eu
ROOT=/Users/tim/Code/fhfhockey.com
EVIDENCE="$ROOT/tasks/artifacts/forge-task1-independent-review-2026-10-22"
[ "$(node --version)" = v22.11.0 ]
[ "$(npm --version)" = 10.9.0 ]
CHECK=$(mktemp -d /tmp/fhfh-task1-review.XXXXXX)
cp -R "$EVIDENCE/snapshot/web" "$CHECK/web"
mkdir -p "$CHECK/web/review" "$CHECK/web/empty-env"
cp "$EVIDENCE"/independent-*.test.ts "$CHECK/web/review/"
cp "$EVIDENCE/vitest.config.mjs" "$CHECK/vitest.config.mjs"
ln -s "$ROOT/web/node_modules" "$CHECK/web/node_modules"
mkdir /private/tmp/fhfh-heavy.lock || exit 75
printf '%s\n' "task1-independent-review $$" > /private/tmp/fhfh-heavy.lock/task1-review-owner
release() {
  if [ "$(cat /private/tmp/fhfh-heavy.lock/task1-review-owner 2>/dev/null || true)" = "task1-independent-review $$" ]; then
    rm /private/tmp/fhfh-heavy.lock/task1-review-owner
    rmdir /private/tmp/fhfh-heavy.lock
  fi
}
trap release EXIT INT TERM
cd "$CHECK/web"
printf 'Frozen offline execution: %s\n' "$CHECK"
env -i PATH=/usr/local/bin:/usr/bin:/bin \
  NODE_OPTIONS="--require $EVIDENCE/network-deny.cjs" \
  NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid \
  NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key \
  node "$ROOT/web/node_modules/vitest/vitest.mjs" run --config "$CHECK/vitest.config.mjs"
