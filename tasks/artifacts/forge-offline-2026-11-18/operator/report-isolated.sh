#!/bin/sh
# The off-Mac monitoring host supplies this libpq service with TLS verification and its own login.
# PostgreSQL handles the watchdog and terminal audit atomically, including after an omitted tick.
set -eu
export PGCONNECT_TIMEOUT=5
receipt=$(psql -XAtq 'service=forge_isolated_monitor' -v ON_ERROR_STOP=1 \
  -c 'select forge_rehearsal_monitor_api.check_fixture()')
printf '%s\n' "$receipt"
printf '%s\n' "$receipt" | jq -e '.gameId == 2099020991 and .phase == "succeeded" and .reason == "readers_recorded"' >/dev/null
