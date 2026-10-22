# D4 independent offline review commands

Cwd: `/Users/tim/Code/fhfhockey.com`. No database binary, SQL replay, service request or environment workaround was executed.

```sh
# Actual result: 6 tests, OK, exit 0.
python3 -I tasks/artifacts/d4-grants-2026-10-20/test_harness.py

# Actual result: exit 0. Output equals repair preflight.json exactly.
# This --check mode creates no cluster or receipt directory.
python3 -I tasks/artifacts/d4-grants-2026-10-20/harness.py v900000002 20261020224500_data_api_explicit_default_privileges.sql 20261020224600_data_api_reviewed_object_grants.sql --check

# Static source/TAP/ACL reconciliation plus eight pure classifier probes; no SQL.
python3 -I tasks/artifacts/d4-grants-independent-review-2026-10-22/reconcile_preflight.py

git diff --check -- tasks/artifacts/d4-grants-2026-10-20/harness.py tasks/artifacts/d4-grants-2026-10-20/test_harness.py supabase/tests/data_api_grants.sql
```

`harness.py` and `test_harness.py` syntax was checked with `ast.parse`, without importing/executing the harness or generating bytecode. Start/end checks used `hashlib.sha256` against all candidate and authority hashes. The direct --check ran under a minimal environment with a 15-second subprocess bound; its output is in `preflight.json`.

`reconcile_preflight.py` parses current explicit migration 90 grants, current matrix expectations, and historical v7 TAP/ACL rows. Its only executed harness statements are the six pure TAP classification assignments extracted via AST. It does not import or invoke the replay/cluster paths. Its first revision overmatched GRANT statements across semicolons; the corrected statement-bounded parser passed. Retained results: `reconciliation.json` and `reconciled-expectations.json`.

The saved historical v9 initdb failure was inspected only. Its sandbox restriction was not retried, bypassed or escalated. Fresh positive/negative SQL replay and real PostgREST/hosted gates remain open.
