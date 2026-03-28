## Relevant Files

- `migrations/20260326_create_auth_user_settings_platform.sql` - Creates the MVP user tables, deferred-provider tables, indexes, constraints, triggers, and RLS policies described in the PRD.
- `migrations/20260327_encrypt_connected_account_tokens_with_vault.sql` - Moves provider token material out of plaintext columns and into Supabase Vault-backed secret references.
- `web/lib/supabase/database-generated.types.ts` - Generated Supabase types that must be updated after the schema migration so app code can use the new tables safely.
- `web/lib/supabase/client.ts` - Browser Supabase client used by auth UI flows and client-side account/settings requests.
- `web/lib/supabase/index.ts` - Existing shared Supabase wrapper that may need consolidation or cleanup for global auth/session handling.
- `web/lib/supabase/public-client.ts` - Public client used in read-only contexts; should remain safe and not gain authenticated user-only responsibilities.
- `web/lib/supabase/server.ts` - Server-side Supabase client wrapper that will need clear separation between service-role and user-session usage.
- `web/lib/cron/withCronJobAudit.test.ts` - Tests for audit-log persistence and timing capture in cron/API wrappers that now use the explicit service-role client.
- `web/__tests__/pages/api/v1/db/update-wgo-averages.route.test.ts` - Route test covering structured dependency-error behavior after the API moved to the explicit service-role client.
- `web/contexts/AuthProviderContext/index.tsx` - Global auth state provider that must be expanded beyond the current minimal role lookup.
- `web/pages/_app.tsx` - App root where auth-aware provider wiring must become global so the header can react to session state on every route.
- `web/components/Layout/Header/Header.tsx` - Header entry point for the logged-out `Sign-in / Sign-up` button and logged-in avatar menu.
- `web/components/Layout/Header/Header.module.scss` - Header styling updates for the new auth CTA and avatar/menu affordances.
- `web/__tests__/components/Layout/Header.test.tsx` - Component tests for logged-out header CTA rendering, modal launch, and logged-in header state handoff.
- `web/components/auth/AuthModal.tsx` - Modal container for sign-in, sign-up, forgot-password, and verification guidance flows.
- `web/components/auth/AuthModal.module.scss` - Styles for the header-triggered auth modal shell.
- `web/components/auth/AuthModal.test.tsx` - Component tests for auth modal rendering, mode switching, and main interaction states.
- `web/components/auth/AuthForm.tsx` - Form logic for Google sign-in, email/password sign-in, sign-up, and password recovery requests.
- `web/components/auth/AuthForm.module.scss` - Styles for the in-modal Google and email/password auth form states.
- `web/__tests__/components/auth/AuthForm.test.tsx` - Component tests for auth form validation, submit states, and auth-method branches.
- `web/components/auth/UserMenu.module.scss` - Styles for the logged-in avatar trigger and account tray/menu.
- `web/components/auth/UserMenu.tsx` - Logged-in avatar trigger and tray/menu for sign out, account settings, and league settings entry points.
- `web/__tests__/components/auth/UserMenu.test.tsx` - Component tests for avatar menu actions and authenticated header states.
- `web/pages/auth/index.tsx` - Existing auth page that should be reduced to a compatible fallback or redirect-oriented surface after the modal flow is introduced.
- `web/pages/auth/callback.tsx` - OAuth and verification callback handler route for Supabase redirects.
- `web/pages/auth/Callback.module.scss` - Styles for the callback status page that handles OAuth and email-link completion states.
- `web/__tests__/pages/auth/callback.test.tsx` - Route-level tests for callback code exchange and redirect behavior.
- `web/pages/auth/reset-password.tsx` - Password reset page for recovery links and password update UX.
- `web/pages/auth/ResetPassword.module.scss` - Styles for the dedicated reset-password recovery page.
- `web/__tests__/pages/auth/reset-password.test.tsx` - Tests for reset-password token handling, validation, and successful reset flow.
- `tasks/auth-provider-manual-config.md` - Manual Supabase and Google Cloud configuration checklist for the implemented auth flows.
- `web/pages/account/index.tsx` - Account settings route entry point for authenticated users.
- `web/__tests__/pages/account/index.test.tsx` - Smoke tests for the authenticated account route shell and unauthenticated fallback prompt.
- `web/components/account/AccountSettingsPage.tsx` - Main account settings UI for profile, league defaults, saved teams, connected accounts placeholders, and Patreon placeholder controls.
- `web/components/account/AccountSettingsPage.module.scss` - Styles for the authenticated account-settings shell and section navigation.
- `web/__tests__/components/account/AccountSettingsPage.test.tsx` - Component tests for account settings sections, profile editing, empty states, and guarded actions.
- `web/lib/user-settings/defaults.ts` - Central default values for profile/settings rows seeded from the existing fantasy config system.
- `web/lib/user-settings/defaults.test.ts` - Unit tests for default settings generation and schema-safe fallback values.
- `web/lib/user-settings/ensureUserRecords.ts` - Auth-time helper that creates or backfills missing `user_profiles` and `user_settings` rows for newly signed-in users.
- `web/lib/user-settings/mappers.ts` - Mapping helpers between persisted user settings and the existing fantasy config shapes already used in the app.
- `web/lib/user-settings/mappers.test.ts` - Unit tests for mapping between database rows and app-facing settings objects.
- `web/lib/projectionsConfig/fantasyPointsConfig.ts` - Existing reference for default fantasy scoring that should inform seeded account settings without changing Draft Dashboard behavior.
- `web/pages/api/` - Existing API route area that may need a small authenticated settings endpoint layer if direct client-table access is not sufficient for some account operations.
- `fhfh-styles.md` - Local FHFH design-system rules for applying the Neon Noir / Cyberpunk visual language to auth and account surfaces.
- `tasks/prd-auth-user-settings-platform.md` - Source PRD this task list implements.
- `tasks/tasks-prd-auth-user-settings-platform.md` - Implementation task list for the feature.

