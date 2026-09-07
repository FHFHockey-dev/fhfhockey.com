# Draft Pro local database verification

Run the reusable harness from the repository root after receiving the committed W01 migration:

```sh
web/scripts/draft-pro/verify-local-migration.sh supabase/migrations/<w01-migration>.sql
```

It starts a uniquely named `public.ecr.aws/supabase/postgres:15.8.1.085` container, binds PostgreSQL only to a Docker-assigned `127.0.0.1` port, replays the committed `20260716112908_production_schema_baseline.sql`, then applies the supplied committed migration. The harness rejects the repository Supabase port (`54322`), verifies that `auth.users` and `public.user_entitlements` come from the real baseline, prints a compact catalog result, and always removes its container.

This is intentionally a disposable, schema-only environment: it contains no production data, no provider credentials, no Supabase CLI state, and no storage/API services. The W01 handoff supplies the migration path and table/policy contract needed for the focused two-user RLS and storage-boundary probes.
