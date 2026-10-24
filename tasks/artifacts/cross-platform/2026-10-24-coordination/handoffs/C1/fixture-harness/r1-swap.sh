#!/bin/bash
set -u
D=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/fb396c5b-c484-492b-998f-edb1e746ad37/scratchpad/c1
F=components/LineCombinations/LineCombinationsGrid.tsx
cp "$F" "$D/r1-grid.tsx" || exit 1
H=$(shasum -a 256 "$F" | cut -d' ' -f1)
cp "$D/s06-candidate/$F" "$F"
npx vitest run components/TeamTabNavigation/TeamTabNavigation.test.tsx -t "mixed line shapes" 2>&1 | grep -E "^ +(✓|×|↓)|Tests " > "$D/r1-against-s06-run.txt"
cp "$D/r1-grid.tsx" "$F"
[ "$(shasum -a 256 "$F" | cut -d' ' -f1)" = "$H" ] && echo "restored OK $H"