### Notes

- Unit tests should typically be placed alongside the code files they are testing.
- This repo currently uses Vitest rather than Jest, so run targeted tests with `npx vitest run [optional/path/to/test/file]`.
- Regenerate `web/lib/supabase/database-generated.types.ts` after the migration is applied.
- Do not modify `web/components/DraftDashboard/DraftDashboard.tsx` in this feature pass.
- Do not modify `web/pages/api/v1/db/manual-refresh-yahoo-token.ts` in this feature pass.

## Tasks

- [x] 1.0 Build the Supabase-backed user data foundation for profiles, settings, saved teams, and future connected-account support
  - [x] 1.1 Create a migration for `user_profiles`, `user_settings`, and `user_saved_teams` with UUID-based ownership keyed to `auth.users.id`.
  - [x] 1.2 Add the deferred-design tables needed for future provider support, including `connected_accounts`, provider preference records, external league/team metadata tables, sync-run tracking, and Patreon/site entitlement placeholders.
  - [x] 1.3 Add indexes, uniqueness constraints, and ownership constraints needed for default-team selection, provider identity uniqueness, and future Patreon anti-sharing enforcement.
  - [x] 1.4 Add RLS policies so authenticated users can only read and mutate their own profile, settings, saved teams, and future provider-owned rows.
  - [x] 1.5 Ensure provider token storage is modeled as service-role-only or otherwise not client-readable, even if full provider token handling is deferred.
  - [x] 1.6 Define sensible database defaults for fantasy scoring, league type, roster config, UI preferences, and active-context placeholders using the existing fantasy config references.
  - [x] 1.7 Apply the migration in the appropriate environment and regenerate `web/lib/supabase/database-generated.types.ts`.

- [x] 2.0 Refactor app-wide auth state and Supabase client handling so authenticated session state is available globally and safely
  - [x] 2.1 Audit the current Supabase wrappers in `web/lib/supabase/` and choose a clear responsibility split for browser auth, public read-only access, and service-role server access.
  - [x] 2.2 Expand `AuthProviderContext` to expose a richer authenticated user shape, including ID, email, display name, avatar URL, verification-aware metadata, and admin role where available.
  - [x] 2.3 Update `web/pages/_app.tsx` so auth-aware context is available globally rather than only on `/auth` and `/db` routes.
  - [x] 2.4 Ensure auth state initializes correctly on first page load and responds to Supabase auth state changes without flicker or route-specific assumptions.
  - [x] 2.5 Add helper logic for creating or reconciling app-owned profile/settings rows after successful authentication if they do not already exist.
  - [x] 2.6 Verify that existing admin-only flows depending on the current `public.users` role table still work after the auth refactor.

