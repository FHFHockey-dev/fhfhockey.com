#!/bin/sh
# Re-run the 12 focused suites offline. No install, server, provider or database access.
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$HERE/../../../../.." && pwd)
cd "$ROOT/web"
exec env -i HOME="$HOME" PATH="$PATH" TMPDIR="${TMPDIR:-/tmp}" \
 NODE_ENV=test NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid \
 NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key \
 SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key \
 NODE_OPTIONS="--require=$HERE/w3-sko-vudu-offline-preload.cjs" \
 node node_modules/vitest/vitest.mjs --run \
 lib/sko/gap.test.ts lib/skoElement/interpret.test.ts \
 lib/buyLowSellHigh/market.test.ts lib/buyLowSellHigh/trade.test.ts \
 components/skoElement/SkoElementPreview.test.tsx components/blshTrade/BlshTradeComparison.test.tsx \
 __tests__/pages/api/v1/ml/get-predictions-sko.test.ts __tests__/pages/api/v1/ml/update-predictions-sko.test.ts \
 __tests__/pages/api/v1/db/update-sko-stats.test.ts __tests__/pages/api/v1/db/update-sko-stats.route.test.ts \
 lib/supabase/utils/legacySko.test.ts scripts/sko-output-authority.test.ts
