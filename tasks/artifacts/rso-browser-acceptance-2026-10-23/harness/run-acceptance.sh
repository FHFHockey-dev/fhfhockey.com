#!/usr/bin/env bash
# Browser acceptance (CR-REL-04 / R6) for P07, task 10 and P04 on one frozen candidate.
#
#   run-acceptance.sh <commit-or-tree> [--port N] [--goalie-policy badge-only|server-confirmed]
#                     [--existing-grep REGEX] [--keep-server] [--allow-lock-drift] [--validation]
#   --validation: the commit is not the release candidate (harness check only); the receipt says so
#                 and goes to harness-validation/ instead of the acceptance folder.
#   run-acceptance.sh --from-dir [--port N] ...   # harness debugging only: copies the working tree,
#                                                 # and the receipt says it is NOT a candidate.
#   run-acceptance.sh --stop [--port N]
#
# The candidate is exported with `git archive` (read-only; no refs, index or GIT_DIR are touched),
# `web/node_modules` is symlinked from the canonical checkout, and Next runs from the export on an
# isolated port with every backend URL pointed at a closed local port. Browser routes are mocked by
# the specs; nothing here reads production.
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE

REPO=/Users/tim/Code/fhfhockey.com
HARNESS="$(cd "$(dirname "$0")" && pwd)"
ARTIFACTS="$(dirname "$HARNESS")"
SCRATCH="${RSO_ACCEPT_SCRATCH:-/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/c8fc728c-3e05-47e8-bb87-468ef003a314/scratchpad/rso-acceptance}"
PORT=3117
POLICY=badge-only
EXISTING_GREP=""
KEEP=0
ALLOW_LOCK_DRIFT=0
MODE=candidate
VALIDATION=0
CAND=""

while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --goalie-policy) POLICY="$2"; shift 2 ;;
    --existing-grep) EXISTING_GREP="$2"; shift 2 ;;
    --keep-server) KEEP=1; shift ;;
    --allow-lock-drift) ALLOW_LOCK_DRIFT=1; shift ;;
    --from-dir) MODE=worktree-debug; shift ;;
    --validation) VALIDATION=1; shift ;;
    --stop) MODE=stop; shift ;;
    -*) echo "unknown option $1" >&2; exit 2 ;;
    *) CAND="$1"; shift ;;
  esac
done

case "$PORT" in 3000|3105) echo "port $PORT belongs to TJ's dev server" >&2; exit 2 ;; esac
case "$POLICY" in badge-only|server-confirmed) ;; *) echo "bad --goalie-policy $POLICY" >&2; exit 2 ;; esac
mkdir -p "$SCRATCH"
PIDFILE="$SCRATCH/server-$PORT.pid"

descendants() { local pid; for pid in $(pgrep -P "$1" 2>/dev/null); do descendants "$pid"; echo "$pid"; done; }
stop_server() {
  [ -f "$PIDFILE" ] || return 0
  local root; root="$(cat "$PIDFILE")"
  local pids; pids="$(descendants "$root") $root"
  kill $pids 2>/dev/null || true
  for _ in $(seq 1 20); do kill -0 "$root" 2>/dev/null || break; sleep 0.5; done
  kill -9 $pids 2>/dev/null || true
  rm -f "${PIDFILE:?}"
  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then echo "WARNING: port $PORT still has a listener" >&2; else echo "server on :$PORT stopped"; fi
}
if [ "$MODE" = stop ]; then stop_server; exit 0; fi

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port $PORT is already in use; refusing to reuse a server that may not be the candidate" >&2; exit 3
fi

# --- 1. Export the exact candidate --------------------------------------------------------------
if [ "$MODE" = candidate ]; then
  [ -n "$CAND" ] || { echo "usage: run-acceptance.sh <commit-or-tree>" >&2; exit 2; }
  TYPE="$(git -C "$REPO" cat-file -t "$CAND")"
  case "$TYPE" in
    commit) FULL="$(git -C "$REPO" rev-parse --verify "$CAND^{commit}")"; TREE="$(git -C "$REPO" rev-parse --verify "$FULL^{tree}")" ;;
    tree) FULL="$(git -C "$REPO" rev-parse --verify "$CAND^{tree}")"; TREE="$FULL" ;;
    *) echo "$CAND is a $TYPE, not a commit or tree" >&2; exit 2 ;;
  esac
  LABEL="${FULL:0:12}"
else
  TYPE=worktree-debug; FULL="WORKTREE-DEBUG-NOT-A-CANDIDATE"; TREE=""
  LABEL="worktree-debug-$(date +%H%M%S)"
fi
EXPORT="$SCRATCH/export-$LABEL"
OUT="$SCRATCH/results-$LABEL"
rm -rf "${EXPORT:?}" "${OUT:?}"
mkdir -p "$EXPORT" "$OUT"
if [ "$MODE" = candidate ]; then
  git -C "$REPO" archive --format=tar "$FULL" web | tar -x -C "$EXPORT"
else
  rsync -a --exclude node_modules --exclude '.next*' --exclude '.env*.local' --exclude '.env.local' \
    --exclude test-results --exclude playwright-report --exclude '.ms-playwright' "$REPO/web/" "$EXPORT/web/"
fi
WEB="$EXPORT/web"
[ -f "$WEB/package.json" ] || { echo "export has no web/package.json" >&2; exit 4; }