- [x] 3.0 Implement the header authentication entry flow with a logged-out sign-in/sign-up button and a logged-in avatar menu
  - [x] 3.1 Update `Header.tsx` to render a logged-out `Sign-in / Sign-up` CTA to the right of `.bmcWrap`.
  - [x] 3.2 Add the logged-in avatar trigger in the same header area, using a safe avatar fallback strategy when no provider image exists.
  - [x] 3.3 Build the logged-in tray or menu with at least `Account Settings`, `League Settings`, and `Sign Out`.
  - [x] 3.4 Wire the logged-out CTA to open the auth modal and wire the logged-in actions to the correct routes or placeholders.
  - [x] 3.5 Update header styles so the new auth UI works in the existing desktop/mobile header system without disrupting current navigation behavior.
  - [x] 3.6 Add component tests covering logged-out, logged-in, and sign-out/menu interaction states.

- [x] 4.0 Implement the core auth UX flows for Google sign-in, email/password, email verification, callback handling, and password reset
  - [x] 4.1 Build an `AuthModal` that supports sign-in, sign-up, and forgot-password modes without requiring a dedicated page for normal entry.
  - [x] 4.2 Build an `AuthForm` that supports Google OAuth initiation and email/password sign-in/sign-up submission through Supabase Auth.
  - [x] 4.3 Add clear UX states for email verification required, existing-account collisions, OAuth errors, invalid credentials, and recovery-email success.
  - [x] 4.4 Implement the Supabase callback route for OAuth code exchange and verification-related redirects.
  - [x] 4.5 Implement the reset-password page so recovery links can land on a dedicated route and allow secure password updates.
  - [x] 4.6 Rework the existing `/auth` page into a compatible fallback surface or redirect-oriented helper page that does not conflict with the new modal-first UX.
  - [x] 4.7 Add route/component tests for callback handling, password reset flow, and auth-form state transitions.
  - [x] 4.8 Document the manual provider configuration required in Supabase and Google Cloud, including site URL, redirect allow list, callback URL, and OAuth client settings.

- [x] 5.0 Build the MVP Account Settings experience and design-safe placeholders for league settings, connected accounts, provider refresh controls, and Patreon entitlements
  - [x] 5.1 Create the authenticated `/account` route and main `AccountSettingsPage` shell.
  - [x] 5.2 Add profile management UI backed by `user_profiles`, including display name and avatar display state.
  - [x] 5.3 Add league-default settings UI backed by `user_settings`, using the persisted fantasy scoring and roster-config mapping helpers without touching Draft Dashboard.
  - [x] 5.4 Add the MVP saved-teams UI backed by `user_saved_teams`, including create, edit, list, and default-selection behavior for manual saved teams.
  - [x] 5.5 Add non-implemented but explicit connected-account sections for Yahoo, Fantrax, Patreon, and ESPN so the architecture is visible without shipping the real sync flows yet.
  - [x] 5.6 Add design placeholders for future provider features including multiple linked leagues/teams, default team selection, active-context switching, refresh-on-login preference, manual refresh, cooldown messaging, and in-flight dedupe states.
  - [x] 5.7 Add Patreon entitlement placeholders on the account page that make clear Patreon is connected from account settings rather than used as primary site login.
  - [x] 5.8 Add guarded authenticated-page behavior for unauthenticated users and loading/error states for missing profile/settings rows.
  - [x] 5.9 Add component tests for account settings rendering, saved-team CRUD states, default-team behavior, and connected-account placeholder visibility.

- [x] 6.0 Enforce cross-table ownership consistency for provider-linked records discovered during schema design
  - [x] 6.1 Add composite foreign keys, constraints, or trigger-based validation so provider-linked rows cannot reference `connected_account_id`, `external_league_id`, or `external_team_id` owned by a different `user_id`.

- [x] 7.0 Harden provider secret storage before any real Yahoo, Fantrax, Patreon, or ESPN tokens are written
  - [x] 7.1 Choose and implement an at-rest encryption strategy for `private.connected_account_tokens` instead of relying on plain text token columns.

