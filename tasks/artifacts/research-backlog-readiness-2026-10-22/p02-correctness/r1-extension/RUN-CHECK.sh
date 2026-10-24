#!/bin/sh
set -eu
task_packet=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
task_snapshot_dir=${2:-$(cat "$task_packet/green-snapshot-path.txt")}
cd "$task_snapshot_dir"
offline() {
  env -i PATH=/usr/local/bin:/usr/bin:/bin TMPDIR=/tmp \
    NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid \
    NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key \
    SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key \
    NODE_OPTIONS="--require=$task_snapshot_dir/audit-network-deny.cjs" "$@"
}
case "$1" in
  focused) offline node node_modules/vitest/vitest.mjs run --config audit.vitest.config.mts \
    components/PlayerStats/p02-independent.test.tsx components/PlayerStats/PlayerGoalieSummaries.test.tsx --reporter=verbose ;;
  tsc) offline node node_modules/typescript/bin/tsc --noEmit -p tsconfig.p02.json ;;
  lint) offline node node_modules/eslint/bin/eslint.js \
    components/PlayerStats/PlayerSummaryStrip.tsx components/PlayerStats/PlayerStatsSummary.tsx \
    components/PlayerStats/PlayerGoalieSummaries.test.tsx ;;
  *) exit 2 ;;
esac
