#!/bin/sh
# RECHECK-7 probes (offline; writes only under <scratch>). Needs a scratch web root built by
# repro/recheck6/g3-self-check.sh <scratch-a> first (uses <scratch-a>/control as the clean copy).
# Usage: sh probes.sh <scratch-a> <scratch-out>
set -u
A=$1; S=$2; O=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15; BASE=$O/evidence/DEPENDENCY-TREE-BASELINE.json
# 1. Canary prologues in three closure packages the parent never runs; --loaded must refuse and no canary may fire.
rm -rf "$S/canary"; cp -R "$A/control" "$S/canary"; mkdir -p "$S/canary/tmp"
for f in node_modules/ts-node/dist/index.js node_modules/cheerio/dist/commonjs/index.js node_modules/undici/index.js; do
  F="$S/canary/web/$f"; { printf 'require("fs").writeFileSync("%s/CANARY-%s","ran");\n' "$S/canary" "$(basename "$(dirname "$f")")"; cat "$F"; } > "$F.n" && mv "$F.n" "$F"; done
(cd "$S/canary/web" && env -i PATH=/usr/bin:/bin TMPDIR="$S/canary/tmp" /usr/local/bin/node $O/tools/dependency-tree-hash.mjs --web "$S/canary/web" --baseline $BASE --loaded; echo "  node_exit=$?")
echo "  canaries fired: $(ls "$S/canary" | grep -c CANARY)"
# 2. SIP stripping: which launch paths let a DYLD_* key reach the process.
echo "  /bin/sh sees: $(DYLD_FOO=1 /bin/sh -c 'env | grep -c DYLD_')"
echo "  python3 sees: $(DYLD_FOO=1 /usr/bin/python3 -c 'import os;print([k for k in os.environ if k.startswith("DYLD_")])')"
echo "  node sees: $(DYLD_FOO=1 /usr/local/bin/node -e 'console.log(Object.keys(process.env).filter(k=>k.startsWith("DYLD_")))')"
echo "  env -i DYLD_FOO=1 node sees: $(/usr/bin/env -i DYLD_FOO=1 /usr/local/bin/node -e 'console.log(Object.keys(process.env).filter(k=>k.startsWith("DYLD_")))')"
# 3. G3 refuses a DYLD_* key in its own environment (canonical tree, read-only).
mkdir -p "$S/dyld/tmp"; (cd /Users/tim/Code/fhfhockey.com/web && /usr/bin/env -i PATH=/usr/bin:/bin TMPDIR="$S/dyld/tmp" DYLD_FOO=1 /usr/local/bin/node $O/tools/dependency-tree-hash.mjs --baseline $BASE; echo "  node_exit=$?")
