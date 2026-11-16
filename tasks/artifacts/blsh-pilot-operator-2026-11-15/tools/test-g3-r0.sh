#!/bin/sh
# G3 regression tests for dependency-tree-hash.mjs (RECHECK-6 R0 cases + every earlier mutation case, rerun on the
# current tool). Offline; writes only under <scratch>. Each case builds a scratch web root the same way as the
# reviewer's repro/recheck6/g3-self-check.sh (copies of the 42 closure packages + package.json/tsconfig.json +
# scripts/blsh + lib/{nst,cron}), runs the tool under env -i with a scratch TMPDIR, and ASSERTS node's own exit code
# and the expected stdout text. Exits 1 if any case does not behave as expected (or a canary marker exists).
# Usage: sh test-g3-r0.sh <scratch>
set -u
S=$1; W=/Users/tim/Code/fhfhockey.com/web; O=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15
T=$O/tools/dependency-tree-hash.mjs; BASE=$O/evidence/DEPENDENCY-TREE-BASELINE.json; FAILS=0
mkdir -p "$S/tmp"
pristine() { R=$S/_pristine/web; [ -d "$R" ] && return; mkdir -p "$R/node_modules" "$R/scripts" "$R/lib"
  cp $W/package.json $W/tsconfig.json "$R/"; cp -R $W/scripts/blsh "$R/scripts/"; cp -R $W/lib/nst $W/lib/cron "$R/lib/"
  python3 -I -c "import json;[print(p['path']) for p in json.load(open('$BASE'))['packages']]" | while read p; do
    mkdir -p "$R/$p"; (cd "$W/$p" && find . -path ./node_modules -prune -o \( -type f -o -type l \) -print | cpio -pdm "$R/$p" 2>/dev/null); done; }
mk() { rm -rf "$S/$1"; mkdir -p "$S/$1"; cp -R "$S/_pristine/web" "$S/$1/web"; }
# run <name> <expected exit> <expected stdout text> [env assignments...]; extra tool args come from $ARGS
run() { name=$1; want_rc=$2; want=$3; shift 3; mkdir -p "$S/tmp/$name"
  (cd "$S/$name/web" && env -i PATH=/usr/bin:/bin TMPDIR="$S/tmp/$name/" "$@" /usr/local/bin/node $T --web "$S/$name/web" $ARGS > "$S/$name.out" 2>"$S/$name.err"; echo $? > "$S/$name.rc")
  rc=$(cat "$S/$name.rc"); if [ "$rc" = "$want_rc" ] && grep -qF -- "$want" "$S/$name.out"; then v=PASS; else v=FAIL; FAILS=$((FAILS+1)); fi
  echo "$v [$name] node_exit=$rc (want $want_rc, text '$want')"; cut -c1-700 "$S/$name.out"; }
canary() { if [ -e "$S/CANARY-RAN" ]; then echo "FAIL   canary marker exists: forged typescript.js EXECUTED"; FAILS=$((FAILS+1)); else echo "PASS   canary marker absent: forged bytes never executed"; fi; }
prologue() { F="$S/$1/web/node_modules/typescript/lib/typescript.js"; { printf '%s\n' "$2"; cat "$F"; } > "$F.new" && mv "$F.new" "$F"; }
FORGED='if ((process.argv[1] || "").endsWith("dependency-tree-hash.mjs")) { process.stdout.write(JSON.stringify({ dependencyTree: "match", treeSHA256: "76c7d466725ea13208b87adfb5ac6688a42454b66382996fbd9a7ab36432473a", baselineTreeSHA256: "76c7d466725ea13208b87adfb5ac6688a42454b66382996fbd9a7ab36432473a", loaded: { files: 256, uncovered: [] }, differences: [], forgedBy: "typescript.js" }) + "\n"); process.exit(0); }'
pristine
B="--baseline $BASE"; L="--baseline $BASE --loaded"