# --- 2. Dependencies: reuse the canonical install only when the lockfile matches -----------------
LOCK_CAND="$(shasum -a 256 "$WEB/package-lock.json" | cut -d' ' -f1)"
LOCK_CANON="$(shasum -a 256 "$REPO/web/package-lock.json" | cut -d' ' -f1)"
if [ "$LOCK_CAND" != "$LOCK_CANON" ] && [ "$ALLOW_LOCK_DRIFT" != 1 ]; then
  echo "BLOCKED: candidate package-lock.json ($LOCK_CAND) differs from the installed one ($LOCK_CANON)" >&2; exit 5
fi
ln -s "$REPO/web/node_modules" "$WEB/node_modules"

# Test-only harness files go into the export, never into the candidate or the checkout.
mkdir -p "$WEB/e2e/acceptance"
cp "$HARNESS"/acceptance.config.ts "$HARNESS"/*.spec.ts "$WEB/e2e/acceptance/"

# --- 3. Server: isolated port, no inherited secrets, every backend URL refused -----------------
BLACKHOLE=http://127.0.0.1:9
BASE_ENV=(HOME="$HOME" PATH="$PATH" TMPDIR="${TMPDIR:-/tmp}" LANG=en_US.UTF-8 NEXT_TELEMETRY_DISABLED=1
  NEXT_PUBLIC_SUPABASE_URL="$BLACKHOLE" NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=fixture-public-key
  CMS_URL="$BLACKHOLE" NEXT_PUBLIC_SITE_URL="http://127.0.0.1:$PORT" NEXT_PUBLIC_SANITY_PROJECT_ID=fixture0
  NEXT_PUBLIC_SANITY_DATASET=fixture NEXT_PUBLIC_SANITY_GRAPHQL_URI="$BLACKHOLE"
  NEXT_PUBLIC_SERVERLESS_API_URL="$BLACKHOLE" PUPPETEER_ENDPOINT=ws://127.0.0.1:9)
SERVER_LOG="$OUT/next-dev.log"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
( cd "$WEB" && exec env -i "${BASE_ENV[@]}" PLAYWRIGHT_ISOLATED_NEXT=1 \
    node_modules/.bin/next dev -H 127.0.0.1 -p "$PORT" ) >"$SERVER_LOG" 2>&1 &
echo $! >"$PIDFILE"
[ "$KEEP" = 1 ] || trap stop_server EXIT

BASE="http://127.0.0.1:$PORT"
for i in $(seq 1 120); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 120 "$BASE/roster-schedule-optimizer" || true)"
  [ "$code" = 200 ] && break
  kill -0 "$(cat "$PIDFILE")" 2>/dev/null || { echo "next dev exited; see $SERVER_LOG" >&2; exit 6; }
  sleep 2
done
[ "$code" = 200 ] || { echo "server not ready (last HTTP $code); see $SERVER_LOG" >&2; exit 6; }
LISTENER="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t | head -1)"
LISTENER_CWD="$(lsof -a -p "$LISTENER" -d cwd -Fn | sed -n 's/^n//p')"
case "$LISTENER_CWD" in "$WEB"*) ;; *) echo "listener on :$PORT runs from $LISTENER_CWD, not the export" >&2; exit 7 ;; esac
curl -s -o /dev/null --max-time 180 "$BASE/stats/game/2025020001" || true # warm the P04 route

# --- 4. Playwright: harness specs (desktop + mobile), then the candidate's own specs ------------
PW_ENV=("${BASE_ENV[@]}" PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL="$BASE" RSO_ACCEPT_OUT="$OUT"
  RSO_GOALIE_POLICY="$POLICY")
set +e
( cd "$WEB" && env -i "${PW_ENV[@]}" PLAYWRIGHT_JSON_OUTPUT_FILE="$OUT/acceptance.json" \
    node_modules/.bin/playwright test --config e2e/acceptance/acceptance.config.ts --reporter=list,json ) \
  2>&1 | tee "$OUT/acceptance.log"
ACCEPT_STATUS=${PIPESTATUS[0]}

EXISTING=(e2e/roster-schedule-optimizer.spec.ts)
while IFS= read -r spec; do EXISTING+=("$spec"); done < <(cd "$WEB" && grep -lE "PlayerSearchBar|Search for a player" e2e/*.spec.ts 2>/dev/null || true)
GREP_ARGS=(); [ -n "$EXISTING_GREP" ] && GREP_ARGS=(--grep "$EXISTING_GREP")
( cd "$WEB" && env -i "${PW_ENV[@]}" PLAYWRIGHT_JSON_OUTPUT_FILE="$OUT/existing.json" \
    node_modules/.bin/playwright test "${EXISTING[@]}" ${GREP_ARGS[@]+"${GREP_ARGS[@]}"} --project chromium \
    --output "$OUT/existing-results" --reporter=list,json ) 2>&1 | tee "$OUT/existing.log"
EXISTING_STATUS=${PIPESTATUS[0]}
set -e

# --- 5. Receipt: hashes come from the export, never the moving checkout -------------------------
node "$HARNESS/write-receipt.mjs" --candidate "$FULL" --type "$TYPE" --tree "$TREE" --export "$EXPORT" \
  --results "$OUT" --artifacts "$ARTIFACTS" --label "$LABEL" --port "$PORT" --policy "$POLICY" \
  --started "$STARTED_AT" --lock-candidate "$LOCK_CAND" --lock-installed "$LOCK_CANON" --validation "$VALIDATION" \
  --existing-specs "${EXISTING[*]}" --acceptance-exit "$ACCEPT_STATUS" --existing-exit "$EXISTING_STATUS"
echo "acceptance exit $ACCEPT_STATUS, existing specs exit $EXISTING_STATUS; results in $OUT"
