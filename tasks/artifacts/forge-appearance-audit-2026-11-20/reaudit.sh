#!/usr/bin/env bash
# Full read-only production recapture. All local writes go to a fresh evidence directory and socket.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
original=/Users/tim/Documents/Codex/2026-11-20/forge-appearance-snapshot-01
out=${1:?supply a new output directory}
mkdir "$out"
sock=$(mktemp -d /tmp/forge-appearance-post.XXXXXXXX)
# fixture.py creates its socket directory and refuses to reuse one.
runtime="$sock/pgsocket"
pgbin=/opt/homebrew/opt/postgresql@15/bin
stop_local() {
  if [[ -f "$runtime/pg/postmaster.pid" ]]; then "$pgbin/pg_ctl" -D "$runtime/pg" -m fast -w stop >/dev/null; fi
}
trap stop_local EXIT
python3 "$here/snapshot.py" "$out/input"
cmp "$original/rpc.sql" "$out/input/rpc.sql"
ln -s "$original/boxes" "$out/input/boxes"
ln -s "$original/nhl" "$out/input/nhl"
python3 "$here/fixture.py" "$out/input" "$runtime"
python3 "$here/authority.py" "$out/input" "$runtime"
"$pgbin/psql" -X -v ON_ERROR_STOP=1 -h "$runtime" -p 55496 -U postgres -f "$here/authority.sql" -f "$here/audit.sql"
python3 "$here/seal.py" "$out/input" "$runtime" "$out/decision"
python3 "$here/check_metrics.py" "$runtime" "$out/decision"
python3 "$here/detail.py" "$out/input" "$out/decision" "$runtime"
python3 "$here/exposure.py" "$out/input" "$out/decision" "$runtime"
python3 "$here/scopes.py" "$runtime" "$out/decision"
bash "$here/readers.sh" "$runtime" "$out/readers" "$out/decision/scopes.json"