# controls
ARGS=$B; mk control; run control 0 '"dependencyTree":"match"'
ARGS=$L; mk control-loaded; run control-loaded 0 '"uncovered":[]},"differences":[]'
ARGS="--sources $S/control-sources/web $L"; mk control-sources; run control-sources 0 '"dependencyTree":"match"'
# R0: typescript is verified before any of its bytes run
ARGS=$B; mk tsforged; prologue tsforged "$FORGED"; run tsforged 1 'typescript_package_hash_mismatch'
ARGS=$L; mk tsforged-loaded; prologue tsforged-loaded "$FORGED"; run tsforged-loaded 1 'typescript_package_hash_mismatch'
CAN="require(\"fs\").writeFileSync(\"$S/CANARY-RAN\", \"typescript.js executed\\n\");"
ARGS=$B; mk tscanary; prologue tscanary "$CAN"; rm -f "$S/CANARY-RAN"; run tscanary 1 'typescript_package_hash_mismatch'; canary
ARGS="--out $S/tscanary-gen.manifest.json"; mk tscanary-gen; prologue tscanary-gen "$CAN"; rm -f "$S/CANARY-RAN"; run tscanary-gen 1 'typescript_package_hash_mismatch'; canary
[ -e "$S/tscanary-gen.manifest.json" ] && { echo "FAIL   manifest written"; FAILS=$((FAILS+1)); } || echo "PASS   no manifest written"
ARGS=$B; mk tssymlink; mv "$S/tssymlink/web/node_modules/typescript" "$S/tssymlink/ts-elsewhere"; ln -s "$S/tssymlink/ts-elsewhere" "$S/tssymlink/web/node_modules/typescript"; run tssymlink 1 'typescript_not_plain_directory'
ARGS=$B; mk dyld; run dyld 1 'dyld_env_present' DYLD_PRINT_LIBRARIES=1
# earlier tree cases, rerun on this tool
ARGS=$B; mk undici; printf '\n// reviewer drift\n' >> "$S/undici/web/node_modules/undici/index.js"; run undici 1 'changed:node_modules/undici'
ARGS=$L; mk undici-loaded; printf '\n// reviewer drift\n' >> "$S/undici-loaded/web/node_modules/undici/index.js"; run undici-loaded 1 'loaded_listing_skipped_tree_refused'
ARGS=$B; mk cheerio-pkg; printf ' ' >> "$S/cheerio-pkg/web/node_modules/cheerio/package.json"; run cheerio-pkg 1 'bootstrap_dependency_pin_mismatch'
ARGS=$B; mk symlink-out; ln -s /etc/hosts "$S/symlink-out/web/node_modules/memory-cache/evil"; run symlink-out 1 'symlink_outside_tree:node_modules/memory-cache/evil'
ARGS=$B; mk nested-extra; : > "$S/nested-extra/web/node_modules/htmlparser2/node_modules/entities/extra"; run nested-extra 1 'changed:node_modules/htmlparser2/node_modules/entities'
ARGS=$B; mk tsnode-entry; printf ' ' >> "$S/tsnode-entry/web/node_modules/ts-node/dist/index.js"; run tsnode-entry 1 'changed:node_modules/ts-node'
ARGS=$B; mk yn-removed; rm -rf "$S/yn-removed/web/node_modules/yn"; run yn-removed 1 'dependency_unresolved:yn<-node_modules/ts-node'
ARGS=$L; mk evil-tls; mkdir -p "$S/evil-tls/web/node_modules/evil-tls"; echo 'module.exports = 1;' > "$S/evil-tls/web/node_modules/evil-tls/index.js"
  echo '{"name":"evil-tls","version":"1.0.0","main":"index.js"}' > "$S/evil-tls/web/node_modules/evil-tls/package.json"
  printf '\nrequire("evil-tls");\n' >> "$S/evil-tls/web/node_modules/memory-cache/index.js"; run evil-tls 1 'loaded_listing_skipped_tree_refused'
ARGS=$L; mk role-extra; echo 'export const extra = 1;' > "$S/role-extra/web/lib/nst/extra.ts"
  { echo 'import "./extra";'; cat "$S/role-extra/web/lib/nst/client.ts"; } > "$S/role-extra/c.ts" && mv "$S/role-extra/c.ts" "$S/role-extra/web/lib/nst/client.ts"; run role-extra 1 'source_role_pin_mismatch'
ARGS=$B; mk nodepath-shadow; rm -rf "$S/nodepath-shadow/web/node_modules/memory-cache"; echo 'module.exports = {};' > "$S/nodepath-shadow/web/memory-cache.js"; run nodepath-shadow 1 'dependency_unresolved:memory-cache'

echo "---- failures: $FAILS"
[ "$FAILS" -eq 0 ]
