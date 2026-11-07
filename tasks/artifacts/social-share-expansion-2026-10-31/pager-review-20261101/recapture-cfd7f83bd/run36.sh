#!/bin/bash
# Regenerates the three editions whose shape changed on 11-03 (Off-Night Edge, Risky Starts), at the pin, then replays them with the real calendar.
set -u
PIN=cfd7f83bddce17964671238efa72b704b7101227
SP=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/799e2b6c-f303-4317-8af1-8a92ac6bcb75/scratchpad
D=$SP/release-check-${PIN:0:9}
O=/Users/tim/Code/fhfhockey.com/tasks/artifacts/social-share-expansion-2026-10-31/pager-review-20261101/recapture-${PIN:0:9}
cd $D/web || exit 1
echo HEAD=$(git rev-parse HEAD)
ln -sf /Users/tim/Code/fhfhockey.com/web/.env.local .env.local
cp $SP/rr36.test.ts __regen.test.ts
npx vitest run __regen.test.ts --testTimeout=300000 2>&1 | grep -E 'Tests |FAIL|Error' | head -5
rm -f __regen.test.ts .env.local
python3 -c "
import json
for r in json.load(open('$SP/real36/summary.json')): print(r['name'],r['state'],r['ms'],'req',r['requests'],r['errors'])"
mkdir -p $O/inputs-regenerated-1103; cp $SP/real36/*.json $O/inputs-regenerated-1103/
export NEXT_PUBLIC_SUPABASE_URL=http://supabase.e2e.invalid NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=e2e-fictional NEXT_PUBLIC_SUPABASE_ANON_KEY=e2e-fictional SUPABASE_SERVICE_ROLE_KEY=e2e-fictional PLAYWRIGHT_PORT=3125 PLAYWRIGHT_ISOLATED_NEXT=1
cp $SP/rr31.spec.ts e2e/zz-pager-recapture.spec.ts
CAL_DIR=$O RR_OUT=$O RR_INPUTS=$SP/real36 RR_REPORT=render-report-regenerated-1103.json RR_SUFFIX=-regenerated npx playwright test e2e/zz-pager-recapture.spec.ts --workers=1 2>&1 | grep -vE WebServer | grep -E '✘|^ +[0-9]+ (passed|failed)' | cut -c1-160
rm -f e2e/zz-pager-recapture.spec.ts
cp $SP/rr36.test.ts $SP/run36.sh $O/
cd $O && shasum -a 256 inputs/*.json inputs-regenerated/*.json inputs-regenerated-1103/*.json calendar-response.json calendar-provenance.json render-report*.json rr31.test.ts rr31.spec.ts rr36.test.ts run35.sh run36.sh > SHA256SUMS
echo DONE
