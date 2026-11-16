-- PROPOSAL ONLY. Not approved or executed. Project fyhftlxokyjtpndbkfse.
-- Run Q1 alone and inspect it, then one block at a time. Concurrency 1, no retries.
-- Stop if active_others >5, max_active_seconds >10, visibility_unknown >0,
-- any error, missing expected object or row-limit sentinel. Roll back an aborted
-- transaction then stop. No app data, query text, RPC execution or writes.
-- D4 alternative: exact one-claim hashes/metadata, no packet/statement/token bytes returned.
-- Stop unless exactly1 complete row, stored_bytes<=4194304 and expected hashes match.
-- Q1 hygiene1 row; Q2 expected1/limit2 sentinel.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SELECT
  count(*) FILTER (WHERE state = 'active') AS active_others,
  coalesce(max(greatest(0::numeric, extract(epoch FROM (statement_timestamp() - query_start))))
    FILTER (WHERE state = 'active'), 0) AS max_active_seconds,
  count(*) FILTER (WHERE (state IS NULL AND (backend_type IN ('client backend','parallel worker') OR backend_type IS NULL))
    OR (state = 'active' AND query_start IS NULL)) AS visibility_unknown
FROM pg_catalog.pg_stat_activity
WHERE pid <> pg_catalog.pg_backend_pid();
COMMIT;
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SELECT c.id,c.game_id,c.policy_id,c.code_version,c.ack_deadline,
 a.raw_sha256,a.canonical_sha256,a.byte_length,a.xmin::text AS row_version,
 CASE WHEN pg_catalog.octet_length(a.packet)<=4194304 THEN pg_catalog.encode(pg_catalog.sha256(a.packet),'hex') ELSE NULL END AS computed_raw_sha256,
 pg_catalog.octet_length(a.packet) AS stored_bytes,
 pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(w.statement_text,'UTF8')),'hex') AS statement_sha256,
 pg_catalog.encode(pg_catalog.sha256(w.tsa_token),'hex') AS token_sha256,
 w.verdict,o.outcome
FROM forge_pregame_capture.claims c
LEFT JOIN forge_pregame_capture.artifacts a ON a.claim_id=c.id
LEFT JOIN forge_pregame_capture.witnesses w ON w.claim_id=c.id
LEFT JOIN forge_pregame_capture.outcomes o ON o.claim_id=c.id
WHERE c.id='4a02a2c0-48b0-4b51-88a0-b57c67bc2cf2'::uuid
  AND c.game_id=2026020328 AND c.policy_id='pregame-native-v1'
LIMIT 2;
COMMIT;
