"""Prepare proposals only. Never connects to a database."""
import json
from pathlib import Path

HERE = Path(__file__).parent
one = json.loads((HERE / "catalog-batch-1/comparison.json").read_text())
two = json.loads((HERE / "catalog-batch-2/comparison.json").read_text())
views = sorted([r["object"].replace('"', '') for r in one["objects"] if r["kind"] == "view"] +
               [r["object"].replace('"', '') for r in two["object_table"] if r["applied_matches_source"] == "unverified"])
assert len(views) == 27
names = ",\n    ".join("('" + v.split('.', 1)[1].replace("'", "''") + "')" for v in views)
prefix = "BEGIN READ ONLY;\nSET LOCAL statement_timeout = '5s';\nSET LOCAL lock_timeout = '1s';\nSET LOCAL idle_in_transaction_session_timeout = '15s';\n"
health = (HERE / "live-page-restart-health.sql").read_text().split("BEGIN READ ONLY;", 1)[1]
health = "BEGIN READ ONLY;" + health
intro = """-- PROPOSAL ONLY. Not approved or executed. Project fyhftlxokyjtpndbkfse.
-- Run Q1 alone and inspect it, then one block at a time. Concurrency 1, no retries.
-- Stop if active_others >5, max_active_seconds >10, visibility_unknown >0,
-- any error, missing expected object or row-limit sentinel. Roll back an aborted
-- transaction then stop. No app data, query text, RPC execution or writes.
"""
cte = "WITH wanted(name) AS (VALUES\n    " + names + "\n), targets AS (SELECT c.oid,c.relname FROM wanted w LEFT JOIN pg_catalog.pg_class c ON c.relnamespace='public'::regnamespace AND c.relname=w.name)\n"
q2 = prefix + cte + "SELECT t.relname,t.oid,r.ev_action::text AS compiled_rule,pg_catalog.pg_get_viewdef(t.oid,true) AS definition FROM targets t LEFT JOIN pg_catalog.pg_rewrite r ON r.ev_class=t.oid AND r.rulename='_RETURN' ORDER BY t.relname LIMIT 28;\nCOMMIT;\n"
q3 = prefix + cte + "SELECT t.relname,d.refclassid,d.refobjid,d.refobjsubid,d.deptype,pg_catalog.pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid) AS dependency FROM targets t JOIN pg_catalog.pg_rewrite r ON r.ev_class=t.oid AND r.rulename='_RETURN' JOIN pg_catalog.pg_depend d ON d.classid='pg_catalog.pg_rewrite'::regclass AND d.objid=r.oid ORDER BY t.relname,d.refclassid,d.refobjid,d.refobjsubid LIMIT 2001;\nCOMMIT;\n"
q4 = prefix + cte + "SELECT DISTINCT n.nspname,c.relname,a.attnum,a.attname,a.atttypid,a.atttypmod,pg_catalog.format_type(a.atttypid,a.atttypmod) AS type FROM targets t JOIN pg_catalog.pg_rewrite r ON r.ev_class=t.oid AND r.rulename='_RETURN' JOIN pg_catalog.pg_depend d ON d.classid='pg_catalog.pg_rewrite'::regclass AND d.objid=r.oid AND d.refclassid='pg_catalog.pg_class'::regclass JOIN pg_catalog.pg_class c ON c.oid=d.refobjid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped ORDER BY n.nspname,c.relname,a.attnum LIMIT 2001;\nCOMMIT;\n"
(HERE / "PROPOSED-catalog-bindings.sql").write_text(intro + "-- Q1: one hygiene row.\n" + health + "\n-- Q2: 27 rules; limit28 sentinel.\n" + q2 + "\n-- Q3: dependencies; limit2001 sentinel.\n" + q3 + "\n-- Q4: referenced relation columns; limit2001 sentinel.\n" + q4)
cron = prefix + "SELECT jobid,schedule,active FROM cron.job WHERE jobid IN (283,305,364,388) ORDER BY jobid LIMIT 5;\nCOMMIT;\n"
history = prefix + "SELECT j.jobid,d.runid,d.status,d.start_time,d.end_time FROM (VALUES (283::bigint),(305::bigint),(364::bigint),(388::bigint)) j(jobid) LEFT JOIN LATERAL (SELECT runid,status,start_time,end_time FROM cron.job_run_details WHERE jobid=j.jobid ORDER BY runid DESC LIMIT 2) d ON true ORDER BY j.jobid,d.runid;\nCOMMIT;\n"
(HERE / "PROPOSED-cron-state.sql").write_text(intro + "-- Q1 one row; Q2 four jobs/limit5 sentinel; Q3 at most8 metadata rows.\n" + health + cron + history)
pilot = prefix + """SELECT c.id,c.game_id,c.policy_id,c.code_version,c.ack_deadline,
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
"""
(HERE / "PROPOSED-pilot3-hash-readback.sql").write_text(intro + """-- D4 alternative: exact one-claim hashes/metadata, no packet/statement/token bytes returned.
-- Stop unless exactly1 complete row, stored_bytes<=4194304 and expected hashes match.
-- Q1 hygiene1 row; Q2 expected1/limit2 sentinel.
""" + health + pilot)
print("Prepared three separate unapproved SELECT batches; executed none.")
