#!/bin/bash
# S09 heavy job: full typechecks and before/after compile builds, serialized by the shared lock.
set -u
ROOT=/Users/tim/Code/fhfhockey.com
A=$ROOT/tasks/artifacts/independent-audit-2026-10-17/s09
SP=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/07af8563-720f-4ee1-b4b7-94bde0242340/scratchpad
INCL=(--include=web/components/HomePage/homepageGameFormatting.ts --include=web/components/HomePage/HomepageStandingsInjuriesSection.tsx --include=web/components/HomePage/HomepageGamesSection.tsx --include=web/pages/index.tsx)
build() {
  (cd $ROOT/web && PLAYWRIGHT_ISOLATED_NEXT=1 PRESERVE_NEXT_DIST=1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=6144 /usr/bin/time -p ./node_modules/.bin/next build --experimental-build-mode=compile --no-lint > "$SP/s09-build-$1.log" 2>&1; echo "build $1 exit=$?")
  python3 -I $ROOT/tasks/artifacts/independent-audit-2026-10-17/data/first_load.py $ROOT/web/.next-playwright > "$A/first-load-$1.tsv" 2>/dev/null
  cp $ROOT/web/.next-playwright/build-manifest.json "$SP/s09-manifest-$1.json"
}
until mkdir /private/tmp/fhfh-heavy.lock 2>/dev/null; do sleep 30; done
echo "lock acquired $(date -u +%FT%TZ)"
cd $ROOT/web
/usr/bin/time -p npx tsc --noEmit > $SP/s09-tsc-default.log 2>&1; echo "default tsc exit=$?"
/usr/bin/time -p npm run typecheck > $SP/s09-tsc-script.log 2>&1; echo "npm run typecheck exit=$?"
cd $ROOT
git apply -R "${INCL[@]}" $A/s09-a-homepage-without-moment-timezone.diff && echo "S09-A temporarily reversed"
build before
git apply "${INCL[@]}" $A/s09-a-homepage-without-moment-timezone.diff && echo "S09-A re-applied"
git apply -R --check $A/s09-a-homepage-without-moment-timezone.diff && echo "S09-A present exactly"
build after
rc=0
rmdir /private/tmp/fhfh-heavy.lock; echo "lock released $(date -u +%FT%TZ)"
exit $rc
