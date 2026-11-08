set -e
R=/private/tmp/c7-r44; S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7
G=$S/network-guard.cjs; REPO=/Users/tim/Code/fhfhockey.com; A=tasks/artifacts/projection-table-audit-2026-10-26
test ! -e $R; mkdir -p $R/at $R/p $R/rc
git -C $REPO archive b9206fe31 web supabase $A | tar -x -C $R/at
git -C $REPO archive ad079935e web supabase $A | tar -x -C $R/p
git -C $REPO archive efb36e908 web | tar -x -C $R/rc
for d in at p rc; do ln -s $REPO/web/node_modules $R/$d/web/node_modules; done; ln -s $REPO/web/node_modules $R/node_modules
for d in at rc; do (cd $R/$d/web && env -u GIT_DIR NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/forge-producer-closure.ts --json > $R/closure-$d.json)
  node -e "const d=require('$R/closure-$d.json');console.log('closure $d',d.closureSha256,d.modules.length,'findings',d.findings.length)"; done
printf "receipt 6fb1812c1.json sha256 "; shasum -a 256 $R/at/$A/release-verification/6fb1812c19ecd182e895b3708296018bc842fcf0.json | cut -c1-64
python3 -I -c "import json;d=json.load(open('$R/at/$A/release-verification/6fb1812c19ecd182e895b3708296018bc842fcf0.json'));print(d['sha'],d['verified'],len(d['findings']),d['producerIdentity'],d['closure']['moduleCount'],d.get('source'))"
T="web/lib/projections/externalInputProof.test.ts web/lib/projections/verifiedForgeReleases.test.ts web/lib/projections/forgeProducerIdentity.test.ts web/lib/projections/releasedRunFence.test.ts web/lib/projections/apiHelpers.runAdmission.test.ts web/lib/rosterScheduleData/forgeDailyBridge.test.ts web/__tests__/pages/api/v1/forge/players.test.ts web/__tests__/pages/api/v1/forge/goalies.test.ts web/__tests__/pages/api/v1/projections/explicitRunAdmission.test.ts web/lib/game-predictions/featureBuilder.test.ts web/lib/game-predictions/publicPredictions.test.ts web/lib/game-predictions/workflow.test.ts"
for f in web/lib/projections/externalInputProof.test.ts; do git -C $REPO show b9206fe31:$f > $R/p/$f; done
mkdir -p $R/at/web/lib/projections/c7; cp $S/r44Resume.test.ts $R/at/web/lib/projections/c7/
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
mk head at $T
mk p p web/lib/projections/externalInputProof.test.ts
mk c7 at web/lib/projections/c7/r44Resume.test.ts
mk rc rc web/lib/projections/verifiedForgeReleases.test.ts web/lib/projections/externalInputProof.test.ts
for n in head p c7 rc; do
  root=at; case $n in p) root=p;; rc) root=rc;; esac
  (cd $R/$root/web && env -u GIT_DIR -u FORGE_CODE_VERSION -u FORGE_RESERVE_PASS_ENABLED -u GAME_PREDICTIONS_REQUIRE_FORGE_PROOF TZ=UTC NODE_OPTIONS="--require $G" $R/node_modules/.bin/vitest run --config $R/vitest.$n.mts --reporter=json --outputFile=$R/$n.json > $R/$n.log 2>&1) || true
  node -e "const r=require('$R/$n.json');console.log('$n',r.numPassedTests+'/'+r.numTotalTests,'skipped',r.numPendingTests);for(const f of r.testResults){const nm=f.name.split('/web/')[1];const fails=f.assertionResults.filter(a=>a.status==='failed');console.log('  file',nm,f.assertionResults.length,f.status,fails.length?'fails='+fails.length:'',(f.message||'').slice(0,120));for(const a of fails.slice(0,8))console.log('    FAIL',a.title.slice(0,100),'::',(a.failureMessages[0]||'').split('\n')[0].slice(0,140))}"
done
