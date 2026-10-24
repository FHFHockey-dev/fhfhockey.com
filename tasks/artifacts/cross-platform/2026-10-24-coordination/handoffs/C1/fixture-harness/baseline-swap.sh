#!/bin/bash
set -u
S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/fb396c5b-c484-492b-998f-edb1e746ad37/scratchpad/c1/candidate
FILES=("pages/stats/team/[teamAbbreviation].tsx" components/LineCombinations/LineCombinationsGrid.tsx hooks/useShotData.ts components/ShotVisualization/ShotVisualization.tsx components/TeamTabNavigation/TeamTabNavigation.tsx)
mkdir -p "$S"
for f in "${FILES[@]}"; do mkdir -p "$S/$(dirname "$f")"; cp "$f" "$S/$f" || exit 1; done
shasum -a 256 "${FILES[@]}" > "$S/candidate.sha" || exit 1
for f in "${FILES[@]}"; do git show "HEAD:web/$f" > "$f"; done
npx vitest run hooks/useShotData.test.tsx components/TeamTabNavigation/TeamTabNavigation.test.tsx 2>&1 | grep -E "^ +(✓|×)|Tests " > "$S/../baseline-run.txt"
for f in "${FILES[@]}"; do cp "$S/$f" "$f"; done
shasum -a 256 -c "$S/candidate.sha"
