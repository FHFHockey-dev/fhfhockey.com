#!/bin/zsh
# Pre-launch gate. FAILS CLOSED: exit 0 only when every check returns a clean, well-formed answer.
#  1. The Supabase API host and the TSA host resolve (DNS only, no request).
#  2. One READ ONLY pooler session answers: <=5 other active queries, none >10 s, 0 lock waits.
# Any psql error, unresolvable host or malformed output is a failure (exit 7), never a pass.
set -u
HERE=${0:A:h}
ENVF=${FHFH_ENV_FILE:-/Users/tim/Code/fhfhockey.com/web/.env.local}
API_HOST=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' $ENVF | head -1 | cut -d= -f2- | tr -d '"' | sed -E 's#https?://([^/]+).*#\1#')
for host in "$API_HOST" "${TSA_HOST:-timestamp.digicert.com}"; do
  if ! python3 -I -c "import socket,sys; socket.getaddrinfo(sys.argv[1], 443)" "$host" 2>/dev/null; then
    echo "GATE FAIL: cannot resolve $host" >&2; exit 7
  fi
done
OUT=$($HERE/pgpool.sh -At -F ' ' -c "begin read only; set local statement_timeout='5s'; select count(*) filter (where state='active' and pid<>pg_backend_pid()), coalesce(max(extract(epoch from clock_timestamp()-query_start)) filter (where state='active' and pid<>pg_backend_pid()),0)::int, (select count(*) from pg_locks where not granted) from pg_stat_activity where datname=current_database() and backend_type='client backend'; rollback;" 2>&1)
rc=$?
LINE=$(print -r -- "$OUT" | grep -E '^[0-9]+ [0-9]+ [0-9]+$' | head -1)
if (( rc != 0 )) || [[ -z "$LINE" ]]; then echo "GATE FAIL: database check did not answer cleanly (psql exit $rc)" >&2; exit 7; fi
read active longest waits <<< "$LINE"
if (( active > 5 || longest > 10 || waits > 0 )); then echo "GATE FAIL: busy (active=$active longest=${longest}s lock_waits=$waits)" >&2; exit 7; fi
echo "gate ok active=$active longest=${longest}s lock_waits=$waits at $(date -u +%H:%M:%SZ)"
