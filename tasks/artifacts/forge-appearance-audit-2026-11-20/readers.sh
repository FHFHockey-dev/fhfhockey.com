#!/usr/bin/env bash
# Exercise the deployed JS against mounted fixture tables via loopback PostgREST.
set -eu
set -o pipefail
here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../../.." && pwd)
sock=${1:?disposable PG socket directory}
out=${2:?new reader output directory}
scopes=${3:?scope JSON}
[[ "$sock" == /tmp/forge-appearance-* ]]
mkdir "$out"
psql=(/opt/homebrew/opt/postgresql@15/bin/psql -X -v ON_ERROR_STOP=1 -h "$sock" -p 55496 -U postgres)
[[ "$("${psql[@]}" -Atc "select current_setting('listen_addresses') = '' and to_regnamespace('audit') is not null")" == t ]]
release=3e360ae4c6bf2aecf10edda6df48a585f7f4b505
mkdir "$out/src"
git -C "$repo" archive "$release" web/lib web/tsconfig.json | tar -x -C "$out/src"
ln -s "$repo/web/node_modules" "$out/src/web/node_modules"
cp "$here/reader.ts" "$out/src/web/appearance-proof.ts"
(cd "$out/src/web" && ./node_modules/.bin/esbuild appearance-proof.ts --bundle --platform=node --format=cjs --log-level=error --outfile="$out/reader.cjs")
"${psql[@]}" -c 'grant usage on schema public to service_role; grant select on rolling_player_game_metrics,rolling_player_metric_support_payloads,games to service_role'
port=$(python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()")
cat > "$out/rest.conf" <<EOF
db-uri = "postgresql://postgres@/postgres?host=$sock&port=55496"
db-schemas = "public"
db-anon-role = "service_role"
server-host = "127.0.0.1"
server-port = $port
db-max-rows = 1000
EOF
bin=${POSTGREST_BIN:-$(cat /tmp/forge-postgrest-binary-path)}
"$bin" "$out/rest.conf" > "$out/postgrest.log" 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true' EXIT
for i in {1..50}; do
  if curl -fsS "http://127.0.0.1:$port/games?select=id&limit=0" >/dev/null 2>&1; then break; fi
  sleep 0.1
done
curl -fsS "http://127.0.0.1:$port/games?select=id&limit=0" >/dev/null
node "$out/reader.cjs" "http://127.0.0.1:$port" "$scopes" "$out/readers.json"
"${psql[@]}" -Atc "select json_build_array(player_id,game_date,game_id,season,strength_state,support_payload->'alignedCountSupport') from rolling_player_metric_support_payloads where strength_state in ('ev','pp') and support_payload?'alignedCountSupport'" | node "$out/reader.cjs" aligned > "$out/aligned.json"
