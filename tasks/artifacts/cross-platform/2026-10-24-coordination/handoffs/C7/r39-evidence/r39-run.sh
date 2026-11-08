set -e
R=/private/tmp/c7-r39; S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7
G=$S/network-guard.cjs; REPO=/Users/tim/Code/fhfhockey.com
rm -rf $R; mkdir -p $R/at $R/p1 $R/p2 $R/p3
git -C $REPO archive 3795abb43 web | tar -x -C $R/at
git -C $REPO archive 5356dc616 web | tar -x -C $R/p1
git -C $REPO archive 9eb4f0d36 web | tar -x -C $R/p2
git -C $REPO archive 97315cff3 web | tar -x -C $R/p3
T1="web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts web/__tests__/pages/api/v1/forge/players.test.ts web/__tests__/pages/api/v1/projections/explicitRunAdmission.test.ts web/__tests__/pages/api/v1/projections/players.test.ts web/__tests__/pages/api/v1/start-chart.test.ts web/lib/projections/apiHelpers.runAdmission.test.ts web/lib/projections/externalInputProof.test.ts web/lib/rosterScheduleData/forgeDailyBridge.test.ts web/lib/rosterScheduleData/planning.test.ts"
T2="web/lib/draft-ranker/discovery.test.ts"
T3="web/lib/integrations/yahoo/yahooDiet.test.ts web/lib/integrations/yahoo/planningConfirmations.test.ts web/lib/rosterScheduleOptimizer/providerRules.test.ts web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx"
for f in $T1 web/lib/projections/externalInputProof.fixtures.ts; do git -C $REPO show 9eb4f0d36:$f > $R/p1/$f; done
for f in $T2; do git -C $REPO show 97315cff3:$f > $R/p2/$f; done
for f in $T3; do mkdir -p $(dirname $R/p3/$f); git -C $REPO show 3795abb43:$f > $R/p3/$f; done
for d in at p1 p2 p3; do ln -s $REPO/web/node_modules $R/$d/web/node_modules; done
ln -s $REPO/web/node_modules $R/node_modules
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
mk head at $T1 $T2 $T3
mk p1 p1 $T1
mk p2 p2 $T2
mk p3 p3 $T3
for n in head p1 p2 p3; do
  root=at; [ $n != head ] && root=$n
  (cd $R/$root/web && env -u GIT_DIR TZ=UTC NODE_OPTIONS="--require $G" $R/node_modules/.bin/vitest run --config $R/vitest.$n.mts --reporter=json --outputFile=$R/$n.json > $R/$n.log 2>&1) || true
  node -e "const r=require('$R/$n.json');console.log('$n',r.numPassedTests+'/'+r.numTotalTests);for(const f of r.testResults){const nm=f.name.split('/web/')[1];const fails=f.assertionResults.filter(a=>a.status==='failed');console.log('  file',nm,f.assertionResults.length,f.status,fails.length?'fails='+fails.length:'',(f.message||'').slice(0,140));for(const a of fails.slice(0,12))console.log('    FAIL',a.title.slice(0,110))}"
done
