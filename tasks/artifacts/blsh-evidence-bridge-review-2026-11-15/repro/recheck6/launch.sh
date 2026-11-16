#!/bin/sh
# RECHECK-6 launcher: bootstrap-shaped env -i + ts-node register + the exit dump preload, from canonical web/.
# Usage: sh launch.sh <scratch> <dumpName> <entry> [args...]   (extra env via REH_DATE/REH_CLOCK)
S=$1; N=$2; shift 2; HERE=$(cd "$(dirname "$0")" && pwd)
cd /Users/tim/Code/fhfhockey.com/web && exec env -i PATH=/usr/local/bin:/usr/bin:/bin HOME="$S" TMPDIR="$S/tmp" NODE_PATH=. DISABLE_V8_COMPILE_CACHE=1 \
  TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' ${REH_DATE:+REHEARSAL_DATE=$REH_DATE} ${REH_CLOCK:+REHEARSAL_CLOCK=$REH_CLOCK} \
  DUMP_OUT="$S/dump-$N.json" /usr/local/bin/node --require ./node_modules/ts-node/register/transpile-only --require "$HERE/dump-cache-on-exit.cjs" "$@"
