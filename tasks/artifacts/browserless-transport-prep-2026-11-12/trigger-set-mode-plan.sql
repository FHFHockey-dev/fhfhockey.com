-- NOT AUTHORIZED TO RUN. Fill BOTH constants only from an approved preflight receipt.
-- Disable: desired_mode D. Rollback: exact prior O/R/A/D, never guessed.
-- Run as one transaction; any failed assertion/time limit must abort, never continue.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
SET LOCAL idle_in_transaction_session_timeout = '30s';
DO $quarantine$
DECLARE
  expected_fingerprint constant text := 'PREFLIGHT_FINGERPRINT_REQUIRED';
  desired_mode constant text := 'APPROVED_MODE_REQUIRED';
  before_state jsonb;
  after_state jsonb;
  expected_after jsonb;
  prior_mode text;
  operation text;
BEGIN
  IF expected_fingerprint !~ '^[0-9a-f]{32}$' OR desired_mode NOT IN ('O','D','R','A') THEN
    RAISE EXCEPTION 'Approved current-state fingerprint and exact mode required';
  END IF;
  LOCK TABLE ONLY public."lineCombinations" IN SHARE ROW EXCLUSIVE MODE;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class
      WHERE oid='public."lineCombinations"'::regclass AND relkind='r')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_inherits
      WHERE inhparent='public."lineCombinations"'::regclass
         OR inhrelid='public."lineCombinations"'::regclass) THEN
    RAISE EXCEPTION 'Unexpected table topology; stop and review';
  END IF;

  select coalesce(jsonb_agg(jsonb_build_object(
    'oid', t.oid, 'name', t.tgname, 'enabled', t.tgenabled,
    'table_oid', t.tgrelid, 'function_oid', t.tgfoid,
    'function_schema', n.nspname, 'function_name', f.proname,
    'type', t.tgtype, 'internal', t.tgisinternal, 'args_count', t.tgnargs,
    'definition_hash', md5(pg_get_triggerdef(t.oid)),
    'function_hash', md5(pg_get_functiondef(t.tgfoid))
  ) order by t.tgname), '[]'::jsonb)
  INTO before_state
  FROM pg_catalog.pg_trigger t
  JOIN pg_catalog.pg_proc f ON f.oid = t.tgfoid
  JOIN pg_catalog.pg_namespace n ON n.oid = f.pronamespace
  WHERE t.tgrelid = 'public."lineCombinations"'::regclass;
  IF md5(before_state::text) IS DISTINCT FROM expected_fingerprint THEN
    RAISE EXCEPTION 'Trigger state changed since approved preflight';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(before_state) t
    WHERE t->>'name'='after_line_combo_insert'
      AND t->>'function_schema'='public' AND t->>'function_name'='on_new_line_combo'
      AND t->>'internal'='false' AND t->>'type'='5' AND t->>'args_count'='0') THEN
    RAISE EXCEPTION 'Target identity/AFTER INSERT ROW shape mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(before_state) t
    WHERE t->>'name'='after_player_underlying_stats_insert'
      AND t->>'function_schema'='public' AND t->>'function_name'='on_new_player_underlying_stats')
    OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(before_state) t
    WHERE t->>'name'='update_power_play_combinations_after_line_combo_insert'
      AND t->>'function_schema'='public' AND t->>'function_name'='update_power_play_combinations') THEN
    RAISE EXCEPTION 'Adjacent trigger identities differ; stop and review';
  END IF;
  SELECT t->>'enabled' INTO prior_mode FROM jsonb_array_elements(before_state) t
    WHERE t->>'name'='after_line_combo_insert';
  operation := CASE desired_mode
    WHEN 'D' THEN 'DISABLE' WHEN 'O' THEN 'ENABLE'
    WHEN 'R' THEN 'ENABLE REPLICA' WHEN 'A' THEN 'ENABLE ALWAYS' END;
  EXECUTE format('ALTER TABLE ONLY public."lineCombinations" %s TRIGGER after_line_combo_insert', operation);

  select coalesce(jsonb_agg(jsonb_build_object(
    'oid', t.oid, 'name', t.tgname, 'enabled', t.tgenabled,
    'table_oid', t.tgrelid, 'function_oid', t.tgfoid,
    'function_schema', n.nspname, 'function_name', f.proname,
    'type', t.tgtype, 'internal', t.tgisinternal, 'args_count', t.tgnargs,
    'definition_hash', md5(pg_get_triggerdef(t.oid)),
    'function_hash', md5(pg_get_functiondef(t.tgfoid))
  ) order by t.tgname), '[]'::jsonb)
  INTO after_state
  FROM pg_catalog.pg_trigger t
  JOIN pg_catalog.pg_proc f ON f.oid = t.tgfoid
  JOIN pg_catalog.pg_namespace n ON n.oid = f.pronamespace
  WHERE t.tgrelid = 'public."lineCombinations"'::regclass;
  SELECT jsonb_agg(CASE WHEN t->>'name'='after_line_combo_insert'
      THEN t || jsonb_build_object('enabled', desired_mode) ELSE t END ORDER BY t->>'name')
    INTO expected_after FROM jsonb_array_elements(before_state) t;
  IF after_state IS DISTINCT FROM expected_after THEN
    RAISE EXCEPTION 'Unexpected trigger/function change; rolling back';
  END IF;
  RAISE NOTICE 'line-combo prior_mode=%, new_mode=%, before_fingerprint=%, after_fingerprint=%',
    prior_mode, desired_mode, expected_fingerprint, md5(after_state::text);
END;
$quarantine$;
COMMIT;
