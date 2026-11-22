#!/bin/zsh
# call.sh <n>: ONE GET of the approved Batch A request. Saves headers/body to call-<n>.*; never prints the secret.
n=$1; D=${0:A:h}
set -a; source <(grep -E '^CRON_SECRET=' /Users/tim/Code/fhfhockey.com/web/.env.local); set +a
IDS=2026020360,2026020361,2026020362,2026020363,2026020364,2026020365,2026020366,2026020367,2026020368,2026020369,2026020370,2026020371,2026020372
URL="https://fhfhockey.com/api/v1/db/run-projection-v2?date=2026-11-21&gameIds=$IDS&maxDurationMs=210000"
date -u +%FT%TZ > $D/call-$n.start
curl -sS -m 260 -H "Authorization: Bearer $CRON_SECRET" -H "Cache-Control: no-store" -D $D/call-$n.headers -o $D/call-$n.json -w "%{http_code}" "$URL" > $D/call-$n.code
date -u +%FT%TZ > $D/call-$n.end
echo "HTTP $(cat $D/call-$n.code) $(cat $D/call-$n.start) -> $(cat $D/call-$n.end)"
python3 -I -c "
import json,sys
b=json.load(open('$D/call-$n.json'))
keep={k:b.get(k) for k in ('success','operationStatus','runId','timedOut','error','resume','message') if k in b}
print(json.dumps(keep)[:1500])" 2>/dev/null || head -c 800 $D/call-$n.json
