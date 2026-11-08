set -e
R=/private/tmp/c7-r37; S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7
G=$S/network-guard.cjs; REPO=/Users/tim/Code/fhfhockey.com; C=8b1b17828
rm -rf $R; mkdir -p $R/at
git -C $REPO archive $C web | tar -x -C $R/at
ln -s $REPO/web/node_modules $R/at/web/node_modules; ln -s $REPO/web/node_modules $R/node_modules
W=$R/at/web/components
python3 -I $S/r37-controls.py $W/StarterBoardYahoo.test.tsx $W/StarterBoardYahoo.c7.test.tsx
cp $W/StarterBoardYahoo.tsx $R/component.head.tsx
git -C $REPO show $C^:web/components/StarterBoardYahoo.tsx > $R/component.parent.tsx
# mutation A: never clear; mutation B: always treat a failure as denied
sed 's/if (denied) setData(null); //' $R/component.head.tsx > $R/component.mutA.tsx
sed 's/denied = response.status === 401 || response.status === 403;/denied = true;/' $R/component.head.tsx > $R/component.mutB.tsx
cmp -s $R/component.head.tsx $R/component.mutA.tsx && { echo "mutA did not apply"; exit 1; }
cmp -s $R/component.head.tsx $R/component.mutB.tsx && { echo "mutB did not apply"; exit 1; }
cat > $R/vitest.mts <<EOF
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "$R/at/web";
export default defineConfig({ root: M, cacheDir: "$R/cache", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: [process.env.C7_TEST!], maxWorkers: 1, testTimeout: 60000 } });
EOF
run() { name=$1; comp=$2; test=$3; cp $comp $W/StarterBoardYahoo.tsx
  (cd $R/at/web && env -u GIT_DIR TZ=UTC C7_TEST=$test NODE_OPTIONS="--require $G" $R/node_modules/.bin/vitest run --config $R/vitest.mts --reporter=json --outputFile=$R/$name.json > $R/$name.log 2>&1) || true
  node -e "const r=require('$R/$name.json');console.log('$name',r.numPassedTests+'/'+r.numTotalTests);for(const f of r.testResults){if(f.status==='failed'&&!f.assertionResults.length)console.log('  LOADFAIL',f.message.slice(0,200));for(const a of f.assertionResults)if(a.status==='failed')console.log('    FAIL',a.title.slice(0,110))}"; }
run head $R/component.head.tsx $W/StarterBoardYahoo.test.tsx
run parent $R/component.parent.tsx $W/StarterBoardYahoo.test.tsx
run mutA $R/component.mutA.tsx $W/StarterBoardYahoo.test.tsx
run mutB $R/component.mutB.tsx $W/StarterBoardYahoo.test.tsx
run c7 $R/component.head.tsx $W/StarterBoardYahoo.c7.test.tsx
cp $R/component.head.tsx $W/StarterBoardYahoo.tsx
