set -e
R=/private/tmp/c7-r48; S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7
G=$S/network-guard.cjs; REPO=/Users/tim/Code/fhfhockey.com
test ! -e $R; mkdir -p $R/at $R/pp $R/pr
git -C $REPO archive 02153acba web | tar -x -C $R/at
git -C $REPO archive 2d1798003 web | tar -x -C $R/pp
git -C $REPO archive 9b462e9c95209c409ed0faf4fe0c9537e02ab031 web | tar -x -C $R/pr
for d in at pp pr; do ln -s $REPO/web/node_modules $R/$d/web/node_modules; done; ln -s $REPO/web/node_modules $R/node_modules
for d in at pp; do (cd $R/$d/web && env -u GIT_DIR NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/forge-producer-closure.ts --json > $R/closure-$d.json)
  node -e "const d=require('$R/closure-$d.json');console.log('closure $d',d.closureSha256,d.modules.length,'findings',d.findings.length,'runner in closure',d.modules.includes('pages/db/runner.tsx'))"; done
git -C $REPO show 02153acba:web/lib/projections/verifiedForgeReleases.ts | grep -o 'closureSha256: "[0-9a-f]*"'
TP="web/__tests__/pages/api/v1/db/run-projection-v2.preflight.test.ts"
TR="web/__tests__/pages/db/runner.test.tsx"
git -C $REPO show 02153acba:$TP > $R/pp/$TP
git -C $REPO show 2d1798003:$TR > $R/pr/$TR
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
mk head at $TP $TR web/__tests__/pages/api/v1/db/run-projection-v2.test.ts web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts
mk pp pp $TP
mk pr pr $TR
for n in head pp pr; do
  root=at; case $n in pp|pr) root=$n;; esac
  (cd $R/$root/web && env -u GIT_DIR TZ=UTC NODE_OPTIONS="--require $G" $R/node_modules/.bin/vitest run --config $R/vitest.$n.mts --reporter=json --outputFile=$R/$n.json > $R/$n.log 2>&1) || true
  node -e "const r=require('$R/$n.json');console.log('$n',r.numPassedTests+'/'+r.numTotalTests,'skipped',r.numPendingTests);for(const f of r.testResults){const nm=f.name.split('/web/')[1];const fails=f.assertionResults.filter(a=>a.status==='failed');console.log('  file',nm,f.assertionResults.length,f.status,fails.length?'fails='+fails.length:'',(f.message||'').slice(0,120));for(const a of fails.slice(0,10))console.log('    FAIL',a.title.slice(0,110))}"
done
