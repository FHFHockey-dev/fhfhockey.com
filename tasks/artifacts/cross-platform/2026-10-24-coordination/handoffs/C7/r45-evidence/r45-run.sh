set -e
R=/private/tmp/c7-r45; S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7
G=$S/network-guard.cjs; REPO=/Users/tim/Code/fhfhockey.com
test ! -e $R; mkdir -p $R/at $R/p $R/n
git -C $REPO archive 6c36c8e8c web | tar -x -C $R/at
git -C $REPO archive c8178b7e3 web | tar -x -C $R/p
git -C $REPO archive e2038b17a web | tar -x -C $R/n
for d in at p n; do ln -s $REPO/web/node_modules $R/$d/web/node_modules; done; ln -s $REPO/web/node_modules $R/node_modules
for d in n p; do (cd $R/$d/web && env -u GIT_DIR NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/forge-producer-closure.ts --json > $R/closure-$d.json)
  node -e "const d=require('$R/closure-$d.json');console.log('closure $d',d.closureSha256,d.modules.length,'findings',d.findings.length,'wire in closure',d.modules.includes('lib/rosterScheduleData/bridgeForecastWire.ts'))"; done
node -e "const a=require('$R/closure-n.json').modules,b=require('$R/closure-p.json').modules;console.log('added',a.filter(x=>!b.includes(x)),'removed',b.filter(x=>!a.includes(x)))"
git -C $REPO show e2038b17a:web/lib/projections/verifiedForgeReleases.ts | grep -o 'closureSha256: "[0-9a-f]*"'
TN="web/__tests__/pages/api/v1/roster-schedule-optimizer/data.test.ts web/lib/rosterScheduleData/forgeDailyBridge.test.ts web/lib/rosterScheduleData/planning.test.ts"
TC="web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts"
for f in $TN; do git -C $REPO show e2038b17a:$f > $R/p/$f; done
# Flag-off regression: the parent's bridge tests against the new bridge code
mkdir -p $R/n/web/lib/rosterScheduleData/c7
git -C $REPO show c8178b7e3:web/lib/rosterScheduleData/forgeDailyBridge.test.ts | sed 's#from "\./#from "../#g' > $R/n/web/lib/rosterScheduleData/c7/forgeDailyBridge.parent.test.ts
# Defect controls: the two pins with .fails removed
sed 's/it\.fails(/it(/g' $R/at/web/$TC > $R/at/web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.nofails.test.ts
mk() { name=$1; root=$2; shift 2; inc=""; for t in "$@"; do inc="$inc\"$R/$root/$t\", "; done
cat > $R/vitest.$name.mts <<EOF
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "$R/$root/web";
export default defineConfig({ root: M, cacheDir: "$R/cache-$name", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: [$inc], maxWorkers: 2, testTimeout: 120000 } });
EOF
}
mk head at $TN $TC
mk p p $TN
mk flagoff n web/lib/rosterScheduleData/c7/forgeDailyBridge.parent.test.ts
mk nofails at web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.nofails.test.ts
for n in head p flagoff nofails; do
  root=at; case $n in p) root=p;; flagoff) root=n;; esac
  (cd $R/$root/web && env -u GIT_DIR -u FORGE_RESERVE_PASS_ENABLED TZ=UTC NODE_OPTIONS="--require $G" $R/node_modules/.bin/vitest run --config $R/vitest.$n.mts --reporter=json --outputFile=$R/$n.json > $R/$n.log 2>&1) || true
  node -e "const r=require('$R/$n.json');console.log('$n',r.numPassedTests+'/'+r.numTotalTests,'skipped',r.numPendingTests);for(const f of r.testResults){const nm=f.name.split('/web/')[1];const fails=f.assertionResults.filter(a=>a.status==='failed');console.log('  file',nm,f.assertionResults.length,f.status,fails.length?'fails='+fails.length:'',(f.message||'').slice(0,120));for(const a of fails.slice(0,10))console.log('    FAIL',a.title.slice(0,100),'::',(a.failureMessages[0]||'').split('\n')[0].slice(0,200))}"
done
