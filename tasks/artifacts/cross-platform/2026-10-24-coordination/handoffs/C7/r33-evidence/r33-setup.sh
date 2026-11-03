set -e
R=/private/tmp/c7-r33; D=$R/at/web/lib/rosterScheduleOptimizer
S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7
python3 -I $S/r33-controls.py "$D/dailyAcceptance.yahoo.test.ts" "$D/dailyAcceptance.yahoo.c7.test.ts"
# p3: provenance parent consumer, HEAD producer + HEAD tests
rm -rf $R/p3; cp -R $R/p2 $R/p3; rm $R/p3/web/node_modules; ln -s /Users/tim/Code/fhfhockey.com/web/node_modules $R/p3/web/node_modules
git -C /Users/tim/Code/fhfhockey.com show 46bc91caf:web/lib/projections/run-forge-projections.ts > $R/p3/web/lib/projections/run-forge-projections.ts
sed -e "s#$R/p2#$R/p3#g" -e "s#cache-p2#cache-p3#" $R/vitest.p2.mts | sed "s#include: \[.*\]#include: [\"$R/p3/web/lib/rosterScheduleData/planning.test.ts\"]#" > $R/vitest.p3.mts
sed -e "s#include: \[.*\]#include: [\"$D/dailyAcceptance.yahoo.c7.test.ts\"]#" -e "s#cache-head#cache-c7#" $R/vitest.head.mts > $R/vitest.c7.mts
grep -o "include: .*" $R/vitest.p3.mts $R/vitest.c7.mts
git -C /Users/tim/Code/fhfhockey.com show d9614eeaf:web/lib/rosterScheduleData/planning.ts | diff - $R/p3/web/lib/rosterScheduleData/planning.ts && echo "p3 consumer = parent"
G=$S/network-guard.cjs
cd $R
for n in p3 c7; do
  env -u GIT_DIR NODE_OPTIONS="--require $G" ./node_modules/.bin/vitest run --config $R/vitest.$n.mts --reporter=json --outputFile=$R/$n.json > $R/$n.log 2>&1 || true
  node -e "const r=require('$R/$n.json');console.log('$n',r.numPassedTests+'/'+r.numTotalTests);for(const f of r.testResults){if(f.status==='failed'&&!f.assertionResults.length)console.log('  LOADFAIL',f.message.slice(0,200));for(const a of f.assertionResults)if(a.status==='failed'||/C7|declared hashes|leaves both/.test(a.title))console.log('  ',a.status,a.title.slice(0,100))}"
done
