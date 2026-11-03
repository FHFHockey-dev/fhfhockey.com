set -e
R=/private/tmp/c7-r41; S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7
G=$S/network-guard.cjs; REPO=/Users/tim/Code/fhfhockey.com
A=tasks/artifacts/projection-table-audit-2026-10-26
mkdir -p $R/p2 $R/p6 $R/p1
git -C $REPO archive 5a19f1def $A | tar -x -C $R/at
git -C $REPO archive 82490cd45 web | tar -x -C $R/p2
git -C $REPO archive 978134e22 web | tar -x -C $R/p6
git -C $REPO archive 00d375839 web $A | tar -x -C $R/p1
T2="web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts web/lib/rosterScheduleOptimizer/planning.test.ts"
T6="web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx web/lib/rosterScheduleOptimizer/dailyAcceptance.e2e.test.ts"
T1="web/lib/projections/externalInputProof.test.ts web/lib/projections/forgeProducerIdentity.test.ts web/lib/projections/verifiedForgeReleases.test.ts web/lib/projections/apiHelpers.runAdmission.test.ts web/lib/projections/releasedRunFence.test.ts web/__tests__/pages/api/v1/forge/players.test.ts web/__tests__/pages/api/v1/projections/explicitRunAdmission.test.ts"
for f in $T2; do git -C $REPO show 978134e22:$f > $R/p2/$f; done
for f in $T6; do git -C $REPO show 00d375839:$f > $R/p6/$f; done
for f in $T1 web/lib/projections/externalInputProof.fixtures.ts; do git -C $REPO show 5a19f1def:$f > $R/p1/$f; done
for f in $A/release-verification/538100d41ee87e721d2764b694f7bac8c2f2bb34.json $A/release-verification/bd337d97aefd959832b3466037d163f320a23d99.json $A/release-verification/closure-0e9876269d5dd645c7c7f7ec02373fda81d7021f9e8b3b11bad9342a4d4f8e4f.json; do git -C $REPO show 5a19f1def:$f > $R/p1/$f; done
for d in p2 p6 p1; do ln -s $REPO/web/node_modules $R/$d/web/node_modules; done
test -e $R/node_modules || ln -s $REPO/web/node_modules $R/node_modules
mkdir -p $R/at/web/lib/projections/c7; cp $S/r41Identity.test.ts $R/at/web/lib/projections/c7/
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
mk head at $T2 $T6 $T1
mk p2 p2 $T2
mk p6 p6 $T6
mk p1 p1 $T1
mk c7 at web/lib/projections/c7/r41Identity.test.ts
for n in head p2 p6 p1 c7; do
  root=at; case $n in p2|p6|p1) root=$n;; esac
  (cd $R/$root/web && env -u GIT_DIR -u FORGE_PRODUCER_CLOSURE_SHA256 TZ=UTC NODE_OPTIONS="--require $G" $R/node_modules/.bin/vitest run --config $R/vitest.$n.mts --reporter=json --outputFile=$R/$n.json > $R/$n.log 2>&1) || true
  node -e "const r=require('$R/$n.json');console.log('$n',r.numPassedTests+'/'+r.numTotalTests,'skipped',r.numPendingTests);for(const f of r.testResults){const nm=f.name.split('/web/')[1];const fails=f.assertionResults.filter(a=>a.status==='failed');console.log('  file',nm,f.assertionResults.length,f.status,fails.length?'fails='+fails.length:'',(f.message||'').slice(0,140));for(const a of fails.slice(0,14))console.log('    FAIL',a.title.slice(0,110))}"
done
