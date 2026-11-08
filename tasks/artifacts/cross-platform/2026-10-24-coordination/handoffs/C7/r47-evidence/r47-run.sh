set -e
R=/private/tmp/c7-r47; S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7
G=$S/network-guard.cjs; REPO=/Users/tim/Code/fhfhockey.com; A=tasks/artifacts/projection-table-audit-2026-10-26
printf "receipt 5aa9ba5e0.json sha256 "; shasum -a 256 $R/rc/$A/release-verification/5aa9ba5e0e9e86abf515fd7a30db441f6f5b1592.json | cut -c1-64
git -C $REPO show da53bf311:web/lib/projections/verifiedForgeReleases.ts | grep -A3 '"87edd78f' | grep -E "commit|receiptSha256"
python3 -I -c "import json;d=json.load(open('$R/rc/$A/release-verification/5aa9ba5e0e9e86abf515fd7a30db441f6f5b1592.json'));print(d['sha'],d['verified'],len(d['findings']),d['producerIdentity'],d['closure']['moduleCount'],d.get('source'))"
printf "RC migrations: "; ls $R/rc/supabase/migrations | wc -l
mkdir -p $R/p; git -C $REPO archive 7723772111e1d1882dee784ceb626d1dde9fc5ac web | tar -x -C $R/p; ln -s $REPO/web/node_modules $R/p/web/node_modules
git -C $REPO show 605ecbb85:web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx > $R/p/web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx
T="web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts web/lib/rosterScheduleOptimizer/planning.test.ts web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts web/lib/rosterScheduleData/forgeDailyBridge.test.ts web/lib/rosterScheduleData/planning.test.ts web/__tests__/pages/api/v1/roster-schedule-optimizer/data.test.ts web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts web/lib/integrations/yahoo/rosterPlanning.test.ts web/lib/integrations/yahoo/yahooDiet.test.ts web/lib/projections/externalInputProof.test.ts web/lib/projections/verifiedForgeReleases.test.ts web/lib/supabase/supportedBaselineMigration.test.ts"
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
mk rc rc $T
mk p p web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx
for n in rc p; do
  (cd $R/$n/web && env -u GIT_DIR -u FORGE_PROJECTION_DAYS_AHEAD -u FORGE_RESERVE_PASS_ENABLED -u RSO_YAHOO_DIET TZ=UTC NODE_OPTIONS="--require $G" $R/node_modules/.bin/vitest run --config $R/vitest.$n.mts --reporter=json --outputFile=$R/$n.json > $R/$n.log 2>&1) || true
  node -e "const r=require('$R/$n.json');console.log('$n',r.numPassedTests+'/'+r.numTotalTests,'skipped',r.numPendingTests);for(const f of r.testResults){const nm=f.name.split('/web/')[1];const fails=f.assertionResults.filter(a=>a.status==='failed');if(fails.length||f.status==='failed')console.log('  file',nm,f.assertionResults.length,f.status,'fails='+fails.length,(f.message||'').slice(0,140));for(const a of fails.slice(0,8))console.log('    FAIL',a.title.slice(0,100),'::',(a.failureMessages[0]||'').split('\n')[0].slice(0,160))}"
done
