set -e
R=/private/tmp/c7-r43; S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7
G=$S/network-guard.cjs; REPO=/Users/tim/Code/fhfhockey.com; A=tasks/artifacts/projection-table-audit-2026-10-26
mkdir -p $R/pres $R/pfix
git -C $REPO archive 595ab13d9 web | tar -x -C $R/pres
git -C $REPO archive 074694095 web supabase $A | tar -x -C $R/pfix
TR="web/lib/projections/reserveProjections.test.ts web/lib/projections/run-forge-projections.local-attempt.test.ts web/lib/rosterScheduleData/forgeDailyBridge.test.ts web/lib/rosterScheduleData/forgeReservePayload.test.ts"
TF="web/lib/projections/externalInputProof.test.ts web/lib/projections/verifiedForgeReleases.test.ts web/lib/game-predictions/featureBuilder.test.ts web/lib/game-predictions/publicPredictions.test.ts web/lib/game-predictions/workflow.test.ts"
for f in $TR web/lib/rosterScheduleData/forgeReservePayload.fixture.ts; do git -C $REPO show 074694095:$f > $R/pres/$f; done
for f in $TF web/lib/projections/externalInputProof.fixtures.ts $A/release-verification/595ab13d9773808057b49cc3ed91d9eaca8ed317.json; do git -C $REPO show 6fb1812c1:$f > $R/pfix/$f; done
for d in pres pfix; do ln -s $REPO/web/node_modules $R/$d/web/node_modules; done
# Flag-off regression: the parent's bridge tests against the commit's bridge code
mkdir -p $R/res/web/lib/rosterScheduleData/c7
git -C $REPO show 595ab13d9:web/lib/rosterScheduleData/forgeDailyBridge.test.ts | sed 's#from "\./#from "../#g' > $R/res/web/lib/rosterScheduleData/c7/forgeDailyBridge.parent.test.ts
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
mk head at $TR $TF
mk pres pres $TR
mk pfix pfix $TF
mk flagoff res web/lib/rosterScheduleData/c7/forgeDailyBridge.parent.test.ts
for n in head pres pfix flagoff; do
  root=at; case $n in pres) root=pres;; pfix) root=pfix;; flagoff) root=res;; esac
  (cd $R/$root/web && env -u GIT_DIR -u FORGE_RESERVE_PASS_ENABLED -u GAME_PREDICTIONS_REQUIRE_FORGE_PROOF TZ=UTC NODE_OPTIONS="--require $G" $R/node_modules/.bin/vitest run --config $R/vitest.$n.mts --reporter=json --outputFile=$R/$n.json > $R/$n.log 2>&1) || true
  node -e "const r=require('$R/$n.json');console.log('$n',r.numPassedTests+'/'+r.numTotalTests,'skipped',r.numPendingTests);for(const f of r.testResults){const nm=f.name.split('/web/')[1];const fails=f.assertionResults.filter(a=>a.status==='failed');console.log('  file',nm,f.assertionResults.length,f.status,fails.length?'fails='+fails.length:'',(f.message||'').slice(0,140));for(const a of fails.slice(0,12))console.log('    FAIL',a.title.slice(0,110))}"
done
