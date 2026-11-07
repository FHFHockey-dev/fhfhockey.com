set -e
R=/private/tmp/c7-r40b; S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7
G=$S/network-guard.cjs; REPO=/Users/tim/Code/fhfhockey.com
mkdir -p $R/p
git -C $REPO archive 3795abb43 web | tar -x -C $R/p
T="web/lib/projections/apiHelpers.runAdmission.test.ts web/lib/projections/externalInputProof.test.ts web/lib/projections/verifiedForgeReleases.test.ts web/lib/rosterScheduleData/forgeDailyBridge.test.ts"
for f in $T web/lib/projections/externalInputProof.fixtures.ts; do git -C $REPO show cd73cbd69:$f > $R/p/$f; done
ln -s $REPO/web/node_modules $R/p/web/node_modules
test -e $R/node_modules || ln -s $REPO/web/node_modules $R/node_modules
mkdir -p $R/at/web/lib/projections/c7; cp $S/r40Proof.test.ts $R/at/web/lib/projections/c7/
mk() { name=$1; root=$2; shift 2; inc=""; for t in "$@"; do inc="$inc\"$R/$root/$t\", "; done
cat > $R/vitest.$name.mts <<EOF
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "$R/$root/web";
export default defineConfig({ root: M, cacheDir: "$R/cache-$name", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "node", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: [$inc], maxWorkers: 2, testTimeout: 120000 } });
EOF
}
mk head at $T
mk p p $T
mk c7 at web/lib/projections/c7/r40Proof.test.ts
for n in head p c7; do
  root=at; [ $n = p ] && root=p
  (cd $R/$root/web && env -u GIT_DIR TZ=UTC NODE_OPTIONS="--require $G" $R/node_modules/.bin/vitest run --config $R/vitest.$n.mts --reporter=json --outputFile=$R/$n.json > $R/$n.log 2>&1) || true
  node -e "const r=require('$R/$n.json');console.log('$n',r.numPassedTests+'/'+r.numTotalTests);for(const f of r.testResults){const nm=f.name.split('/web/')[1];const fails=f.assertionResults.filter(a=>a.status==='failed');console.log('  file',nm,f.assertionResults.length,f.status,fails.length?'fails='+fails.length:'',(f.message||'').slice(0,140));for(const a of fails.slice(0,20))console.log('    FAIL',a.title.slice(0,110))}"
done