- [x] 8.0 Migrate ambiguous Supabase imports to explicit client roles discovered during the wrapper audit
  - [x] 8.1 Replace server-side and API-route imports of `lib/supabase` with explicit browser, public, authenticated-token, or service-role clients based on actual access requirements.

- [ ] NEW 9.0 Complete the manual Supabase email-auth delivery configuration required for sign-up verification and password recovery
  - [x] NEW 9.1 Enable `Email` auth in the Supabase dashboard for the target environment.
  - [x] NEW 9.2 Confirm that `Confirm email` is enabled so password sign-up requires verification before protected settings access.
  - [x] NEW 9.3 Verify the Supabase auth email templates preserve the app-provided redirect target so verification and recovery links return to the implemented callback/reset flow.
  - [x] NEW 9.4 Verify the Supabase `Site URL` and redirect allow-list entries for localhost, production, and any required preview URLs.
  - [ ] NEW 9.5 Configure a working SMTP sender or otherwise verify outbound email delivery in the active Supabase environment so sign-up and recovery emails actually arrive.

- [ ] NEW 10.0 Complete the remaining manual auth-provider configuration and verification checklist documented in `tasks/auth-provider-manual-config.md`
  - [ ] NEW 10.1 Confirm required deploy environment values exist and are correct: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY`.
  - [x] NEW 10.2 Verify Google Cloud OAuth client configuration, including authorized JavaScript origins and the hosted Supabase callback URI.
  - [ ] NEW 10.3 Run the documented manual verification checklist for Google sign-in on localhost and production.
  - [ ] NEW 10.4 Run the documented manual verification checklist for email sign-up verification, callback completion, and password-recovery flow.
  - [ ] NEW 10.5 Verify preview-deployment auth behavior if preview auth support is required.

- [ ] NEW 11.0 Complete Supabase Vault readiness checks before any live Yahoo, Fantrax, Patreon, or ESPN tokens are written
  - [ ] NEW 11.1 Confirm the `vault` schema and extension are available in each target Supabase environment before applying `20260327_encrypt_connected_account_tokens_with_vault.sql`.
  - [ ] NEW 11.2 Verify after migration that `anon` and `authenticated` do not have direct access to `vault.secrets` or `vault.decrypted_secrets`.
  - [ ] NEW 11.3 Review database statement-logging settings for environments that will write provider tokens so plaintext token values are not exposed in logs during Vault writes.

- [ ] NEW 12.0 Recover and re-apply the Vault token-storage migration in environments where the first run failed partway through
  - [ ] NEW 12.1 Apply the corrected `20260327_encrypt_connected_account_tokens_with_vault.sql` migration after pulling the fix for the missing-column rerun case.
  - [ ] NEW 12.2 Verify that `private.connected_account_tokens` now has `access_token_secret_id` and `refresh_token_secret_id` and no longer has plaintext `access_token` or `refresh_token` columns.

- [ ] NEW 13.0 Tighten service-role client initialization and configuration guarantees after the explicit-import refactor
  - [ ] NEW 13.1 Confirm `SUPABASE_SERVICE_ROLE_KEY` is configured in every environment that will run service-role API routes and cron jobs.
  - [ ] NEW 13.2 Replace the current test-safe service-role fallback with a stricter lazy initialization or test bootstrap pattern once env loading is standardized.

- [ ] NEW 14.0 Resolve custom SMTP delivery failure for Supabase Auth emails
  - [x] NEW 14.1 Verify the custom SMTP configuration saves successfully and is accepted by Supabase without provider-auth errors.
  - [ ] NEW 14.2 Check junk/spam/quarantine and recipient-side filtering for verification and reset emails.
  - [x] NEW 14.3 If delivery still fails, retry with the alternate Namecheap SMTP submission port and security mode combination supported by Private Email.
  - [x] NEW 14.4 Confirm the configured sender mailbox is allowed to send via the chosen SMTP credentials and is not blocked by provider policy.
  - [ ] NEW 14.5 Send a fresh sign-up verification and password reset email and confirm end-to-end delivery.

- [ ] NEW 15.0 Fix recovery-link handling so password reset links open the reset screen instead of silently signing the user in
  - [x] NEW 15.1 Route hash-based Supabase recovery sessions through `/auth/reset-password` in the callback handler.
  - [x] NEW 15.2 Add a regression test covering recovery links that arrive with `access_token` and `refresh_token` in the hash.
  - [x] NEW 15.3 Route code-based Supabase recovery callbacks through `/auth/reset-password` instead of treating them like standard OAuth sign-in.
  - [x] NEW 15.4 Add a regression test covering recovery links that arrive with `code=...&type=recovery`.

- [x] NEW 16.0 Verify the recovery-flow fix against a runtime that actually includes the patched callback handler
  - [x] NEW 16.1 Run the updated local app or deploy the latest callback fix before re-testing password recovery.
  - [x] NEW 16.2 Re-test the forgot-password flow and confirm the recovery link lands on `/auth/reset-password` with the password form visible.

- [ ] NEW 17.0 Rotate sensitive credentials that were exposed during auth setup and debugging
  - [ ] NEW 17.1 Rotate the Supabase service-role key and any other exposed Supabase secrets.
  - [ ] NEW 17.2 Rotate exposed third-party credentials, including Yahoo, Resend, database, and Google service-account secrets.
  - [ ] NEW 17.3 Update local and deployed environment configuration with the rotated values and verify dependent integrations still work.

- [x] NEW 18.0 Remove the remaining ambiguity from Supabase password-recovery redirects
  - [x] NEW 18.1 Change forgot-password emails to target `/auth/reset-password` directly instead of routing recovery through the generic callback page.
  - [x] NEW 18.2 Teach `/auth/reset-password` to accept recovery payloads delivered as `code`, `token_hash`, or hash-based session tokens.
  - [x] NEW 18.3 Add regression coverage for direct reset-page recovery links so future auth changes do not silently fall back to site-root sign-in behavior.

- [x] NEW 19.0 Harden homepage server-render fallbacks so upstream NHL outages do not make local development look broken
  - [x] NEW 19.1 Remove the stale JS season helper that could shadow the maintained TypeScript season helper on case-insensitive filesystems.
  - [x] NEW 19.2 Stop homepage server-side fetches from assuming every upstream response is valid JSON.
  - [x] NEW 19.3 Stop the homepage future-game search loop after the first upstream failure instead of retrying multiple slow external dates in sequence.

- [x] NEW 20.0 Fix the Supabase redirect allow-list mismatch that is still collapsing localhost recovery links back to the site root
  - [x] NEW 20.1 Replace the current localhost wildcard redirect entry with `http://localhost:3000/**` so nested auth routes like `/auth/reset-password` are allowed.
  - [x] NEW 20.2 Add exact localhost and production auth redirect entries for `/auth/callback` and `/auth/reset-password` so password recovery does not depend on wildcard behavior.
  - [x] NEW 20.3 Re-test forgot-password after the redirect allow-list fix and verify the recovery email now contains `/auth/reset-password` in `redirect_to`.

