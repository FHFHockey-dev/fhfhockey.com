#!/bin/zsh
# Exit 3 (stop) when the database is busy: >5 active client queries or any active >10 s.
set -e
HERE=${0:A:h}
out=$($TMPDIR/pgpool.sh -At -F' ' -f $HERE/hygiene.sql)
read active longest <<< "$out"
echo "hygiene active=$active longest_active_s=$longest" >&2
if (( active > 5 || longest > 10 )); then echo "STOP: database busy" >&2; exit 3; fi
