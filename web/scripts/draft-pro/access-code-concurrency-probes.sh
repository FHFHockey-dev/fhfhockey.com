#!/usr/bin/env bash
set -euo pipefail

readonly CONTAINER="${1:?Usage: $0 <disposable-postgres-container>}"
readonly USER_ID='00000000-0000-4000-8000-000000000056'
readonly ADMIN_ID='00000000-0000-4000-8000-000000000057'
readonly RAW_CODE='complimentary-concurrent-code-01'
readonly OUTPUT_DIRECTORY="$(mktemp -d)"
cleanup() { rm -rf "$OUTPUT_DIRECTORY"; }
trap cleanup EXIT

query() {
  docker exec -i "$CONTAINER" psql --quiet --set ON_ERROR_STOP=1 --tuples-only --no-align --username postgres --dbname postgres --command "$1"
}

query "
  insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
    ('$USER_ID','authenticated','authenticated','access-race@example.invalid','{}','{}'),
    ('$ADMIN_ID','authenticated','authenticated','access-race-admin@example.invalid','{}','{}');
  insert into public.users (user_id,role) values ('$USER_ID','basic'),('$ADMIN_ID','admin');
  select public.issue_draft_pro_access_code('$ADMIN_ID','$USER_ID',encode(extensions.digest('$RAW_CODE','sha256'),'hex'),'race probe','2027-07-01T04:00:00Z');
" >/dev/null

query "select public.redeem_draft_pro_access_code('$USER_ID','$RAW_CODE')" > "$OUTPUT_DIRECTORY/one" &
first_pid=$!
query "select public.redeem_draft_pro_access_code('$USER_ID','$RAW_CODE')" > "$OUTPUT_DIRECTORY/two" &
second_pid=$!
wait "$first_pid"
wait "$second_pid"

results="$(sort "$OUTPUT_DIRECTORY/one" "$OUTPUT_DIRECTORY/two" | tr '\n' ',')"
entitlements="$(query "select count(*) from public.user_entitlements where user_id='$USER_ID' and source_provider='complimentary' and entitlement_status='active'")"
attempts="$(query "select attempt_count from public.draft_pro_access_code_attempts where user_id='$USER_ID'")"
if [[ "$results" != 'redeemed,redeemed,' || "$entitlements" != '1' || "$attempts" != '1' ]]; then
  echo "Access-code race failed: results=$results entitlements=$entitlements attempts=$attempts" >&2
  exit 1
fi

echo 'access_code_race=passed; results=idempotent-redeemed; entitlement=one; attempts=one'
