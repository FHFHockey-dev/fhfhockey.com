#!/usr/bin/env bash
# Local Deno runtime smoke test of the forge-witness-verify Edge Function: no database, no real secret. It serves
# supabase/functions/forge-witness-verify/index.ts with a THROWAWAY Ed25519 key and an unreachable SUPABASE_URL, POSTs
# once and prints the self-test. Pass: selfTest {tsa, packet, signature} all true (the response is then 503
# pending_unconfirmed, because there is no database). Needs deno (brew install deno). From the repository root:
#   bash tasks/artifacts/forge-witness-signed-2026-11-19/deno-smoke.sh
set -euo pipefail
cd "$(dirname "$0")/../../.."
command -v deno >/dev/null || { echo "deno is not installed (brew install deno)"; exit 1; }
KEY=$(node -e 'const {generateKeyPairSync}=require("node:crypto");process.stdout.write(generateKeyPairSync("ed25519").privateKey.export({format:"der",type:"pkcs8"}).toString("base64"))')
SUPABASE_URL=http://127.0.0.1:9 SUPABASE_SERVICE_ROLE_KEY=unused FORGE_WITNESS_SIGNING_KEY="$KEY" \
  deno run --allow-net --allow-env supabase/functions/forge-witness-verify/index.ts >/tmp/forge-witness-deno.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do curl -s -o /dev/null http://127.0.0.1:8000/ 2>/dev/null && break; sleep 0.2; done
BODY=$(curl -s -X POST http://127.0.0.1:8000/forge-witness-verify -H 'content-type: application/json' -d '{}')
echo "$BODY" | python3 -c 'import json,sys; b=json.load(sys.stdin); print(json.dumps({k: b.get(k) for k in ("status","release","selfTest")})); sys.exit(0 if b.get("selfTest")=={"tsa":True,"packet":True,"signature":True} else 2)'
