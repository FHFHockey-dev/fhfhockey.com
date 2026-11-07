set -e
R=/private/tmp/c7-r49; S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7
G=$S/network-guard.cjs; REPO=/Users/tim/Code/fhfhockey.com
test ! -e $R; mkdir -p $R/at $R/p6 $R/pn $R/d6
git -C $REPO archive eff1b377a web | tar -x -C $R/at
git -C $REPO archive fe285adcf web | tar -x -C $R/p6
git -C $REPO archive 107673704 web | tar -x -C $R/pn
for d in at p6 pn; do ln -s $REPO/web/node_modules $R/$d/web/node_modules; done; ln -s $REPO/web/node_modules $R/node_modules
for d in at pn; do (cd $R/$d/web && env -u GIT_DIR NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/forge-producer-closure.ts --json > $R/closure-$d.json)
  node -e "const d=require('$R/closure-$d.json');console.log('closure $d',d.closureSha256,d.modules.length,'findings',d.findings.length,'rosterPlanning in closure',d.modules.includes('lib/integrations/yahoo/rosterPlanning.ts'))"; done
git -C $REPO show eff1b377a:web/lib/projections/verifiedForgeReleases.ts | grep -o 'closureSha256: "[0-9a-f]*"'
T6="web/lib/integrations/yahoo/rosterPlanning.test.ts web/lib/integrations/yahoo/yahooDiet.test.ts web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts"
TN="web/lib/rosterScheduleData/forgeDailyBridge.test.ts web/lib/rosterScheduleData/forgeReservePayload.test.ts"
for f in $T6; do git -C $REPO show 107673704:$f > $R/p6/$f; done
for f in $TN; do git -C $REPO show eff1b377a:$f > $R/pn/$f; done
# Regression: the parent's bridge tests against the new bridge code
mkdir -p $R/at/web/lib/rosterScheduleData/c7
git -C $REPO show 107673704:web/lib/rosterScheduleData/forgeDailyBridge.test.ts | sed 's#from "\./#from "../#g' > $R/at/web/lib/rosterScheduleData/c7/forgeDailyBridge.parent.test.ts
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
mk head at $T6 $TN web/lib/rosterScheduleData/planning.test.ts web/__tests__/pages/api/v1/roster-schedule-optimizer/data.test.ts web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts web/lib/rosterScheduleOptimizer/dailyAcceptance.e2e.test.ts
mk p6 p6 $T6
mk pn pn $TN
mk reg at web/lib/rosterScheduleData/c7/forgeDailyBridge.parent.test.ts
for n in head p6 pn reg; do
  root=at; case $n in p6|pn) root=$n;; esac
  (cd $R/$root/web && env -u GIT_DIR -u RSO_YAHOO_DIET -u FORGE_RESERVE_PASS_ENABLED -u FORGE_PROJECTION_DAYS_AHEAD TZ=UTC NODE_OPTIONS="--require $G" $R/node_modules/.bin/vitest run --config $R/vitest.$n.mts --reporter=json --outputFile=$R/$n.json > $R/$n.log 2>&1) || true
  node -e "const r=require('$R/$n.json');console.log('$n',r.numPassedTests+'/'+r.numTotalTests,'skipped',r.numPendingTests);for(const f of r.testResults){const nm=f.name.split('/web/')[1];const fails=f.assertionResults.filter(a=>a.status==='failed');console.log('  file',nm,f.assertionResults.length,f.status,fails.length?'fails='+fails.length:'',(f.message||'').slice(0,120));for(const a of fails.slice(0,14))console.log('    FAIL',a.title.slice(0,110),'::',(a.failureMessages[0]||'').split('\n')[0].slice(0,140))}"
done
