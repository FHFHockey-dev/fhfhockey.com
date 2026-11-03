#!/bin/bash
# Regenerates Busy/Quiet and Rescue at the pin (their retained editions predate adba00bba's min-starts setting), then replays them with the real calendar.
set -u
PIN=e152ce5bca1aa77e29a43acd33eb7e9ae0d0ac62
SP=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/799e2b6c-f303-4317-8af1-8a92ac6bcb75/scratchpad
D=$SP/pager-${PIN:0:9}
O=/Users/tim/Code/fhfhockey.com/tasks/artifacts/social-share-expansion-2026-10-31/pager-review-20261101/recapture-e152ce5bc
cd $D/web || exit 1
echo HEAD=$(git rev-parse HEAD); echo DIRTY=$(git status --short | wc -l)
ln -sf /Users/tim/Code/fhfhockey.com/web/.env.local .env.local
cp $SP/rr32.test.ts __regen.test.ts
npx vitest run __regen.test.ts --testTimeout=300000 2>&1 | grep -E 'Tests |FAIL|Error' | head -5
rm -f __regen.test.ts .env.local
python3 -c "
import json
for r in json.load(open('$SP/real31/summary.json')): print(r['name'],r['state'],r['ms'],r['requests'],r['errors'],r['reasons'],r['rows'])" | cut -c1-400
mkdir -p $O/inputs-regenerated; cp $SP/real31/*.json $O/inputs-regenerated/
export NEXT_PUBLIC_SUPABASE_URL=http://supabase.e2e.invalid NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=e2e-fictional NEXT_PUBLIC_SUPABASE_ANON_KEY=e2e-fictional SUPABASE_SERVICE_ROLE_KEY=e2e-fictional PLAYWRIGHT_PORT=3125 PLAYWRIGHT_ISOLATED_NEXT=1
cp $SP/rr31.spec.ts e2e/zz-pager-recapture.spec.ts
RR_INPUTS=$SP/real31 RR_REPORT=render-report-regenerated.json RR_SUFFIX=-regenerated npx playwright test e2e/zz-pager-recapture.spec.ts --workers=1 2>&1 | grep -vE WebServer | tail -6 | cut -c1-200
rm -f e2e/zz-pager-recapture.spec.ts
cp $SP/rr31.spec.ts $SP/rr32.test.ts $SP/run32.sh $O/
cd $O && shasum -a 256 inputs/*.json inputs-regenerated/*.json calendar-response.json calendar-provenance.json render-report.json render-report-regenerated.json rr31.test.ts rr31.spec.ts rr32.test.ts run31.sh run32.sh > SHA256SUMS
echo DONE