- [x] NEW 21.0 Eliminate the duplicate browser Supabase auth client that can interfere with recovery-session state changes
  - [x] NEW 21.1 Make `lib/supabase` re-export the shared browser client from `lib/supabase/client` instead of constructing a second GoTrue instance.

- [x] NEW 22.0 Replace the hanging password-update client call with a direct Auth API request that either succeeds or surfaces a real error
  - [x] NEW 22.1 Submit reset-password updates to `/auth/v1/user` with the active recovery access token instead of relying on the hanging `supabase.auth.updateUser(...)` path.
  - [x] NEW 22.2 Add an explicit timeout and direct error parsing so the reset screen no longer stalls indefinitely on "Updating your password now."

- [x] NEW 23.0 Restyle the auth surfaces to match the FHFH Neon Noir design system in `fhfh-styles.md`
  - [x] NEW 23.1 Update the auth modal, auth form, callback page, and reset-password page to use the FHFH accent typography, neon-glow interaction states, and glass/panel treatments.
  - [x] NEW 23.2 Replace generic auth-page spacing, borders, and buttons with the standardized FHFH panel, ghost-button, and accent-button patterns.
  - [x] NEW 23.3 Apply the same FHFH styling language to the account shell and connected-account cards so auth/account surfaces feel visually coherent.
  - [x] NEW 23.4 Add or update component/page tests only where styling changes require markup changes or new accessible labels.

