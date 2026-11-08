set -e
R=/private/tmp/c7-r46; S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7
G=$S/network-guard.cjs; REPO=/Users/tim/Code/fhfhockey.com
test ! -e $R; mkdir -p $R/at $R/wa $R/pwa $R/prso $R/pcat $R/pya
git -C $REPO archive 5aa9ba5e0 web | tar -x -C $R/at
git -C $REPO archive 08e583311 web | tar -x -C $R/wa
git -C $REPO archive f98312c9b web | tar -x -C $R/pwa
git -C $REPO archive 08e583311 web | tar -x -C $R/prso
git -C $REPO archive 2d815ee1c web | tar -x -C $R/pcat
git -C $REPO archive 4ed3a6220 web | tar -x -C $R/pya
for d in at wa pwa prso pcat pya; do ln -s $REPO/web/node_modules $R/$d/web/node_modules; done; ln -s $REPO/web/node_modules $R/node_modules
for d in wa at; do (cd $R/$d/web && env -u GIT_DIR NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/forge-producer-closure.ts --json > $R/closure-$d.json)
  node -e "const d=require('$R/closure-$d.json');console.log('closure $d',d.closureSha256,d.modules.length,'findings',d.findings.length)"; done
git -C $REPO show 5aa9ba5e0:web/lib/projections/verifiedForgeReleases.ts | grep -o 'closureSha256: "[0-9a-f]*"'
TWA="web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts web/lib/rosterScheduleData/forgeDailyBridge.test.ts"
TRSO="web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx"
TCAT="web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts web/lib/rosterScheduleOptimizer/planning.test.ts web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts"
TYA="web/lib/integrations/yahoo/rosterPlanning.test.ts web/lib/integrations/yahoo/yahooDiet.test.ts"
for f in $TWA; do git -C $REPO show 08e583311:$f > $R/pwa/$f; done
for f in $TRSO; do git -C $REPO show 5aa3f8711:$f > $R/prso/$f; done
for f in $TCAT; do mkdir -p $(dirname $R/pcat/$f); git -C $REPO show 4ed3a6220:$f > $R/pcat/$f; done
for f in $TYA; do git -C $REPO show 5aa9ba5e0:$f > $R/pya/$f; done
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
mk head at $TWA $TRSO $TCAT $TYA
mk pwa pwa $TWA
mk prso prso $TRSO
mk pcat pcat $TCAT
mk pya pya $TYA
for n in head pwa prso pcat pya; do
  root=at; case $n in pwa|prso|pcat|pya) root=$n;; esac
  (cd $R/$root/web && env -u GIT_DIR -u FORGE_PROJECTION_DAYS_AHEAD -u FORGE_RESERVE_PASS_ENABLED -u RSO_YAHOO_DIET TZ=UTC NODE_OPTIONS="--require $G" $R/node_modules/.bin/vitest run --config $R/vitest.$n.mts --reporter=json --outputFile=$R/$n.json > $R/$n.log 2>&1) || true
  node -e "const r=require('$R/$n.json');console.log('$n',r.numPassedTests+'/'+r.numTotalTests,'skipped',r.numPendingTests);for(const f of r.testResults){const nm=f.name.split('/web/')[1];const fails=f.assertionResults.filter(a=>a.status==='failed');console.log('  file',nm,f.assertionResults.length,f.status,fails.length?'fails='+fails.length:'',(f.message||'').slice(0,120));for(const a of fails.slice(0,10))console.log('    FAIL',a.title.slice(0,100))}"
done
(cd $R/at/web && env -u GIT_DIR ./node_modules/.bin/playwright test e2e/rso-acceptance.spec.ts --list > $R/e2e-list.log 2>&1) || true
tail -8 $R/e2e-list.log
