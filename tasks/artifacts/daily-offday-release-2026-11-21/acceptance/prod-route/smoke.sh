#!/bin/zsh
# ONE approved smoke GET of the deployed acceptance route (runDate 2026-11-21, offday). Never prints the secret.
D=${0:A:h}
set -a; source <(grep -E '^CRON_SECRET=' /Users/tim/Code/fhfhockey.com/web/.env.local); set +a
URL="https://fhfhockey.com/api/v1/db/forge-daily-acceptance?runDate=2026-11-21&sourceDate=2026-11-20&kind=offday"
date -u +%FT%TZ > $D/smoke.start
curl -sS -m 280 -H "Authorization: Bearer $CRON_SECRET" -H "Cache-Control: no-store" -D $D/smoke.headers -o $D/smoke.json -w "%{http_code}" "$URL" > $D/smoke.code
date -u +%FT%TZ > $D/smoke.end
echo "HTTP $(cat $D/smoke.code) $(cat $D/smoke.start) -> $(cat $D/smoke.end)"
