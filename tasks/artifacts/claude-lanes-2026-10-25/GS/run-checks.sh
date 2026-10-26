#!/bin/zsh
# Waits for the shared heavy lock, runs GS focused tests + scoped tsc + lint offline, releases only our lock.
set -u
GS="$(cd "$(dirname "$0")" && pwd)"; WEB="$GS/../../../../web"; LOCK=/private/tmp/fhfh-heavy.lock
until mkdir "$LOCK" 2>/dev/null; do sleep 15; done
echo "GS goalie-starts checks $(date -u +%FT%TZ) gs-goalie-starts" > "$LOCK/OWNER"
trap 'rm -f "$LOCK/OWNER"; rmdir "$LOCK"' EXIT
cd "$WEB"; unset GIT_DIR
export NODE_OPTIONS="--require $GS/offline.cjs" NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=inert
F=(components/GoalieShareChart/index.tsx components/GoalieShareChart/GoalieShareChart.test.ts components/GoalieShareChart/GoalieShareChart.pagination.test.tsx lib/goalieWorkload.ts lib/projections/goalie/workloadEvidence.ts lib/projections/goalie/workloadEvidence.test.ts)
echo "== vitest"; node node_modules/vitest/vitest.mjs run --config "$GS/vitest.config.mts" > "$GS/focused.log" 2>&1; echo "vitest exit $?"
unset NODE_OPTIONS
echo "== tsc"; node node_modules/typescript/bin/tsc --noEmit -p "$GS/tsconfig.json" > "$GS/tsc.log" 2>&1; echo "tsc exit $?"
echo "== eslint"; node node_modules/eslint/bin/eslint.js "${F[@]}" > "$GS/eslint.log" 2>&1; echo "eslint exit $?"
