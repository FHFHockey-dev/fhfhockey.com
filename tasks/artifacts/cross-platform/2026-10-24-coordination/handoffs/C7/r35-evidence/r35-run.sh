set -e
R=/private/tmp/c7-r35; S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7
G=$S/network-guard.cjs; REPO=/Users/tim/Code/fhfhockey.com
rm -rf $R; mkdir -p $R/at $R/p
git -C $REPO archive 7007a0527 web | tar -x -C $R/at
git -C $REPO archive e168c841c web | tar -x -C $R/p
TESTS="lib/projections/nativeInputEligibility.test.ts lib/projections/run-forge-projections.external-inputs.test.ts lib/projections/run-forge-projections.local-attempt.test.ts lib/projections/startChartPipeline.test.ts lib/projections/nativeGoalAccounting.test.ts lib/projections/runProjectionV2.test.ts"
for t in $TESTS; do git -C $REPO show 7007a0527:web/$t > $R/p/web/$t; done
for d in at p; do ln -s $REPO/web/node_modules $R/$d/web/node_modules; done
ln -s $REPO/web/node_modules $R/node_modules
mkdir -p $R/at/web/lib/projections/c7; cp $S/r35Forge.test.ts $R/at/web/lib/projections/c7/
mk() { name=$1; root=$2; shift 2; inc=""; for t in "$@"; do inc="$inc\"$R/$root/web/$t\", "; done
cat > $R/vitest.$name.mts <<EOF
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "$R/$root/web";
export default defineConfig({ root: M, cacheDir: "$R/cache-$name", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "node", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: [$inc], maxWorkers: 2, testTimeout: 120000 } });
EOF
}
mk head at $TESTS
mk p p $TESTS
mk c7 at lib/projections/c7/r35Forge.test.ts
for n in head p c7; do
  (cd $R/$( [ $n = p ] && echo p || echo at )/web && env -u GIT_DIR TZ=UTC NODE_OPTIONS="--require $G" $R/node_modules/.bin/vitest run --config $R/vitest.$n.mts --reporter=json --outputFile=$R/$n.json > $R/$n.log 2>&1) || true
  node -e "const r=require('$R/$n.json');console.log('$n',r.numPassedTests+'/'+r.numTotalTests);for(const f of r.testResults){const nm=f.name.split('/web/')[1];console.log('  file',nm,f.assertionResults.length,f.status,(f.message||'').slice(0,160));for(const a of f.assertionResults)if(a.status==='failed')console.log('    FAIL',a.title.slice(0,120))}"
done