- [ ] NEW 28.0 Investigate and eliminate the remaining `Multiple GoTrueClient instances detected` warnings still emitted in unrelated tests so the browser/client auth surface uses one clear singleton path everywhere.
  - [x] NEW 28.1 Disable automatic URL auth-payload processing in the main browser client because `/auth/callback` and `/auth/reset-password` already handle those flows explicitly.
  - [x] NEW 28.2 Give the read-only browser public client its own storage key so it does not contend with the primary authenticated browser client.
  - [ ] NEW 28.3 Verify in production that the warning no longer appears and that auth remains usable after Yahoo redirect round-trips.

- [ ] NEW 24.0 Implement the Yahoo Fantasy connected-account flow and first-pass league sync foundation
  - [x] NEW 24.1 Create the Yahoo connect/disconnect OAuth flow from account or league settings without coupling Yahoo to core site login.
  - [x] NEW 24.2 Store per-user Yahoo connection metadata in the connected-account model while keeping token material in the private token store.
  - [x] NEW 24.3 Build the first Yahoo league/team discovery sync so users with multiple Yahoo leagues can choose a default team and active league context.
  - [ ] NEW 24.4 Add guarded refresh controls, cooldown enforcement, and sync-run dedupe to avoid rapid repeated Yahoo sync attempts.
  - [ ] NEW 24.5 Keep the existing shared Yahoo refresh path untouched in `web/pages/api/v1/db/manual-refresh-yahoo-token.ts`.
  - [x] NEW 24.6 Drive the `League Settings` tab from synced Yahoo league scoring and roster data for the selected active Yahoo league instead of showing only generic user defaults.
  - [ ] NEW 24.7 Add Yahoo league/team dropdown switchers to `League Settings` and `Saved Teams`, backed by `user_provider_preferences.active_context`, so users can quickly swap active leagues without reconnecting.
  - [ ] NEW 24.8 Support saving imported Yahoo teams into `user_saved_teams` using synced `external_teams.roster_snapshot` plus linked `external_league_key` and `external_team_key`.
  - [ ] NEW 24.9 Sync and expose Yahoo league standings plus all league teams metadata so the account UI can show the full league field, not only the current user’s owned teams.
  - [ ] NEW 24.10 Add on-demand or cached views for other Yahoo teams’ rosters within a synced league.

- [ ] NEW 25.0 Implement the Fantrax connected-account and league-import foundation
  - [ ] NEW 25.1 Confirm the viable Fantrax integration path for this project (official API, partner access, or manual/import fallback) before coding against an unstable assumption.
  - [ ] NEW 25.2 Add the Fantrax connection architecture to account settings using the shared connected-account model.
  - [ ] NEW 25.3 Implement the first Fantrax league/team discovery or import flow with support for multiple leagues and default-team selection.
  - [ ] NEW 25.4 Add provider-specific sync-state, cooldown, and failure messaging for Fantrax so repeated retries stay controlled.

- [ ] NEW 26.0 Implement the ESPN connected-account placeholder-to-integration upgrade path
  - [ ] NEW 26.1 Decide whether ESPN support will use an authenticated wrapper, manual league import, or a server-side adapter before exposing a live connect button.
  - [ ] NEW 26.2 Add ESPN connected-account persistence and active-context selection using the shared provider model.
  - [ ] NEW 26.3 Support multiple ESPN leagues/teams and in-place switching of the active league context without forcing users off their working page.

- [ ] NEW 27.0 Implement Patreon account linking and entitlement materialization without coupling Patreon to site auth
  - [ ] NEW 27.1 Add the Patreon OAuth connect/disconnect flow from account settings only.
  - [ ] NEW 27.2 Sync Patreon member identity and entitlement state into `user_entitlements` while preventing one Patreon identity from being reused across multiple site users.
  - [ ] NEW 27.3 Surface Patreon-linked access state and perk eligibility in account settings without making Patreon a primary sign-in provider.
  - [ ] NEW 27.4 Add a manual re-sync path and support-facing status messaging for Patreon entitlement drift or billing-state changes.

