#!/bin/sh
# RECHECK-6: does G3 execute code from the tree it hashes? Builds a scratch web root (copies of the 42 closure package
# dirs + web/package.json + the v5 scripts/blsh and lib/{nst,cron}), then runs the UNCHANGED operator tool against it:
#   control   - unmodified copy                         -> expect match
#   undici    - comment appended to undici/index.js     -> expect refuse changed:node_modules/undici
#   tsforged  - forged-output prologue in typescript.js -> does G3 still print match?
# Usage: sh g3-self-check.sh <scratch>   (nothing outside <scratch> is written)
set -u
S=$1; W=/Users/tim/Code/fhfhockey.com/web; O=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15
BASE=$O/evidence/DEPENDENCY-TREE-BASELINE.json
mk() { R=$S/$1/web; rm -rf "$S/$1"; mkdir -p "$R/node_modules" "$R/scripts" "$R/lib"
  cp $W/package.json $W/tsconfig.json "$R/"; cp -R $W/scripts/blsh "$R/scripts/"; cp -R $W/lib/nst $W/lib/cron "$R/lib/"
  python3 -I -c "import json;[print(p['path']) for p in json.load(open('$BASE'))['packages']]" | while read p; do
    mkdir -p "$R/$p"; (cd "$W/$p" && find . -path ./node_modules -prune -o \( -type f -o -type l \) -print | cpio -pdm "$R/$p" 2>/dev/null); done; }
run() { (cd "$S" && env -i PATH=/usr/bin:/bin TMPDIR="$S/tmp" /usr/local/bin/node $O/tools/dependency-tree-hash.mjs --web "$S/$1/web" --baseline $BASE | cut -c1-260); echo "  [$1 exit=$?]"; }
mkdir -p "$S/tmp"
mk control; run control
mk undici; printf '\n// reviewer drift\n' >> "$S/undici/web/node_modules/undici/index.js"; run undici
mk tsforged; F="$S/tsforged/web/node_modules/typescript/lib/typescript.js"
{ printf '%s\n' 'if ((process.argv[1] || "").endsWith("dependency-tree-hash.mjs")) { process.stdout.write(JSON.stringify({ dependencyTree: "match", treeSHA256: "76c7d466725ea13208b87adfb5ac6688a42454b66382996fbd9a7ab36432473a", baselineTreeSHA256: "76c7d466725ea13208b87adfb5ac6688a42454b66382996fbd9a7ab36432473a", loaded: { files: 256, uncovered: [] }, differences: [], forgedBy: "typescript.js" }) + "\n"); process.exit(0); }'; cat "$F"; } > "$F.new" && mv "$F.new" "$F"
run tsforged
