#!/bin/bash
# Usage: app-deltas.sh <web dir> <out dir>. Bundles pages/_app.tsx with esbuild and reports raw/gzip bytes
# with selected packages externalized, to attribute global-shell weight. Approximation of Next's _app chunk.
set -u
cd "$1"; OUT="$2"; mkdir -p "$OUT/esb"
base=(node_modules/.bin/esbuild pages/_app.tsx --bundle --minify --platform=browser --format=esm --jsx=automatic
  --tsconfig=tsconfig.json --log-level=error '--define:process.env.NODE_ENV="production"'
  --loader:.css=empty --loader:.scss=empty --loader:.png=empty --loader:.svg=empty --loader:.jpg=empty --loader:.webp=empty
  --external:react --external:react-dom '--external:react/*' '--external:react-dom/*' --external:next '--external:next/*')
run() { local name="$1"; shift; "${base[@]}" "$@" --outfile="$OUT/esb/$name.js"
  printf "%-14s raw=%7d gz=%6d\n" "$name" "$(stat -f %z "$OUT/esb/$name.js")" "$(gzip -9 -c "$OUT/esb/$name.js" | wc -c)"; }
run baseline
run no-apollo --external:@apollo/client '--external:@apollo/client/*' --external:graphql
run no-notistack --external:notistack
run no-both --external:@apollo/client '--external:@apollo/client/*' --external:graphql --external:notistack
