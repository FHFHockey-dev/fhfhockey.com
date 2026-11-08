#!/bin/bash
# Pager recapture for Codex's reviewer: a clean copy at the pinned fix SHA, one real calendar read, then a replay of the retained real editions on port 3125.
set -u
PIN=e152ce5bca1aa77e29a43acd33eb7e9ae0d0ac62
SP=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/799e2b6c-f303-4317-8af1-8a92ac6bcb75/scratchpad
D=$SP/pager-${PIN:0:9}
O=/Users/tim/Code/fhfhockey.com/tasks/artifacts/social-share-expansion-2026-10-31/pager-review-20261101/recapture-e152ce5bc
mkdir -p $O/inputs
[ -d $D ] || { git clone -q --shared --no-checkout /Users/tim/Code/fhfhockey.com $D && git -C $D checkout -q $PIN; } || exit 1
cd $D/web || exit 1
[ -e node_modules ] || ln -s /Users/tim/Code/fhfhockey.com/web/node_modules node_modules
echo HEAD=$(git rev-parse HEAD); echo DIRTY=$(git status --short | wc -l)
cp $SP/real30/*.json $O/inputs/
ln -sf /Users/tim/Code/fhfhockey.com/web/.env.local .env.local
cp $SP/rr31.test.ts __calendar.test.ts
PIN=$PIN npx vitest run __calendar.test.ts 2>&1 | grep -E 'Tests |FAIL|Error' | head -5
rm -f __calendar.test.ts .env.local
python3 -c "import json;p=json.load(open('$O/calendar-provenance.json'));print('CAL rows',p['rows'],'cutoff',p['liveCutoff'],'requests',[(r['path'],r['status'],r['range']) for r in p['requests']])"
export NEXT_PUBLIC_SUPABASE_URL=http://supabase.e2e.invalid NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=e2e-fictional NEXT_PUBLIC_SUPABASE_ANON_KEY=e2e-fictional SUPABASE_SERVICE_ROLE_KEY=e2e-fictional PLAYWRIGHT_PORT=3125 PLAYWRIGHT_ISOLATED_NEXT=1
cp $SP/rr31.spec.ts e2e/zz-pager-recapture.spec.ts
npx playwright test e2e/zz-pager-recapture.spec.ts --workers=1 2>&1 | grep -vE WebServer | tail -25 | cut -c1-200
rm -f e2e/zz-pager-recapture.spec.ts
cp $SP/rr31.test.ts $SP/rr31.spec.ts $SP/run31.sh $O/
cd $O && shasum -a 256 inputs/*.json calendar-response.json calendar-provenance.json render-report.json rr31.test.ts rr31.spec.ts run31.sh > SHA256SUMS
echo DONE
