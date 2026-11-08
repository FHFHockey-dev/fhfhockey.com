#!/bin/zsh
set -u
unset GIT_DIR GIT_INDEX_FILE
S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/6f186a08-cdb5-482f-b201-f63b07400eb0/scratchpad
R=/Users/tim/Code/fhfhockey.com
C=42ff0cd2b19859b11e94b51f4fc7131a7b30947a
X=$S/rc-export; O=$S/rc-gate; mkdir -p $O
rm -rf $X && mkdir -p $X
git -C $R archive $C | tar -x -C $X
ln -s $R/web/node_modules $X/web/node_modules
cd $X/web
echo "export sha check: $(git -C $R rev-parse $C^{tree})" > $O/summary.txt
# heavy lock (noclobber)
until ( set -o noclobber; echo "tuesday-rc chef $$ $(date -u +%FT%TZ)" > /private/tmp/fhfh-heavy.lock ) 2>/dev/null; do sleep 15; done
trap 'rm -f /private/tmp/fhfh-heavy.lock' EXIT
node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit -p tsconfig.json > $O/tsc.log 2>&1; echo "tsc exit $?" >> $O/summary.txt
npx eslint lib/socialShare components/SocialShare e2e/social-share.spec.ts > $O/eslint.log 2>&1; echo "eslint(changed dirs) exit $?" >> $O/summary.txt
node $R/tasks/artifacts/today-plan-2026-10-25/C2/qa/pure-check.cjs components/SocialShare/SocialShare.module.scss > $O/css.log 2>&1; echo "css pure exit $? :: $(cat $O/css.log | head -1)" >> $O/summary.txt
npx vitest run lib/socialShare components/SocialShare > $O/vitest-social.log 2>&1; echo "vitest social exit $? :: $(rg 'Tests ' $O/vitest-social.log | tail -1)" >> $O/summary.txt
npx vitest run > $O/vitest-full.log 2>&1; echo "vitest full exit $? :: $(rg 'Tests |Test Files ' $O/vitest-full.log | tail -2 | tr '\n' ' ')" >> $O/summary.txt
npx playwright test e2e/social-share.spec.ts --list > $O/e2e-list.log 2>&1; echo "e2e list exit $? :: $(tail -1 $O/e2e-list.log)" >> $O/summary.txt
echo done >> $O/summary.txt
