#!/bin/bash
set -u
cd /Users/tim/Code/fhfhockey.com/web
D=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/fb396c5b-c484-492b-998f-edb1e746ad37/scratchpad/c1
K="$D/s05-candidate"
FILES=(components/GoalieShareChart/index.tsx components/GoalieShareChart/GoalieShareChart.module.scss styles/Stats.module.scss)
for f in "${FILES[@]}"; do mkdir -p "$K/$(dirname "$f")"; cp "$f" "$K/$f" || exit 1; done
shasum -a 256 "${FILES[@]}" > "$K/candidate.sha" || exit 1
for f in "${FILES[@]}"; do git show "HEAD:web/$f" > "$f"; done
sleep 8  # let the dev server hot-reload the HEAD versions
cd "$D" && rm -rf shots-s05/before && node capture-s05.mjs before > shots-s05-before.json 2>&1; node fullpage-s05.mjs before >> shots-s05-before.json 2>&1
cd /Users/tim/Code/fhfhockey.com/web
for f in "${FILES[@]}"; do cp "$K/$f" "$f"; done
shasum -a 256 -c "$K/candidate.sha"