- [ ] NEW 29.0 Remove Yahoo OAuth secrets and token artifacts from tracked files, rotate the exposed Yahoo app credentials/tokens, and replace repo-local secret storage with env-only or vault-backed handling.
  - [ ] NEW 29.1 Delete or quarantine `web/lib/supabase/Upserts/yahooAuth/token.json` from the tracked codebase after rotating the leaked credentials.
  - [ ] NEW 29.2 Rotate the Yahoo consumer key/secret and refresh any leaked Yahoo user tokens currently present in local env files or tracked artifacts.

- [ ] NEW 30.0 Complete the manual Yahoo app configuration for the new per-user OAuth callback flow.
  - [ ] NEW 30.1 Verify the Yahoo app redirect URI allows `/api/v1/account/yahoo/callback` for local development.
  - [ ] NEW 30.2 Verify the Yahoo app redirect URI allows `/api/v1/account/yahoo/callback` for production.
  - [ ] NEW 30.3 Confirm the Yahoo app redirect URI matches the exact origin/path currently used by the running environment, including scheme, host, port, and no accidental trailing-slash mismatch.
  - [ ] NEW 30.4 Adjust the local Yahoo testing plan because Yahoo requires `https` redirect URIs; use a trusted HTTPS origin for local callback testing or validate Yahoo only against a deployed HTTPS environment.
  - [ ] NEW 30.5 Configure the Yahoo OAuth client credentials in the deployed environment so production `/api/v1/account/yahoo/connect` can build the authorization URL.

- [ ] NEW 31.0 Expose a service-role-only PostgREST wrapper for encrypted connected-account token writes so Yahoo callback sync can persist provider tokens in production.
  - [ ] NEW 31.1 Apply the migration that exposes `public.upsert_connected_account_tokens_secure(...)`.
  - [ ] NEW 31.2 Redeploy the app so the Yahoo callback uses the public wrapper RPC instead of trying to call the `private` schema directly.

- [ ] NEW 32.0 Investigate why Yahoo discovery is finding leagues but zero owned teams after a successful OAuth callback.
  - [x] NEW 32.1 Validate the shape returned by `yahoo.user.game_teams(...)` for the connected Yahoo account and adjust the team flattening logic if the current parser is reading the wrong nesting level.
  - [ ] NEW 32.2 Verify the connected-account UI can show discovered Yahoo teams and default-team selection once owned-team parsing is corrected.
  - [x] NEW 32.3 Limit Yahoo league discovery to the latest/current Yahoo NHL game season by default instead of importing every historical league the user has ever had.
  - [x] NEW 32.4 Derive Yahoo `league_key` from `team_key` when the team payload omits it, and filter synced leagues to the owned-team league set when team discovery is present.
  - [ ] NEW 32.5 Evaluate using `public.yahoo_game_keys` as the authoritative current Yahoo NHL game/season source for provider discovery so current-season selection does not depend on per-user `user.games()` ordering.

- [ ] NEW 33.0 Stop auth/session hydration from blocking the account UI on secondary role lookups after provider redirects.
  - [x] NEW 33.1 Make the auth context publish the authenticated user immediately from the Supabase session before waiting on the optional `public.users` role query.
  - [x] NEW 33.2 Prevent the header from flashing the logged-out CTA while auth is still resolving.
  - [x] NEW 33.3 Add a logged-out mobile-menu auth CTA that opens the shared `AuthModal` so mobile users have the same sign-in/sign-up entry point as desktop.
  - [ ] NEW 33.4 Verify in production that `/account` no longer hangs on "Loading account settings..." after Yahoo redirect round-trips.

- [ ] NEW 34.0 Replace the current "clear browser history" auth recovery workaround with a targeted local FHFH auth-session reset.
  - [x] NEW 34.1 Add a browser-auth reset helper that clears only the FHFH/Supabase auth storage keys instead of wiping unrelated site logins.
  - [x] NEW 34.2 Reset stale local Supabase auth state before starting fresh sign-in attempts so hung modal submissions do not require full browser-history clearing.
  - [x] NEW 34.3 Add a visible `Reset Local Auth` action to the auth form as a user-facing recovery tool.
  - [ ] NEW 34.4 Verify in production that users can recover from stale local auth state without clearing unrelated browser sessions.
