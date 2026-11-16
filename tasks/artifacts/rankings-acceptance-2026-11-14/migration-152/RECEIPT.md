# Migration 152 apply receipt (ranking_publications)

- **Approval:** TJ's pop-up, 2026-11-15, "Apply + 2-read smoke".
- **Output folder:** `~/rankings-migration-152-20261115T201643Z`, private (0700, outside the repository).
- **Preflight** at 20:16:45Z and again at 20:16:49Z: active=0, longest=0s, lock_waits=0, cron_running=0, no ledger row, no table, not a superuser, 3/3 roles.
- **Apply:** one transaction, committed at **2026-11-15 20:16:50.128048Z** (database clock). It ran CREATE TABLE, CREATE INDEX, ALTER TABLE (RLS), REVOKE, GRANT, COMMENT, the ledger INSERT and NOTIFY pgrst.
- **Readback:** `1|t|20|t|t|t|t|f|f|f|f|f|t`, exactly as expected.
- **Smoke** (2 read-only requests): SQL as service_role returned `rows 0`; PostgREST GET returned HTTP 200 with 0 rows.
- **Effect on live Rankings:** none. The deployed reader doesn't read this table yet.
