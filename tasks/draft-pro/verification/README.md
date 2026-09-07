# Draft Pro local database verification

Run the reusable harness from the repository root after receiving the committed W01 migration:

```sh
web/scripts/draft-pro/verify-local-migration.sh supabase/migrations/<w01-migration>.sql
```

To validate an unintegrated, committed work-order revision exactly, pass its immutable Git object and migration path instead:

```sh
web/scripts/draft-pro/verify-local-migration.sh <commit>:supabase/migrations/<w01-migration>.sql
```

Pass foundation and follow-on migrations in order to run the Stripe concurrency probe as well:

```sh
web/scripts/draft-pro/verify-local-migration.sh <foundation-commit>:supabase/migrations/<foundation>.sql <stripe-commit>:supabase/migrations/<stripe>.sql
```

It starts a uniquely named `public.ecr.aws/supabase/postgres:15.8.1.085` container, binds PostgreSQL only to a Docker-assigned `127.0.0.1` port, and replays the committed `20260716112908_production_schema_baseline.sql`. Before application SQL, it extracts and applies the current cached `public.ecr.aws/supabase/storage-api:v1.69.0` additive bucket migrations for the `public` flag, MIME limits, and byte-size limit; the Postgres image alone has only the historic Storage schema. It then applies the supplied committed migration. The harness rejects the repository Supabase port (`54322`), verifies that `auth.users` and `public.user_entitlements` come from the real baseline, prints a compact catalog result, and always removes its containers and temporary migration files.

This is intentionally a disposable, schema-only environment: it contains no production data, no provider credentials, no Supabase CLI state, and no storage/API services. The W01 handoff supplies the migration path and table/policy contract needed for the focused two-user RLS and storage-boundary probes.

When a migration is supplied, the harness runs `web/scripts/draft-pro/foundation-rls-probes.sql` in a rolled-back transaction. It creates two synthetic local subjects, marks one entitlement expired, and proves neither authenticated subject can directly read or write Draft Pro payloads or the private import bucket. The probe temporarily adds generic authenticated/anonymous Storage policies and proves the restrictive private-bucket policies still block both roles while allowing an unrelated bucket. It also asserts the Draft Pro table/RLS/grant counts, private bucket configuration, and its three Storage policies.

With two migrations, `stripe-concurrency-probes.sh` uses separate named PostgreSQL sessions to hold the checkout advisory lock and purchase row lock. Two background workers are observed waiting behind each lock before release; assertions require one shared pending purchase ID, one processed duplicate event, one provider-event row, and one active entitlement.
