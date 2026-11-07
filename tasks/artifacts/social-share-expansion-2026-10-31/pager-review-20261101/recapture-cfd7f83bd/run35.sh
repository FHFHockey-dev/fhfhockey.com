#!/bin/bash
# Integrated pager recapture for Codex: the same scripts as run31/run32, at the integrated pin, with a fresh calendar read.
set -u
PIN=cfd7f83bddce17964671238efa72b704b7101227
SP=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/799e2b6c-f303-4317-8af1-8a92ac6bcb75/scratchpad
D=$SP/release-check-${PIN:0:9}
O=/Users/tim/Code/fhfhockey.com/tasks/artifacts/social-share-expansion-2026-10-31/pager-review-20261101/recapture-${PIN:0:9}
mkdir -p $O/inputs $O/inputs-regenerated
cd $D/web || exit 1
echo HEAD=$(git rev-parse HEAD); echo DIRTY=$(git status --short | wc -l) $(git status --short | head -2)
cp $SP/real30/*.json $O/inputs/; cp $SP/real31/*.json $O/inputs-regenerated/
ln -sf /Users/tim/Code/fhfhockey.com/web/.env.local .env.local
cp $SP/rr31.test.ts __calendar.test.ts
CAP_OUT=$O PIN=$PIN npx vitest run __calendar.test.ts 2>&1 | grep -E 'Tests |FAIL|Error' | head -5
rm -f __calendar.test.ts .env.local
python3 -c "import json;p=json.load(open('$O/calendar-provenance.json'));print('CAL rows',p['rows'],'cutoff',p['liveCutoff'],'sha',p['sha256'][:12],'requests',[(r['path'],r['status'],r['range']) for r in p['requests']])"
export NEXT_PUBLIC_SUPABASE_URL=http://supabase.e2e.invalid NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=e2e-fictional NEXT_PUBLIC_SUPABASE_ANON_KEY=e2e-fictional SUPABASE_SERVICE_ROLE_KEY=e2e-fictional PLAYWRIGHT_PORT=3125 PLAYWRIGHT_ISOLATED_NEXT=1
cp $SP/rr31.spec.ts e2e/zz-pager-recapture.spec.ts
CAL_DIR=$O RR_OUT=$O npx playwright test e2e/zz-pager-recapture.spec.ts --workers=1 2>&1 | grep -vE WebServer | grep -E '✘|^ +[0-9]+ (passed|failed)' | cut -c1-160
CAL_DIR=$O RR_OUT=$O RR_INPUTS=$SP/real31 RR_REPORT=render-report-regenerated.json RR_SUFFIX=-regenerated npx playwright test e2e/zz-pager-recapture.spec.ts --workers=1 2>&1 | grep -vE WebServer | grep -E '✘|^ +[0-9]+ (passed|failed)' | cut -c1-160
rm -f e2e/zz-pager-recapture.spec.ts
cp $SP/rr31.test.ts $SP/rr31.spec.ts $SP/run35.sh $O/
cd $O && shasum -a 256 inputs/*.json inputs-regenerated/*.json calendar-response.json calendar-provenance.json render-report.json render-report-regenerated.json rr31.test.ts rr31.spec.ts run35.sh > SHA256SUMS
echo DONE
