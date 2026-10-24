#!/bin/sh
set -eu
task_snapshot_dir=$1
shift
cd "$task_snapshot_dir"
exec env -i PATH=/usr/local/bin:/usr/bin:/bin \
  NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid \
  NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key \
  SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key \
  NODE_OPTIONS="--require $task_snapshot_dir/audit-network-deny.cjs" \
  node node_modules/vitest/vitest.mjs run --config audit.vitest.config.mts "$@"
