#!/bin/zsh
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE PGHOST PGPORT DATABASE_URL
W=/private/tmp/blsh-pilot-x; E=$W/evidence; G=$W/gate; X=b5e18f49078addde4bda3e5679e5602f8ed58393
cd $G; [ "$(git rev-parse HEAD)" = $X ] && [ -z "$(git status --porcelain --untracked-files=no)" ] && echo "HEAD=X clean" > $E/head-check.txt || { echo "HEAD/clean check FAILED" > $E/head-check.txt; exit 1; }
echo "== pg15"; (cd tasks/artifacts/blsh-replay-2026-11-20/live-pilot-20261121/redate-20261123 && timeout 900 python3 -I -B pg15-validate.py > $E/pg15-validate-on-X.out 2>&1; echo "exit $?" >> $E/pg15-validate-on-X.out); tail -2 $E/pg15-validate-on-X.out
diff <(grep -v "^ALL" tasks/artifacts/blsh-replay-2026-11-20/live-pilot-20261121/redate-20261123/pg15-validate.out) <(grep -v -E "^(ALL|exit )" $E/pg15-validate-on-X.out) > $E/pg15-diff-vs-committed.txt && echo "pg15 identical to committed .out" >> $E/pg15-diff-vs-committed.txt
echo "== official_pilot.py"; (timeout 600 python3 -B supabase/tests/blsh_official_pilot.py > $E/blsh_official_pilot.out 2>&1; echo "exit $?" >> $E/blsh_official_pilot.out); tail -3 $E/blsh_official_pilot.out
cd web
echo "== vitest focused"; timeout 900 npx vitest run lib/blsh scripts/blsh lib/cron __tests__/pages/api/v1/db/cron-audit-wrappers.test.ts > $E/vitest-focused.txt 2>&1; echo "vitest exit $?" >> $E/vitest-focused.txt; grep -E "Test Files|Tests " $E/vitest-focused.txt
echo "== vitest related"; timeout 900 npx vitest related --run lib/blsh/nativeCaptureV6/officialPilotHandler.ts lib/blsh/nativeCaptureV6/officialPilotStore.ts lib/blsh/nativeCaptureV6/officialPilotAcquisition.ts scripts/blsh/readHostedOfficialV6.mjs scripts/blsh/prepareV6ObservationCapture.testHelper.ts lib/blsh/nativeCaptureV6/officialPilotHandler.testHelper.ts lib/cron/nstClassification.ts lib/cron/nstCoordination.ts > $E/vitest-related.txt 2>&1; echo "vitest exit $?" >> $E/vitest-related.txt; grep -E "Test Files|Tests " $E/vitest-related.txt
echo "== bootstrap test on master 523ba0108 tree for comparison is separate"
echo "== typecheck"; timeout 1200 npm run typecheck > $E/typecheck.txt 2>&1; echo "typecheck exit $?" >> $E/typecheck.txt; tail -1 $E/typecheck.txt
echo "== lint"; timeout 1200 npm run lint > $E/eslint.txt 2>&1; echo "eslint exit $?" >> $E/eslint.txt; tail -1 $E/eslint.txt
echo "== css"; node $W/css-pure-check.cjs $G/web > $E/css-pure-check.json 2>&1; echo "css exit $?"; head -4 $E/css-pure-check.json
echo "== source pins"; cd $G; node -e '
const {execFileSync}=require("child_process");const {createHash}=require("crypto");const fs=require("fs");
const src=fs.readFileSync("web/scripts/blsh/reviewNativeV6Packet.mjs","utf8");
const pins=Function("return "+src.match(/const SOURCE_PINS = (\{[\s\S]*?\});/)[1])();
const out={commit:process.argv[1],results:[]};
for(const [p,d] of Object.entries(pins)){const b=execFileSync("git",["--no-replace-objects","--no-lazy-fetch","cat-file","blob",process.argv[1]+":"+p],{cwd:process.argv[2],maxBuffer:1<<20});
out.results.push({path:p,ok:createHash("sha256").update(b).digest("hex")===d});}
out.passed=out.results.filter(r=>r.ok).length+"/"+out.results.length;console.log(JSON.stringify(out,null,1));' $X /Users/tim/Code/fhfhockey.com > $E/source-pins.json; grep passed $E/source-pins.json
echo "== DONE"
