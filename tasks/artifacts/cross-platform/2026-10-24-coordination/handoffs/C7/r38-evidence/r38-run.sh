set -e
R=/private/tmp/c7-r38; S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7
G=$S/network-guard.cjs; REPO=/Users/tim/Code/fhfhockey.com; C=5356dc616
rm -rf $R; mkdir -p $R/at
git -C $REPO archive $C web | tar -x -C $R/at
ln -s $REPO/web/node_modules $R/at/web/node_modules; ln -s $REPO/web/node_modules $R/node_modules
T=$R/at/web/__tests__/components/RosterScheduleOptimizer; COMP=$R/at/web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx
python3 -I $S/r38-controls.py $T/RosterScheduleOptimizer.test.tsx $T/RosterScheduleOptimizer.c7.test.tsx
cp $COMP $R/component.head.tsx
git -C $REPO show $C^:web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx > $R/component.parent.tsx
cat > $R/vitest.mts <<EOF
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "$R/at/web";
export default defineConfig({ root: M, cacheDir: "$R/cache", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: [process.env.C7_TEST!], maxWorkers: 1, testTimeout: 120000 } });
EOF
run() { name=$1; comp=$2; test=$3; filter=$4; cp $comp $COMP
  (cd $R/at/web && env -u GIT_DIR TZ=UTC C7_TEST=$test NODE_OPTIONS="--require $G" $R/node_modules/.bin/vitest run --config $R/vitest.mts ${filter:+-t "$filter"} --reporter=json --outputFile=$R/$name.json > $R/$name.log 2>&1) || true
  node -e "const r=require('$R/$name.json');console.log('$name',r.numPassedTests+'/'+r.numTotalTests, 'skipped', r.numPendingTests);for(const f of r.testResults){if(f.status==='failed'&&!f.assertionResults.length)console.log('  LOADFAIL',f.message.slice(0,200));for(const a of f.assertionResults)if(a.status==='failed')console.log('    FAIL',a.title.slice(0,120))}"
  grep -ho "C7R38 [^\"]*providerCalls=[0-9]*" $R/$name.log | sort -u || true; }
run head $R/component.head.tsx $T/RosterScheduleOptimizer.test.tsx
run parent $R/component.parent.tsx $T/RosterScheduleOptimizer.test.tsx
run c7head $R/component.head.tsx $T/RosterScheduleOptimizer.c7.test.tsx "C7"
run c7parent $R/component.parent.tsx $T/RosterScheduleOptimizer.c7.test.tsx "C7"
cp $R/component.head.tsx $COMP
