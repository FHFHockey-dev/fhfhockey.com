#!/bin/zsh
# Operator launch of ONE TJ-approved capture. Usage:
#   launch-capture.sh <export web dir> <candidate sha> <game id> <slate date ET> <approval token> <new out dir>
# Runs gate.sh first and launches nothing unless it passes. Credentials go to this process only, never printed.
set -u
HERE=${0:A:h}
E=$1 SHA=$2 GAME=$3 SLATE=$4 TOKEN=$5 OUT=$6
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
export FORGE_PREGAME_CAPTURE_ENABLED=true FORGE_PREGAME_CAPTURE_APPROVAL="$TOKEN"
echo "launch_at=$(date -u +%H:%M:%SZ) game=$GAME sha=$SHA out=$OUT"
cd $E && env -u GIT_DIR NODE_PATH=. npx --no-install ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
  scripts/forge-pregame-capture.ts --execute --game-id "$GAME" --confirm-game-id "$GAME" --slate-date "$SLATE" \
  --approval "$TOKEN" --code-version "$SHA" --tsa-profile digicert-g4-v1 --out "$OUT"
