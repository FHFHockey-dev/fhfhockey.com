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

With three ordered migrations, pass the saved-drafts transaction migration as the third argument and set `DRAFT_PRO_EXTRA_PROBE` to its committed transaction probe. The harness preserves the foundation and Stripe probes, then runs the saved-draft session, quota, replacement, duplicate, delete-cleanup, version, and ownership assertions in the same disposable database.

## Saved Drafts real-service routes and browser

From the repository root, with Docker running, the existing `web/node_modules` installation, and Playwright Chromium available:

```sh
web/scripts/draft-pro/verify-saved-drafts-routes.sh
```

This separate harness starts disposable local Postgres, GoTrue, PostgREST, Storage, a loopback gateway, and Next. It applies the baseline and three Draft Pro migrations, seeds synthetic users and entitlements, and uses locally signed test tokens. It does not use production data, provider credentials, live payments, or email delivery.

The route runner saves a populated draft with a private normalized import and restores its snapshot and downloaded file through a second token for the same account. Assertions cover file integrity, picks, keepers, trades, settings, source controls, favorites, notes, tiers, another user's denied access, inactive names-only access, blocked payload/write/file operations, retained data after reactivation, and a stale-version conflict.

The browser runner then exercises the actual dashboard in separate account sessions: populated private-CSV restoration, hidden-panel autosave, failed-save local preservation and retry, conflict reload, and saving a conflict as another draft while preserving the original. Inactive users retain manual picks but see locked cloud items. Public projection fixtures are synthetic; account authentication, Saved Drafts routes, database, and private Storage remain real local services. One deliberately aborted request tests network recovery.

For browser-only iteration after the route assertions have already passed:

```sh
DRAFT_PRO_BROWSER_ONLY=true web/scripts/draft-pro/verify-saved-drafts-routes.sh
```

For styling-only corrections, set both `DRAFT_PRO_BROWSER_ONLY=true` and `DRAFT_PRO_VISUAL_ONLY=true`. This retains real save/restore setup and loaded screenshots but skips the already-approved retry, conflict, and revocation cases.

Set `DRAFT_PRO_BROWSER_ARTIFACTS` to retain screenshots in a chosen directory; the default is `/tmp/draft-pro-saved-drafts-artifacts`. Evidence includes keyboard activation, a 390px mobile viewport, asserted 200% pinch magnification, and a 640px CSS viewport for enlarged-layout reflow. The latter is equivalent in CSS width to a 1280px desktop at 200%; it is not an actual browser-chrome zoom test. Inspect the loaded controls in the screenshots as a separate visual acceptance gate.

The final success marker includes `cleanup=verified` only after the harness removes its services and listening ports. A browser-only run does not rerun the separate route assertion suite.
