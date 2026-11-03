set -e
R=/private/tmp/c7-r50; S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7
G=$S/network-guard.cjs; REPO=/Users/tim/Code/fhfhockey.com
test ! -e $R; mkdir -p $R/at $R/p
git -C $REPO archive 5e8043d6d web | tar -x -C $R/at
git -C $REPO archive 8beaa186b web | tar -x -C $R/p
for d in at p; do ln -s $REPO/web/node_modules $R/$d/web/node_modules; done; ln -s $REPO/web/node_modules $R/node_modules
for d in at p; do (cd $R/$d/web && env -u GIT_DIR NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/forge-producer-closure.ts --json > $R/closure-$d.json)
  node -e "const d=require('$R/closure-$d.json');console.log('closure $d',d.closureSha256,d.modules.length,'findings',d.findings.length,'touched in closure',d.modules.filter(m=>/useRosterPlanning|executionAdapter|RosterScheduleOptimizer|TeamScheduleContext|ForecastPoints/.test(m)))"; done
git -C $REPO show 5e8043d6d:web/lib/projections/verifiedForgeReleases.ts | grep -o 'closureSha256: "[0-9a-f]*"'
T="web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx web/components/RosterScheduleOptimizer/ForecastPoints.test.tsx web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.points.test.tsx web/components/RosterScheduleOptimizer/TeamScheduleContext.test.tsx web/hooks/useRosterPlanning.test.tsx web/lib/rosterScheduleOptimizer/executionAdapter.test.ts"
for f in $T; do git -C $REPO show 5e8043d6d:$f > $R/p/$f; done
mk() { name=$1; root=$2; shift 2; inc=""; for t in "$@"; do inc="$inc\"$R/$root/$t\", "; done
cat > $R/vitest.$name.mts <<EOF
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "$R/$root/web";
export default defineConfig({ root: M, cacheDir: "$R/cache-$name", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: [$inc], maxWorkers: 2, testTimeout: 180000 } });
EOF
}
mk head at $T
mk p p $T
for n in head p; do
  root=at; [ $n = p ] && root=p
  (cd $R/$root/web && env -u GIT_DIR TZ=UTC NODE_OPTIONS="--require $G" $R/node_modules/.bin/vitest run --config $R/vitest.$n.mts --reporter=json --outputFile=$R/$n.json > $R/$n.log 2>&1) || true
  node -e "const r=require('$R/$n.json');console.log('$n',r.numPassedTests+'/'+r.numTotalTests,'skipped',r.numPendingTests);for(const f of r.testResults){const nm=f.name.split('/web/')[1];const fails=f.assertionResults.filter(a=>a.status==='failed');console.log('  file',nm,f.assertionResults.length,f.status,fails.length?'fails='+fails.length:'',(f.message||'').slice(0,120));for(const a of fails.slice(0,14))console.log('    FAIL',a.title.slice(0,110),'::',(a.failureMessages[0]||'').split('\n')[0].slice(0,140))}"
done
(cd $R/at/web && env -u GIT_DIR PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:9 ./node_modules/.bin/playwright test --list e2e/rso-acceptance.spec.ts 2>&1 | tail -25) || true
