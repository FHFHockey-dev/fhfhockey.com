#!/bin/zsh
# Session-pooler psql wrapper (IPv4). Reads SUPABASE_DB_URL from web/.env.local at call time; never prints it.
# PGPOOL_HOST overrides the pooler host (used only by the gate self-test).
set -e
ENVF=${FHFH_ENV_FILE:-/Users/tim/Code/fhfhockey.com/web/.env.local}
URL=$(grep -E '^SUPABASE_DB_URL=' $ENVF | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')
[[ -n "$URL" ]] || { echo "SUPABASE_DB_URL missing" >&2; exit 2; }
eval $(python3 -I - "$URL" "${PGPOOL_HOST:-aws-0-us-east-1.pooler.supabase.com}" <<'PY'
import sys, urllib.parse as u
p = u.urlparse(sys.argv[1]); host = p.hostname or ""
ref = host.split(".")[1] if host.startswith("db.") else ""
user = u.unquote(p.username or "")
if ref and "." not in user: user = f"{user}.{ref}"
q = lambda s: "'" + s.replace("'", "'\\''") + "'"
print(f"export PGUSER={q(user)} PGPASSWORD={q(u.unquote(p.password or ''))} PGDATABASE={q((p.path or '/postgres').lstrip('/') or 'postgres')}")
print(f"export PGHOST={q(sys.argv[2])} PGPORT=5432 PGSSLMODE=require PGAPPNAME=claude-forge-pregame-capture PGCONNECT_TIMEOUT=10")
PY
)
exec /opt/homebrew/opt/postgresql@15/bin/psql -X -v ON_ERROR_STOP=1 "$@"
