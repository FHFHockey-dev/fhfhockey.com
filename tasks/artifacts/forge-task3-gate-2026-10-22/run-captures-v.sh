#!/usr/bin/env bash
# Sequential (concurrency 1) FORGE reconstruction captures, variants va (master d45a287f0) and vc (task 2 variant c).
# TJ approved 2026-10-22 in the model-lane session. Stop rules: >500 reads/run, >4 h, >60k GETs total. Never set GIT_DIR.
set -euo pipefail
unset GIT_DIR
R=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/d6739ede-de35-4524-8a93-c5011c5e6ee8/scratchpad/recon
GAMES="${1:?games file required}"
LOG="$R/out/capture-$(date -u +%Y%m%dT%H%M%SZ).log"
for V in ${VARIANTS:-va vc}; do mkdir -p "$R/out/$V"; done
TOTAL_FILE="$R/out/total-reads-${VARIANTS// /-}"; [[ -e $TOTAL_FILE ]] || echo 0 > "$TOTAL_FILE"
START_ALL=$(date +%s)
TSNODE_OPTS='{"module":"commonjs","moduleResolution":"node"}'
while read -r DATE GAME _rest; do
  [[ -z "${DATE:-}" || "$DATE" == \#* ]] && continue
  CUTOFF="${DATE}T15:00:00Z"
  for V in ${VARIANTS:-va vc}; do
    OUT="$R/out/$V/$DATE-$GAME.json"
    if [[ -e "$OUT" ]]; then echo "$(date -u +%FT%TZ) SKIP $V $DATE $GAME" | tee -a "$LOG"; continue; fi
    S=$(date +%s)
    set +e
    ( cd "$R/$V/web" && NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options "$TSNODE_OPTS" \
        scripts/capture-forge-reconstruction.ts "$DATE" "$GAME" "$CUTOFF" "$OUT" ) > "$R/out/$V-$DATE-$GAME.stdout" 2> "$R/out/$V-$DATE-$GAME.stderr"
    RC=$?
    set -e
    READS=$(python3 -c "import json,sys;print(json.loads(open(sys.argv[1]).read().strip().splitlines()[-1])['networkReads'])" "$R/out/$V-$DATE-$GAME.stdout" 2>/dev/null || echo 0)
    TOTAL=$(( $(cat "$TOTAL_FILE") + READS )); echo $TOTAL > "$TOTAL_FILE"
    echo "$(date -u +%FT%TZ) $V $DATE $GAME rc=$RC reads=$READS total=$TOTAL secs=$(( $(date +%s) - S ))" | tee -a "$LOG"
    if [[ $RC -ne 0 ]]; then echo "STOP: failure ($(tail -c 300 "$R/out/$V-$DATE-$GAME.stderr" | tr '\n' ' '))" | tee -a "$LOG"; exit 2; fi
    if (( READS > 500 )); then echo "STOP: >500 reads in one run" | tee -a "$LOG"; exit 3; fi
    if (( TOTAL > 60000 )); then echo "STOP: >60k GETs" | tee -a "$LOG"; exit 4; fi
    if (( $(date +%s) - START_ALL > 14400 )); then echo "STOP: >4 h" | tee -a "$LOG"; exit 5; fi
  done
done < "$GAMES"
echo "$(date -u +%FT%TZ) DONE total=$(cat "$TOTAL_FILE")" | tee -a "$LOG"
