#!/bin/zsh
# Operator launch of ONE TJ-approved slate queue (cap 2). Usage:
#   launch-slate.sh <export web dir> <candidate sha> <slate date ET> <approval token> <new out dir> <gameId@ISO start,...>
# Runs gate.sh first and launches nothing unless it passes; the queue then runs gate.sh again before every dispatch.
# Credentials go to this process only, never printed. caffeinate keeps the Mac awake until the queue exits.
set -u
HERE=${0:A:h}
if (( $# != 6 )); then echo "usage: launch-slate.sh <export web dir> <sha> <slate date ET> <token> <new out dir> <id@start,...>" >&2; exit 2; fi
E=$1 SHA=$2 SLATE=$3 TOKEN=$4 OUT=$5 GAMES=$6
IDS=$(print -r -- "$GAMES" | tr ',' '\n' | cut -d@ -f1 | paste -sd, -)
ENVF=${FHFH_ENV_FILE:-/Users/tim/Code/fhfhockey.com/web/.env.local}
$HERE/gate.sh || { echo "not launched: gate failed" >&2; exit 7; }
eval $(python3 -I - "$ENVF" <<'PY'
import sys
keep = {"NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLIC_KEY"}
for line in open(sys.argv[1]):
    line = line.strip()
    if "=" not in line or line.startswith("#"): continue
    k, v = line.split("=", 1)
    if k in keep:
        v = v.strip().strip('"').strip("'")
        print("export %s='%s'" % (k, v.replace("'", "'\\''")))
PY
)
export FORGE_PREGAME_CAPTURE_ENABLED=true FORGE_PREGAME_CAPTURE_APPROVAL="$TOKEN" FHFH_ENV_FILE="$ENVF"
echo "launch_at=$(date -u +%H:%M:%SZ) games=$IDS sha=$SHA out=$OUT"
cd $E && env -u GIT_DIR NODE_PATH=. caffeinate -i npx --no-install ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
  scripts/forge-pregame-slate.ts --execute --games "$GAMES" --confirm-game-ids "$IDS" --slate-date "$SLATE" \
  --approval "$TOKEN" --code-version "$SHA" --tsa-profile digicert-g4-v1 --out "$OUT" --gate "$HERE/gate.sh" --concurrency 2
